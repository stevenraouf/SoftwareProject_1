import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Injectable,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  Res,
} from "@nestjs/common";
import { ApiCookieAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { Request, Response } from "express";
import { DateTime } from "luxon";
import { Db, oid, same } from "../database.js";
import {
  Actor,
  allowFields,
  dateOnly,
  localInstant,
  money,
  pageNumber,
  paginated,
  definedFields,
} from "../common.js";
import {
  AirlineDto,
  BaggageDto,
  CabinDto,
  CancellationPolicyDto,
  ConfirmDto,
  CreateFlightDto,
  FlightSearchDto,
  PageDto,
  PatchAirlineDto,
  PatchCabinDto,
  PatchFlightDto,
} from "../dto.js";
import { actorOf, Public, Roles } from "../auth/auth.js";
import { Inventory } from "../bookings/inventory.js";
import { Ops } from "../ops.js";

export function manageProvider(actor: Actor, provider: any) {
  const role =
    provider.type === "airline" ? "AirlineModerator" : "HotelModerator";
  if (actor.role !== role || !same(actor.providerId, provider._id))
    throw new ForbiddenException(
      "Only the assigned provider moderator may perform this action",
    );
}
export function tiersValid(tiers: { threshold: number }[]) {
  if (new Set(tiers.map((t) => t.threshold)).size !== tiers.length)
    throw new BadRequestException("Cancellation thresholds must be unique");
}
function slicePage(items: any[], page: number) {
  return {
    items: items.slice((page - 1) * 10, page * 10),
    page,
    pageSize: 10,
    total: items.length,
    pages: Math.ceil(items.length / 10),
  };
}
@Injectable()
export class FlightsService {
  constructor(
    readonly db: Db,
    readonly inventory: Inventory,
    readonly ops: Ops,
  ) {}
  async createAirline(dto: AirlineDto) {
    return this.db.model("Provider").create({ ...dto, type: "airline" });
  }
  async airline(id: string) {
    const p = await this.db.get("Provider", id);
    if (p.type !== "airline") throw new BadRequestException("Not an airline");
    return p;
  }
  async editAirline(actor: Actor, id: string, dto: PatchAirlineDto) {
    const p = await this.airline(id);
    manageProvider(actor, p);
    Object.assign(p, definedFields(dto));
    return p.save();
  }
  async flightDirectory(actor: Actor, id: string, page: number) {
    const airline = await this.airline(id);
    manageProvider(actor, airline);
    return paginated(this.db.model("Flight"), { airlineId: airline._id }, page, { departureAt: -1, _id: 1 });
  }
  async policy(actor: Actor, id: string, dto: CancellationPolicyDto) {
    const p = await this.airline(id);
    manageProvider(actor, p);
    tiersValid(dto.tiers);
    p.cancellationTiers = dto.tiers;
    return p.save();
  }
  async baggage(actor: Actor, id: string, dto: BaggageDto) {
    const p = await this.airline(id);
    manageProvider(actor, p);
    Object.assign(p, definedFields(dto));
    return p.save();
  }
  async instants(dto: any) {
    if (dto.departureAirport === dto.arrivalAirport)
      throw new BadRequestException(
        "Departure and arrival airports must differ",
      );
    const [departure, arrival] = await Promise.all([
      this.db.model("Airport").findOne({ iata_code: dto.departureAirport }),
      this.db.model("Airport").findOne({ iata_code: dto.arrivalAirport }),
    ]);
    if (!departure || !arrival)
      throw new BadRequestException(
        "Choose an airport from the official reference list",
      );
    const departureAt = localInstant(dto.departureLocal, departure.time_zone),
      arrivalAt = localInstant(dto.arrivalLocal, arrival.time_zone);
    if (departureAt <= new Date() || arrivalAt <= departureAt)
      throw new BadRequestException(
        "Departure must be in the future and arrival must follow departure in UTC",
      );
    return {
      departureAt,
      arrivalAt,
      departureDate: dto.departureLocal.slice(0, 10),
    };
  }
  async create(actor: Actor, dto: CreateFlightDto) {
    const p = await this.airline(dto.airlineId);
    manageProvider(actor, p);
    if (!p.active) throw new BadRequestException("Airline is inactive");
    return this.db.model("Flight").create({
      ...allowFields(dto, [
        "airlineId",
        "flightNumber",
        "departureAirport",
        "arrivalAirport",
      ]),
      ...(await this.instants(dto)),
    });
  }
  async managed(actor: Actor, id: string) {
    const f = await this.db.get("Flight", id);
    manageProvider(actor, await this.airline(String(f.airlineId)));
    return f;
  }
  async patch(actor: Actor, id: string, dto: PatchFlightDto) {
    return this.db.transaction(async (session) => {
      const f = await this.db.get("Flight", id, session);
      manageProvider(actor, await this.airline(String(f.airlineId)));
      if (f.status !== "Scheduled" || f.departureAt <= new Date())
        throw new BadRequestException(
          "Only future Scheduled flights may be edited",
        );
      if (
        ((dto.departureAirport &&
          dto.departureAirport !== f.departureAirport) ||
          (dto.arrivalAirport && dto.arrivalAirport !== f.arrivalAirport)) &&
        (await this.db
          .model("Booking")
          .exists({ "snapshot.segments.flightId": id })
          .session(session))
      )
        throw new BadRequestException(
          "Airports cannot change once any booking exists",
        );
      const dep = await this.db
        .model("Airport")
        .findOne({ iata_code: f.departureAirport })
        .session(session);
      const arr = await this.db
        .model("Airport")
        .findOne({ iata_code: f.arrivalAirport })
        .session(session);
      const input = {
        flightNumber: f.flightNumber,
        departureAirport: f.departureAirport,
        arrivalAirport: f.arrivalAirport,
        departureLocal: DateTime.fromJSDate(f.departureAt)
          .setZone(dep.time_zone)
          .toFormat("yyyy-MM-dd'T'HH:mm:ss"),
        arrivalLocal: DateTime.fromJSDate(f.arrivalAt)
          .setZone(arr.time_zone)
          .toFormat("yyyy-MM-dd'T'HH:mm:ss"),
        ...dto,
      };
      const times = await this.instants(input),
        changed =
          +times.departureAt !== +f.departureAt ||
          +times.arrivalAt !== +f.arrivalAt;
      Object.assign(
        f,
        allowFields(input, [
          "flightNumber",
          "departureAirport",
          "arrivalAirport",
        ]),
        times,
      );
      await f.save({ session });
      if (changed) {
        const bookings = await this.db
          .model("Booking")
          .find({ status: "Confirmed", "snapshot.segments.flightId": id })
          .session(session);
        for (const b of bookings) {
          const snapshot = structuredClone(b.snapshot);
          const segment = snapshot.segments.find((s: any) => s.flightId === id);
          Object.assign(segment, times);
          b.snapshot = snapshot;
          b.startsAt = snapshot.segments[0].departureAt;
          b.endsAt = snapshot.segments.at(-1).arrivalAt;
          await b.save({ session });
          await this.ops.notify(
            b.userId,
            `Flight ${f.flightNumber} schedule changed. See your booking for updated times.`,
            `schedule:${f.id}:${b.id}:${f.updatedAt.getTime()}`,
            undefined,
            session,
          );
        }
      }
      return f;
    });
  }
  async cabin(actor: Actor, id: string, dto: CabinDto) {
    await this.inventory.expireDue();
    return this.db.transaction(async (session) => {
      const f = await this.db.get("Flight", id, session);
      manageProvider(actor, await this.airline(String(f.airlineId)));
      if (f.status !== "Scheduled" || f.departureAt <= new Date())
        throw new BadRequestException(
          "Only future Scheduled flights may be edited",
        );
      if (f.cabins.some((c: any) => c.category === dto.category))
        throw new BadRequestException("Cabin category already exists");
      f.cabins.push(dto);
      return f.save({ session });
    });
  }
  async patchCabin(
    actor: Actor,
    id: string,
    cabinId: string,
    dto: PatchCabinDto,
  ) {
    await this.inventory.expireDue();
    return this.db.transaction(async (session) => {
      const f = await this.db.get("Flight", id, session);
      manageProvider(actor, await this.airline(String(f.airlineId)));
      if (f.status !== "Scheduled" || f.departureAt <= new Date())
        throw new BadRequestException(
          "Only future Scheduled flights may be edited",
        );
      const c = f.cabins.id(oid(cabinId));
      if (!c) throw new BadRequestException("Unknown cabin");
      if (dto.category && dto.category !== c.category)
        throw new BadRequestException("Cabin categories cannot be renamed");
      if (dto.capacity !== undefined && dto.capacity < c.booked + c.held)
        throw new BadRequestException(
          "Capacity cannot be below booked and held seats",
        );
      if (dto.capacity !== undefined && dto.capacity < c.capacity) {
        const labels = Array.from(
          { length: dto.capacity },
          (_, i) => `${Math.floor(i / 6) + 1}${"ABCDEF"[i % 6]}`,
        );
        if (
          await this.db
            .model("Seat")
            .exists({
              flightId: f._id,
              category: c.category,
              label: { $nin: labels },
            })
            .session(session)
        )
          throw new BadRequestException(
            "Capacity reduction would remove an assigned seat",
          );
      }
      Object.assign(c, definedFields(dto));
      return f.save({ session });
    });
  }
  async cancel(actor: Actor, id: string) {
    return this.db.transaction(async (session) => {
      const f = await this.db.get("Flight", id, session);
      manageProvider(actor, await this.airline(String(f.airlineId)));
      if (f.status === "Cancelled") return f;
      if (f.status !== "Scheduled" || f.departureAt <= new Date())
        throw new BadRequestException(
          "Only future Scheduled flights can be cancelled",
        );
      f.status = "Cancelled";
      await f.save({ session });
      const bookings = await this.db
        .model("Booking")
        .find({
          "snapshot.segments.flightId": id,
          status: { $in: ["Confirmed", "Pending Payment"] },
        })
        .session(session);
      for (const b of bookings) {
        if (b.status === "Confirmed")
          await this.inventory.cancelRecord(
            b,
            100,
            "Provider cancelled flight",
            session,
          );
        else {
          await this.inventory.invalidateHold(
            b,
            "Provider cancelled flight",
            session,
          );
        }
      }
      const changes = await this.db
        .model("FlightChange")
        .find({ "snapshot.segments.flightId": id, status: "Pending Payment" })
        .session(session);
      for (const c of changes) await this.inventory.expireChange(c, session);
      return f;
    });
  }
  async details(id: string) {
    const f = await this.db.get("Flight", id);
    const airline = await this.airline(String(f.airlineId));
    const airports = await this.db
      .model("Airport")
      .find({ iata_code: { $in: [f.departureAirport, f.arrivalAirport] } })
      .lean();
    const zone = (code: string) =>
      airports.find((a: any) => a.iata_code === code)?.time_zone;
    return {
      ...f.toObject(),
      airline: { id: airline.id, name: airline.name, active: airline.active },
      departureLocal: DateTime.fromJSDate(f.departureAt)
        .setZone(zone(f.departureAirport))
        .toISO(),
      arrivalLocal: DateTime.fromJSDate(f.arrivalAt)
        .setZone(zone(f.arrivalAirport))
        .toISO(),
      durationMinutes: (+f.arrivalAt - +f.departureAt) / 60000,
      cancellationTiers: airline.cancellationTiers,
      extraBagPrice: airline.extraBagPrice,
      maxExtraBags: airline.maxExtraBags,
      cabins: f.cabins.map((c: any) => ({
        ...c.toObject(),
        seatsRemaining: c.capacity - c.booked - c.held,
      })),
    };
  }
  async search(query: FlightSearchDto) {
    await this.inventory.expireDue();
    dateOnly(query.departureDate);
    if (
      query.departureAirport === query.arrivalAirport ||
      query.infants > query.adults
    )
      throw new BadRequestException("Invalid route or infant count");
    if (
      query.minPrice !== undefined &&
      query.maxPrice !== undefined &&
      query.minPrice > query.maxPrice
    )
      throw new BadRequestException("minPrice exceeds maxPrice");
    const origin = await this.db
      .model("Airport")
      .findOne({ iata_code: query.departureAirport });
    const destination = await this.db
      .model("Airport")
      .findOne({ iata_code: query.arrivalAirport });
    if (!origin || !destination)
      throw new BadRequestException("Unknown airport");
    if (
      query.departureDate <
      DateTime.now().setZone(origin.time_zone).toISODate()!
    )
      throw new BadRequestException("Departure date is in the past");
    const airlines = await this.db
      .model("Provider")
      .find({ type: "airline", active: true })
      .select("_id")
      .lean();
    const leg = async (
      from: string,
      to: string,
      date: string,
      zone: string,
    ) => {
      const start = DateTime.fromISO(date, { zone }).startOf("day");
      const flights = await this.db
        .model("Flight")
        .find({
          airlineId: { $in: airlines.map((a: any) => a._id) },
          status: "Scheduled",
          departureAirport: from,
          arrivalAirport: to,
          departureAt: {
            $gte: new Date(Math.max(+start, Date.now())),
            $lt: start.plus({ days: 1 }).toJSDate(),
          },
        })
        .lean();
      const items = flights
        .flatMap((f: any) =>
          f.cabins
            .filter(
              (c: any) =>
                (!query.cabin || c.category === query.cabin) &&
                c.capacity - c.booked - c.held >= query.adults + query.children,
            )
            .map((c: any) => ({
              flightId: f._id,
              airlineId: f.airlineId,
              flightNumber: f.flightNumber,
              departureAirport: from,
              arrivalAirport: to,
              departureAt: f.departureAt,
              arrivalAt: f.arrivalAt,
              departureLocal: DateTime.fromJSDate(f.departureAt)
                .setZone(zone)
                .toISO(),
              cabin: c.category,
              seatsRemaining: c.capacity - c.booked - c.held,
              price: money(
                c.price * (query.adults + query.children + query.infants * 0.1),
              ),
              currency: process.env.PLATFORM_CURRENCY || "USD",
              durationMinutes: (+f.arrivalAt - +f.departureAt) / 60000,
            })),
        )
        .filter(
          (r: any) =>
            (query.minPrice === undefined || r.price >= query.minPrice) &&
            (query.maxPrice === undefined || r.price <= query.maxPrice),
        );
      items.sort((a: any, b: any) =>
        query.sort === "duration"
          ? a.durationMinutes - b.durationMinutes
          : query.sort === "departure"
            ? +a.departureAt - +b.departureAt
            : a.price - b.price,
      );
      return slicePage(items, pageNumber(query.page));
    };
    const outbound = await leg(
      query.departureAirport,
      query.arrivalAirport,
      query.departureDate,
      origin.time_zone,
    );
    if (!query.returnDate) return outbound;
    dateOnly(query.returnDate);
    if (query.returnDate < query.departureDate)
      throw new BadRequestException("Return date precedes outbound date");
    return {
      outbound,
      return: await leg(
        query.arrivalAirport,
        query.departureAirport,
        query.returnDate,
        destination.time_zone,
      ),
    };
  }
  async bookings(actor: Actor, id: string, page: number) {
    await this.managed(actor, id);
    const data = await paginated(
      this.db.model("Booking"),
      {
        type: "flight",
        status: { $in: ["Confirmed", "Cancelled"] },
        "snapshot.segments.flightId": id,
      },
      page,
    );
    return {
      ...data,
      items: data.items.map((b: any) => ({
        reference: b.reference,
        status: b.status,
        passengers: b.snapshot.passengers.map((p: any) => p.fullName),
        segment: b.snapshot.segments.find((s: any) => s.flightId === id),
      })),
    };
  }
  async passengerCsv(actor: Actor, id: string) {
    await this.managed(actor, id);
    const bookings = await this.db
      .model("Booking")
      .find({ status: "Confirmed", "snapshot.segments.flightId": id })
      .lean();
    const cell = (s: any) =>
      `"${String(s)
        .replace(/^\s*[=+@-]/, "'$&")
        .replace(/"/g, '""')}"`;
    return [
      "Reference,Passenger,Cabin",
      ...bookings.flatMap((b: any) =>
        b.snapshot.passengers.map((p: any) =>
          [
            b.reference,
            p.fullName,
            b.snapshot.segments.find((s: any) => s.flightId === id).cabin,
          ]
            .map(cell)
            .join(","),
        ),
      ),
    ].join("\r\n");
  }
}
@ApiTags("Airlines")
@ApiCookieAuth()
@Controller("airlines")
export class AirlinesController {
  constructor(readonly flights: FlightsService) {}
  @Post()
  @Roles("Admin")
  @ApiOperation({ summary: "FLT-01 Create airline" })
  create(@Body() d: AirlineDto) {
    return this.flights.createAirline(d);
  }
  @Get(":id")
  @Public()
  @ApiOperation({ summary: "FLT-01 View airline profile" })
  get(@Param("id") id: string) {
    return this.flights.airline(id);
  }
  @Get(":id/flights")
  @Roles("AirlineModerator")
  @ApiOperation({ summary: "FLT-03 FLT-05 List the assigned airline's flight inventory" })
  directory(@Req() r: Request, @Param("id") id: string, @Query() q: PageDto) {
    return this.flights.flightDirectory(actorOf(r), id, q.page);
  }
  @Patch(":id")
  @Roles("AirlineModerator")
  @ApiOperation({ summary: "FLT-01 Edit assigned airline" })
  edit(@Req() r: Request, @Param("id") id: string, @Body() d: PatchAirlineDto) {
    return this.flights.editAirline(actorOf(r), id, d);
  }
  @Put(":id/cancellation-policy")
  @Roles("AirlineModerator")
  @ApiOperation({ summary: "FLT-09 Define cancellation tiers" })
  policy(
    @Req() r: Request,
    @Param("id") id: string,
    @Body() d: CancellationPolicyDto,
  ) {
    return this.flights.policy(actorOf(r), id, d);
  }
  @Put(":id/baggage-policy")
  @Roles("AirlineModerator")
  @ApiOperation({ summary: "FLT-08 Define extra baggage policy" })
  baggage(@Req() r: Request, @Param("id") id: string, @Body() d: BaggageDto) {
    return this.flights.baggage(actorOf(r), id, d);
  }
}
@ApiTags("Flights")
@ApiCookieAuth()
@Controller("flights")
export class FlightsController {
  constructor(readonly flights: FlightsService) {}
  @Get("search")
  @Public()
  @ApiOperation({
    summary: "FLT-11 FLT-12 FLT-15 Search one-way or round-trip flights",
  })
  search(@Query() q: FlightSearchDto) {
    return this.flights.search(q);
  }
  @Post()
  @Roles("AirlineModerator")
  @ApiOperation({ summary: "FLT-03 Create flight using airport-local times" })
  create(@Req() r: Request, @Body() d: CreateFlightDto) {
    return this.flights.create(actorOf(r), d);
  }
  @Get(":id")
  @Public()
  @ApiOperation({
    summary: "FLT-17 GEN-06 View flight with local times and remaining seats",
  })
  get(@Param("id") id: string) {
    return this.flights.details(id);
  }
  @Patch(":id")
  @Roles("AirlineModerator")
  @ApiOperation({ summary: "FLT-05 Edit future Scheduled flight" })
  edit(@Req() r: Request, @Param("id") id: string, @Body() d: PatchFlightDto) {
    return this.flights.patch(actorOf(r), id, d);
  }
  @Post(":id/cancel")
  @Roles("AirlineModerator")
  @ApiOperation({
    summary: "FLT-06 Cancel flight and refund affected bookings",
  })
  cancel(@Req() r: Request, @Param("id") id: string, @Body() _d: ConfirmDto) {
    return this.flights.cancel(actorOf(r), id);
  }
  @Post(":id/cabins")
  @Roles("AirlineModerator")
  @ApiOperation({ summary: "FLT-04 Add unique cabin category" })
  cabin(@Req() r: Request, @Param("id") id: string, @Body() d: CabinDto) {
    return this.flights.cabin(actorOf(r), id, d);
  }
  @Patch(":id/cabins/:cabinId")
  @Roles("AirlineModerator")
  @ApiOperation({ summary: "FLT-04 FLT-05 Edit cabin inventory and prices" })
  patchCabin(
    @Req() r: Request,
    @Param("id") id: string,
    @Param("cabinId") c: string,
    @Body() d: PatchCabinDto,
  ) {
    return this.flights.patchCabin(actorOf(r), id, c, d);
  }
  @Get(":id/bookings")
  @Roles("AirlineModerator")
  @ApiOperation({ summary: "FLT-29 List assigned flight bookings" })
  bookings(@Req() r: Request, @Param("id") id: string, @Query() q: PageDto) {
    return this.flights.bookings(actorOf(r), id, q.page);
  }
  @Get(":id/passengers/export")
  @Roles("AirlineModerator")
  @ApiOperation({ summary: "FLT-29 Export passenger CSV" })
  async export(
    @Req() r: Request,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    res
      .type("text/csv")
      .attachment("passengers.csv")
      .send(await this.flights.passengerCsv(actorOf(r), id));
  }
}
