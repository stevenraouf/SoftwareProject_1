import { expect, test, type Page } from "@playwright/test";

function cairoDate(offset: number) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  const date = new Date(today + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

async function login(page: Page, next: string) {
  const password = process.env.AERIS_TEST_PASSWORD;
  if (!password) throw new Error("Run with the isolated browser test harness.");
  await page.goto("/login?next=" + encodeURIComponent(next));
  await page.getByLabel(/email/i).first().fill("traveler@example.test");
  await page.locator("input[type=password]").fill(password);
  await page.getByRole("button", { name: /^sign in$/i }).click();
  await expect(page).not.toHaveURL(/\/login(?:\?|$)/);
}

async function acceptPolicies(page: Page) {
  const button = page.getByRole("button", {
    name: "Accept policies",
    exact: true,
  });
  await expect(button).toBeDisabled();
  await page.getByRole("checkbox", { name: /I accept the provider/ }).check();
  await button.click();
  await expect(page.getByText(/Policies accepted /)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Policies accepted /)).toBeVisible();
  await expect(page.getByText(/Hold remaining/)).toBeVisible();
}

test("traveler selects a fare, adds baggage and creates an authenticated hold", async ({
  page,
}) => {
  const path =
    "/flights?departureAirport=CAI&arrivalAirport=DXB&departureDate=" +
    cairoDate(14) +
    "&adults=1";
  await login(page, path);
  const fare = page.locator("article").filter({ hasText: "DEMO100" }).first();
  await fare.getByRole("button", { name: "Select fare" }).click();
  await page.getByRole("link", { name: /Continue to travelers/ }).click();
  await page.getByLabel("Full name on document").fill("Test Flight Traveler");
  await page.getByLabel("Date of birth").fill("1999-06-12");
  await page.getByLabel("Passport or ID number").fill("TEST-FLIGHT-1");
  await page.getByLabel("Additional checked bags").fill("1");
  await page.getByLabel("Bag 1 weight (kg)").fill("10");
  await page.getByLabel("Date of birth").fill(cairoDate(0));
  await page.getByRole("button", { name: "Review fare" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: /Date of birth must match/ }),
  ).toBeVisible();
  await page.getByLabel("Date of birth").fill("1999-06-12");
  await page.getByRole("button", { name: "Review fare" }).click();
  await expect(
    page.getByRole("heading", { name: "Booking summary" }),
  ).toBeVisible();
  await expect(page.getByText(/Total USD\s*205\.00/)).toBeVisible();
  await page.getByRole("button", { name: /Hold seats for 10 minutes/ }).click();
  await expect(
    page.getByText("Pending Payment", { exact: true }),
  ).toBeVisible();
  await acceptPolicies(page);
});

test("traveler books two available hotel rooms and sees the stay policy", async ({
  page,
}) => {
  const path =
    "/stays?destination=Cairo&checkIn=" +
    cairoDate(15) +
    "&checkOut=" +
    cairoDate(17) +
    "&rooms=2&guests=2";
  await login(page, path);
  await page
    .getByRole("link", { name: /Choose rooms/ })
    .first()
    .click();
  const rooms = page.locator("label.room-choice");
  await rooms.nth(0).getByRole("checkbox").check();
  await rooms.nth(1).getByRole("checkbox").check();
  await page.getByLabel("Guest 1 name").nth(0).fill("Test Parent");
  await page.getByLabel("Guest 1 age").nth(0).fill("34");
  await page.getByLabel("Guest 1 name").nth(1).fill("Test Child");
  await page.getByLabel("Guest 1 age").nth(1).fill("11");
  await expect(page.getByText(/Total USD\s*360\.00/)).toBeVisible();
  await page.getByRole("button", { name: /Hold rooms for 10 minutes/ }).click();
  await expect(
    page.getByRole("heading", { name: "Your reservation" }),
  ).toBeVisible();
  await expect(page.getByText(/Check-in 14:00.*Check-out 11:00/)).toBeVisible();
  await acceptPolicies(page);
});

