import { describe, expect, it } from "vitest";
import { coverGuidedStep, krimskyGuidedStep, type CoverGuidedState, type KrimskyGuidedState } from "../interaction/alignmentGuidance";

const krimsky = (overrides: Partial<KrimskyGuidedState> = {}): KrimskyGuidedState => ({
  penlightHeld: false, fixation: false, examinerEyeSelected: false, prismHeld: false, prismAligned: false,
  neutral: false, comparisonCaptured: false, powerEntered: false, recorded: false, ...overrides,
});
const cover = (overrides: Partial<CoverGuidedState> = {}): CoverGuidedState => ({
  kind: "cover-uncover", occluderHeld: false, fixation: false, sequenceIndex: 0, sequenceTotal: 4,
  targetHeld: false, targetPowered: true, targetEndpoint: "distance", targetReady: true, distanceRecorded: false, nearRecorded: false,
  observed: false, prismHeld: false, prismAligned: false, prismConfigured: false, neutralized: false,
  observationComplete: false, recorded: false, ...overrides,
});

describe("alignment guided coaches", () => {
  it("advances Krimsky from the spoken examiner-eye choice to physical prism handling", () => {
    expect(krimskyGuidedStep(krimsky()).id).toBe("tool");
    expect(krimskyGuidedStep(krimsky({ penlightHeld: true })).id).toBe("instruct");
    expect(krimskyGuidedStep(krimsky({ penlightHeld: true, fixation: true })).id).toBe("view");
    const selected = { penlightHeld: true, fixation: true, examinerEyeSelected: true };
    const pickup = krimskyGuidedStep(krimsky(selected));
    expect(pickup.id).toBe("prism");
    expect(pickup.lines).toContain("Observe the initial corneal reflex positions with no prism before either eye.");
    const held = krimskyGuidedStep(krimsky({ ...selected, prismHeld: true }));
    expect(held.title).toBe("Align the selected prism cell");
    expect(krimskyGuidedStep(krimsky({ ...selected, prismHeld: true, prismAligned: true })).id).toBe("neutralise");
    expect(krimskyGuidedStep(krimsky({ ...selected, prismHeld: true, prismAligned: true, neutral: true })).id).toBe("capture");
    expect(krimskyGuidedStep(krimsky({ comparisonCaptured: true })).id).toBe("record");
    expect(krimskyGuidedStep(krimsky({ comparisonCaptured: true, recorded: true })).complete).toBe(true);
  });

  it("explains the selected Krimsky method at prism placement", () => {
    for (const method of ["standard", "modified"] as const) {
      const step = krimskyGuidedStep(krimsky({ method, requiredEye: method === "standard" ? "OS" : "OD",
        penlightHeld: true, fixation: true, examinerEyeSelected: true, prismHeld: true }));
      expect(step.lines[0]).toContain(method === "standard" ? "OS" : "OD");
      expect(step.lines[1]).toContain(method === "standard" ? "deviating eye" : "fixating eye");
    }
  });

  it("advances cover–uncover through separate distance and near observations", () => {
    expect(coverGuidedStep(cover({ targetEndpoint: null, targetReady: false, targetPowered: false })).id).toBe("target-distance");
    expect(coverGuidedStep(cover({ targetHeld: true, targetEndpoint: null, targetReady: false, targetPowered: false })).id).toBe("position-distance");
    expect(coverGuidedStep(cover({ targetReady: false, targetPowered: false })).id).toBe("power-distance");
    expect(coverGuidedStep(cover()).id).toBe("fixation-distance");
    expect(coverGuidedStep(cover({ fixation: true })).id).toBe("tool-distance");
    expect(coverGuidedStep(cover({ occluderHeld: true, fixation: true, sequenceIndex: 2 })).id).toBe("sequence-distance");
    const sequence = coverGuidedStep(cover({ occluderHeld: true, fixation: true, sequenceIndex: 1, nextPositionLabel: "Uncover OD · watch OD immediately" }));
    expect(sequence.title).toBe("Move 2 of 4: Uncover OD · watch OD immediately");
    expect(sequence.lines.join(" ")).toContain("1/4 positions complete");
    expect(coverGuidedStep(cover({ occluderHeld: true, fixation: true, sequenceMessage: "Start again." })).lines[0]).toBe("Start again.");
    expect(coverGuidedStep(cover({ occluderHeld: true, fixation: true, observed: true })).id).toBe("interpret-distance");
    expect(coverGuidedStep(cover({ occluderHeld: true, fixation: true, observed: true, observationComplete: true })).id).toBe("record-distance");
    const transition = coverGuidedStep(cover({ occluderHeld: true, distanceRecorded: true }));
    expect(transition.id).toBe("position-near");
    expect(transition.lines.join(" ")).toContain("same illuminated target");
    const near = cover({ occluderHeld: true, targetEndpoint: "near", targetReady: true, distanceRecorded: true });
    expect(coverGuidedStep(near).id).toBe("fixation-near");
    expect(coverGuidedStep({ ...near, fixation: true, observed: true }).id).toBe("interpret-near");
    expect(coverGuidedStep({ ...near, fixation: true, observed: true, observationComplete: true }).id).toBe("record-near");
    expect(coverGuidedStep({ ...near, nearRecorded: true, recorded: true }).complete).toBe(true);
  });

  it("adds physical prism alignment and neutralisation to alternating cover", () => {
    const observed = cover({ kind: "alternate-cover", fixation: true, occluderHeld: true, observed: true });
    expect(coverGuidedStep(observed).title).toBe("Pick up the prism bar");
    const prism = coverGuidedStep({ ...observed, prismHeld: true });
    expect(prism.title).toBe("Place the prism");
    expect(prism.lines[0]).toContain("eye placement ring");
    const aligned = coverGuidedStep({ ...observed, prismHeld: true, prismAligned: true });
    expect(aligned.title).toBe("Choose prism base and power");
    expect(aligned.lines[1]).toContain("Thumbstick");
    expect(coverGuidedStep({ ...observed, prismHeld: true, prismAligned: true, prismConfigured: true }).id).toBe("neutralise-distance");
    const waiting = coverGuidedStep({ ...observed, prismHeld: true, prismAligned: true, prismConfigured: true });
    expect(waiting.lines[0]).toContain("automatically");
    expect(waiting.lines[1]).toContain("two attempts");
    const attemptOne = coverGuidedStep({ ...observed, prismHeld: true, prismAligned: true, prismConfigured: true,
      prismTrialActive: true, sequenceIndex: 1, nextPositionLabel: "Shift directly to OS" });
    expect(attemptOne.title).toBe("Attempt 1 of 2");
    expect(attemptOne.lines[0]).toContain("Move the paddle next");
    const attemptTwo = coverGuidedStep({ ...observed, prismHeld: true, prismAligned: true, prismConfigured: true,
      prismTrialActive: true, sequenceIndex: 2, nextPositionLabel: "Shift directly to OD" });
    expect(attemptTwo.title).toBe("Attempt 2 of 2");
    const adjust = coverGuidedStep({ ...observed, prismHeld: true, prismAligned: true, prismConfigured: true,
      prismAdjustmentRequired: true, sequenceMessage: "STOP · Increase prism power." });
    expect(adjust.title).toBe("Stop and adjust the prism");
    expect(adjust.lines[0]).toContain("Increase prism power");
    const neutral = { ...observed, prismHeld: true, prismAligned: true, prismConfigured: true, neutralized: true };
    expect(coverGuidedStep(neutral).id).toBe("interpret-distance");
    expect(coverGuidedStep({ ...neutral, observationComplete: true }).id).toBe("record-distance");
    const near = { ...observed, distanceRecorded: true, targetEndpoint: "near" as const };
    expect(coverGuidedStep(near).id).toBe("prism-near");
    expect(coverGuidedStep({ ...near, prismHeld: true, prismAligned: true, prismConfigured: true, neutralized: true, observationComplete: true }).id).toBe("record-near");
    expect(coverGuidedStep({ ...near, nearRecorded: true, recorded: true }).complete).toBe(true);
  });
});
