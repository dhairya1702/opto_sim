import { expect, test, type Page } from "@playwright/test";

async function launch(page: Page, lesson?: RegExp) {
  await page.goto("/");
  await page.getByRole("button", { name: /Practice clinical skills/ }).click();
  if (lesson) await page.getByRole("button", { name: lesson }).click();
  await page.getByRole("button", { name: "Guided Practice", exact: true }).click();
  await page.getByRole("button", { name: "Keyboard + mouse" }).click();
  await page.getByRole("button", { name: "Disable voice" }).click();
  await page.getByRole("button", { name: "Start Guided Practice" }).click();
  await expect(page.getByLabel("Practice clinic controls")).toContainText("LIVE MIRROR", { timeout: 45000 });
}

// Exercise the same command boundary as STT without microphone/provider nondeterminism.
async function say(page: Page, lesson: string, action: string) {
  return page.evaluate(async ([lessonId, actionId]) => {
    const moduleUrl = "/web/voice/practiceActions.ts";
    const { invokePracticeVoiceAction } = await import(moduleUrl);
    return invokePracticeVoiceAction(lessonId, actionId);
  }, [lesson, action]);
}

test("patient commands use the mounted procedure even with the mirror hidden and stop on exit", async ({ page }) => {
  await launch(page);
  await page.getByLabel("Practice clinic controls").evaluate(element => { (element as HTMLElement).hidden = true; });
  expect(await say(page, "motility", "follow-target")).toMatchObject({ accepted: true });
  await page.getByLabel("Practice clinic controls").evaluate(element => { (element as HTMLElement).hidden = false; });
  await expect(page.getByRole("button", { name: "FOLLOWING ✓", exact: true })).toBeVisible();
  expect(await say(page, "motility", "report-symptoms")).toMatchObject({ accepted: false, errorCode: "TECHNIQUE_GATE" });
  await page.getByRole("button", { name: "Close", exact: true }).click();
  expect(await say(page, "motility", "follow-target")).toMatchObject({ accepted: false });
});

test("push-up spoken instructions respect the actual ruler setup gate", async ({ page }) => {
  await launch(page, /Amplitude · push-up/);
  const button = page.getByRole("button", { name: "GIVE FIRST SUSTAINED BLUR INSTRUCTION", exact: true });
  await expect(button).toBeDisabled();
  expect(await say(page, "push-up", "fixate-target")).toMatchObject({ accepted: false, errorCode: "TECHNIQUE_GATE" });
  await expect(button).toBeDisabled();
});

test("Test desktop rejects a near request in an open distance examination", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Test yourself with a patient/ }).click();
  await page.getByRole("button", { name: "Use click-based station mode" }).click();
  await page.getByRole("button", { name: /0[1-6] Instrument trolley/ }).click();
  await page.getByRole("button", { name: /^Distance visual acuity / }).click();
  await page.getByRole("button", { name: "Pick up instrument & examine", exact: true }).click();
  await page.getByRole("button", { name: "Examine Arun →", exact: true }).click();
  const result = await page.evaluate(async () => {
    const moduleUrl = "/web/voice/testInstructions.ts";
    const { invokeTestVoiceInstruction } = await import(moduleUrl);
    return invokeTestVoiceInstruction("read-chart", "Read the near card");
  });
  expect(result).toMatchObject({ accepted: false, errorCode: "CHART_MISMATCH" });
  await expect(page.getByRole("button", { name: "Record finding & return to room →" })).toBeDisabled();
});
