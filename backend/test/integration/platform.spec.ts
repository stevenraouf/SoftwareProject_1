import { jest } from "@jest/globals";
import "reflect-metadata";
import { INestApplication } from "@nestjs/common";
import request from "supertest";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { Types } from "mongoose";
import { DateTime } from "luxon";
import Stripe from "stripe";
import { PNG } from "pngjs";
import { mkdir, mkdtemp, writeFile, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { createApp } from "../../src/bootstrap.js";
import { Db } from "../../src/database.js";
import { seedAdmin, seedReference } from "../../src/seed.js";
import { hash } from "../../src/common.js";
import { PaymentsService } from "../../src/payments/payments.js";
import { Inventory } from "../../src/bookings/inventory.js";
import { Ops } from "../../src/ops.js";
import { Jobs } from "../../src/jobs.js";
import { apiCoverage } from "../api-coverage.js";

let repl: MongoMemoryReplSet,
  app: INestApplication,
  db: Db,
  payments: PaymentsService,
  inventory: Inventory;
let testDbPath: string | undefined;
let coverageReport: ReturnType<typeof apiCoverage>;
const password = "TestPassword123";
type Login = { cookie: string; csrf: string; user: any };
const users: Record<string, Login> = {};
let airline: any,
  hotel: any,
  flight: any,
  returnFlight: any,
  room: any,
  room2: any;
const start = DateTime.now()
  .setZone("Africa/Cairo")
  .plus({ days: 21 })
  .toISODate()!;
const end = DateTime.fromISO(start).plus({ days: 3 }).toISODate()!;
const send = (
  method: "get" | "post" | "patch" | "delete" | "put",
  path: string,
  user?: Login,
  body?: any,
) => {
  let req = request(app.getHttpServer())[method](`/api${path}`);
  if (user) req = req.set("Cookie", user.cookie).set("X-CSRF-Token", user.csrf);
  if (body !== undefined) req = req.send(body);
  return req;
};
async function login(email: string) {
  const r = await send("post", "/auth/login", undefined, { email, password });
  expect(r.status).toBe(201);
  return {
    cookie: (r.headers["set-cookie"] as unknown as string[])
      .map((s) => s.split(";")[0])
      .join("; "),
    csrf: r.body.csrfToken,
    user: r.body.user,
  };
}
function traveler(email: string) {
  return { name: email.split("@")[0], email, password, consent: true };
}
function flightDto(id = flight._id) {
  return {
    segments: [{ flightId: String(id), cabin: "Economy" }],
    passengers: [
      {
        fullName: "Test Traveler",
        dateOfBirth: "1995-01-01",
        identityNumber: "TEST123",
        type: "adult",
        extraBags: 0,
      },
    ],
  };
}
function hotelDto(rooms = [room]) {
  return {
    hotelId: hotel._id,
    checkIn: start,
    checkOut: end,
    rooms: rooms.map((r) => ({
      roomId: r._id,
      guests: [{ name: "Adult", age: 30 }],
    })),
  };
}
async function makeFlight(number: string, capacity = 10, offset = 0) {
  return db.model("Flight").create({
    airlineId: airline._id,
    flightNumber: number,
    departureAirport: "CAI",
    arrivalAirport: "DXB",
    departureDate: start,
    departureAt: DateTime.fromISO(start)
      .plus({ hours: 10 + offset })
      .toJSDate(),
    arrivalAt: DateTime.fromISO(start)
      .plus({ hours: 13 + offset })
      .toJSDate(),
    cabins: [
      {
        category: "Economy",
        capacity,
        price: 100,
        freeBags: 1,
        bagWeightKg: 23,
      },
    ],
  });
}
async function markPaid(
  bookingId: string,
  eventId = new Types.ObjectId().toString(),
) {
  const b = await db.get("Booking", bookingId);
  const p = await db.model("Payment").create({
    bookingId: b._id,
    userId: b.userId,
    amount: b.amount,
    currency: b.currency,
    stripeId: `pi_${new Types.ObjectId()}`,
    status: "Pending",
  });
  await db
    .model("Booking")
    .updateOne({ _id: b._id }, { $set: { paymentId: p._id } });
  const event = {
    id: `evt_${eventId}`,
    type: "payment_intent.succeeded",
    livemode: false,
    data: {
      object: {
        id: p.stripeId,
        status: "succeeded",
        amount_received: Math.round(p.amount * 100),
        currency: p.currency.toLowerCase(),
        metadata: { paymentId: p.id, bookingId: b.id },
      },
    },
  } as unknown as Stripe.Event;
  await payments.processEvent(event);
  return { payment: p, event };
}
beforeAll(async () => {
  process.env.NODE_ENV = "test";
  process.env.JWT_SECRET = "integration-test-secret-at-least-32-characters";
  process.env.ENABLE_JOBS = "false";
  process.env.ENABLE_EMAIL_BONUS = "false";
  process.env.ADMIN_EMAIL = "admin@example.test";
  process.env.ADMIN_PASSWORD = password;
  process.env.STRIPE_SECRET_KEY = "";
  process.env.STORAGE_PATH = "./.test-data/media";
  if (process.env.TEST_TMP_DIR) {
    const root = resolve(process.env.TEST_TMP_DIR);
    await mkdir(root, { recursive: true });
    testDbPath = await mkdtemp(resolve(root, "travel-test-"));
    if (
      !testDbPath.startsWith(root + "\\") &&
      !testDbPath.startsWith(root + "/")
    )
      throw new Error("Test directory escaped its configured root");
  }
  repl = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
    binary: { version: "8.2.6" },
    ...(testDbPath ? { instanceOpts: [{ dbPath: testDbPath }] } : {}),
  });
  process.env.MONGODB_URI = repl.getUri("travel_test");
  const result = await createApp({ logger: false });
  app = result.app;
  coverageReport = apiCoverage(result.document, app.getHttpServer());
  db = app.get(Db);
  payments = app.get(PaymentsService);
  inventory = app.get(Inventory);
  await seedReference(db);
  await seedReference(db);
  await seedAdmin(db);
  users.admin = await login("admin@example.test");
  for (const key of ["a", "b", "c"]) {
    expect(
      (
        await send(
          "post",
          "/auth/register",
          undefined,
          traveler(`${key}@example.test`),
        )
      ).status,
    ).toBe(201);
    users[key] = await login(`${key}@example.test`);
  }
  airline = (
    await send("post", "/airlines", users.admin, {
      name: "Test Airways",
      code: "TEST",
    })
  ).body;
  hotel = (
    await send("post", "/hotels", users.admin, {
      name: "Test Hotel",
      address: "Cairo",
      city: "cairo",
      country: "EG",
      description: "Integration test",
      starClass: 4,
      amenities: ["WiFi"],
      timezone: "Africa/Cairo",
    })
  ).body;
  for (const [key, role, provider] of [
    ["air", "AirlineModerator", airline],
    ["hotel", "HotelModerator", hotel],
  ] as const) {
    const r = await send("post", "/admin/moderators", users.admin, {
      name: key,
      email: `${key}@example.test`,
      role,
      providerId: provider._id,
      temporaryPassword: password,
    });
    expect(r.status).toBe(201);
    await db
      .model("User")
      .updateOne({ _id: r.body.id }, { $set: { forcePasswordChange: false } });
    users[key] = await login(`${key}@example.test`);
  }
  flight = await makeFlight("TEST100");
  returnFlight = await db.model("Flight").create({
    airlineId: airline._id,
    flightNumber: "TEST101",
    departureAirport: "DXB",
    arrivalAirport: "CAI",
    departureDate: end,
    departureAt: DateTime.fromISO(end).plus({ hours: 12 }).toJSDate(),
    arrivalAt: DateTime.fromISO(end).plus({ hours: 15 }).toJSDate(),
    cabins: [
      {
        category: "Economy",
        capacity: 10,
        price: 100,
        freeBags: 1,
        bagWeightKg: 23,
      },
    ],
  });
  room = await db.model("Room").create({
    hotelId: hotel._id,
    number: "101",
    type: "Double",
    beds: 2,
    occupancy: 3,
    price: 50,
    availability: [
      { start, end: DateTime.fromISO(end).plus({ days: 20 }).toISODate() },
    ],
  });
  room2 = await db.model("Room").create({
    hotelId: hotel._id,
    number: "102",
    type: "Double",
    beds: 2,
    occupancy: 3,
    price: 70,
    availability: [
      { start, end: DateTime.fromISO(end).plus({ days: 20 }).toISODate() },
    ],
  });
  await mkdir(resolve("../docs/api"), { recursive: true });
  await writeFile(
    resolve("../docs/api/openapi.json"),
    JSON.stringify(result.document, null, 2),
  );
}, 180000);
afterAll(async () => {
  if (coverageReport) {
    await mkdir(resolve("../docs/milestone-1/evidence"), { recursive: true });
    await writeFile(
      resolve("../docs/milestone-1/evidence/api-route-coverage.json"),
      JSON.stringify(coverageReport(), null, 2),
    );
  }
  await app?.close();
  await repl?.stop();
  if (testDbPath) await rm(testDbPath, { recursive: true, force: true });
});

