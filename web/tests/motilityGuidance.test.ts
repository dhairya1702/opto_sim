import { describe, expect, it } from "vitest";
import { MOTILITY_GUIDED_STEP_COUNT, motilityGuidedStep, type MotilityGuidedState } from "../interaction/motilityGuidance";

const state = (overrides: Partial<MotilityGuidedState> = {}): MotilityGuidedState => ({
  toolHeld: false,
  following: false,
  seen: [],
  symptomsAsked: false,
  observationChosen: false,
  recorded: false,
  ...overrides,
});

describe("motility guided coach", () => {
  it("advances through the six technique steps from procedure state", () => {
    expect(MOTILITY_GUIDED_STEP_COUNT).toBe(6);
    expect(motilityGuidedStep(state()).id).toBe("tool");
    expect(motilityGuidedStep(state({ toolHeld: true })).id).toBe("instruct");
    expect(motilityGuidedStep(state({ toolHeld: true, following: true })).id).toBe("primary");
    expect(motilityGuidedStep(state({ toolHeld: true, following: true, seen: ["centre"] })).id).toBe("pattern");
    expect(motilityGuidedStep(state({ toolHeld: true, following: true, seen: Array.from({ length: 9 }, (_, index) => index ? `gaze-${index}` : "centre") })).id).toBe("symptoms");
    expect(motilityGuidedStep(state({ following: true, seen: Array.from({ length: 9 }, (_, index) => index ? `gaze-${index}` : "centre"), symptomsAsked: true })).id).toBe("record");
  });

  it("keeps recording explicit and reports completion only after submission", () => {
    const ready = state({ following: true, seen: Array.from({ length: 9 }, (_, index) => index ? `gaze-${index}` : "centre"), symptomsAsked: true, observationChosen: true });
    expect(motilityGuidedStep(ready)).toMatchObject({ id: "record", complete: false });
    expect(motilityGuidedStep({ ...ready, recorded: true })).toMatchObject({ id: "record", complete: true });
  });
});
