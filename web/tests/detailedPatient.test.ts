import { describe, expect, it } from "vitest";
import { DETAILED_EYE_RADIUS, detailedPatientPoint } from "../interaction/detailedPatient";
import { CLINIC_PATIENT_EYES } from "../interaction/clinicPatient";

describe("detailed patient canonical adapter", () => {
  it("fits both source eye centres to canonical tool anchors and preserves the floor", () => {
    for (const eye of ["OD", "OS"] as const) {
      const side = eye === "OD" ? -1 : 1;
      const point = detailedPatientPoint(side * .030, 1.4356, .130435);
      expect(point[0]).toBeCloseTo(CLINIC_PATIENT_EYES[eye][0], 8);
      expect(point[1]).toBeCloseTo(CLINIC_PATIENT_EYES[eye][1], 8);
      expect(point[2] - .7 + DETAILED_EYE_RADIUS).toBeCloseTo(CLINIC_PATIENT_EYES[eye][2], 8);
    }
    expect(detailedPatientPoint(.2, 0, .4)).toEqual([.2, 0, .4]);
  });
  it("broadens the torso symmetrically without moving ankles or eye anchors", () => {
    const right = detailedPatientPoint(.25, 1.12, .12);
    const left = detailedPatientPoint(-.25, 1.12, .12);
    expect(right[0]).toBeCloseTo(.30, 8);
    expect(left[0]).toBeCloseTo(-right[0], 8);
    expect(right[2]).toBeGreaterThan(.12);
    expect(detailedPatientPoint(.197, .24, .4)).toEqual([.197, .24, .4]);
  });
});
