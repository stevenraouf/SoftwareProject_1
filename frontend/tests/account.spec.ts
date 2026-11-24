import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
test("traveler signs in, updates a profile using secure cookies, and signs out", async ({
  page,
  context,
}) => {
  const email = "profile-" + randomUUID() + "@example.test",
    password = "Test9" + randomUUID();
  await page.goto("/register");
  await page.getByLabel("Name", { exact: true }).fill("Profile traveler");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/login\?registered=1/);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/trips$/);
  const cookies = await context.cookies();
  for (const name of ["access_token", "refresh_token"]) {
    const c = cookies.find((v) => v.name === name);
    expect(Boolean(c && c.secure && c.httpOnly && c.sameSite === "Lax")).toBe(
      true,
    );
  }
  await page.getByRole("link", { name: "Account", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Updated traveler");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Profile saved.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue(
    "Updated traveler",
  );
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/$/);
  const remaining = (await context.cookies()).map((v) => v.name);
  expect(remaining.includes("access_token")).toBe(false);
  await page.goto("/account");
  await expect(
    page.getByRole("link", { name: "Sign in to continue" }),
  ).toBeVisible();
});
