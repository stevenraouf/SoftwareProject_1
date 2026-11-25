import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import https from "node:https";
import { ensureLocalMailpit } from "../backend/scripts/local-mailpit.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const readEnv = (file) =>
  existsSync(file) ? parseEnv(readFileSync(file, "utf8")) : {};
const settings = readEnv(resolve(root, ".env.local"));
const configuration = resolve(
  root,
  settings.AERIS_BACKEND_ENV || "backend/.env",
);
if (!existsSync(configuration))
  throw Error("Configure backend/.env from .env.example first. See README.md.");
const backendEnv = readEnv(configuration);
const apiPort = Number(settings.AERIS_API_PORT || backendEnv.PORT || 3443),
  webPort = Number(settings.AERIS_FRONTEND_PORT || 3000);
const origin = "https://localhost:" + apiPort,
  webOrigin = "https://localhost:" + webPort;
if (
  !existsSync(resolve(root, "backend/dist/main.js")) ||
  !existsSync(resolve(root, "frontend/.next/BUILD_ID"))
)
  throw Error(
    "Build the backend and frontend before starting AERIS. See README.md.",
  );
const cert = resolve(root, ".certs/localhost.pem"),
  key = resolve(root, ".certs/localhost-key.pem");
if (!existsSync(cert) || !existsSync(key))
  throw Error("Generate local certificates with npm run certs in backend.");
const children = [];
let stopping = false;
function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill();
  process.exitCode = code;
}
function run(file, cwd, extra) {
  const child = spawn(process.execPath, [file], {
    cwd: resolve(root, cwd),
    stdio: "inherit",
    env: { ...process.env, ...extra },
  });
  children.push(child);
  child.on("error", (error) => {
    console.error(error.message);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) stop(code || 0);
  });
}
function probe(path, server = origin, checkFrontendConfig = false) {
  return new Promise((done) => {
    const req = https.get(
      server + path,
      { ca: readFileSync(cert), family: 4, timeout: 2500 },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          try {
            done(
              checkFrontendConfig
                ? res.statusCode === 200 &&
                    data.startsWith("window.aerisConfig = ") &&
                    data.includes(JSON.stringify(origin + "/api"))
                : JSON.parse(data),
            );
          } catch {
            done(null);
          }
        });
      },
    );
    req.on("timeout", () => req.destroy());
    req.on("error", () => done(null));
  });
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
if (process.argv.includes("--stripe")) {
  run("scripts/stripe-listen.mjs", "backend", {
    AERIS_BACKEND_ENV: configuration,
    AERIS_API_PORT: String(apiPort),
  });
} else {
  await ensureLocalMailpit(resolve(root, "backend"), backendEnv);
  const running = await probe("/api/openapi.json");
  if (running && !running.paths?.["/api/admin/providers"])
    throw Error(
      "Another API version is using this port. Set AERIS_API_PORT in the project's .env.local or stop the older instance.",
    );
  if (!running) {
    run("dist/main.js", "backend", {
      ...backendEnv,
      PORT: String(apiPort),
      APP_ORIGIN: origin,
      WEB_APP_ORIGIN: webOrigin,
      ENABLE_JOBS: process.env.AERIS_JOBS || backendEnv.ENABLE_JOBS || "true",
      CORS_ORIGINS: [
        ...new Set([
          ...(backendEnv.CORS_ORIGINS || "").split(",").filter(Boolean),
          origin,
          webOrigin,
        ]),
      ].join(","),
      TLS_KEY_PATH: key,
      TLS_CERT_PATH: cert,
    });
    let ready = false;
    for (let attempt = 0; attempt < 45 && !stopping; attempt++) {
      const health = await probe("/api/health");
      if (health?.database) {
        ready = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 1000));
    }
    if (!ready) {
      stop(1);
      throw Error(
        "The backend did not connect to its database. Check the backend terminal output.",
      );
    }
  }
  if (!stopping) {
    if (!(await probe("/aeris-config.js", webOrigin, true)))
      run("scripts/serve.mjs", "frontend", {
        FRONTEND_PORT: String(webPort),
        AERIS_API_BASE_URL: origin + "/api",
        FRONTEND_TLS_CERT: cert,
        FRONTEND_TLS_KEY: key,
      });
    console.log("AERIS " + webOrigin + " | Swagger " + origin + "/api/docs");
  }
}
