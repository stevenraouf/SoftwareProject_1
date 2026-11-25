import { randomUUID } from "node:crypto";
import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from "@playwright/test";

const genericDescription =
  "Plan your route, find flights and stays, and keep a journal of your travels.";

async function call(
  request: APIRequestContext,
  method: string,
  path: string,
  data?: unknown,
) {
  const base = process.env.NEXT_PUBLIC_API_BASE_URL;
  // This spec creates records only in the isolated browser-fixture API.
  expect(base).toBe("https://localhost:3445/api");
  const state = await request.storageState();
  const csrf = state.cookies.find((cookie) => cookie.name === "csrf_token");
  const response = await request.fetch(base + path, {
    method,
    data,
    headers: csrf ? { "X-CSRF-Token": decodeURIComponent(csrf.value) } : {},
  });
  expect(
    response.ok(),
    method + " " + path + " HTTP " + response.status(),
  ).toBe(true);
  return response.json();
}

async function expectMetadata(page: Page, title: string) {
  expect(await page.title()).toContain(title);
  const description = page.locator('meta[name="description"]');
  await expect(description).toHaveCount(1);
  const text = await description.getAttribute("content");
  expect(text?.trim().length).toBeGreaterThan(10);
  expect(text).not.toBe(genericDescription);
}

