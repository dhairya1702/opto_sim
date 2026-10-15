import { expect, test, type Locator, type Page } from "@playwright/test";

async function launch(page: Page, kind: "Guided Practice" | "Test") {
  await page.goto("/");
  await page.getByRole("button", { name: /Practice clinical skills/ }).click();
  await page.getByRole("button", { name: /Maddox rod method/ }).click();
  await page.getByRole("button", { name: kind, exact: true }).click();
  await page.getByRole("button", { name: "Keyboard + mouse" }).click();
  await page.getByRole("button", { name: "Disable voice" }).click();
  await page.getByRole("button", { name: `Start ${kind}` }).click();
  return page.getByRole("dialog", { name: /Maddox rod/ });
}

const cellIndices: Record<number, number> = { 2: 0, 4: 1, 6: 2, 8: 3, 10: 4, 12: 5, 15: 6, 20: 7 };

async function completeTrial(dialog: Locator, axis: "horizontal" | "vertical", site: "distance" | "near", power: 6 | 4, base: "BI" | "BU") {
  await dialog.getByRole("button", { name: "Fit rod before OD" }).click();
  if (axis === "horizontal") await dialog.getByRole("button", { name: /Remove, roll and refit rod/ }).click();
  await dialog.getByRole("button", { name: site === "near" ? "Press penlight trigger" : "Press target switch" }).click();
  await dialog.getByRole("button", { name: /Tell me where the streak is/ }).click();
  await dialog.getByRole("button", { name: "Pick up prism bar" }).click();
  await dialog.getByLabel("Physical base arrow").selectOption(base);
  await pageWait(dialog, 300);
  await dialog.getByLabel(/Cell over OD/).fill(String(cellIndices[power]));
  await pageWait(dialog, 320);
  await expect(dialog.locator("[data-voice-report]")).toHaveText("The streak passes through the light.");
  await dialog.getByRole("button", { name: /capture coincidence/ }).click();
  await dialog.getByRole("button", { name: "Put prism bar down" }).click();
  if (site === "near") await dialog.getByRole("button", { name: "Release penlight trigger" }).click();
  await dialog.getByLabel("Captured prism power (Δ)").fill(String(power));
  await dialog.getByLabel("Captured prism base").selectOption(base);
  await dialog.getByRole("button", { name: "Record captured trial" }).click();
}

async function pageWait(dialog: Locator, milliseconds: number) {
  await dialog.page().waitForTimeout(milliseconds);
}

test("desktop Guided Maddox completes all physical stepped-cell trials and records power plus base", async ({ page }) => {
  const dialog = await launch(page, "Guided Practice");
  await expect(dialog.locator(".clinical-coach")).toContainText(/STEP 1 OF 10/i);
  await dialog.getByRole("button", { name: "Fit habitual correction" }).click();
  await completeTrial(dialog, "horizontal", "distance", 6, "BI");
  await completeTrial(dialog, "vertical", "distance", 4, "BU");
  await completeTrial(dialog, "horizontal", "near", 6, "BI");
  await completeTrial(dialog, "vertical", "near", 4, "BU");
  await expect(dialog.getByText("Distance and near · both axes complete.")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Repeat same case" })).toBeVisible();
  await expect(dialog.getByLabel("Recorded Maddox trials")).toContainText("near · vertical: 4Δ BU");
});

test("desktop independent Maddox Test hides coaching and keeps capture entry blank", async ({ page }) => {
  const dialog = await launch(page, "Test");
  await expect(dialog.locator(".clinical-coach")).toHaveCount(0);
  await expect(dialog).not.toContainText(/6Δ BI|4Δ BU|Introduce and stably centre/i);
  await expect(dialog.getByLabel("Captured prism power (Δ)")).toHaveValue("");
  await expect(dialog.getByLabel("Captured prism base")).toHaveValue("");
  await expect(dialog.getByLabel("Captured prism power (Δ)")).toBeDisabled();
});
