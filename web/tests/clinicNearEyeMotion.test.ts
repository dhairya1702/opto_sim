import { describe, expect, it } from "vitest";
import { CLINIC_NEAR_EYE_TRAVEL, clinicNearEyeOffset } from "../interaction/clinicNearEyeMotion";

describe("canonical near-eye teaching motion", () => {
  it("keeps convergence symmetric and visibly exaggerated within its bounded range", () => {
    expect(clinicNearEyeOffset("OD", 0)).toBe(0);
    expect(clinicNearEyeOffset("OS", 0)).toBe(0);
    for (const fraction of [-1, 0, .25, .5, 1, 2]) {
      const od = clinicNearEyeOffset("OD", fraction);
      const os = clinicNearEyeOffset("OS", fraction);
      expect(od + os).toBe(0);
      expect(Math.abs(od)).toBeLessThanOrEqual(CLINIC_NEAR_EYE_TRAVEL);
      expect(Math.abs(os)).toBeLessThanOrEqual(CLINIC_NEAR_EYE_TRAVEL);
    }
    expect(clinicNearEyeOffset("OD", 1)).toBe(CLINIC_NEAR_EYE_TRAVEL);
  });

  it("moves OS outward across the centre at NPC break without changing OD", () => {
    for (const fraction of [0, .5, 1, 2]) {
      expect(clinicNearEyeOffset("OS", fraction, true)).toBe(CLINIC_NEAR_EYE_TRAVEL);
      expect(clinicNearEyeOffset("OD", fraction, true)).toBe(clinicNearEyeOffset("OD", fraction));
    }
    expect(clinicNearEyeOffset("OS", 1, false)).toBe(-CLINIC_NEAR_EYE_TRAVEL);
  });
});
