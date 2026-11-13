import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ExceptionFilter,
  HttpException,
  Injectable,
} from "@nestjs/common";
import { Response } from "express";
import { DateTime } from "luxon";
import { createHash, randomBytes } from "node:crypto";

export type Role = "User" | "Admin" | "AirlineModerator" | "HotelModerator";
export interface Actor {
  id: string;
  role: Role;
  providerId?: string;
  sessionId: string;
  forcePasswordChange: boolean;
  emailVerified: boolean;
}
export const now = () => new Date();
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const token = () => randomBytes(32).toString("hex");
export const escapeRegex = (s: string) =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
export function money(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}
export function minor(value: number): number {
  return Math.round(money(value) * 100);
}
export function dateOnly(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !DateTime.fromISO(value).isValid)
    throw new BadRequestException("Expected a valid YYYY-MM-DD date");
  return value;
}
export function today(
  zone = process.env.APP_TIMEZONE || "Africa/Cairo",
): string {
  return DateTime.now().setZone(zone).toISODate()!;
}
export function nights(start: string, end: string): string[] {
  dateOnly(start);
  dateOnly(end);
  const count = DateTime.fromISO(end, { zone: "UTC" }).diff(
    DateTime.fromISO(start, { zone: "UTC" }),
    "days",
  ).days;
  if (count <= 0 || count > 366)
    throw new BadRequestException("Stay must be between 1 and 366 nights");
  return Array.from({ length: count }, (_, i) =>
    DateTime.fromISO(start, { zone: "UTC" }).plus({ days: i }).toISODate()!,
  );
}
export function overlaps(
  a: { start: string; end: string },
  b: { start: string; end: string },
): boolean {
  return a.start < b.end && b.start < a.end;
}
export function localInstant(value: string, zone: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value))
    throw new BadRequestException(
      "Use local YYYY-MM-DDTHH:mm without an offset",
    );
  const dt = DateTime.fromISO(value, { zone });
  if (!dt.isValid || dt.toFormat("yyyy-MM-dd'T'HH:mm") !== value.slice(0, 16))
    throw new BadRequestException("Invalid or nonexistent local time");
  if (dt.getPossibleOffsets().length > 1)
    throw new BadRequestException(
      "Ambiguous local time; choose an unambiguous departure or arrival time",
    );
  return dt.toUTC().toJSDate();
}
export function refundPercent(
  tiers: { threshold: number; refundPercent: number }[],
  days: number,
): number {
  return (
    [...tiers]
      .filter((t) => t.threshold <= days)
      .sort((a, b) => b.threshold - a.threshold)[0]?.refundPercent ?? 0
  );
}
export function pageNumber(value?: any): number {
  const p = Number(value ?? 1);
  if (!Number.isSafeInteger(p) || p < 1)
    throw new BadRequestException("page must be a positive integer");
  return p;
}
export async function paginated(
  model: any,
  filter: any,
  page: any = 1,
  sort: any = { createdAt: -1 },
) {
  const p = pageNumber(page);
  const [items, total] = await Promise.all([
    model
      .find(filter)
      .sort(sort)
      .skip((p - 1) * 10)
      .limit(10)
      .lean(),
    model.countDocuments(filter),
  ]);
  return { items, page: p, pageSize: 10, total, pages: Math.ceil(total / 10) };
}
export function allowFields(body: Record<string, any>, fields: string[]) {
  return Object.fromEntries(
    Object.entries(body).filter(
      ([k, v]) => fields.includes(k) && v !== undefined,
    ),
  );
}
@Injectable()
@Catch()
export class ApiErrors implements ExceptionFilter {
  catch(error: any, host: ArgumentsHost) {
    let status = error instanceof HttpException ? error.getStatus() : 500;
    let detail: any =
      error instanceof HttpException
        ? error.getResponse()
        : { message: "Internal server error" };
    if (error?.code === 11000) {
      status = 409;
      detail = {
        message: "A unique value or inventory allocation already exists",
      };
    }
    if (
      error?.name === "ValidationError" ||
      error?.name === "StrictModeError" ||
      error?.name === "CastError"
    ) {
      status = 400;
      detail = { message: "Invalid data supplied" };
    }
    if (status === 500) console.error(error);
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({
        statusCode: status,
        ...(typeof detail === "string" ? { message: detail } : detail),
        timestamp: new Date().toISOString(),
      });
  }
}