describe("Boundary, provider and integration adapter regressions", () => {
  test("requirements audit: partial updates preserve profile identity, room status and itinerary visibility", async () => {
    const before = await send("get", "/users/me", users.a);
    const profile = await send("patch", "/users/me", users.a, {
      phone: "+201000000000",
    });
    expect(profile.status).toBe(200);
    expect(profile.body.name).toBe(before.body.name);
    expect(profile.body.preferredCurrency).toBe(before.body.preferredCurrency);
    expect(
      (await send("patch", "/users/me", users.a, { preferredCurrency: null }))
        .status,
    ).toBe(400);
    const room = await send("post", `/hotels/${hotel._id}/rooms`, users.hotel, {
      number: "AUDITPATCH",
      type: "Single",
      beds: 1,
      occupancy: 1,
      price: 60,
    });
    const edited = await send(
      "patch",
      `/hotels/${hotel._id}/rooms/${room.body._id}`,
      users.hotel,
      { price: 61 },
    );
    expect(edited.status).toBe(200);
    expect(edited.body.active).toBe(true);
    const itinerary = await send("post", "/itineraries", users.a, {
      title: "Original title",
      countries: ["EG"],
      startDate: start,
    });
    await send("patch", `/itineraries/${itinerary.body._id}`, users.a, {
      visibility: "Public",
    });
    const renamed = await send(
      "patch",
      `/itineraries/${itinerary.body._id}`,
      users.a,
      { title: "Renamed" },
    );
    expect(renamed.status).toBe(200);
    expect(renamed.body.visibility).toBe("Public");
  });
  test("requirements audit: search and booking allow ten seated passengers when inventory permits", async () => {
    const f = await makeFlight("GROUPTEN", 12);
    const search = await send(
      "get",
      `/flights/search?departureAirport=CAI&arrivalAirport=DXB&departureDate=${start}&adults=10`,
    );
    expect(search.status).toBe(200);
    expect(search.body.items.some((item: any) => item.flightId === f.id)).toBe(
      true,
    );
    const dto = flightDto(f.id);
    dto.passengers = Array.from({ length: 10 }, (_, i) => ({
      fullName: `Traveler ${i + 1}`,
      dateOfBirth: "1990-01-01",
      identityNumber: `GROUP${i + 1}`,
      type: "adult",
      extraBags: 0,
    }));
    const hold = await send("post", "/flight-bookings/hold", users.a, dto);
    expect(hold.status).toBe(201);
    expect((await db.get("Flight", f.id)).cabins[0].held).toBe(10);
  });
  test("requirements audit: hotel detail and review list label a deactivated reviewer consistently", async () => {
    await send(
      "post",
      "/auth/register",
      undefined,
      traveler("review-deactivate@example.test"),
    );
    const user = await login("review-deactivate@example.test");
    const b = await db.model("Booking").create({
      type: "hotel",
      userId: oidUser(user),
      providerIds: [hotel._id],
      status: "Completed",
      amount: 100,
      currency: "USD",
      snapshot: { hotelId: hotel._id },
      policySnapshot: {},
      startsAt: new Date(Date.now() - 3 * 86400000),
      endsAt: new Date(Date.now() - 86400000),
    });
    const review = await send("post", `/hotel-bookings/${b.id}/review`, user, {
      rating: 5,
      body: "Audit review",
    });
    expect(review.status).toBe(201);
    try {
      expect(
        (await send("delete", "/users/me", user, { confirm: true })).status,
      ).toBe(200);
      const details = await send("get", `/hotels/${hotel._id}`);
      const detailReview = details.body.reviews.items.find(
        (r: any) => r._id === review.body._id,
      );
      expect(detailReview.author).toEqual(
        expect.objectContaining({ id: null, name: "Deleted user" }),
      );
      const listed = await send("get", `/hotels/${hotel._id}/reviews`);
      expect(
        listed.body.items.find((r: any) => r._id === review.body._id).author
          .name,
      ).toBe("Deleted user");
    } finally {
      await send(
        "delete",
        `/admin/content/review/${review.body._id}`,
        users.admin,
        { confirm: true },
      );
    }
  });
  test("flight/hotel search preserves filters, supports round trips and excludes unrated hotels", async () => {
    const flightQuery = `departureAirport=CAI&arrivalAirport=DXB&departureDate=${start}&adults=1&minPrice=100&maxPrice=100`;
    const search = await send("get", `/flights/search?${flightQuery}`);
    expect(search.status).toBe(200);
    expect(search.body.items.length).toBeGreaterThan(0);
    expect(search.body.items.every((f: any) => f.price === 100)).toBe(true);
    const round = await send(
      "get",
      `/flights/search?${flightQuery}&returnDate=${end}`,
    );
    expect(round.status).toBe(200);
    expect(round.body.return.total).toBeGreaterThan(0);
    expect(
      (
        await send(
          "get",
          `/flights/search?departureAirport=CAI&arrivalAirport=DXB&departureDate=${start}&minPrice=200&maxPrice=100`,
        )
      ).status,
    ).toBe(400);
    const hotelQuery = `destination=Cairo&checkIn=${start}&checkOut=${end}&guests=6&rooms=2`;
    expect((await send("get", `/hotels/search?${hotelQuery}`)).body.total).toBe(
      1,
    );
    expect(
      (await send("get", `/hotels/search?${hotelQuery}&minRating=1`)).body
        .total,
    ).toBe(0);
    expect(
      (
        await send(
          "get",
          `/hotels/search?destination=Cairo&checkIn=${end}&checkOut=${start}`,
        )
      ).status,
    ).toBe(400);
  });
  test("provider creation validates reference relationships, timezone, duplicates and assignment boundaries", async () => {
    const dto = {
      airlineId: airline._id,
      flightNumber: "APITEST",
      departureAirport: "CAI",
      arrivalAirport: "DXB",
      departureLocal: `${start}T10:00`,
      arrivalLocal: `${start}T16:00`,
    };
    expect((await send("post", "/flights", users.air, dto)).status).toBe(201);
    expect((await send("post", "/flights", users.air, dto)).status).toBe(409);
    expect(
      (
        await send("post", "/flights", users.air, {
          ...dto,
          flightNumber: "BAD",
          arrivalAirport: "CAI",
        })
      ).status,
    ).toBe(400);
    const other = await send("post", "/airlines", users.admin, {
      name: "Other Airline",
      code: "OTHER",
    });
    expect(
      (
        await send("post", "/flights", users.air, {
          ...dto,
          airlineId: other.body._id,
        })
      ).status,
    ).toBe(403);
    expect((await send("post", "/flights", users.hotel, dto)).status).toBe(403);
    expect(
      (
        await send("post", "/hotels", users.admin, {
          name: "Invalid Hotel",
          address: "X",
          city: "cairo",
          country: "US",
          description: "",
          starClass: 3,
          amenities: [],
          timezone: "invalid",
        })
      ).status,
    ).toBe(400);
  });
  test("policy snapshots and prices survive edits; user cancellation applies the original tier once", async () => {
    await send(
      "put",
      `/airlines/${airline._id}/cancellation-policy`,
      users.air,
      {
        tiers: [
          { threshold: 0, refundPercent: 0 },
          { threshold: 7, refundPercent: 75 },
        ],
      },
    );
    const f = await makeFlight("TIER", 2);
    const hold = await send(
      "post",
      "/flight-bookings/hold",
      users.a,
      flightDto(f.id),
    );
    await markPaid(hold.body._id);
    await send(
      "put",
      `/airlines/${airline._id}/cancellation-policy`,
      users.air,
      { tiers: [{ threshold: 0, refundPercent: 0 }] },
    );
    await send(
      "patch",
      `/flights/${f.id}/cabins/${f.cabins[0]._id}`,
      users.air,
      { price: 200 },
    );
    expect((await db.get("Booking", hold.body._id)).amount).toBe(100);
    expect(
      (
        await send(
          "get",
          `/flight-bookings/${hold.body._id}/cancellation-quote`,
          users.a,
        )
      ).body.amount,
    ).toBe(75);
    expect(
      (
        await send(
          "post",
          `/flight-bookings/${hold.body._id}/cancel`,
          users.a,
          { confirm: true },
        )
      ).status,
    ).toBe(201);
    await send("post", `/flight-bookings/${hold.body._id}/cancel`, users.a, {
      confirm: true,
    });
    expect(
      await db.model("Refund").countDocuments({ bookingId: hold.body._id }),
    ).toBe(1);
  });
  test("policy acceptance, PaymentIntent creation/retry and signed HTTP webhooks work through the adapter", async () => {
    const f = await makeFlight("SIGNED", 3);
    const hold = await send(
      "post",
      "/flight-bookings/hold",
      users.a,
      flightDto(f.id),
    );
    const stripe = new Stripe("sk_test_fixture_not_a_real_credential");
    const configured = jest
      .spyOn(payments, "configured")
      .mockReturnValue(stripe);
    let intent: any;
    const create = jest
      .spyOn(stripe.paymentIntents, "create")
      .mockImplementation(async (params: any) => {
        intent = {
          id: "pi_signed_fixture",
          amount: params.amount,
          currency: params.currency,
          status: "requires_payment_method",
          metadata: params.metadata,
          client_secret: "fixture_client_secret",
        };
        return intent;
      });
    jest
      .spyOn(stripe.paymentIntents, "retrieve")
      .mockImplementation(async () => intent);
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_fixture_not_a_real_credential";
    try {
      expect(
        (
          await send("post", "/payments", users.a, {
            type: "flight",
            bookingId: hold.body._id,
          })
        ).status,
      ).toBe(400);
      expect(
        (
          await send(
            "post",
            `/bookings/flight/${hold.body._id}/accept-policies`,
            users.a,
            { confirm: true },
          )
        ).status,
      ).toBe(201);
      const created = await send("post", "/payments", users.a, {
        type: "flight",
        bookingId: hold.body._id,
      });
      expect(created.status).toBe(201);
      expect(created.body.clientSecret).toBe("fixture_client_secret");
      expect(
        (
          await send(
            "post",
            `/payments/${created.body.paymentId}/retry`,
            users.a,
          )
        ).status,
      ).toBe(201);
      expect(create).toHaveBeenCalledTimes(1);
      const payload = JSON.stringify({
        id: "evt_http_signed",
        type: "payment_intent.succeeded",
        livemode: false,
        data: {
          object: {
            ...intent,
            status: "succeeded",
            amount_received: intent.amount,
          },
        },
      });
      expect(
        (
          await request(app.getHttpServer())
            .post("/api/payments/webhook")
            .set("Content-Type", "application/json")
            .set("stripe-signature", "invalid")
            .send(payload)
        ).status,
      ).toBe(400);
      const signature = stripe.webhooks.generateTestHeaderString({
        payload,
        secret: process.env.STRIPE_WEBHOOK_SECRET,
      });
      expect(
        (
          await request(app.getHttpServer())
            .post("/api/payments/webhook")
            .set("Content-Type", "application/json")
            .set("stripe-signature", signature)
            .send(payload)
        ).status,
      ).toBe(201);
      expect((await db.get("Booking", hold.body._id)).status).toBe("Confirmed");
    } finally {
      configured.mockRestore();
      delete process.env.STRIPE_WEBHOOK_SECRET;
    }
  });
  test("higher-fare changes hold new inventory while preserving the original until payment", async () => {
    const original = await makeFlight("CHANGEOLD", 3),
      replacement = await makeFlight("CHANGENEW", 3, 2);
    replacement.cabins[0].price = 130;
    await replacement.save();
    const hold = await send(
      "post",
      "/flight-bookings/hold",
      users.a,
      flightDto(original.id),
    );
    await markPaid(hold.body._id);
    const change = await send(
      "patch",
      `/flight-bookings/${hold.body._id}/change-flight`,
      users.a,
      { segments: [{ flightId: replacement.id, cabin: "Economy" }] },
    );
    expect(change.status).toBe(200);
    expect(change.body.status).toBe("Pending Payment");
    expect((await db.get("Flight", original.id)).cabins[0].booked).toBe(1);
    expect((await db.get("Flight", replacement.id)).cabins[0].held).toBe(1);
    const b = await db.get("Booking", hold.body._id);
    const stripe = new Stripe("sk_test_fixture_not_a_real_credential");
    const configured = jest
      .spyOn(payments, "configured")
      .mockReturnValue(stripe);
    jest.spyOn(stripe.paymentIntents, "create").mockImplementation(
      async (params: any) =>
        ({
          id: "pi_change_fixture",
          status: "requires_payment_method",
          client_secret: "fixture_secret",
          metadata: params.metadata,
        }) as any,
    );
    let p: any;
    try {
      expect(
        (
          await send(
            "post",
            `/flight-changes/${change.body._id}/payment`,
            users.a,
          )
        ).status,
      ).toBe(400);
      expect(
        (
          await send(
            "get",
            `/flight-changes/${change.body._id}/policies`,
            users.a,
          )
        ).status,
      ).toBe(200);
      expect(
        (
          await send(
            "post",
            `/flight-changes/${change.body._id}/accept-policies`,
            users.a,
            { confirm: true },
          )
        ).status,
      ).toBe(201);
      const created = await send(
        "post",
        `/flight-changes/${change.body._id}/payment`,
        users.a,
      );
      expect(created.status).toBe(201);
      p = await db.get("Payment", created.body.paymentId);
    } finally {
      configured.mockRestore();
    }
    await payments.processEvent({
      id: "evt_change_fixture",
      type: "payment_intent.succeeded",
      livemode: false,
      data: {
        object: {
          id: p.stripeId,
          status: "succeeded",
          amount_received: 3000,
          currency: "usd",
          metadata: { bookingId: b.id, paymentId: p.id },
        },
      },
    } as unknown as Stripe.Event);
    expect((await db.get("Booking", b.id)).amount).toBe(130);
    expect((await db.get("Flight", original.id)).cabins[0].booked).toBe(0);
    expect((await db.get("Flight", replacement.id)).cabins[0].booked).toBe(1);
    const third = await makeFlight("CHANGEAGAIN", 3, 3);
    third.cabins[0].price = 160;
    await third.save();
    const again = await send(
      "patch",
      `/flight-bookings/${b.id}/change-flight`,
      users.a,
      { segments: [{ flightId: third.id, cabin: "Economy" }] },
    );
    expect(again.status).toBe(200);
    const secondPayment = await db.model("Payment").create({
      bookingId: b._id,
      userId: b.userId,
      purpose: "change",
      changeId: again.body._id,
      amount: 30,
      currency: "USD",
      stripeId: "pi_change_again_fixture",
      status: "Pending",
    });
    await payments.processEvent({
      id: "evt_change_again_fixture",
      type: "payment_intent.succeeded",
      livemode: false,
      data: {
        object: {
          id: secondPayment.stripeId,
          status: "succeeded",
          amount_received: 3000,
          currency: "usd",
          metadata: { bookingId: b.id, paymentId: secondPayment.id },
        },
      },
    } as unknown as Stripe.Event);
    expect((await db.get("Booking", b.id)).amount).toBe(160);
    expect((await db.get("Flight", third.id)).cabins[0].booked).toBe(1);
  });
  test("refund failures remain recorded and a retry succeeds without a duplicate refund", async () => {
    const r = await db.model("Refund").findOne({ status: "Pending" });
    expect(r).toBeTruthy();
    const stripe = new Stripe("sk_test_fixture_not_a_real_credential");
    const configured = jest
      .spyOn(payments, "configured")
      .mockReturnValue(stripe);
    const create = jest
      .spyOn(stripe.refunds, "create")
      .mockRejectedValueOnce(new Error("temporary provider outage"))
      .mockResolvedValue({ id: "re_fixture", status: "succeeded" } as any);
    try {
      await expect(payments.refundWork(r.id)).rejects.toThrow("outage");
      expect((await db.get("Refund", r.id)).status).toBe("Failed");
      await payments.refundWork(r.id);
      await payments.refundWork(r.id);
      expect(create).toHaveBeenCalledTimes(2);
      expect((await db.get("Refund", r.id)).status).toBe("Refunded");
    } finally {
      configured.mockRestore();
    }
  });
  test("outbox reclaims interrupted work and retries later after failures", async () => {
    const jobs = app.get(Jobs);
    const ops = app.get(Ops);
    await db
      .model("Outbox")
      .updateMany(
        {},
        { $set: { nextAttemptAt: new Date(Date.now() + 3600000) } },
      );
    const mail = await db.model("Outbox").create({
      key: "mail-recovery-fixture",
      kind: "email",
      payload: {
        to: "test@example.test",
        subject: "Recovery",
        text: "Fixture",
      },
      state: "Running",
      leaseUntil: new Date(Date.now() - 1000),
    });
    const sendMail = jest
      .spyOn(ops, "sendMail")
      .mockRejectedValueOnce(new Error("temporary SMTP outage"))
      .mockResolvedValue(undefined);
    try {
      await jobs.drain(1);
      let stored = await db.get("Outbox", mail.id);
      expect(stored.state).toBe("Pending");
      expect(stored.attempts).toBe(1);
      await db
        .model("Outbox")
        .updateOne(
          { _id: mail._id },
          { $set: { nextAttemptAt: new Date(Date.now() - 1) } },
        );
      await jobs.drain(1);
      stored = await db.get("Outbox", mail.id);
      expect(stored.state).toBe("Done");
      expect(stored.attempts).toBe(2);
    } finally {
      sendMail.mockRestore();
    }
  });
  test("deactivated providers disappear from search while confirmed bookings remain valid", async () => {
    const f = await makeFlight("PROVIDERSTATE", 2);
    const hold = await send(
      "post",
      "/flight-bookings/hold",
      users.a,
      flightDto(f.id),
    );
    await markPaid(hold.body._id);
    await send(
      "patch",
      `/admin/providers/airline/${airline._id}/deactivate`,
      users.admin,
    );
    const found = await send(
      "get",
      `/flights/search?departureAirport=CAI&arrivalAirport=DXB&departureDate=${start}`,
    );
    expect(found.body.total).toBe(0);
    expect((await db.get("Booking", hold.body._id)).status).toBe("Confirmed");
    await send(
      "patch",
      `/admin/providers/airline/${airline._id}/reactivate`,
      users.admin,
    );
  });
  test("email verification blocks booking until a valid single-use link is consumed", async () => {
    process.env.ENABLE_EMAIL_BONUS = "true";
    try {
      const r = await send(
        "post",
        "/auth/register",
        undefined,
        traveler("verify@example.test"),
      );
      expect(r.status).toBe(201);
      let user = await login("verify@example.test");
      const f = await makeFlight("VERIFY", 2);
      expect(
        (await send("post", "/flight-bookings/hold", user, flightDto(f.id)))
          .status,
      ).toBe(403);
      const mail = await db
        .model("Outbox")
        .findOne({ key: `verify:${r.body.id}` });
      const raw = mail.payload.text.split("token=")[1];
      expect(
        (await send("get", `/auth/verify-email?token=${raw}`)).status,
      ).toBe(200);
      expect(
        (await send("get", `/auth/verify-email?token=${raw}`)).status,
      ).toBe(400);
      user = await login("verify@example.test");
      expect(
        (await send("post", "/flight-bookings/hold", user, flightDto(f.id)))
          .status,
      ).toBe(201);
    } finally {
      process.env.ENABLE_EMAIL_BONUS = "false";
    }
  });
  test("list pagination is ten rows and whitespace-only community input is rejected", async () => {
    for (let i = 0; i < 11; i++)
      await send("post", "/posts", users.a, {
        title: `Page test ${i}`,
        body: "Pagination example",
        status: "Published",
        tags: ["pagination"],
      });
    const one = await send("get", "/posts?tag=pagination"),
      two = await send("get", "/posts?tag=pagination&page=2");
    expect(one.body.items).toHaveLength(10);
    expect(two.body.items).toHaveLength(1);
    expect(one.body.total).toBe(11);
    expect(
      (await send("post", "/posts", users.a, { title: "   ", body: "Body" }))
        .status,
    ).toBe(400);
  });
  test("upcoming confirmed bookings block deactivation; deactivated authors disappear and comments are anonymized", async () => {
    expect(
      (await send("delete", "/users/me", users.a, { confirm: true })).status,
    ).toBe(400);
    await send(
      "post",
      "/auth/register",
      undefined,
      traveler("deactivate@example.test"),
    );
    const user = await login("deactivate@example.test");
    const p = await send("post", "/posts", user, {
      title: "Soon hidden",
      body: "Author deactivation",
      status: "Published",
    });
    const shared = await send("post", "/posts", users.a, {
      title: "Active author",
      body: "Comments remain",
      status: "Published",
    });
    await send("post", `/posts/${shared.body._id}/comments`, user, {
      body: "A comment",
    });
    const i = await send("post", "/itineraries", user, {
      title: "Public trip",
      countries: ["EG"],
      startDate: start,
    });
    await send("patch", `/itineraries/${i.body._id}`, user, {
      visibility: "Public",
    });
    expect(
      (await send("delete", "/users/me", user, { confirm: true })).status,
    ).toBe(200);
    expect((await send("get", `/posts/${p.body._id}`)).status).toBe(404);
    expect(
      (await send("get", `/itineraries/public/${i.body._id}`)).status,
    ).toBe(404);
    expect(
      (await send("get", `/posts/${shared.body._id}`)).body.comments.items[0]
        .author.name,
    ).toBe("Deleted user");
    expect(
      (
        await send("post", "/auth/login", undefined, {
          email: "deactivate@example.test",
          password,
        })
      ).status,
    ).toBe(401);
  });
  test("itinerary day limit, invalid reorder and nested ownership are enforced", async () => {
    const itinerary = await send("post", "/itineraries", users.a, {
      title: "Sixty days",
      countries: ["EG"],
      startDate: start,
    });
    const days = Array.from({ length: 60 }, () => ({
      _id: new Types.ObjectId(),
      city: "cairo",
      activities: [],
      budgets: [],
    }));
    await db
      .model("Itinerary")
      .updateOne({ _id: itinerary.body._id }, { $set: { days } });
    expect(
      (
        await send("post", `/itineraries/${itinerary.body._id}/days`, users.a, {
          city: "cairo",
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await send(
          "patch",
          `/itineraries/${itinerary.body._id}/days/reorder`,
          users.a,
          { dayIds: [String(days[0]._id)] },
        )
      ).status,
    ).toBe(400);
    users.b = await login("b@example.test");
    expect(
      (
        await send(
          "patch",
          `/itineraries/${itinerary.body._id}/days/${days[0]._id}`,
          users.b,
          { notes: "Cross-user edit" },
        )
      ).status,
    ).toBe(403);
  });
  test("completion and expiry workers are restart-safe and release completed hotel allocations", async () => {
    const b = await db.model("Booking").create({
      type: "hotel",
      userId: oidUser(users.a),
      providerIds: [hotel._id],
      status: "Confirmed",
      reference: "WORKER-FIXTURE",
      amount: 100,
      currency: "USD",
      startsAt: new Date(Date.now() - 5 * 86400000),
      endsAt: new Date(Date.now() - 2 * 86400000),
      snapshot: {
        hotelId: hotel._id,
        checkIn: "2020-01-01",
        checkOut: "2020-01-02",
        timezone: "Africa/Cairo",
      },
      policySnapshot: {},
    });
    await db
      .model("RoomNight")
      .create({ roomId: room._id, date: "2020-01-01", bookingId: b._id });
    const service = app.get(Jobs).bookings;
    await service.complete();
    await service.complete();
    expect((await db.get("Booking", b.id)).status).toBe("Completed");
    expect(
      await db.model("RoomNight").countDocuments({ bookingId: b._id }),
    ).toBe(0);
  });
  test("room availability/status endpoints paginate and analytics exposes separate financial totals", async () => {
    for (let i = 0; i < 11; i++)
      await db.model("Room").create({
        hotelId: hotel._id,
        number: `PAGE${i}`,
        type: "Single",
        beds: 1,
        occupancy: 1,
        price: 60,
        availability: [{ start, end }],
      });
    const available = await send(
      "get",
      `/hotels/${hotel._id}/rooms/available?checkIn=${start}&checkOut=${end}`,
    );
    expect(available.status).toBe(200);
    expect(available.body.items).toHaveLength(10);
    expect(available.body.total).toBeGreaterThan(10);
    const second = await send(
      "get",
      `/hotels/${hotel._id}/rooms/available?checkIn=${start}&checkOut=${end}&page=2`,
    );
    expect(second.body.items.length).toBeGreaterThan(0);
    const status = await send(
      "get",
      `/hotels/${hotel._id}/availability?start=${start}&end=${end}`,
      users.hotel,
    );
    expect(status.status).toBe(200);
    expect(status.body.items).toHaveLength(10);
    const from = DateTime.now().minus({ days: 1 }).toISODate();
    const to = DateTime.now().plus({ days: 1 }).toISODate();
    const report = await send(
      "get",
      `/admin/analytics?from=${from}&to=${to}`,
      users.admin,
    );
    expect(report.status).toBe(200);
    expect(report.body.items[0]).toHaveProperty("grossPayments");
    expect(report.body.items[0]).toHaveProperty("refunds");
    expect(report.body.items[0]).toHaveProperty("netRevenue");
  });
  test("linked booking budgets count once, clones copy costs without private IDs, and blog attachments respect visibility", async () => {
    const booking = await db.model("Booking").findOne({
      userId: oidUser(users.a),
      type: "flight",
      status: "Confirmed",
    });
    expect(booking).toBeTruthy();
    const itinerary = await send("post", "/itineraries", users.a, {
      title: "Linked booking",
      countries: ["EG"],
      startDate: start,
    });
    const id = itinerary.body._id;
    const day = await send("post", `/itineraries/${id}/days`, users.a, {
      city: "cairo",
    });
    const link = { bookingId: booking.id, dayId: day.body.days[0]._id };
    expect(
      (await send("post", `/itineraries/${id}/bookings`, users.a, link)).status,
    ).toBe(201);
    expect(
      (await send("post", `/itineraries/${id}/bookings`, users.a, link)).status,
    ).toBe(400);
    expect(
      (await send("get", `/itineraries/${id}/budget-summary`, users.a)).body
        .total,
    ).toBe(booking.amount);
    await send("patch", `/itineraries/${id}`, users.a, {
      visibility: "Public",
    });
    const clone = await send("post", `/itineraries/${id}/clone`, users.b);
    expect(clone.status).toBe(201);
    expect(clone.body.bookingLinks).toHaveLength(0);
    expect(
      (
        await send(
          "get",
          `/itineraries/${clone.body._id}/budget-summary`,
          users.b,
        )
      ).body.total,
    ).toBe(booking.amount);
    expect(
      (await send("get", `/itineraries/public/${id}`)).body,
    ).not.toHaveProperty("bookingLinks");
    const post = await send("post", "/posts", users.a, {
      title: "Attached trip",
      body: "Read my itinerary",
      status: "Published",
    });
    expect(
      (
        await send("patch", `/posts/${post.body._id}/itinerary`, users.a, {
          itineraryId: id,
        })
      ).status,
    ).toBe(200);
    expect(
      (await send("get", `/posts/${post.body._id}`)).body.attachedItinerary.id,
    ).toBe(id);
    await send("patch", `/itineraries/${id}`, users.a, {
      visibility: "Private",
    });
    expect(
      (await send("get", `/posts/${post.body._id}`)).body.attachedItinerary,
    ).toBeNull();
  });
});

describe("HTTP contracts and account security", () => {
  test("Swagger/OpenAPI and official reference records are available", async () => {
    expect((await send("get", "/docs")).status).toBe(200);
    const api = await send("get", "/openapi.json");
    expect(api.status).toBe(200);
    expect(Object.keys(api.body.paths).length).toBeGreaterThan(100);
    expect((await send("get", "/airports")).body.total).toBe(8);
    expect(await db.model("Country").countDocuments()).toBe(8);
  });
  test("registration rejects duplicates, invalid passwords, missing consent, extra role and query operators", async () => {
    expect(
      (
        await send(
          "post",
          "/auth/register",
          undefined,
          traveler("a@example.test"),
        )
      ).status,
    ).toBe(409);
    for (const change of [
      { password: "weak" },
      { consent: false },
      { role: "Admin" },
      { email: { $ne: "" } },
    ])
      expect(
        (
          await send("post", "/auth/register", undefined, {
            ...traveler("invalid@example.test"),
            ...change,
          })
        ).status,
      ).toBe(400);
  });
  test("Swagger error examples match each documented response status", async () => {
    const document = (await send("get", "/openapi.json")).body;
    for (const item of Object.values(document.paths) as any[])
      for (const operation of Object.values(item) as any[])
        for (const code of [400, 401, 403, 404, 409, 500, 503]) {
          const example =
            operation.responses[code].content["application/json"].example;
          expect(example.statusCode).toBe(code);
          if (code !== 400) expect(example.errors).toBeUndefined();
        }
  });
  test("cookies are secure and httpOnly; CSRF and roles are enforced", async () => {
    const r = await send("post", "/auth/login", undefined, {
      email: "a@example.test",
      password,
    });
    const cookies = r.headers["set-cookie"] as unknown as string[];
    expect(cookies.find((c) => c.startsWith("access_token="))).toMatch(
      /HttpOnly; Secure; SameSite=Lax/,
    );
    expect(
      (
        await request(app.getHttpServer())
          .patch("/api/users/me")
          .set("Cookie", users.a.cookie)
          .send({ name: "No CSRF" })
      ).status,
    ).toBe(403);
    expect((await send("get", "/admin/accounts", users.a)).status).toBe(403);
    expect((await send("get", "/users/me")).status).toBe(401);
    expect(
      (await send("patch", "/users/me", users.a, { preferredCurrency: "XYZ" }))
        .status,
    ).toBe(400);
  });
  test("five failures lock the account; success after expiry resets the counter", async () => {
    await send(
      "post",
      "/auth/register",
      undefined,
      traveler("lock@example.test"),
    );
    for (let i = 0; i < 5; i++)
      expect(
        (
          await send("post", "/auth/login", undefined, {
            email: "lock@example.test",
            password: "wrong",
          })
        ).status,
      ).toBe(401);
    const blocked = await send("post", "/auth/login", undefined, {
      email: "lock@example.test",
      password,
    });
    expect(blocked.body.message).toContain("locked");
    await db
      .model("User")
      .updateOne(
        { email: "lock@example.test" },
        { $set: { lockedUntil: new Date(Date.now() - 1000) } },
      );
    await login("lock@example.test");
    expect(
      (await db.model("User").findOne({ email: "lock@example.test" }))
        .failedLogins,
    ).toBe(0);
  });
  test("idle sessions, suspension, forced resets, logout and refresh rotation are server-enforced", async () => {
    const idle = await login("c@example.test");
    const session = await db
      .model("Session")
      .findOne({ userId: oidUser(idle), revokedAt: { $exists: false } })
      .sort({ createdAt: -1 });
    await db
      .model("Session")
      .updateOne(
        { _id: session._id },
        { $set: { lastActiveAt: new Date(Date.now() - 31 * 60000) } },
      );
    expect((await send("get", "/auth/me", idle)).status).toBe(401);
    const fresh = await login("c@example.test");
    const refresh = await send("post", "/auth/refresh", fresh);
    expect(refresh.status).toBe(201);
    expect((await send("post", "/auth/refresh", fresh)).status).toBe(401);
    const logout = await login("c@example.test");
    expect((await send("post", "/auth/logout", logout)).status).toBe(201);
    expect((await send("get", "/auth/me", logout)).status).toBe(401);
    expect(
      (
        await send(
          "patch",
          `/admin/accounts/${users.c.user.id}/suspend`,
          users.admin,
        )
      ).status,
    ).toBe(200);
    expect(
      (
        await send("post", "/auth/login", undefined, {
          email: "c@example.test",
          password,
        })
      ).body.message,
    ).toBe("account suspended");
    await send(
      "patch",
      `/admin/accounts/${users.c.user.id}/reactivate`,
      users.admin,
    );
    users.c = await login("c@example.test");
    await send(
      "post",
      `/admin/users/${users.c.user.id}/reset-password`,
      users.admin,
      { temporaryPassword: password },
    );
    users.c = await login("c@example.test");
    expect(
      (
        await send("post", "/itineraries", users.c, {
          title: "Blocked",
          countries: ["EG"],
          startDate: start,
        })
      ).status,
    ).toBe(403);
    await db
      .model("User")
      .updateOne(
        { _id: oidUser(users.c) },
        { $set: { forcePasswordChange: false } },
      );
  });
});
function oidUser(u: Login) {
  return new Types.ObjectId(u.user.id);
}

describe("Inventory transactions and payment races", () => {
  test("last-seat contention admits exactly one hold and rejects overselling", async () => {
    const f = await makeFlight("LASTSEAT", 1);
    const results = await Promise.all([
      send("post", "/flight-bookings/hold", users.a, flightDto(f.id)),
      send("post", "/flight-bookings/hold", users.b, flightDto(f.id)),
    ]);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(1);
    const stored = await db.get("Flight", f.id);
    expect(stored.cabins[0].held).toBe(1);
    expect(stored.cabins[0].booked).toBe(0);
  });
  test("round-trip holds are atomic when the return has no capacity", async () => {
    const f = await makeFlight("ROUNDOUT", 2);
    const rt = await db.get("Flight", returnFlight.id);
    rt.cabins[0].held = 10;
    await rt.save();
    const dto = flightDto(f.id);
    dto.segments.push({ flightId: returnFlight.id, cabin: "Economy" });
    expect(
      (await send("post", "/flight-bookings/hold", users.a, dto)).status,
    ).toBe(409);
    expect((await db.get("Flight", f.id)).cabins[0].held).toBe(0);
    rt.cabins[0].held = 0;
    await rt.save();
  });
  test("passenger age, baggage and inventory edits are validated", async () => {
    const dto = flightDto();
    dto.passengers[0].type = "infant";
    expect(
      (await send("post", "/flight-bookings/hold", users.a, dto)).status,
    ).toBe(400);
    const hold = await send(
      "post",
      "/flight-bookings/hold",
      users.a,
      flightDto(),
    );
    expect(hold.status).toBe(201);
    expect(
      (
        await send(
          "patch",
          `/flights/${flight.id}/cabins/${flight.cabins[0]._id}`,
          users.air,
          { capacity: 0 },
        )
      ).status,
    ).toBe(400);
    expect(
      (await send("get", `/flight-bookings/${hold.body._id}`, users.b)).status,
    ).toBe(403);
  });
  test("hotel room contention and all-or-nothing multi-room reservations", async () => {
    const results = await Promise.all([
      send("post", "/hotel-bookings", users.a, hotelDto()),
      send("post", "/hotel-bookings", users.b, hotelDto()),
    ]);
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect(results.filter((r) => r.status === 409)).toHaveLength(1);
    expect(
      (await send("post", "/hotel-bookings", users.a, hotelDto([room2, room])))
        .status,
    ).toBe(409);
    expect(
      await db.model("RoomNight").countDocuments({ roomId: room2._id }),
    ).toBe(0);
    const winner = results.find((r) => r.status === 201)!;
    await db
      .model("Booking")
      .updateOne(
        { _id: winner.body._id },
        { $set: { holdExpiresAt: new Date(Date.now() - 1) } },
      );
    await inventory.expireDue();
    expect(
      await db.model("RoomNight").countDocuments({ roomId: room._id }),
    ).toBe(0);
    const hold = await send(
      "post",
      "/hotel-bookings",
      users.a,
      hotelDto([room, room2]),
    );
    expect(hold.status).toBe(201);
    expect(
      await db
        .model("RoomNight")
        .countDocuments({ bookingId: new Types.ObjectId(hold.body._id) }),
    ).toBe(6);
    expect(
      (
        await send(
          "patch",
          `/hotels/${hotel._id}/rooms/${room._id}/availability`,
          users.hotel,
          { kind: "blocked", ranges: [{ start, end }] },
        )
      ).status,
    ).toBe(400);
    await db
      .model("Booking")
      .updateOne(
        { _id: hold.body._id },
        { $set: { holdExpiresAt: new Date(Date.now() - 1) } },
      );
    await inventory.expireDue();
  });
  test("adjacent hotel stays do not overlap", async () => {
    const a = await send("post", "/hotel-bookings", users.a, hotelDto());
    const dto = hotelDto();
    dto.checkIn = end;
    dto.checkOut = DateTime.fromISO(end).plus({ days: 2 }).toISODate()!;
    const b = await send("post", "/hotel-bookings", users.b, dto);
    expect(a.status).toBe(201);
    expect(b.status).toBe(201);
    await db
      .model("Booking")
      .updateMany(
        { _id: { $in: [a.body._id, b.body._id] } },
        { $set: { holdExpiresAt: new Date(Date.now() - 1) } },
      );
    await inventory.expireDue();
  });
  test("signed success confirms once; duplicate events preserve seat counts", async () => {
    const f = await makeFlight("PAID", 2);
    const hold = await send(
      "post",
      "/flight-bookings/hold",
      users.a,
      flightDto(f.id),
    );
    const { event } = await markPaid(hold.body._id);
    await payments.processEvent(event);
    const b = await db.get("Booking", hold.body._id);
    expect(b.status).toBe("Confirmed");
    expect(b.reference).toMatch(/^TRV-/);
    const stored = await db.get("Flight", f.id);
    expect(stored.cabins[0].booked).toBe(1);
    expect(stored.cabins[0].held).toBe(0);
    expect(
      await db.model("Notification").countDocuments({ key: `confirm:${b.id}` }),
    ).toBe(1);
    expect(
      (await send("get", `/flight-bookings/${b.id}/e-ticket`, users.a)).status,
    ).toBe(200);
  });
  test("expired success never resurrects inventory and creates a compensating refund once", async () => {
    const f = await makeFlight("LATE", 1);
    const hold = await send(
      "post",
      "/flight-bookings/hold",
      users.a,
      flightDto(f.id),
    );
    await db
      .model("Booking")
      .updateOne(
        { _id: hold.body._id },
        { $set: { holdExpiresAt: new Date(Date.now() - 1) } },
      );
    await inventory.expireDue();
    const { event } = await markPaid(hold.body._id);
    await payments.processEvent(event);
    expect((await db.get("Booking", hold.body._id)).status).toBe("Expired");
    expect((await db.get("Flight", f.id)).cabins[0].held).toBe(0);
    const refunds = await db.model("Refund").find({ bookingId: hold.body._id });
    expect(refunds).toHaveLength(1);
    expect(refunds[0].amount).toBe(100);
  });
  test("provider invalidation releases an unpaid hold once and only expires it at its deadline", async () => {
    const f = await makeFlight("INVALID-HOLD", 2);
    const hold = await send(
      "post",
      "/flight-bookings/hold",
      users.a,
      flightDto(f.id),
    );
    expect(hold.status).toBe(201);
    const deadline = +new Date(hold.body.holdExpiresAt);
    expect(
      (
        await send("post", `/flights/${f.id}/cancel`, users.air, {
          confirm: true,
        })
      ).status,
    ).toBe(201);
    let b = await db.get("Booking", hold.body._id);
    expect(b.status).toBe("Pending Payment");
    expect(+b.holdExpiresAt).toBe(deadline);
    expect(b.holdInvalidatedAt).toBeTruthy();
    expect((await db.get("Flight", f.id)).cabins[0].held).toBe(0);
    expect(
      (
        await send(
          "post",
          `/bookings/flight/${b.id}/accept-policies`,
          users.a,
          { confirm: true },
        )
      ).status,
    ).toBe(400);
    const stripe = new Stripe("sk_test_fixture_not_a_real_credential");
    const configured = jest
      .spyOn(payments, "configured")
      .mockReturnValue(stripe);
    try {
      expect(
        (
          await send("post", "/payments", users.a, {
            type: "flight",
            bookingId: b.id,
          })
        ).status,
      ).toBe(409);
    } finally {
      configured.mockRestore();
    }
    await send("post", `/flights/${f.id}/cancel`, users.air, { confirm: true });
    await inventory.expireDue();
    expect((await db.get("Booking", b.id)).status).toBe("Pending Payment");
    const { event } = await markPaid(b.id);
    await payments.processEvent(event);
    b = await db.get("Booking", b.id);
    expect(b.status).toBe("Pending Payment");
    expect((await db.get("Flight", f.id)).cabins[0].held).toBe(0);
    const refunds = await db.model("Refund").find({ bookingId: b._id });
    expect(refunds).toHaveLength(1);
    expect(refunds[0].amount).toBe(100);
    await db
      .model("Booking")
      .updateOne(
        { _id: b._id },
        { $set: { holdExpiresAt: new Date(Date.now() - 1000) } },
      );
    await inventory.expireDue();
    await inventory.expireDue();
    expect((await db.get("Booking", b.id)).status).toBe("Expired");
    expect((await db.get("Flight", f.id)).cabins[0].held).toBe(0);
  });
  test("wrong amount rolls back; provider cancellation releases inventory and refunds in full", async () => {
    const f = await makeFlight("CANCEL", 2);
    const hold = await send(
      "post",
      "/flight-bookings/hold",
      users.a,
      flightDto(f.id),
    );
    const b = await db.get("Booking", hold.body._id);
    const p = await db.model("Payment").create({
      bookingId: b._id,
      userId: b.userId,
      amount: 100,
      currency: "USD",
      stripeId: "pi_wrong",
      status: "Pending",
    });
    const wrong = {
      id: "evt_wrong",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: "pi_wrong",
          amount_received: 1,
          status: "succeeded",
          currency: "usd",
          metadata: { bookingId: b.id, paymentId: p.id },
        },
      },
    } as unknown as Stripe.Event;
    await expect(payments.processEvent(wrong)).rejects.toThrow("mismatch");
    expect((await db.get("Booking", b.id)).status).toBe("Pending Payment");
    await p.deleteOne();
    await markPaid(b.id);
    expect(
      (
        await send("post", `/flights/${f.id}/cancel`, users.air, {
          confirm: true,
        })
      ).status,
    ).toBe(201);
    expect((await db.get("Booking", b.id)).status).toBe("Cancelled");
    expect((await db.get("Flight", f.id)).cabins[0].booked).toBe(0);
    expect(
      (await db.model("Refund").findOne({ bookingId: b._id })).amount,
    ).toBe(100);
    await send("post", `/flights/${f.id}/cancel`, users.air, { confirm: true });
    expect(await db.model("Refund").countDocuments({ bookingId: b._id })).toBe(
      1,
    );
  });
  test("payment APIs fail explicitly without credentials and require ownership/policies", async () => {
    const hold = await send(
      "post",
      "/flight-bookings/hold",
      users.a,
      flightDto(),
    );
    expect(
      (
        await send("post", "/payments", users.a, {
          type: "flight",
          bookingId: hold.body._id,
        })
      ).status,
    ).toBe(503);
    expect(
      (await send("post", "/payments/webhook", undefined, {})).status,
    ).toBe(503);
  });
});

