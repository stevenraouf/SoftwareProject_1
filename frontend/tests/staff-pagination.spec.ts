import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

type Range = { start: string; end: string };

function future(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

test("hotel staff paginate date ranges, nightly availability and refund tiers without losing records", async ({
  page,
}) => {
  test.setTimeout(90000);
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  const initialPassword = process.env.AERIS_TEST_PASSWORD;
  if (!base || !initialPassword)
    throw new Error("Run with the isolated browser test harness.");

  let csrf = "";
  async function call(method: string, path: string, data?: unknown) {
    const response = await page.request.fetch(base + path, {
      method,
      headers: csrf ? { "X-CSRF-Token": csrf } : {},
      data,
    });
    expect(response.ok(), method + " " + path).toBeTruthy();
    return response.json();
  }
  async function login(email: string, password: string) {
    const result = await call("POST", "/auth/login", { email, password });
    csrf = result.csrfToken;
  }

  await login("admin@example.test", initialPassword);
  const suffix = randomUUID().slice(0, 8);
  const hotel = await call("POST", "/hotels", {
    name: "Date pagination " + suffix,
    address: "Isolated browser fixture",
    city: "cairo",
    country: "EG",
    description: "Pagination regression property",
    starClass: 3,
    amenities: [],
    timezone: "Africa/Cairo",
  });
  const email = "date-pages-" + suffix + "@example.test";
  const password = "Pagination9-" + randomUUID();
  await call("POST", "/admin/moderators", {
    name: "Date pagination moderator",
    email,
    role: "HotelModerator",
    providerId: hotel._id,
    temporaryPassword: initialPassword,
  });
  await login(email, initialPassword);
  await call("PATCH", "/auth/change-password", {
    currentPassword: initialPassword,
    newPassword: password,
  });
  await login(email, password);
  const room = await call("POST", "/hotels/" + hotel._id + "/rooms", {
    number: "PAG-" + suffix,
    type: "Single",
    beds: 1,
    occupancy: 1,
    price: 30,
  });
  const rangePath =
    "/hotels/" + hotel._id + "/rooms/" + room._id + "/availability";
  const ranges: Range[] = Array.from({ length: 11 }, (_, i) => ({
    start: future(60 + i * 3),
    end: future(61 + i * 3),
  }));
  for (const kind of ["availability", "blocked"])
    await call("PATCH", rangePath, { kind, ranges });

  await page.goto("/workspace?section=rooms");
  const row = page.getByRole("article").filter({
    has: page.getByRole("heading", {
      name: "Room " + room.number + " · Single",
      exact: true,
    }),
  });
  await expect(row).toBeVisible();

  for (const [kind, title] of [
    ["availability", "Bookable dates"],
    ["blocked", "Blocked dates"],
  ] as const) {
    const fold = row.locator("details").filter({
      has: page
        .locator("summary")
        .filter({ hasText: new RegExp("^" + title + "$") }),
    });
    await fold.locator("summary").click();
    await expect(fold.locator(".staffRange")).toHaveCount(10);
    await expect(
      fold.getByText("Page 1 of 2 · 11 records", { exact: true }),
    ).toBeVisible();
    await expect(
      fold.getByRole("button", { name: "Previous", exact: true }),
    ).toBeDisabled();
    await fold.getByRole("button", { name: "Next", exact: true }).click();
    await expect(fold.locator(".staffRange")).toHaveCount(1);
    await expect(fold.locator(".staffRange")).toContainText(ranges[10].start);
    await expect(
      fold.getByRole("button", { name: "Next", exact: true }),
    ).toBeDisabled();
    await fold.getByRole("button", { name: "Previous", exact: true }).click();
    await expect(fold.locator(".staffRange")).toHaveCount(10);
    await expect(fold.locator(".staffRange").first()).toContainText(
      ranges[0].start,
    );
    await fold.getByRole("button", { name: "Next", exact: true }).click();

    page.once("dialog", (dialog) => dialog.accept());
    await fold
      .getByRole("button", { name: "Remove range", exact: true })
      .click();
    await expect(row.locator("details[open]")).toHaveCount(0);
    await fold.locator("summary").click();
    await expect(fold.locator(".staffRange")).toHaveCount(10);
    await expect(
      fold.getByText("Page 1 of 1 · 10 records", { exact: true }),
    ).toBeVisible();
    await expect(
      fold.getByRole("button", { name: "Previous", exact: true }),
    ).toBeDisabled();
    await expect(
      fold.getByRole("button", { name: "Next", exact: true }),
    ).toBeDisabled();

    const rooms = await call("GET", "/hotels/" + hotel._id + "/rooms");
    const saved = rooms.items.find(
      (item: { _id: string }) => item._id === room._id,
    );
    expect(
      saved[kind].map(({ start, end }: Range) => ({ start, end })),
    ).toEqual(ranges.slice(0, 10));
    await fold.locator("summary").click();
  }

  await page.goto("/workspace?section=availability");
  await page.getByLabel("First night").fill(future(60));
  await page.getByLabel("End date (exclusive)").fill(future(71));
  await page.getByRole("button", { name: "View availability" }).click();
  const calendar = page.getByRole("article").filter({
    has: page.getByRole("heading", {
      name: "Room " + room.number,
      exact: true,
    }),
  });
  const nights = calendar.getByRole("navigation", {
    name: "Nightly availability pages",
  });
  await expect(calendar.getByRole("listitem")).toHaveCount(10);
  await nights.getByRole("button", { name: "Next" }).click();
  await expect(calendar.getByRole("listitem")).toHaveCount(1);
  await expect(calendar.getByRole("listitem")).toContainText(future(70));

  const tiers = Array.from({ length: 11 }, (_, threshold) => ({
    threshold,
    refundPercent: threshold * 5,
  }));
  await call("PUT", "/hotels/" + hotel._id + "/policies", {
    checkInTime: "14:00",
    checkOutTime: "11:00",
    tiers,
  });
  await page.goto("/workspace?section=policies");
  await expect(page.getByLabel("Minimum days", { exact: true })).toHaveCount(
    10,
  );
  await page
    .getByRole("navigation", { name: "Refund tier pages" })
    .getByRole("button", { name: "Next" })
    .click();
  await expect(page.getByLabel("Minimum days", { exact: true })).toHaveValue(
    "10",
  );
  await page.getByLabel("Refund %", { exact: true }).fill("57");
  const savedPolicy = page.waitForResponse(
    (response) =>
      response.url().endsWith("/policies") &&
      response.request().method() === "PUT",
  );
  await page.getByRole("button", { name: "Save policy" }).click();
  expect((await savedPolicy).ok()).toBe(true);
  const savedHotel = await call("GET", "/hotels/" + hotel._id);
  expect(
    savedHotel.cancellationTiers.map(
      ({
        threshold,
        refundPercent,
      }: {
        threshold: number;
        refundPercent: number;
      }) => ({ threshold, refundPercent }),
    ),
  ).toEqual([...tiers.slice(0, 10), { threshold: 10, refundPercent: 57 }]);
});
