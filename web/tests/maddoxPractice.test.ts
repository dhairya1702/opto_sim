import { expect, it } from "vitest";
import { maddoxAligned, maddoxCanRecord, maddoxRotationCorrect, maddoxTrials } from "../interaction/maddoxPractice";
it("accepts OD alignment and rejects OS or a parked rod", () => {
  expect(maddoxAligned(-0.22, 0.2)).toBe(true);
  expect(maddoxAligned(0.22, 0.2)).toBe(false);
  expect(maddoxAligned(-0.65, -0.25)).toBe(false);
});
it("requires correct groove orientation for each axis", () => {
  expect(maddoxRotationCorrect("horizontal", 0)).toBe(true);
  expect(maddoxRotationCorrect("horizontal", 90)).toBe(false);
  expect(maddoxRotationCorrect("vertical", 90)).toBe(true);
  expect(maddoxRotationCorrect("vertical", 0)).toBe(false);
});
it("requires setup, introduction of prism and coincidence for recording", () => {
  for (const trial of maddoxTrials) {
    expect(maddoxCanRecord(true, true, trial.neutral, trial.neutral)).toBe(true);
    expect(maddoxCanRecord(false, true, trial.neutral, trial.neutral)).toBe(false);
    expect(maddoxCanRecord(true, false, trial.neutral, trial.neutral)).toBe(false);
    expect(maddoxCanRecord(true, true, 20, trial.neutral)).toBe(false);
  }
  expect(new Set(maddoxTrials.map(trial => `${trial.site}-${trial.axis}`)).size).toBe(4);
});
