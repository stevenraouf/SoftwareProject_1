// Runs the compiled backend over real HTTPS against an isolated disposable database.
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { randomBytes } from "node:crypto";
import https from "node:https";
import assert from "node:assert/strict";
import { createApp } from "../dist/bootstrap.js";
import { Db } from "../dist/database.js";
import { Ops } from "../dist/ops.js";
import { seedAdmin, seedReference } from "../dist/seed.js";

const root = resolve(process.env.TEST_TMP_DIR || tmpdir());
await mkdir(root, { recursive: true });
const dir = await mkdtemp(join(root, "travel-https-smoke-"));
assert(dir.startsWith(root + "/") || dir.startsWith(root + "\\"));
let repl, app;
const steps = [];
try {
  process.env.NODE_ENV = "test";
  process.env.ENABLE_JOBS = "false";
  process.env.ENABLE_EMAIL_BONUS = "false";
  process.env.JWT_SECRET = randomBytes(48).toString("hex");
  process.env.ADMIN_EMAIL = "https-smoke@example.test";
  process.env.ADMIN_PASSWORD = `Test9${randomBytes(20).toString("hex")}`;
  process.env.APP_ORIGIN = "https://localhost:3444";
  process.env.CORS_ORIGINS = process.env.APP_ORIGIN;
  repl = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger" },
    instanceOpts: [{ dbPath: dir }],
    binary: { version: "8.2.6" },
  });
  process.env.MONGODB_URI = repl.getUri("https_smoke");
  const certificate = await readFile("../.certs/localhost.pem");
  ({ app } = await createApp({
    logger: false,
    httpsOptions: {
      key: await readFile("../.certs/localhost-key.pem"),
      cert: certificate,
    },
  }));
  await seedReference(app.get(Db));
  await seedAdmin(app.get(Db));
  await app.listen(3444, "127.0.0.1");
  async function call(path, method = "GET", body, headers = {}) {
    const raw = body === undefined ? undefined : JSON.stringify(body);
    return new Promise((resolveResult, reject) => {
      const req = https.request(
        {
          hostname: "localhost",
          family: 4,
          port: 3444,
          path: `/api${path}`,
          method,
          ca: certificate,
          headers: {
            ...(raw
              ? {
                  "Content-Type": "application/json",
                  "Content-Length": Buffer.byteLength(raw),
                }
              : {}),
            ...headers,
          },
        },
        (res) => {
          let data = "";
          res.on("data", (b) => {
            data += b;
          });
          res.on("end", () => {
            let json;
            try {
              json = JSON.parse(data);
            } catch {
              /* HTML */
            }
            resolveResult({
              status: res.statusCode,
              headers: res.headers,
              data,
              json,
            });
          });
        },
      );
      req.on("error", reject);
      if (raw) req.write(raw);
      req.end();
    });
  }
  const docs = await call("/docs");
  assert.equal(docs.status, 200);
  assert.match(docs.data, /swagger-ui/i);
  steps.push("Compiled NestJS Swagger page served over HTTPS");
  const init = await call("/docs/swagger-ui-init.js");
  assert.equal(init.status, 200);
  assert.match(init.data, /csrf_token/);
  assert.doesNotMatch(init.data, /documentCookie/);
  steps.push("Swagger CSRF interceptor is self-contained in served JavaScript");
  const login = await call("/auth/login", "POST", {
    email: process.env.ADMIN_EMAIL,
    password: process.env.ADMIN_PASSWORD,
  });
  assert.equal(login.status, 201);
  const cookies = login.headers["set-cookie"];
  assert(
    cookies.find(
      (v) =>
        v.startsWith("access_token=") &&
        /HttpOnly; Secure; SameSite=Lax/.test(v),
    ),
  );
  const cookie = cookies.map((v) => v.split(";")[0]).join("; ");
  const csrf = login.json.csrfToken;
  assert.equal(
    (await call("/auth/me", "GET", undefined, { Cookie: cookie })).status,
    200,
  );
  steps.push(
    "Real HTTPS login sets secure httpOnly cookies and authenticated /auth/me works",
  );
  assert.equal(
    (
      await call(
        "/users/me",
        "PATCH",
        { name: "HTTPS smoke" },
        { Cookie: cookie },
      )
    ).status,
    403,
  );
  assert.equal(
    (
      await call(
        "/users/me",
        "PATCH",
        { name: "HTTPS smoke" },
        { Cookie: cookie, "X-CSRF-Token": csrf },
      )
    ).status,
    200,
  );
  steps.push(
    "CSRF enforcement rejects missing header and permits matching header over HTTPS",
  );
  assert.equal((await call("/health")).json.status, "ok");
  const rateResult = await app.get(Ops).refreshRates();
  const cached = await app.get(Ops).rates();
  assert(cached.rates.USD === 1 && cached.rates.EGP > 0);
  steps.push(
    `Real FXRatesAPI response fetched and cached through backend (rate date ${rateResult.date})`,
  );
  const report = {
    checkedAt: new Date().toISOString(),
    node: process.version,
    database: "Disposable MongoDB 8.2.6 replica set, not Atlas",
    transport: "HTTPS with explicit verification of the generated localhost certificate",
    outcome: "passed",
    checks: steps,
    browserUiInteraction:
      "Not performed; HTML and Swagger JavaScript inspected through HTTPS responses",
  };
  await mkdir("../docs/milestone-1", { recursive: true });
  await writeFile(
    "../docs/milestone-1/https-smoke.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify({ outcome: "passed", checks: steps.length }));
} finally {
  await app?.close();
  await repl?.stop();
  await rm(dir, { recursive: true, force: true });
}
