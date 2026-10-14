import { describe, expect, it } from "vitest";
import {
  BRUCKNER_GUIDED_STEP_COUNT,
  HIRSCHBERG_GUIDED_STEP_COUNT,
  brucknerGuidedStep,
  hirschbergGuidedStep,
  type BrucknerGuidedState,
  type HirschbergGuidedState,
} from "../interaction/opticGuidance";

const bruckner = (overrides: Partial<BrucknerGuidedState> = {}): BrucknerGuidedState => ({
  toolHeld: false, fixation: false, largeSpot: false, light: false, distanceReady: false,
  aimReady: false, illuminated: false, captured: false, observationChosen: false, recorded: false, ...overrides,
});
const hirschberg = (overrides: Partial<HirschbergGuidedState> = {}): HirschbergGuidedState => ({
  toolHeld: false, fixation: false, light: false, distanceReady: false, aimReady: false,
  viewReady: false, captured: false, directionChosen: false, landmarkChosen: false, recorded: false, ...overrides,
});

describe("optic guided coaches", () => {
  it("advances Bruckner only from the existing procedure state", () => {
    expect(BRUCKNER_GUIDED_STEP_COUNT).toBe(6);
    expect(brucknerGuidedStep(bruckner()).id).toBe("tool");
    expect(brucknerGuidedStep(bruckner({ toolHeld: true })).id).toBe("instruct");
    expect(brucknerGuidedStep(bruckner({ toolHeld: true, fixation: true })).id).toBe("aperture");
    expect(brucknerGuidedStep(bruckner({ toolHeld: true, fixation: true, largeSpot: true })).id).toBe("illuminate");
    expect(brucknerGuidedStep(bruckner({ toolHeld: true, fixation: true, largeSpot: true, light: true, distanceReady: true, aimReady: true, illuminated: true })).id).toBe("inspect");
    expect(brucknerGuidedStep(bruckner({ captured: true })).id).toBe("record");
    expect(brucknerGuidedStep(bruckner({ captured: true, recorded: true })).complete).toBe(true);
  });

  it("advances Hirschberg through capture, interpretation and explicit submission", () => {
    expect(HIRSCHBERG_GUIDED_STEP_COUNT).toBe(6);
    expect(hirschbergGuidedStep(hirschberg()).id).toBe("tool");
    expect(hirschbergGuidedStep(hirschberg({ toolHeld: true })).id).toBe("instruct");
    expect(hirschbergGuidedStep(hirschberg({ toolHeld: true, fixation: true })).id).toBe("position");
    expect(hirschbergGuidedStep(hirschberg({ toolHeld: true, fixation: true, light: true, distanceReady: true })).id).toBe("inspect");
    expect(hirschbergGuidedStep(hirschberg({ captured: true })).id).toBe("interpret");
    expect(hirschbergGuidedStep(hirschberg({ captured: true, directionChosen: true, landmarkChosen: true })).id).toBe("record");
    expect(hirschbergGuidedStep(hirschberg({ captured: true, directionChosen: true, landmarkChosen: true, recorded: true })).complete).toBe(true);
  });
});
