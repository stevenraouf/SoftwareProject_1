import { expect, test } from "@playwright/test";

test("the phone menu returns keyboard focus and opens the flight destination picker", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: "Reduced motion", exact: true }),
  ).toBeDisabled();
  const menuButton = page.getByRole("button", { name: "Menu", exact: true });
  await menuButton.press("Enter");
  const flights = page
    .getByRole("navigation", { name: "Phone menu" })
    .getByRole("link", { name: "Flights" });
  await flights.focus();
  await page.keyboard.press("Escape");
  await expect(menuButton).toBeFocused();
  await expect(flights).toHaveCount(0);
  await menuButton.press("Enter");
  await flights.press("Enter");
  await expect(page).toHaveURL(/\/flights\?choose=destination$/);
});

test("the cabin covers the outgoing page, keeps history, and honors reduced motion", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await expect(page.locator("html")).toHaveAttribute("data-motion", "standard");

  // Capture the first frame at DOM commit even on a fast machine.
  const firstFrame = await page
    .getByRole("link", { name: "Explore France" })
    .evaluate(
      (link) =>
        new Promise<{ path: string; phase: string; banks: number }>(
          (resolve) => {
            const observer = new MutationObserver(() => {
              const passage =
                document.querySelector<HTMLElement>(".cabin-passage");
              if (!passage) return;
              observer.disconnect();
              resolve({
                path: location.pathname,
                phase: passage.dataset.phase ?? "",
                banks: passage.querySelectorAll(".cloud-bank").length,
              });
            });
            observer.observe(document.body, { childList: true, subtree: true });
            (link as HTMLAnchorElement).click();
          },
        ),
    );
  expect(firstFrame).toEqual({ path: "/", phase: "enter", banks: 2 });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("heading", { name: "Bonjour" })).toBeVisible();
  await expect(page.locator(".cabin-passage")).toHaveCount(0);
  await page.goBack();
  await expect(
    page.getByRole("link", { name: "Explore France" }),
  ).toBeVisible();

  const replay = page.getByRole("button", { name: "Replay logo", exact: true });
  await replay.click();
  const dialog = page.getByRole("dialog", { name: "Brand motion" });
  await dialog.getByRole("button", { name: "View still" }).click();
  await expect(dialog.locator(".signature")).toHaveAttribute(
    "data-still",
    "true",
  );
  await dialog.getByRole("button", { name: "Replay motion" }).click();
  await expect(dialog.locator(".signature")).toHaveAttribute(
    "data-still",
    "false",
  );
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(replay).toBeFocused();

  await page
    .getByRole("button", { name: "Reduce motion", exact: true })
    .click();
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(
    page.getByRole("button", { name: "Use standard motion" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Explore France" }).click();
  await expect(page.getByRole("heading", { name: "Bonjour" })).toBeVisible();
  await expect(page.locator(".cabin-passage")).toHaveCount(0);
  expect(
    await page
      .locator(".arrival-word")
      .evaluate((heading) => heading.getAnimations().length),
  ).toBe(0);
});
