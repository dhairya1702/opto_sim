import { expect, test, type Page } from "@playwright/test";

async function launch(page: Page, kind: "Guided Practice" | "Test") {
  await page.goto("/");
  await page.getByRole("button", { name: /Practice clinical skills/ }).click();
  await page.getByRole("button", { name: /4Δ base-out test/ }).click();
  await page.getByRole("button", { name: kind, exact: true }).click();
  await page.getByRole("button", { name: "Keyboard + mouse" }).click();
  await page.getByRole("button", { name: "Disable voice" }).click();
  await page.getByRole("button", { name: `Start ${kind}` }).click();
  return page.getByRole("dialog", { name: /4Δ base-out test/ });
}

test("desktop Guided 4Δ comparison enforces physical orientation, withdrawal and bilateral entry", async ({ page }) => {
  const dialog = await launch(page, "Guided Practice");
  await expect(dialog.locator(".clinical-coach")).toContainText(/STEP 1 OF 10/i);
  await expect(dialog.getByText("Pick up the 4Δ prism")).toBeVisible();
  await dialog.getByRole("button", { name: "FIT THE TRIAL FRAME" }).click();
  await dialog.getByRole("button", { name: "DISTANCE DISPLAY POWER" }).click();
  await dialog.getByRole("button", { name: "LOOK AT THE ISOLATED LETTER" }).click();

  await dialog.getByLabel("Physical prism base orientation").fill("0");
  await dialog.getByRole("button", { name: "Place OD" }).click();
  await page.waitForTimeout(500);
  await expect(dialog.getByText(/OD —/)).toBeVisible();

  await dialog.getByLabel("Physical prism base orientation").fill("180");
  await page.waitForTimeout(3200);
  await expect(dialog.getByText(/OD ✓/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Place OS" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Withdraw prism" }).click();
  await dialog.getByLabel("Physical prism base orientation").fill("0");
  await dialog.getByRole("button", { name: "Place OS" }).click();
  await page.waitForTimeout(3200);
  await expect(dialog.getByText(/OS ✓/)).toBeVisible();

  const observationSelects = dialog.locator(".clinical-observation select");
  await observationSelects.nth(0).selectOption("version-with-refixation");
  await observationSelects.nth(1).selectOption("version-with-refixation");
  await expect(dialog.getByLabel("Final interpretation")).toBeVisible();
  await dialog.getByLabel("Final interpretation").selectOption("normal");
  await dialog.getByRole("button", { name: "Interpret and record" }).click();
  await expect(dialog.getByText("Bilateral comparison recorded.")).toBeVisible();
  await expect(dialog.locator(".clinical-coach")).toContainText(/STEP 9 OF 9/i);
});

test("desktop independent 4Δ Test hides coaching and authored findings", async ({ page }) => {
  const dialog = await launch(page, "Test");
  await expect(dialog.locator(".clinical-coach")).toHaveCount(0);
  await expect(dialog).not.toContainText(/version without refixation|central suppression of OS|normal response/i);
  await expect(dialog.getByRole("button", { name: "Place OS" })).toBeDisabled();
  await expect(dialog.getByLabel("Physical prism base orientation")).toBeVisible();
});

test("shared 4Δ clinic presents the target explicitly before fixation", async ({ page }) => {
  const dialog = await launch(page, "Guided Practice");
  const controls = dialog.getByRole("complementary", { name: "Practice clinic controls" });
  const fixation = controls.getByRole("button", { name: "LOOK AT THE ISOLATED LETTER", exact: true });
  const power = controls.getByRole("button", { name: "DISTANCE DISPLAY POWER", exact: true });
  await expect(fixation).toBeDisabled();
  await expect(power).toBeDisabled();
  await controls.getByRole("button", { name: "FIT THE TRIAL FRAME", exact: true }).click();
  await expect(power).toBeEnabled();
  await expect(fixation).toBeDisabled();
  await power.click();
  await expect(fixation).toBeEnabled();
  await expect(power).toBeEnabled();
  await fixation.click();
  await expect(controls).toContainText("Pick up the 4Δ prism.");
});
