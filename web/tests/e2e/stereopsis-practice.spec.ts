import { expect, test, type Locator, type Page } from "@playwright/test";

async function launch(page: Page, kind: "Guided Practice" | "Test") {
  await page.goto("/");
  await page.getByRole("button", { name: /Practice clinical skills/ }).click();
  await page.getByRole("button", { name: /Stereopsis/ }).click();
  await page.getByRole("button", { name: kind, exact: true }).click();
  await page.getByRole("button", { name: "Keyboard + mouse" }).click();
  await page.getByRole("button", { name: "Disable voice" }).click();
  await page.getByRole("button", { name: `Start ${kind}` }).click();
  return page.getByRole("dialog", { name: /Stereopsis/ });
}

async function answerPage(dialog: Locator, pageIndex: number) {
  const reports = ["middle", "left", "right", "middle", "left", "middle"];
  await dialog.getByRole("button", { name: "LOOK AT THE CIRCLES", exact: true }).click();
  await dialog.getByRole("button", { name: "ASK WHICH CIRCLE IS RAISED", exact: true }).click();
  await expect(dialog.locator("[data-voice-report]")).toHaveText(`The ${reports[pageIndex]} circle looks raised.`);
  await dialog.getByRole("button", { name: reports[pageIndex], exact: true }).click();
  await dialog.getByRole("button", { name: pageIndex < 4 ? "correct" : "incorrect", exact: true }).click();
}

test("desktop Guided stereopsis uses fixation, transcription, classification, interruption preservation and independent recording", async ({ page }) => {
  const dialog = await launch(page, "Guided Practice");
  await expect(dialog.locator(".clinical-coach")).toContainText("Guided · step 1 of 9");
  await dialog.getByRole("button", { name: "Fit near correction" }).click();
  await dialog.getByRole("button", { name: "Fit polarised viewing glasses" }).click();

  const viewport = dialog.getByRole("application");
  await viewport.focus();
  for (let index = 0; index < 8; index++) await viewport.press("ArrowDown");
  await expect(dialog.getByText("40 cm", { exact: true }).first()).toBeVisible();

  await answerPage(dialog, 0);
  await dialog.getByRole("button", { name: "TURN PAGE", exact: true }).click();
  await dialog.getByRole("button", { name: "LOOK AT THE CIRCLES", exact: true }).click();
  await dialog.getByRole("button", { name: "ASK WHICH CIRCLE IS RAISED", exact: true }).click();
  await dialog.getByLabel(/Booklet distance/).fill("50");
  await expect(dialog.getByLabel("Confirmed page records")).toContainText("800 arcsec · patient middle · classified correct");
  await expect(dialog.locator("[data-voice-report]")).toHaveCount(0);
  await dialog.getByLabel(/Booklet distance/).fill("40");

  for (let pageIndex = 1; pageIndex < 6; pageIndex++) {
    await answerPage(dialog, pageIndex);
    if (pageIndex < 5) await dialog.getByRole("button", { name: "TURN PAGE", exact: true }).click();
  }
  const threshold = dialog.getByLabel("Last correct threshold");
  await expect(threshold).toBeEnabled();
  await threshold.selectOption("60");
  await dialog.getByRole("button", { name: "Record stereopsis" }).click();
  await expect(dialog.locator("[data-voice-status]")).toContainText("Recheck the confirmed page record");
  await threshold.selectOption("100");
  await dialog.getByRole("button", { name: "Record stereopsis" }).click();
  await expect(dialog.getByText("Stereopsis: 100 seconds of arc.")).toBeVisible();
  await expect(dialog.locator(".clinical-coach")).toContainText("Guided · complete");
});

test("desktop stereopsis Test hides coaching but retains the same examiner workflow", async ({ page }) => {
  const dialog = await launch(page, "Test");
  await expect(dialog.locator(".clinical-coach")).toHaveCount(0);
  await expect(dialog.getByText(/Examiner-only page key/)).toContainText("middle");
  await dialog.getByRole("button", { name: "Fit near correction" }).click();
  await dialog.getByRole("button", { name: "Fit polarised viewing glasses" }).click();
  await dialog.getByRole("button", { name: "Position booklet at 40 cm" }).click();
  await answerPage(dialog, 0);
  await expect(dialog.getByLabel("Confirmed page records")).toContainText("classified correct");
});
