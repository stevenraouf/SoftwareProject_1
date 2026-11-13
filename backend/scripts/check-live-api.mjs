import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";
import assert from "node:assert/strict";
import { parse } from "dotenv";

const backend = fileURLToPath(new URL("../", import.meta.url));
const env = parse(readFileSync(resolve(backend, ".env"), "utf8"));
const ca = readFileSync(resolve(backend, env.TLS_CERT_PATH));
const checks = [];
async function get(path) {
  return new Promise((resolveResult, reject) => {
    const req = https.get({ hostname: "localhost", family: 4, port: Number(env.PORT || 3443), path, ca }, (res) => {
      let body = "";
      res.on("data", (chunk) => body += chunk);
      res.on("end", () => resolveResult({ status: res.statusCode, body }));
    });
    req.on("error", reject);
    req.setTimeout(12000, () => req.destroy(new Error("HTTP_TIMEOUT")));
  });
}
try {
  const health = await get("/api/health");
  assert.equal(health.status, 200);
  const dependencies = JSON.parse(health.body);
  assert.equal(dependencies.database, true);
  checks.push({ path: "/api/health", status: health.status, databaseConnected: true });
  for (const path of ["/api/airports", "/api/countries", "/api/cities", "/api/attractions", "/api/currencies", "/api/posts", "/api/itineraries/public/search", "/api/docs", "/api/docs/swagger-ui-init.js", "/api/openapi.json"]) {
    const response = await get(path);
    assert.equal(response.status, 200);
    if (["/api/airports", "/api/countries", "/api/cities", "/api/attractions"].includes(path)) {
      const page = JSON.parse(response.body);
      assert(page.total >= 8 && page.items.length <= 10);
    }
    if (path === "/api/openapi.json") {
      const spec = JSON.parse(response.body);
      const methods = new Set(["get", "post", "patch", "delete", "put"]);
      const operations = Object.values(spec.paths).flatMap((item) => Object.entries(item).filter(([method]) => methods.has(method)).map(([, operation]) => operation));
      assert.equal(operations.length, 147);
      for (const operation of operations)
        for (const code of [400, 401, 403, 404, 409, 500, 503])
          assert.equal(operation.responses[code].content["application/json"].example.statusCode, code);
    }
    checks.push({ path, status: response.status });
  }
  const report = {
    clientDate: "2026-11-14", transport: "HTTPS with explicit local certificate verification",
    target: "Running localhost backend connected to the user's configured Atlas database",
    outcome: "passed", checks,
    externalServiceConfiguration: { stripe: dependencies.stripeConfigured, webhook: dependencies.webhookConfigured, smtp: dependencies.smtpConfigured },
    scope: "Public GET requests only; no credentials, cookies or response bodies retained. Does not repeat all 147 mutable workflows on Atlas.",
  };
  writeFileSync(new URL("../../docs/milestone-1/evidence/live-api-readonly.json", import.meta.url), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify({ outcome: report.outcome, liveChecks: checks.length, databaseConnected: true }));
} catch (error) {
  console.error(JSON.stringify({ outcome: "failed", errorType: error?.constructor?.name, assertion: error?.code === "ERR_ASSERTION" }));
  process.exitCode = 1;
}
