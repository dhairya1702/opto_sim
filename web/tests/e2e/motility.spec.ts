import { test, expect } from "@playwright/test";
import { motilityHRoutePositions } from "../../interaction/motility";
import type { Locator, Page } from "@playwright/test";

async function enterTestEncounter(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: /Test yourself with a patient/ }).click();
  await page.getByRole("button", { name: "Use click-based station mode" }).click();
}

async function completeHRoute(page: Page, viewport: Locator) {
  const box = (await viewport.boundingBox())!;
  const point = (x: number, y: number) => ({ x: box.x + box.width * (0.5 + x * 0.4), y: box.y + box.height * (0.5 - y * 0.4) });
  let previous = motilityHRoutePositions[0];
  let position = point(previous.x, previous.y);
  await page.mouse.move(position.x, position.y); await page.mouse.down(); await page.waitForTimeout(850);
  const seen = new Set([previous.id]);
  for (const next of motilityHRoutePositions.slice(1)) {
    for (let step = 1; step <= 20; step += 1) {
      position = point(previous.x + (next.x - previous.x) * step / 20, previous.y + (next.y - previous.y) * step / 20);
      await page.mouse.move(position.x, position.y); await page.waitForTimeout(40);
    }
    if (!seen.has(next.id)) { await page.waitForTimeout(850); seen.add(next.id); }
    previous = next;
  }
  await page.mouse.up();
}
test("manual motility requires observation and supports cancellation and recording", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await enterTestEncounter(page);
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
  await page.getByRole("button", { name: "Switch penlight on" }).click();
  const viewport = page.getByRole("application", { name: /Manual fixation target/ });
  await viewport.focus();
  await page.keyboard.press("PageUp");
  await expect(page.getByLabel("Target distance", { exact: true })).toHaveValue("30");
  await completeHRoute(page, viewport);
  await expect(page.getByRole("list", { name: "Observed gaze positions" }).locator("li")).toHaveCount(9);
  await expect(page.getByRole("list", { name: "Observed gaze positions" })).not.toContainText("○");
  await expect(record).toBeDisabled();
  await page.getByRole("button", { name: "Ask about double vision, pain, or discomfort", exact: true }).click();
  await page.getByLabel("What did you observe?").selectOption("full");
  await expect(record).toBeEnabled();
  await page.screenshot({ path: "test-results/manual-motility.png", fullPage: true });
  await record.click();
  await page.getByRole("button", { name: "Notes", exact: false }).click();
  const note = page.getByRole("article");
  await expect(note.getByText("YOUR RECORDED OBSERVATION", { exact: true })).toBeVisible();
  await expect(note.getByText("FROM; smooth and accurate OU; no diplopia, pain, or discomfort reported.", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("narrow screen supports keyboard target control and Escape without saving", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enterTestEncounter(page);
  await page.getByRole("button", { name: /0[1-6] Instrument trolley/ }).click();
  await page.getByRole("button", { name: /^Ocular motility Fixation target/ }).click();
  await page.getByRole("button", { name: "Pick up instrument & examine", exact: true }).click();
  await page.getByRole("button", { name: "Examine Arun →", exact: true }).click();
  await page.getByRole("button", { name: "Ask Arun to follow the target, head still" }).click();
  await page.getByRole("button", { name: "Switch penlight on" }).click();
  const viewport = page.getByRole("application", { name: /Manual fixation target/ });
  await viewport.focus();
  await page.waitForTimeout(850);
  for (let i = 0; i < 8; i++) { await page.keyboard.press("ArrowLeft"); await page.waitForTimeout(120); }
  await page.waitForTimeout(850);
  await expect(page.getByRole("list", { name: "Observed gaze positions" })).toContainText("✓ Right gaze");
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
  await enterTestEncounter(page);
  await page.getByRole("button", { name: /0[1-6] Instrument trolley/ }).click();
  await page.getByRole("button", { name: /^Ocular motility Fixation target/ }).click();
  await page.getByRole("button", { name: "Pick up instrument & examine", exact: true }).click();
  await page.getByRole("button", { name: "Examine Arun →", exact: true }).click();
  await expect(page.getByText(/The eye view is unavailable|3D eye view unavailable/)).toBeVisible();
  await page.getByRole("button", { name: "Ask Arun to follow the target, head still" }).click();
  await expect(page.getByRole("status")).toContainText("0 / 9 positions observed");
  await expect(page.getByRole("button", { name: "Record finding & return to room →" })).toBeDisabled();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
});
