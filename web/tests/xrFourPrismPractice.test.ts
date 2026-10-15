import { describe, expect, it } from "vitest";
import { clinicFourPrismGaze, xrFourPrismView } from "../interaction/xrFourPrismPractice";
describe("canonical XR 4Δ base-out technique", () => {
  it("preserves the authored gaze timeline for both scenarios at patient scale", () => {
    expect(clinicFourPrismGaze("OD", "normal", 299)).toEqual({ od: 0, os: 0 });
    expect(clinicFourPrismGaze("OD", "normal", 300)).toEqual({ od: .012, os: .012 });
    expect(clinicFourPrismGaze("OD", "normal", 1200)).toEqual({ od: .012, os: 0 });
    expect(clinicFourPrismGaze("OS", "normal", 1200)).toEqual({ od: 0, os: -.012 });
    expect(clinicFourPrismGaze("OD", "suppression", 2400)).toEqual({ od: .012, os: .012 });
    expect(clinicFourPrismGaze("OS", "suppression", 2400)).toEqual({ od: 0, os: 0 });
  });
  it("requires a patient-facing examiner view with unobstructed frontal geometry", () => {
    expect(xrFourPrismView([0, 1.5, .5], [0, 0, -1])).toBe(true);
    expect(xrFourPrismView([0, 1.5, .5], [0, 0, 1])).toBe(false);
    expect(xrFourPrismView([1, 1.5, -.573], [-1, 0, 0])).toBe(false);
    expect(xrFourPrismView([0, 1.5, -.5], [0, 0, -1])).toBe(false);
  });
});
