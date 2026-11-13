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
  Put,
  Query,
  Req,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request } from "express";
import { DateTime } from "luxon";
import { Db } from "../database.js";
import {
  Actor,
  dateOnly,
  escapeRegex,
  nights,
  pageNumber,
  paginated,
  today,
} from "../common.js";
import {
  AvailabilityDto,
  ConfirmDto,
  HotelDto,
  HotelPolicyDto,
  HotelSearchDto,
  OptionalStayQueryDto,
  PageDto,
  PatchHotelDto,
  PatchRoomDto,
  RangePageQueryDto,
  RoomDto,
  StayQueryDto,
  StayPageQueryDto,
} from "../dto.js";
import { actorOf, Public, Roles } from "../auth/auth.js";
import { Inventory } from "../bookings/inventory.js";
import { manageProvider, tiersValid } from "../flights/flights.js";
import { Ops } from "../ops.js";

@Injectable()
export class HotelsService {
  constructor(
    readonly db: Db,
    readonly inventory: Inventory,
    readonly ops: Ops,
  ) {}
  async validateProfile(dto: any) {
    if (dto.city) {
      const city = await this.ops.city(dto.city);
      if (dto.country && city.country_code !== dto.country)
        throw new BadRequestException("City is not in the selected country");
    }
    if (dto.country) await this.ops.countries([dto.country]);
    if (dto.timezone && !DateTime.now().setZone(dto.timezone).isValid)
      throw new BadRequestException("Invalid IANA time zone");
  }
  async create(dto: HotelDto) {
    await this.validateProfile(dto);
    return this.db.model("Provider").create({ ...dto, type: "hotel" });
  }
  async hotel(id: string) {
    const h = await this.db.get("Provider", id);
    if (h.type !== "hotel") throw new BadRequestException("Not a hotel");
    return h;
  }
  async edit(actor: Actor, id: string, dto: PatchHotelDto) {
    const h = await this.hotel(id);
    manageProvider(actor, h);
    await this.validateProfile({ ...h.toObject(), ...dto });
    Object.assign(h, dto);
    return h.save();
  }
  async policy(actor: Actor, id: string, dto: HotelPolicyDto) {
    const h = await this.hotel(id);
    manageProvider(actor, h);
    tiersValid(dto.tiers);
    h.cancellationTiers = dto.tiers;
    h.checkInTime = dto.checkInTime;
    h.checkOutTime = dto.checkOutTime;
    return h.save();
  }
  async room(actor: Actor, hotelId: string, dto: RoomDto) {
    const h = await this.hotel(hotelId);
    manageProvider(actor, h);
    return this.db.model("Room").create({ ...dto, hotelId: h._id });
  }
  async managedRoom(
    actor: Actor,
    hotelId: string,
    roomId: string,
    session?: any,
  ) {
    const h = await this.hotel(hotelId);
    manageProvider(actor, h);
    const room = await this.db.get("Room", roomId, session);
    if (String(room.hotelId) !== hotelId)
      throw new BadRequestException("Room does not belong to this hotel");
    return room;
  }
  async editRoom(
    actor: Actor,
    hotelId: string,
    roomId: string,
    dto: PatchRoomDto,
  ) {
    await this.inventory.expireDue();
    return this.db.transaction(async (session) => {
      const room = await this.managedRoom(actor, hotelId, roomId, session);
      if (
        dto.active === false &&
        (await this.db
          .model("RoomNight")
          .exists({ roomId: room._id })
          .session(session))
      )
        throw new BadRequestException(
          "Room has a Confirmed reservation or active hold",
        );
      Object.assign(room, dto);
      return room.save({ session });
    });
  }
  async deleteRoom(actor: Actor, hotelId: string, roomId: string) {
    return this.db.transaction(async (session) => {
      const room = await this.managedRoom(actor, hotelId, roomId, session);
      if (room.everReserved)
        throw new BadRequestException(
          "A previously reserved room cannot be deleted; deactivate it instead",
        );
      await room.deleteOne({ session });
      return { message: "Room deleted" };
    });
  }
  normalizeRanges(ranges: { start: string; end: string }[]) {
    const sorted = [...ranges].sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 0; i < sorted.length; i++) {
      dateOnly(sorted[i].start);
      dateOnly(sorted[i].end);
      if (sorted[i].end <= sorted[i].start)
        throw new BadRequestException("Range end must be after start");
      if (i && sorted[i].start < sorted[i - 1].end)
        throw new BadRequestException("Availability ranges must not overlap");
    }
    const merged: { start: string; end: string }[] = [];
    for (const r of sorted) {
      if (merged.at(-1)?.end === r.start) merged.at(-1)!.end = r.end;
      else merged.push({ start: r.start, end: r.end });
    }
    return merged;
  }
  async ranges(
    actor: Actor,
    hotelId: string,
    roomId: string,
    dto: AvailabilityDto,
    append: boolean,
  ) {
    await this.inventory.expireDue();
    return this.db.transaction(async (session) => {
      const room = await this.managedRoom(actor, hotelId, roomId, session);
      const ranges = this.normalizeRanges(
        append
          ? [
              ...room[dto.kind].map((r: any) => ({
                start: r.start,
                end: r.end,
              })),
              ...dto.ranges,
            ]
          : dto.ranges,
      );
      const held = await this.db
        .model("RoomNight")
        .find({ roomId: room._id })
        .session(session)
        .lean();
      for (const record of held) {
        const covered = ranges.some(
          (r) => r.start <= record.date && record.date < r.end,
        );
        if (dto.kind === "blocked" ? covered : !covered)
          throw new BadRequestException(
            "Range change conflicts with a Confirmed reservation or active hold",
          );
      }
      room[dto.kind] = ranges;
      return room.save({ session });
    });
  }
  async available(id: string, query: StayQueryDto, page = 1) {
    await this.inventory.expireDue();
    const hotel = await this.hotel(id);
    if (!hotel.active || query.checkIn < today(hotel.timezone))
      throw new BadRequestException(
        "Hotel unavailable or check-in in the past",
      );
    const items = (
      await this.inventory.availableRooms(id, query.checkIn, query.checkOut)
    ).map((room: any) => ({
      ...room,
      totalStayPrice: room.price * nights(query.checkIn, query.checkOut).length,
      currency: process.env.PLATFORM_CURRENCY || "USD",
    }));
    const p = pageNumber(page);
    return {
      items: items.slice((p - 1) * 10, p * 10),
      page: p,
      pageSize: 10,
      total: items.length,
      pages: Math.ceil(items.length / 10),
    };
  }
  async search(q: HotelSearchDto) {
    await this.inventory.expireDue();
    nights(q.checkIn, q.checkOut);
    if (
      q.minPrice !== undefined &&
      q.maxPrice !== undefined &&
      q.minPrice > q.maxPrice
    )
      throw new BadRequestException("minPrice exceeds maxPrice");
    const cities = await this.db
      .model("City")
      .find({
        $or: [
          { city_id: q.destination },
          { name: new RegExp(`^${escapeRegex(q.destination)}$`, "i") },
        ],
      })
      .lean();
    const countries = await this.db
      .model("Country")
      .find({
        $or: [
          { code: q.destination.toUpperCase() },
          { name: new RegExp(`^${escapeRegex(q.destination)}$`, "i") },
        ],
      })
      .lean();
    const hotels = await this.db
      .model("Provider")
      .find({
        type: "hotel",
        active: true,
        $or: [
          { city: { $in: cities.map((c: any) => c.city_id) } },
          { country: { $in: countries.map((c: any) => c.code) } },
        ],
        ...(q.minRating
          ? { ratingCount: { $gt: 0 }, averageRating: { $gte: q.minRating } }
          : {}),
      })
      .lean();
    const result: any[] = [];
    for (const hotel of hotels) {
      if (q.checkIn < today(hotel.timezone)) continue;
      const rooms = await this.inventory.availableRooms(
        hotel._id,
        q.checkIn,
        q.checkOut,
      );
      if (rooms.length < q.rooms) continue;
      // A room qualifies if it can participate in a combination of exactly the requested room count.
      const qualifying = rooms.filter(
        (r: any) =>
          r.occupancy +
            rooms
              .filter((other: any) => !sameRoom(other, r))
              .sort((a: any, b: any) => b.occupancy - a.occupancy)
              .slice(0, q.rooms - 1)
              .reduce((sum: number, x: any) => sum + x.occupancy, 0) >=
          q.guests,
      );
      if (!qualifying.length) continue;
      const price = Math.min(...qualifying.map((r: any) => r.price));
      if (
        (q.minPrice !== undefined && price < q.minPrice) ||
        (q.maxPrice !== undefined && price > q.maxPrice)
      )
        continue;
      result.push({
        ...hotel,
        pricePerNight: price,
        currency: process.env.PLATFORM_CURRENCY || "USD",
        availableRoomCount: rooms.length,
      });
    }
    result.sort((a, b) =>
      q.sort === "rating"
        ? b.averageRating - a.averageRating || a.pricePerNight - b.pricePerNight
        : a.pricePerNight - b.pricePerNight,
    );
    const p = pageNumber(q.page);
    return {
      items: result.slice((p - 1) * 10, p * 10),
      page: p,
      pageSize: 10,
      total: result.length,
      pages: Math.ceil(result.length / 10),
    };
  }
  async details(id: string, q: OptionalStayQueryDto) {
    const hotel = await this.hotel(id);
    if (!!q.checkIn !== !!q.checkOut)
      throw new BadRequestException("Supply both checkIn and checkOut");
    const reviews = await paginated(this.db.model("Review"), {
      hotelId: hotel._id,
      hidden: false,
    });
    return {
      ...hotel.toObject(),
      reviews,
      ...(q.checkIn && q.checkOut
        ? { availableRooms: await this.available(id, q as StayQueryDto) }
        : {}),
    };
  }
  async status(actor: Actor, id: string, q: RangePageQueryDto) {
    await this.inventory.expireDue();
    const h = await this.hotel(id);
    manageProvider(actor, h);
    const days = nights(q.start, q.end);
    const rooms = await this.db.model("Room").find({ hotelId: h._id }).lean();
    const records = await this.db
      .model("RoomNight")
      .find({
        roomId: { $in: rooms.map((r: any) => r._id) },
        date: { $in: days },
      })
      .lean();
    const bookings = await this.db
      .model("Booking")
      .find({ _id: { $in: records.map((r: any) => r.bookingId) } })
      .select("reference status")
      .lean();
    const p = pageNumber(q.page);
    const items = rooms.slice((p - 1) * 10, p * 10).map((room: any) => ({
      roomId: room._id,
      number: room.number,
      days: days.map((date) => {
        const record = records.find(
          (r: any) => String(r.roomId) === String(room._id) && r.date === date,
        );
        const b =
          record &&
          bookings.find((b: any) => String(b._id) === String(record.bookingId));
        return {
          date,
          status: b
            ? "Booked"
            : !room.active ||
                room.blocked.some(
                  (r: any) => r.start <= date && date < r.end,
                ) ||
                !room.availability.some(
                  (r: any) => r.start <= date && date < r.end,
                )
              ? "Blocked"
              : "Available",
          ...(b ? { reference: b.reference, bookingStatus: b.status } : {}),
        };
      }),
    }));
    return {
      items,
      page: p,
      pageSize: 10,
      total: rooms.length,
      pages: Math.ceil(rooms.length / 10),
    };
  }
  async reservations(actor: Actor, id: string, q: PageDto) {
    const h = await this.hotel(id);
    manageProvider(actor, h);
    const data = await paginated(
      this.db.model("Booking"),
      { type: "hotel", providerIds: h._id },
      q.page,
    );
    return {
      ...data,
      items: data.items.map((b: any) => ({
        reference: b.reference,
        status: b.status,
        checkIn: b.snapshot.checkIn,
        checkOut: b.snapshot.checkOut,
        rooms: b.snapshot.rooms.map((r: any) => ({
          number: r.number,
          guests: r.guests,
        })),
      })),
    };
  }
}
function sameRoom(a: any, b: any) {
  return String(a._id) === String(b._id);
}
@ApiTags("Hotels and rooms")
@ApiCookieAuth()
@Controller("hotels")
export class HotelsController {
  constructor(readonly hotels: HotelsService) {}
  @Post()
  @Roles("Admin")
  @ApiOperation({ summary: "HTL-01 Create hotel" })
  create(@Body() d: HotelDto) {
    return this.hotels.create(d);
  }
  @Get("search")
  @Public()
  @ApiOperation({
    summary:
      "HTL-11 HTL-12 Search hotels by date, destination, occupancy, price and rating",
  })
  search(@Query() q: HotelSearchDto) {
    return this.hotels.search(q);
  }
  @Get(":id")
  @Public()
  @ApiOperation({ summary: "HTL-02 Hotel details with optional stay dates" })
  detail(@Param("id") id: string, @Query() q: OptionalStayQueryDto) {
    return this.hotels.details(id, q);
  }
  @Patch(":id")
  @Roles("HotelModerator")
  @ApiOperation({ summary: "HTL-01 Edit assigned hotel profile" })
  edit(@Req() r: Request, @Param("id") id: string, @Body() d: PatchHotelDto) {
    return this.hotels.edit(actorOf(r), id, d);
  }
  @Post(":id/rooms")
  @Roles("HotelModerator")
  @ApiOperation({ summary: "HTL-03 Add an individually bookable room" })
  room(@Req() r: Request, @Param("id") id: string, @Body() d: RoomDto) {
    return this.hotels.room(actorOf(r), id, d);
  }
  @Patch(":id/rooms/:roomId")
  @Roles("HotelModerator")
  @ApiOperation({ summary: "HTL-05 HTL-06 Edit or deactivate a room" })
  editRoom(
    @Req() r: Request,
    @Param("id") id: string,
    @Param("roomId") room: string,
    @Body() d: PatchRoomDto,
  ) {
    return this.hotels.editRoom(actorOf(r), id, room, d);
  }
  @Delete(":id/rooms/:roomId")
  @Roles("HotelModerator")
  @ApiOperation({ summary: "HTL-06 Delete a never-reserved room" })
  deleteRoom(
    @Req() r: Request,
    @Param("id") id: string,
    @Param("roomId") room: string,
    @Body() _d: ConfirmDto,
  ) {
    return this.hotels.deleteRoom(actorOf(r), id, room);
  }
  @Get(":id/rooms/available")
  @Public()
  @ApiOperation({ summary: "HTL-15 List rooms available throughout the stay" })
  available(@Param("id") id: string, @Query() q: StayPageQueryDto) {
    return this.hotels.available(id, q, q.page);
  }
  @Post(":id/rooms/:roomId/availability")
  @Roles("HotelModerator")
  @ApiOperation({ summary: "HTL-04 Add non-overlapping bookable ranges" })
  addRange(
    @Req() r: Request,
    @Param("id") id: string,
    @Param("roomId") room: string,
    @Body() d: AvailabilityDto,
  ) {
    return this.hotels.ranges(actorOf(r), id, room, d, true);
  }
  @Patch(":id/rooms/:roomId/availability")
  @Roles("HotelModerator")
  @ApiOperation({
    summary: "HTL-05 HTL-06 Replace availability or blocked ranges",
  })
  ranges(
    @Req() r: Request,
    @Param("id") id: string,
    @Param("roomId") room: string,
    @Body() d: AvailabilityDto,
  ) {
    return this.hotels.ranges(actorOf(r), id, room, d, false);
  }
  @Get(":id/availability")
  @Roles("HotelModerator")
  @ApiOperation({ summary: "HTL-08 View room status for each date" })
  status(
    @Req() r: Request,
    @Param("id") id: string,
    @Query() q: RangePageQueryDto,
  ) {
    return this.hotels.status(actorOf(r), id, q);
  }
  @Put(":id/policies")
  @Roles("HotelModerator")
  @ApiOperation({
    summary: "HTL-09 HTL-10 Define check-in/out times and cancellation tiers",
  })
  policies(
    @Req() r: Request,
    @Param("id") id: string,
    @Body() d: HotelPolicyDto,
  ) {
    return this.hotels.policy(actorOf(r), id, d);
  }
  @Get(":id/reservations")
  @Roles("HotelModerator")
  @ApiOperation({ summary: "HTL-22 List assigned hotel reservations" })
  reservations(
    @Req() r: Request,
    @Param("id") id: string,
    @Query() q: PageDto,
  ) {
    return this.hotels.reservations(actorOf(r), id, q);
  }
}
