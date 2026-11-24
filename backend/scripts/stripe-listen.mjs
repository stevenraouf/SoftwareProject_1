import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { parse } from "dotenv";

const envPath = process.env.AERIS_BACKEND_ENV || fileURLToPath(new URL("../.env", import.meta.url));
const env = parse(readFileSync(envPath, "utf8"));
if (!env.STRIPE_SECRET_KEY?.startsWith("sk_test_")) {
  console.error(
    "Configure STRIPE_SECRET_KEY with your private sandbox sk_test_ key in backend/.env. No connection attempted.",
  );
  process.exit(1);
}
const binary = env.STRIPE_CLI_PATH || process.env.STRIPE_CLI_PATH || "stripe";
if (binary !== "stripe" && !existsSync(binary)) {
  console.error("The configured Stripe CLI executable was not found.");
  process.exit(1);
}
const port = Number(process.env.AERIS_API_PORT || env.PORT || 3443);
const child = spawn(
  binary,
  [
    "listen",
    "--forward-to",
    `https://localhost:${port}/api/payments/webhook`,
    "--skip-verify",
    "--events",
    "payment_intent.succeeded,payment_intent.payment_failed,payment_intent.canceled,refund.created,refund.updated,refund.failed",
    "--color",
    "off",
  ],
  {
    env: { ...process.env, STRIPE_API_KEY: env.STRIPE_SECRET_KEY },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let buffered = "",
  saved = false;
function inspect(chunk) {
  buffered = (buffered + chunk.toString()).slice(-8192);
  const secret = buffered.match(/whsec_[A-Za-z0-9_]+(?=\s|\x1b|\))/);
  if (secret && !saved) {
    // Re-read at write time so user edits to other environment fields are preserved.
    const contents = readFileSync(envPath, "utf8");
    const line = `STRIPE_WEBHOOK_SECRET=${secret[0]}`;
    writeFileSync(
      envPath,
      /^STRIPE_WEBHOOK_SECRET=.*$/m.test(contents)
        ? contents.replace(/^STRIPE_WEBHOOK_SECRET=.*$/m, () => line)
        : contents + "\n" + line + "\n",
    );
    saved = true;
    console.log(
      "Stripe listener ready. Signing secret saved privately in backend/.env; restart the backend before verification.",
    );
  }
  // Output only delivery summaries, never arbitrary CLI lines, keys or bodies.
  const lines = buffered.split(/\r?\n/);
  buffered = lines.pop() || "";
  for (const line of lines) {
    const delivery = line.match(/\[(\d{3})\].*POST.*\/api\/payments\/webhook/);
    if (delivery) console.log(`Webhook forwarded: HTTP ${delivery[1]}`);
  }
}
child.stdout.on("data", inspect);
child.stderr.on("data", inspect);
child.on("error", () => {
  console.error("Stripe CLI could not start. Check STRIPE_CLI_PATH locally.");
  process.exitCode = 1;
});
child.on("exit", (code) => {
  if (!saved)
    console.error(
      "Listener did not become ready. Check the test key, account and network; raw CLI output was withheld.",
    );
  process.exitCode = code || (saved ? 0 : 1);
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill());
