// Account-backed verification. No mock PaymentIntents, events or refunds are used.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import https from "node:https";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config, parse } from "dotenv";
import { DateTime } from "luxon";
import Stripe from "stripe";

const stages = [
  "sandbox authentication",
  "dedicated Atlas verification fixtures",
  "declined payment and retry",
  "signed-webhook flight confirmation",
  "tier-based traveler refund",
  "provider cancellation and full refund",
  "hotel confirmation and refund",
  "real ten-minute hold expiry and Stripe cancellation",
];
if (process.argv.includes("--plan")) {
  console.log(stages.map((stage, i) => `${i + 1}. ${stage}`).join("\n"));
  console.log(
    "Creates identifiable verification fixtures in travel_platform and sandbox-only Stripe objects. Full run waits for the actual 10-minute hold deadline. Credentials stay in ignored backend/.local. No production account or real card details are used.",
  );
  process.exit(0);
}
const backend = fileURLToPath(new URL("../", import.meta.url));
process.chdir(backend);
config({ path: resolve(backend, ".env"), quiet: true });
const env = parse(readFileSync(".env", "utf8"));
const local = resolve(backend, ".local");
const statePath = resolve(local, "stripe-run.json");
const reportPath = new URL(
  "../../docs/milestone-1/evidence/stripe-account-verification.json",
  import.meta.url,
);
let app,
  db,
  state,
  stage = "configuration";
