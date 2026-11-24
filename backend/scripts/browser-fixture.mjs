import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { MongoMemoryReplSet } from "mongodb-memory-server";
if (!process.env.AERIS_TEST_PASSWORD)
  throw Error("Use the frontend browser test runner.");
Object.assign(process.env, {
  NODE_ENV: "test",
  ENABLE_JOBS: "false",
  ENABLE_EMAIL_BONUS: "false",
  APP_ORIGIN: "https://localhost:3445",
  CORS_ORIGINS: "https://localhost:3300",
  JWT_SECRET: randomBytes(48).toString("hex"),
  ADMIN_EMAIL: "admin@example.test",
  ADMIN_PASSWORD: process.env.AERIS_TEST_PASSWORD,
  STRIPE_SECRET_KEY: "",
  STRIPE_WEBHOOK_SECRET: "",
  SMTP_HOST: "",
});
const repl = await MongoMemoryReplSet.create({
  binary: { version: "8.2.6" },
  replSet: { count: 1, storageEngine: "wiredTiger" },
});
process.env.MONGODB_URI = repl.getUri("aeris_browser_test");
let app;
async function shutdown() {
  try {
    await app?.close();
  } finally {
    await repl.stop();
  }
}
for (const sig of ["SIGINT", "SIGTERM"])
  process.once(sig, () => shutdown().finally(() => process.exit(0)));
try {
  console.log("Disposable replica set ready; seeding test accounts.");
  await promisify(execFile)(process.execPath, ["dist/seed.js", "--demo"], {
    timeout: 65000,
  });
  console.log("Browser test accounts seeded.");
  const { createApp } = await import("../dist/bootstrap.js");
  const { Db } = await import("../dist/database.js");
  const { BookingsService } = await import("../dist/bookings/bookings.js");
  const { Inventory } = await import("../dist/bookings/inventory.js");
  ({ app } = await createApp({
    logger: false,
    httpsOptions: {
      key: await readFile("../.certs/localhost-key.pem"),
      cert: await readFile("../.certs/localhost.pem"),
    },
  }));
  const db = app.get(Db);
  const user = await db
    .model("User")
    .findOne({ email: "traveler@example.test" });
  const flight = await db.model("Flight").findOne({ flightNumber: "DEMO100" });
  const reservation = await app.get(BookingsService).holdFlight(
    { id: user.id, role: "User", emailVerified: true },
    {
      segments: [{ flightId: flight.id, cabin: "Economy" }],
      passengers: [
        {
          fullName: "Browser Test Traveler",
          dateOfBirth: "1990-03-01",
          identityNumber: "TEST-ONLY",
          type: "adult",
          extraBags: 0,
        },
      ],
    },
  );
  await db.transaction(async (session) => {
    await app.get(Inventory).convert(reservation.snapshot, session);
    await db
      .model("Booking")
      .updateOne(
        { _id: reservation._id },
        {
          $set: {
            status: "Confirmed",
            reference: "BR-TEST-001",
            confirmedAt: new Date(),
          },
          $unset: { holdExpiresAt: 1 },
        },
        { session },
      );
  });
  await app.listen(3445, "127.0.0.1");
  console.log("Disposable browser fixture ready");
} catch (e) {
  await shutdown();
  throw e;
}
