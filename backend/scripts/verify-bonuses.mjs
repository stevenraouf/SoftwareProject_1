// Live sandbox verification: actual Atlas, signed Stripe events and SMTP to Mailpit.
// Synthetic fixture accounts/stays are identified explicitly; no real mail is sent.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import https from "node:https";
import assert from "node:assert/strict";
import { config } from "dotenv";
import { DateTime } from "luxon";
import Stripe from "stripe";

const backend = fileURLToPath(new URL("../", import.meta.url));
process.chdir(backend);
config({ path: resolve(backend, ".env"), quiet: true });
Object.assign(process.env, {
  PORT: "3445",
  APP_ORIGIN: "https://localhost:3445",
  CORS_ORIGINS: "https://localhost:3445",
  ENABLE_EMAIL_BONUS: "true",
  ENABLE_JOBS: "true",
  SMTP_HOST: "127.0.0.1",
  SMTP_PORT: "1025",
  SMTP_SECURE: "false",
  SMTP_USER: "",
  SMTP_PASSWORD: "",
  SMTP_FROM: "Travel verification <verification@travel.example.test>",
});
const ca = readFileSync(resolve(backend, process.env.TLS_CERT_PATH));
const local = resolve(backend, ".local");
mkdirSync(local, { recursive: true });
const run = randomBytes(5).toString("hex"),
  password = `V9${randomBytes(24).toString("hex")}`;
const runStarted = new Date();
const clientDate =
  process.env.VERIFICATION_CLIENT_DATE ||
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(
    runStarted,
  );
const state = { run, password, ids: {}, actors: {} };
const report = {
  clientDate,
  outcome: "running",
  run,
  bonuses: {},
  receipts: {},
  environment:
    "Atlas application database; actual Stripe sandbox and signed webhooks; actual SMTP delivered to loopback-only Mailpit test inbox",
  fixtureLimits:
    "Review eligibility uses a clearly synthetic completed-stay fixture. SMTP is a local development test inbox, not delivery to a personal or internet mailbox. No manual/student review is asserted.",
};
let app,
  db,
  stage = "setup";
const save = () =>
  writeFileSync(
    resolve(local, `bonus-run-${run}.json`),
    JSON.stringify(state, null, 2),
  );
