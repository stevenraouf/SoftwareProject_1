import { config } from "dotenv";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";

// Resolve the private file independently of the caller's working directory.
config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });
const uri = process.env.MONGODB_URI || "";
let client;
let session;
try {
  let parsed;
  try {
    parsed = new URL(uri);
  } catch {
    throw new Error("CONFIG");
  }
  if (
    parsed.protocol !== "mongodb+srv:" ||
    !parsed.hostname.endsWith(".mongodb.net") ||
    !parsed.username || !parsed.password ||
    /<|>/.test(uri) ||
    /^(USERNAME|REPLACE.*)$/i.test(decodeURIComponent(parsed.username)) ||
    /^(PASSWORD|REPLACE.*)$/i.test(decodeURIComponent(parsed.password))
  ) throw new Error("CONFIG");
  const database = decodeURIComponent(parsed.pathname.slice(1));
  if (!/^[A-Za-z0-9_-]+$/.test(database) || ["admin", "local", "config"].includes(database)) {
    throw new Error("DATABASE");
  }
  client = new mongoose.mongo.MongoClient(uri, {
    serverSelectionTimeoutMS: 12000,
    connectTimeoutMS: 12000,
    maxPoolSize: 2,
    appName: "travel-platform-atlas-check",
  });
  await client.connect();
  const db = client.db(database);
  await db.command({ ping: 1 });
  console.log("PASS: Atlas connection and authentication.");
  const hello = await db.command({ hello: 1 });
  if (!(hello.setName || hello.msg === "isdbgrid") || hello.logicalSessionTimeoutMinutes == null) {
    throw new Error("TRANSACTIONS");
  }
  session = client.startSession();
  session.startTransaction({ readConcern: { level: "snapshot" } });
  await db.collection("countries").findOne({}, { session, projection: { _id: 1 } });
  await session.abortTransaction();
  console.log("PASS: Read-only transaction on the application database (aborted; no data written).");
  console.log("Next: configure ADMIN_EMAIL and ADMIN_PASSWORD, run npm.cmd run seed, then start the backend.");
  console.log("This check does not establish write permissions, indexes, seeding or end-to-end booking acceptance.");
} catch (error) {
  // Do not echo driver errors: they can contain connection details or credentials.
  const code = error?.code;
  const message = error?.message;
  const reason = message === "CONFIG"
    ? "Set a complete Atlas mongodb+srv URI in backend/.env; replace all placeholders. Do not send it in chat."
    : message === "DATABASE"
      ? "Include the application database in the URI path, for example /travel_platform before the query string."
      : message === "TRANSACTIONS"
        ? "The deployment did not advertise transaction-capable sessions. Check the selected Atlas deployment."
        : code === 18 || error?.codeName === "AuthenticationFailed"
          ? "Database authentication failed. Check the database user and URL-encoded password (separate from your Atlas login)."
          : code === 13
            ? "Database access was denied. Check the database user's role on the application database."
            : "Connection or transaction check failed. Check the Atlas IP access list, database user, cluster status, URI and network/DNS access.";
  console.error(`NOT VERIFIED: ${reason}`);
  process.exitCode = 1;
} finally {
  if (session) await session.endSession();
  if (client) await client.close();
}