test("guest selects rooms and returns from sign-in with the same rooms and dates", async ({
  page,
}) => {
  await page.goto("/explore/CAI");
  await page.getByRole("link", { name: /Find a stay in Cairo/ }).click();
  await expect(page.getByLabel("Destination", { exact: true })).toHaveValue(
    "Cairo",
  );
  await page.getByLabel("Check-in", { exact: true }).fill(cairoDate(18));
  await page.getByLabel("Check-out", { exact: true }).fill(cairoDate(20));
  await page.getByLabel("Rooms", { exact: true }).fill("2");
  await page.getByLabel("Guests", { exact: true }).fill("2");
  await page.getByRole("button", { name: /Search stays/ }).click();
  await page
    .getByRole("link", { name: /Choose rooms/ })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Available rooms", exact: true }),
  ).toBeVisible();
  const stay = new URL(page.url());
  const rooms = page.locator("label.room-choice input");
  await rooms.nth(0).check();
  await rooms.nth(1).check();
  const signIn = page.getByRole("link", {
    name: "Sign in to continue with selected rooms",
  });
  await expect(signIn).toBeVisible();
  await expect(page.getByLabel("Guest 1 name")).toHaveCount(0);
  await signIn.click();
  await expect(page).toHaveURL(/\/login\?/);
  const returnTo = new URL(new URL(page.url()).searchParams.get("next")!, stay);
  expect(returnTo.pathname).toBe(stay.pathname);
  for (const [field, value] of stay.searchParams)
    expect(returnTo.searchParams.get(field)).toBe(value);
  expect(returnTo.searchParams.get("selectedRooms")?.split(",")).toHaveLength(
    2,
  );
  await page.getByLabel("Email address").fill("traveler@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.AERIS_TEST_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(returnTo.toString());
  await expect(rooms.nth(0)).toBeChecked();
  await expect(rooms.nth(1)).toBeChecked();
  await page.getByLabel("Guest 1 name").nth(0).fill("Guest Handoff Traveler");
  await page.getByLabel("Guest 1 age").nth(0).fill("34");
  await page.getByLabel("Guest 1 name").nth(1).fill("Guest Handoff Child");
  await page.getByLabel("Guest 1 age").nth(1).fill("9");
  await page.getByRole("button", { name: /Hold rooms for 10 minutes/ }).click();
  await expect(
    page.getByRole("heading", { name: "Your reservation", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Pending Payment", { exact: true }),
  ).toBeVisible();
});

test("confirmed traveler selects a seat, reopens the ticket, and downloads the PDF", async ({
  page,
}) => {
  await login(page, "/trips?type=flight&group=Upcoming");
  const card = page
    .locator("article")
    .filter({ has: page.getByText(/^Confirmed ·/) })
    .first();
  await card.getByRole("link", { name: /View booking/ }).click();
  await page
    .getByRole("button", { name: "Choose or change seats" })
    .first()
    .click();
  const seat = page.locator(".seat-map button:enabled").first();
  const label = (await seat.innerText()).trim();
  await seat.click();
  await page.getByRole("button", { name: "Save seats" }).click();
  await expect(
    page
      .locator(".travel-leg strong")
      .filter({ hasText: new RegExp("^" + label + "$") })
      .first(),
  ).toBeVisible();
  await page.reload();
  await expect(
    page
      .locator(".travel-leg strong")
      .filter({ hasText: new RegExp("^" + label + "$") })
      .first(),
  ).toBeVisible();
  const href = await page
    .getByRole("link", { name: "Download e-ticket PDF" })
    .getAttribute("href");
  const pdf = await page.request.get(href!);
  expect(pdf.ok()).toBeTruthy();
  expect(pdf.headers()["content-type"]).toContain("application/pdf");
  expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
});

test("guest round-trip fare review preserves the return leg and offers a sign-in handoff", async ({
  page,
}) => {
  const path =
    "/flights?departureAirport=CAI&arrivalAirport=DXB&departureDate=" +
    cairoDate(14) +
    "&returnDate=" +
    cairoDate(21) +
    "&adults=1";
  await page.goto(path);
  const outbound = page
    .locator("article")
    .filter({ hasText: "DEMO100" })
    .first();
  const inbound = page
    .locator("article")
    .filter({ hasText: "DEMO101" })
    .first();
  await expect(inbound).toBeVisible();
  await outbound
    .getByRole("link", { name: "Flight details & baggage" })
    .click();
  await page
    .getByRole("link", { name: "Return to search and select both flights" })
    .click();
  await outbound.getByRole("button", { name: "Select fare" }).click();
  await inbound.getByRole("button", { name: "Select fare" }).click();
  await page.getByRole("link", { name: /Continue to travelers/ }).click();
  await expect(page.getByRole("heading", { name: /DEMO100/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /DEMO101/ })).toBeVisible();
  const outboundDetails = page.locator("section").filter({
    has: page.getByRole("heading", { name: /DEMO100/ }),
  });
  await expect(outboundDetails.getByRole("listitem")).toHaveCount(10);
  await outboundDetails
    .getByRole("button", { name: "Next", exact: true })
    .click();
  await expect(outboundDetails.getByRole("listitem")).toHaveCount(1);
  await expect(outboundDetails.getByRole("listitem")).toContainText("0+ days");
  await page.getByLabel("Your cabin").selectOption("Business");
  await page.getByRole("link", { name: "Sign in to book this flight" }).click();
  await page.getByLabel("Email address").fill("traveler@example.test");
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.AERIS_TEST_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByLabel("Your cabin")).toHaveValue("Business");
  await expect(page.getByText("Selected cabin · Economy")).toBeVisible();
  await expect(page.getByLabel("Full name on document")).toBeVisible();
});

test("flight price filters give an actionable empty result", async ({
  page,
}) => {
  await page.goto(
    "/flights?departureAirport=CAI&arrivalAirport=DXB&departureDate=" +
      cairoDate(14) +
      "&adults=1&maxPrice=1",
  );
  await expect(page.getByText(/^No flights found/)).toBeVisible();
  await expect(page.getByLabel("Maximum party fare")).toHaveValue("1");
  await expect(page.locator("#aeris-airports option[value=CAI]")).toHaveCount(
    1,
  );
  await page.getByLabel("From airport").fill("ZZZ");
  await page.getByRole("button", { name: "Search flights" }).click();
  await expect(
    page
      .getByRole("alert")
      .filter({ hasText: "Choose an airport from the airport directory." }),
  ).toBeVisible();
  await page.getByLabel("From airport").fill("CAI");
  await page.getByLabel("Maximum party fare").fill("200");
  await page.getByRole("button", { name: "Search flights" }).click();
  await expect(page.getByText(/DEMO100 · Economy/)).toBeVisible();
});