const pass = (id, detail) => {
  report.bonuses[id] = { status: "passed", detail };
  console.log(`PASS: ${id} ${detail}`);
};
async function until(label, fn, timeout = 120000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const value = await fn();
    if (value) return value;
    await new Promise((done) => setTimeout(done, 1500));
  }
  throw new Error(`TIMEOUT_${label}`);
}
function call(method, path, actor, body) {
  return new Promise((done, reject) => {
    const isForm = body instanceof URLSearchParams;
    const raw =
      body === undefined
        ? undefined
        : isForm
          ? body.toString()
          : JSON.stringify(body);
    const req = https.request(
      {
        hostname: "localhost",
        family: 4,
        port: 3445,
        path: `/api${path}`,
        method,
        ca,
        headers: {
          ...(raw
            ? {
                "Content-Type": isForm
                  ? "application/x-www-form-urlencoded"
                  : "application/json",
                "Content-Length": Buffer.byteLength(raw),
              }
            : {}),
          ...(actor
            ? { Cookie: actor.cookie, "X-CSRF-Token": actor.csrf }
            : {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("error", reject);
        res.on("end", () => {
          const bytes = Buffer.concat(chunks);
          let json;
          try {
            json = JSON.parse(bytes.toString());
          } catch {}
          done({ status: res.statusCode, headers: res.headers, json, bytes });
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(15000, () => req.destroy(new Error("HTTP_TIMEOUT")));
    if (raw) req.write(raw);
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
  const result = await call(method, path, actor, body);
  if (result.status !== expected)
    throw new Error(`HTTP_${result.status}_EXPECTED_${expected}_${stage}`);
  return result;
}
async function login(email, currentPassword = password) {
  const r = await api("POST", "/auth/login", undefined, {
    email,
    password: currentPassword,
  });
  return {
    cookie: r.headers["set-cookie"].map((v) => v.split(";")[0]).join("; "),
    csrf: r.json.csrfToken,
    id: r.json.user.id,
  };
}
async function mail(address, subject, filter = () => true) {
  return until("SMTP_DELIVERY", async () => {
    const index = await (
      await fetch("http://127.0.0.1:8025/api/v1/messages?limit=200")
    ).json();
    for (const item of index.messages || []) {
      if (
        !item.To?.some((to) => to.Address === address) ||
        !item.Subject.includes(subject)
      )
        continue;
      const message = await (
        await fetch(`http://127.0.0.1:8025/api/v1/message/${item.ID}`)
      ).json();
      if (filter(message)) return message;
    }
  });
}
const tokenFrom = (message) =>
  message.Text.match(/[?&]token=([a-f0-9]{64})/)?.[1];
async function register(address) {
  await api("POST", "/auth/register", undefined, {
    name: "Release Test Traveler",
    email: address,
    password,
    consent: true,
  });
  return login(address);
}
async function pay(booking, actor, type, stripe) {
  await api("POST", `/bookings/${type}/${booking._id}/accept-policies`, actor, {
    confirm: true,
  });
  const payment = (
    await api("POST", "/payments", actor, { type, bookingId: booking._id })
  ).json;
  await stripe.paymentIntents.confirm(
    payment.stripePaymentId,
    { payment_method: "pm_card_visa" },
    { idempotencyKey: `bonus:${run}:${booking._id}` },
  );
  const readConfirmation = async () => {
    const b = (
      await api(
        "GET",
        `/${type === "flight" ? "flight" : "hotel"}-bookings/${booking._id}`,
        actor,
      )
    ).json;
    return b.status === "Confirmed" && b;
  };
  let confirmed;
  try {
    confirmed = await until("SIGNED_PAYMENT", readConfirmation, 20000);
  } catch (error) {
    if (error.message !== "TIMEOUT_SIGNED_PAYMENT") throw error;
    const events = await stripe.events.list({
      type: "payment_intent.succeeded",
      limit: 100,
    });
    const event = events.data.find(
      (item) => item.data.object.id === payment.stripePaymentId,
    );
    assert.ok(event);
    // Ask Stripe to redeliver its real event through the official CLI. Never
    // generate a local signature, synthetic success event or processEvent call.
    await new Promise((done, reject) => {
      const cli = spawn(
        process.env.STRIPE_CLI_PATH || "stripe",
        ["events", "resend", event.id, "--confirm"],
        {
          env: {
            ...process.env,
            STRIPE_API_KEY: process.env.STRIPE_SECRET_KEY,
          },
          windowsHide: true,
          stdio: "ignore",
        },
      );
      cli.on("error", () =>
        reject(new Error("STRIPE_EVENT_REDELIVERY_FAILED")),
      );
      cli.on("close", (code) =>
        code === 0
          ? done()
          : reject(new Error("STRIPE_EVENT_REDELIVERY_FAILED")),
      );
    });
    (report.localDeliveryRecoveries ||= []).push(event.id);
    confirmed = await until("SIGNED_PAYMENT", readConfirmation);
  }
  const events = await stripe.events.list({
    type: "payment_intent.succeeded",
    limit: 100,
  });
  const event = events.data.find(
    (e) => e.data.object.id === payment.stripePaymentId,
  );
  assert.ok(
    event &&
      (await db
        .model("StripeEvent")
        .exists({ eventId: event.id, processedAt: { $exists: true } })),
  );
  report.receipts[booking._id] = {
    intentId: payment.stripePaymentId,
    signedEventId: event.id,
  };
  return confirmed;
}
try {
  assert.ok(process.env.STRIPE_SECRET_KEY?.startsWith("sk_test_"));
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
    timeout: 15000,
    maxNetworkRetries: 2,
  });
  assert.equal((await stripe.balance.retrieve()).livemode, false);
  const { createApp } = await import("../dist/bootstrap.js");
  const { Db } = await import("../dist/database.js");
  const { passwordHash } = await import("../dist/auth/auth.js");
  ({ app } = await createApp({
    logger: false,
    httpsOptions: {
      key: readFileSync(resolve(backend, process.env.TLS_KEY_PATH)),
      cert: ca,
    },
  }));
  db = app.get(Db);
  await app.listen(3445, "127.0.0.1");
  const adminEmail = `bonus-admin-${run}@example.test`,
    ownerEmail = `bonus-owner-${run}@example.test`,
    otherEmail = `bonus-other-${run}@example.test`;
  await db.model("User").create({
    name: "Synthetic release administrator",
    email: adminEmail,
    role: "Admin",
    passwordHash: await passwordHash(password),
    consentAt: new Date(),
    emailVerified: true,
  });
  const admin = await login(adminEmail);
  const carrier = (
    await api("POST", "/airlines", admin, {
      name: `Bonus Verification ${run}`,
      code: `B${run.slice(0, 7).toUpperCase()}`,
    })
  ).json;
  const hotel = (
    await api("POST", "/hotels", admin, {
      name: `Bonus Verification Hotel ${run}`,
      address: "Synthetic verification fixture",
      city: "cairo",
      country: "EG",
      description: "Sandbox verification",
      starClass: 3,
      amenities: [],
      timezone: "Africa/Cairo",
    })
  ).json;
  state.ids = { carrier: carrier._id, hotel: hotel._id };
  save();
  const mods = {};
  for (const [key, role, provider] of [
    ["air", "AirlineModerator", carrier],
    ["hotel", "HotelModerator", hotel],
  ]) {
    const email = `bonus-${key}-${run}@example.test`;
    await api("POST", "/admin/moderators", admin, {
      name: `Synthetic ${key} moderator`,
      email,
      role,
      providerId: provider._id,
      temporaryPassword: password,
    });
    const first = await login(email);
    await api("PATCH", "/auth/change-password", first, {
      currentPassword: password,
      newPassword: password + "A",
    });
    mods[key] = await login(email, password + "A");
    await mail(email, "Moderator account created");
  }
  const tiers = [
    { threshold: 0, refundPercent: 0 },
    { threshold: 7, refundPercent: 75 },
  ];
  await api("PUT", `/airlines/${carrier._id}/cancellation-policy`, mods.air, {
    tiers,
  });
  await api("PUT", `/hotels/${hotel._id}/policies`, mods.hotel, {
    tiers,
    checkInTime: "14:00",
    checkOutTime: "12:00",
  });
  const day = DateTime.now()
      .setZone("Africa/Cairo")
      .plus({ days: 21 })
      .toISODate(),
    end = DateTime.fromISO(day).plus({ days: 2 }).toISODate();
  const flights = [];
  for (const [index, price] of [10, 15, 8].entries()) {
    const f = (
      await api("POST", "/flights", mods.air, {
        airlineId: carrier._id,
        flightNumber: `BR${run}${index}`,
        departureAirport: "CAI",
        arrivalAirport: "DXB",
        departureLocal: `${day}T10:00`,
        arrivalLocal: `${day}T16:00`,
      })
    ).json;
    await api("POST", `/flights/${f._id}/cabins`, mods.air, {
      category: "Economy",
      capacity: 4,
      price,
      freeBags: 1,
      bagWeightKg: 23,
    });
    flights.push(f);
  }
  const room = (
    await api("POST", `/hotels/${hotel._id}/rooms`, mods.hotel, {
      number: "BR101",
      type: "Single",
      beds: 1,
      occupancy: 1,
      price: 5,
    })
  ).json;
  await api(
    "POST",
    `/hotels/${hotel._id}/rooms/${room._id}/availability`,
    mods.hotel,
    { kind: "availability", ranges: [{ start: day, end }] },
  );
  const flightDto = (f) => ({
    segments: [{ flightId: f._id, cabin: "Economy" }],
    passengers: [
      {
        fullName: "Synthetic Traveler",
        dateOfBirth: "1990-01-01",
        identityNumber: `BONUS-${run}`,
        type: "adult",
        extraBags: 0,
      },
    ],
  });
  stage = "email_verification";
  let owner = await register(ownerEmail);
  await api("POST", "/flight-bookings/hold", owner, flightDto(flights[0]), 403);
  const verification = await mail(ownerEmail, "Verify your email");
  assert.ok(tokenFrom(verification));
  await api("GET", `/auth/verify-email?token=${tokenFrom(verification)}`);
  await api(
    "GET",
    `/auth/verify-email?token=${tokenFrom(verification)}`,
    undefined,
    undefined,
    400,
  );
  pass(
    "ACC-02",
    "Actual SMTP verification link, booking gate and single use passed",
  );
  stage = "password_recovery";
  await api("POST", "/auth/forgot-password", undefined, { email: ownerEmail });
  const firstReset = await mail(ownerEmail, "Reset", () => true);
  const firstToken = tokenFrom(firstReset);
  assert.ok(firstToken);
  const resetForm = await api(
    "GET",
    `/auth/reset-password?token=${firstToken}`,
  );
  assert.match(resetForm.bytes.toString(), /name="newPassword"/);
  assert.equal(resetForm.headers["cache-control"], "no-store");
  await api("POST", "/auth/forgot-password", undefined, { email: ownerEmail });
  const secondReset = await mail(
    ownerEmail,
    "Reset",
    (m) => tokenFrom(m) !== firstToken,
  );
  await api(
    "POST",
    "/auth/reset-password",
    undefined,
    { token: firstToken, newPassword: password + "B" },
    400,
  );
  await api("POST", "/auth/reset-password", undefined, {
    token: tokenFrom(secondReset),
    newPassword: password + "B",
  });
  await api(
    "POST",
    "/auth/reset-password",
    undefined,
    new URLSearchParams({
      token: tokenFrom(secondReset),
      newPassword: password + "B",
    }),
    400,
  );
  owner = await login(ownerEmail, password + "B");
  pass(
    "ACC-07",
    "Actual SMTP reset links, supersession and single use passed; expiry boundary also covered by the automated suite",
  );
  stage = "flight_changes";
  const held = (
    await api("POST", "/flight-bookings/hold", owner, flightDto(flights[0]))
  ).json;
  const paid = await pay(held, owner, "flight", stripe),
    reference = paid.reference;
  const change = (
    await api("PATCH", `/flight-bookings/${held._id}/change-flight`, owner, {
      segments: [{ flightId: flights[1]._id, cabin: "Economy" }],
    })
  ).json;
  const before = (await api("GET", `/flight-bookings/${held._id}`, owner)).json;
  assert.equal(before.snapshot.segments[0].flightId, flights[0]._id);
  assert.equal(change.difference, 5);
  await api("POST", `/flight-changes/${change._id}/accept-policies`, owner, {
    confirm: true,
  });
  const difference = (
    await api("POST", `/flight-changes/${change._id}/payment`, owner)
  ).json;
  await stripe.paymentIntents.confirm(
    difference.stripePaymentId,
    { payment_method: "pm_card_visa" },
    { idempotencyKey: `bonus-change:${run}` },
  );
  await until(
    "FARE_CHANGE",
    async () =>
      (await db.get("FlightChange", change._id)).status === "Committed",
  );
  const lower = (
    await api("PATCH", `/flight-bookings/${held._id}/change-flight`, owner, {
      segments: [{ flightId: flights[2]._id, cabin: "Economy" }],
    })
  ).json;
  assert.equal(lower.difference, -7);
  const refund = await until("FARE_REFUND", async () => {
    const r = await db
      .model("Refund")
      .findOne({ bookingId: held._id, status: "Refunded" });
    return r?.stripeId && r;
  });
  const actualRefund = await stripe.refunds.retrieve(refund.stripeId);
  assert.equal(actualRefund.amount, 700);
  assert.equal(actualRefund.status, "succeeded");
  assert.equal(
    (await api("GET", `/flight-bookings/${held._id}`, owner)).json.reference,
    reference,
  );
  report.receipts.fareChange = {
    intentId: difference.stripePaymentId,
    refundId: refund.stripeId,
    additionalMinor: 500,
    refundedMinor: 700,
  };
  pass(
    "FLT-27",
    "Actual Stripe higher-fare payment, lower-fare refund and preserved original reference/inventory passed",
  );
  stage = "seat_selection";
  const other = await register(otherEmail),
    otherVerification = await mail(otherEmail, "Verify your email");
  await api("GET", `/auth/verify-email?token=${tokenFrom(otherVerification)}`);
  const otherHeld = (
    await api("POST", "/flight-bookings/hold", other, flightDto(flights[2]))
  ).json;
  await pay(otherHeld, other, "flight", stripe);
  const seatResults = await Promise.all([
    call("PATCH", `/flight-bookings/${held._id}/seat`, owner, {
      flightId: flights[2]._id,
      labels: ["1A"],
    }),
    call("PATCH", `/flight-bookings/${otherHeld._id}/seat`, other, {
      flightId: flights[2]._id,
      labels: ["1A"],
    }),
  ]);
  assert.deepEqual(seatResults.map((r) => r.status).sort(), [200, 409]);
  assert.equal(
    await db
      .model("Seat")
      .countDocuments({ flightId: flights[2]._id, label: "1A" }),
    1,
  );
  await api("GET", `/flight-bookings/${held._id}/seats`, owner);
  pass(
    "FLT-28",
    "Actual Atlas contention allowed exactly one booking to claim the seat",
  );
  stage = "hotel_and_review_reply";
  const hotelHold = (
    await api("POST", "/hotel-bookings", owner, {
      hotelId: hotel._id,
      checkIn: day,
      checkOut: end,
      rooms: [
        { roomId: room._id, guests: [{ name: "Synthetic Guest", age: 30 }] },
      ],
    })
  ).json;
  await pay(hotelHold, owner, "hotel", stripe);
  const historical = await db.model("Booking").create({
    type: "hotel",
    userId: owner.id,
    providerIds: [hotel._id],
    status: "Completed",
    amount: 5,
    currency: "USD",
    startsAt: new Date(Date.now() - 3 * 86400000),
    endsAt: new Date(Date.now() - 86400000),
    snapshot: {
      hotelId: hotel._id,
      timezone: "Africa/Cairo",
      checkOut: DateTime.now().minus({ days: 1 }).toISODate(),
    },
    policySnapshot: {},
  });
  const review = (
    await api("POST", `/hotel-bookings/${historical.id}/review`, owner, {
      rating: 5,
      body: "Synthetic completed-stay review",
    })
  ).json;
  await api("POST", `/reviews/${review._id}/reply`, mods.hotel, {
    body: "Thank you for your review.",
  });
  assert.equal(
    (await db.get("Review", review._id)).reply,
    "Thank you for your review.",
  );
  pass(
    "HTL-26",
    "Assigned hotel moderator replied through HTTP; eligibility used a labeled synthetic completed-stay fixture",
  );
  stage = "itinerary_links_and_pdf";
  let itinerary = (
    await api("POST", "/itineraries", owner, {
      title: "Release verification trip",
      countries: ["EG", "AE"],
      startDate: day,
    })
  ).json;
  itinerary = (
    await api("POST", `/itineraries/${itinerary._id}/days`, owner, {
      city: "cairo",
      notes: "Arrival and hotel check-in",
    })
  ).json;
  itinerary = (
    await api("POST", `/itineraries/${itinerary._id}/days`, owner, {
      city: "dubai",
      notes: "Explore the city",
    })
  ).json;
  const itineraryId = itinerary._id,
    firstDay = itinerary.days[0]._id,
    secondDay = itinerary.days[1]._id;
  await api(
    "POST",
    `/itineraries/${itineraryId}/days/${firstDay}/activities`,
    owner,
    {
      name: "Museum visit",
      description: "Explore the local collection",
      time: "10:00",
      cost: 2,
      currency: "USD",
    },
  );
  await api(
    "POST",
    `/itineraries/${itineraryId}/days/${firstDay}/budgets`,
    owner,
    { category: "Food", amount: 5, currency: "USD" },
  );
  await api("POST", `/itineraries/${itineraryId}/transport-costs`, owner, {
    mode: "Bus",
    fromCity: "cairo",
    toCity: "dubai",
    amount: 3,
    currency: "USD",
    dayId: secondDay,
  });
  for (const bookingId of [held._id, hotelHold._id])
    await api("POST", `/itineraries/${itineraryId}/bookings`, owner, {
      bookingId,
      dayId: firstDay,
    });
  await api(
    "POST",
    `/itineraries/${itineraryId}/bookings`,
    owner,
    { bookingId: held._id, dayId: firstDay },
    400,
  );
  assert.equal(
    (await api("GET", `/itineraries/${itineraryId}/budget-summary`, owner)).json
      .total,
    28,
  );
  await api("PATCH", `/itineraries/${itineraryId}`, owner, {
    visibility: "Public",
  });
  const clone = (await api("POST", `/itineraries/${itineraryId}/clone`, other))
    .json;
  assert.equal((await db.get("Itinerary", clone._id)).bookingLinks.length, 0);
  assert.equal(
    (await api("GET", `/itineraries/${clone._id}/budget-summary`, other)).json
      .total,
    28,
  );
  pass(
    "ITN-27",
    "Real confirmed bookings counted once; independent clone copied costs without private booking links",
  );
  const pdf = await api("GET", `/itineraries/${itineraryId}/pdf`, owner);
  assert.equal(pdf.bytes.subarray(0, 5).toString(), "%PDF-");
  mkdirSync(resolve(backend, "../tmp/pdfs"), { recursive: true });
  writeFileSync(
    resolve(backend, "../tmp/pdfs/verified-bonus-itinerary.pdf"),
    pdf.bytes,
  );
  pass(
    "ITN-28",
    "Actual HTTP PDF export received; visual inspection recorded separately",
  );
  stage = "blog_and_favourites";
  const post = (
    await api("POST", "/posts", owner, {
      title: "Release verification travel story",
      body: "A synthetic demonstration of the linked itinerary.",
      status: "Published",
      tags: ["verification"],
    })
  ).json;
  await api("PATCH", `/posts/${post._id}/itinerary`, owner, { itineraryId });
  assert.equal(
    String((await db.get("Post", post._id)).itineraryId),
    itineraryId,
  );
  await api("GET", `/posts/${post._id}`);
  pass("BLG-13", "Published post attached the public itinerary through HTTP");
  await api("POST", "/favourites", owner, {
    type: "hotel",
    resourceId: hotel._id,
  });
  await api("POST", "/favourites", owner, {
    type: "itinerary",
    resourceId: itineraryId,
  });
  assert.equal((await api("GET", "/favourites", owner)).json.total, 2);
  const fav = (await api("GET", "/favourites", owner)).json.items.find(
    (item) => item.type === "hotel" && item.resourceId === hotel._id,
  );
  await api("DELETE", `/favourites/${fav._id}`, owner);
  assert.equal((await api("GET", "/favourites", owner)).json.total, 1);
  pass(
    "BON-02",
    "Saved/listed hotel and public itinerary favourites and removed one",
  );
  stage = "notifications_and_analytics";
  await api("POST", `/flight-bookings/${otherHeld._id}/cancel`, other, {
    confirm: true,
  });
  const cancelledRefund = await until("CANCEL_REFUND", async () => {
    const r = await db
      .model("Refund")
      .findOne({ bookingId: otherHeld._id, status: "Refunded" });
    return r?.stripeId && r;
  });
  assert.equal(
    (await stripe.refunds.retrieve(cancelledRefund.stripeId)).amount,
    600,
  );
  const rows = [];
  // Analytics groups bookings by their UTC creation dates. A run can span midnight.
  const from = runStarted.toISOString().slice(0, 10);
  const to = new Date().toISOString().slice(0, 10);
  let page = 1,
    pages = 1;
  do {
    const data = (
      await api(
        "GET",
        `/admin/analytics?from=${from}&to=${to}&page=${page}`,
        admin,
      )
    ).json;
    rows.push(...data.items);
    pages = data.pages;
    page++;
  } while (page <= pages);
  const financial = rows.find((r) => r.providerId === carrier._id);
  assert.equal(financial.grossPayments, 23);
  assert.equal(financial.refunds, 13);
  assert.equal(financial.netRevenue, 10);
  report.receipts.analytics = {
    providerId: carrier._id,
    grossPayments: 23,
    refunds: 13,
    netRevenue: 10,
    currency: "USD",
  };
  pass(
    "BON-01",
    "Atlas provider analytics reconciled with actual sandbox payments/refunds: gross 23, refunds 13, net 10 USD",
  );
  await api("PATCH", `/flights/${flights[2]._id}`, mods.air, {
    departureLocal: `${day}T10:30`,
    arrivalLocal: `${day}T16:30`,
  });
  await api("PATCH", `/admin/providers/hotel/${hotel._id}/deactivate`, admin);
  await api("PATCH", `/admin/providers/hotel/${hotel._id}/reactivate`, admin);
  await api("PATCH", `/admin/accounts/${other.id}/suspend`, admin);
  for (const [address, pattern] of [
    [ownerEmail, /confirmed/i],
    [otherEmail, /cancelled/i],
    [otherEmail, /refund/i],
    [ownerEmail, /schedule/i],
    [ownerEmail, /deactivated/i],
    [otherEmail, /suspended/i],
  ])
    await mail(address, "Travel Platform notification", (m) =>
      pattern.test(m.Text),
    );
  await api("GET", "/notifications", owner);
  pass(
    "GEN-01-B",
    "Actual SMTP delivered invitations plus confirmation, cancellation, refund, schedule and suspension/provider-status notifications to the test inbox",
  );
  state.actors = {
    admin: { email: adminEmail, password },
    owner: { email: ownerEmail, password: password + "B" },
    other: { email: otherEmail, password },
  };
  Object.assign(state.ids, {
    itinerary: itineraryId,
    post: post._id,
    flightBooking: held._id,
    hotelBooking: hotelHold._id,
  });
  save();
  assert.equal(Object.keys(report.bonuses).length, 11);
  report.outcome = "passed";
} catch (error) {
  report.outcome = "failed";
  report.failedStage = stage;
  const knownFailure =
    /^(HTTP_\d+_EXPECTED_\d+_[A-Za-z_]+|TIMEOUT_[A-Z_]+|STRIPE_EVENT_REDELIVERY_FAILED)$/;
  report.error =
    error.name === "AssertionError"
      ? "ASSERTION_FAILED"
      : knownFailure.test(String(error.message))
        ? error.message
        : "EXTERNAL_OR_CONFIGURATION_FAILURE";
  console.error(
    JSON.stringify({
      outcome: "failed",
      stage,
      errorType: error.name,
      error: report.error,
    }),
  );
  process.exitCode = 1;
  save();
} finally {
  writeFileSync(
    resolve(
      backend,
      `../docs/milestone-1/evidence/bonus-verification-${clientDate}.json`,
    ),
    JSON.stringify(report, null, 2) + "\n",
  );
  await app?.close();
}
