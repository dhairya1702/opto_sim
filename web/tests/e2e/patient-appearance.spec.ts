import { expect, test } from "@playwright/test";
test.use({ launchOptions: { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"] } });

test("selects the new patient before opening the shared desktop Practice clinic and resets on reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.getByLabel("Clinic patient · development preview").selectOption("detailed");
  await expect(page.getByRole("status")).toContainText("Ready — new patient selected");
  await page.getByRole("button", { name: /Practice clinical skills/ }).click();
  await page.getByRole("button", { name: "Guided Practice", exact: true }).click();
  await page.getByRole("button", { name: "Keyboard + mouse", exact: true }).click();
  await page.getByRole("button", { name: "Disable voice", exact: true }).click();
  await page.getByRole("button", { name: "Start Guided Practice", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.locator("canvas")).toHaveAttribute("data-patient-appearance", "detailed");
  await expect(page.getByText(/could not load|3D clinic is unavailable/i)).toHaveCount(0);
  await page.waitForTimeout(800);
  await page.screenshot({ path: "test-results/detailed-patient-practice.png" });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Clinic patient · development preview")).toHaveValue("current");
  expect(errors).toEqual([]);
});

test("keeps the current patient usable if the detailed asset fails", async ({ page }) => {
  await page.route("**/assets/patient-prototype/patient.json", route => route.fulfill({ status: 503, body: "Unavailable" }));
  await page.goto("/");
  await page.getByLabel("Clinic patient · development preview").selectOption("detailed");
  await expect(page.getByRole("alert")).toContainText("current patient is still selected");
  await expect(page.getByLabel("Clinic patient · development preview")).toHaveValue("current");
  await page.getByRole("button", { name: /Test yourself with a patient/ }).click();
  await expect(page.getByRole("button", { name: "Use click-based station mode" })).toBeVisible();
});
