import { expect, test, type Locator } from "@playwright/test";

const press = async (viewport: Locator, key: string, times: number) => {
  for (let i = 0; i < times; i++) await viewport.press(key);
};

test("desktop cover–uncover practice completes the ordered sequence and records the interpretation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Practice clinical skills/ }).click();
  await page.getByRole("button", { name: /Cover–uncover test/ }).click();
  await page.getByRole("button", { name: "Guided Practice" }).click();
  await page.getByRole("button", { name: "Keyboard + mouse" }).click();
  await page.getByRole("button", { name: "Disable voice" }).click();
  await page.getByRole("button", { name: "Start Guided Practice" }).click();

  const dialog = page.getByRole("dialog", { name: "Cover–uncover test" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: /Give fixation instruction/ }).click();
  const viewport = dialog.getByRole("application");
  await viewport.focus();

  // Occluder starts below the face. Raise it to eye level, cover OD, lower it, cover OS, lower it.
  await press(viewport, "ArrowUp", 9);
  await press(viewport, "ArrowLeft", 6);
  await page.waitForTimeout(1100);
  await press(viewport, "ArrowDown", 9);
  await page.waitForTimeout(800);
  await press(viewport, "ArrowUp", 9);
  await press(viewport, "ArrowRight", 12);
  await page.waitForTimeout(1100);
  await press(viewport, "ArrowDown", 9);
  await expect(dialog.getByRole("status")).toContainText("Sequence observed", { timeout: 3000 });

  await dialog.getByLabel("What pattern did you observe?").selectOption("orthophoria");
  await dialog.getByRole("button", { name: "Check interpretation" }).click();
  await expect(dialog.getByText("No movement was seen on covering or uncovering either eye.")).toBeVisible();

});

test("desktop alternating cover restarts on binocular exposure and needs an eye-specific prism endpoint", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Practice clinical skills/ }).click();
  await page.getByRole("button", { name: /Alternating cover test/ }).click();
  await page.getByRole("button", { name: "Guided Practice" }).click();
  await page.getByRole("button", { name: "Keyboard + mouse" }).click();
  await page.getByRole("button", { name: "Disable voice" }).click();
  await page.getByRole("button", { name: "Start Guided Practice" }).click();

  const dialog = page.getByRole("dialog", { name: "Alternating cover + prism neutralisation" });
  await dialog.getByRole("button", { name: /Give fixation instruction/ }).click();
  const viewport = dialog.getByRole("application");
  await viewport.focus();
  const status = dialog.getByRole("status");

  // Cover OD, then wrongly lower the occluder (both eyes uncovered) before shifting: the sequence restarts.
  await press(viewport, "ArrowUp", 9);
  await press(viewport, "ArrowLeft", 6);
  await page.waitForTimeout(900);
  await press(viewport, "ArrowDown", 9);
  await expect(status).toContainText("Both eyes were uncovered too long", { timeout: 2000 });

  // Correct technique: shift directly between eyes at eye level.
  // Raises the occluder from below the face onto OD, then shifts OD → OS → OD → OS, waiting for each
  // position to be credited rather than for a fixed time (key presses re-render the canvas at varying speed).
  const done = dialog.locator(".sequence-compact .done");
  const alternate = async (fromCentre: boolean) => {
    await press(viewport, "ArrowUp", 9);
    if (fromCentre) await press(viewport, "ArrowLeft", 6);
    await expect(done).toHaveCount(1, { timeout: 3000 });
    for (const [index, key] of (["ArrowRight", "ArrowLeft", "ArrowRight"] as const).entries()) {
      await press(viewport, key, 12);
      if (index < 2) await expect(done).toHaveCount(index + 2, { timeout: 3000 });
    }
  };
  await alternate(false); // the occluder is still horizontally over OD after being lowered
  await expect(status).toContainText("Sequence observed", { timeout: 3000 });

  // Choosing the movement must not fill in the interpretation.
  await dialog.getByLabel("OD movement on uncovering").selectOption("in");
  await expect(dialog.getByLabel("Deviation")).toHaveValue("");
  await dialog.getByLabel("Deviation").selectOption("exo");

  const repeat = dialog.getByRole("button", { name: /Repeat alternate cover with prism/ });
  await dialog.getByLabel("Prism base").selectOption("base-in");
  await dialog.getByLabel(/Prism power/).fill("12");
  await expect(repeat).toBeDisabled(); // no eye chosen yet
  await dialog.getByLabel("Prism before").selectOption("OS");
  await repeat.click();
  await viewport.focus();
  await alternate(true); // a prism repeat starts with the occluder back at centre
  await expect(dialog.locator(".neutral-message.success").first()).toHaveText("No refixation movement remains: prism neutralisation reached.", { timeout: 3000 });
  await dialog.getByRole("button", { name: "Record neutralised deviation" }).click();
  await expect(dialog.getByText("Neutralised deviation recorded.")).toBeVisible();
});