const report = {
  clientDate: process.env.VERIFICATION_CLIENT_DATE || new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date()),
  outcome: "not_verified",
  testModeOnly: true,
  fixtureScope:
    "Dedicated identifiable records in the user's travel_platform database; real Stripe sandbox objects; no direct processEvent calls or locally fabricated webhooks.",
  checks: [],
  cases: {},
};
function save() {
  writeFileSync(statePath, JSON.stringify(state, null, 2) + "\n");
}
function passed(label) {
  report.checks.push(label);
  console.log(`PASS: ${label}`);
}
function requireCheck(condition, label) {
  if (!condition) throw new Error(label);
}
const sleep = (ms) => new Promise((resolveWait) => setTimeout(resolveWait, ms));
let ca, port;
async function call(method, path, actor, body) {
  const text = body === undefined ? undefined : JSON.stringify(body);
  return new Promise((resolveResult, reject) => {
    const req = https.request(
      {
        hostname: "localhost",
        family: 4,
        port,
        path: `/api${path}`,
        method,
        ca,
        headers: {
          ...(text
            ? {
                "Content-Type": "application/json",
                "Content-Length": Buffer.byteLength(text),
              }
            : {}),
          ...(actor
            ? { Cookie: actor.cookie, "X-CSRF-Token": actor.csrf }
            : {}),
        },
      },
      (response) => {
        let data = "";
        response.on("data", (c) => (data += c));
        response.on("end", () => {
          let json;
          try {
            json = JSON.parse(data);
          } catch {}
          resolveResult({
            status: response.statusCode,
            json,
            headers: response.headers,
          });
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("HTTP_TIMEOUT")));
    if (text) req.write(text);
    req.end();
  });
}
async function api(
  method,
  path,
  actor,
  body,
  expected = method === "POST" ? 201 : 200,
) {
  let response = await call(method, path, actor, body);
  if (response.status === 401 && actor) {
    const refresh = await call("POST", "/auth/refresh", actor);
    if (refresh.status === 201) {
      actor.cookie = refresh.headers["set-cookie"]
        .map((v) => v.split(";")[0])
        .join("; ");
      actor.csrf = refresh.json.csrfToken;
      response = await call(method, path, actor, body);
    }
  }
  requireCheck(
    response.status === expected,
    `HTTP_${response.status}_AT_${stage.toUpperCase().replace(/[^A-Z]/g, "_")}`,
  );
  return response;
}
async function login(email) {
  const r = await api("POST", "/auth/login", undefined, {
    email,
    password: state.password,
  });
  return {
    cookie: r.headers["set-cookie"].map((v) => v.split(";")[0]).join("; "),
    csrf: r.json.csrfToken,
  };
}
async function until(label, task, timeout = 90000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const result = await task();
    if (result) return result;
    await sleep(2000);
  }
  throw new Error(`TIMEOUT_${label}`);
}
try {
  requireCheck(
    env.STRIPE_SECRET_KEY?.startsWith("sk_test_"),
    "MISSING_TEST_KEY",
  );
  requireCheck(
    env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_"),
    "MISSING_LISTENER_SECRET",
  );
  requireCheck(
    new URL(env.MONGODB_URI).pathname === "/travel_platform",
    "UNEXPECTED_DATABASE",
  );
  requireCheck(
    (env.PLATFORM_CURRENCY || "USD") === "USD",
    "VERIFICATION_EXPECTS_USD",
  );
  ca = readFileSync(resolve(backend, env.TLS_CERT_PATH));
  port = Number(env.PORT || 3443);
  const health = await until("BACKEND_STARTUP", async () => {
    try {
      const response = await call("GET", "/health");
      return response.status === 200 ? response.json : undefined;
    } catch {
      return undefined;
    }
  });
  requireCheck(
    health.database && health.stripeConfigured && health.webhookConfigured,
    "RESTART_BACKEND_WITH_STRIPE_SETTINGS",
  );
  requireCheck(
    !health.emailBonusEnabled,
    "VERIFICATION_FIXTURES_REQUIRE_EMAIL_BONUS_DISABLED",
  );
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    timeout: 15000,
    maxNetworkRetries: 2,
  });
  requireCheck(
    (await stripe.balance.retrieve()).livemode === false,
    "NOT_TEST_MODE",
  );
  passed(stages[0]);
  stage = "fixture setup";
  mkdirSync(local, { recursive: true });
  if (existsSync(statePath) && !process.argv.includes("--new-run"))
    state = JSON.parse(readFileSync(statePath, "utf8"));
  else {
    if (existsSync(statePath))
      writeFileSync(
        resolve(local, `stripe-run-${randomUUID()}.json`),
        readFileSync(statePath),
      );
    state = {
      run: randomBytes(6).toString("hex"),
      password: `V9${randomBytes(24).toString("hex")}`,
      ids: {},
      cases: {},
    };
    save();
  }
  if (state.complete && state.report?.outcome === "passed") {
    writeFileSync(reportPath, JSON.stringify(state.report, null, 2) + "\n");
    console.log("Restored the previously completed run's report; no scenarios repeated. Use --new-run for another verification.");
    process.exit(0);
  }
  requireCheck(!state.complete, "ALREADY_COMPLETED_USE_NEW_RUN_FOR_ANOTHER_VERIFICATION");
  process.env.ENABLE_JOBS = "false"; // Only this inspector's context; the running server processes its jobs.
  const { createApp } = await import("../dist/bootstrap.js");
  const { Db } = await import("../dist/database.js");
  const { passwordHash } = await import("../dist/auth/auth.js");
  const { Types } = await import("mongoose");
  ({ app } = await createApp({ logger: false }));
  db = app.get(Db);
  for (const key of [
    "carrier",
    "hotel",
    "room",
    "flightA",
    "flightB",
    "flightX",
    "moderator",
  ])
    state.ids[key] ||= new Types.ObjectId().toString();
  save();
  const day = (state.day ||= DateTime.now()
    .setZone("Africa/Cairo")
    .plus({ days: 21 })
    .toISODate());
  save();
  const end = DateTime.fromISO(day).plus({ days: 2 }).toISODate();
  const tiers = [
    { threshold: 0, refundPercent: 0 },
    { threshold: 7, refundPercent: 75 },
  ];
  const seed = (name, id, fields) =>
    db
      .model(name)
      .updateOne({ _id: id }, { $setOnInsert: fields }, { upsert: true });
  await seed("Provider", state.ids.carrier, {
    type: "airline",
    name: `Stripe Verification ${state.run}`,
    code: `S${state.run.slice(0, 7).toUpperCase()}`,
    cancellationTiers: tiers,
  });
  await seed("Provider", state.ids.hotel, {
    type: "hotel",
    name: `Stripe Verification Hotel ${state.run}`,
    address: "Synthetic verification fixture",
    city: "cairo",
    country: "EG",
    description: "Stripe sandbox verification only",
    starClass: 3,
    amenities: [],
    timezone: "Africa/Cairo",
    cancellationTiers: tiers,
  });
  for (const key of ["flightA", "flightB", "flightX"])
    await seed("Flight", state.ids[key], {
      airlineId: state.ids.carrier,
      flightNumber: `SV${state.run}${key.at(-1)}`,
      departureAirport: "CAI",
      arrivalAirport: "DXB",
      departureDate: day,
      departureAt: DateTime.fromISO(`${day}T10:00`, {
        zone: "Africa/Cairo",
      }).toJSDate(),
      arrivalAt: DateTime.fromISO(`${day}T16:00`, {
        zone: "Asia/Dubai",
      }).toJSDate(),
      cabins: [
        {
          category: "Economy",
          capacity: 3,
          price: 10,
          freeBags: 1,
          bagWeightKg: 23,
        },
      ],
    });
  await seed("Room", state.ids.room, {
    hotelId: state.ids.hotel,
    number: "SV101",
    type: "Single",
    beds: 1,
    occupancy: 1,
    price: 10,
    availability: [{ start: day, end }],
  });
  const modEmail = `stripe-air-${state.run}@example.test`,
    email = `stripe-traveler-${state.run}@example.test`;
  await seed("User", state.ids.moderator, {
    name: "Stripe Verification Moderator",
    email: modEmail,
    role: "AirlineModerator",
    providerId: state.ids.carrier,
    passwordHash: await passwordHash(state.password),
    forcePasswordChange: false,
    emailVerified: true,
    consentAt: new Date(),
  });
  const registration = await call("POST", "/auth/register", undefined, {
    name: "Stripe Verification Traveler",
    email,
    password: state.password,
    consent: true,
  });
  requireCheck(
    [201, 409].includes(registration.status),
    "FIXTURE_REGISTRATION_FAILED",
  );
  const owner = await login(email),
    moderator = await login(modEmail);
  const user = await db.model("User").findOne({ email });
  requireCheck(user && user.role === "User", "FIXTURE_TRAVELER_NOT_FOUND");
  passed(stages[1]);
  async function hold(key, type = "flight") {
    state.cases[key] ||= {};
    const item = state.cases[key];
    if (!item.bookingId) {
      const criteria =
        type === "flight"
          ? {
              "snapshot.segments.flightId": {
                $in: [state.ids[key], new Types.ObjectId(state.ids[key])],
              },
            }
          : {
              "snapshot.rooms.roomId": {
                $in: [state.ids.room, new Types.ObjectId(state.ids.room)],
              },
            };
      const existing = await db
        .model("Booking")
        .findOne({ userId: user._id, type, ...criteria })
        .sort({ createdAt: -1 });
      const dto =
        type === "flight"
          ? {
              segments: [{ flightId: state.ids[key], cabin: "Economy" }],
              passengers: [
                {
                  fullName: "Synthetic Traveler",
                  dateOfBirth: "1990-01-01",
                  identityNumber: `VERIFY-${state.run}`,
                  type: "adult",
                  extraBags: 0,
                },
              ],
            }
          : {
              hotelId: state.ids.hotel,
              checkIn: day,
              checkOut: end,
              rooms: [
                {
                  roomId: state.ids.room,
                  guests: [{ name: "Synthetic Guest", age: 30 }],
                },
              ],
            };
      const booking =
        existing ||
        (
          await api(
            "POST",
            type === "flight" ? "/flight-bookings/hold" : "/hotel-bookings",
            owner,
            dto,
          )
        ).json;
      item.bookingId = String(booking._id);
      save();
    }
    return { item, booking: await db.get("Booking", item.bookingId) };
  }
  async function payment(key, type = "flight") {
    const { item, booking } = await hold(key, type);
    if (!item.paymentId) {
      requireCheck(
        booking.status === "Pending Payment",
        "SAVED_HOLD_NOT_ACTIVE_START_NEW_RUN",
      );
      if (!booking.policyAcceptedAt)
        await api(
          "POST",
          `/bookings/${type}/${booking.id}/accept-policies`,
          owner,
          { confirm: true },
        );
      const created = (
        await api("POST", "/payments", owner, { type, bookingId: booking.id })
      ).json;
      item.paymentId = created.paymentId;
      item.intentId = created.stripePaymentId;
      save();
    }
    const intent = await stripe.paymentIntents.retrieve(item.intentId);
    requireCheck(
      intent.livemode === false &&
        intent.currency === "usd" &&
        intent.metadata.bookingId === booking.id,
      "STRIPE_ASSOCIATION_MISMATCH",
    );
    return { item, booking, intent };
  }
  async function confirm(key, type = "flight") {
    const { item, booking, intent } = await payment(key, type);
    if (intent.status !== "succeeded")
      await stripe.paymentIntents.confirm(
        item.intentId,
        { payment_method: "pm_card_visa" },
        { idempotencyKey: `verification-confirm:${state.run}:${key}` },
      );
    if (booking.status !== "Cancelled")
      await until(
        "SIGNED_CONFIRMATION",
        async () =>
          (await db.get("Booking", booking.id)).status === "Confirmed",
      );
    const events = await stripe.events.list({
      type: "payment_intent.succeeded",
      created: { gte: intent.created - 1 },
      limit: 100,
    });
    const event = events.data.find(
      (event) => event.data.object.id === item.intentId,
    );
    requireCheck(
      event &&
        (await db
          .model("StripeEvent")
          .exists({ eventId: event.id, processedAt: { $exists: true } })),
      "REAL_SIGNED_EVENT_NOT_RECORDED",
    );
    item.signedEventId = event.id;
    save();
    return { item, booking: await db.get("Booking", booking.id) };
  }
  async function refund(item, expectedMinor) {
    const record = await until(
      "REAL_REFUND",
      async () => {
        const r = await db
          .model("Refund")
          .findOne({ bookingId: item.bookingId, status: "Refunded" });
        return r?.stripeId ? r : undefined;
      },
      120000,
    );
    const external = await stripe.refunds.retrieve(record.stripeId);
    requireCheck(
      external.status === "succeeded" &&
        external.amount === expectedMinor &&
        external.payment_intent === item.intentId,
      "REFUND_MISMATCH",
    );
    requireCheck(
      (await db
        .model("Refund")
        .countDocuments({ bookingId: item.bookingId })) === 1,
      "DUPLICATE_REFUND_RECORD",
    );
    return { refundId: external.id, amountMinor: external.amount };
  }
  stage = "expiry hold";
  const timeout = process.argv.includes("--quick")
    ? undefined
    : await payment("flightX");
  stage = "flight retry and traveler refund";
  if (!state.cases.flightA?.complete) {
    const { item, intent } = await payment("flightA");
    if (intent.status !== "succeeded") {
      if (!item.declineVerified) {
        try {
          await stripe.paymentIntents.confirm(
            item.intentId,
            { payment_method: "pm_card_chargeDeclined" },
            { idempotencyKey: `verification-decline:${state.run}` },
          );
        } catch (error) {
          requireCheck(
            error.type === "StripeCardError",
            "UNEXPECTED_STRIPE_DECLINE_ERROR",
          );
        }
        await until(
          "DECLINE_WEBHOOK",
          async () =>
            (await db.get("Payment", item.paymentId)).status === "Failed",
        );
        item.declineVerified = true;
        save();
      }
      const retry = (
        await api("POST", `/payments/${item.paymentId}/retry`, owner)
      ).json;
      requireCheck(
        retry.stripePaymentId === item.intentId,
        "RETRY_CREATED_ANOTHER_INTENT",
      );
    }
    const confirmed = await confirm("flightA");
    requireCheck(confirmed.booking.reference, "MISSING_BOOKING_REFERENCE");
    if (confirmed.booking.status === "Confirmed") {
      await api("GET", `/flight-bookings/${item.bookingId}/e-ticket`, owner);
      const quote = (
        await api(
          "GET",
          `/flight-bookings/${item.bookingId}/cancellation-quote`,
          owner,
        )
      ).json;
      requireCheck(
        quote.percentage === 75 && quote.amount === 7.5,
        "TIER_QUOTE_MISMATCH",
      );
      await api("POST", `/flight-bookings/${item.bookingId}/cancel`, owner, {
        confirm: true,
      });
    } else
      requireCheck(
        confirmed.booking.status === "Cancelled",
        "UNEXPECTED_RESUMED_BOOKING_STATE",
      );
    const externalRefund = await refund(item, 750);
    await api("POST", `/flight-bookings/${item.bookingId}/cancel`, owner, {
      confirm: true,
    });
    item.result = {
      stripePaymentIntent: item.intentId,
      signedEvent: item.signedEventId,
      ...externalRefund,
      bookingStatus: "Cancelled",
      declineAndRetry: item.declineVerified,
    };
    item.complete = true;
    save();
  }
  report.cases.travelerFlightRefund = state.cases.flightA.result;
  passed(stages[2]);
  passed(stages[3]);
  passed(stages[4]);
  stage = "provider refund";
  if (!state.cases.flightB?.complete) {
    const { item, booking } = await confirm("flightB");
    if (booking.status === "Confirmed")
      await api("POST", `/flights/${state.ids.flightB}/cancel`, moderator, {
        confirm: true,
      });
    else
      requireCheck(
        booking.status === "Cancelled",
        "UNEXPECTED_RESUMED_BOOKING_STATE",
      );
    item.result = {
      stripePaymentIntent: item.intentId,
      signedEvent: item.signedEventId,
      ...(await refund(item, 1000)),
      bookingStatus: (await db.get("Booking", item.bookingId)).status,
    };
    item.complete = true;
    save();
  }
  report.cases.providerCancellation = state.cases.flightB.result;
  passed(stages[5]);
  stage = "hotel refund";
  if (!state.cases.hotel?.complete) {
    const { item, booking } = await confirm("hotel", "hotel");
    if (booking.status === "Confirmed")
      await api("POST", `/hotel-bookings/${item.bookingId}/cancel`, owner, {
        confirm: true,
      });
    else
      requireCheck(
        booking.status === "Cancelled",
        "UNEXPECTED_RESUMED_BOOKING_STATE",
      );
    item.result = {
      stripePaymentIntent: item.intentId,
      signedEvent: item.signedEventId,
      ...(await refund(item, 1500)),
      bookingStatus: (await db.get("Booking", item.bookingId)).status,
    };
    item.complete = true;
    save();
  }
  report.cases.hotelRefund = state.cases.hotel.result;
  passed(stages[6]);
  stage = "real hold expiry";
  if (timeout) {
    const due = +new Date(timeout.booking.holdExpiresAt);
    while (Date.now() < due + 1000) {
      console.log(
        `Waiting for actual hold deadline: ${Math.max(0, Math.ceil((due - Date.now()) / 1000))} seconds remaining.`,
      );
      await sleep(Math.min(30000, Math.max(1000, due + 1000 - Date.now())));
    }
    await until(
      "HOLD_EXPIRY",
      async () =>
        (await db.get("Booking", timeout.booking.id)).status === "Expired",
    );
    await until(
      "STRIPE_CANCELLATION",
      async () =>
        (await stripe.paymentIntents.retrieve(timeout.item.intentId)).status ===
        "canceled",
    );
    const f = await db.get("Flight", state.ids.flightX);
    requireCheck(
      f.cabins[0].held === 0 && f.cabins[0].booked === 0,
      "EXPIRED_INVENTORY_NOT_RELEASED",
    );
    report.cases.holdExpiry = {
      stripePaymentIntent: timeout.item.intentId,
      bookingStatus: "Expired",
      stripeStatus: "canceled",
      inventoryReleased: true,
    };
    passed(stages[7]);
  } else report.cases.holdExpiry = { outcome: "skipped_by_quick_flag" };
  for (const actor of [owner, moderator])
    await api("POST", "/auth/logout", actor);
  report.outcome = timeout ? "passed" : "partial_pass_expiry_pending";
  state.complete = Boolean(timeout);
  state.report = report;
  save();
} catch (error) {
  report.outcome = state ? "failed_or_incomplete" : "not_verified";
  report.failedStage = stage;
  // Never serialize Stripe error objects, HTTP bodies, cookies, keys or client secrets.
  report.reason = /^[A-Z][A-Z0-9_]+$/.test(error?.message || "")
    ? error.message
    : "EXTERNAL_OR_VERIFICATION_FAILURE";
  console.error(
    `NOT COMPLETE: ${report.failedStage} (${report.reason}). Details and credentials were withheld.`,
  );
  process.exitCode = 1;
} finally {
  if (app) await app.close();
  mkdirSync(new URL("../../docs/milestone-1/evidence/", import.meta.url), {
    recursive: true,
  });
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
  console.log(`Verification outcome: ${report.outcome}`);
}
