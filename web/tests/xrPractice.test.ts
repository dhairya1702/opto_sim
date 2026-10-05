import { describe, expect, it } from "vitest";
import { xrHirschbergPrompt, xrHirschbergTechnique } from "../interaction/xrPractice";

const aligned = {
  penlightPosition: [0, 1.35, -.3] as const,
  penlightForward: [0, 0, -1] as const,
  viewerPosition: [0, 1.6, .2] as const,
  viewerForward: [0, -.2425, -.9701] as const,
  eyeMidpoint: [0, 1.35, -.8] as const,
  held: true,
  light: true,
  fixation: true,
};

describe("XR Hirschberg technique", () => {
  it("derives distance, aim, and examiner alignment from spatial poses", () => {
    const result = xrHirschbergTechnique(aligned);
    expect(result.distanceCm).toBeCloseTo(50);
    expect(result.aimErrorDeg).toBeCloseTo(0);
    expect(result.viewErrorDeg).toBeLessThan(.1);
    expect(result.ready).toBe(true);
  });

  it("uses an illustrative 46–54 cm working range", () => {
    expect(xrHirschbergTechnique({ ...aligned, penlightPosition: [0, 1.35, -.26] }).distanceReady).toBe(true);
    expect(xrHirschbergTechnique({ ...aligned, penlightPosition: [0, 1.35, -.34] }).distanceReady).toBe(true);
    expect(xrHirschbergTechnique({ ...aligned, penlightPosition: [0, 1.35, -.24] }).distanceReady).toBe(false);
  });

  it("rejects a penlight or headset pointed away from the eyes", () => {
    expect(xrHirschbergTechnique({ ...aligned, penlightForward: [1, 0, 0] }).aimReady).toBe(false);
    expect(xrHirschbergTechnique({ ...aligned, viewerForward: [1, 0, 0] }).viewReady).toBe(false);
  });

  it("keeps setup controls independently required", () => {
    expect(xrHirschbergTechnique({ ...aligned, held: false }).ready).toBe(false);
    expect(xrHirschbergTechnique({ ...aligned, light: false }).ready).toBe(false);
    expect(xrHirschbergTechnique({ ...aligned, fixation: false }).ready).toBe(false);
  });

  it("returns the next actionable instruction", () => {
    const technique = xrHirschbergTechnique({ ...aligned, light: false });
    expect(xrHirschbergPrompt(technique, { held: false, light: false, fixation: false })).toContain("Grip");
    expect(xrHirschbergPrompt(technique, { held: true, light: false, fixation: true })).toContain("trigger");
    expect(xrHirschbergPrompt(xrHirschbergTechnique(aligned), aligned)).toContain("Technique aligned");
  });
});
