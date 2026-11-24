import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { DateTime } from "luxon";
import { Db, oid } from "../database.js";
import {
  Actor,
  dateOnly,
  escapeRegex,
  money,
  pageNumber,
  paginated,
} from "../common.js";
import {
  AccountQueryDto,
  AnalyticsDto,
  BookingQueryDto,
  ConfirmDto,
  HideContentDto,
  ModeratorDto,
  PageDto,
  ResolveReportDto,
  TemporaryPasswordDto,
} from "../dto.js";
import { actorOf, passwordHash, Roles, safeUser } from "../auth/auth.js";
import { Ops } from "../ops.js";
import { CommunityService } from "../community/community.js";

@Injectable()
export class AdminService {
  constructor(
    readonly db: Db,
    readonly ops: Ops,
    readonly community: CommunityService,
  ) {}
  async moderator(actor: Actor, dto: ModeratorDto) {
    const p = await this.db.get("Provider", dto.providerId);
    if ((dto.role === "AirlineModerator" ? "airline" : "hotel") !== p.type)
      throw new BadRequestException("Moderator role does not match provider");
    return this.db.transaction(async (session) => {
      const [u] = await this.db.model("User").create(
        [
          {
            name: dto.name,
            email: dto.email.toLowerCase(),
            role: dto.role,
            providerId: p._id,
            passwordHash: await passwordHash(dto.temporaryPassword),
            forcePasswordChange: true,
            consentAt: new Date(),
            emailVerified: true,
          },
        ],
        { session },
      );
      await this.ops.audit(
        actor,
        "create-moderator",
        "User",
        u._id,
        { providerId: p._id },
        session,
      );
      if (process.env.ENABLE_EMAIL_BONUS === "true")
        await this.ops.enqueue(
          `moderator-invite:${u.id}`,
          "email",
          {
            to: u.email,
            subject: "Moderator account created",
            text: "Your moderator account is ready. Obtain your temporary password securely from the administrator. You must change it on first login.",
          },
          session,
        );
      return safeUser(u);
    });
  }
  async accounts(q: AccountQueryDto) {
    const filter: any = {};
    if (q.role) filter.role = q.role;
    if (q.status) filter.status = q.status;
    if (q.q) {
      const rx = new RegExp(escapeRegex(q.q), "i");
      filter.$or = [{ name: rx }, { email: rx }];
    }
    const result = await paginated(this.db.model("User"), filter, q.page);
    return { ...result, items: result.items.map(safeUser) };
  }
  async reset(actor: Actor, id: string, dto: TemporaryPasswordDto) {
    return this.db.transaction(async (session) => {
      const u = await this.db.get("User", id, session);
      if (u.role === "Admin")
        throw new BadRequestException(
          "Use change-password for administrator accounts",
        );
      u.passwordHash = await passwordHash(dto.temporaryPassword);
      u.forcePasswordChange = true;
      u.failedLogins = 0;
      u.lockedUntil = undefined;
      u.resetHash = undefined;
      u.resetExpires = undefined;
      await u.save({ session });
      await this.db
        .model("Session")
        .updateMany(
          { userId: u._id },
          { $set: { revokedAt: new Date() } },
          { session },
        );
      await this.ops.audit(actor, "reset-password", "User", u._id, {}, session);
      return {
        message:
          "Temporary password set; the account must change it on next login",
      };
    });
  }
  async status(actor: Actor, id: string, suspend: boolean) {
    return this.db.transaction(async (session) => {
      const u = await this.db.get("User", id, session);
      if (u.role === "Admin" || u.status === "Deactivated")
        throw new BadRequestException(
          "This account cannot be suspended/reactivated through this action",
        );
      u.status = suspend ? "Suspended" : "Active";
      await u.save({ session });
      if (suspend)
        await this.db
          .model("Session")
          .updateMany(
            { userId: u._id },
            { $set: { revokedAt: new Date() } },
            { session },
          );
      await this.ops.notify(
        u._id,
        `Your account is ${u.status.toLowerCase()}.`,
        undefined,
        undefined,
        session,
      );
      await this.ops.audit(
        actor,
        suspend ? "suspend" : "reactivate",
        "User",
        u._id,
        {},
        session,
      );
      return safeUser(u);
    });
  }
  async providerStatus(
    actor: Actor,
    type: string,
    id: string,
    active: boolean,
  ) {
    if (!["hotel", "airline"].includes(type))
      throw new BadRequestException("Provider type must be hotel or airline");
    return this.db.transaction(async (session) => {
      const p = await this.db.get("Provider", id, session);
      if (p.type !== type)
        throw new BadRequestException("Provider type mismatch");
      p.active = active;
      await p.save({ session });
      const moderators = await this.db
        .model("User")
        .find({ providerId: p._id })
        .session(session);
      const bookings = await this.db
        .model("Booking")
        .find({
          providerIds: p._id,
          status: { $in: ["Pending Payment", "Confirmed"] },
        })
        .session(session);
      const users = new Set([
        ...moderators.map((u: any) => u.id),
        ...bookings.map((b: any) => String(b.userId)),
      ]);
      for (const userId of users)
        await this.ops.notify(
          userId,
          `${p.name} has been ${active ? "reactivated" : "deactivated"}. Existing Confirmed bookings remain valid.`,
          undefined,
          undefined,
          session,
        );
      await this.ops.audit(
        actor,
        active ? "reactivate-provider" : "deactivate-provider",
        "Provider",
        p._id,
        {},
        session,
      );
      return p;
    });
  }
  bookings(q: BookingQueryDto) {
    const filter: any = {};
    if (q.type) filter.type = q.type;
    if (q.status) filter.status = q.status;
    if (q.from || q.to) {
      if (q.from) dateOnly(q.from);
      if (q.to) dateOnly(q.to);
      if (q.from && q.to && q.from > q.to)
        throw new BadRequestException("from exceeds to");
      filter.startsAt = {
        ...(q.from ? { $gte: new Date(`${q.from}T00:00:00Z`) } : {}),
        ...(q.to
          ? {
              $lt: DateTime.fromISO(q.to, { zone: "UTC" })
                .plus({ days: 1 })
                .toJSDate(),
            }
          : {}),
      };
    }
    return paginated(this.db.model("Booking"), filter, q.page);
  }
  async moderate(
    actor: Actor,
    type: string,
    id: string,
    action: "hide" | "show" | "delete",
    session?: any,
  ) {
    const doc = await this.db.get(
      this.community.contentModel(type),
      id,
      session,
    );
    if (action === "delete")
      await this.community.deleteContent(type, id, session);
    else {
      doc.hidden = action === "hide";
      await doc.save({ session });
      if (type === "review") await this.community.ratings(doc.hotelId, session);
    }
    await this.ops.audit(
      actor,
      `${action}-content`,
      type,
      oid(id),
      {},
      session,
    );
    return {
      message: `Content ${action === "delete" ? "deleted" : action === "hide" ? "hidden" : "visible"}`,
    };
  }
  async resolve(actor: Actor, id: string, dto: ResolveReportDto) {
    return this.db.transaction(async (session) => {
      const report = await this.db.get("Report", id, session);
      if (report.status !== "Open")
        throw new BadRequestException("Report is already resolved");
      if (dto.action !== "dismiss")
        await this.moderate(
          actor,
          report.contentType,
          String(report.contentId),
          dto.action as "hide" | "delete",
          session,
        );
      report.status = {
        dismiss: "Dismissed",
        hide: "Hidden",
        delete: "Deleted",
      }[dto.action];
      report.resolvedBy = oid(actor.id);
      await report.save({ session });
      await this.ops.audit(
        actor,
        `resolve-report:${dto.action}`,
        "Report",
        report._id,
        {},
        session,
      );
      return report;
    });
  }
  async analytics(q: AnalyticsDto) {
    dateOnly(q.from);
    dateOnly(q.to);
    if (q.from > q.to) throw new BadRequestException("from exceeds to");
    const start = new Date(`${q.from}T00:00:00Z`),
      end = DateTime.fromISO(q.to, { zone: "UTC" })
        .plus({ days: 1 })
        .toJSDate();
    const bookings = await this.db
      .model("Booking")
      .find({ createdAt: { $gte: start, $lt: end } })
      .lean();
    const rows: Record<string, any> = {};
    for (const b of bookings) {
      const payments = await this.db
        .model("Payment")
        .find({ bookingId: b._id, status: "Succeeded" })
        .lean();
      const refunds = await this.db
        .model("Refund")
        .find({ bookingId: b._id, status: "Refunded" })
        .lean();
      const gross = payments.reduce((s: number, p: any) => s + p.amount, 0),
        refunded = refunds.reduce((s: number, r: any) => s + r.amount, 0);
      for (const provider of b.providerIds) {
        const key = String(provider);
        const p = await this.db.get("Provider", provider);
        rows[key] ||= {
          providerId: key,
          providerName: p.name,
          type: p.type,
          bookings: 0,
          grossPayments: 0,
          refunds: 0,
          netRevenue: 0,
          currency: b.currency,
        };
        const ratio =
          b.type === "hotel"
            ? 1
            : b.snapshot.segments
                .filter((s: any) => s.airlineId === key)
                .reduce((s: number, x: any) => s + x.total, 0) / b.amount;
        rows[key].bookings++;
        rows[key].grossPayments = money(
          rows[key].grossPayments + gross * ratio,
        );
        rows[key].refunds = money(rows[key].refunds + refunded * ratio);
        rows[key].netRevenue = money(
          rows[key].grossPayments - rows[key].refunds,
        );
      }
    }
    const p = pageNumber(q.page);
    const all = Object.values(rows);
    return {
      from: q.from,
      to: q.to,
      basis:
        "Bookings created in the inclusive UTC date range; current provider allocation and all settled associated payments/refunds",
      items: all.slice((p - 1) * 10, p * 10),
      page: p,
      pageSize: 10,
      total: all.length,
      pages: Math.ceil(all.length / 10),
    };
  }
}
@ApiTags("Administration")
@ApiCookieAuth()
@Roles("Admin")
@Controller("admin")
export class AdminController {
  constructor(readonly admin: AdminService) {}
  @Post("moderators")
  @ApiOperation({ summary: "ACC-13 Create provider-assigned moderator" })
  moderator(@Req() r: Request, @Body() d: ModeratorDto) {
    return this.admin.moderator(actorOf(r), d);
  }
  @Get("accounts")
  @ApiOperation({ summary: "ACC-14 Search/filter paginated accounts" })
  accounts(@Query() q: AccountQueryDto) {
    return this.admin.accounts(q);
  }
  @Get("providers")
  @ApiOperation({ summary: "ACC-13 ACC-15 List providers for assignment and status management" })
  providers(@Query() q: PageDto) {
    return paginated(this.admin.db.model("Provider"), {}, q.page, { name: 1, _id: 1 });
  }
  @Post("users/:id/reset-password")
  @ApiOperation({ summary: "ACC-07a Set a temporary password" })
  reset(
    @Req() r: Request,
    @Param("id") id: string,
    @Body() d: TemporaryPasswordDto,
  ) {
    return this.admin.reset(actorOf(r), id, d);
  }
  @Patch("accounts/:id/suspend")
  @ApiOperation({ summary: "ACC-15 ACC-16 Suspend user/moderator" })
  suspend(@Req() r: Request, @Param("id") id: string) {
    return this.admin.status(actorOf(r), id, true);
  }
  @Patch("accounts/:id/reactivate")
  @ApiOperation({ summary: "ACC-15 ACC-16 Reactivate suspended account" })
  reactivate(@Req() r: Request, @Param("id") id: string) {
    return this.admin.status(actorOf(r), id, false);
  }
  @Patch("providers/:type/:id/deactivate")
  @ApiOperation({
    summary: "ACC-15 Deactivate provider separately from its moderator",
  })
  providerOff(
    @Req() r: Request,
    @Param("type") t: string,
    @Param("id") id: string,
  ) {
    return this.admin.providerStatus(actorOf(r), t, id, false);
  }
  @Patch("providers/:type/:id/reactivate")
  @ApiOperation({ summary: "ACC-15 Reactivate provider" })
  providerOn(
    @Req() r: Request,
    @Param("type") t: string,
    @Param("id") id: string,
  ) {
    return this.admin.providerStatus(actorOf(r), t, id, true);
  }
  @Get("bookings")
  @ApiOperation({ summary: "ACC-17 Read-only booking list" })
  bookings(@Query() q: BookingQueryDto) {
    return this.admin.bookings(q);
  }
  @Get("reports")
  @ApiOperation({ summary: "GEN-10 List open reports" })
  reports(@Query() q: PageDto) {
    return paginated(this.admin.db.model("Report"), { status: "Open" }, q.page);
  }
  @Patch("reports/:id")
  @ApiOperation({ summary: "GEN-10 Dismiss report, hide or delete content" })
  resolve(
    @Req() r: Request,
    @Param("id") id: string,
    @Body() d: ResolveReportDto,
  ) {
    return this.admin.resolve(actorOf(r), id, d);
  }
  @Patch("content/:type/:id")
  @ApiOperation({ summary: "GEN-10 Hide or restore content directly" })
  hide(
    @Req() r: Request,
    @Param("type") t: string,
    @Param("id") id: string,
    @Body() d: HideContentDto,
  ) {
    return this.admin.db.transaction((s) =>
      this.admin.moderate(actorOf(r), t, id, d.hidden ? "hide" : "show", s),
    );
  }
  @Delete("content/:type/:id")
  @ApiOperation({ summary: "GEN-10 Delete content directly" })
  delete(
    @Req() r: Request,
    @Param("type") t: string,
    @Param("id") id: string,
    @Body() _d: ConfirmDto,
  ) {
    return this.admin.db.transaction((s) =>
      this.admin.moderate(actorOf(r), t, id, "delete", s),
    );
  }
  @Get("audit-logs")
  @ApiOperation({ summary: "GEN-07 Read administrative audit records" })
  audit(@Query() q: PageDto) {
    return paginated(this.admin.db.model("Audit"), {}, q.page);
  }
  @Get("analytics")
  @ApiOperation({
    summary: "BON-01 [Bonus] Provider booking and revenue analytics",
  })
  analytics(@Query() q: AnalyticsDto) {
    return this.admin.analytics(q);
  }
  @Post("exchange-rates/refresh")
  @ApiOperation({ summary: "ITN-18 Refresh rates manually for setup/recovery" })
  rates() {
    return this.admin.ops.refreshRates();
  }
}
