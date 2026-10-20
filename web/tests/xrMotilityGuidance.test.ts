import { createElement } from "react";
import { Box3, Object3D, Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MotilityPracticeController } from "../practice/xr/MotilityPracticeController";
import { PracticeAttemptProvider, type PracticeAttemptKind } from "../practice/PracticeAttemptContext";
import { wrapGuidedStepLines } from "../scene/XRGuidedStepBubble";
import { clinic } from "./helpers/xrClinicHarness";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });

const adapter = (kind: PracticeAttemptKind) => ({ active }: { active: boolean }) => createElement(
  PracticeAttemptProvider,
  {
    value: { settings: { kind, interaction: "vr", voice: "disabled" }, setSettings: vi.fn() },
    children: createElement(MotilityPracticeController, { active, onComplete: vi.fn(), onExit: vi.fn() }),
  },
);

describe("XR motility guided step bubble", () => {
  it("wraps long coaching copy into readable lines instead of shrinking a single line", () => {
    const wrapped = wrapGuidedStepLines(["Pick up the point target from the left instrument table. Place it on the Distance Target Dock beside Arun, then turn it on."]);
    expect(wrapped.length).toBeGreaterThan(2);
    expect(wrapped.every(line => line.length <= 44)).toBe(true);
  });

  it("shows and advances a rear-wall step bubble in Guided Practice", async () => {
    const sim = await clinic({ renderAdapter: adapter("guided") }); dispose = sim.dispose;
    expect(sim.labels()).toContain("GUIDED · STEP 1 OF 6");
    expect(sim.labels()).toContain("Pick up the penlight");
    expect(sim.labels()).not.toContain("CONSULTATION 01");

    let bubble: Object3D | undefined, board: Object3D | undefined, acuity: Object3D | undefined, welcome: Object3D | undefined;
    sim.state.scene.traverse(object => {
      if (object.userData.xrGuidedStepBubble) bubble = object;
      if (object.userData.xrPersistentFindings) board = object;
      if (object.userData.station === "acuity") acuity = object;
      if (object.userData.xrWallWelcome) welcome = object;
    });
    expect(bubble).toBeDefined(); expect(board).toBeDefined(); expect(acuity).toBeDefined(); expect(welcome).toBeUndefined();
    expect(bubble!.position.x).toBeCloseTo(.05);
    expect(bubble!.scale.toArray()).toEqual([.88, .88, .88]);
    expect(new Box3().setFromObject(acuity!).getCenter(new Vector3()).x).toBeCloseTo(-1.02);
    expect(board!.position.x).toBeCloseTo(1.25);
    const bubbleBounds = new Box3().setFromObject(bubble!);
    const boardBounds = new Box3().setFromObject(board!);
    expect(bubbleBounds.intersectsBox(boardBounds)).toBe(false);
    expect(boardBounds.max.y).toBeLessThan(2.85);
    expect(boardBounds.min.y).toBeGreaterThan(.25);

    await sim.pickup(0, "pupils");
    expect(sim.labels()).toContain("GUIDED · STEP 2 OF 6");
    expect(sim.labels()).toContain("Instruct Arun");

    await sim.click(1, sim.button("FOLLOW LIGHT · HEAD STILL"));
    expect(sim.labels()).toContain("GUIDED · STEP 3 OF 6");
    expect(sim.labels()).toContain("Establish primary gaze");

    await sim.event(0, "selectstart");
    await sim.at(0, [0, 1.5, -.086]);
    await sim.step(1 / 72, 60);
    expect(sim.labels()).toContain("GUIDED · STEP 4 OF 6");
    expect(sim.labels()).toContain("Complete the H-pattern");
  });

  it("does not expose next-step coaching in independent Test attempts", async () => {
    const sim = await clinic({ renderAdapter: adapter("test") }); dispose = sim.dispose;
    expect(sim.labels().some(label => label.startsWith("GUIDED · STEP"))).toBe(false);
    expect(sim.labels()).not.toContain("Pick up the penlight");
    expect(sim.labels()).not.toContain("○ Up");
    expect(sim.labels()).not.toContain("SHOW GAZE GUIDE");
    expect(sim.labels()).not.toContain("HIDE GAZE GUIDE");
  });
});
