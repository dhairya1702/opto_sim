import { test, expect, type Page } from "@playwright/test";
import { clinicalCase as c } from "../../cases/adultDistanceBlur";
import type { StationId } from "../../domain/types";
import { gazePositions } from "../../interaction/motility";
import { acuityTarget } from "../../interaction/acuity";
import { pupilTargets, type PupilEye } from "../../interaction/pupils";
import { coverProcedure, coverTargets, type CoverPosition } from "../../interaction/cover";
import { grossNeutralLens, retinoscopyTargets, type RetinoscopyEye } from "../../interaction/retinoscopy";
import { stations } from "../../interaction/navigation";
async function enter(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Use click-based station mode" }).click();
}
async function openStation(page: Page, id: StationId) {
  const s = stations.find((s) => s.id === id)!;
  await page.getByRole("button", { name: new RegExp(`0[1-6] ${s.name}`) }).click();
}
async function close(page: Page) {
  await page.getByRole("button", { name: "Return to room", exact: true }).click();
}
async function completeManualAcuity(page: Page, examId: "distance" | "pinhole" | "near", eye: "OD" | "OS") {
  await page.getByRole("button", { name: /Ask Arun to read/ }).click();
  const viewport = page.getByRole("application", { name: /Plain occluder|Pinhole paddle/ });
  const box = (await viewport.boundingBox())!;
  const target = acuityTarget(examId, eye);
  await page.mouse.click(
    box.x + box.width * (0.5 + target.x * 0.4),
    box.y + box.height * (0.5 - target.y * 0.4),
  );
  const expected = examId === "distance" ? "6/18" : examId === "pinhole" ? "6/6" : "N6";
  await page.getByLabel("Smallest line read correctly").selectOption(expected);
  await expect(page.getByRole("button", { name: "Record finding & return to room →" })).toBeEnabled();
}
async function completeManualPupils(page: Page, mode: string) {
  if (mode === "near_response") {
    await page.getByRole("button", { name: "Ask Arun to follow the target and report double vision" }).click();
    let completed = 0;
    for (const distance of ["70", "40", "20", "65"]) {
      await page.getByLabel("Near-response target distance").fill(distance);
      completed += 1;
      await expect(page.getByRole("list", { name: "Near-response procedure sequence" }).locator("li.seen")).toHaveCount(completed);
    }
    await page.getByLabel("Observed convergence").selectOption("present");
    await page.getByLabel("Observed pupillary constriction").selectOption("equal");
    await page.getByLabel("Fixation maintenance").selectOption("maintained");
    await page.getByLabel("Near-response interpretation").selectOption("normal");
    await expect(page.getByRole("button", { name: "Record your near-response findings →" })).toBeEnabled();
    return;
  }
  await page.getByRole("button", { name: "Ask Arun to look at a distant target" }).click();
  await page.getByLabel("Room illumination").fill("35");
  await page.getByRole("button", { name: "Switch torch on" }).click();
  const viewport = page.getByRole("application", { name: /Pen torch/ });
  const box = (await viewport.boundingBox())!;
  const aim = async (eye: PupilEye | "away") => {
    const pose = eye === "away" ? { x: 0, y: -0.75 } : pupilTargets[eye];
    await page.mouse.click(box.x + box.width * (0.5 + pose.x * 0.4), box.y + box.height * (0.5 - pose.y * 0.4));
  };
  if (mode === "general") {
    await aim("OD");
    await expect(page.getByText("✓ OD direct", { exact: true })).toBeVisible();
    await aim("away");
    await page.waitForTimeout(450);
    await aim("OS");
    await expect(page.getByText("✓ OS direct", { exact: true })).toBeVisible();
    await page.getByLabel("OD size").selectOption("4");
    await page.getByLabel("OS size").selectOption("4");
    await page.getByLabel("Equality").selectOption("equal");
    await page.getByLabel("OD direct").selectOption("brisk");
    await page.getByLabel("OS direct").selectOption("brisk");
    await page.getByLabel("Consensual OU").selectOption("present");
  } else {
    let completed = 0;
    for (const eye of ["OD", "OS", "OD", "OS"] as PupilEye[]) {
      await aim(eye);
      completed += 1;
      await expect(page.getByRole("list", { name: "Swinging-light sequence" }).locator("li.seen")).toHaveCount(completed);
    }
    await page.getByLabel("Your RAPD observation").selectOption("none");
  }
  await page.getByRole("button", { name: "Switch torch off" }).click();
  await expect(page.getByRole("button", { name: "Record your pupil findings →" })).toBeEnabled();
}
async function completeManualCover(page: Page, mode: string) {
  await page.getByRole("button", { name: `Ask Arun to fixate at ${mode}` }).click();
  if (mode === "near") await page.getByLabel("Near fixation distance").fill("40");
  const viewport = page.getByRole("application", { name: /Cover-test occluder/ });
  const box = (await viewport.boundingBox())!;
  const place = async (position: CoverPosition) => {
    const pose = position === "away" ? { x: 0, y: -0.72 } : coverTargets[position];
    await page.mouse.click(box.x + box.width * (0.5 + pose.x * 0.4), box.y + box.height * (0.5 - pose.y * 0.4));
  };
  let completed = 0;
  for (const coverStep of coverProcedure) {
    await place(coverStep.position);
    completed += 1;
    await expect(page.getByRole("list", { name: "Cover-test procedure sequence" }).locator("li.seen")).toHaveCount(completed);
  }
  await page.getByLabel("OD on cover–uncover").selectOption("none");
  await page.getByLabel("OS on cover–uncover").selectOption("none");
  await page.getByLabel("Alternating cover observation").selectOption("none");
  await page.getByLabel("Overall interpretation").selectOption("none");
}
async function completeManualRetinoscopy(page: Page, eye: RetinoscopyEye) {
  await page.getByRole("button", { name: "Ask Arun to look at the distant target" }).click();
  await page.getByRole("button", { name: "Switch retinoscope on" }).click();
  const viewport = page.getByRole("application", { name: /Retinoscope/ });
  const box = (await viewport.boundingBox())!;
  const place = async (offset: number) => {
    const x = retinoscopyTargets[eye].x + offset;
    await page.mouse.click(box.x + box.width * (0.5 + x * 0.4), box.y + box.height * 0.5);
    await page.waitForTimeout(90);
  };
  const sweep = async () => {
    await place(-0.11);
    await place(0.11);
    await place(-0.11);
  };
  await sweep();
  await expect(page.getByText("✓ With motion", { exact: true })).toBeVisible();
  const gross = grossNeutralLens(eye, 67);
  for (let value = -0.5; value < gross; value += 0.25)
    await page.getByRole("button", { name: "Increase trial lens by 0.25 D" }).click();
  await sweep();
  await expect(page.getByText("✓ Neutral · 90°", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "180°" }).click();
  await sweep();
  await expect(page.getByText("✓ Neutral · 180°", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Increase trial lens by 0.25 D" }).click();
  await sweep();
  await expect(page.getByText("✓ Against motion", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Reduce trial lens by 0.25 D" }).click();
  await page.getByRole("button", { name: "Switch retinoscope off" }).click();
  await page.getByLabel("Gross neutralisation").selectOption(String(gross));
  await page.getByLabel("Working-distance correction").selectOption("-1.5");
  await page.getByLabel("Net sphere").selectOption(String(eye === "OD" ? -1.25 : -1.5));
  await page.getByLabel("Retinoscopy cylinder").selectOption("0");
  await page.getByLabel("Retinoscopy axis").selectOption("na");
}
test("complete scripted encounter without credentials", async ({ page }) => {
  test.setTimeout(210000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await enter(page);
  await expect(page.locator(".scene-loading")).toHaveCount(0);
  await expect(page.locator("canvas")).toBeVisible();
  await page.waitForFunction(() => !!(document.querySelector("canvas") as any)?.__optoView);
  await page.context().setOffline(true);
  await page.screenshot({ path: "test-results/room.png" });
  await openStation(page, "patient");
  await page.getByRole("button", { name: "Suggested questions" }).click();
  for (const f of c.historyFacts) await page.getByRole("button", { name: f.question }).click();
  await close(page);
  for (const exam of c.exams) {
    for (const eye of exam.eyes)
      for (const mode of exam.modes) {
        await openStation(page, exam.equipmentIds[0]);
        await page.getByRole("button", { name: new RegExp(`^${exam.name} `) }).click();
        await page.getByLabel("Tested eye").selectOption(eye);
        await page.getByLabel("Method / configuration").selectOption(mode.id);
        await page.getByRole("button", { name: /^(Pick up instrument & examine|Pick up kit & repeat|Use slit-lamp station)$/ }).click();
        if (exam.id !== "anterior") await page.getByRole("button", { name: "Examine Arun →", exact: true }).click();
        if (exam.id === "motility") {
          await page.getByRole("button", { name: "Ask Arun to follow the target, head still" }).click();
          const viewport = page.getByRole("application", { name: /Manual fixation target/ });
          const box = (await viewport.boundingBox())!;
          for (const p of gazePositions) {
            await page.mouse.click(box.x + box.width * (0.5 + p.x * 0.4), box.y + box.height * (0.5 - p.y * 0.4));
            await expect(page.getByRole("list", { name: "Observed gaze positions" }).getByText(`✓ ${p.label}`, { exact: true })).toBeVisible();
          }
          await page.getByRole("button", { name: "Ask about double vision", exact: true }).click();
          await page.getByLabel("What did you observe?").selectOption("full");
        } else if (["distance", "pinhole", "near"].includes(exam.id)) {
          await completeManualAcuity(page, exam.id as "distance" | "pinhole" | "near", eye as "OD" | "OS");
        } else if (exam.id === "pupils") {
          await completeManualPupils(page, mode.id);
        } else if (exam.id === "cover") {
          await completeManualCover(page, mode.id);
        } else if (exam.id === "objective") {
          await completeManualRetinoscopy(page, eye as RetinoscopyEye);
        } else {
          await page.getByRole("button", { name: "Skip animation", exact: true }).click({ force: true });
        }
        await page.getByRole("button", {
          name:
            exam.id === "pupils"
              ? mode.id === "near_response"
                ? "Record your near-response findings →"
                : "Record your pupil findings →"
              : exam.id === "cover"
                ? "Record your cover-test findings →"
                : exam.id === "objective"
                  ? "Record your objective-refraction findings →"
                : "Record finding & return to room →",
        }).click();
        await page.getByRole("button", { name: "Put down & return to room", exact: true }).click();
      }
  }
  await page.getByRole("button", { name: "Notes", exact: false }).click();
  await expect(
    page.getByRole("dialog").getByText("Sphere −1.50 D · cylinder 0.00 D · axis not applicable. Corrected acuity 6/6."),
  ).toBeVisible();
  await close(page);
  await page.getByRole("button", { name: "Complete encounter", exact: false }).click();
  await page.getByLabel("Working diagnosis").selectOption("myopia");
  const checks = page.getByRole("checkbox");
  for (let i = 0; i < (await checks.count()); i++) await checks.nth(i).check();
  await page
    .getByLabel("Clinical reasoning")
    .fill(
      "Both eyes have reduced unaided distance acuity, improve with pinhole, and reach 6/6 with negative spherical refraction.",
    );
  await page
    .getByLabel("Management reasoning")
    .fill("Review ocular health and the limited undilated view before agreeing local follow-up.");
  await page
    .getByLabel("What would you say to Arun?")
    .fill(
      "Your distance vision improved with the lenses we tried. We can discuss glasses and follow-up after checking your eye health.",
    );
  await page.getByRole("button", { name: "Submit assessment" }).click();
  await expect(page.getByRole("heading", { name: "Consultation debrief" })).toBeVisible();
  await expect(page.locator(".score")).toHaveText("100/ 100");
  await expect(page.getByRole("heading", { name: "Recorded acuity review" })).toBeVisible();
  await expect(page.getByText("✓ Matches case").first()).toBeVisible();
  await page.screenshot({ path: "test-results/debrief.png" });
  expect(errors).toEqual([]);
  await page.getByRole("button", { name: "New attempt" }).click();
  await expect(page.getByRole("heading", { name: "Your patient" })).toBeVisible();
});
test("premature submission preserves omissions and restart clears the attempt", async ({
  page,
}) => {
  await enter(page);
  await page.getByRole("button", { name: "Complete encounter", exact: false }).click();
  await expect(
    page.getByText("No acquired evidence is available yet.", { exact: false }),
  ).toBeVisible();
  await page.getByLabel("Working diagnosis").selectOption("myopia");
  await page.getByRole("button", { name: "Submit assessment" }).click();
  await expect(page.locator(".score")).toHaveText("10/ 100");
  await expect(page.getByRole("heading", { name: "Priority omissions to review" })).toBeVisible();
  await expect(page.getByText("Safety history was not elicited.", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "New attempt" }).click();
  await page.getByRole("button", { name: "Use click-based station mode" }).click();
  await page.getByRole("button", { name: "Notes" }).click();
  await expect(page.getByText("No examinations performed yet.")).toBeVisible();
});
test("fallback works with WebGL disabled and supports keyboard focus at enlarged text", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: any[]
    ) {
      if (type.startsWith("webgl")) return null;
      return original.call(this, type as any, ...args);
    } as typeof original;
  });
  await enter(page);
  await expect(page.getByText("3D rendering is unavailable.", { exact: false })).toBeVisible();
  await openStation(page, "patient");
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "32px";
  });
  await page.getByLabel("Your question").fill("What is your blood pressure?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.getByText("I'm not sure about that.", { exact: false })).toBeVisible();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);
  await page.screenshot({ path: "test-results/large-text-fallback.png" });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("native pointer lock is explicit and Escape releases it when supported", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.requestPointerLock;
    HTMLCanvasElement.prototype.requestPointerLock = function (this: HTMLCanvasElement, options) {
      return original.call(this, options)?.catch((error: Error) => {
        (window as any).__pointerLockFailure =
          `${error.name}: ${error.message} (connected=${this.isConnected}, focused=${document.hasFocus()}, sameCanvas=${this === document.querySelector("canvas")})`;
        throw error;
      });
    };
  });
  await page.goto("/");
  await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(false);
  await page.getByRole("button", { name: "Enter consultation", exact: true }).click();
  await page.waitForFunction(
    () => !!document.pointerLockElement || !!(window as any).__pointerLockFailure,
  );
  const unsupported = await page.evaluate(
    () => (window as any).__pointerLockFailure as string | undefined,
  );
  if (unsupported?.startsWith("WrongDocumentError:")) {
    await expect(page.getByText("STATION MODE", { exact: true })).toBeVisible();
    test.skip(
      true,
      `Native pointer lock unavailable in this browser environment: ${unsupported}. A minimal standalone canvas probe reproduces the same error.`,
    );
  }
  await expect
    .poll(() =>
      page.evaluate(() =>
        document.pointerLockElement ? true : ((window as any).__pointerLockFailure ?? false),
      ),
    )
    .toBe(true);
  const initial = await page.evaluate(() => (document.querySelector("canvas") as any).__optoView());
  await page.keyboard.down("w");
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => (document.querySelector("canvas") as any).__optoView()))
          .position[2],
    )
    .toBeLessThan(initial.position[2] - 0.2);
  await page.keyboard.up("w");
  await page.keyboard.press("Escape");
  await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(false);
  await openStation(page, "patient");
  const stationary = await page.evaluate(() =>
    (document.querySelector("canvas") as any).__optoView(),
  );
  await page.getByLabel("Your question").fill("wasd");
  expect(
    (await page.evaluate(() => (document.querySelector("canvas") as any).__optoView())).position,
  ).toEqual(stationary.position);
  await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(false);
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(false);
});
test("pointer-lock rejection has an explicit usable station fallback", async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.requestPointerLock = () =>
      Promise.reject(new Error("Rejected for test"));
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Enter consultation", exact: true }).click();
  await expect(page.getByText("STATION MODE", { exact: true })).toBeVisible();
  await expect(page.getByText("Mouse capture unavailable.", { exact: false })).toBeVisible();
});
test("near-vision card is visible on the trolley and can be picked up directly", async ({ page }) => {
  await enter(page);
  await openStation(page, "trolley");
  await page.getByRole("button", { name: "Close panel" }).click();
  const canvas = page.locator("canvas").first();
  const box = (await canvas.boundingBox())!;
  // The station visit frames the top shelf; the white card is left of centre.
  await page.mouse.click(box.x + box.width * 0.334, box.y + box.height * 0.549);
  await expect(page.getByRole("heading", { name: "Near chart + occluder" })).toBeVisible();
});
test("mouse look, walking collisions, target interaction, and held-key reset", async ({ page }) => {
  await enter(page);
  await expect(page.locator(".scene-loading")).toHaveCount(0);
  await page.waitForFunction(() => !!(document.querySelector("canvas") as any)?.__optoView);
  const read = () => page.evaluate(() => (document.querySelector("canvas") as any).__optoView());
  await page.locator("canvas").focus();
  await page.keyboard.down("w");
  await expect.poll(async () => (await read()).position[2], { timeout: 10000 }).toBeLessThan(0.3);
  // The patient collision volume starts at z = 0.24 including clearance.
  await page.waitForTimeout(600);
  expect((await read()).position[2]).toBeGreaterThanOrEqual(0.24);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  const stopped = await read();
  await page.waitForTimeout(200);
  expect((await read()).position).toEqual(stopped.position);
  expect((await read()).pressedKeys).toEqual([]);
  await page.keyboard.up("w");
  await page.mouse.move(680, 450);
  await page.mouse.down();
  await page.mouse.move(710, 530, { steps: 8 });
  await page.mouse.up();
  expect((await read()).rotation[0]).toBeLessThan(stopped.rotation[0]);
  // Visit patient, close panel, and use the centre ray rather than screen coordinates.
  await openStation(page, "patient");
  await close(page);
  await expect.poll(async () => (await read()).target).toBe("patient");
  await page.keyboard.press("e");
  await expect(page.getByRole("heading", { name: "Talk with Arun" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(false);
  const paused = await read();
  await page.getByLabel("Your question").pressSequentially("wasd");
  expect((await read()).position).toEqual(paused.position);
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect.poll(() => page.evaluate(() => !!document.pointerLockElement)).toBe(false);
});
test("narrow-screen station mode, notebook and submission remain usable at 200% text", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await enter(page);
  await expect(page.getByText("STATION MODE", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Notes" }).click();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "32px";
  });
  await expect(page.getByText("No examinations performed yet.")).toBeVisible();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);
  await page.getByRole("button", { name: "Close panel" }).click();
  await page.getByRole("button", { name: "Complete encounter", exact: false }).click();
  await page.getByLabel("Working diagnosis").selectOption("undetermined");
  await page
    .getByLabel("What would you say to Arun?")
    .fill("We need to complete your eye assessment before deciding a plan.");
  await page.getByRole("button", { name: "Submit assessment" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: "test-results/mobile-submission-200.png" });
  expect(await page.locator("dialog").evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(
    true,
  );
  await page.getByRole("button", { name: "Submit assessment" }).click();
  await expect(page.getByRole("heading", { name: "Consultation debrief" })).toBeVisible();
});
test("optional notebook adapter exposes only acquired findings and validates input", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(document, "modelContext", {
      value: {
        registerTool(tool: any, options: any) {
          (window as any).__notebookTool = tool;
          options.signal.addEventListener("abort", () => {
            delete (window as any).__notebookTool;
          });
        },
      },
    });
  });
  await enter(page);
  const before = await page.evaluate(() => (window as any).__notebookTool.execute({}));
  expect(before).toMatchObject({ history: [], findings: [] });
  const invalid = await page.evaluate(() => {
    try {
      (window as any).__notebookTool.execute({ hidden: true });
      return false;
    } catch {
      return true;
    }
  });
  expect(invalid).toBe(true);
  await openStation(page, "acuity");
  await page.getByRole("button", { name: "Pick up instrument & examine", exact: true }).click();
  await page.getByRole("button", { name: "Examine Arun →", exact: true }).click();
  await completeManualAcuity(page, "distance", "OD");
  await page.getByRole("button", { name: "Record finding & return to room →" }).click();
  const after = await page.evaluate(() => (window as any).__notebookTool.execute({}));
  expect(after.findings).toHaveLength(1);
  expect(after.findings[0]).toMatchObject({ eye: "OD", value: "6/18", correction: "Unaided" });
  expect(after.answerKey).toBeUndefined();
});
