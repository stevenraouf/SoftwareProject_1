import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

async function registerTraveler(page: Page, next: string) {
  const email = "traveler-" + randomUUID() + "@example.test";
  const password = "Review" + randomUUID();
  await page.goto("/register?next=" + encodeURIComponent(next));
  await page.getByLabel("Name", { exact: true }).fill("Discovery traveler");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("checkbox").check();
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page).toHaveURL(/\/login\?/);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(next.split("?")[0] + "\\?"));
}

test("a traveler budgets a day, publishes the plan and a guest reads the itinerary", async ({
  page,
  browser,
}) => {
  const title = "Cairo field notes " + randomUUID().slice(0, 8);
  await registerTraveler(page, "/planner?section=create");
  await page.getByLabel("Itinerary title").fill(title);
  await page.getByLabel("Start date").fill("2030-05-14");
  await page.getByLabel("Countries", { exact: true }).selectOption("EG");
  await page.getByRole("button", { name: "Create private itinerary" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  const address = page.url();
  await page
    .locator("summary")
    .filter({ hasText: /^Add a day$/ })
    .click();
  await page.getByLabel("City", { exact: true }).selectOption("cairo");
  await page.getByLabel("Day notes").fill("Walk the riverbank.");
  await page.getByRole("button", { name: "Add day", exact: true }).click();
  const day = page.getByRole("region", { name: "Day 1", exact: true });
  await expect(day).toContainText("Walk the riverbank.");
  await day
    .locator("summary")
    .filter({ hasText: /^Add activity$/ })
    .click();
  await day.getByLabel("Activity name").fill("Museum visit");
  await day.getByLabel("Time (optional)").fill("09:15");
  await day.getByLabel("Cost (optional)").fill("15");
  await day
    .getByLabel("Currency", { exact: true })
    .filter({ visible: true })
    .selectOption("USD");
  await day.getByRole("button", { name: "Add activity", exact: true }).click();
  await expect(day.getByText("09:15 · Museum visit")).toBeVisible();
  await day
    .locator("summary")
    .filter({ hasText: /^Add expense$/ })
    .click();
  const expense = day.locator("details").filter({
    has: page.locator("summary").filter({ hasText: /^Add expense$/ }),
  });
  await expense.getByLabel("Amount", { exact: true }).fill("10");
  await expense.getByLabel("Currency", { exact: true }).selectOption("USD");
  await expense.getByRole("button", { name: "Add expense" }).click();
  await expect(
    page.getByRole("heading", { name: "$25.00", exact: true }),
  ).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: /^Itinerary settings$/ })
    .click();
  await page.getByLabel("Who can see this plan?").selectOption("Public");
  await page.getByRole("button", { name: "Save itinerary" }).click();
  await expect(
    page
      .locator("header.discovery-plan-header > p")
      .filter({ hasText: "By Discovery traveler" }),
  ).toContainText("Public");
  const guest = await browser.newContext({ ignoreHTTPSErrors: true });
  try {
    const reader = await guest.newPage();
    await reader.goto(address);
    await expect(reader.getByRole("heading", { name: title })).toBeVisible();
    await expect(reader.getByText("09:15 · Museum visit")).toBeVisible();
    await expect(
      reader.getByText("Itinerary settings", { exact: true }),
    ).toHaveCount(0);
    await expect(
      reader.getByRole("heading", { name: "$25.00", exact: true }),
    ).toBeVisible();
  } finally {
    await guest.close();
  }
});

test("a journal author publishes, adds and removes a like, and edits and deletes a comment", async ({
  page,
}) => {
  const title = "Notes from the Nile " + randomUUID().slice(0, 8);
  await registerTraveler(page, "/journal?section=write");
  await page.getByRole("button", { name: "Save story" }).click();
  await expect(
    page.getByLabel("Title", { exact: true }),
  ).toHaveAccessibleDescription(/\S/);
  await page.getByLabel("Title", { exact: true }).fill(title);
  await page
    .getByLabel("Visibility", { exact: true })
    .selectOption("Published");
  await page
    .getByLabel("Your story")
    .fill("The ferry crossed just before sunset.");
  const tags = page.getByLabel("Tags", { exact: true });
  await tags.fill("one, two, three, four, five, six");
  await page.getByRole("button", { name: "Save story" }).click();
  await expect(tags).toHaveAttribute("aria-invalid", "true");
  await expect(tags).toHaveAccessibleDescription(/up to five per story/i);
  await tags.fill("Cairo, river");
  await page.getByRole("button", { name: "Save story" }).click();
  await expect(page.getByRole("heading", { name: title })).toBeVisible();
  const samplePng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWMIqOj5DwAExAJUq0mQ6gAAAABJRU5ErkJggg==",
    "base64",
  );
  await page.getByLabel("Add a photograph", { exact: true }).setInputFiles({
    name: "sample.png",
    mimeType: "image/png",
    buffer: samplePng,
  });
  const photograph = page.getByRole("img", { name: title + " · photo 1" });
  await photograph.scrollIntoViewIfNeeded();
  await expect
    .poll(() =>
      photograph.evaluate((image: HTMLImageElement) => image.naturalWidth),
    )
    .toBe(1);
  await page.getByRole("button", { name: "Like story", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove my like", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Remove my like", exact: true })
    .click();
  await expect(
    page.getByText("0 likes · 0 comments", { exact: true }),
  ).toBeVisible();
  await page
    .getByLabel("Your comment", { exact: true })
    .fill("Bring a camera.");
  await page.getByRole("button", { name: "Post comment", exact: true }).click();
  const comment = page
    .locator("article.discovery-comment")
    .filter({ hasText: "Bring a camera." });
  await comment
    .locator("summary")
    .filter({ hasText: /^Edit comment$/ })
    .click();
  await comment
    .getByLabel("Comment", { exact: true })
    .fill("Bring a notebook.");
  await comment.getByRole("button", { name: "Save comment" }).click();
  const edited = page
    .locator("article.discovery-comment")
    .filter({ hasText: "Bring a notebook." });
  await expect(edited).toBeVisible();
  await edited.getByRole("button", { name: "Delete comment" }).click();
  await edited.getByRole("button", { name: "Keep it", exact: true }).click();
  await expect(edited).toBeVisible();
  await edited.getByRole("button", { name: "Delete comment" }).click();
  await edited.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.locator("article.discovery-comment")).toHaveCount(0);
  await page.getByRole("link", { name: "#Cairo", exact: true }).click();
  await expect(page.getByRole("link", { name: title })).toBeVisible();
});
