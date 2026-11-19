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
    const parts = /^(mongodb\+srv|mongodb):\/\/([^/]+)(\/.*)$/.exec(uri);
    if (!parts) throw new Error("CONFIG");
    const separator = parts[2].lastIndexOf("@");
    if (separator < 1) throw new Error("CONFIG");
    const credentials = parts[2].slice(0, separator);
    const hosts = parts[2].slice(separator + 1).split(",");
    const endpoints = hosts.map((host) => new URL(`mongodb://${host}/`));
    if (endpoints.some((host) => !host.hostname.endsWith(".mongodb.net")))
      throw new Error("CONFIG");
    if (parts[1] === "mongodb+srv" && (hosts.length !== 1 || endpoints[0].port))
      throw new Error("CONFIG");
    parsed = new URL(`${parts[1]}://${credentials}@${hosts[0]}${parts[3]}`);
    if (parts[1] === "mongodb" &&
        parsed.searchParams.get("tls") !== "true" &&
        parsed.searchParams.get("ssl") !== "true") throw new Error("CONFIG");
  } catch {
    throw new Error("CONFIG");
  }
  if (
    !["mongodb+srv:", "mongodb:"].includes(parsed.protocol) ||
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
    ? "Set a complete Atlas URI in backend/.env; use mongodb+srv or a standard mongodb URI with TLS enabled. Replace all placeholders; do not send credentials in chat."
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
