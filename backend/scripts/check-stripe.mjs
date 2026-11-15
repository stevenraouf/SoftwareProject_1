import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { parse } from "dotenv";
import Stripe from "stripe";

const env = parse(readFileSync(new URL("../.env", import.meta.url), "utf8"));
const evidence = {
  clientDate: process.env.VERIFICATION_CLIENT_DATE || new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date()),
  outcome: "not_verified",
  testKeyConfigured: env.STRIPE_SECRET_KEY?.startsWith("sk_test_") || false,
  webhookSecretConfigured:
    env.STRIPE_WEBHOOK_SECRET?.startsWith("whsec_") || false,
  externalAuthentication: false,
  scope:
    "Read-only Stripe sandbox API authentication. Does not verify booking payment, webhook delivery or refunds.",
};
try {
  if (!evidence.testKeyConfigured) throw new Error("MISSING_TEST_KEY");
  const stripe = new Stripe(env.STRIPE_SECRET_KEY, {
    timeout: 15000,
    maxNetworkRetries: 1,
  });
  const balance = await stripe.balance.retrieve();
  if (balance.livemode !== false) throw new Error("NOT_TEST_MODE");
  evidence.externalAuthentication = true;
  evidence.outcome = evidence.webhookSecretConfigured
    ? "authentication_passed"
    : "authentication_passed_listener_pending";
  console.log(
    "PASS: real Stripe sandbox API authentication. No balances or credentials displayed.",
  );
} catch (error) {
  const known = ["MISSING_TEST_KEY", "NOT_TEST_MODE"].includes(error?.message)
    ? error.message
    : "STRIPE_AUTHENTICATION_OR_NETWORK_FAILED";
  evidence.reason = known;
  console.error(
    `NOT VERIFIED: ${known}. Configure the sandbox key privately in backend/.env.`,
  );
  process.exitCode = 1;
}
const dir = new URL("../../docs/milestone-1/evidence/", import.meta.url);
mkdirSync(dir, { recursive: true });
writeFileSync(
  new URL("stripe-readiness.json", dir),
  JSON.stringify(evidence, null, 2) + "\n",
);
