import { describe, it, expect } from "vitest";
import { krimskyCases } from "../interaction/krimsky";
import { advanceKrimskyBaselineDwell, KRIMSKY_BASELINE_DWELL_SECONDS, captureKrimskyComparison, clinicKrimskyReflex, krimskyComparisonSubmission, krimskyPrismCellY, krimskyPrismPowerIndex, stepKrimskyPrismPower, xrKrimskyTechnique, type XRKrimskyInput } from "../interaction/xrKrimskyPractice";
import { xrExaminerPose } from "../interaction/xrViewer";
const input: XRKrimskyInput = {
  penlightPosition: [0, 1.5, -.073], penlightForward: [0, 0, -1], viewerPosition: [0, 1.5, .65], viewerForward: [0, 0, -1],
  held: true, light: true, fixation: true, examinerEye: "left", method: "standard", baseline: true, base: "BI", power: 20,
  prismHeld: true, prismPosition: [.048, 1.5, -.469], prismForward: [0, 0, -1],
};
describe("Krimsky shared-clinic technique and recording", () => {
  it.each(["standard", "modified"] as const)("neutralises both authored findings using %s placement", method => {
    for (const finding of krimskyCases) {
      const setup = { ...input, method, base: finding.base, power: finding.power, prismPosition: [method === "standard" ? .048 : -.048, 1.5, -.469] as const };
      const result = xrKrimskyTechnique(setup, finding);
      expect(result.neutral).toBe(true); expect(result.residual).toBe(0);
      const captured = captureKrimskyComparison(result);
      expect(captured?.eye).toBe(method === "standard" ? "OS" : "OD");
      expect(krimskyComparisonSubmission(captured, String(finding.power))).toBe(true);
    }
  });
  it("requires baseline inspection without prism before either eye", () => {
    expect(xrKrimskyTechnique(input, krimskyCases[0]).baselineReady).toBe(false);
    expect(xrKrimskyTechnique({ ...input, prismHeld: false, prismPosition: [-1, 1, -.9] }, krimskyCases[0]).baselineReady).toBe(true);
    expect(xrKrimskyTechnique({ ...input, prismPosition: null }, krimskyCases[0]).baselineReady).toBe(false);
    expect(xrKrimskyTechnique({ ...input, baseline: false }, krimskyCases[0]).neutral).toBe(false);
  });
  it("rejects wrong eye, midpoint, tilt, missing tools and invalid view/working distance", () => {
    const invalid: Partial<XRKrimskyInput>[] = [{ prismPosition: [-.048, 1.5, -.469] }, { prismPosition: [0, 1.5, -.469] }, { prismForward: [1, 0, 0] },
      { prismHeld: false }, { held: false }, { light: false }, { fixation: false }, { examinerEye: null }, { penlightPosition: [0, 1.5, .027] },
      { penlightForward: [1, 0, 0] }, { viewerForward: [1, 0, 0] }, { base: "" }, { power: 20.5 }, { power: 41 }];
    for (const change of invalid) expect(xrKrimskyTechnique({ ...input, ...change }, krimskyCases[0]).neutral).toBe(false);
  });
  it("captures baseline only after an uninterrupted steady dwell", () => {
    let dwell = 0;
    for (let index = 0; index < 8; index++) dwell = advanceKrimskyBaselineDwell(dwell, true, .1);
    expect(dwell).toBeCloseTo(KRIMSKY_BASELINE_DWELL_SECONDS);
    expect(advanceKrimskyBaselineDwell(dwell, false, .1)).toBe(0);
    expect(advanceKrimskyBaselineDwell(0, true, 3)).toBe(.1);
  });
  it("steps through physical prism cells and keeps the selected cell coordinate aligned", () => {
    expect(stepKrimskyPrismPower(0, 1)).toBe(5);
    expect(stepKrimskyPrismPower(15, 1)).toBe(20);
    expect(stepKrimskyPrismPower(40, 1)).toBe(40);
    expect(stepKrimskyPrismPower(0, -1)).toBe(0);
    expect(krimskyPrismPowerIndex(20)).toBe(4);
    expect(krimskyPrismCellY(20)).toBeCloseTo(.246);
  });
  it("selects the requested physical XR eye pose with a single-camera fallback", () => {
    const left = { viewer: [-.03, 1.6, 0] as [number, number, number], look: [0, 0, -1] as [number, number, number] };
    const right = { viewer: [.03, 1.6, 0] as [number, number, number], look: [0, 0, -1] as [number, number, number] };
    expect(xrExaminerPose([left, right], "left")).toBe(left);
    expect(xrExaminerPose([left, right], "right")).toBe(right);
    expect(xrExaminerPose([left], "right")).toBe(left);
  });
  it("preserves signed undercorrection, wrong-base divergence and overcorrection in relative-reflex rendering", () => {
    const finding = krimskyCases[0];
    const baseline = clinicKrimskyReflex(finding, finding.power);
    const under = xrKrimskyTechnique({ ...input, power: 10 }, finding);
    const wrong = xrKrimskyTechnique({ ...input, base: "BO" }, finding);
    const over = xrKrimskyTechnique({ ...input, power: 25 }, finding);
    expect(Math.abs(clinicKrimskyReflex(finding, under.residual))).toBeLessThan(Math.abs(baseline));
    expect(Math.abs(clinicKrimskyReflex(finding, wrong.residual))).toBeGreaterThan(Math.abs(baseline));
    expect(clinicKrimskyReflex(finding, over.residual) * baseline).toBeLessThan(0);
    expect(captureKrimskyComparison(under)).toBeNull();
  });
  it("requires a completed comparison and an independent finite integer entry", () => {
    const captured = captureKrimskyComparison(xrKrimskyTechnique(input, krimskyCases[0]));
    expect(Object.isFrozen(captured)).toBe(true);
    expect(krimskyComparisonSubmission(null, "20")).toBeNull(); expect(krimskyComparisonSubmission(captured, "")).toBeNull();
    for (const answer of ["15", "NaN", "Infinity", "20.5", "-1", "41"]) expect(krimskyComparisonSubmission(captured, answer)).toBe(false);
    expect(krimskyComparisonSubmission(captured, "20")).toBe(true);
  });
});
