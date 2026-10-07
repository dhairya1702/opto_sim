import { describe, expect, it } from "vitest";
import { initialConsultationInput, interruptConsultationInput, pressConsultationGrip, pressConsultationTrigger, releaseConsultationGrip, releaseConsultationTrigger, toggleConsultationPanel } from "../interaction/xrConsultationInput";
import { pauseConsultationTechnique } from "../interaction/xrConsultationProcedure";
import { advanceXRPupilObservation, initialXRPupilObservation } from "../interaction/xrPupils";
import { advanceXRCoverState, initialXRCoverState } from "../interaction/xrCover";
import { observeTarget } from "../interaction/motility";

describe("consultation input routing", () => {
  it("routes a held tool trigger exclusively to the tool and a free hand to the ray", () => {
    expect(pressConsultationTrigger(initialConsultationInput(), true).triggerRoute).toBe("tool");
    expect(pressConsultationTrigger(initialConsultationInput(), false).triggerRoute).toBe("panel");
  });
  it("operates panels while retaining a tool", () => {
    const panel = toggleConsultationPanel(initialConsultationInput());
    expect(pressConsultationTrigger(panel, true).triggerRoute).toBe("panel");
  });
  it("requires a release before another trigger action after a mode switch", () => {
    const held = pressConsultationTrigger(initialConsultationInput(), true);
    const panel = toggleConsultationPanel(held);
    expect(panel.triggerRoute).toBeNull();
    expect(pressConsultationTrigger(panel, true)).toBe(panel);
    expect(pressConsultationTrigger(releaseConsultationTrigger(panel), true).triggerRoute).toBe("panel");
  });
  it("cannot finish a ray action interrupted by pickup or tracking loss", () => {
    const ray = pressConsultationTrigger(initialConsultationInput(), false);
    expect(pressConsultationGrip(ray).triggerRoute).toBeNull();
    const interrupted = interruptConsultationInput(ray);
    expect(interrupted.triggerRoute).toBeNull();
    expect(pressConsultationTrigger(interrupted, true)).toBe(interrupted);
  });
  it("requires a fresh grip edge after transfer and ignores repeated presses", () => {
    const pressed = pressConsultationGrip(initialConsultationInput());
    expect(pressConsultationGrip(pressed)).toBe(pressed);
    const transferred = interruptConsultationInput(pressed);
    expect(pressConsultationGrip(transferred)).toBe(transferred);
    expect(pressConsultationGrip(releaseConsultationGrip(transferred)).gripDown).toBe(true);
  });
  it("rearms grip without cancelling a held tool trigger or panel action", () => {
    for (const hasTool of [true, false]) {
      const pressed = pressConsultationTrigger(pressConsultationGrip(initialConsultationInput()), hasTool);
      const relaxed = releaseConsultationGrip(pressed);
      expect(relaxed.gripDown).toBe(false);
      expect(relaxed.triggerDown).toBe(true);
      expect(relaxed.triggerRoute).toBe(hasTool ? "tool" : "panel");
      expect(pressConsultationGrip(relaxed).triggerRoute).toBeNull();
    }
  });
});

describe("consultation procedure interruption", () => {
  it("cannot stitch pupil dwell across an interrupted hand action", () => {
    let pupils = initialXRPupilObservation();
    for (let i = 0; i < 7; i++) pupils = advanceXRPupilObservation(pupils, { setupReady: true, light: true, aimedEye: "OD", dt: .1 });
    const paused = pauseConsultationTechnique({ pupils, cover: initialXRCoverState(), motility: { seen: [], current: null, dwell: 0 } });
    const resumed = advanceXRPupilObservation(paused.pupils, { setupReady: true, light: true, aimedEye: "OD", dt: .1 });
    expect(resumed.seen).toEqual([]);
    expect(resumed.dwell).toBeCloseTo(.1);
  });
  it("resets current cover and motility dwell while retaining completed checkpoints", () => {
    const paused = pauseConsultationTechnique({
      pupils: { ...initialXRPupilObservation(), seen: ["OD"] },
      cover: { index: 2, dwell: .65 },
      motility: { seen: ["centre"], current: "right", dwell: .65 },
    });
    expect(paused.pupils.seen).toEqual(["OD"]);
    expect(advanceXRCoverState(paused.cover, "OS", .1)).toEqual({ index: 2, dwell: .1 });
    const resumed = observeTarget(paused.motility, { x: .8 * .35 * .65, y: 0, z: .35 }, .1, true);
    expect(resumed.seen).toEqual(["centre"]);
    expect(resumed.dwell).toBeCloseTo(.1);
  });
});
