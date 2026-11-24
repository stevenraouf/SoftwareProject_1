import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.locator("input[name=password]").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
}
function initialPassword() {
  const value = process.env.AERIS_TEST_PASSWORD;
  if (!value)
    throw new Error(
      "Run the staff tests with the isolated test harness and AERIS_TEST_PASSWORD.",
    );
  return value;
}
async function moderator(page: Page, email: string) {
  const password = initialPassword(),
    changed = "Temp-" + randomUUID() + "9";
  await signIn(page, email, password);
  await expect(page).toHaveURL(/\/password(?:\?|$)/);
  await page.getByLabel("Current password").fill(password);
  await page.getByLabel("New password").fill(changed);
  await page
    .getByRole("button", { name: "Change password", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login\?updated=1/);
  await signIn(page, email, changed);
  await expect(page).toHaveURL(/\/workspace(?:\?|$)/);
}
function tab(page: Page, label: string) {
  return page
    .getByRole("navigation", { name: "Workspace sections" })
    .getByRole("button", { name: label, exact: true });
}
function future(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
test("administrator creates a provider, changes its status and inspects the audit trail", async ({
  page,
}) => {
  await signIn(page, "admin@example.test", initialPassword());
  await expect(
    page.getByRole("heading", { name: "Platform operations" }),
  ).toBeVisible();
  const suffix = randomUUID().slice(0, 6).toUpperCase(),
    name = "Review Airways " + suffix;
  await tab(page, "Providers").click();
  await page.getByLabel("Airline name").fill(name);
  await page.getByLabel("Airline code").fill("lower case");
  await page
    .getByRole("button", { name: "Create airline", exact: true })
    .click();
  await expect(page.getByLabel("Airline code")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await page.getByLabel("Airline code").fill("T" + suffix);
  await page
    .getByRole("button", { name: "Create airline", exact: true })
    .click();
  const row = page
    .getByRole("article")
    .filter({ has: page.getByRole("heading", { name, exact: true }) });
  await expect(row).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await row.getByRole("button", { name: "Deactivate provider" }).click();
  await expect(row).toContainText("Inactive");
  await tab(page, "Audit log").click();
  await expect(
    page
      .getByRole("heading", { name: "deactivate-provider", exact: true })
      .first(),
  ).toBeVisible();
  await tab(page, "Accounts").click();
  await page.getByLabel("Name or email").fill("airline@example.test");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(
    page.getByRole("heading", { name: "Demo Airline Moderator", exact: true }),
  ).toBeVisible();
});
test("airline moderator schedules a flight, adds a cabin, and is denied the admin directory", async ({
  page,
}) => {
  await moderator(page, "airline@example.test");
  await expect(
    page.getByRole("heading", { name: "Demo Airways", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Audit log", exact: true }),
  ).toHaveCount(0);
  await tab(page, "Flights").click();
  // The flight number identifies the new schedule throughout the workflow.
  const number = "E2E" + randomUUID().slice(0, 6).toUpperCase();
  const flight = page
    .locator("form")
    .filter({ has: page.getByLabel("Flight number") });
  await flight.getByLabel("Flight number").fill(number);
  await flight.getByLabel("Departure airport").selectOption("CAI");
  await flight.getByLabel("Arrival airport").selectOption("DXB");
  await flight
    .getByLabel("Departure (airport local time)")
    .fill(future(50) + "T08:00");
  await flight
    .getByLabel("Arrival (airport local time)")
    .fill(future(50) + "T15:00");
  await flight.getByRole("button", { name: "Create flight" }).click();
  await expect(
    page.getByRole("heading", { name: new RegExp(number) }),
  ).toBeVisible();
  await page.locator("summary").filter({ hasText: "Add cabin" }).click();
  const cabin = page
    .locator("form")
    .filter({ has: page.getByLabel("Seat capacity") });
  await page
    .getByRole("combobox", { name: "Cabin", exact: true })
    .selectOption("Economy");
  await cabin.getByLabel("Seat capacity").fill("12");
  await cabin.getByLabel("Fare (USD)").fill("135");
  await cabin.getByRole("button", { name: "Add cabin", exact: true }).click();
  await expect(page.getByText("12 seats remaining of 12")).toBeVisible();
  const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!apiBase)
    throw new Error("The test harness must supply the isolated API URL.");
  const response = await page.request.get(apiBase + "/admin/providers");
  expect(response.status()).toBe(403);
});
test("hotel moderator adds a room and verifies its bookable nights", async ({
  page,
}) => {
  await moderator(page, "hotel@example.test");
  await expect(
    page.getByRole("heading", { name: "Demo Cairo Hotel", exact: true }),
  ).toBeVisible();
  await tab(page, "Rooms").click();
  const number = "T" + randomUUID().slice(0, 6);
  const form = page.locator("form").filter({
    has: page.getByRole("button", { name: "Create room", exact: true }),
  });
  await form.getByLabel("Room number").fill(number);
  await form.getByLabel("Room type").fill("Garden suite");
  await form.getByLabel("Beds", { exact: true }).fill("2");
  await form.getByLabel("Maximum guests").fill("2");
  await form.getByLabel("Nightly price (USD)").fill("120");
  await form.getByRole("button", { name: "Create room" }).click();
  const row = page.getByRole("article").filter({
    has: page.getByRole("heading", {
      name: "Room " + number + " · Garden suite",
      exact: true,
    }),
  });
  await row.locator("summary").filter({ hasText: "Bookable dates" }).click();
  const dates = row.locator("details[open]");
  await dates.getByLabel("First night").fill(future(30));
  await dates.getByLabel("End date (exclusive)").fill(future(32));
  await dates.getByRole("button", { name: "Add bookable dates" }).click();
  await expect(row.locator("details[open]")).toHaveCount(0);
  await tab(page, "Availability").click();
  await expect(
    page.getByRole("heading", { name: "Room availability", exact: true }),
  ).toBeVisible();
  const calendarSearch = page.locator("form").filter({
    has: page.getByRole("button", { name: "View availability", exact: true }),
  });
  await calendarSearch.getByLabel("First night").fill(future(30));
  await calendarSearch.getByLabel("End date (exclusive)").fill(future(32));
  await calendarSearch
    .getByRole("button", { name: "View availability", exact: true })
    .click();
  const calendar = page.getByRole("article").filter({
    has: page.getByRole("heading", { name: "Room " + number, exact: true }),
  });
  await expect(calendar.getByText("Available", { exact: true })).toHaveCount(2);
  await tab(page, "Property").click();
  const photo = page.getByRole("img", {
    name: "Property photo 1",
    exact: true,
  });
  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWOQ8878DwADLwHS84WxBAAAAABJRU5ErkJggg==",
    "base64",
  );
  await page
    .getByLabel("JPEG or PNG, up to 5 MB")
    .setInputFiles({ name: "proof.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Upload image", exact: true }).click();
  await expect(photo).toBeVisible();
  await expect
    .poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth))
    .toBe(1);
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Remove image", exact: true }).click();
  await expect(photo).toHaveCount(0);
});