describe("Itineraries, privacy, community and bonuses", () => {
  test("itinerary ordering, currency totals, private access, cloning and deletion are consistent", async () => {
    await db.model("ExchangeRate").create({
      base: "USD",
      date: start,
      rates: { USD: 1, EGP: 50, EUR: 0.9 },
      fetchedAt: new Date(),
    });
    const created = await send("post", "/itineraries", users.a, {
      title: "Egypt trip",
      countries: ["EG"],
      startDate: start,
    });
    expect(created.status).toBe(201);
    const id = created.body._id;
    expect((await send("get", `/itineraries/${id}`, users.b)).status).toBe(404);
    let r = await send("post", `/itineraries/${id}/days`, users.a, {
      city: "cairo",
      notes: "First day",
    });
    expect(r.status).toBe(201);
    const first = r.body.days[0]._id;
    r = await send("post", `/itineraries/${id}/days`, users.a, {
      city: "cairo",
    });
    const second = r.body.days[1]._id;
    await send("post", `/itineraries/${id}/days/${first}/activities`, users.a, {
      name: "Museum",
      cost: 10,
      currency: "USD",
    });
    await send("post", `/itineraries/${id}/days/${first}/budgets`, users.a, {
      category: "Food",
      amount: 500,
      currency: "EGP",
    });
    let summary = await send(
      "get",
      `/itineraries/${id}/budget-summary`,
      users.a,
    );
    expect(summary.body.total).toBe(20);
    expect(summary.body.cityGroups[0].dayCount).toBe(2);
    r = await send("patch", `/itineraries/${id}/days/reorder`, users.a, {
      dayIds: [second, first],
    });
    expect(r.body.days[0]._id).toBe(second);
    expect(r.body.days[1].date).toBe(
      DateTime.fromISO(start).plus({ days: 1 }).toISODate(),
    );
    await send("patch", `/itineraries/${id}`, users.a, {
      visibility: "Public",
    });
    expect((await send("get", `/itineraries/public/${id}`)).status).toBe(200);
    const clone = await send("post", `/itineraries/${id}/clone`, users.b);
    expect(clone.status).toBe(201);
    expect(clone.body.visibility).toBe("Private");
    expect(clone.body.days[0]._id).not.toBe(second);
    expect((await send("get", `/itineraries/${id}/pdf`, users.a)).status).toBe(
      200,
    );
    await send("delete", `/itineraries/${id}`, users.a, { confirm: true });
    expect(
      (await send("get", `/itineraries/${clone.body._id}`, users.b)).status,
    ).toBe(200);
    summary = await send(
      "get",
      `/itineraries/${clone.body._id}/budget-summary`,
      users.b,
    );
    expect(summary.body.total).toBe(20);
  });
  test("blog drafts, tags, likes, own comments and reports enforce permissions", async () => {
    let r = await send("post", "/posts", users.a, {
      title: "Trip notes",
      body: "Hello Cairo",
      tags: ["Egypt"],
      status: "Draft",
    });
    const id = r.body._id;
    expect((await send("get", `/posts/${id}`)).status).toBe(404);
    await send("patch", `/posts/${id}`, users.a, { status: "Published" });
    expect(
      (await send("post", `/posts/${id}/like`, users.b)).body.likeCount,
    ).toBe(1);
    expect(
      (await send("post", `/posts/${id}/like`, users.b)).body.likeCount,
    ).toBe(1);
    r = await send("post", `/posts/${id}/comments`, users.b, {
      body: "Helpful!",
    });
    expect(r.status).toBe(201);
    expect(
      (
        await send("patch", `/comments/${r.body._id}`, users.a, {
          body: "Hijack",
        })
      ).status,
    ).toBe(403);
    const report = await send("post", "/reports", users.b, {
      contentType: "post",
      contentId: id,
      reason: "Test report",
    });
    expect(report.status).toBe(201);
    expect(
      (
        await send("post", "/reports", users.b, {
          contentType: "post",
          contentId: id,
          reason: "Duplicate",
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await send("patch", `/admin/reports/${report.body._id}`, users.admin, {
          action: "hide",
        })
      ).status,
    ).toBe(200);
    expect((await send("get", `/posts/${id}`)).status).toBe(404);
    expect((await send("get", `/posts/${id}`, users.a)).status).toBe(200);
    expect(
      await db.model("Audit").countDocuments({ action: "hide-content" }),
    ).toBeGreaterThan(0);
  });
  test("media follows parent privacy and clone images survive removal of the original", async () => {
    const p = await send("post", "/posts", users.a, {
      title: "Private draft",
      body: "Draft image",
      status: "Draft",
    });
    const image = PNG.sync.write(new PNG({ width: 2, height: 2 }));
    const upload = await request(app.getHttpServer())
      .post(`/api/posts/${p.body._id}/images`)
      .set("Cookie", users.a.cookie)
      .set("X-CSRF-Token", users.a.csrf)
      .attach("file", image, {
        filename: "test.png",
        contentType: "image/png",
      });
    expect(upload.status).toBe(201);
    expect(
      (await send("get", upload.body.url.replace("/api", ""))).status,
    ).toBe(404);
    expect(
      (await send("get", upload.body.url.replace("/api", ""), users.a)).status,
    ).toBe(200);
    const itinerary = await send("post", "/itineraries", users.a, {
      title: "Clone with media",
      countries: ["EG"],
      startDate: start,
    });
    const day = await send(
      "post",
      `/itineraries/${itinerary.body._id}/days`,
      users.a,
      { city: "cairo" },
    );
    const activity = await send(
      "post",
      `/itineraries/${itinerary.body._id}/days/${day.body.days[0]._id}/activities`,
      users.a,
      { name: "Image activity" },
    );
    const activityId = activity.body.days[0].activities[0]._id;
    const photo = await request(app.getHttpServer())
      .post(`/api/activities/${activityId}/images`)
      .set("Cookie", users.a.cookie)
      .set("X-CSRF-Token", users.a.csrf)
      .attach("file", image, {
        filename: "activity.png",
        contentType: "image/png",
      });
    expect(photo.status).toBe(201);
    await send("patch", `/itineraries/${itinerary.body._id}`, users.a, {
      visibility: "Public",
    });
    const clone = await send(
      "post",
      `/itineraries/${itinerary.body._id}/clone`,
      users.b,
    );
    expect(clone.status).toBe(201);
    const clonedImageId = clone.body.days[0].activities[0].imageIds[0];
    expect(clonedImageId).not.toBe(photo.body.id);
    await send(
      "delete",
      `/activities/${activityId}/images/${photo.body.id}`,
      users.a,
    );
    await send("delete", `/itineraries/${itinerary.body._id}`, users.a, {
      confirm: true,
    });
    expect((await send("get", `/media/${clonedImageId}`, users.b)).status).toBe(
      200,
    );
    expect((await send("get", `/media/${clonedImageId}`)).status).toBe(404);
  });
  test("reviews require a completed reservation, are unique and recalculate ratings", async () => {
    const b = await db.model("Booking").create({
      type: "hotel",
      userId: oidUser(users.a),
      providerIds: [hotel._id],
      status: "Completed",
      amount: 150,
      currency: "USD",
      snapshot: { hotelId: hotel._id },
      policySnapshot: {},
      startsAt: new Date(Date.now() - 10 * 86400000),
      endsAt: new Date(Date.now() - 86400000),
    });
    const review = await send(
      "post",
      `/hotel-bookings/${b.id}/review`,
      users.a,
      { rating: 4, body: "Good stay" },
    );
    expect(review.status).toBe(201);
    expect(
      (
        await send("post", `/hotel-bookings/${b.id}/review`, users.a, {
          rating: 5,
        })
      ).status,
    ).toBe(409);
    expect((await db.get("Provider", hotel._id)).averageRating).toBe(4);
    await send("patch", `/reviews/${review.body._id}`, users.a, { rating: 5 });
    expect((await db.get("Provider", hotel._id)).averageRating).toBe(5);
    expect(
      (
        await send("post", `/reviews/${review.body._id}/reply`, users.hotel, {
          body: "Thank you",
        })
      ).status,
    ).toBe(201);
    await send("delete", `/reviews/${review.body._id}`, users.a, {
      confirm: true,
    });
    expect((await db.get("Provider", hotel._id)).ratingCount).toBe(0);
  });
  test("seat selection is unique and cheaper flight changes preserve the reference", async () => {
    const f = await makeFlight("SEAT", 4);
    const a = await send(
      "post",
      "/flight-bookings/hold",
      users.a,
      flightDto(f.id),
    );
    const b = await send(
      "post",
      "/flight-bookings/hold",
      users.b,
      flightDto(f.id),
    );
    await markPaid(a.body._id);
    await markPaid(b.body._id);
    expect(
      (
        await send("patch", `/flight-bookings/${a.body._id}/seat`, users.a, {
          flightId: f.id,
          labels: ["1A"],
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await send("patch", `/flight-bookings/${b.body._id}/seat`, users.b, {
          flightId: f.id,
          labels: ["1A"],
        })
      ).status,
    ).toBe(409);
    const original = await db.get("Booking", a.body._id);
    const newer = await makeFlight("CHEAPER", 4, 1);
    newer.cabins[0].price = 80;
    await newer.save();
    const change = await send(
      "patch",
      `/flight-bookings/${a.body._id}/change-flight`,
      users.a,
      { segments: [{ flightId: newer.id, cabin: "Economy" }] },
    );
    expect(change.status).toBe(200);
    expect(change.body.status).toBe("Committed");
    const updated = await db.get("Booking", a.body._id);
    expect(updated.reference).toBe(original.reference);
    expect(updated.amount).toBe(80);
    expect(
      (await db.model("Refund").findOne({ bookingId: updated._id })).amount,
    ).toBe(20);
  });
  test("favourites and notifications are user-scoped", async () => {
    expect(
      (
        await send("post", "/favourites", users.a, {
          type: "hotel",
          resourceId: hotel._id,
        })
      ).status,
    ).toBe(201);
    expect((await send("get", "/favourites", users.a)).body.total).toBe(1);
    expect((await send("get", "/favourites", users.b)).body.total).toBe(0);
    const n = (await send("get", "/notifications", users.a)).body.items[0];
    expect(n).toBeDefined();
    expect(
      (await send("patch", `/notifications/${n._id}/read`, users.b)).status,
    ).toBe(404);
  });
  test("email reset tokens are single-use, superseded and non-enumerating", async () => {
    process.env.ENABLE_EMAIL_BONUS = "true";
    const found = await send("post", "/auth/forgot-password", undefined, {
        email: "b@example.test",
      }),
      missing = await send("post", "/auth/forgot-password", undefined, {
        email: "missing@example.test",
      });
    expect(found.body).toEqual(missing.body);
    const firstMail = await db
      .model("Outbox")
      .findOne({
        kind: "email",
        "payload.to": "b@example.test",
        "payload.subject": "Reset your password",
      })
      .sort({ createdAt: -1 });
    const firstRaw = firstMail.payload.text.match(/token=([a-f0-9]{64})/)[1];
    const form = await send("get", `/auth/reset-password?token=${firstRaw}`);
    expect(form.status).toBe(200);
    expect(form.text).toContain('name="newPassword"');
    expect(form.headers["cache-control"]).toBe("no-store");
    expect(form.headers["referrer-policy"]).toBe("no-referrer");
    const old = await db.model("User").findById(users.b.user.id);
    await send("post", "/auth/forgot-password", undefined, {
      email: "b@example.test",
    });
    const newer = await db.model("User").findById(users.b.user.id);
    expect(old.resetHash).not.toBe(newer.resetHash);
    expect(
      (await send("get", `/auth/reset-password?token=${firstRaw}`)).status,
    ).toBe(400);
    const raw = "a".repeat(64);
    await db.model("User").updateOne(
      { _id: newer._id },
      {
        $set: {
          resetHash: hash(raw),
          resetExpires: new Date(Date.now() + 60000),
        },
      },
    );
    expect(
      (
        await send("post", "/auth/reset-password", undefined, {
          token: raw,
          newPassword: password,
        })
      ).status,
    ).toBe(201);
    expect(
      (
        await send("post", "/auth/reset-password", undefined, {
          token: raw,
          newPassword: password,
        })
      ).status,
    ).toBe(400);
    process.env.ENABLE_EMAIL_BONUS = "false";
  });
  test("cached FX rates remain usable if the external refresh fails", async () => {
    const ops = app.get(Ops);
    const original = global.fetch;
    global.fetch = jest
      .fn<typeof global.fetch>()
      .mockRejectedValue(new Error("network unavailable"));
    try {
      await expect(ops.refreshRates()).rejects.toThrow();
      expect((await ops.rates()).rates.EGP).toBe(50);
    } finally {
      global.fetch = original;
    }
  });
});

describe("Complete operation workflows on independent fixtures", () => {
  let owner: Login, other: Login, air: Login, host: Login;
  let carrier: any, lodging: any, scheduled: any, vacant: any;
  async function ok(
    method: Parameters<typeof send>[0],
    path: string,
    user?: Login,
    body?: any,
  ) {
    const response = await send(method, path, user, body);
    expect({
      path,
      status: response.status,
      message: response.status >= 400 ? response.body.message : undefined,
      errors: response.status >= 400 ? response.body.errors : undefined,
    }).toEqual({
      path,
      status: method === "post" ? 201 : 200,
      message: undefined,
      errors: undefined,
    });
    return response;
  }
  beforeAll(async () => {
    for (const name of ["coverage-owner", "coverage-other"])
      await ok(
        "post",
        "/auth/register",
        undefined,
        traveler(`${name}@example.test`),
      );
    owner = await login("coverage-owner@example.test");
    other = await login("coverage-other@example.test");
    carrier = (
      await ok("post", "/airlines", users.admin, {
        name: "Coverage Airways",
        code: "COVER",
      })
    ).body;
    lodging = (
      await ok("post", "/hotels", users.admin, {
        name: "Coverage Hotel",
        address: "Test Cairo",
        city: "cairo",
        country: "EG",
        description: "Endpoint verification",
        starClass: 4,
        amenities: ["WiFi"],
        timezone: "Africa/Cairo",
      })
    ).body;
    for (const [name, role, provider] of [
      ["coverage-air", "AirlineModerator", carrier],
      ["coverage-host", "HotelModerator", lodging],
    ] as const) {
      await ok("post", "/admin/moderators", users.admin, {
        name,
        email: `${name}@example.test`,
        role,
        providerId: provider._id,
        temporaryPassword: password,
      });
      const temporary = await login(`${name}@example.test`);
      await ok("patch", "/auth/change-password", temporary, {
        currentPassword: password,
        newPassword: password,
      });
      expect((await send("get", "/auth/me", temporary)).status).toBe(401);
    }
    air = await login("coverage-air@example.test");
    host = await login("coverage-host@example.test");
  });

  test("reference lists, current account and administrative views return their documented data", async () => {
    for (const path of ["/airports", "/countries", "/cities", "/attractions"]) {
      const response = await ok("get", path);
      expect(response.body.items).toHaveLength(8);
      expect(response.body.pageSize).toBe(10);
    }
    expect((await ok("get", "/currencies")).body).toContain("USD");
    expect((await ok("get", "/health")).body.database).toBe(true);
    expect((await ok("get", "/auth/me", owner)).body.id).toBe(owner.user.id);
    for (const path of [
      "/admin/accounts",
      "/admin/bookings",
      "/admin/reports",
      "/admin/audit-logs",
    ]) {
      const response = await ok("get", path, users.admin);
      expect(Array.isArray(response.body.items)).toBe(true);
      expect(response.body.pageSize).toBe(10);
      expect((await send("get", path, owner)).status).toBe(403);
    }
    const original = global.fetch;
    const currencies = await db.model("Country").distinct("currency");
    const rates = Object.fromEntries(
      currencies.map((code: string) => [code, code === "EGP" ? 50 : 1]),
    );
    global.fetch = jest.fn<typeof global.fetch>().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, base: "USD", date: start, rates }),
    } as Response);
    try {
      expect(
        (await ok("post", "/admin/exchange-rates/refresh", users.admin)).body
          .base,
      ).toBe("USD");
      expect((await ok("get", "/exchange-rates", owner)).body.rates.USD).toBe(
        1,
      );
    } finally {
      global.fetch = original;
    }
    const notification = (await ok("get", "/notifications", air)).body.items[0];
    // Moderators need no prior notification, so create an explicit deterministic fixture.
    const note =
      notification ||
      (await db.model("Notification").create({
        userId: oidUser(owner),
        message: "Coverage notification",
        key: "coverage-note",
      }));
    const recipient = notification ? air : owner;
    await ok("patch", `/notifications/${note._id}/read`, recipient);
    expect((await db.get("Notification", note._id)).readAt).toBeDefined();
  });

  test("airline profile, baggage, flight cabins, detail and provider booking exports work together", async () => {
    await ok("patch", `/airlines/${carrier._id}`, air, {
      name: "Coverage Airways Updated",
    });
    await ok("put", `/airlines/${carrier._id}/baggage-policy`, air, {
      extraBagPrice: 20,
      maxExtraBags: 2,
    });
    expect((await ok("get", `/airlines/${carrier._id}`)).body.name).toBe(
      "Coverage Airways Updated",
    );
    scheduled = (
      await ok("post", "/flights", air, {
        airlineId: carrier._id,
        flightNumber: "COVER100",
        departureAirport: "CAI",
        arrivalAirport: "DXB",
        departureLocal: `${start}T10:00`,
        arrivalLocal: `${start}T16:00`,
      })
    ).body;
    await ok("patch", `/flights/${scheduled._id}`, air, {
      departureLocal: `${start}T11:00`,
    });
    await ok("post", `/flights/${scheduled._id}/cabins`, air, {
      category: "Economy",
      capacity: 12,
      price: 100,
      freeBags: 1,
      bagWeightKg: 23,
    });
    const detail = await ok("get", `/flights/${scheduled._id}`);
    expect(detail.body.cabins[0].capacity).toBe(12);
    await ok("get", `/flights/${scheduled._id}/bookings`, air);
    const csv = await ok(
      "get",
      `/flights/${scheduled._id}/passengers/export`,
      air,
    );
    expect(csv.headers["content-type"]).toMatch(/text\/csv/);
    expect(
      (await send("get", `/flights/${scheduled._id}/passengers/export`, host))
        .status,
    ).toBe(403);
  });

  test("hotel profile, policies and availability edits drive reservation views and safe room deletion", async () => {
    await ok("patch", `/hotels/${lodging._id}`, host, {
      description: "Updated description",
    });
    await ok("put", `/hotels/${lodging._id}/policies`, host, {
      checkInTime: "14:00",
      checkOutTime: "11:00",
      tiers: [
        { threshold: 0, refundPercent: 0 },
        { threshold: 7, refundPercent: 80 },
      ],
    });
    vacant = (
      await ok("post", `/hotels/${lodging._id}/rooms`, host, {
        number: "COV101",
        type: "Double",
        beds: 2,
        occupancy: 3,
        price: 75,
      })
    ).body;
    const path = `/hotels/${lodging._id}/rooms/${vacant._id}/availability`;
    await ok("post", path, host, {
      kind: "availability",
      ranges: [
        { start, end: DateTime.fromISO(end).plus({ days: 10 }).toISODate() },
      ],
    });
    await ok("patch", path, host, {
      kind: "blocked",
      ranges: [
        {
          start: end,
          end: DateTime.fromISO(end).plus({ days: 1 }).toISODate(),
        },
      ],
    });
    const availability = await ok(
      "get",
      `/hotels/${lodging._id}/rooms/available?checkIn=${start}&checkOut=${end}`,
    );
    expect(availability.body.items.some((r: any) => r._id === vacant._id)).toBe(
      true,
    );
    await ok("get", `/hotels/${lodging._id}/reservations`, host);
    const unused = (
      await ok("post", `/hotels/${lodging._id}/rooms`, host, {
        number: "DELETE-ME",
        type: "Single",
        beds: 1,
        occupancy: 1,
        price: 40,
      })
    ).body;
    await ok("delete", `/hotels/${lodging._id}/rooms/${unused._id}`, host, {
      confirm: true,
    });
    expect(await db.model("Room").findById(unused._id)).toBeNull();
  });

  test("booking aliases, owned detail, policy views, seat maps and financial status views return usable records", async () => {
    const preview = await ok(
      "post",
      "/flight-bookings",
      owner,
      flightDto(scheduled._id),
    );
    expect(preview.body.amount).toBe(100);
    const held = await ok(
      "post",
      "/flight-bookings/hold",
      owner,
      flightDto(scheduled._id),
    );
    const id = held.body._id;
    await ok("get", "/flight-bookings", owner);
    expect((await ok("get", `/flight-bookings/${id}`, owner)).body._id).toBe(
      id,
    );
    await ok("get", `/bookings/flight/${id}/policies`, owner);
    const { payment } = await markPaid(id);
    expect(
      (await ok("get", `/payments/${payment.id}`, owner)).body.status,
    ).toBe("Succeeded");
    await ok("get", `/flight-bookings/${id}/seats`, owner);
    await ok("get", `/flight-bookings/${id}/e-ticket`, owner);
    const replacement = await db.model("Flight").create({
      airlineId: carrier._id,
      flightNumber: "COVER101",
      departureAirport: "CAI",
      arrivalAirport: "DXB",
      departureDate: start,
      departureAt: DateTime.fromISO(start).plus({ hours: 12 }).toJSDate(),
      arrivalAt: DateTime.fromISO(start).plus({ hours: 16 }).toJSDate(),
      cabins: [
        {
          category: "Economy",
          capacity: 5,
          price: 80,
          freeBags: 1,
          bagWeightKg: 23,
        },
      ],
    });
    const change = await ok(
      "patch",
      `/flight-bookings/${id}/change-flight`,
      owner,
      { segments: [{ flightId: replacement.id, cabin: "Economy" }] },
    );
    expect(
      (await ok("get", `/flight-changes/${change.body._id}`, owner)).body
        .status,
    ).toBe("Committed");
    const refund = await db.model("Refund").findOne({ bookingId: id });
    expect((await ok("get", `/refunds/${refund.id}`, owner)).body.amount).toBe(
      20,
    );
    expect((await send("get", `/refunds/${refund.id}`, other)).status).toBe(
      400,
    );
    const hotelHold = await ok("post", "/hotel-bookings", owner, {
      hotelId: lodging._id,
      checkIn: start,
      checkOut: end,
      rooms: [
        {
          roomId: vacant._id,
          guests: [{ name: "Coverage Traveler", age: 30 }],
        },
      ],
    });
    await ok("get", "/hotel-bookings", owner);
    expect(
      (await ok("get", `/hotel-bookings/${hotelHold.body._id}`, owner)).body
        ._id,
    ).toBe(hotelHold.body._id);
    await markPaid(hotelHold.body._id);
    await ok(
      "get",
      `/hotel-bookings/${hotelHold.body._id}/cancellation-quote`,
      owner,
    );
    const cancelled = await ok(
      "post",
      `/hotel-bookings/${hotelHold.body._id}/cancel`,
      owner,
      { confirm: true },
    );
    expect(cancelled.body.status).toBe("Cancelled");
  });

  test("itinerary child edit/delete operations recalculate budgets and delegated searches use the city group", async () => {
    const trip = (
      await ok("post", "/itineraries", owner, {
        title: "Coverage trip",
        countries: ["EG"],
        startDate: start,
      })
    ).body;
    const id = trip._id;
    const added = await ok("post", `/itineraries/${id}/days`, owner, {
      city: "cairo",
    });
    const dayId = added.body.days[0]._id;
    await ok("patch", `/itineraries/${id}/days/${dayId}`, owner, {
      notes: "Updated notes",
    });
    const activity = (
      await ok("post", `/itineraries/${id}/days/${dayId}/activities`, owner, {
        name: "Museum",
        cost: 10,
        currency: "USD",
      })
    ).body.days[0].activities[0];
    await ok("patch", `/activities/${activity._id}`, owner, { cost: 20 });
    const budget = (
      await ok("post", `/itineraries/${id}/days/${dayId}/budgets`, owner, {
        category: "Food",
        amount: 5,
        currency: "USD",
      })
    ).body.days[0].budgets[0];
    await ok("patch", `/budgets/${budget._id}`, owner, { amount: 15 });
    const transport = (
      await ok("post", `/itineraries/${id}/transport-costs`, owner, {
        mode: "Taxi",
        fromCity: "cairo",
        toCity: "cairo",
        amount: 3,
        currency: "USD",
        dayId,
      })
    ).body.transportCosts[0];
    await ok("patch", `/transport-costs/${transport._id}`, owner, {
      amount: 4,
    });
    expect(
      (await ok("get", `/itineraries/${id}/budget-summary`, owner)).body.total,
    ).toBe(39);
    await ok(
      "get",
      `/itineraries/${id}/hotels?firstDayId=${dayId}&guests=1&rooms=1`,
      owner,
    );
    await ok("get", `/itineraries/${id}/flights?origin=DXB`, owner);
    await ok("get", "/itineraries", owner);
    await ok("patch", `/itineraries/${id}`, owner, { visibility: "Public" });
    expect(
      (await ok("get", "/itineraries/public/search?q=Coverage")).body.total,
    ).toBeGreaterThan(0);
    await ok("delete", `/activities/${activity._id}`, owner, { confirm: true });
    await ok("delete", `/budgets/${budget._id}`, owner, { confirm: true });
    await ok("delete", `/transport-costs/${transport._id}`, owner, {
      confirm: true,
    });
    expect(
      (await ok("get", `/itineraries/${id}/budget-summary`, owner)).body.total,
    ).toBe(0);
    await ok("delete", `/itineraries/${id}/days/${dayId}`, owner, {
      confirm: true,
    });
    expect(
      (await ok("get", `/itineraries/${id}`, owner)).body.days,
    ).toHaveLength(0);
  });

  test("community discovery, own-comment changes, unlike, moderation and favourites preserve visibility and ownership", async () => {
    const post = (
      await ok("post", "/posts", owner, {
        title: "Coverage blog",
        body: "Cairo guide",
        status: "Published",
        tags: ["coverage"],
      })
    ).body;
    await ok("get", "/posts/mine", owner);
    const tagged = await ok("get", "/tags/coverage/posts");
    expect(tagged.body.items.some((p: any) => p.id === post._id)).toBe(true);
    await ok("get", `/authors/${owner.user.id}`);
    const comment = (
      await ok("post", `/posts/${post._id}/comments`, other, {
        body: "Original",
      })
    ).body;
    await ok("patch", `/comments/${comment._id}`, other, { body: "Edited" });
    expect(
      (
        await send("delete", `/comments/${comment._id}`, owner, {
          confirm: true,
        })
      ).status,
    ).toBe(403);
    await ok("delete", `/comments/${comment._id}`, other, { confirm: true });
    await ok("post", `/posts/${post._id}/like`, other);
    expect(
      (await ok("delete", `/posts/${post._id}/like`, other)).body.likeCount,
    ).toBe(0);
    await ok("patch", `/admin/content/post/${post._id}`, users.admin, {
      hidden: true,
    });
    expect((await send("get", `/posts/${post._id}`)).status).toBe(404);
    await ok("patch", `/admin/content/post/${post._id}`, users.admin, {
      hidden: false,
    });
    await ok("get", `/posts/${post._id}`);
    await ok("post", "/favourites", owner, {
      type: "hotel",
      resourceId: lodging._id,
    });
    const favourite = await db
      .model("Favourite")
      .findOne({ userId: oidUser(owner), resourceId: lodging._id });
    await ok("delete", `/favourites/${favourite._id}`, owner);
    await ok("delete", `/posts/${post._id}`, owner, { confirm: true });
    expect((await send("get", `/posts/${post._id}`)).status).toBe(404);
  });

  test("all parent media upload/delete routes enforce ownership and remove the parent reference", async () => {
    const post = (
      await ok("post", "/posts", owner, {
        title: "Coverage image",
        body: "Image",
      })
    ).body;
    const png = PNG.sync.write(new PNG({ width: 2, height: 2 }));
    for (const [path, user] of [
      [`/posts/${post._id}/images`, owner],
      [`/hotels/${lodging._id}/images`, host],
      [`/airlines/${carrier._id}/logo`, air],
    ] as const) {
      const upload = await request(app.getHttpServer())
        .post(`/api${path}`)
        .set("Cookie", user.cookie)
        .set("X-CSRF-Token", user.csrf)
        .attach("file", png, {
          filename: "coverage.png",
          contentType: "image/png",
        });
      expect(upload.status).toBe(201);
      expect(
        (await send("delete", `${path}/${upload.body.id}`, other)).status,
      ).toBe(403);
      await ok("delete", `${path}/${upload.body.id}`, user);
      expect((await send("get", `/media/${upload.body.id}`, user)).status).toBe(
        404,
      );
    }
  });
  test("every protected operation rejects anonymous access, incorrect roles and missing CSRF", async () => {
    const actors: Record<string, Login> = {
      User: owner,
      Admin: users.admin,
      AirlineModerator: air,
      HotelModerator: host,
    };
    const operations = coverageReport().operations;
    for (const operation of operations.filter(
      (o: any) => o.requiresAuthentication,
    )) {
      const method = operation.method.toLowerCase() as Parameters<
        typeof send
      >[0];
      const path = operation.path
        .replace(/^\/api/, "")
        .replace(/\{[^}]+\}/g, "507f1f77bcf86cd799439011");
      const anonymous = await send(
        method,
        path,
        undefined,
        method === "get" ? undefined : {},
      ).set("X-API-Test-Context", "anonymous");
      expect({ path, status: anonymous.status }).toEqual({ path, status: 401 });
      const roles =
        operation.access
          ?.split(", ")
          .filter((role: string) => role in actors) || [];
      if (roles.length) {
        const wrong = roles.includes("User") ? users.admin : owner;
        const rejected = await send(
          method,
          path,
          wrong,
          method === "get" ? undefined : {},
        ).set("X-API-Test-Context", "wrong-role");
        expect({ path, status: rejected.status }).toEqual({
          path,
          status: 403,
        });
      }
      if (method !== "get") {
        const allowed = roles.length ? actors[roles[0]] : owner;
        const rejected = await request(app.getHttpServer())
          [method](`/api${path}`)
          .set("Cookie", allowed.cookie)
          .set("X-API-Test-Context", "missing-csrf")
          .send({});
        expect({ path, status: rejected.status }).toEqual({
          path,
          status: path === "/auth/refresh" ? 401 : 403,
        });
      }
    }
  });
  test("every documented API operation has a successful HTTP workflow", () => {
    const report = coverageReport();
    expect(
      report.operations
        .filter((operation: any) => !operation.successfulResponse)
        .map((operation: any) => `${operation.method} ${operation.path}`),
    ).toEqual([]);
    expect(report.exercisedOperations).toBe(report.totalOperations);
  });
});
