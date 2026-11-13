import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ClientSession } from "mongoose";
import nodemailer from "nodemailer";
import { Db, oid } from "./database.js";
import { Actor, dateOnly, token } from "./common.js";

@Injectable()
export class Ops {
  constructor(readonly db: Db) {}
  async currency(code: string) {
    if (!(await this.db.model("Country").exists({ currency: code })))
      throw new BadRequestException("Unsupported currency");
    return code;
  }
  async city(id: string) {
    const c = await this.db.model("City").findOne({ city_id: id }).lean();
    if (!c) throw new BadRequestException("Unknown reference city");
    return c;
  }
  async countries(codes: string[]) {
    if (
      (await this.db
        .model("Country")
        .countDocuments({ code: { $in: codes } })) !== codes.length
    )
      throw new BadRequestException("Unknown or repeated country");
  }
  async enqueue(
    key: string,
    kind: string,
    payload: any,
    session?: ClientSession,
  ) {
    await this.db.model("Outbox").updateOne(
      { key },
      {
        $setOnInsert: {
          key,
          kind,
          payload,
          state: "Pending",
          nextAttemptAt: new Date(),
          attempts: 0,
        },
      },
      { upsert: true, session },
    );
  }
  async notify(
    userId: any,
    message: string,
    key = token(),
    link?: string,
    session?: ClientSession,
  ) {
    await this.db
      .model("Notification")
      .updateOne(
        { key },
        { $setOnInsert: { userId: oid(String(userId)), message, key, link } },
        { upsert: true, session },
      );
    if (process.env.ENABLE_EMAIL_BONUS === "true")
      await this.enqueue(
        `mail:${key}`,
        "notification-email",
        { userId: String(userId), message },
        session,
      );
  }
  async audit(
    actor: Actor,
    action: string,
    targetType: string,
    targetId: any,
    detail: any = {},
    session?: ClientSession,
  ) {
    await this.db
      .model("Audit")
      .create(
        [{ actorId: oid(actor.id), action, targetType, targetId, detail }],
        { session },
      );
  }
  async sendMail(to: string, subject: string, text: string) {
    if (!process.env.SMTP_HOST)
      throw new ServiceUnavailableException("SMTP is not configured");
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "true",
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
        : undefined,
      connectionTimeout: 10000,
      socketTimeout: 15000,
    });
    await transport.sendMail({
      from: process.env.SMTP_FROM,
      to,
      subject,
      text,
    });
  }
  async refreshRates() {
    const supported = await this.db.model("Country").distinct("currency");
    const url = new URL(
      process.env.FX_API_URL || "https://api.fxratesapi.com/latest",
    );
    url.searchParams.set("base", "USD");
    url.searchParams.set("currencies", supported.join(","));
    url.searchParams.set("resolution", "1d");
    if (process.env.FX_API_KEY)
      url.searchParams.set("api_key", process.env.FX_API_KEY);
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`FXRatesAPI returned ${response.status}`);
    const data = (await response.json()) as any;
    if (
      !data.success ||
      data.base !== "USD" ||
      !data.date ||
      !data.rates ||
      supported.some(
        (c: string) =>
          c !== "USD" && !(Number.isFinite(data.rates[c]) && data.rates[c] > 0),
      )
    )
      throw new Error("FXRatesAPI returned incomplete or invalid rates");
    const date = dateOnly(data.date.slice(0, 10));
    await this.db
      .model("ExchangeRate")
      .updateOne(
        { base: "USD", date },
        { $set: { rates: { ...data.rates, USD: 1 }, fetchedAt: new Date() } },
        { upsert: true },
      );
    return { date, base: "USD" };
  }
  async rates() {
    const cached = await this.db
      .model("ExchangeRate")
      .findOne({ base: "USD" })
      .sort({ date: -1 })
      .lean();
    if (!cached)
      throw new ServiceUnavailableException(
        "Exchange rates are unavailable; configure FXRatesAPI and run the refresh operation",
      );
    return cached;
  }
}
