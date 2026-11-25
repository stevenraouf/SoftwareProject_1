import { expect, test } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import {
  initialDraft,
  sampleDate,
  withDestination,
} from "../src/components/portal-draft";

// Use software rendering for these Windows layout captures.
if (process.platform === "win32")
  test.use({ launchOptions: { args: ["--disable-gpu"] } });

test("the desktop cabin has eight local photographs and localized arrivals", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1360, height: 1080 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("heading", { name: "Where will your window take you?" }),
  ).toBeVisible();
  await expect(page.locator(".destination-rail button")).toHaveCount(8);
  await expect(
    page.getByRole("button", { name: "Egypt", exact: true }).locator("img"),
  ).toHaveAttribute("src", "/art/CAI-window.jpg");
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
    await expect(
      page.getByRole("button", { name: "Arrival airport" }),
    ).toContainText(code);
    await expect(
      page.getByRole("link", { name: "Fly to " + code }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Choose " + code }).click();
    await expect(page).toHaveURL(
      new RegExp("/explore/" + code + "/flights(?:\\?|$)"),
    );
    await expect(
      page.getByRole("heading", { name: "Your airports" }),
    ).toBeVisible();
    await expect(page.locator(".airport-pair")).toContainText(code);
    await page.locator(".flight-draft .hero-copy a").click();
    await page.getByRole("link", { name: "Back to windows" }).click();
    await expect(
      page.getByRole("button", { name: country, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  }
});
test("the phone menu and same-page flight shortcut work without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
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
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Next destination" }).click();
  await expect(page.locator(".window-name")).toContainText("Mount Fuji");
  const layout = await page.locator(".destination-rail").evaluate((rail) => {
    const cards = rail.querySelectorAll("button");
    const visible = [...cards].filter((card) => {
      const bounds = card.getBoundingClientRect();
      return (
        bounds.left >= rail.getBoundingClientRect().left - 1 &&
        bounds.right <= rail.getBoundingClientRect().right + 1
      );
    });
    const from = document
      .querySelector(".airport-field")!
      .getBoundingClientRect();
    const travelers = document
      .querySelector(".quick-passengers")!
      .getBoundingClientRect();
    return { visible: visible.length, sameRow: from.y === travelers.y };
  });
  expect(layout).toEqual({ visible: 5, sameRow: true });
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
    .toBeLessThanOrEqual(834);
  await expect(
    page.getByRole("button", { name: "Search flights" }),
  ).toBeVisible();
});

test("airport choices preserve the draft, support cancellation and submit the edited trip", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/explore/CAI", { waitUntil: "domcontentloaded" });
  const photo = page.locator("img.destination-landscape");
  for (const [width, source] of [
    [390, "window"],
    [834, "landscape"],
    [1360, "landscape"],
  ] as const) {
    await page.setViewportSize({ width, height: 1000 });
    await expect
      .poll(() =>
        photo.evaluate(
          (node: HTMLImageElement) => new URL(node.currentSrc).pathname,
        ),
      )
      .toBe("/art/CAI-" + source + ".jpg");
  }
  await expect(
    page.getByText(
      "See the pyramids rise above Giza before following the Nile into Cairo.",
    ),
  ).toBeVisible();
  await page.getByRole("link", { name: "Fly to CAI" }).click();
  await expect(
    page.getByRole("heading", { name: "Flights to Cairo" }),
  ).toBeVisible();
  const today = new Date().toISOString().slice(0, 10);
  await expect(page.getByLabel("Departure date")).toHaveValue(
    sampleDate("CAI", today),
  );
  const dateAfter = (days: number) =>
    new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
  const outbound = dateAfter(22),
    inbound = dateAfter(28);
  await expect(page.locator(".airport-pair")).toContainText("Africa/Cairo");
  await expect(page.locator(".airport-pair")).toContainText("Asia/Dubai");
  await page.getByRole("button", { name: "Arrival airport" }).click();
  let picker = page.getByRole("dialog", { name: "Choose destination" });
  await expect(picker.getByRole("button", { pressed: true })).toContainText(
    "CAI",
  );
  await picker.getByRole("searchbox").fill("Heathrow");
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Arrival airport" }),
  ).toContainText("Cairo (CAI)");
  await page.getByRole("button", { name: "Arrival airport" }).click();
  picker = page.getByRole("dialog", { name: "Choose destination" });
  await picker.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Round trip" }).click();
  await page.getByLabel("Departure date").fill(outbound);
  await page.getByLabel("Return date").fill(inbound);
  await page.getByRole("button", { name: "Arrival airport" }).click();
  await picker.getByRole("searchbox").fill("Heathrow");
  await picker.getByRole("button", { name: /Heathrow Airport/ }).click();
  await expect(
    page.getByRole("button", { name: "Arrival airport" }),
  ).toContainText("London (LHR)");
  await expect(page.getByLabel("Departure date")).toHaveValue(outbound);
  const search = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith("/flights/search"),
  );
  await page.getByRole("button", { name: "Search flights" }).click();
  expect((await search).ok()).toBeTruthy();
  const submitted = new URL(page.url()).searchParams;
  expect(submitted.get("arrivalAirport")).toBe("LHR");
  expect(submitted.get("returnDate")).toBe(inbound);
});

test("window shuffle exposes both scenes and skips immediately via Escape", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Egypt", exact: true }).click();
  await expect(page.locator(".scene-incoming")).toHaveCount(1);
  await expect(page.locator(".scene-outgoing")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Skip animation" }),
  ).toHaveCount(0);
  await expect(page.locator(".window-name")).toContainText("Giza");
});

test("portal samples roll forward after expiry and keep explicit dates and distinct airports", () => {
  const after = "2028-01-28";
  const initial = initialDraft(
    "CAI",
    new URLSearchParams("departureAirport=CAI"),
    after,
  );
  expect(initial.departureAirport).toBe("DXB");
  expect(initial.departureDate).toBe("2028-02-04");
  const explicit = initialDraft(
    "CDG",
    new URLSearchParams("departureDate=2028-06-06"),
    after,
  );
  expect(withDestination(explicit, "CAI", after)).toMatchObject({
    departureAirport: "DXB",
    arrivalAirport: "CAI",
    departureDate: "2028-06-06",
  });
  expect(sampleDate("CDG", "2027-05-01")).toBe("2027-05-12");
});
