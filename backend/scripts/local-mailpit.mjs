import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import net from "node:net";
import { resolve } from "node:path";

export function listening(port) {
  return new Promise((resolveResult, reject) => {
    const socket = net.createConnection({ host: "127.0.0.1", port });
    socket.setTimeout(3000);
    socket.once("connect", () => {
      socket.destroy();
      resolveResult(true);
    });
    socket.once("error", (error) => {
      socket.destroy();
      if (error.code === "ECONNREFUSED") resolveResult(false);
      else reject(new Error("Cannot check the local service port."));
    });
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error("The local service port check timed out."));
    });
  });
}

async function usesMailbox(httpPort, database) {
  try {
    const response = await fetch(
      "http://127.0.0.1:" + httpPort + "/api/v1/info",
      {
        signal: AbortSignal.timeout(8000),
      },
    );
    if (!response.ok) return false;
    const info = await response.json();
    if (typeof info.Database !== "string" || !info.Version) return false;
    const samePath = (path) =>
      process.platform === "win32"
        ? resolve(path).toLowerCase()
        : resolve(path);
    return samePath(info.Database) === samePath(database);
  } catch {
    return false;
  }
}

export async function ensureLocalMailpit(backend, env) {
  if (env.ENABLE_EMAIL_BONUS !== "true" || env.SMTP_TEST_INBOX !== "mailpit")
    return;
  if (!["127.0.0.1", "localhost"].includes(env.SMTP_HOST))
    throw new Error(
      "The Mailpit development profile requires a loopback SMTP_HOST.",
    );
  const smtpPort = Number(env.SMTP_PORT || 1025);
  const httpPort = Number(env.MAILPIT_HTTP_PORT || 8025);
  if (
    ![smtpPort, httpPort].every(
      (p) => Number.isInteger(p) && p > 0 && p < 65536,
    ) ||
    smtpPort === httpPort
  )
    throw new Error(
      "Configure different valid SMTP and local Mailpit HTTP ports.",
    );
  const database = resolve(backend, ".local/release-mailpit.db");
  const mailUrl = "http://127.0.0.1:" + httpPort;
  if ((await listening(smtpPort)) || (await listening(httpPort))) {
    if (
      !(await listening(smtpPort)) ||
      !(await usesMailbox(httpPort, database))
    )
      throw new Error(
        "A different service or mailbox is using the configured local mail ports.",
      );
  } else {
    if (!env.MAILPIT_PATH || !existsSync(env.MAILPIT_PATH))
      throw new Error("Configure MAILPIT_PATH for the local test inbox.");
    mkdirSync(resolve(backend, ".local"), { recursive: true });
    const child = spawn(
      env.MAILPIT_PATH,
      [
        "--listen",
        "127.0.0.1:" + httpPort,
        "--smtp",
        "127.0.0.1:" + smtpPort,
        "--database",
        database,
      ],
      { cwd: backend, windowsHide: true, detached: true, stdio: "ignore" },
    );
    let failed = false;
    child.on("error", () => {
      failed = true;
    });
    child.unref();
    const deadline = Date.now() + 15000;
    while (!failed && Date.now() < deadline && !(await listening(smtpPort)))
      await new Promise((done) => setTimeout(done, 250));
    if (
      !(await listening(smtpPort)) ||
      !(await usesMailbox(httpPort, database))
    )
      throw new Error(
        "The local SMTP test inbox could not start with the configured project database.",
      );
  }
  console.log("SMTP test inbox: " + mailUrl + " (local delivery only)");
}
