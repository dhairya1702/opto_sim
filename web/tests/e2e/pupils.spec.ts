import { expect, test, type Page } from "@playwright/test";
import { pupilTargets, type PupilEye } from "../../interaction/pupils";

async function openPupilExam(page: Page, mode: "general" | "rapd") {
  await page.goto("/");
  await page.getByRole("button", { name: "Use click-based station mode" }).click();
  await page.getByRole("button", { name: /02 Instrument trolley/ }).click();
  await page.getByRole("button", { name: /^Pupil assessment Pen torch/ }).click();
  await page.getByLabel("Method / configuration").selectOption(mode);
  await page.getByRole("button", { name: "Pick up instrument & examine" }).click();
  await page.getByRole("button", { name: "Examine Arun →", exact: true }).click();
}

async function aim(page: Page, eye: PupilEye | "away") {
  const viewport = page.getByRole("application", { name: /Pen torch/ });
  const box = (await viewport.boundingBox())!;
  const pose = eye === "away" ? { x: 0, y: -0.75 } : pupilTargets[eye];
  await page.mouse.click(
    box.x + box.width * (0.5 + pose.x * 0.4),
    box.y + box.height * (0.5 - pose.y * 0.4),
  );
}

async function prepare(page: Page) {
  await page.getByRole("button", { name: "Ask Arun to look at a distant target" }).click();
  await page.getByLabel("Room illumination").fill("35");
  await page.getByRole("button", { name: "Switch torch on" }).click();
}

test("general pupil exam requires manual direct and consensual observations", async ({ page }) => {
  await openPupilExam(page, "general");
  const record = page.getByRole("button", { name: "Record your pupil findings →" });
  await expect(record).toBeDisabled();
  await page.getByRole("button", { name: "Ask Arun to look at a distant target" }).click();
  await page.getByRole("button", { name: "Switch torch on" }).click();
  await aim(page, "OD");
  await page.waitForTimeout(900);
  await expect(page.getByRole("list", { name: "Observed pupil responses" }).locator("li.seen")).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Dim the room illumination");
  await page.getByLabel("Room illumination").fill("35");

  await aim(page, "OD");
  await expect(page.getByRole("list", { name: "Observed pupil responses" }).getByText("✓ OD direct", { exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Observed pupil responses" }).getByText("✓ OS consensual", { exact: true })).toBeVisible();
  await aim(page, "away");
  await page.waitForTimeout(450);
  await aim(page, "OS");
  await expect(page.getByRole("list", { name: "Observed pupil responses" }).getByText("✓ OS direct", { exact: true })).toBeVisible();
  await expect(page.getByRole("list", { name: "Observed pupil responses" }).getByText("✓ OD consensual", { exact: true })).toBeVisible();

  await page.getByLabel("OD size").selectOption("4");
  await page.getByLabel("OS size").selectOption("4");
  await page.getByLabel("Equality").selectOption("equal");
  await page.getByLabel("OD direct").selectOption("brisk");
  await page.getByLabel("OS direct").selectOption("brisk");
  await page.getByLabel("Consensual OU").selectOption("present");
  await page.getByRole("button", { name: "Switch torch off" }).click();
  await expect(record).toBeEnabled();
  await page.screenshot({ path: "test-results/manual-pupils-general.png", fullPage: true });
  await record.click();
  await page.getByRole("button", { name: "Notes", exact: false }).click();
  const note = page.getByRole("article");
  await expect(note.getByText("OD 4 mm, OS 4 mm in dim illumination; pupils equal; direct responses brisk OU; consensual responses present OU.", { exact: true })).toBeVisible();
  await expect(note.getByText("YOUR RECORDED OBSERVATION", { exact: true })).toBeVisible();
});

test("swinging-light exam requires OD OS OD OS and records learner interpretation", async ({ page }) => {
  await openPupilExam(page, "rapd");
  await prepare(page);
  let completed = 0;
  for (const eye of ["OD", "OS", "OD", "OS"] as PupilEye[]) {
    await aim(page, eye);
    completed += 1;
    await expect(page.getByRole("list", { name: "Swinging-light sequence" }).locator("li.seen")).toHaveCount(completed);
  }
  await expect(page.getByRole("list", { name: "Swinging-light sequence" }).locator("li.seen")).toHaveCount(4);
  await page.getByLabel("Your RAPD observation").selectOption("none");
  await page.getByRole("button", { name: "Switch torch off" }).click();
  await page.getByRole("button", { name: "Record your pupil findings →" }).click();
  await expect(page.getByText("No relative afferent pupillary defect in this authored assessment.", { exact: true })).toBeVisible();
});

test("cancel discards progress and the pupil station remains usable on a narrow screen", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openPupilExam(page, "general");
  const viewport = page.getByRole("application", { name: /Pen torch/ });
  const gauge = page.getByLabel("Pupil-size reference gauge");
  const viewportBox = (await viewport.boundingBox())!;
  const gaugeBox = (await gauge.boundingBox())!;
  expect(gaugeBox.y).toBeGreaterThanOrEqual(viewportBox.y + viewportBox.height);
  expect(await page.getByRole("dialog").evaluate((element) => element.scrollWidth <= element.clientWidth + 1)).toBe(true);
  await page.getByRole("button", { name: "Cancel" }).click();
  await page.getByRole("button", { name: "Notes", exact: false }).click();
  await expect(page.getByText("No examinations performed yet.")).toBeVisible();
});

test("an unavailable 3D pupil view cannot produce a finding", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...args: any[]) {
      if (type.startsWith("webgl")) return null;
      return original.call(this, type as any, ...args);
    } as typeof original;
  });
  await openPupilExam(page, "general");
  await expect(page.getByText("The pupil view is unavailable.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Record your pupil findings →" })).toBeDisabled();
});
