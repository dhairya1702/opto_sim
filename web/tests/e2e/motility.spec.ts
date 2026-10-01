import { test, expect } from "@playwright/test";
import { gazePositions } from "../../interaction/motility";
test("manual motility requires observation and supports cancellation and recording", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Use click-based station mode" }).click();
  await page.getByRole("button", { name: /0[1-6] Instrument trolley/ }).click();
  await page.getByRole("button", { name: /^Ocular motility Fixation target/ }).click();
  await page.getByRole("button", { name: "Pick up instrument & examine", exact: true }).click();
  await page.getByRole("button", { name: "Examine Arun →", exact: true }).click();
  const record = page.getByRole("button", { name: "Record finding & return to room →" });
  await expect(record).toBeDisabled();
  await expect(page.getByRole("button", { name: "Skip animation" })).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Notes", exact: false }).click();
  await expect(page.getByText("No examinations performed yet.")).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  await page.getByRole("button", { name: "Examine Arun →", exact: true }).click();
  await page.getByRole("button", { name: "Ask Arun to follow the target, head still" }).click();
  const viewport = page.getByRole("application", { name: /Manual fixation target/ });
  await viewport.focus();
  await page.keyboard.press("PageUp");
  await expect(page.getByLabel("Target distance", { exact: true })).toHaveValue("45");
  const box = (await viewport.boundingBox())!;
  for (const p of gazePositions) {
    await page.mouse.move(box.x + box.width * (0.5 + p.x * 0.4), box.y + box.height * (0.5 - p.y * 0.4));
    await page.mouse.down();
    await page.mouse.up();
    await expect(page.getByRole("list", { name: "Observed gaze positions" }).getByText(`✓ ${p.label}`, { exact: true })).toBeVisible();
  }
  await expect(record).toBeDisabled();
  await page.getByRole("button", { name: "Ask about double vision", exact: true }).click();
  await page.getByLabel("What did you observe?").selectOption("full");
  await expect(record).toBeEnabled();
  await page.screenshot({ path: "test-results/manual-motility.png", fullPage: true });
  await record.click();
  await page.getByRole("button", { name: "Notes", exact: false }).click();
  await expect(page.getByRole("dialog").getByText("Full movements; no diplopia reported during the simulated assessment.", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("narrow screen supports keyboard target control and Escape without saving", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("button", { name: "Use click-based station mode" }).click();
  await page.getByRole("button", { name: /0[1-6] Instrument trolley/ }).click();
  await page.getByRole("button", { name: /^Ocular motility Fixation target/ }).click();
  await page.getByRole("button", { name: "Pick up instrument & examine", exact: true }).click();
  await page.getByRole("button", { name: "Examine Arun →", exact: true }).click();
  await page.getByRole("button", { name: "Ask Arun to follow the target, head still" }).click();
  const viewport = page.getByRole("application", { name: /Manual fixation target/ });
  await viewport.focus();
  for (let i = 0; i < 8; i++) await page.keyboard.press("ArrowLeft");
  await expect(page.getByRole("list", { name: "Observed gaze positions" }).getByText("✓ Screen left", { exact: true })).toBeVisible();
  await page.getByRole("checkbox", { name: "Show H-pattern guides" }).uncheck();
  await expect(page.locator(".gaze-stop")).toHaveCount(0);
  expect(await page.getByRole("dialog").evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.screenshot({ path: "test-results/manual-motility-mobile.png" });
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Notes", exact: false }).click();
  await expect(page.getByText("No examinations performed yet.")).toBeVisible();
});

test("missing WebGL cannot grant manual observation or a finding", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: any[]) {
      if (type.startsWith("webgl")) return null;
      return original.call(this, type as any, ...args);
    } as typeof original;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Use click-based station mode" }).click();
  await page.getByRole("button", { name: /0[1-6] Instrument trolley/ }).click();
  await page.getByRole("button", { name: /^Ocular motility Fixation target/ }).click();
  await page.getByRole("button", { name: "Pick up instrument & examine", exact: true }).click();
  await page.getByRole("button", { name: "Examine Arun →", exact: true }).click();
  await expect(page.getByText(/The eye view is unavailable|3D eye view unavailable/)).toBeVisible();
  await page.getByRole("button", { name: "Ask Arun to follow the target, head still" }).click();
  await expect(page.getByRole("status")).toHaveText("0 / 7 positions observed");
  await expect(page.getByRole("button", { name: "Record finding & return to room →" })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
});
