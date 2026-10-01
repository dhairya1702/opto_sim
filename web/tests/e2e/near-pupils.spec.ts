import { expect, test, type Page } from "@playwright/test";

async function openNearResponse(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Use click-based station mode" }).click();
  await page.getByRole("button", { name: /02 Instrument trolley/ }).click();
  await page.getByRole("button", { name: /^Pupil assessment Pen torch/ }).click();
  await page.getByLabel("Method / configuration").selectOption("near_response");
  await page.getByRole("button", { name: "Pick up instrument & examine" }).click();
  await page.getByRole("button", { name: "Examine Arun →", exact: true }).click();
}

async function setDistance(page: Page, distance: string, completed: number) {
  await page.getByLabel("Near-response target distance").fill(distance);
  await expect(page.getByRole("list", { name: "Near-response procedure sequence" }).locator("li.seen")).toHaveCount(completed);
}

test("near pupil response requires manual approach, recovery and learner interpretation", async ({ page }) => {
  await openNearResponse(page);
  const record = page.getByRole("button", { name: "Record your near-response findings →" });
  await expect(record).toBeDisabled();
  const viewport = page.getByRole("application", { name: /Near-response fixation target/ });
  const box = (await viewport.boundingBox())!;
  await page.mouse.click(box.x + box.width * 0.82, box.y + box.height * 0.5);
  await page.getByRole("button", { name: "Ask Arun to follow the target and report double vision" }).click();
  await page.waitForTimeout(800);
  await expect(page.locator('p[role="status"]')).toContainText("Centre the target");
  await expect(page.getByRole("list", { name: "Near-response procedure sequence" }).locator("li.seen")).toHaveCount(0);
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await setDistance(page, "70", 1);
  await setDistance(page, "40", 2);
  await setDistance(page, "20", 3);
  await setDistance(page, "65", 4);
  await page.getByLabel("Observed convergence").selectOption("present");
  await page.getByLabel("Observed pupillary constriction").selectOption("equal");
  await page.getByLabel("Fixation maintenance").selectOption("maintained");
  await page.getByLabel("Near-response interpretation").selectOption("normal");
  await expect(record).toBeEnabled();
  await expect(page.getByText("Arun: “It stayed single while it came closer.”")).toBeVisible();
  await page.screenshot({ path: "test-results/manual-near-pupil-response.png", fullPage: true });
  await record.click();
  await page.getByRole("button", { name: "Notes", exact: false }).click();
  const note = page.getByRole("article");
  await expect(note.getByText("Convergence and equal pupillary constriction observed to a near target; fixation maintained.", { exact: true })).toBeVisible();
  await expect(note.getByText("YOUR RECORDED OBSERVATION", { exact: true })).toBeVisible();
});

test("an unavailable 3D near-response view cannot produce a finding", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: any[]) {
      if (type.startsWith("webgl")) return null;
      return original.call(this, type as any, ...args);
    } as typeof original;
  });
  await openNearResponse(page);
  await expect(page.getByText("The near-response view is unavailable.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Record your near-response findings →" })).toBeDisabled();
});
