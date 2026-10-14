import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BrucknerPracticeController } from "../practice/xr/BrucknerPracticeController";
import { HirschbergPracticeController } from "../practice/xr/HirschbergPracticeController";
import { PracticeAttemptProvider, type PracticeAttemptKind } from "../practice/PracticeAttemptContext";
import { clinic } from "./helpers/xrClinicHarness";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });

const withAttempt = (kind: PracticeAttemptKind, child: React.ReactNode) => createElement(
  PracticeAttemptProvider,
  { value: { settings: { kind, interaction: "vr", voice: "disabled" }, setSettings: vi.fn() }, children: child },
);

describe("guided optic lesson bubbles", () => {
  it("advances Bruckner from pickup through physical scope inspection and recording", async () => {
    const complete = vi.fn();
    const sim = await clinic({ renderAdapter: ({ active }) => withAttempt("guided", createElement(BrucknerPracticeController, {
      active, scenario: "od", onComplete: complete, onNext: vi.fn(), onExit: vi.fn(),
    })) });
    dispose = sim.dispose;
    expect(sim.labels()).toContain("GUIDED · STEP 1 OF 6");
    expect(sim.labels()).toContain("Pick up the ophthalmoscope");

    await sim.pickup(0, "fundus");
    expect(sim.labels()).toContain("GUIDED · STEP 2 OF 6");
    expect(sim.labels()).toContain("Instruct Arun");

    await sim.click(1, sim.button("LOOK AT THE LIGHT"));
    expect(sim.labels()).toContain("GUIDED · STEP 3 OF 6");
    expect(sim.labels()).toContain("Select the large aperture");

    await sim.cycleAperture(1);
    expect(sim.labels()).toContain("GUIDED · STEP 4 OF 6");
    expect(sim.labels()).toContain("Illuminate both pupils");

    await sim.at(0, [0, 1.33, .459]);
    await sim.event(0, "selectstart");
    await sim.step(1 / 72, 12);
    expect(sim.labels()).toContain("GUIDED · STEP 5 OF 6");
    expect(sim.labels()).toContain("Inspect both red reflexes");

    await sim.scope(0); await sim.step(1 / 72, 12);
    expect(sim.labels()).toContain("GUIDED · STEP 6 OF 6");
    expect(sim.labels()).toContain("Record the comparison");
    await sim.click(1, sim.button("OD BRIGHTER"));
    expect(sim.labels()).toContain("Your reflex comparison is selected.");
    await sim.click(1, sim.button("SUBMIT / CHECK"));
    expect(complete).toHaveBeenCalledTimes(1);
    expect(sim.labels()).toContain("GUIDED · COMPLETE");
  });

  it("advances Hirschberg from pickup through aligned capture and explicit interpretation", async () => {
    const complete = vi.fn();
    const sim = await clinic({ renderAdapter: ({ active }) => withAttempt("guided", createElement(HirschbergPracticeController, {
      active,
      scenario: { id: "normal", od: [50, 50], os: [50, 50] },
      finding: { direction: "none", amount: "0", feedback: "Corneal reflexes are centred and symmetrical in this example." },
      findingPosition: { current: 1, total: 4 },
      onComplete: complete, onNext: vi.fn(), onExit: vi.fn(),
    })) });
    dispose = sim.dispose;
    expect(sim.labels()).toContain("GUIDED · STEP 1 OF 6");
    expect(sim.labels()).toContain("Pick up the penlight");

    await sim.pickup(0, "pupils");
    expect(sim.labels()).toContain("GUIDED · STEP 2 OF 6");
    expect(sim.labels()).toContain("Instruct Arun");
    await sim.click(1, sim.button("LOOK AT THE LIGHT"));
    expect(sim.labels()).toContain("GUIDED · STEP 3 OF 6");
    expect(sim.labels()).toContain("Set the penlight position");

    sim.grips[0].rotation.x = Math.PI / 2;
    sim.viewerCamera.rotation.y = .4;
    await sim.at(0, [0, 1.5, .064]);
    await sim.event(0, "selectstart"); await sim.step(1 / 72, 12);
    expect(sim.labels()).toContain("GUIDED · STEP 4 OF 6");
    expect(sim.labels()).toContain("Align and inspect");

    sim.viewerCamera.rotation.y = 0; await sim.step(1 / 72, 12);
    expect(sim.labels()).toContain("GUIDED · STEP 5 OF 6");
    expect(sim.labels()).toContain("Interpret the reflexes");
    await sim.click(1, sim.button("NO DEVIATION"));
    await sim.click(1, sim.button("CENTRED · 0°"));
    expect(sim.labels()).toContain("GUIDED · STEP 6 OF 6");
    expect(sim.labels()).toContain("Record the interpretation");
    await sim.click(1, sim.button("SUBMIT / CHECK"));
    expect(complete).toHaveBeenCalledTimes(1);
    expect(sim.labels()).toContain("GUIDED · COMPLETE");
  });

  it.each(["bruckner", "hirschberg"] as const)("does not show the %s coach during independent Test", async lesson => {
    const child = lesson === "bruckner"
      ? createElement(BrucknerPracticeController, { active: true, scenario: "equal", onComplete: vi.fn(), onNext: vi.fn(), onExit: vi.fn() })
      : createElement(HirschbergPracticeController, {
        active: true,
        scenario: { id: "normal", od: [50, 50], os: [50, 50] },
        finding: { direction: "none", amount: "0", feedback: "Normal example." },
        findingPosition: { current: 1, total: 4 }, onComplete: vi.fn(), onNext: vi.fn(), onExit: vi.fn(),
      });
    const sim = await clinic({ renderAdapter: () => withAttempt("test", child) });
    dispose = sim.dispose;
    expect(sim.labels().some(label => label.startsWith("GUIDED · STEP"))).toBe(false);
  });
});
