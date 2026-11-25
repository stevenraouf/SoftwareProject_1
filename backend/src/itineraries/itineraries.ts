import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  NotFoundException,
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
import {
  Actor,
  dateOnly,
  escapeRegex,
  money,
  pageNumber,
  paginated,
  definedFields,
} from "../common.js";
import {
  ActivityDto,
  BookingLinkDto,
  BudgetDto,
  ConfirmDto,
  DayDto,
  ItineraryDto,
  ItineraryFlightQueryDto,
  ItineraryHotelQueryDto,
  PageDto,
  PatchActivityDto,
  PatchBudgetDto,
  PatchDayDto,
  PatchItineraryDto,
  PatchTransportDto,
  PublicItineraryQueryDto,
  ReorderDto,
  TransportDto,
} from "../dto.js";
import { actorOf, Public, Roles } from "../auth/auth.js";
import { Ops } from "../ops.js";
import { HotelsService } from "../hotels/hotels.js";
import { FlightsService } from "../flights/flights.js";

@Injectable()
export class ItinerariesService {
  constructor(
    readonly db: Db,
    readonly ops: Ops,
    readonly hotels: HotelsService,
    readonly flights: FlightsService,
  ) {}
  async own(actor: Actor, id: any, session?: any) {
    const doc = await this.db.get("Itinerary", id, session);
    if (!same(doc.userId, actor.id))
      throw new ForbiddenException("Itinerary belongs to another user");
    return doc;
  }
  async access(actor: Actor | undefined, id: string) {
    const doc = await this.db.get("Itinerary", id);
    const owner = await this.db.get("User", doc.userId);
    if (actor && same(doc.userId, actor.id)) return doc;
    if (
      doc.visibility !== "Public" ||
      owner.status === "Deactivated" ||
      (doc.hidden && actor?.role !== "Admin")
    )
      throw new NotFoundException("Itinerary not found");
    return doc;
  }
  async create(actor: Actor, dto: ItineraryDto) {
    await this.ops.countries(dto.countries);
    dateOnly(dto.startDate);
    return this.db.model("Itinerary").create({ ...dto, userId: oid(actor.id) });
  }
  async mutate(actor: Actor, id: any, fn: (doc: any) => Promise<void> | void) {
    return this.db.transaction(async (session) => {
      const doc = await this.own(actor, id, session);
      await fn(doc);
      await doc.save({ session });
      return this.view(doc);
    });
  }
  async patch(actor: Actor, id: string, dto: PatchItineraryDto) {
    if (dto.countries) await this.ops.countries(dto.countries);
    if (dto.startDate) dateOnly(dto.startDate);
    return this.mutate(actor, id, (doc) => {
      Object.assign(doc, definedFields(dto));
    });
  }
  async remove(actor: Actor, id: string) {
    const doc = await this.own(actor, id);
    await doc.deleteOne();
    return { message: "Itinerary deleted; independent clones are unaffected" };
  }
  view(doc: any) {
    const data = doc.toObject ? doc.toObject() : doc;
    const groups: any[] = [];
    const days = data.days.map((day: any, i: number) => {
      const date = DateTime.fromISO(data.startDate, { zone: "UTC" })
        .plus({ days: i })
        .toISODate();
      if (groups.at(-1)?.city === day.city) {
        groups.at(-1).dayCount++;
        groups.at(-1).lastDate = date;
        groups.at(-1).dayIds.push(String(day._id));
      } else
        groups.push({
          city: day.city,
          dayCount: 1,
          firstDate: date,
          lastDate: date,
          firstDayId: day._id,
          dayIds: [String(day._id)],
        });
      return { ...day, number: i + 1, date };
    });
    return { ...data, days, cityGroups: groups };
  }
  async detail(actor: Actor | undefined, id: string) {
    const doc = await this.access(actor, id);
    const view = this.view(doc);
    const owner = await this.db.get("User", doc.userId);
    view.author = { id: owner.id, name: owner.name };
    if (doc.originalAuthorId) {
      const original = await this.db
        .model("User")
        .findById(doc.originalAuthorId)
        .lean();
      view.originalAuthor = {
        id: original?.status === "Deactivated" ? null : doc.originalAuthorId,
        name:
          original?.status === "Deactivated"
            ? "Deleted user"
            : original?.name || "Original author",
      };
    }
    if (!actor || !same(doc.userId, actor.id)) delete view.bookingLinks;
    try {
      const budget = await this.summary(actor, id);
      return { ...view, budget };
    } catch (e: any) {
      if (e.getStatus?.() !== 503) throw e;
      return { ...view, budget: { available: false, message: e.message } };
    }
  }
  list(actor: Actor, page: number) {
    return paginated(
      this.db.model("Itinerary"),
      { userId: oid(actor.id) },
      page,
      { updatedAt: -1 },
    );
  }
  async day(actor: Actor, id: string, dto: DayDto) {
    await this.ops.city(dto.city);
    return this.mutate(actor, id, (doc) => {
      if (doc.days.length >= 60)
        throw new BadRequestException("An itinerary has at most 60 days");
      doc.days.push(dto);
    });
  }
  async patchDay(actor: Actor, id: string, dayId: string, dto: PatchDayDto) {
    if (dto.city) await this.ops.city(dto.city);
    return this.mutate(actor, id, (doc) => {
      const day = doc.days.id(oid(dayId));
      if (!day) throw new NotFoundException("Day not found");
      Object.assign(day, definedFields(dto));
    });
  }
  async deleteDay(actor: Actor, id: string, dayId: string) {
    return this.mutate(actor, id, (doc) => {
      const day = doc.days.id(oid(dayId));
      if (!day) throw new NotFoundException("Day not found");
      day.deleteOne();
      doc.transportCosts = doc.transportCosts.filter(
        (t: any) => !same(t.dayId, dayId),
      );
      doc.bookingLinks = doc.bookingLinks.filter(
        (l: any) => !same(l.dayId, dayId),
      );
    });
  }
  reorder(actor: Actor, id: string, dto: ReorderDto) {
    return this.mutate(actor, id, (doc) => {
      if (
        dto.dayIds.length !== doc.days.length ||
        dto.dayIds.some((id) => !doc.days.id(oid(id)))
      )
        throw new BadRequestException("Include every day exactly once");
      doc.days = dto.dayIds.map((id) => doc.days.id(oid(id)));
    });
  }
  async activity(actor: Actor, id: string, dayId: string, dto: ActivityDto) {
    if (dto.currency) await this.ops.currency(dto.currency);
    return this.mutate(actor, id, (doc) => {
      const day = doc.days.id(oid(dayId));
      if (!day) throw new NotFoundException("Day not found");
      day.activities.push(dto);
    });
  }
  async findChild(
    actor: Actor,
    kind: "activities" | "budgets" | "transportCosts",
    id: string,
  ) {
    const path =
      kind === "transportCosts" ? "transportCosts._id" : `days.${kind}._id`;
    const doc = await this.db.model("Itinerary").findOne({ [path]: oid(id) });
    if (!doc) throw new NotFoundException("Item not found");
    if (!same(doc.userId, actor.id))
      throw new ForbiddenException("Item belongs to another user");
    return doc;
  }
  async editChild(
    actor: Actor,
    kind: "activities" | "budgets" | "transportCosts",
    id: string,
    dto?: any,
  ) {
    const doc = await this.findChild(actor, kind, id);
    if (dto?.currency) await this.ops.currency(dto.currency);
    if (dto?.fromCity) await this.ops.city(dto.fromCity);
    if (dto?.toCity) await this.ops.city(dto.toCity);
    return this.mutate(actor, doc._id, (fresh) => {
      const child =
        kind === "transportCosts"
          ? fresh.transportCosts.id(oid(id))
          : fresh.days
              .flatMap((d: any) => d[kind])
              .find((c: any) => same(c._id, id));
      if (!child) throw new NotFoundException("Item not found");
      if (!dto) {
        if (kind === "transportCosts") fresh.transportCosts.pull(oid(id));
        else {
          const day = fresh.days.find((d: any) =>
            d[kind].some((c: any) => same(c._id, id)),
          );
          day[kind].pull(oid(id));
        }
      } else {
        if (dto.dayId && !fresh.days.id(oid(dto.dayId)))
          throw new BadRequestException(
            "Transport day must belong to this itinerary",
          );
        Object.assign(child, definedFields(dto));
      }
    });
  }
  async budget(actor: Actor, id: string, dayId: string, dto: BudgetDto) {
    await this.ops.currency(dto.currency);
    return this.mutate(actor, id, (doc) => {
      const day = doc.days.id(oid(dayId));
      if (!day) throw new NotFoundException("Day not found");
      day.budgets.push(dto);
    });
  }
  async transport(actor: Actor, id: string, dto: TransportDto) {
    await Promise.all([
      this.ops.city(dto.fromCity),
      this.ops.city(dto.toCity),
      this.ops.currency(dto.currency),
    ]);
    return this.mutate(actor, id, (doc) => {
      if (!doc.days.id(oid(dto.dayId)))
        throw new BadRequestException(
          "Transport day must belong to this itinerary",
        );
      doc.transportCosts.push(dto);
    });
  }
  async summary(actor: Actor | undefined, id: string) {
    const doc = await this.access(actor, id);
    const preferred = actor
      ? (await this.db.get("User", actor.id)).preferredCurrency
      : process.env.PLATFORM_CURRENCY || "USD";
    const entries: {
      dayId: string;
      category: string;
      amount: number;
      currency: string;
    }[] = [];
    for (const d of doc.days) {
      for (const b of d.budgets)
        entries.push({
          dayId: String(d._id),
          category: b.category,
          amount: b.amount,
          currency: b.currency,
        });
      for (const a of d.activities)
        entries.push({
          dayId: String(d._id),
          category: "Activities",
          amount: a.cost,
          currency: a.currency,
        });
    }
    for (const t of doc.transportCosts)
      entries.push({
        dayId: String(t.dayId),
        category: "IntercityTransport",
        amount: t.amount,
        currency: t.currency,
      });
    // Booking links are private-owner-only; public responses expose costs, never private references.
    for (const link of doc.bookingLinks) {
      const b = await this.db
        .model("Booking")
        .findOne({
          _id: link.bookingId,
          userId: doc.userId,
          status: { $in: ["Confirmed", "Completed"] },
        })
        .lean();
      if (b)
        entries.push({
          dayId: String(link.dayId),
          category: b.type === "hotel" ? "Accommodation" : "IntercityTransport",
          amount: b.amount,
          currency: b.currency,
        });
    }
    const rates = entries.some(
      (e) => e.currency !== preferred && e.amount !== 0,
    )
      ? await this.ops.rates()
      : null;
    const convert = (e: any) =>
      e.currency === preferred || e.amount === 0
        ? e.amount
        : money((e.amount / rates.rates[e.currency]) * rates.rates[preferred]);
    const categories: Record<string, number> = {
      Food: 0,
      Accommodation: 0,
      InCityTransport: 0,
      Activities: 0,
      IntercityTransport: 0,
    };
    const byDay: Record<string, number> = {};
    for (const e of entries) {
      const amount = convert(e);
      if (!Number.isFinite(amount))
        throw new BadRequestException(
          "A required exchange rate is unavailable",
        );
      categories[e.category] = money(categories[e.category] + amount);
      byDay[e.dayId] = money((byDay[e.dayId] || 0) + amount);
    }
    const view = this.view(doc);
    return {
      available: true,
      currency: preferred,
      rateDate: rates?.date ?? null,
      rateFetchedAt: rates?.fetchedAt ?? null,
      categories,
      total: money(Object.values(categories).reduce((a, b) => a + b, 0)),
      days: view.days.map((d: any) => ({
        dayId: d._id,
        number: d.number,
        date: d.date,
        total: byDay[String(d._id)] || 0,
      })),
      cityGroups: view.cityGroups.map((g: any) => ({
        ...g,
        subtotal: money(
          g.dayIds.reduce(
            (sum: number, id: string) => sum + (byDay[id] || 0),
            0,
          ),
        ),
      })),
    };
  }
  async publicSearch(q: PublicItineraryQueryDto) {
    if (
      q.minDays !== undefined &&
      q.maxDays !== undefined &&
      q.minDays > q.maxDays
    )
      throw new BadRequestException("minDays exceeds maxDays");
    const authors = await this.db
      .model("User")
      .find({ status: { $ne: "Deactivated" } })
      .select("_id")
      .lean();
    const filter: any = {
      visibility: "Public",
      hidden: false,
      userId: { $in: authors.map((a: any) => a._id) },
    };
    if (q.country) filter.countries = q.country;
    if (q.city) filter["days.city"] = q.city;
    if (q.q) {
      const regex = new RegExp(escapeRegex(q.q), "i");
      const countries = await this.db
        .model("Country")
        .find({ name: regex })
        .lean();
      const cities = await this.db.model("City").find({ name: regex }).lean();
      filter.$or = [
        { title: regex },
        { countries: regex },
        { countries: { $in: countries.map((c: any) => c.code) } },
        { "days.city": regex },
        { "days.city": { $in: cities.map((c: any) => c.city_id) } },
      ];
    }
    const docs = (
      await this.db
        .model("Itinerary")
        .find(filter)
        .sort({ updatedAt: -1 })
        .lean()
    ).filter(
      (d: any) =>
        (q.minDays === undefined || d.days.length >= q.minDays) &&
        (q.maxDays === undefined || d.days.length <= q.maxDays),
    );
    const p = pageNumber(q.page);
    return {
      items: docs.slice((p - 1) * 10, p * 10).map((d: any) => ({
        id: d._id,
        title: d.title,
        countries: d.countries,
        startDate: d.startDate,
        days: d.days.length,
        authorId: d.userId,
      })),
      page: p,
      pageSize: 10,
      total: docs.length,
      pages: Math.ceil(docs.length / 10),
    };
  }
  async clone(actor: Actor, id: string) {
    const source = await this.access(actor, id);
    if (source.visibility !== "Public")
      throw new BadRequestException("Only public itineraries can be cloned");
    const data = source.toObject();
    const dayMap = new Map<string, Types.ObjectId>();
    const days = data.days.map((d: any) => {
      const newId = new Types.ObjectId();
      dayMap.set(String(d._id), newId);
      return {
        ...d,
        _id: newId,
        activities: d.activities.map((a: any) => ({
          ...a,
          _id: new Types.ObjectId(),
          imageIds: [],
        })),
        budgets: d.budgets.map((b: any) => ({
          ...b,
          _id: new Types.ObjectId(),
        })),
      };
    });
    const clone = await this.db.model("Itinerary").create({
      title: data.title,
      countries: data.countries,
      startDate: data.startDate,
      days,
      userId: oid(actor.id),
      visibility: "Private",
      originalAuthorId: data.userId,
      sourceItineraryId: source._id,
      transportCosts: data.transportCosts.map((t: any) => ({
        ...t,
        _id: new Types.ObjectId(),
        dayId: dayMap.get(String(t.dayId)),
      })),
      bookingLinks: [],
    });
    // Copy media records and files so removing the original cannot invalidate the clone.
    for (let di = 0; di < data.days.length; di++)
      for (let ai = 0; ai < data.days[di].activities.length; ai++) {
        for (const mediaId of data.days[di].activities[ai].imageIds) {
          const media = await this.db.model("Media").findById(mediaId).lean();
          if (!media) continue;
          const copy = await this.db.model("Media").create({
            userId: oid(actor.id),
            resourceType: "activity",
            resourceId: clone.days[di].activities[ai]._id,
            filename: media.filename,
            mime: media.mime,
            size: media.size,
          });
          clone.days[di].activities[ai].imageIds.push(copy._id);
        }
      }
    await clone.save();
    // Snapshot linked costs without copying private booking references into another user's account.
    for (const link of data.bookingLinks || []) {
      const b = await this.db
        .model("Booking")
        .findOne({
          _id: link.bookingId,
          userId: source.userId,
          status: { $in: ["Confirmed", "Completed"] },
        })
        .lean();
      const day = clone.days.id(dayMap.get(String(link.dayId)));
      if (!b || !day) continue;
      if (b.type === "hotel")
        day.budgets.push({
          category: "Accommodation",
          amount: b.amount,
          currency: b.currency,
        });
      else {
        const airports = await this.db
          .model("Airport")
          .find({
            iata_code: {
              $in: [
                b.snapshot.segments[0].departureAirport,
                b.snapshot.segments[0].arrivalAirport,
              ],
            },
          })
          .lean();
        clone.transportCosts.push({
          mode: "Flight budget copied from public itinerary",
          fromCity:
            airports.find(
              (a: any) =>
                a.iata_code === b.snapshot.segments[0].departureAirport,
            )?.city_id || day.city,
          toCity:
            airports.find(
              (a: any) => a.iata_code === b.snapshot.segments[0].arrivalAirport,
            )?.city_id || day.city,
          amount: b.amount,
          currency: b.currency,
          dayId: day._id,
        });
      }
    }
    await clone.save();
    return this.view(clone);
  }
  async hotelsFor(actor: Actor, id: string, q: ItineraryHotelQueryDto) {
    const doc = await this.own(actor, id);
    const view = this.view(doc);
    const group = view.cityGroups.find((g: any) =>
      same(g.firstDayId, q.firstDayId),
    );
    if (!group)
      throw new BadRequestException("Choose the first day of a city group");
    return this.hotels.search({
      destination: group.city,
      checkIn: group.firstDate,
      checkOut: DateTime.fromISO(group.lastDate).plus({ days: 1 }).toISODate()!,
      guests: q.guests,
      rooms: q.rooms,
      page: q.page,
      sort: "price",
    });
  }
  async flightsFor(actor: Actor, id: string, q: ItineraryFlightQueryDto) {
    const doc = await this.own(actor, id);
    if (!doc.days.length)
      throw new BadRequestException("Add an itinerary day first");
    const airports = await this.db
      .model("Airport")
      .find({ city_id: doc.days[0].city, iata_code: { $ne: q.origin } })
      .lean();
    const results = [];
    for (const a of airports)
      results.push({
        airport: a.iata_code,
        results: await this.flights.search({
          departureAirport: q.origin,
          arrivalAirport: a.iata_code,
          departureDate: q.departureDate || doc.startDate,
          returnDate:
            q.returnDate ||
            (q.tripType === "round-trip"
              ? DateTime.fromISO(doc.startDate)
                  .plus({ days: doc.days.length - 1 })
                  .toISODate()!
              : undefined),
          adults: q.adults,
          children: q.children,
          infants: q.infants,
          page: q.page,
          sort: "price",
        }),
      });
    return results;
  }
  async link(actor: Actor, id: string, dto: BookingLinkDto) {
    const b = await this.db.get("Booking", dto.bookingId);
    if (
      !same(b.userId, actor.id) ||
      !["Confirmed", "Completed"].includes(b.status)
    )
      throw new BadRequestException(
        "Link your own Confirmed or Completed booking",
      );
    return this.mutate(actor, id, (doc) => {
      if (!doc.days.id(oid(dto.dayId)))
        throw new BadRequestException("Day does not belong to itinerary");
      if (doc.bookingLinks.some((l: any) => same(l.bookingId, dto.bookingId)))
        throw new BadRequestException("Booking is already linked");
      doc.bookingLinks.push(dto);
    });
  }
  async pdf(actor: Actor, id: string, res: Response) {
    const doc = await this.own(actor, id);
    const view = this.view(doc);
    const budget = await this.summary(actor, id);
    res.type("application/pdf").attachment("itinerary.pdf");
    const pdf = new PDFDocument({ margin: 50 });
    pdf.pipe(res);
    pdf.fontSize(22).text(doc.title).moveDown();
    pdf
      .fontSize(11)
      .text(`Starts ${doc.startDate} - ${doc.countries.join(", ")}`)
      .text(`Total budget: ${budget.total} ${budget.currency}`)
      .moveDown();
    for (const d of view.days) {
      pdf.fontSize(15).text(`Day ${d.number}: ${d.city} (${d.date})`);
      pdf.fontSize(11).text(d.notes || "");
      for (const a of d.activities)
        pdf
          .text(`${a.time || ""} ${a.name} - ${a.cost} ${a.currency}`)
          .text(a.description || "");
      pdf.moveDown();
    }
    pdf.end();
  }
}
@ApiTags("Itineraries")
@ApiCookieAuth()
@Controller("itineraries")
export class ItinerariesController {
  constructor(readonly itineraries: ItinerariesService) {}
  @Get("public/search")
  @Public()
  @ApiOperation({ summary: "ITN-20 ITN-21 Search public itineraries" })
  search(@Query() q: PublicItineraryQueryDto) {
    return this.itineraries.publicSearch(q);
  }
  @Get("public/:id")
  @Public()
  @ApiOperation({ summary: "ITN-21 Read public itinerary and budget" })
  public(@Req() r: Request, @Param("id") id: string) {
    return this.itineraries.detail(actorOf(r), id);
  }
  @Post()
  @Roles("User")
  @ApiOperation({ summary: "ITN-01 Create a private itinerary" })
  create(@Req() r: Request, @Body() d: ItineraryDto) {
    return this.itineraries.create(actorOf(r), d);
  }
  @Get()
  @Roles("User")
  @ApiOperation({ summary: "ITN-03 List own itineraries" })
  list(@Req() r: Request, @Query() q: PageDto) {
    return this.itineraries.list(actorOf(r), q.page);
  }
  @Get(":id")
  @ApiOperation({
    summary: "ITN-03 View itinerary with ownership/public access enforcement",
  })
  get(@Req() r: Request, @Param("id") id: string) {
    return this.itineraries.detail(actorOf(r), id);
  }
  @Patch(":id")
  @Roles("User")
  @ApiOperation({ summary: "ITN-01 ITN-20 Edit itinerary or visibility" })
  patch(
    @Req() r: Request,
    @Param("id") id: string,
    @Body() d: PatchItineraryDto,
  ) {
    return this.itineraries.patch(actorOf(r), id, d);
  }
  @Delete(":id")
  @Roles("User")
  @ApiOperation({ summary: "ITN-01 Delete itinerary after confirmation" })
  delete(@Req() r: Request, @Param("id") id: string, @Body() _d: ConfirmDto) {
    return this.itineraries.remove(actorOf(r), id);
  }
  @Post(":id/days")
  @Roles("User")
  @ApiOperation({ summary: "ITN-05 Add day with predefined city" })
  day(@Req() r: Request, @Param("id") id: string, @Body() d: DayDto) {
    return this.itineraries.day(actorOf(r), id, d);
  }
  @Patch(":id/days/reorder")
  @Roles("User")
  @ApiOperation({ summary: "ITN-08 Reorder every day exactly once" })
  reorder(@Req() r: Request, @Param("id") id: string, @Body() d: ReorderDto) {
    return this.itineraries.reorder(actorOf(r), id, d);
  }
  @Patch(":id/days/:dayId")
  @Roles("User")
  @ApiOperation({ summary: "ITN-05 Edit city or notes" })
  patchDay(
    @Req() r: Request,
    @Param("id") id: string,
    @Param("dayId") day: string,
    @Body() d: PatchDayDto,
  ) {
    return this.itineraries.patchDay(actorOf(r), id, day, d);
  }
  @Delete(":id/days/:dayId")
  @Roles("User")
  @ApiOperation({
    summary: "ITN-07 Delete day and recalculate numbering and totals",
  })
  deleteDay(
    @Req() r: Request,
    @Param("id") id: string,
    @Param("dayId") day: string,
    @Body() _d: ConfirmDto,
  ) {
    return this.itineraries.deleteDay(actorOf(r), id, day);
  }
  @Post(":id/days/:dayId/activities")
  @Roles("User")
  @ApiOperation({ summary: "ITN-10 Add activity" })
  activity(
    @Req() r: Request,
    @Param("id") id: string,
    @Param("dayId") day: string,
    @Body() d: ActivityDto,
  ) {
    return this.itineraries.activity(actorOf(r), id, day, d);
  }
  @Post(":id/days/:dayId/budgets")
  @Roles("User")
  @ApiOperation({ summary: "ITN-14 Add budget entry" })
  budget(
    @Req() r: Request,
    @Param("id") id: string,
    @Param("dayId") day: string,
    @Body() d: BudgetDto,
  ) {
    return this.itineraries.budget(actorOf(r), id, day, d);
  }
  @Post(":id/transport-costs")
  @Roles("User")
  @ApiOperation({ summary: "ITN-16 Add intercity transport entry" })
  transport(
    @Req() r: Request,
    @Param("id") id: string,
    @Body() d: TransportDto,
  ) {
    return this.itineraries.transport(actorOf(r), id, d);
  }
  @Get(":id/budget-summary")
  @ApiOperation({
    summary:
      "ITN-09 ITN-14 ITN-18 Compute category/day/group totals in display currency",
  })
  summary(@Req() r: Request, @Param("id") id: string) {
    return this.itineraries.summary(actorOf(r), id);
  }
  @Post(":id/clone")
  @Roles("User")
  @ApiOperation({
    summary: "ITN-21 Clone public itinerary into an independent private copy",
  })
  clone(@Req() r: Request, @Param("id") id: string) {
    return this.itineraries.clone(actorOf(r), id);
  }
  @Get(":id/hotels")
  @Roles("User")
  @ApiOperation({ summary: "ITN-25 Search hotels for a city group" })
  hotels(
    @Req() r: Request,
    @Param("id") id: string,
    @Query() q: ItineraryHotelQueryDto,
  ) {
    return this.itineraries.hotelsFor(actorOf(r), id, q);
  }
  @Get(":id/flights")
  @Roles("User")
  @ApiOperation({
    summary: "ITN-26 Search flights to the first itinerary city",
  })
  flights(
    @Req() r: Request,
    @Param("id") id: string,
    @Query() q: ItineraryFlightQueryDto,
  ) {
    return this.itineraries.flightsFor(actorOf(r), id, q);
  }
  @Post(":id/bookings")
  @Roles("User")
  @ApiOperation({
    summary: "ITN-27 [Bonus] Link own booking and include its cost once",
  })
  link(@Req() r: Request, @Param("id") id: string, @Body() d: BookingLinkDto) {
    return this.itineraries.link(actorOf(r), id, d);
  }
  @Get(":id/pdf")
  @Roles("User")
  @ApiOperation({ summary: "ITN-28 [Bonus] Export own itinerary PDF" })
  pdf(@Req() r: Request, @Param("id") id: string, @Res() res: Response) {
    return this.itineraries.pdf(actorOf(r), id, res);
  }
}
@ApiTags("Itinerary items")
@ApiCookieAuth()
@Roles("User")
@Controller()
export class ItineraryItemsController {
  constructor(readonly itineraries: ItinerariesService) {}
  @Patch("activities/:id")
  @ApiOperation({ summary: "ITN-10 Edit own activity" })
  activity(
    @Req() r: Request,
    @Param("id") id: string,
    @Body() d: PatchActivityDto,
  ) {
    return this.itineraries.editChild(actorOf(r), "activities", id, d);
  }
  @Delete("activities/:id")
  @ApiOperation({ summary: "ITN-10 Delete own activity" })
  deleteActivity(
    @Req() r: Request,
    @Param("id") id: string,
    @Body() _d: ConfirmDto,
  ) {
    return this.itineraries.editChild(actorOf(r), "activities", id);
  }
  @Patch("budgets/:id")
  @ApiOperation({ summary: "ITN-14 Edit own budget entry" })
  budget(
    @Req() r: Request,
    @Param("id") id: string,
    @Body() d: PatchBudgetDto,
  ) {
    return this.itineraries.editChild(actorOf(r), "budgets", id, d);
  }
  @Delete("budgets/:id")
  @ApiOperation({ summary: "ITN-14 Delete own budget entry" })
  deleteBudget(
    @Req() r: Request,
    @Param("id") id: string,
    @Body() _d: ConfirmDto,
  ) {
    return this.itineraries.editChild(actorOf(r), "budgets", id);
  }
  @Patch("transport-costs/:id")
  @ApiOperation({ summary: "ITN-16 Edit transport cost" })
  transport(
    @Req() r: Request,
    @Param("id") id: string,
    @Body() d: PatchTransportDto,
  ) {
    return this.itineraries.editChild(actorOf(r), "transportCosts", id, d);
  }
  @Delete("transport-costs/:id")
  @ApiOperation({ summary: "ITN-16 Delete transport cost" })
  deleteTransport(
    @Req() r: Request,
    @Param("id") id: string,
    @Body() _d: ConfirmDto,
  ) {
    return this.itineraries.editChild(actorOf(r), "transportCosts", id);
  }
}
