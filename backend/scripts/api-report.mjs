import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../../", import.meta.url);
const read = (path) => JSON.parse(readFileSync(new URL(path, root), "utf8"));
const coverage = read("docs/milestone-1/evidence/api-route-coverage.json");
const tests = read("docs/milestone-1/evidence/api-test-results.json");
const stripeEvidence =
  "docs/milestone-1/evidence/stripe-account-verification.json";
const stripe = existsSync(new URL(stripeEvidence, root))
  ? read(stripeEvidence)
  : undefined;
const bonusEvidence =
  "docs/milestone-1/evidence/bonus-verification-2026-11-19.json";
const bonuses = existsSync(new URL(bonusEvidence, root))
  ? read(bonusEvidence)
  : undefined;
const bonusStatus =
  bonuses?.outcome === "passed"
    ? `All 11 additional live bonus cases passed on ${bonuses.clientDate}, including actual SMTP delivery to a local development test inbox. Personal/internet mailbox delivery was not tested. The sole student's own review remains pending.`
    : "Actual SMTP delivery and the sole student's review remain pending.";
const externalStatus =
  stripe?.outcome === "passed"
    ? `A separate real Stripe sandbox payment/refund/expiry run passed on ${stripe.clientDate}; see evidence/stripe-account-verification.json. ${bonusStatus}`
    : "Separate real Stripe/SMTP verification and the sole student's review remain pending.";
const checks = (context) =>
  coverage.operations.filter(
    (o) => o.authorizationChecks[context] !== undefined,
  ).length;
const lines = [
  "# API test report",
  "",
  `Checked on ${coverage.clientDate} (Africa/Cairo client date).`,
  "",
  `${tests.numPassedTests}/${tests.numTotalTests} automated tests passed; ${tests.numFailedTests} failed. ` +
    `${coverage.exercisedOperations}/${coverage.totalOperations} documented operations were exercised; ` +
    `${coverage.successfulOperations} returned a successful HTTP response in a functional workflow.`,
  "",
  `${checks("anonymous")} anonymous-access checks, ${checks("wrong-role")} incorrect-role checks, and ${checks("missing-csrf")} missing-CSRF checks were performed. ` +
    "The refresh endpoint rejects missing CSRF as 401; other protected writes reject it as 403.",
  "",
  "## Test scope",
  "",
  "The automated suite uses an isolated, disposable MongoDB 8.2.6 replica set. It does not execute destructive workflows against the Atlas application database. Stripe PaymentIntents/refunds/webhooks and SMTP use fixtures or adapter mocks; these are not proof of real account integration. FX success/outage fixtures test the API contract; the separate HTTPS smoke check exercises the real public FX service.",
  "",
  `The ${coverage.totalOperations} functional operation workflows were executed through HTTP automation. This run does not constitute a manual click-through in Swagger or the student's own review. Earlier VS Code browser inspection is documented separately in REVIEW_AND_VERIFICATION.md. Read-only live-service checks are recorded separately in evidence/live-api-readonly.json when available.`,
  "",
  "A successful workflow for each operation does not establish exhaustive input, ownership, concurrency, or requirement coverage. The suite also tests representative business failures, ownership, privacy, contention, payment races and restart recovery. " +
    externalStatus,
  "",
  "## Reproduce",
  "",
  "From backend, run npm.cmd run test:api. See README for TEST_TMP_DIR and the MongoDB executable prerequisite on this Windows machine. Run npm.cmd run typecheck, npm.cmd run lint and npm.cmd run build separately. The operation-coverage gate fails if a newly documented operation has no successful HTTP workflow.",
  "",
  "## Operation evidence",
  "",
  "Successful codes and expected access denials are observations from this run. Empty access-check columns indicate that the particular check does not apply in the documented global permissions matrix; ownership and provider checks are exercised in the workflow tests.",
  "",
  "| Method | Path | Successful codes | Anonymous | Wrong role | Missing CSRF |",
  "| --- | --- | --- | --- | --- | --- |",
];
for (const row of coverage.operations) {
  const codes =
    Object.keys(row.statuses)
      .filter((code) => +code >= 200 && +code < 300)
      .join(", ") || "None";
  const a = row.authorizationChecks;
  lines.push(
    `| ${row.method} | \`${row.path}\` | ${codes} | ${a.anonymous ?? "-"} | ${a["wrong-role"] ?? "-"} | ${a["missing-csrf"] ?? "-"} |`,
  );
}
lines.push(
  "",
  "Source: backend/test/integration/platform.spec.ts and backend/test/unit/rules.spec.ts. Machine-readable results: evidence/api-test-results.json and evidence/api-route-coverage.json.",
  "",
);
const output = new URL("docs/milestone-1/API_TEST_REPORT.md", root);
writeFileSync(output, lines.join("\n"));
console.log(`API report written: ${fileURLToPath(output)}`);
if (
  tests.numFailedTests ||
  coverage.successfulOperations !== coverage.totalOperations
)
  process.exitCode = 1;
