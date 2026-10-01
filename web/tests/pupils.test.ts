import { describe, expect, it } from "vitest";
import {
  advanceNearPupilStep,
  generalResponseLabels,
  nearPupilProcedure,
  nearPupilStageMatches,
  nearResponseStimulus,
  pupilEyeAt,
  pupilRadiusTarget,
  rapdPattern,
} from "../interaction/pupils";

describe("manual pupil examination model", () => {
  it("recognises a beam centred on one pupil and rejects spill or off-target poses", () => {
    expect(pupilEyeAt({ x: -0.34, y: 0 })).toBe("OD");
    expect(pupilEyeAt({ x: 0.34, y: 0.05 })).toBe("OS");
    expect(pupilEyeAt({ x: 0, y: 0 })).toBeNull();
    expect(pupilEyeAt({ x: -0.34, y: 0.4 })).toBeNull();
    expect(pupilEyeAt({ x: 0.95, y: 0 })).toBeNull();
  });

  it("dilates in darkness, constricts to light, and clamps unsafe input", () => {
    expect(pupilRadiusTarget(0.1, 0)).toBeGreaterThan(pupilRadiusTarget(1, 0));
    expect(pupilRadiusTarget(0.2, 1)).toBeLessThan(pupilRadiusTarget(0.2, 0));
    expect(pupilRadiusTarget(-100, -100)).toBeCloseTo(0.031);
    expect(pupilRadiusTarget(100, 100)).toBeCloseTo(0.013);
  });

  it("maps direct and consensual responses and defines the full swinging-light sequence", () => {
    expect(generalResponseLabels("OD")).toEqual(["OD direct", "OS consensual"]);
    expect(generalResponseLabels("OS")).toEqual(["OS direct", "OD consensual"]);
    expect(rapdPattern).toEqual(["OD", "OS", "OD", "OS"]);
  });
  it("requires centred distance, near, close and recovery positions for the near response", () => {
    expect(nearPupilProcedure.map((step) => step.id)).toEqual(["distance", "near", "close", "recovery"]);
    expect(nearPupilStageMatches(0, { x: 0, y: 0, distanceCm: 70 })).toBe(true);
    expect(nearPupilStageMatches(1, { x: 0, y: 0, distanceCm: 40 })).toBe(true);
    expect(nearPupilStageMatches(2, { x: 0, y: 0, distanceCm: 20 })).toBe(true);
    expect(nearPupilStageMatches(3, { x: 0, y: 0, distanceCm: 65 })).toBe(true);
    expect(nearPupilStageMatches(1, { x: 0.4, y: 0, distanceCm: 40 })).toBe(false);
    expect(advanceNearPupilStep(0, 0, { x: 0, y: 0, distanceCm: 20 }, 1)).toEqual({ index: 0, dwell: 0 });
  });
  it("increases near-response stimulus smoothly as the target approaches", () => {
    expect(nearResponseStimulus(70)).toBe(0);
    expect(nearResponseStimulus(40)).toBeGreaterThan(0);
    expect(nearResponseStimulus(20)).toBeGreaterThan(nearResponseStimulus(40));
    expect(nearResponseStimulus(-100)).toBeLessThanOrEqual(0.75);
  });
});
