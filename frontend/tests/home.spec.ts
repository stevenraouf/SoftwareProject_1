import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";

// Use software rendering for these Windows layout captures.
if (process.platform === "win32")
  test.use({ launchOptions: { args: ["--disable-gpu"] } });

test("the desktop cabin has eight local photographs and localized arrivals", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1360, height: 1080 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Where will your window take you?" }),
  ).toBeVisible();
  await expect(page.locator(".destination-rail button")).toHaveCount(8);
  await expect
    .poll(() =>
      page
        .locator(".surround")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(1000);
  await page.evaluate(() => document.fonts.ready);
  // Keep the whole homepage in the visible capture surface in headed Edge.
  await expect(page.getByRole("contentinfo")).toBeInViewport({ ratio: 1 });
  await mkdir("../docs/milestone-2/evidence/screens", { recursive: true });
  await page.screenshot({
    path: "../docs/milestone-2/evidence/screens/home-desktop.png",
    animations: "disabled",
    timeout: 10000,
  });
  for (const [country, code, hello] of [
    ["Japan", "HND", "こんにちは"],
    ["Egypt", "CAI", "أهلًا"],
    ["UAE", "DXB", "مرحبًا"],
    ["Germany", "FRA", "Hallo"],
    ["France", "CDG", "Bonjour"],
    ["UK", "LHR", "Hello"],
    ["USA", "JFK", "Hi there"],
    ["Saudi Arabia", "RUH", "يا هلا"],
  ]) {
    await page.getByRole("button", { name: country, exact: true }).click();
    await page.getByRole("link", { name: "Explore " + country }).click();
    await expect(
      page.getByRole("heading", { name: hello, exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel("Arrival airport")).toHaveValue(code);
    await page.getByRole("link", { name: "Back to explore" }).click();
  }
});
test("the phone menu and same-page flight shortcut work without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.evaluate(() => document.fonts.ready);
  await expect
    .poll(() =>
      page
        .locator(".scene")
        .evaluate((img: HTMLImageElement) => img.naturalWidth),
    )
    .toBeGreaterThan(500);
  await page.screenshot({
    path: "../docs/milestone-2/evidence/screens/home-phone.png",
    fullPage: true,
  });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(390);
  await page.getByRole("link", { name: "Find a flight ↓" }).click();
  await expect(page).toHaveURL(/#find-flight/);
  await page.getByRole("button", { name: "Menu" }).click();
  await page
    .getByRole("navigation", { name: "Phone menu" })
    .getByRole("link", { name: "Stays" })
    .click();
  await expect(page).toHaveURL(/\/stays$/);
});
test("tablet windows fit the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 834, height: 1112 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Next destination" }).click();
  await expect(page.locator(".window-name")).toContainText("Tokyo");
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(834);
  await expect(
    page.getByRole("button", { name: "Search flights" }),
  ).toBeVisible();
});
