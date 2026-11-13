import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { ClientSession, Types } from "mongoose";
import { DateTime } from "luxon";
import { Db, oid, same } from "../database.js";
import { Actor, minor, money, nights, today } from "../common.js";
import { FlightBookingDto, HotelBookingDto } from "../dto.js";
import { Ops } from "../ops.js";

@Injectable()
export class Inventory {
  constructor(
    readonly db: Db,
    readonly ops: Ops,
  ) {}
  async lockUser(actor: Actor, session: ClientSession) {
    if (actor.role !== "User")
      throw new ForbiddenException("A registered traveler account is required");
    if (process.env.ENABLE_EMAIL_BONUS === "true" && !actor.emailVerified)
      throw new ForbiddenException("Verify your email before booking");
    const result = await this.db
      .model("User")
      .updateOne(
        { _id: oid(actor.id), status: "Active" },
        { $inc: { __v: 1 } },
        { session },
      );
    if (!result.matchedCount)
      throw new ForbiddenException("Account unavailable");
  }
  async lockProvider(id: any, type: string, session: ClientSession) {
    const provider = await this.db
      .model("Provider")
      .findOneAndUpdate(
        { _id: oid(String(id)), type, active: true },
        { $inc: { __v: 1 } },
        { session, returnDocument: "after" },
      );
    if (!provider)
      throw new ConflictException("Provider is inactive or unavailable");
    return provider;
  }
  async flightQuote(dto: FlightBookingDto, session?: ClientSession) {
    if (
      new Set(dto.segments.map((s) => s.flightId)).size !== dto.segments.length
    )
      throw new BadRequestException("Repeated flight segment");
    const segments: any[] = [];
    let amount = 0;
    let seats = 0;
    const counts: Record<string, number> = { adult: 0, child: 0, infant: 0 };
    for (const p of dto.passengers) counts[p.type]++;
    if (
      counts.adult < 1 ||
      counts.infant > counts.adult ||
      counts.adult + counts.child > 9
    )
      throw new BadRequestException(
        "At least one adult, at most one infant per adult, and at most 9 seated passengers are required",
      );
    seats = counts.adult + counts.child;
    for (const selected of dto.segments) {
      const flight = await this.db.get("Flight", selected.flightId, session);
      if (flight.status !== "Scheduled" || flight.departureAt <= new Date())
        throw new ConflictException("Flight is no longer bookable");
      const airline = session
        ? await this.lockProvider(flight.airlineId, "airline", session)
        : await this.db.get("Provider", flight.airlineId);
      if (!airline.active) throw new ConflictException("Airline is inactive");
      const cabin = flight.cabins.find(
        (c: any) => c.category === selected.cabin,
      );
      if (!cabin || cabin.capacity - cabin.booked - cabin.held < seats)
        throw new ConflictException("Insufficient seats");
      const airport = await this.db
        .model("Airport")
        .findOne({ iata_code: flight.departureAirport })
        .session(session ?? null);
      const departureDate = DateTime.fromJSDate(flight.departureAt)
        .setZone(airport.time_zone)
        .toISODate()!;
      const arrivalAirport = await this.db
        .model("Airport")
        .findOne({ iata_code: flight.arrivalAirport })
        .session(session ?? null);
      for (const p of dto.passengers) {
        const dob = DateTime.fromISO(p.dateOfBirth, { zone: "UTC" });
        const age = Math.floor(
          DateTime.fromISO(departureDate, { zone: "UTC" }).diff(dob, "years")
            .years,
        );
        if (
          !dob.isValid ||
          p.dateOfBirth > departureDate ||
          age > 120 ||
          p.type !== (age < 2 ? "infant" : age < 12 ? "child" : "adult")
        )
          throw new BadRequestException(
            "Passenger type does not match age on the departure date",
          );
        if (
          p.extraBags > airline.maxExtraBags ||
          (p.extraBags > 0 && !p.bagWeightsKg) ||
          (p.bagWeightsKg &&
            (p.bagWeightsKg.length !== p.extraBags ||
              p.bagWeightsKg.some((w) => w <= 0 || w > cabin.bagWeightKg)))
        )
          throw new BadRequestException(
            "Extra baggage exceeds the airline allowance",
          );
      }
      const total = money(
        dto.passengers.reduce(
          (sum, p) =>
            sum +
            cabin.price * (p.type === "infant" ? 0.1 : 1) +
            p.extraBags * airline.extraBagPrice,
          0,
        ),
      );
      amount += total;
      segments.push({
        flightId: String(flight._id),
        airlineId: String(airline._id),
        airlineName: airline.name,
        flightNumber: flight.flightNumber,
        departureAirport: flight.departureAirport,
        arrivalAirport: flight.arrivalAirport,
        departureAt: flight.departureAt,
        arrivalAt: flight.arrivalAt,
        departureZone: airport.time_zone,
        arrivalZone: arrivalAirport.time_zone,
        cabin: selected.cabin,
        cabinId: String(cabin._id),
        seats,
        unitPrice: cabin.price,
        freeBags: cabin.freeBags,
        bagWeightKg: cabin.bagWeightKg,
        extraBagPrice: airline.extraBagPrice,
        maxExtraBags: airline.maxExtraBags,
        cancellationTiers: airline.cancellationTiers.toObject(),
        total,
      });
    }
    if (
      segments.length === 2 &&
      (segments[0].departureAirport !== segments[1].arrivalAirport ||
        segments[0].arrivalAirport !== segments[1].departureAirport ||
        new Date(segments[1].departureAt) <= new Date(segments[0].arrivalAt))
    )
      throw new BadRequestException(
        "Round-trip segments must reverse the route and return after outbound arrival",
      );
    return {
      amount: money(amount),
      seats,
      segments,
      passengers: dto.passengers,
      startsAt: segments[0].departureAt,
      endsAt: segments.at(-1).arrivalAt,
      policy: {
        cancellationTiers: segments[0].cancellationTiers,
        segments: segments.map((s) => ({
          flightId: s.flightId,
          cabin: s.cabin,
          freeBags: s.freeBags,
          bagWeightKg: s.bagWeightKg,
          extraBagPrice: s.extraBagPrice,
          maxExtraBags: s.maxExtraBags,
        })),
      },
    };
  }
  async acquireFlights(snapshot: any, session: ClientSession) {
    for (const segment of snapshot.segments) {
      const flight = await this.db.get("Flight", segment.flightId, session);
      const cabin = flight.cabins.find((c: any) =>
        same(c._id, segment.cabinId),
      );
      if (
        !cabin ||
        flight.status !== "Scheduled" ||
        flight.departureAt <= new Date() ||
        cabin.capacity - cabin.booked - cabin.held < segment.seats
      )
        throw new ConflictException("Insufficient seats; retry search");
      // A conditional update plus the transaction serializes requests for the same flight document.
      const result = await this.db.model("Flight").updateOne(
        {
          _id: flight._id,
          status: "Scheduled",
          cabins: {
            $elemMatch: {
              _id: cabin._id,
              held: cabin.held,
              booked: cabin.booked,
              capacity: cabin.capacity,
            },
          },
        },
        { $inc: { "cabins.$.held": segment.seats } },
        { session },
      );
      if (!result.modifiedCount)
        throw new ConflictException("Flight inventory changed; retry");
    }
  }
  async availableRooms(
    hotelId: any,
    checkIn: string,
    checkOut: string,
    session?: ClientSession,
  ) {
    const days = nights(checkIn, checkOut);
    const occupied = await this.db
      .model("RoomNight")
      .distinct("roomId", { date: { $in: days } })
      .session(session ?? null);
    const rooms = await this.db
      .model("Room")
      .find({
        hotelId: oid(String(hotelId)),
        active: true,
        _id: { $nin: occupied },
      })
      .session(session ?? null)
      .lean();
    return rooms.filter(
      (r: any) =>
        r.availability.some(
          (range: any) => range.start <= checkIn && range.end >= checkOut,
        ) &&
        !r.blocked.some(
          (range: any) => range.start < checkOut && checkIn < range.end,
        ),
    );
  }
  async hotelQuote(dto: HotelBookingDto, session?: ClientSession) {
    const days = nights(dto.checkIn, dto.checkOut);
    const hotel = session
      ? await this.lockProvider(dto.hotelId, "hotel", session)
      : await this.db.get("Provider", dto.hotelId);
    if (
      hotel.type !== "hotel" ||
      !hotel.active ||
      dto.checkIn < today(hotel.timezone)
    )
      throw new BadRequestException(
        "Hotel is unavailable or check-in is in the past",
      );
    if (new Set(dto.rooms.map((r) => r.roomId)).size !== dto.rooms.length)
      throw new BadRequestException("Repeated room");
    if (!dto.rooms.some((r) => r.guests.some((g) => g.age >= 18)))
      throw new BadRequestException(
        "At least one adult is required per reservation",
      );
    const available = await this.availableRooms(
      dto.hotelId,
      dto.checkIn,
      dto.checkOut,
      session,
    );
    const rooms = dto.rooms.map((selected) => {
      const room = available.find((r: any) => same(r._id, selected.roomId));
      if (!room) throw new ConflictException("A selected room is unavailable");
      if (selected.guests.length > room.occupancy)
        throw new BadRequestException("Room maximum occupancy exceeded");
      return {
        roomId: String(room._id),
        number: room.number,
        type: room.type,
        guests: selected.guests,
        nightlyPrice: room.price,
        total: money(room.price * days.length),
      };
    });
    return {
      hotelId: String(hotel._id),
      hotelName: hotel.name,
      timezone: hotel.timezone,
      checkIn: dto.checkIn,
      checkOut: dto.checkOut,
      nights: days.length,
      rooms,
      amount: money(rooms.reduce((s, r) => s + r.total, 0)),
      startsAt: DateTime.fromISO(`${dto.checkIn}T${hotel.checkInTime}`, {
        zone: hotel.timezone,
      }).toJSDate(),
      endsAt: DateTime.fromISO(`${dto.checkOut}T${hotel.checkOutTime}`, {
        zone: hotel.timezone,
      }).toJSDate(),
      policy: {
        cancellationTiers: hotel.cancellationTiers.toObject(),
        checkInTime: hotel.checkInTime,
        checkOutTime: hotel.checkOutTime,
        timezone: hotel.timezone,
      },
    };
  }
  async acquireRooms(
    snapshot: any,
    bookingId: Types.ObjectId,
    session: ClientSession,
  ) {
    const rows = snapshot.rooms.flatMap((r: any) =>
      nights(snapshot.checkIn, snapshot.checkOut).map((date) => ({
        roomId: oid(r.roomId),
        date,
        bookingId,
      })),
    );
    await this.db.model("RoomNight").insertMany(rows, { session });
    await this.db
      .model("Room")
      .updateMany(
        { _id: { $in: snapshot.rooms.map((r: any) => oid(r.roomId)) } },
        { $set: { everReserved: true } },
        { session },
      );
  }
  async release(
    snapshot: any,
    type: string,
    bookingId: any,
    held: boolean,
    session: ClientSession,
  ) {
    if (type === "hotel") {
      await this.db.model("RoomNight").deleteMany({ bookingId }, { session });
      return;
    }
    for (const s of snapshot.segments) {
      const field = held ? "held" : "booked";
      const result = await this.db.model("Flight").updateOne(
        {
          _id: oid(s.flightId),
          cabins: {
            $elemMatch: { _id: oid(s.cabinId), [field]: { $gte: s.seats } },
          },
        },
        { $inc: { [`cabins.$.${field}`]: -s.seats } },
        { session },
      );
      if (!result.matchedCount)
        throw new ConflictException(
          "Inventory inconsistency; release requires reconciliation",
        );
    }
    if (!held)
      await this.db.model("Seat").deleteMany({ bookingId }, { session });
  }
  async convert(snapshot: any, session: ClientSession) {
    for (const s of snapshot.segments) {
      const flight = await this.db.get("Flight", s.flightId, session);
      if (flight.status !== "Scheduled" || flight.departureAt <= new Date())
        throw new ConflictException("Flight no longer bookable");
      const result = await this.db.model("Flight").updateOne(
        {
          _id: flight._id,
          cabins: {
            $elemMatch: { _id: oid(s.cabinId), held: { $gte: s.seats } },
          },
        },
        { $inc: { "cabins.$.held": -s.seats, "cabins.$.booked": s.seats } },
        { session },
      );
      if (!result.matchedCount)
        throw new ConflictException("Seat hold no longer available");
    }
  }
  async refund(
    booking: any,
    amount: number,
    reason: string,
    key: string,
    session: ClientSession,
    onlyPayment?: any,
  ) {
    let remaining = minor(amount);
    const payments = await this.db
      .model("Payment")
      .find({
        ...(onlyPayment ? { _id: onlyPayment } : { bookingId: booking._id }),
        status: "Succeeded",
      })
      .sort({ createdAt: 1 })
      .session(session);
    for (const payment of payments) {
      if (!remaining) break;
      const existing = await this.db
        .model("Refund")
        .find({ paymentId: payment._id })
        .session(session)
        .lean();
      const available =
        minor(payment.amount) -
        existing.reduce((sum: number, r: any) => sum + minor(r.amount), 0);
      const part = Math.min(remaining, available);
      if (part <= 0) continue;
      const id = new Types.ObjectId();
      await this.db.model("Refund").create(
        [
          {
            _id: id,
            bookingId: booking._id,
            userId: booking.userId,
            paymentId: payment._id,
            amount: part / 100,
            currency: booking.currency,
            reason,
            key: `${key}:${payment.id}`,
          },
        ],
        { session },
      );
      await this.ops.enqueue(
        `refund:${id}`,
        "refund",
        { refundId: String(id) },
        session,
      );
      remaining -= part;
    }
    if (remaining > 0)
      throw new ConflictException(
        "Refund exceeds recorded refundable payments",
      );
  }
  async cancelRecord(
    booking: any,
    percentage: number,
    reason: string,
    session: ClientSession,
  ) {
    if (booking.status !== "Confirmed") return false;
    const activeChange = await this.db
      .model("FlightChange")
      .findOne({ bookingId: booking._id, status: "Pending Payment" })
      .session(session);
    if (activeChange) await this.expireChange(activeChange, session);
    const updated = await this.db.model("Booking").updateOne(
      { _id: booking._id, status: "Confirmed", revision: booking.revision },
      {
        $set: {
          status: "Cancelled",
          cancelledAt: new Date(),
          cancelReason: reason,
        },
        $inc: { revision: 1 },
      },
      { session },
    );
    if (!updated.modifiedCount)
      throw new ConflictException("Booking changed; retry");
    await this.release(
      booking.snapshot,
      booking.type,
      booking._id,
      false,
      session,
    );
    const amount = money((booking.amount * percentage) / 100);
    if (amount > 0)
      await this.refund(
        booking,
        amount,
        reason,
        `cancel:${booking.id}`,
        session,
      );
    await this.ops.notify(
      booking.userId,
      `Booking ${booking.reference} cancelled. Refund: ${amount} ${booking.currency}.`,
      `cancel:${booking.id}`,
      undefined,
      session,
    );
    return true;
  }
  async expireChange(change: any, session: ClientSession) {
    const update = await this.db
      .model("FlightChange")
      .updateOne(
        { _id: change._id, status: "Pending Payment" },
        { $set: { status: "Expired" } },
        { session },
      );
    if (!update.modifiedCount) return;
    await this.release(
      change.snapshot,
      "flight",
      change.bookingId,
      true,
      session,
    );
    if (change.paymentId)
      await this.ops.enqueue(
        `cancel-payment:${change.paymentId}`,
        "cancel-payment",
        { paymentId: String(change.paymentId) },
        session,
      );
  }
  async expireDue() {
    const time = new Date();
    const bookings = await this.db
      .model("Booking")
      .find({ status: "Pending Payment", holdExpiresAt: { $lte: time } })
      .select("_id")
      .lean();
    for (const item of bookings)
      await this.db.transaction(async (session) => {
        const b = await this.db.model("Booking").findOneAndUpdate(
          {
            _id: item._id,
            status: "Pending Payment",
            holdExpiresAt: { $lte: time },
          },
          { $set: { status: "Expired" } },
          { session },
        );
        if (!b) return;
        await this.release(b.snapshot, b.type, b._id, true, session);
        if (b.paymentId)
          await this.ops.enqueue(
            `cancel-payment:${b.paymentId}`,
            "cancel-payment",
            { paymentId: String(b.paymentId) },
            session,
          );
      });
    const changes = await this.db
      .model("FlightChange")
      .find({ status: "Pending Payment", expiresAt: { $lte: time } })
      .lean();
    for (const c of changes)
      await this.db.transaction((s) => this.expireChange(c, s));
  }
}
