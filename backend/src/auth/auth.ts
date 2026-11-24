import {
  BadRequestException,
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  Injectable,
  Post,
  Body,
  Patch,
  Delete,
  Req,
  Res,
  SetMetadata,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
  ApiQuery,
  ApiProduces,
} from "@nestjs/swagger";
import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { promisify } from "node:util";
import { Db, oid } from "../database.js";
import { Actor, hash, token, definedFields } from "../common.js";
import {
  ChangePasswordDto,
  ConfirmDto,
  ForgotPasswordDto,
  LoginDto,
  ProfileDto,
  RegisterDto,
  ResetPasswordDto,
} from "../dto.js";
import { Ops } from "../ops.js";

const scrypt = promisify(scryptCallback);
export async function passwordHash(password: string) {
  const salt = randomBytes(16).toString("hex");
  const result = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt:${salt}:${result.toString("hex")}`;
}
export async function passwordMatches(password: string, encoded: string) {
  const [, salt, value] = encoded.split(":");
  if (!salt || !value) return false;
  const result = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(value, "hex");
  return expected.length === result.length && timingSafeEqual(expected, result);
}
export const Public = () => SetMetadata("public", true);
export const Roles = (...roles: string[]) => SetMetadata("roles", roles);
export const actorOf = (req: Request) => (req as any).actor as Actor;
export function accountEmailLink(
  action: "verify-email" | "reset-password",
  token: string,
  webOrigin = process.env.WEB_APP_ORIGIN,
  apiOrigin = process.env.APP_ORIGIN || "https://localhost:3443",
) {
  const path = webOrigin
    ? action === "verify-email" ? "/verify-email" : "/reset"
    : "/api/auth/" + action;
  const link = new URL(path, webOrigin || apiOrigin);
  link.searchParams.set("token", token);
  return link.toString();
}
export function safeUser(user: any) {
  return {
    id: String(user._id),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    providerId: user.providerId,
    phone: user.phone,
    preferredCurrency: user.preferredCurrency,
    forcePasswordChange: user.forcePasswordChange,
    emailVerified: user.emailVerified,
    registrationDate: user.createdAt,
  };
}
const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax" as const,
  path: "/",
};
@Injectable()
export class AuthService {
  constructor(
    readonly db: Db,
    readonly ops: Ops,
  ) {}
  async register(dto: RegisterDto) {
    const user = await this.db.model("User").create({
      name: dto.name.trim(),
      email: dto.email.toLowerCase().trim(),
      passwordHash: await passwordHash(dto.password),
      consentAt: new Date(),
    });
    if (process.env.ENABLE_EMAIL_BONUS === "true") {
      const raw = token();
      user.verificationHash = hash(raw);
      user.verificationExpires = new Date(Date.now() + 24 * 3600000);
      await user.save();
      await this.ops.enqueue(`verify:${user.id}`, "email", {
        to: user.email,
        subject: "Verify your email",
        text: accountEmailLink("verify-email", raw),
      });
    }
    return safeUser(user);
  }
  async login(dto: LoginDto, res: Response) {
    const user = await this.db
      .model("User")
      .findOne({ email: dto.email.toLowerCase().trim() });
    if (!user) {
      await passwordHash(dto.password);
      throw new UnauthorizedException("invalid email or password");
    }
    if (user.lockedUntil && user.lockedUntil > new Date())
      throw new UnauthorizedException(
        "Account locked for 15 minutes after repeated login failures",
      );
    if (!(await passwordMatches(dto.password, user.passwordHash))) {
      // Increment in MongoDB so simultaneous failures cannot lose updates.
      const updated = await this.db
        .model("User")
        .findOneAndUpdate(
          { _id: user._id },
          { $inc: { failedLogins: 1 } },
          { returnDocument: "after" },
        );
      if (updated.failedLogins >= 5)
        await this.db.model("User").updateOne(
          { _id: user._id },
          {
            $set: {
              lockedUntil: new Date(Date.now() + 15 * 60000),
              failedLogins: 0,
            },
          },
        );
      throw new UnauthorizedException(
        updated.failedLogins >= 5
          ? "Account locked for 15 minutes after repeated login failures"
          : "invalid email or password",
      );
    }
    if (user.status !== "Active")
      throw new UnauthorizedException(
        user.status === "Suspended"
          ? "account suspended"
          : "account deactivated",
      );
    await this.db
      .model("User")
      .updateOne(
        { _id: user._id },
        { $set: { failedLogins: 0 }, $unset: { lockedUntil: 1 } },
      );
    const refresh = token(),
      csrf = token();
    const session = await this.db.model("Session").create({
      userId: user._id,
      refreshHash: hash(refresh),
      csrfHash: hash(csrf),
      lastActiveAt: new Date(),
    });
    this.cookies(res, user, session.id, refresh, csrf);
    return {
      user: safeUser(user),
      home: {
        User: "/dashboard",
        Admin: "/admin",
        AirlineModerator: "/airline",
        HotelModerator: "/hotel",
      }[user.role as "User"],
      csrfToken: csrf,
    };
  }
  cookies(
    res: Response,
    user: any,
    sessionId: string,
    refresh: string,
    csrf: string,
  ) {
    res.cookie(
      "access_token",
      jwt.sign(
        { sub: String(user._id), sid: sessionId },
        process.env.JWT_SECRET!,
        { expiresIn: "15m", issuer: "travel-platform", audience: "travel-api" },
      ),
      { ...cookieOptions, maxAge: 15 * 60000 },
    );
    res.cookie("refresh_token", `${sessionId}.${refresh}`, cookieOptions);
    res.cookie("csrf_token", csrf, { ...cookieOptions, httpOnly: false });
  }
  async refresh(req: Request, res: Response) {
    const [sessionId, raw] = String(req.cookies?.refresh_token || "").split(
      ".",
    );
    if (!sessionId || !raw) throw new UnauthorizedException("Login required");
    const session = await this.db.model("Session").findOne({
      _id: oid(sessionId),
      refreshHash: hash(raw),
      revokedAt: { $exists: false },
      lastActiveAt: { $gt: new Date(Date.now() - 30 * 60000) },
    });
    if (
      !session ||
      !req.headers["x-csrf-token"] ||
      hash(String(req.headers["x-csrf-token"])) !== session.csrfHash
    )
      throw new UnauthorizedException("Session expired or invalid CSRF token");
    const user = await this.db.get("User", session.userId);
    if (user.status !== "Active")
      throw new UnauthorizedException("Account unavailable");
    const refresh = token(),
      csrf = token();
    const updated = await this.db.model("Session").findOneAndUpdate(
      {
        _id: session._id,
        refreshHash: hash(raw),
        revokedAt: { $exists: false },
      },
      {
        $set: {
          refreshHash: hash(refresh),
          csrfHash: hash(csrf),
          lastActiveAt: new Date(),
        },
      },
    );
    if (!updated)
      throw new UnauthorizedException("Refresh token already rotated");
    this.cookies(res, user, session.id, refresh, csrf);
    return { user: safeUser(user), csrfToken: csrf };
  }
  async changePassword(actor: Actor, dto: ChangePasswordDto, res: Response) {
    const user = await this.db.get("User", actor.id);
    if (!(await passwordMatches(dto.currentPassword, user.passwordHash)))
      throw new BadRequestException("Current password is incorrect");
    user.passwordHash = await passwordHash(dto.newPassword);
    user.forcePasswordChange = false;
    await user.save();
    await this.db
      .model("Session")
      .updateMany({ userId: user._id }, { $set: { revokedAt: new Date() } });
    this.clear(res);
    return { message: "Password changed. Log in again." };
  }
  clear(res: Response) {
    for (const name of ["access_token", "refresh_token", "csrf_token"])
      res.clearCookie(name, {
        ...cookieOptions,
        httpOnly: name !== "csrf_token",
      });
  }
  async logout(req: Request, res: Response) {
    // Refresh credentials are still usable for logout after the short access JWT expires.
    const [sid, raw] = String(req.cookies?.refresh_token || "").split(".");
    if (sid && raw)
      await this.db
        .model("Session")
        .updateOne(
          { _id: oid(sid), refreshHash: hash(raw) },
          { $set: { revokedAt: new Date() } },
        );
    this.clear(res);
    return { message: "Logged out" };
  }
  async profile(actor: Actor, dto: ProfileDto) {
    if (dto.preferredCurrency) await this.ops.currency(dto.preferredCurrency);
    const user = await this.db.get("User", actor.id);
    Object.assign(user, definedFields(dto));
    await user.save();
    return safeUser(user);
  }
  async deactivate(actor: Actor, res: Response) {
    if (actor.role !== "User")
      throw new ForbiddenException(
        "Only registered travelers can deactivate their own account",
      );
    await this.db.transaction(async (session) => {
      // Write user document also used by booking creation to serialize deactivation against holds.
      await this.db
        .model("User")
        .updateOne(
          { _id: oid(actor.id) },
          { $set: { status: "Deactivated" } },
          { session },
        );
      if (
        await this.db
          .model("Booking")
          .exists({
            userId: oid(actor.id),
            status: "Confirmed",
            startsAt: { $gt: new Date() },
          })
          .session(session)
      )
        throw new BadRequestException(
          "Upcoming Confirmed bookings prevent deactivation",
        );
      await this.db
        .model("Session")
        .updateMany(
          { userId: oid(actor.id) },
          { $set: { revokedAt: new Date() } },
          { session },
        );
    });
    this.clear(res);
    return { message: "Account deactivated" };
  }
  async forgot(dto: ForgotPasswordDto) {
    if (process.env.ENABLE_EMAIL_BONUS !== "true")
      throw new BadRequestException("Email bonus is disabled");
    const user = await this.db
      .model("User")
      .findOne({ email: dto.email.toLowerCase() });
    if (user?.status === "Active") {
      const raw = token();
      user.resetHash = hash(raw);
      user.resetExpires = new Date(Date.now() + 30 * 60000);
      await user.save();
      await this.ops.enqueue(`reset:${hash(raw)}`, "email", {
        to: user.email,
        subject: "Reset your password",
        text: `Reset your password using this single-use link within 30 minutes: ${accountEmailLink("reset-password", raw)}`,
      });
    }
    return {
      message: "If the account is eligible, a reset email will be sent.",
    };
  }
  async resetForm(raw: string, res: Response) {
    if (process.env.ENABLE_EMAIL_BONUS !== "true")
      throw new BadRequestException("Email bonus is disabled");
    if (
      !/^[a-f0-9]{64}$/.test(raw || "") ||
      !(await this.db
        .model("User")
        .exists({
          resetHash: hash(raw),
          resetExpires: { $gt: new Date() },
          status: "Active",
        }))
    )
      throw new BadRequestException("Reset link is invalid or expired");
    res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    return res
      .type("html")
      .send(
        `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Reset your password</title></head><body><main><h1>Reset your password</h1><p>Choose a password of 8 to 128 characters containing a letter and a number.</p><form method="post" action="/api/auth/reset-password"><input type="hidden" name="token" value="${raw}"><label for="new-password">New password</label> <input id="new-password" name="newPassword" type="password" autocomplete="new-password" minlength="8" maxlength="128" required> <button type="submit">Reset password</button></form></main></body></html>`,
      );
  }
  async reset(dto: ResetPasswordDto) {
    if (process.env.ENABLE_EMAIL_BONUS !== "true")
      throw new BadRequestException("Email bonus is disabled");
    const user = await this.db.model("User").findOneAndUpdate(
      {
        resetHash: hash(dto.token),
        resetExpires: { $gt: new Date() },
        status: "Active",
      },
      {
        $set: {
          passwordHash: await passwordHash(dto.newPassword),
          forcePasswordChange: false,
          failedLogins: 0,
        },
        $unset: { resetHash: 1, resetExpires: 1, lockedUntil: 1 },
      },
      { returnDocument: "after" },
    );
    if (!user)
      throw new BadRequestException("Reset token is invalid or expired");
    await this.db
      .model("Session")
      .updateMany({ userId: user._id }, { $set: { revokedAt: new Date() } });
    return { message: "Password reset; log in again" };
  }
  async verify(raw: string) {
    if (process.env.ENABLE_EMAIL_BONUS !== "true")
      throw new BadRequestException("Email bonus is disabled");
    if (!/^[a-f0-9]{64}$/.test(raw || ""))
      throw new BadRequestException("Invalid verification token");
    const user = await this.db.model("User").findOneAndUpdate(
      {
        verificationHash: hash(raw),
        verificationExpires: { $gt: new Date() },
      },
      {
        $set: { emailVerified: true },
        $unset: { verificationHash: 1, verificationExpires: 1 },
      },
    );
    if (!user)
      throw new BadRequestException("Verification token is invalid or expired");
    return { message: "Email verified" };
  }
}
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    readonly reflector: Reflector,
    readonly db: Db,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest<Request>();
    const isPublic = this.reflector.getAllAndOverride<boolean>("public", [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    let payload: any;
    try {
      payload = jwt.verify(req.cookies?.access_token, process.env.JWT_SECRET!, {
        issuer: "travel-platform",
        audience: "travel-api",
        algorithms: ["HS256"],
      });
    } catch {
      if (isPublic) return true;
      throw new UnauthorizedException(
        "Login required or access token expired; use /auth/refresh",
      );
    }
    const session = await this.db.model("Session").findOne({
      _id: oid(payload.sid),
      userId: oid(payload.sub),
      revokedAt: { $exists: false },
      lastActiveAt: { $gt: new Date(Date.now() - 30 * 60000) },
    });
    const user = session && (await this.db.model("User").findById(payload.sub));
    if (!session || !user || user.status !== "Active") {
      if (isPublic) return true;
      throw new UnauthorizedException("Session expired or account unavailable");
    }
    if (
      !isPublic &&
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      hash(String(req.headers["x-csrf-token"] || "")) !== session.csrfHash
    )
      throw new ForbiddenException("Missing or invalid X-CSRF-Token");
    const permittedDuringReset = [
      "/auth/me",
      "/auth/change-password",
      "/auth/logout",
    ];
    if (
      !isPublic &&
      user.forcePasswordChange &&
      !permittedDuringReset.some((p) => req.path.endsWith(p))
    )
      throw new ForbiddenException("Password change required");
    const roles = this.reflector.getAllAndOverride<string[]>("roles", [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (roles && !roles.includes(user.role))
      throw new ForbiddenException("Role is not permitted");
    (req as any).actor = {
      id: user.id,
      role: user.role,
      providerId: user.providerId?.toString(),
      sessionId: session.id,
      forcePasswordChange: user.forcePasswordChange,
      emailVerified: user.emailVerified,
    } satisfies Actor;
    await this.db
      .model("Session")
      .updateOne(
        { _id: session._id, revokedAt: { $exists: false } },
        { $set: { lastActiveAt: new Date() } },
      );
    return true;
  }
}
@ApiTags("Authentication")
@ApiCookieAuth()
@Controller("auth")
export class AuthController {
  constructor(readonly auth: AuthService) {}
  @Public()
  @Post("register")
  @ApiOperation({
    summary: "ACC-01 Register a traveler (no admin self-registration)",
  })
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }
  @Public()
  @Post("login")
  @ApiOperation({
    summary: "ACC-04 ACC-05 Login and set secure session cookies",
  })
  login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.auth.login(dto, res);
  }
  @Public()
  @Post("refresh")
  @ApiOperation({
    summary: "ACC-06 ACC-19 Rotate refresh credentials; requires X-CSRF-Token",
  })
  refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.refresh(req, res);
  }
  @Public()
  @Post("logout")
  @ApiOperation({
    summary: "ACC-06 Revoke refresh credentials and clear cookies",
  })
  logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.auth.logout(req, res);
  }
  @Get("me")
  @ApiOperation({ summary: "ACC-04 ACC-19 Get the signed-in account" })
  async me(@Req() req: Request) {
    return safeUser(await this.auth.db.get("User", actorOf(req).id));
  }
  @Patch("change-password")
  @ApiOperation({ summary: "ACC-08 Change password and revoke sessions" })
  password(
    @Req() req: Request,
    @Body() dto: ChangePasswordDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.changePassword(actorOf(req), dto, res);
  }
  @Public()
  @Post("forgot-password")
  @ApiOperation({ summary: "ACC-07 [Bonus] Request a reset email" })
  forgot(@Body() dto: ForgotPasswordDto) {
    return this.auth.forgot(dto);
  }
  @Public()
  @Get("reset-password")
  @ApiOperation({
    summary: "ACC-07 [Bonus] Open the single-use password reset form",
  })
  @ApiProduces("text/html")
  @ApiQuery({ name: "token", required: true, type: String })
  resetForm(@Req() req: Request, @Res() res: Response) {
    return this.auth.resetForm(String(req.query.token || ""), res);
  }
  @Public()
  @Post("reset-password")
  @ApiOperation({ summary: "ACC-07 [Bonus] Consume a single-use reset token" })
  reset(@Body() dto: ResetPasswordDto) {
    return this.auth.reset(dto);
  }
  @Public()
  @Get("verify-email")
  @ApiQuery({ name: "token", required: true, type: String })
  @ApiOperation({
    summary: "ACC-02 [Bonus] Verify email using a single-use link",
  })
  verify(@Req() req: Request) {
    return this.auth.verify(String(req.query.token || ""));
  }
}
@ApiTags("Accounts")
@ApiCookieAuth()
@Controller("users")
export class UsersController {
  constructor(readonly auth: AuthService) {}
  @Get("me") @ApiOperation({ summary: "ACC-11 View own profile" }) async me(
    @Req() req: Request,
  ) {
    return safeUser(await this.auth.db.get("User", actorOf(req).id));
  }
  @Patch("me") @ApiOperation({ summary: "ACC-09 Edit profile" }) profile(
    @Req() req: Request,
    @Body() dto: ProfileDto,
  ) {
    return this.auth.profile(actorOf(req), dto);
  }
  @Delete("me")
  @ApiOperation({
    summary:
      "ACC-12 Deactivate account unless upcoming Confirmed bookings exist",
  })
  deactivate(
    @Req() req: Request,
    @Body() _dto: ConfirmDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    return this.auth.deactivate(actorOf(req), res);
  }
}
