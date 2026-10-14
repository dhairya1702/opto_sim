import { expect, test } from "@playwright/test";

test("keeps the home page and configures each practice test at its launcher", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("button", { name: /Practice clinical skills/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Test yourself with a patient/ })).toBeVisible();

  await page.getByRole("button", { name: /Practice clinical skills/ }).click();
  await expect(page.getByRole("heading", { name: "Extraocular motilities" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Guided Practice" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Test", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Keyboard + mouse" })).toHaveCount(0);

  await page.getByRole("button", { name: "Guided Practice" }).click();
  await page.getByRole("button", { name: "Keyboard + mouse" }).click();
  await page.getByRole("button", { name: "Disable voice" }).click();
  await page.getByRole("button", { name: "Start Guided Practice" }).click();

  await expect(page.locator(".motility-guided-step")).toContainText("Next step");
  await expect(page.getByLabel("Show H-pattern guides")).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();

  await page.getByRole("button", { name: "Test", exact: true }).click();
  await page.getByRole("button", { name: "Keyboard + mouse" }).click();
  await page.getByRole("button", { name: "Disable voice" }).click();
  await page.getByRole("button", { name: "Start Test" }).click();

  await expect(page.locator(".motility-guided-step")).toHaveCount(0);
  await expect(page.getByLabel("Show H-pattern guides")).toHaveCount(0);
});
