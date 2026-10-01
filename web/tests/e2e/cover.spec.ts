import { expect, test, type Page } from "@playwright/test";
import { coverProcedure, coverTargets, type CoverPosition } from "../../interaction/cover";

async function openCoverTest(page: Page, mode: "distance" | "near") {
  await page.goto("/");
  await page.getByRole("button", { name: "Use click-based station mode" }).click();
  await page.getByRole("button", { name: /02 Instrument trolley/ }).click();
  await page.getByRole("button", { name: /^Cover test Occluder \+ fixation target/ }).click();
  await page.getByLabel("Method / configuration").selectOption(mode);
  await page.getByRole("button", { name: "Pick up instrument & examine" }).click();
  await page.getByRole("button", { name: "Examine Arun →", exact: true }).click();
}

async function placeOccluder(page: Page, position: CoverPosition) {
  const viewport = page.getByRole("application", { name: /Cover-test occluder/ });
  const box = (await viewport.boundingBox())!;
  const pose = position === "away" ? { x: 0, y: -0.72 } : coverTargets[position];
  await page.mouse.click(
    box.x + box.width * (0.5 + pose.x * 0.4),
    box.y + box.height * (0.5 - pose.y * 0.4),
  );
}

async function completeTechnique(page: Page) {
  let completed = 0;
  for (const step of coverProcedure) {
    await placeOccluder(page, step.position);
    completed += 1;
    await expect(page.getByRole("list", { name: "Cover-test procedure sequence" }).locator("li.seen")).toHaveCount(completed);
  }
}

async function recordNormalObservation(page: Page) {
  await page.getByLabel("OD on cover–uncover").selectOption("none");
  await page.getByLabel("OS on cover–uncover").selectOption("none");
  await page.getByLabel("Alternating cover observation").selectOption("none");
  await page.getByLabel("Overall interpretation").selectOption("none");
}

test("manual distance cover test requires the complete technique and learner interpretation", async ({ page }) => {
  await openCoverTest(page, "distance");
  const record = page.getByRole("button", { name: "Record your cover-test findings →" });
  await expect(record).toBeDisabled();
  await placeOccluder(page, "OD");
  await page.waitForTimeout(800);
  await expect(page.getByRole("list", { name: "Cover-test procedure sequence" }).locator("li.seen")).toHaveCount(0);
  await page.getByRole("button", { name: "Ask Arun to fixate at distance" }).click();
  await completeTechnique(page);
  await recordNormalObservation(page);
  await expect(record).toBeEnabled();
  await page.screenshot({ path: "test-results/manual-cover-distance.png", fullPage: true });
  await record.click();
  await page.getByRole("button", { name: "Notes", exact: false }).click();
  const note = page.getByRole("article");
  await expect(note.getByText("No refixation movement observed during cover–uncover or alternating cover testing at distance.", { exact: true })).toBeVisible();
  await expect(note.getByText("YOUR RECORDED OBSERVATION", { exact: true })).toBeVisible();
});

test("near cover testing requires a 40 cm fixation target", async ({ page }) => {
  await openCoverTest(page, "near");
  await page.getByRole("button", { name: "Ask Arun to fixate at near" }).click();
  await page.getByLabel("Near fixation distance").fill("55");
  await placeOccluder(page, "OD");
  await page.waitForTimeout(800);
  await expect(page.getByRole("status")).toHaveText("Set the near fixation target to 40 cm.");
  await expect(page.getByRole("list", { name: "Cover-test procedure sequence" }).locator("li.seen")).toHaveCount(0);
  await page.getByLabel("Near fixation distance").fill("40");
  await completeTechnique(page);
  await recordNormalObservation(page);
  await expect(page.getByRole("button", { name: "Record your cover-test findings →" })).toBeEnabled();
});

test("cancel discards the cover test and the mobile layout does not overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openCoverTest(page, "distance");
  const viewport = page.getByRole("application", { name: /Cover-test occluder/ });
  const target = page.getByLabel("distance fixation target");
  const viewportBox = (await viewport.boundingBox())!;
  const targetBox = (await target.boundingBox())!;
  expect(targetBox.y).toBeGreaterThanOrEqual(viewportBox.y + viewportBox.height);
  expect(await page.getByRole("dialog").evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Notes", exact: false }).click();
  await expect(page.getByText("No examinations performed yet.")).toBeVisible();
});
