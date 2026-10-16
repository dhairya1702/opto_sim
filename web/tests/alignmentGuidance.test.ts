import { describe, expect, it } from "vitest";
import { coverGuidedStep, krimskyGuidedStep, type CoverGuidedState, type KrimskyGuidedState } from "../interaction/alignmentGuidance";

const krimsky = (overrides: Partial<KrimskyGuidedState> = {}): KrimskyGuidedState => ({
  penlightHeld: false, fixation: false, examinerEyeSelected: false, prismHeld: false, prismAligned: false,
  neutral: false, comparisonCaptured: false, powerEntered: false, recorded: false, ...overrides,
});
const cover = (overrides: Partial<CoverGuidedState> = {}): CoverGuidedState => ({
  kind: "cover-uncover", occluderHeld: false, fixation: false, sequenceIndex: 0, sequenceTotal: 4,
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

  it("advances cover–uncover through ordered observation, classification, and submission", () => {
    expect(coverGuidedStep(cover()).id).toBe("tool");
    expect(coverGuidedStep(cover({ occluderHeld: true })).id).toBe("fixation");
    expect(coverGuidedStep(cover({ occluderHeld: true, fixation: true, sequenceIndex: 2 })).id).toBe("sequence");
    const sequence = coverGuidedStep(cover({ occluderHeld: true, fixation: true, sequenceIndex: 1, nextPositionLabel: "Uncover OD · watch OD immediately" }));
    expect(sequence.title).toBe("Move 2 of 4: Uncover OD · watch OD immediately");
    expect(sequence.lines.join(" ")).toContain("1/4 positions complete");
    expect(coverGuidedStep(cover({ occluderHeld: true, fixation: true, sequenceMessage: "Start again." })).lines[0]).toBe("Start again.");
    expect(coverGuidedStep(cover({ observed: true })).id).toBe("interpret");
    expect(coverGuidedStep(cover({ observed: true, observationComplete: true })).id).toBe("record");
    expect(coverGuidedStep(cover({ observed: true, observationComplete: true, recorded: true })).complete).toBe(true);
  });

  it("adds physical prism alignment and neutralisation to alternating cover", () => {
    const observed = cover({ kind: "alternate-cover", observed: true });
    expect(coverGuidedStep(observed).title).toBe("Pick up the prism bar");
    expect(coverGuidedStep({ ...observed, prismHeld: true }).title).toBe("Set and align the prism");
    expect(coverGuidedStep({ ...observed, prismHeld: true, prismAligned: true, prismConfigured: true }).id).toBe("neutralise");
    expect(coverGuidedStep({ ...observed, neutralized: true }).id).toBe("interpret");
    expect(coverGuidedStep({ ...observed, neutralized: true, observationComplete: true }).id).toBe("record");
  });
});