test("public content and metadata render without JavaScript and respect later privacy changes", async ({
  page,
  browser,
}) => {
  test.setTimeout(120000);
  const suffix = randomUUID().replaceAll("-", "");
  const name = "SSR Author " + suffix;
  const email = "ssr-" + suffix + "@example.test";
  const password = "Review9" + randomUUID();
  const title = "SSR Story " + suffix;
  const body = "Sunrise ferry and museum route " + suffix;
  const itineraryTitle = "SSR Itinerary " + suffix;
  const notes = "River walk begins beside the museum " + suffix;
  const startDate = "2031-06-12";

  await call(page.request, "POST", "/auth/register", {
    name,
    email,
    password,
    consent: true,
  });
  const login = await call(page.request, "POST", "/auth/login", {
    email,
    password,
  });
  const authorId = login.user.id;
  const story = await call(page.request, "POST", "/posts", {
    title,
    body,
    status: "Published",
    tags: ["rendering"],
  });
  const itinerary = await call(page.request, "POST", "/itineraries", {
    title: itineraryTitle,
    countries: ["EG"],
    startDate,
  });
  const withDay = await call(
    page.request,
    "POST",
    "/itineraries/" + itinerary._id + "/days",
    { city: "cairo", notes },
  );
  await call(page.request, "PATCH", "/itineraries/" + itinerary._id, {
    visibility: "Public",
  });

  const guest = await browser.newContext({
    baseURL: test.info().project.use.baseURL,
    ignoreHTTPSErrors: true,
    javaScriptEnabled: false,
  });
  try {
    const reader = await guest.newPage();
    const storyPath = "/post/" + story._id;
    const itineraryPath = "/itinerary/" + itinerary._id;
    const authorPath = "/author/" + authorId;

    const storyResponse = await reader.goto(storyPath);
    expect(storyResponse?.ok()).toBe(true);
    await expect(
      reader.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(reader.getByText(body, { exact: true })).toBeVisible();
    await expect(reader.getByRole("link", { name, exact: true })).toBeVisible();
    await expectMetadata(reader, title);

    const invalid = await reader.goto(storyPath + "/extra");
    expect(await invalid!.text()).not.toContain(title);

    const itineraryResponse = await reader.goto(itineraryPath);
    expect(itineraryResponse?.ok()).toBe(true);
    await expect(
      reader.getByRole("heading", { name: itineraryTitle, exact: true }),
    ).toBeVisible();
    await expect(reader.getByText(notes, { exact: true })).toBeVisible();
    await expect(
      reader.getByRole("heading", { name: /Day by day/i }),
    ).toBeVisible();
    expect(await reader.locator("main").innerText()).toMatch(
      /2031-06-12|Jun(?:e)?\s+12,?\s+2031|12\s+Jun(?:e)?\s+2031/,
    );
    await expectMetadata(reader, itineraryTitle);

    const authorResponse = await reader.goto(authorPath);
    expect(authorResponse?.ok()).toBe(true);
    await expect(
      reader.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
    await expect(reader.getByText(/^Joined /)).toBeVisible();
    await expect(
      reader.getByRole("link", { name: title, exact: true }),
    ).toBeVisible();
    await expect(
      reader.getByRole("link", { name: itineraryTitle, exact: true }),
    ).toBeVisible();
    await expectMetadata(reader, name);

    await reader.goto("/explore/CAI");
    await expectMetadata(reader, "Explore Cairo");

    for (let index = 0; index < 10; index++) {
      await call(page.request, "POST", "/posts", {
        title: "Other story " + index + " " + suffix,
        body: "Published story for page comparison.",
        tags: ["rendering"],
        status: "Published",
      });
      const other = await call(page.request, "POST", "/itineraries", {
        title: "Other plan " + index + " " + suffix,
        countries: ["EG"],
        startDate,
      });
      await call(page.request, "PATCH", "/itineraries/" + other._id, {
        visibility: "Public",
      });
    }
    const journalSearch = "/journal?q=" + suffix + "&tag=rendering";
    const plannerSearch = "/planner?q=" + suffix + "&country=EG&maxDays=1";
    for (const [path, endpoint, heading] of [
      [journalSearch, "/posts", "Travel journal"],
      [plannerSearch, "/itineraries/public/search", "Public itineraries"],
    ]) {
      await reader.goto(path);
      await expectMetadata(reader, heading);
      for (const current of [1, 2]) {
        const expected = await call(
          guest.request,
          "GET",
          endpoint + "?" + path.split("?")[1] + "&page=" + current,
        );
        const titles = expected.items.map(
          (row: { title: string }) => row.title,
        );
        expect(titles).toHaveLength(current === 1 ? 10 : 1);
        await expect(reader.locator(".discovery-cards h3")).toHaveText(titles);
        if (current === 1)
          await reader.getByRole("link", { name: "Next", exact: true }).click();
      }
      await reader.getByRole("link", { name: "Previous", exact: true }).click();
      await expect(reader.locator(".discovery-cards h3")).toHaveCount(10);
    }
    await reader.goto(plannerSearch + "&city=cairo&minDays=1");
    await expect(reader.locator(".discovery-cards h3")).toHaveText([
      itineraryTitle,
    ]);

    const privateTitle = "Private Story " + suffix;
    const privateBody = "Private draft marker " + suffix;
    const privateItineraryTitle = "Private Itinerary " + suffix;
    const privateNotes = "Private day marker " + suffix;
    await call(page.request, "PATCH", "/posts/" + story._id, {
      status: "Draft",
      title: privateTitle,
      body: privateBody,
    });
    await call(page.request, "PATCH", "/itineraries/" + itinerary._id, {
      visibility: "Private",
      title: privateItineraryTitle,
    });
    await call(
      page.request,
      "PATCH",
      "/itineraries/" + itinerary._id + "/days/" + withDay.days[0]._id,
      { notes: privateNotes },
    );

    for (const path of [
      storyPath,
      itineraryPath,
      authorPath,
      journalSearch,
      plannerSearch,
      "/journal?section=mine",
      "/planner?section=mine",
    ]) {
      const response = await reader.goto(path);
      const html = await response!.text();
      for (const marker of [
        title,
        body,
        itineraryTitle,
        notes,
        privateTitle,
        privateBody,
        privateItineraryTitle,
        privateNotes,
      ]) {
        expect(html, "Anonymous initial HTML at " + path).not.toContain(marker);
      }
    }

    // The owner still reaches their private content and editor after hydration.
    await page.goto(storyPath);
    await expect(
      page.getByRole("heading", { name: privateTitle, exact: true }),
    ).toBeVisible();
    await expect(page.locator(".discovery-prose")).toHaveText(privateBody);
    await expect(
      page.locator("summary").filter({ hasText: /^Edit story$/ }),
    ).toBeVisible();
    await page.goto(itineraryPath);
    await expect(
      page.getByRole("heading", { name: privateItineraryTitle, exact: true }),
    ).toBeVisible();
    await expect(
      page.locator(".discovery-prose").filter({ hasText: privateNotes }),
    ).toBeVisible();
    await expect(
      page.locator("summary").filter({ hasText: /^Itinerary settings$/ }),
    ).toBeVisible();
  } finally {
    await guest.close();
  }
});
