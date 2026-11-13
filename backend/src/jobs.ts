import { Injectable, Logger } from "@nestjs/common";
import { Interval } from "@nestjs/schedule";
import { Db } from "./database.js";
import { Ops } from "./ops.js";
import { Inventory } from "./bookings/inventory.js";
import { BookingsService } from "./bookings/bookings.js";
import { PaymentsService } from "./payments/payments.js";

@Injectable()
export class Jobs {
  readonly logger = new Logger(Jobs.name);
  private running = false;
  constructor(
    readonly db: Db,
    readonly ops: Ops,
    readonly inventory: Inventory,
    readonly bookings: BookingsService,
    readonly payments: PaymentsService,
  ) {}
  @Interval(10000)
  async tick() {
    if (process.env.ENABLE_JOBS === "false" || this.running) return;
    this.running = true;
    try {
      await this.inventory.expireDue();
      await this.bookings.complete();
      await this.drain();
    } catch (error: any) {
      this.logger.error(`Background processing failed: ${error.message}`);
    } finally {
      this.running = false;
    }
  }
  @Interval(3600000)
  async rates() {
    if (process.env.ENABLE_JOBS === "false") return;
    const cached = await this.db
      .model("ExchangeRate")
      .findOne({ base: "USD" })
      .sort({ fetchedAt: -1 });
    if (cached && Date.now() - +cached.fetchedAt < 24 * 3600000) return;
    try {
      await this.ops.refreshRates();
    } catch (error: any) {
      this.logger.warn(
        `Exchange-rate refresh failed; cached rates remain available: ${error.message}`,
      );
    }
  }
  async drain(limit = 25) {
    for (let i = 0; i < limit; i++) {
      const now = new Date();
      const job = await this.db.model("Outbox").findOneAndUpdate(
        {
          $or: [
            { state: "Pending", nextAttemptAt: { $lte: now } },
            { state: "Running", leaseUntil: { $lt: now } },
          ],
        },
        {
          $set: { state: "Running", leaseUntil: new Date(Date.now() + 120000) },
          $inc: { attempts: 1 },
        },
        { returnDocument: "after", sort: { createdAt: 1 } },
      );
      if (!job) return;
      try {
        if (job.kind === "refund")
          await this.payments.refundWork(job.payload.refundId);
        else if (job.kind === "cancel-payment")
          await this.payments.cancelWork(job.payload.paymentId);
        else if (job.kind === "email")
          await this.ops.sendMail(
            job.payload.to,
            job.payload.subject,
            job.payload.text,
          );
        else if (job.kind === "notification-email") {
          const user = await this.db.get("User", job.payload.userId);
          await this.ops.sendMail(
            user.email,
            "Travel Platform notification",
            job.payload.message,
          );
        } else throw new Error("Unknown outbox operation");
        await this.db
          .model("Outbox")
          .updateOne(
            { _id: job._id, leaseUntil: job.leaseUntil, state: "Running" },
            { $set: { state: "Done" }, $unset: { error: 1, leaseUntil: 1 } },
          );
      } catch (error: any) {
        await this.db.model("Outbox").updateOne(
          { _id: job._id, leaseUntil: job.leaseUntil, state: "Running" },
          {
            $set: {
              state: "Pending",
              error: String(error.message).slice(0, 500),
              nextAttemptAt: new Date(
                Date.now() +
                  Math.min(3600000, 1000 * 2 ** Math.min(job.attempts, 12)),
              ),
            },
            $unset: { leaseUntil: 1 },
          },
        );
      }
    }
  }
}
