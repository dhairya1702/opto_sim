import { expect, test, type Page } from "@playwright/test";
import { grossNeutralLens, retinoscopyTargets, type RetinoscopyEye } from "../../interaction/retinoscopy";

async function openRetinoscopy(page: Page, eye: RetinoscopyEye) {
  await page.goto("/");
  await page.getByRole("button", { name: "Use click-based station mode" }).click();
  await page.getByRole("button", { name: /02 Instrument trolley/ }).click();
  await page.getByRole("button", { name: /^Objective refraction Retinoscope kit/ }).click();
  await page.getByLabel("Tested eye").selectOption(eye);
  await page.getByRole("button", { name: /Pick up instrument & examine/ }).click();
  await page.getByRole("button", { name: "Examine Arun →", exact: true }).click();
}

async function place(page: Page, eye: RetinoscopyEye, offset: number) {
  const viewport = page.getByRole("application", { name: /Retinoscope/ });
  const box = (await viewport.boundingBox())!;
  const pose = { x: retinoscopyTargets[eye].x + offset, y: 0 };
  await page.mouse.click(box.x + box.width * (0.5 + pose.x * 0.4), box.y + box.height * 0.5);
}

async function sweepTwice(page: Page, eye: RetinoscopyEye) {
  const viewport = page.getByRole("application", { name: /Retinoscope/ });
  const box = (await viewport.boundingBox())!;
  const point = (offset: number) => ({
    x: box.x + box.width * (0.5 + (retinoscopyTargets[eye].x + offset) * 0.4),
    y: box.y + box.height * 0.5,
  });
  const left = point(-0.1), right = point(0.1);
  await page.mouse.move(left.x, left.y);
  await page.mouse.down();
  await page.mouse.move(right.x, right.y, { steps: 12 });
  await page.mouse.move(left.x, left.y, { steps: 12 });
  await page.mouse.up();
}

async function setLens(page: Page, target: number) {
  const display = page.getByLabel("Trial lens rack").getByRole("status");
  for (let value = -0.5; value < target; value += 0.25)
    await page.getByRole("button", { name: "Increase trial lens by 0.25 D" }).click();
  for (let value = -0.5; value > target; value -= 0.25)
    await page.getByRole("button", { name: "Reduce trial lens by 0.25 D" }).click();
  await expect(display).toContainText(target === 0 ? "0.00 D" : `${target > 0 ? "+" : "−"}${Math.abs(target).toFixed(2)} D`);
}

test("manual OD retinoscopy brackets reversal, checks both meridians and records the calculation", async ({ page }) => {
  await openRetinoscopy(page, "OD");
  const record = page.getByRole("button", { name: "Record your objective-refraction findings →" });
  await expect(record).toBeDisabled();
  await page.getByRole("button", { name: "Ask Arun to look at the distant target" }).click();
  await page.getByLabel("Retinoscopy working distance").fill("55");
  await page.getByRole("button", { name: "Switch retinoscope on" }).click();
  await place(page, "OD", -0.11);
  await expect(page.locator('p[role="status"]')).toContainText("67 cm");
  await page.getByLabel("Retinoscopy working distance").fill("67");

  await sweepTwice(page, "OD");
  await expect(page.getByText("✓ With motion", { exact: true })).toBeVisible();
  const neutral = grossNeutralLens("OD", 67);
  await setLens(page, neutral);
  await sweepTwice(page, "OD");
  await expect(page.getByText("✓ Neutral · 90°", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "180°" }).click();
  await sweepTwice(page, "OD");
  await expect(page.getByText("✓ Neutral · 180°", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Increase trial lens by 0.25 D" }).click();
  await sweepTwice(page, "OD");
  await expect(page.getByText("✓ Against motion", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reduce trial lens by 0.25 D" }).click();
  await page.getByRole("button", { name: "Switch retinoscope off" }).click();

  await page.getByLabel("Gross neutralisation").selectOption("0.25");
  await page.getByLabel("Working-distance correction").selectOption("-1.5");
  await page.getByLabel("Net sphere").selectOption("-1.25");
  await page.getByLabel("Retinoscopy cylinder").selectOption("0");
  await page.getByLabel("Retinoscopy axis").selectOption("na");
  await expect(record).toBeEnabled();
  await page.screenshot({ path: "test-results/manual-retinoscopy.png", fullPage: true });
  await record.click();
  await page.getByRole("button", { name: "Notes", exact: false }).click();
  await expect(page.getByRole("article").getByText("Gross neutralisation +0.25 D at 67 cm; working-distance correction −1.50 D; sphere −1.25 D · cylinder 0.00 D · axis not applicable.", { exact: true })).toBeVisible();
});

test("an unavailable reflex view cannot produce an objective finding", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: any[]) {
      if (type.startsWith("webgl")) return null;
      return original.call(this, type as any, ...args);
    } as typeof original;
  });
  await openRetinoscopy(page, "OS");
  await expect(page.getByText("The retinoscopy view is unavailable.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Record your objective-refraction findings →" })).toBeDisabled();
});
