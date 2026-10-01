import { expect, test, type Page } from "@playwright/test";
import { acuityTarget } from "../../interaction/acuity";

async function enter(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Use click-based station mode" }).click();
}

async function openAcuityExam(page: Page, name: string) {
  await page.getByRole("button", { name: /0[1-6] Instrument trolley/ }).click();
  await page.getByRole("button", { name: new RegExp(`^${name} `) }).click();
  await page.getByRole("button", { name: "Pick up instrument & examine", exact: true }).click();
  await page.getByRole("button", { name: "Examine Arun →", exact: true }).click();
}

async function placeTool(page: Page, examId: "distance" | "pinhole" | "near", eye: "OD" | "OS") {
  const viewport = page.getByRole("application", { name: /Plain occluder|Pinhole paddle/ });
  const box = (await viewport.boundingBox())!;
  const target = acuityTarget(examId, eye);
  await page.mouse.click(box.x + box.width * (0.5 + target.x * 0.4), box.y + box.height * 0.5);
}

test("manual acuity requires the correct tool position and patient response", async ({ page }) => {
  await enter(page);
  await openAcuityExam(page, "Distance visual acuity");
  const chart = page.getByLabel("Distance visual-acuity chart");
  await expect(chart).toBeVisible();
  await expect(chart.getByText("6/60", { exact: true })).toBeVisible();
  await expect(chart.getByText("6/6", { exact: true })).toBeVisible();
  const record = page.getByRole("button", { name: "Record finding & return to room →" });
  await expect(record).toBeDisabled();
  await page.getByRole("button", { name: "Ask Arun to read the chart" }).click();

  // OD is tested, so putting the solid paddle over OD is the wrong eye.
  await placeTool(page, "pinhole", "OD");
  await expect(record).toBeDisabled();
  await expect(page.getByRole("status")).toContainText("Move the occluder");

  await placeTool(page, "distance", "OD");
  await expect(page.getByLabel("Arun's chart responses").getByText(/sorry, I can’t read the rest/)).toBeVisible();
  await expect(record).toBeDisabled();
  await page.getByLabel("Smallest line read correctly").selectOption("6/18");
  await expect(record).toBeEnabled();
  await page.screenshot({ path: "test-results/manual-distance-acuity.png" });
  await record.click();
  await page.getByRole("button", { name: "Notes", exact: false }).click();
  await expect(page.getByRole("article").getByText("6/18", { exact: true })).toBeVisible();
  await expect(page.getByRole("article").getByText("YOUR RECORDED OBSERVATION", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();
  await page.getByRole("button", { name: "Put down & return to room" }).click();

  await openAcuityExam(page, "Pinhole acuity");
  await page.getByRole("button", { name: "Ask Arun to read the chart" }).click();
  await placeTool(page, "pinhole", "OD");
  await page.getByLabel("Smallest line read correctly").selectOption("6/6");
  await expect(page.getByRole("button", { name: "Record finding & return to room →" })).toBeEnabled();
  await expect(page.getByLabel("Arun's chart responses").getByText(/no, sorry, I can’t make out the rest/)).toBeVisible();
  await page.screenshot({ path: "test-results/manual-pinhole-acuity.png" });
});

test("near acuity requires the card at 40 cm and the fellow eye covered", async ({ page }) => {
  await enter(page);
  await openAcuityExam(page, "Near acuity");
  const nearChart = page.getByLabel("Near-vision reading chart");
  await expect(nearChart).toBeVisible();
  await expect(nearChart.getByText("N6", { exact: true })).toBeVisible();
  await expect(nearChart.getByText("The quick brown fox jumps over the lazy dog.")).toBeVisible();
  await page.getByRole("button", { name: "Ask Arun to read the near card" }).click();
  await placeTool(page, "near", "OD");
  const record = page.getByRole("button", { name: "Record finding & return to room →" });
  await page.getByLabel("Smallest line read correctly").selectOption("N6");
  await expect(record).toBeEnabled();
  await page.getByLabel("Near-card distance").fill("52");
  await expect(record).toBeDisabled();
  await expect(page.getByRole("status")).toHaveText("Set the near card to 40 cm.");
  await page.getByLabel("Near-card distance").fill("40");
  await expect(record).toBeEnabled();
  await page.screenshot({ path: "test-results/manual-near-acuity.png" });
});

test("an unavailable patient view cannot produce an acuity finding", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: any[]) {
      if (type.startsWith("webgl")) return null;
      return original.call(this, type as any, ...args);
    } as typeof original;
  });
  await enter(page);
  await openAcuityExam(page, "Distance visual acuity");
  await page.getByRole("button", { name: "Ask Arun to read the chart" }).click();
  await placeTool(page, "distance", "OD");
  await expect(page.getByRole("button", { name: "Record finding & return to room →" })).toBeDisabled();
});

test("the chart stacks below the patient view on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await openAcuityExam(page, "Distance visual acuity");
  const viewport = page.getByRole("application", { name: /Plain occluder/ });
  const chart = page.getByLabel("Distance visual-acuity chart");
  await expect(chart).toBeVisible();
  const viewportBox = (await viewport.boundingBox())!;
  const chartBox = (await chart.boundingBox())!;
  expect(chartBox.y).toBeGreaterThanOrEqual(viewportBox.y + viewportBox.height);
  expect(await page.getByRole("dialog").evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
});
