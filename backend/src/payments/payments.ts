import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Injectable,
  Param,
  Post,
  RawBodyRequest,
  Req,
  ServiceUnavailableException,
} from "@nestjs/common";
import {
  ApiCookieAuth,
  ApiHeader,
  ApiOperation,
  ApiTags,
} from "@nestjs/swagger";
import { Request } from "express";
import Stripe from "stripe";
import { randomBytes } from "node:crypto";
import { Db, oid, same } from "../database.js";
import { Actor, minor } from "../common.js";
import { ConfirmDto, PaymentDto } from "../dto.js";
import { actorOf, Public, Roles } from "../auth/auth.js";
import { BookingsService } from "../bookings/bookings.js";
import { Inventory } from "../bookings/inventory.js";
import { Ops } from "../ops.js";

@Injectable()
export class PaymentsService {
  readonly stripe?: Stripe;
  constructor(
    readonly db: Db,
    readonly bookings: BookingsService,
    readonly inventory: Inventory,
    readonly ops: Ops,
  ) {
    if (process.env.STRIPE_SECRET_KEY) {
      if (!process.env.STRIPE_SECRET_KEY.startsWith("sk_test_"))
        throw new Error("Only Stripe test-mode keys are permitted");
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
        maxNetworkRetries: 2,
        timeout: 15000,
      });
    }
  }
  configured() {
    if (!this.stripe)
      throw new ServiceUnavailableException(
        "Stripe test-mode credentials are not configured",
      );
    return this.stripe;
  }
  async create(actor: Actor, dto: PaymentDto) {
    this.configured();
    await this.inventory.expireDue();
    const payment = await this.db.transaction(async (session) => {
      const b = await this.bookings.own(actor, dto.bookingId, session);
      if (
        b.type !== dto.type ||
        b.status !== "Pending Payment" ||
        b.holdInvalidatedAt ||
        b.holdExpiresAt <= new Date()
      )
        throw new ConflictException("Booking hold is not active");
      if (!b.policyAcceptedAt)
        throw new BadRequestException(
          "Accept provider policies before payment",
        );
      if (b.paymentId) return this.db.get("Payment", b.paymentId, session);
      const [p] = await this.db.model("Payment").create(
        [
          {
            bookingId: b._id,
            userId: b.userId,
            amount: b.amount,
            currency: b.currency,
            purpose: "booking",
            status: "Creating",
          },
        ],
        { session },
      );
      b.paymentId = p._id;
      await b.save({ session });
      return p;
    });
    return this.ensureIntent(payment);
  }
  async createChange(actor: Actor, changeId: string) {
    this.configured();
    const payment = await this.db.transaction(async (session) => {
      const c = await this.db.get("FlightChange", changeId, session);
      await this.bookings.own(actor, String(c.bookingId), session);
      if (
        c.status !== "Pending Payment" ||
        c.expiresAt <= new Date() ||
        c.difference <= 0
      )
        throw new ConflictException("Flight change is not awaiting payment");
      if (!c.policyAcceptedAt)
        throw new BadRequestException(
          "Accept the replacement provider policies before paying the fare difference",
        );
      if (c.paymentId) return this.db.get("Payment", c.paymentId, session);
      const booking = await this.db.get("Booking", c.bookingId, session);
      const [p] = await this.db.model("Payment").create(
        [
          {
            bookingId: c.bookingId,
            userId: c.userId,
            purpose: "change",
            changeId: c._id,
            amount: c.difference,
            currency: booking.currency,
            status: "Creating",
          },
        ],
        { session },
      );
      c.paymentId = p._id;
      await c.save({ session });
      return p;
    });
    return this.ensureIntent(payment);
  }
  async ensureIntent(payment: any) {
    const stripe = this.configured();
    let intent: Stripe.PaymentIntent;
    if (payment.stripeId)
      intent = await stripe.paymentIntents.retrieve(payment.stripeId);
    else {
      intent = await stripe.paymentIntents.create(
        {
          amount: minor(payment.amount),
          currency: payment.currency.toLowerCase(),
          allowed_payment_method_types: ["card"],
          metadata: {
            paymentId: payment.id,
            bookingId: String(payment.bookingId),
            purpose: payment.purpose,
          },
        },
        { idempotencyKey: `payment:${payment.id}` },
      );
      await this.db
        .model("Payment")
        .updateOne(
          { _id: payment._id, stripeId: { $exists: false } },
          { $set: { stripeId: intent.id, status: "Pending" } },
        );
    }
    const booking = await this.db.get("Booking", payment.bookingId);
    const change =
      payment.changeId && (await this.db.get("FlightChange", payment.changeId));
    if (
      payment.purpose === "booking"
        ? booking.status !== "Pending Payment" ||
          booking.holdInvalidatedAt ||
          booking.holdExpiresAt <= new Date()
        : change.status !== "Pending Payment" || change.expiresAt <= new Date()
    ) {
      await this.ops.enqueue(`cancel-payment:${payment.id}`, "cancel-payment", {
        paymentId: payment.id,
      });
      throw new ConflictException("Hold is no longer active");
    }
    return {
      paymentId: payment.id,
      stripePaymentId: intent.id,
      clientSecret: intent.client_secret,
      status: intent.status,
      amount: payment.amount,
      currency: payment.currency,
      message:
        "Use Stripe.js/Elements to submit payment details directly to Stripe; confirmation occurs only through the signed webhook.",
    };
  }
  async changeDetails(actor: Actor, id: string) {
    const change = await this.db.get("FlightChange", id);
    await this.bookings.own(actor, String(change.bookingId));
    return change;
  }
  async acceptChangePolicies(actor: Actor, id: string) {
    const change = await this.changeDetails(actor, id);
    const updated = await this.db.model("FlightChange").findOneAndUpdate(
      {
        _id: change._id,
        status: "Pending Payment",
        expiresAt: { $gt: new Date() },
      },
      { $set: { policyAcceptedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!updated)
      throw new ConflictException("Flight change hold is no longer active");
    return {
      acceptedAt: updated.policyAcceptedAt,
      policies: updated.policySnapshot,
    };
  }
  async get(actor: Actor, id: string, retry = false) {
    const p = await this.db.get("Payment", id);
    await this.bookings.own(actor, String(p.bookingId));
    if (retry) return this.ensureIntent(p);
    return {
      id: p.id,
      bookingId: p.bookingId,
      purpose: p.purpose,
      stripeId: p.stripeId,
      amount: p.amount,
      currency: p.currency,
      status: p.status,
    };
  }
  async webhook(req: RawBodyRequest<Request>) {
    const stripe = this.configured();
    if (!process.env.STRIPE_WEBHOOK_SECRET)
      throw new ServiceUnavailableException(
        "Stripe webhook signing secret is not configured",
      );
    const signature = req.headers["stripe-signature"];
    if (!req.rawBody || typeof signature !== "string")
      throw new BadRequestException("Signed raw webhook body required");
    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        req.rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET,
      );
    } catch {
      throw new BadRequestException("Invalid Stripe webhook signature");
    }
    if (event.livemode)
      throw new BadRequestException("Live Stripe events are not accepted");
    await this.processEvent(event);
    return { received: true };
  }
  async processEvent(event: Stripe.Event) {
    try {
      await this.db.transaction(async (session) => {
        if (
          await this.db
            .model("StripeEvent")
            .exists({ eventId: event.id, processedAt: { $exists: true } })
            .session(session)
        )
          return;
        const saved = await this.db
          .model("StripeEvent")
          .findOneAndUpdate(
            { eventId: event.id },
            { $setOnInsert: { eventId: event.id, type: event.type } },
            { upsert: true, session, returnDocument: "after" },
          );
        if (event.type === "payment_intent.succeeded") {
          const intent = event.data.object as Stripe.PaymentIntent;
          const payment = await this.db
            .model("Payment")
            .findOne({
              $or: [
                { stripeId: intent.id },
                ...(intent.metadata?.paymentId &&
                /^[a-f0-9]{24}$/i.test(intent.metadata.paymentId)
                  ? [{ _id: oid(intent.metadata.paymentId) }]
                  : []),
              ],
            })
            .session(session);
          if (payment && payment.status !== "Succeeded") {
            if (
              intent.status !== "succeeded" ||
              intent.amount_received !== minor(payment.amount) ||
              intent.currency.toUpperCase() !== payment.currency ||
              intent.metadata.bookingId !== String(payment.bookingId) ||
              (payment.stripeId && payment.stripeId !== intent.id)
            )
              throw new BadRequestException("Payment verification mismatch");
            payment.stripeId = intent.id;
            payment.status = "Succeeded";
            await payment.save({ session });
            const b = await this.db.get("Booking", payment.bookingId, session);
            const activeUser = await this.db
              .model("User")
              .findOneAndUpdate(
                { _id: b.userId, status: "Active" },
                { $inc: { __v: 1 } },
                { session },
              );
            let fulfill = false;
            if (payment.purpose === "change") {
              const change = await this.db.get(
                "FlightChange",
                payment.changeId,
                session,
              );
              fulfill =
                change.status === "Pending Payment" &&
                change.expiresAt > new Date() &&
                b.status === "Confirmed" &&
                b.revision === change.revision;
              if (!activeUser) fulfill = false;
              if (fulfill) {
                for (const s of change.snapshot.segments) {
                  const f = await this.db.get("Flight", s.flightId, session);
                  if (f.status !== "Scheduled" || f.departureAt <= new Date())
                    fulfill = false;
                  const provider = await this.db
                    .model("Provider")
                    .findOneAndUpdate(
                      { _id: oid(s.airlineId), active: true },
                      { $inc: { __v: 1 } },
                      { session },
                    );
                  if (!provider) fulfill = false;
                }
              }
              if (fulfill) await this.bookings.commitChange(b, change, session);
              else if (change.status === "Pending Payment")
                await this.inventory.expireChange(change, session);
            } else {
              fulfill =
                b.status === "Pending Payment" &&
                !b.holdInvalidatedAt &&
                b.holdExpiresAt > new Date();
              if (!activeUser) fulfill = false;
              if (fulfill && b.type === "flight") {
                for (const s of b.snapshot.segments) {
                  const f = await this.db.get("Flight", s.flightId, session);
                  if (f.status !== "Scheduled" || f.departureAt <= new Date())
                    fulfill = false;
                }
              }
              if (fulfill) {
                // Provider deactivation preserves existing Confirmed bookings but blocks new confirmations.
                for (const providerId of b.providerIds) {
                  const p = await this.db
                    .model("Provider")
                    .findOneAndUpdate(
                      { _id: providerId, active: true },
                      { $inc: { __v: 1 } },
                      { session },
                    );
                  if (!p) fulfill = false;
                }
              }
              if (fulfill) {
                if (b.type === "flight")
                  await this.inventory.convert(b.snapshot, session);
                b.status = "Confirmed";
                b.confirmedAt = new Date();
                b.reference = `TRV-${randomBytes(8).toString("hex").toUpperCase()}`;
                await b.save({ session });
                await this.ops.notify(
                  b.userId,
                  `Booking ${b.reference} confirmed.`,
                  `confirm:${b.id}`,
                  undefined,
                  session,
                );
              } else if (b.status === "Pending Payment") {
                await this.inventory.invalidateHold(
                  b,
                  "Payment could not be fulfilled",
                  session,
                );
                if (b.holdExpiresAt <= new Date()) {
                  b.status = "Expired";
                  await b.save({ session });
                }
              }
            }
            if (!fulfill)
              await this.inventory.refund(
                b,
                payment.amount,
                "Payment could not be fulfilled; automatic full refund",
                `unfulfilled:${payment.id}`,
                session,
                payment._id,
              );
          }
        } else if (
          event.type === "payment_intent.payment_failed" ||
          event.type === "payment_intent.canceled"
        ) {
          const intent = event.data.object as Stripe.PaymentIntent;
          await this.db.model("Payment").updateOne(
            { stripeId: intent.id, status: { $ne: "Succeeded" } },
            {
              $set: {
                status: event.type.endsWith("canceled")
                  ? "Cancelled"
                  : "Failed",
              },
            },
            { session },
          );
        } else if (
          event.type === "refund.updated" ||
          event.type === "refund.created" ||
          event.type === "refund.failed"
        ) {
          const refund = event.data.object as Stripe.Refund;
          const r = await this.db
            .model("Refund")
            .findOne({ stripeId: refund.id })
            .session(session);
          if (r && r.status !== "Refunded") {
            r.status =
              refund.status === "succeeded"
                ? "Refunded"
                : ["failed", "canceled"].includes(refund.status || "")
                  ? "Failed"
                  : "Pending";
            await r.save({ session });
            await this.ops.notify(
              r.userId,
              `Refund status: ${r.status}.`,
              `refund-status:${event.id}`,
              undefined,
              session,
            );
          }
        }
        saved.processedAt = new Date();
        await saved.save({ session });
      });
    } catch (error: any) {
      if (
        error.code === 11000 &&
        (await this.db
          .model("StripeEvent")
          .exists({ eventId: event.id, processedAt: { $exists: true } }))
      )
        return;
      throw error;
    }
  }
  async refundWork(refundId: string) {
    const r = await this.db.get("Refund", refundId);
    if (r.status === "Refunded") return;
    const p = await this.db.get("Payment", r.paymentId);
    try {
      const refund = r.stripeId
        ? await this.configured().refunds.retrieve(r.stripeId)
        : await this.configured().refunds.create(
            {
              payment_intent: p.stripeId,
              amount: minor(r.amount),
              metadata: { refundId: r.id },
            },
            { idempotencyKey: `refund:${r.id}` },
          );
      r.stripeId = refund.id;
      r.status =
        refund.status === "succeeded"
          ? "Refunded"
          : ["failed", "canceled"].includes(refund.status || "")
            ? "Failed"
            : "Pending";
      r.error = undefined;
      await r.save();
      await this.ops.notify(
        r.userId,
        `Refund ${r.amount} ${r.currency}: ${r.status}.`,
        `refund-work:${r.id}:${r.status}`,
      );
      if (r.status === "Failed")
        throw new Error(
          "Stripe refund failed; operator reconciliation is required",
        );
    } catch (error: any) {
      r.status = "Failed";
      r.error = "Refund request failed; see server logs for reconciliation";
      await r.save();
      throw error;
    }
  }
  async cancelWork(paymentId: string) {
    const p = await this.db.get("Payment", paymentId);
    if (!p.stripeId) {
      await this.ensureCancelledIntent(p);
      return;
    }
    const stripe = this.configured();
    const intent = await stripe.paymentIntents.retrieve(p.stripeId);
    if (intent.status === "succeeded") {
      // Reconcile even if the success webhook was delayed or never delivered.
      await this.processEvent({
        id: `reconcile:${intent.id}`,
        type: "payment_intent.succeeded",
        livemode: false,
        data: { object: intent },
      } as unknown as Stripe.Event);
      return;
    }
    if (intent.status !== "canceled")
      await stripe.paymentIntents.cancel(
        intent.id,
        {},
        { idempotencyKey: `cancel:${p.id}` },
      );
    await this.db
      .model("Payment")
      .updateOne(
        { _id: p._id, status: { $ne: "Succeeded" } },
        { $set: { status: "Cancelled" } },
      );
  }
  async ensureCancelledIntent(p: any) {
    // Recover a crash between intent creation and persisting its ID using the same idempotency key.
    const intent = await this.configured().paymentIntents.create(
      {
        amount: minor(p.amount),
        currency: p.currency.toLowerCase(),
        allowed_payment_method_types: ["card"],
        metadata: {
          paymentId: p.id,
          bookingId: String(p.bookingId),
          purpose: p.purpose,
        },
      },
      { idempotencyKey: `payment:${p.id}` },
    );
    await this.db
      .model("Payment")
      .updateOne({ _id: p._id }, { $set: { stripeId: intent.id } });
    await this.cancelWork(p.id);
  }
  async refundGet(actor: Actor, id: string) {
    const r = await this.db.get("Refund", id);
    if (!same(r.userId, actor.id) && actor.role !== "Admin")
      throw new BadRequestException("Refund unavailable");
    return r;
  }
}
@ApiTags("Payments")
@ApiCookieAuth()
@Controller("payments")
export class PaymentsController {
  constructor(readonly payments: PaymentsService) {}
  @Post()
  @Roles("User")
  @ApiOperation({
    summary: "PAY-01 Create or resume Stripe test PaymentIntent",
  })
  create(@Req() r: Request, @Body() d: PaymentDto) {
    return this.payments.create(actorOf(r), d);
  }
  @Post("webhook")
  @Public()
  @ApiHeader({ name: "stripe-signature", required: true })
  @ApiOperation({
    summary: "PAY-01 Signed Stripe webhook; no browser authentication",
  })
  webhook(@Req() r: RawBodyRequest<Request>) {
    return this.payments.webhook(r);
  }
  @Post(":id/retry")
  @Roles("User")
  @ApiOperation({ summary: "PAY-01 Retry within the original hold period" })
  retry(@Req() r: Request, @Param("id") id: string) {
    return this.payments.get(actorOf(r), id, true);
  }
  @Get(":id")
  @Roles("User")
  @ApiOperation({ summary: "PAY-01 Read own payment status" })
  get(@Req() r: Request, @Param("id") id: string) {
    return this.payments.get(actorOf(r), id);
  }
}
@ApiTags("Refunds")
@ApiCookieAuth()
@Controller("refunds")
export class RefundsController {
  constructor(readonly payments: PaymentsService) {}
  @Get(":id") @ApiOperation({ summary: "PAY-03 Inspect refund status" }) get(
    @Req() r: Request,
    @Param("id") id: string,
  ) {
    return this.payments.refundGet(actorOf(r), id);
  }
}
@ApiTags("Flight changes [Bonus]")
@ApiCookieAuth()
@Roles("User")
@Controller("flight-changes")
export class FlightChangesController {
  constructor(readonly payments: PaymentsService) {}
  @Get(":id")
  @ApiOperation({
    summary:
      "FLT-27 [Bonus] Inspect own flight change and replacement policies",
  })
  get(@Req() r: Request, @Param("id") id: string) {
    return this.payments.changeDetails(actorOf(r), id);
  }
  @Get(":id/policies")
  @ApiOperation({
    summary: "FLT-27 PAY-02 [Bonus] Read replacement flight policy snapshot",
  })
  async policies(@Req() r: Request, @Param("id") id: string) {
    const c = await this.payments.changeDetails(actorOf(r), id);
    return {
      policies: c.policySnapshot,
      acceptedAt: c.policyAcceptedAt ?? null,
    };
  }
  @Post(":id/accept-policies")
  @ApiOperation({
    summary:
      "FLT-27 PAY-02 [Bonus] Accept replacement policies before fare payment",
  })
  accept(@Req() r: Request, @Param("id") id: string, @Body() _dto: ConfirmDto) {
    return this.payments.acceptChangePolicies(actorOf(r), id);
  }
  @Post(":id/payment")
  @ApiOperation({
    summary:
      "FLT-27 [Bonus] Pay the additional fare for a pending flight change",
  })
  pay(@Req() r: Request, @Param("id") id: string) {
    return this.payments.createChange(actorOf(r), id);
  }
}
