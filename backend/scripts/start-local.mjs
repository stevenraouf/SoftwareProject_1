import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import https from "node:https";
import { ensureLocalMailpit, listening } from "./local-mailpit.mjs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

const backend = fileURLToPath(new URL("../", import.meta.url));

function healthy(port, ca) {
  return new Promise((resolveResult) => {
    const req = https.get(
      { hostname: "localhost", family: 4, port, path: "/api/health", ca },
      (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => {
          try {
            resolveResult(
              res.statusCode === 200 && JSON.parse(body).database === true,
            );
          } catch {
            resolveResult(false);
          }
        });
        res.on("error", () => resolveResult(false));
      },
    );
    req.once("error", () => resolveResult(false));
    req.setTimeout(8000, () => req.destroy());
  });
}

function run(args, executable = process.execPath) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(executable, args, {
      cwd: backend,
      stdio: "inherit",
    });
    const interrupt = () => child.kill("SIGINT");
    const terminate = () => child.kill("SIGTERM");
    process.once("SIGINT", interrupt);
    process.once("SIGTERM", terminate);
    const cleanup = () => {
      process.removeListener("SIGINT", interrupt);
      process.removeListener("SIGTERM", terminate);
    };
    child.once("error", () => {
      cleanup();
      reject(new Error("Cannot launch Node.js for the backend."));
    });
    child.once("exit", (code, signal) => {
      cleanup();
      resolveResult({
        code: code ?? (signal ? 0 : 1),
        interrupted: Boolean(signal),
      });
    });
  });
}

async function main() {
  if (!existsSync(resolve(backend, ".env")))
    throw new Error(
      "Configure backend/.env using the README before starting Swagger.",
    );
  config({ path: resolve(backend, ".env"), quiet: true });
  if (
    process.env.NODE_RUNTIME_PATH &&
    resolve(process.env.NODE_RUNTIME_PATH).toLowerCase() !==
      resolve(process.execPath).toLowerCase()
  ) {
    if (!existsSync(process.env.NODE_RUNTIME_PATH))
      throw new Error(
        "The configured NODE_RUNTIME_PATH was not found. Install the Node version in .nvmrc or update that private setting.",
      );
    const result = await run(
      [fileURLToPath(import.meta.url), ...process.argv.slice(2)],
      process.env.NODE_RUNTIME_PATH,
    );
    process.exitCode = result.code;
    return;
  }
  if (process.argv.includes("--stripe")) {
    const result = await run([resolve(backend, "scripts/stripe-listen.mjs")]);
    process.exitCode = result.code;
    return;
  }
  await ensureLocalMailpit(backend, process.env);
  const port = Number(process.env.PORT || 3443);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("Set PORT to a valid port number in backend/.env.");
  if (
    !process.env.TLS_KEY_PATH ||
    !process.env.TLS_CERT_PATH ||
    !existsSync(resolve(backend, process.env.TLS_KEY_PATH)) ||
    !existsSync(resolve(backend, process.env.TLS_CERT_PATH))
  )
    throw new Error(
      "Local HTTPS certificates are missing. Run npm.cmd run certs from backend and check the TLS paths in .env.",
    );
  const url = `https://localhost:${port}/api/docs`;
  if (await listening(port)) {
    if (
      !(await healthy(
        port,
        readFileSync(resolve(backend, process.env.TLS_CERT_PATH)),
      ))
    )
      throw new Error(
        `Port ${port} is in use, but the Atlas-backed API is not ready. Inspect the existing server terminal before retrying.`,
      );
    console.log(
      `Travel API is already running.\nSwagger: ${url}\nUse the existing server; a second copy was not started.`,
    );
    return;
  }
  const compiler = resolve(backend, "node_modules/typescript/bin/tsc");
  if (!existsSync(compiler))
    throw new Error(
      "Dependencies are missing. Run npm.cmd ci from backend first.",
    );
  console.log(
    "Building the backend. Keep this terminal open while using Swagger.",
  );
  const build = await run([compiler, "-p", "tsconfig.build.json"]);
  if (build.interrupted) return;
  if (build.code !== 0)
    throw new Error(
      "Build failed. Fix the compiler errors shown above before starting Swagger.",
    );
  console.log(
    `Starting the HTTPS API. Wait for the Swagger URL below before refreshing your browser.\nExpected URL: ${url}`,
  );
  const server = await run([resolve(backend, "dist/main.js")]);
  process.exitCode = server.code;
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
