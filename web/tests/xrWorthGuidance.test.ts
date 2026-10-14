import { describe, expect, it } from "vitest";
import { WORTH_GUIDED_STEP_COUNT, worthGuidedStep, type WorthGuidedState } from "../interaction/xrWorthPractice";

const base = (): WorthGuidedState => ({
  correctionFitted: false, filtersFitted: false, targetHandled: false, targetHeld: false, powered: false,
  condition: { distanceCm: 0, endpoint: null, facing: false }, verified: { red: false, green: false },
  fixationEndpoint: null, captureEndpoint: null, nearRecorded: false, distanceRecorded: false,
});
const step = (patch: Partial<WorthGuidedState>) => worthGuidedStep({ ...base(), ...patch });
const nearSetup = (): WorthGuidedState => ({ ...base(), correctionFitted: true, filtersFitted: true, targetHandled: true, targetHeld: true,
  powered: true, condition: { distanceCm: 40, endpoint: "near", facing: true }, verified: { red: true, green: true } });

describe("Worth Guided state coach", () => {
  it("has fourteen canonical event-driven steps through near capture and record", () => {
    expect(WORTH_GUIDED_STEP_COUNT).toBe(14);
    expect(step({}).id).toBe("fit-correction");
    expect(step({ correctionFitted: true }).id).toBe("fit-filters");
    expect(step({ correctionFitted: true, filtersFitted: true }).id).toBe("pick-up-target");
    expect(step({ correctionFitted: true, filtersFitted: true, targetHandled: true,
      condition: { distanceCm: 70, endpoint: null, facing: true } }).id).toBe("position-near");
    expect(step({ correctionFitted: true, filtersFitted: true, targetHandled: true,
      condition: { distanceCm: 40, endpoint: null, facing: false } }).lines.join(" ")).toContain("Turn");
    const ready = nearSetup();
    expect(worthGuidedStep({ ...ready, powered: false }).id).toBe("power-target");
    expect(worthGuidedStep({ ...ready, verified: { red: false, green: false } }).id).toBe("check-red");
    expect(worthGuidedStep({ ...ready, verified: { red: true, green: false } }).id).toBe("check-green");
    expect(worthGuidedStep(ready).id).toBe("fixate-near");
    expect(worthGuidedStep({ ...ready, fixationEndpoint: "near" }).id).toBe("elicit-near");
    expect(worthGuidedStep({ ...ready, fixationEndpoint: "near", captureEndpoint: "near" }).id).toBe("record-near");
  });

  it("requires distance placement, fresh fixation and capture before final completion", () => {
    const nearRecorded = { ...nearSetup(), nearRecorded: true };
    expect(worthGuidedStep(nearRecorded).id).toBe("dock-distance");
    const distance = { ...nearRecorded, condition: { distanceCm: 600, endpoint: "distance" as const, facing: true } };
    expect(worthGuidedStep(distance).id).toBe("fixate-distance");
    expect(worthGuidedStep({ ...distance, fixationEndpoint: "distance" }).id).toBe("elicit-distance");
    expect(worthGuidedStep({ ...distance, fixationEndpoint: "distance", captureEndpoint: "distance" }).id).toBe("record-distance");
    const complete = worthGuidedStep({ ...distance, nearRecorded: true, distanceRecorded: true });
    expect(complete.complete).toBe(true); expect(complete.index).toBe(13);
  });

  it("retains a valid out-of-order distance record but coaches the missing near endpoint", () => {
    const state = { ...nearSetup(), distanceRecorded: true, fixationEndpoint: "near" as const, captureEndpoint: "near" as const };
    expect(worthGuidedStep(state).id).toBe("record-near");
    expect(worthGuidedStep({ ...state, correctionFitted: false }).id).toBe("fit-correction");
  });
});
