// Verify the configured application and historical sandbox records without creating bookings or charges.
import https from "node:https";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import Stripe from "stripe";
const root = fileURLToPath(new URL("../../", import.meta.url));
const envAt = (p) => (existsSync(p) ? parseEnv(readFileSync(p, "utf8")) : {});
const local = envAt(resolve(root, ".env.local"));
const settings = envAt(
  resolve(root, local.AERIS_BACKEND_ENV || "backend/.env"),
);
const ca = readFileSync(resolve(root, ".certs/localhost.pem"));
const api =
  "https://localhost:" +
  (local.AERIS_API_PORT || settings.PORT || 3443) +
  "/api";
const site = "https://localhost:" + (local.AERIS_FRONTEND_PORT || 3000);
const result = {
  checkedAt: new Date().toISOString(),
  environment: "Running D application; read-only checks",
  checks: {},
  browserPayment: "No new browser card transaction attempted",
};
function get(url) {
  return new Promise((done, reject) => {
    const request = https.get(url, { ca, family: 4, timeout: 12000 }, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => done({ status: res.statusCode, data }));
    });
    request.on("error", reject);
    request.on("timeout", () => request.destroy(new Error("timeout")));
  });
}
async function check(label, test) {
  try {
    result.checks[label] = Boolean(await test());
  } catch {
    result.checks[label] = false;
  }
}
await check("httpsFrontend", async () => {
  const r = await get(site);
  return (
    r.status === 200 &&
    r.data.includes("Where will your") &&
    r.data.includes(api)
  );
});
await check("atlasConnected", async () => {
  const r = await get(api + "/health");
  return (
    (settings.MONGODB_URI || "")
      .split("://")
      .at(1)
      ?.split("/")[0]
      .split("@")
      .at(-1)
      ?.split(",")
      .every((host) => host.split(":")[0].endsWith(".mongodb.net")) &&
    r.status === 200 &&
    JSON.parse(r.data).database === true
  );
});
await check("airportReference", async () =>
  JSON.parse((await get(api + "/airports")).data).items.some(
    (a) => a.iata_code === "CAI",
  ),
);
await check("publicJournal", async () =>
  Array.isArray(JSON.parse((await get(api + "/posts")).data).items),
);
await check(
  "staffDirectoryProtected",
  async () => (await get(api + "/admin/providers")).status === 401,
);
const publicKey = envAt(
  resolve(root, "frontend/.env.local"),
).NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
result.sandboxPublishableKeyConfigured = Boolean(
  publicKey?.startsWith("pk_test_"),
);
await check("stripeSandboxAuthentication", async () => {
  if (!settings.STRIPE_SECRET_KEY?.startsWith("sk_test_")) return false;
  const stripe = new Stripe(settings.STRIPE_SECRET_KEY, {
    timeout: 10000,
    maxNetworkRetries: 1,
  });
  return (await stripe.balance.retrieve()).livemode === false;
});
await check("historicalSandboxRefunds", async () => {
  if (!result.checks.stripeSandboxAuthentication) return false;
  const stripe = new Stripe(settings.STRIPE_SECRET_KEY, {
    timeout: 10000,
    maxNetworkRetries: 1,
  });
  const old = JSON.parse(
    readFileSync(
      resolve(
        root,
        "docs/milestone-1/evidence/stripe-account-verification.json",
      ),
      "utf8",
    ),
  );
  const records = Object.values(old.cases).filter((r) => r.refundId);
  if (records.length !== 3) return false;
  for (const record of records) {
    const refund = await stripe.refunds.retrieve(record.refundId);
    if (refund.status !== "succeeded" || refund.amount !== record.amountMinor)
      return false;
  }
  return true;
});
writeFileSync(
  resolve(root, "docs/milestone-2/evidence/live-checks.json"),
  JSON.stringify(result, null, 2) + "\n",
);
console.log(JSON.stringify(result.checks));
if (!Object.values(result.checks).every(Boolean)) process.exitCode = 1;
