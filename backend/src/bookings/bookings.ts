import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";
import { Types } from "mongoose";
import { DateTime } from "luxon";
import PDFDocument from "pdfkit";
import { Db, oid, same } from "../database.js";
import { Actor, money, paginated, refundPercent, today } from "../common.js";
import {
  BookingQueryDto,
  ConfirmDto,
  FlightBookingDto,
  FlightChangeDto,
  HotelBookingDto,
  SeatSelectionDto,
} from "../dto.js";
import { actorOf, Roles } from "../auth/auth.js";
import { Inventory } from "./inventory.js";
import { Ops } from "../ops.js";

@Injectable()
export class BookingsService {
  constructor(
    readonly db: Db,
    readonly inventory: Inventory,
    readonly ops: Ops,
  ) {}
  async own(actor: Actor, id: string, session?: any) {
    const b = await this.db.get("Booking", id, session);
    if (!same(b.userId, actor.id) || actor.role !== "User")
      throw new ForbiddenException("This booking belongs to another traveler");
    return b;
  }
  async preview(actor: Actor, dto: FlightBookingDto) {
    if (actor.role !== "User")
      throw new ForbiddenException("Traveler account required");
    await this.inventory.expireDue();
    const quote = await this.inventory.flightQuote(dto);
    return {
      ...quote,
      currency: process.env.PLATFORM_CURRENCY || "USD",
      message:
        "Summary only. Proceed to /flight-bookings/hold to reserve seats.",
    };
  }
  async holdFlight(actor: Actor, dto: FlightBookingDto) {
    await this.inventory.expireDue();
    return this.db.transaction(async (session) => {
      await this.inventory.lockUser(actor, session);
      const q = await this.inventory.flightQuote(dto, session);
      await this.inventory.acquireFlights(q, session);
      const [b] = await this.db.model("Booking").create(
        [
          {
            userId: oid(actor.id),
            type: "flight",
            providerIds: [
              ...new Set(q.segments.map((s: any) => s.airlineId)),
            ].map(oid),
            status: "Pending Payment",
            holdExpiresAt: new Date(Date.now() + 10 * 60000),
            amount: q.amount,
            currency: process.env.PLATFORM_CURRENCY || "USD",
            snapshot: { segments: q.segments, passengers: q.passengers },
            policySnapshot: q.policy,
            startsAt: q.startsAt,
            endsAt: q.endsAt,
          },
        ],
        { session },
      );
      return b;
    });
  }
  async holdHotel(actor: Actor, dto: HotelBookingDto) {
    await this.inventory.expireDue();
    return this.db.transaction(async (session) => {
      await this.inventory.lockUser(actor, session);
      const q = await this.inventory.hotelQuote(dto, session);
      const id = new Types.ObjectId();
      await this.inventory.acquireRooms(q, id, session);
      const [b] = await this.db.model("Booking").create(
        [
          {
            _id: id,
            userId: oid(actor.id),
            type: "hotel",
            providerIds: [oid(dto.hotelId)],
            status: "Pending Payment",
            holdExpiresAt: new Date(Date.now() + 10 * 60000),
            amount: q.amount,
            currency: process.env.PLATFORM_CURRENCY || "USD",
            snapshot: q,
            policySnapshot: q.policy,
            startsAt: q.startsAt,
            endsAt: q.endsAt,
          },
        ],
        { session },
      );
      return b;
    });
  }
  async list(actor: Actor, type: string, q: BookingQueryDto) {
    await this.inventory.expireDue();
    await this.complete();
    const filter: any = { userId: oid(actor.id), type };
    if (q.status) filter.status = q.status;
    if (q.group === "Cancelled")
      filter.status = { $in: ["Cancelled", "Expired"] };
    if (q.group === "Past")
      Object.assign(filter, {
        endsAt: { $lt: new Date() },
        status: { $nin: ["Cancelled", "Expired"] },
      });
    if (q.group === "Upcoming")
      Object.assign(filter, {
        endsAt: { $gte: new Date() },
        status: { $nin: ["Cancelled", "Expired"] },
      });
    return paginated(this.db.model("Booking"), filter, q.page);
  }
  async get(actor: Actor, id: string, type?: string) {
    await this.inventory.expireDue();
    await this.complete();
    const b = await this.own(actor, id);
    if (type && b.type !== type)
      throw new BadRequestException("Wrong booking type");
    const refunds = await this.db
      .model("Refund")
      .find({ bookingId: b._id })
      .lean();
    const pendingChange = b.type === "flight" && b.status === "Confirmed"
      ? await this.db.model("FlightChange").findOne({
          bookingId: b._id, status: "Pending Payment", expiresAt: { $gt: new Date() },
        }).select("_id").lean()
      : null;
    return { ...b.toObject(), refunds, ...(pendingChange ? { pendingChangeId: pendingChange._id } : {}) };
  }
  async policies(actor: Actor, type: string, id: string) {
    const b = await this.own(actor, id);
    if (b.type !== type) throw new BadRequestException("Wrong booking type");
    return {
      policies: b.policySnapshot,
      acceptedAt: b.policyAcceptedAt ?? null,
      amount: b.amount,
      currency: b.currency,
    };
  }
  async acceptPolicies(actor: Actor, type: string, id: string) {
    const b = await this.own(actor, id);
    if (
      b.type !== type ||
      b.status !== "Pending Payment" ||
      b.holdInvalidatedAt ||
      b.holdExpiresAt <= new Date()
    )
      throw new BadRequestException("Booking hold is not active");
    const updated = await this.db.model("Booking").findOneAndUpdate(
      {
        _id: b._id,
        status: "Pending Payment",
        holdInvalidatedAt: { $exists: false },
        holdExpiresAt: { $gt: new Date() },
      },
      { $set: { policyAcceptedAt: new Date() } },
      { returnDocument: "after" },
    );
    if (!updated) throw new ConflictException("Hold expired");
    return { acceptedAt: updated.policyAcceptedAt };
  }
  cancellationQuote(b: any) {
    if (
      (b.type === "flight" && b.startsAt <= new Date()) ||
      (b.type === "hotel" && b.snapshot.checkIn <= today(b.snapshot.timezone))
    )
      throw new BadRequestException("Cancellation deadline has passed");
    const days =
      b.type === "flight"
        ? Math.floor((+b.startsAt - Date.now()) / 86400000)
        : Math.floor(
            DateTime.fromISO(b.snapshot.checkIn, {
              zone: b.snapshot.timezone,
            }).diff(
              DateTime.now().setZone(b.snapshot.timezone).startOf("day"),
              "days",
            ).days,
          );
    const percentage = refundPercent(b.policySnapshot.cancellationTiers, days);
    return {
      percentage,
      amount: money((b.amount * percentage) / 100),
      currency: b.currency,
    };
  }
  async quoteCancel(actor: Actor, id: string) {
    const b = await this.own(actor, id);
    if (b.status !== "Confirmed")
      throw new BadRequestException("Only Confirmed bookings can be cancelled");
    return this.cancellationQuote(b);
  }
  async cancel(actor: Actor, id: string, type: string) {
    await this.db.transaction(async (session) => {
      const b = await this.own(actor, id, session);
      if (b.type !== type) throw new BadRequestException("Wrong booking type");
      if (b.status === "Cancelled") return;
      if (b.status !== "Confirmed")
        throw new BadRequestException(
          "Only Confirmed bookings can be cancelled",
        );
      const q = this.cancellationQuote(b);
      await this.inventory.cancelRecord(
        b,
        q.percentage,
        "Traveler cancellation",
        session,
      );
    });
    return this.get(actor, id, type);
  }
  async complete() {
    const time = new Date();
    await this.db
      .model("Flight")
      .updateMany(
        { status: "Scheduled", departureAt: { $lte: time } },
        { $set: { status: "Departed" } },
      );
    await this.db
      .model("Booking")
      .updateMany(
        { type: "flight", status: "Confirmed", endsAt: { $lt: time } },
        { $set: { status: "Completed" } },
      );
    const hotels = await this.db
      .model("Booking")
      .find({ type: "hotel", status: "Confirmed", endsAt: { $lt: time } })
      .lean();
    for (const b of hotels)
      if (b.snapshot.checkOut < today(b.snapshot.timezone))
        await this.db.transaction(async (session) => {
          const updated = await this.db
            .model("Booking")
            .updateOne(
              { _id: b._id, status: "Confirmed" },
              { $set: { status: "Completed" } },
              { session },
            );
          if (updated.modifiedCount)
            await this.db
              .model("RoomNight")
              .deleteMany({ bookingId: b._id }, { session });
        });
  }
  async ticket(actor: Actor, id: string, res: Response) {
    const b = await this.own(actor, id);
    if (b.type !== "flight" || !["Confirmed", "Completed"].includes(b.status))
      throw new BadRequestException(
        "E-ticket is available for Confirmed or Completed flight bookings",
      );
    res.type("application/pdf").attachment(`ticket-${b.reference}.pdf`);
    const pdf = new PDFDocument({ margin: 50 });
    pdf.pipe(res);
    pdf.fontSize(22).text("Travel Platform E-ticket").moveDown();
    pdf
      .fontSize(12)
      .text(`Reference: ${b.reference}`)
      .text(`Status: ${b.status}`)
      .text(`Total: ${b.amount.toFixed(2)} ${b.currency}`)
      .moveDown();
    const seats = await this.db.model("Seat").find({ bookingId: b._id }).lean();
    for (const s of b.snapshot.segments) {
      pdf
        .text(`${s.airlineName} ${s.flightNumber} - ${s.cabin}`)
        .text(`${s.departureAirport} -> ${s.arrivalAirport}`)
        .text(
          `Departure: ${DateTime.fromJSDate(new Date(s.departureAt)).setZone(s.departureZone).toISO()}`,
        )
        .text(
          `Arrival: ${DateTime.fromJSDate(new Date(s.arrivalAt))
            .setZone(s.arrivalZone || "UTC")
            .toISO()}`,
        )
        .moveDown();
      b.snapshot.passengers.forEach((p: any, i: number) => {
        const seat = seats.find((a: any) => same(a.flightId, s.flightId) && a.passengerIndex === i);
        const assignment = p.type === "infant" ? "Adult's lap" : seat?.label || "Unassigned";
        pdf.text(`${p.fullName} (${p.type}) - Seat: ${assignment} - Extra bags: ${p.extraBags}`);
      });
      pdf.moveDown();
    }
    pdf.end();
  }
  async change(actor: Actor, id: string, dto: FlightChangeDto) {
    await this.inventory.expireDue();
    return this.db.transaction(async (session) => {
      const b = await this.own(actor, id, session);
      if (
        b.type !== "flight" ||
        b.status !== "Confirmed" ||
        b.startsAt <= new Date()
      )
        throw new BadRequestException(
          "Only future Confirmed flight bookings may be changed",
        );
      if (
        await this.db
          .model("FlightChange")
          .exists({ bookingId: b._id, status: "Pending Payment" })
          .session(session)
      )
        throw new ConflictException("A change is already awaiting payment");
      if (dto.segments.length !== b.snapshot.segments.length)
        throw new BadRequestException(
          "Change must preserve the number of segments",
        );
      for (let i = 0; i < dto.segments.length; i++)
        if (
          dto.segments[i].cabin !== b.snapshot.segments[i].cabin ||
          dto.segments[i].flightId === b.snapshot.segments[i].flightId
        )
          throw new BadRequestException(
            "Choose different flights in the same cabin",
          );
      const quote = await this.inventory.flightQuote(
        { segments: dto.segments, passengers: b.snapshot.passengers },
        session,
      );
      for (let i = 0; i < quote.segments.length; i++)
        if (
          quote.segments[i].departureAirport !==
            b.snapshot.segments[i].departureAirport ||
          quote.segments[i].arrivalAirport !==
            b.snapshot.segments[i].arrivalAirport
        )
          throw new BadRequestException("Change must preserve each route");
      await this.inventory.acquireFlights(quote, session);
      const [change] = await this.db.model("FlightChange").create(
        [
          {
            bookingId: b._id,
            userId: b.userId,
            snapshot: {
              segments: quote.segments,
              passengers: b.snapshot.passengers,
            },
            policySnapshot: quote.policy,
            amount: quote.amount,
            difference: money(quote.amount - b.amount),
            revision: b.revision,
            expiresAt: new Date(Date.now() + 10 * 60000),
          },
        ],
        { session },
      );
      if (change.difference <= 0) await this.commitChange(b, change, session);
      return change;
    });
  }
  async commitChange(b: any, change: any, session: any) {
    if (
      change.status !== "Pending Payment" ||
      change.expiresAt <= new Date() ||
      b.status !== "Confirmed" ||
      b.revision !== change.revision
    )
      throw new ConflictException("Flight change is no longer eligible");
    await this.inventory.convert(change.snapshot, session);
    await this.inventory.release(b.snapshot, "flight", b._id, false, session);
    if (change.difference < 0)
      await this.inventory.refund(
        b,
        -change.difference,
        "Lower flight fare",
        `change:${change.id}`,
        session,
      );
    b.snapshot = change.snapshot;
    b.policySnapshot = change.policySnapshot;
    b.providerIds = [
      ...new Set(change.snapshot.segments.map((s: any) => s.airlineId)),
    ].map((x) => oid(String(x)));
    b.amount = change.amount;
    b.startsAt = change.snapshot.segments[0].departureAt;
    b.endsAt = change.snapshot.segments.at(-1).arrivalAt;
    b.revision++;
    await b.save({ session });
    change.status = "Committed";
    await change.save({ session });
    await this.ops.notify(
      b.userId,
      `Flight booking ${b.reference} changed successfully.`,
      `change:${change.id}`,
      undefined,
      session,
    );
  }
  async seats(actor: Actor, id: string, dto: SeatSelectionDto) {
    return this.db.transaction(async (session) => {
      const b = await this.own(actor, id, session);
      if (
        b.type !== "flight" ||
        b.status !== "Confirmed" ||
        b.startsAt <= new Date()
      )
        throw new BadRequestException(
          "Seats may be selected for future Confirmed flight bookings",
        );
      const segment = b.snapshot.segments.find(
        (s: any) => s.flightId === dto.flightId,
      );
      if (!segment)
        throw new BadRequestException("Flight is not part of this booking");
      const flight = await this.db.get("Flight", dto.flightId, session);
      const c = flight.cabins.find((c: any) => c.category === segment.cabin);
      const validLabels = Array.from(
        { length: c.capacity },
        (_, i) => `${Math.floor(i / 6) + 1}${"ABCDEF"[i % 6]}`,
      );
      if (
        dto.labels.length !== segment.seats ||
        new Set(dto.labels).size !== dto.labels.length ||
        dto.labels.some((s) => !validLabels.includes(s))
      )
        throw new BadRequestException(
          "Choose a unique valid seat for every non-infant passenger",
        );
      await this.db
        .model("Seat")
        .deleteMany({ bookingId: b._id, flightId: flight._id }, { session });
      const passengers = b.snapshot.passengers
        .map((p: any, i: number) => ({ p, i }))
        .filter((x: any) => x.p.type !== "infant");
      const assigned = await this.db.model("Seat").insertMany(
        dto.labels.map((label, i) => ({
          flightId: flight._id,
          category: segment.cabin,
          label,
          bookingId: b._id,
          passengerIndex: passengers[i].i,
        })),
        { session },
      );
      await this.db
        .model("Booking")
        .updateOne({ _id: b._id }, { $inc: { __v: 1 } }, { session });
      return assigned;
    });
  }
  async seatMap(actor: Actor, id: string) {
    const b = await this.own(actor, id);
    if (b.type !== "flight") throw new BadRequestException("Wrong booking type");
    const maps = [];
    for (const s of b.snapshot.segments) {
      const f = await this.db.get("Flight", s.flightId);
      const c = f.cabins.find((c: any) => c.category === s.cabin);
      const occupied = await this.db
        .model("Seat")
        .find({ flightId: f._id, category: c.category })
        .lean();
      maps.push({
        flightId: f.id,
        cabin: c.category,
        seats: Array.from({ length: c.capacity }, (_, i) => {
          const label = `${Math.floor(i / 6) + 1}${"ABCDEF"[i % 6]}`;
          const seat = occupied.find((x: any) => x.label === label);
          const selected = !!seat && same(seat.bookingId, b._id);
          return {
            label,
            available: !seat || selected,
            selected,
            ...(selected ? { passengerIndex: seat.passengerIndex } : {}),
          };
        }),
      });
    }
    return maps;
  }
}
@ApiTags("Flight bookings")
@ApiCookieAuth()
@Roles("User")
@Controller("flight-bookings")
export class FlightBookingsController {
  constructor(readonly bookings: BookingsService) {}
  @Post()
  @ApiOperation({
    summary: "FLT-19 FLT-21 Validate passengers and preview booking summary",
  })
  preview(@Req() r: Request, @Body() d: FlightBookingDto) {
    return this.bookings.preview(actorOf(r), d);
  }
  @Post("hold")
  @ApiOperation({
    summary: "FLT-22 Atomically hold every selected segment for 10 minutes",
  })
  hold(@Req() r: Request, @Body() d: FlightBookingDto) {
    return this.bookings.holdFlight(actorOf(r), d);
  }
  @Get() @ApiOperation({ summary: "FLT-25 List own flight bookings" }) list(
    @Req() r: Request,
    @Query() q: BookingQueryDto,
  ) {
    return this.bookings.list(actorOf(r), "flight", q);
  }
  @Get(":id")
  @ApiOperation({ summary: "FLT-25 View own flight booking and refunds" })
  get(@Req() r: Request, @Param("id") id: string) {
    return this.bookings.get(actorOf(r), id, "flight");
  }
  @Get(":id/cancellation-quote")
  @ApiOperation({ summary: "FLT-26 Preview cancellation refund" })
  quote(@Req() r: Request, @Param("id") id: string) {
    return this.bookings.quoteCancel(actorOf(r), id);
  }
  @Post(":id/cancel")
  @ApiOperation({
    summary: "FLT-26 Cancel booking after reviewing refund and confirming",
  })
  cancel(@Req() r: Request, @Param("id") id: string, @Body() _d: ConfirmDto) {
    return this.bookings.cancel(actorOf(r), id, "flight");
  }
  @Get(":id/e-ticket")
  @ApiOperation({ summary: "FLT-23 Download e-ticket PDF" })
  ticket(@Req() r: Request, @Param("id") id: string, @Res() res: Response) {
    return this.bookings.ticket(actorOf(r), id, res);
  }
  @Patch(":id/change-flight")
  @ApiOperation({
    summary:
      "FLT-27 [Bonus] Hold replacement flights; old booking remains valid until payment",
  })
  change(
    @Req() r: Request,
    @Param("id") id: string,
    @Body() d: FlightChangeDto,
  ) {
    return this.bookings.change(actorOf(r), id, d);
  }
  @Get(":id/seats")
  @ApiOperation({ summary: "FLT-28 [Bonus] View generated cabin seat maps" })
  map(@Req() r: Request, @Param("id") id: string) {
    return this.bookings.seatMap(actorOf(r), id);
  }
  @Patch(":id/seat")
  @ApiOperation({ summary: "FLT-28 [Bonus] Select seats atomically" })
  seats(
    @Req() r: Request,
    @Param("id") id: string,
    @Body() d: SeatSelectionDto,
  ) {
    return this.bookings.seats(actorOf(r), id, d);
  }
}
@ApiTags("Hotel bookings")
@ApiCookieAuth()
@Roles("User")
@Controller("hotel-bookings")
export class HotelBookingsController {
  constructor(readonly bookings: BookingsService) {}
  @Post()
  @ApiOperation({
    summary: "HTL-16 HTL-18 Hold all selected rooms together for 10 minutes",
  })
  hold(@Req() r: Request, @Body() d: HotelBookingDto) {
    return this.bookings.holdHotel(actorOf(r), d);
  }
  @Get() @ApiOperation({ summary: "HTL-20 List own hotel reservations" }) list(
    @Req() r: Request,
    @Query() q: BookingQueryDto,
  ) {
    return this.bookings.list(actorOf(r), "hotel", q);
  }
  @Get(":id")
  @ApiOperation({ summary: "HTL-20 View own reservation and refunds" })
  get(@Req() r: Request, @Param("id") id: string) {
    return this.bookings.get(actorOf(r), id, "hotel");
  }
  @Get(":id/cancellation-quote")
  @ApiOperation({
    summary: "HTL-21 Preview full-reservation cancellation refund",
  })
  quote(@Req() r: Request, @Param("id") id: string) {
    return this.bookings.quoteCancel(actorOf(r), id);
  }
  @Post(":id/cancel")
  @ApiOperation({ summary: "HTL-21 Cancel entire reservation" })
  cancel(@Req() r: Request, @Param("id") id: string, @Body() _d: ConfirmDto) {
    return this.bookings.cancel(actorOf(r), id, "hotel");
  }
}
@ApiTags("Policies")
@ApiCookieAuth()
@Roles("User")
@Controller("bookings")
export class PoliciesController {
  constructor(readonly bookings: BookingsService) {}
  @Get(":type/:id/policies")
  @ApiOperation({ summary: "PAY-02 Read snapshotted provider policies" })
  get(@Req() r: Request, @Param("type") t: string, @Param("id") id: string) {
    return this.bookings.policies(actorOf(r), t, id);
  }
  @Post(":type/:id/accept-policies")
  @ApiOperation({
    summary: "PAY-02 Record explicit policy acceptance before payment",
  })
  accept(
    @Req() r: Request,
    @Param("type") t: string,
    @Param("id") id: string,
    @Body() _d: ConfirmDto,
  ) {
    return this.bookings.acceptPolicies(actorOf(r), t, id);
  }
}
