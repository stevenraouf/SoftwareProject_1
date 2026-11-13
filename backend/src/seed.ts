import { fileURLToPath } from "node:url";
import "dotenv/config";
import { NestFactory } from "@nestjs/core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { AppModule } from "./app.module.js";
import { Db } from "./database.js";
import { passwordHash } from "./auth/auth.js";
import { DateTime } from "luxon";

export async function seedReference(db: Db) {
  const reference = JSON.parse(
    readFileSync(resolve("data/reference.json"), "utf8"),
  );
  for (const [table, model, key] of [
    ["countries", "Country", "code"],
    ["cities", "City", "city_id"],
    ["airports", "Airport", "iata_code"],
    ["attractions", "Attraction", "attraction_id"],
  ]) {
    for (const row of reference[table])
      await db
        .model(model)
        .updateOne({ [key]: row[key] }, { $set: row }, { upsert: true });
  }
}
export async function seedAdmin(db: Db) {
  const email = process.env.ADMIN_EMAIL,
    password = process.env.ADMIN_PASSWORD;
  if (
    !email ||
    !password ||
    !/^(?=.*[A-Za-z])(?=.*\d).{8,128}$/.test(password) ||
    password.includes("REPLACE")
  )
    throw new Error(
      "Configure ADMIN_EMAIL and a strong ADMIN_PASSWORD locally before seeding",
    );
  await db.model("User").updateOne(
    { email: email.toLowerCase() },
    {
      $setOnInsert: {
        name: "Platform Administrator",
        email: email.toLowerCase(),
        role: "Admin",
        passwordHash: await passwordHash(password),
        consentAt: new Date(),
        emailVerified: true,
      },
    },
    { upsert: true },
  );
}
async function demo(db: Db) {
  if (process.env.NODE_ENV === "production")
    throw new Error("Demo seeding is forbidden in production");
  const airline = await db.model("Provider").findOneAndUpdate(
    { type: "airline", code: "DEMO" },
    {
      $setOnInsert: {
        type: "airline",
        code: "DEMO",
        name: "Demo Airways",
        extraBagPrice: 25,
        maxExtraBags: 2,
        cancellationTiers: [
          { threshold: 0, refundPercent: 0 },
          { threshold: 2, refundPercent: 50 },
          { threshold: 7, refundPercent: 90 },
        ],
      },
    },
    { upsert: true, returnDocument: "after" },
  );
  let hotel = await db
    .model("Provider")
    .findOne({ type: "hotel", name: "Demo Cairo Hotel" });
  if (!hotel)
    hotel = await db.model("Provider").create({
      type: "hotel",
      name: "Demo Cairo Hotel",
      address: "Demo street",
      city: "cairo",
      country: "EG",
      description: "Demonstration data only",
      starClass: 4,
      amenities: ["WiFi"],
      timezone: "Africa/Cairo",
      cancellationTiers: [
        { threshold: 0, refundPercent: 0 },
        { threshold: 2, refundPercent: 100 },
      ],
    });
  for (const [email, name, role, providerId] of [
    ["traveler@example.test", "Demo Traveler", "User", undefined],
    [
      "airline@example.test",
      "Demo Airline Moderator",
      "AirlineModerator",
      airline._id,
    ],
    ["hotel@example.test", "Demo Hotel Moderator", "HotelModerator", hotel._id],
  ]) {
    await db.model("User").updateOne(
      { email },
      {
        $setOnInsert: {
          email,
          name,
          role,
          providerId,
          passwordHash: await passwordHash(process.env.ADMIN_PASSWORD!),
          consentAt: new Date(),
          emailVerified: true,
          forcePasswordChange: role !== "User",
        },
      },
      { upsert: true },
    );
  }
  const start = DateTime.now()
    .setZone("Africa/Cairo")
    .plus({ days: 14 })
    .startOf("day");
  for (const [flightNumber, dep, arr, date, zone] of [
    ["DEMO100", "CAI", "DXB", start.plus({ hours: 10 }), "Africa/Cairo"],
    ["DEMO101", "DXB", "CAI", start.plus({ days: 7, hours: 15 }), "Asia/Dubai"],
  ] as const) {
    const depart = date.setZone(zone, { keepLocalTime: true });
    await db.model("Flight").updateOne(
      {
        airlineId: airline._id,
        flightNumber,
        departureDate: depart.toISODate(),
      },
      {
        $setOnInsert: {
          airlineId: airline._id,
          flightNumber,
          departureAirport: dep,
          arrivalAirport: arr,
          departureDate: depart.toISODate(),
          departureAt: depart.toJSDate(),
          arrivalAt: depart.plus({ hours: 3 }).toJSDate(),
          cabins: [
            {
              category: "Economy",
              capacity: 12,
              price: 180,
              freeBags: 1,
              bagWeightKg: 23,
            },
          ],
        },
      },
      { upsert: true },
    );
  }
  for (const number of ["101", "102", "103"])
    await db.model("Room").updateOne(
      { hotelId: hotel._id, number },
      {
        $setOnInsert: {
          hotelId: hotel._id,
          number,
          type: "Double",
          beds: 2,
          occupancy: 3,
          price: 90,
          availability: [
            {
              start: start.minus({ days: 1 }).toISODate(),
              end: start.plus({ days: 90 }).toISODate(),
            },
          ],
        },
      },
      { upsert: true },
    );
  console.log(
    "Demo accounts seeded: traveler@example.test, airline@example.test, hotel@example.test. Initial password comes from ADMIN_PASSWORD; moderators must change it.",
  );
}
async function main() {
  process.env.ENABLE_JOBS = "false";
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ["error"],
  });
  try {
    const db = app.get(Db);
    await Promise.all(
      db.connection.modelNames().map((n) => db.model(n).init()),
    );
    await seedReference(db);
    await seedAdmin(db);
    if (process.argv.includes("--demo")) await demo(db);
    console.log("Reference and administrator seeds completed idempotently");
  } finally {
    await app.close();
  }
}
if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
)
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
