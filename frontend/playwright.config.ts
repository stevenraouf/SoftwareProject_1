import { defineConfig } from "@playwright/test";
import { randomBytes } from "node:crypto";
process.env.AERIS_TEST_PASSWORD ||= "Demo9" + randomBytes(15).toString("hex");
process.env.NEXT_PUBLIC_API_BASE_URL = "https://localhost:3445/api";
export default defineConfig({
  testDir: "./tests",
  workers: 1,
  retries: 0,
  timeout: 60000,
  expect: { timeout: 12000 },
  reporter: [
    ["list"],
    ["json", { outputFile: "test-results/browser-results.json" }],
  ],
  use: {
    baseURL: "https://localhost:3300",
    ignoreHTTPSErrors: true,
    channel: process.env.AERIS_BROWSER_CHANNEL || "msedge",
    trace: "off",
  },
  webServer: [
    {
      command: "node scripts/browser-fixture.mjs",
      cwd: "../backend",
      url: "https://localhost:3445/api/health",
      ignoreHTTPSErrors: true,
      stdout: "pipe",
      stderr: "pipe",
      reuseExistingServer: false,
      timeout: 150000,
    },
    {
      command: "node scripts/serve.mjs",
      url: "https://localhost:3300",
      ignoreHTTPSErrors: true,
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        FRONTEND_PORT: "3300",
        AERIS_API_BASE_URL: "https://localhost:3445/api",
      },
    },
  ],
});
