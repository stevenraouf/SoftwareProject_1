import { readFileSync, writeFileSync } from "node:fs";
const raw = JSON.parse(
  readFileSync(
    new URL("../test-results/browser-results.json", import.meta.url),
    "utf8",
  ),
);
const cases = [];
function collect(suite) {
  for (const spec of suite.specs || [])
    for (const test of spec.tests)
      cases.push({
        spec: spec.file,
        name: spec.title,
        status: test.results.at(-1)?.status,
        durationMs: test.results.at(-1)?.duration,
      });
  for (const nested of suite.suites || []) collect(nested);
}
for (const s of raw.suites) collect(s);
const summary = {
  executedAt: raw.stats.startTime,
  browser: "Microsoft Edge",
  scope:
    "Production Next.js application, HTTPS NestJS API, isolated MongoDB replica set, synthetic accounts. One explicitly seeded confirmed ticket. No live card entry.",
  passed: cases.filter((c) => c.status === "passed").length,
  total: cases.length,
  cases,
};
writeFileSync(
  new URL(
    "../../docs/milestone-2/evidence/browser-tests.json",
    import.meta.url,
  ),
  JSON.stringify(summary, null, 2) + "\n",
);
console.log(summary.passed + "/" + summary.total + " browser workflows passed");
