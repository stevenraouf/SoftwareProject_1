import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Injectable,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { Db, oid, same } from "../database.js";
import { Actor, paginated } from "../common.js";
import { FavouriteDto, PageDto } from "../dto.js";
import { actorOf, Public, Roles } from "../auth/auth.js";
import { ItinerariesService } from "../itineraries/itineraries.js";
import { Ops } from "../ops.js";

@Injectable()
export class SupportService {
  constructor(
    readonly db: Db,
    readonly itineraries: ItinerariesService,
    readonly ops: Ops,
  ) {}
  async favouriteVisible(actor: Actor, type: string, id: string) {
    if (type === "itinerary") {
      const i = await this.itineraries.access(actor, id);
      if (i.visibility !== "Public")
        throw new BadRequestException("Only public itineraries can be saved");
    } else {
      const h = await this.db.get("Provider", id);
      if (h.type !== "hotel" || !h.active)
        throw new NotFoundException("Hotel unavailable");
    }
  }
  async favourite(actor: Actor, dto: FavouriteDto) {
    await this.favouriteVisible(actor, dto.type, dto.resourceId);
    await this.db.model("Favourite").updateOne(
      {
        userId: oid(actor.id),
        type: dto.type,
        resourceId: oid(dto.resourceId),
      },
      {
        $setOnInsert: {
          userId: oid(actor.id),
          type: dto.type,
          resourceId: oid(dto.resourceId),
        },
      },
      { upsert: true },
    );
    return { message: "Saved to favourites" };
  }
  async favourites(actor: Actor, page: number) {
    const data = await paginated(
      this.db.model("Favourite"),
      { userId: oid(actor.id) },
      page,
    );
    const items = [];
    for (const f of data.items) {
      try {
        await this.favouriteVisible(actor, f.type, String(f.resourceId));
        items.push(f);
      } catch {
        items.push({ ...f, unavailable: true });
      }
    }
    return { ...data, items };
  }
}
@ApiTags("Reference data")
@Controller()
export class ReferenceController {
  constructor(readonly db: Db) {}
  @Get("airports")
  @Public()
  @ApiOperation({
    summary: "FLT-02 Read predefined airports (including IANA zones)",
  })
  airports(@Query() q: PageDto) {
    return paginated(this.db.model("Airport"), {}, q.page, { iata_code: 1 });
  }
  @Get("countries")
  @Public()
  @ApiOperation({ summary: "GEN-12 Read predefined countries" })
  countries(@Query() q: PageDto) {
    return paginated(this.db.model("Country"), {}, q.page, { name: 1 });
  }
  @Get("cities")
  @Public()
  @ApiOperation({ summary: "GEN-12 Read predefined cities" })
  cities(@Query() q: PageDto) {
    return paginated(this.db.model("City"), {}, q.page, { name: 1 });
  }
  @Get("attractions")
  @Public()
  @ApiOperation({ summary: "GEN-12 Read official attractions" })
  attractions(@Query() q: PageDto) {
    return paginated(this.db.model("Attraction"), {}, q.page, { name: 1 });
  }
  @Get("currencies")
  @Public()
  @ApiOperation({ summary: "GEN-12 Read supported currency codes" })
  currencies() {
    return this.db.model("Country").distinct("currency");
  }
  @Get("health")
  @Public()
  @ApiOperation({
    summary: "Read dependency configuration status without secrets",
  })
  health() {
    return {
      status: this.db.connection.readyState === 1 ? "ok" : "unavailable",
      database: this.db.connection.readyState === 1,
      stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
      webhookConfigured: !!process.env.STRIPE_WEBHOOK_SECRET,
      smtpConfigured: !!process.env.SMTP_HOST,
      emailBonusEnabled: process.env.ENABLE_EMAIL_BONUS === "true",
    };
  }
}
@ApiTags("Notifications and favourites")
@ApiCookieAuth()
@Controller()
export class SupportController {
  constructor(readonly support: SupportService) {}
  @Get("notifications")
  @ApiOperation({ summary: "GEN-01 Paginated notifications and unread count" })
  async notifications(@Req() r: Request, @Query() q: PageDto) {
    const userId = oid(actorOf(r).id);
    return {
      ...(await paginated(
        this.support.db.model("Notification"),
        { userId },
        q.page,
      )),
      unreadCount: await this.support.db
        .model("Notification")
        .countDocuments({ userId, readAt: { $exists: false } }),
    };
  }
  @Patch("notifications/:id/read")
  @ApiOperation({ summary: "GEN-01 Mark own notification as read" })
  async read(@Req() r: Request, @Param("id") id: string) {
    const n = await this.support.db.get("Notification", id);
    if (!same(n.userId, actorOf(r).id))
      throw new NotFoundException("Notification not found");
    n.readAt = new Date();
    return n.save();
  }
  @Post("favourites")
  @Roles("User")
  @ApiOperation({ summary: "BON-02 [Bonus] Save hotel or public itinerary" })
  favourite(@Req() r: Request, @Body() d: FavouriteDto) {
    return this.support.favourite(actorOf(r), d);
  }
  @Get("favourites")
  @Roles("User")
  @ApiOperation({ summary: "BON-02 [Bonus] List own favourites" })
  favourites(@Req() r: Request, @Query() q: PageDto) {
    return this.support.favourites(actorOf(r), q.page);
  }
  @Delete("favourites/:id")
  @Roles("User")
  @ApiOperation({ summary: "BON-02 [Bonus] Remove own favourite" })
  async remove(@Req() r: Request, @Param("id") id: string) {
    await this.support.db
      .model("Favourite")
      .deleteOne({ _id: oid(id), userId: oid(actorOf(r).id) });
    return { message: "Favourite removed" };
  }
  @Get("exchange-rates")
  @ApiOperation({
    summary: "ITN-18 Inspect cached exchange rates and rate date",
  })
  rates() {
    return this.support.ops.rates();
  }
}
