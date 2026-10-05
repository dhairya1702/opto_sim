import { describe, expect, it } from "vitest";
import { clinicHirschbergReflex, emptyHirschbergTechnique, hirschbergSubmission } from "../interaction/xrHirschbergPractice";

describe("Hirschberg shared-patient adapter", () => {
  it("keeps reflex direction and landmarks consistent at the canonical patient's scale", () => {
    expect(clinicHirschbergReflex([50, 50])).toEqual({ x: 0, y: 0 });
    expect(clinicHirschbergReflex([63, 50])).toEqual({ x: .008, y: 0 });
    expect(clinicHirschbergReflex([66, 50]).x).toBeCloseTo(.009);
    expect(clinicHirschbergReflex([50, 78])).toEqual({ x: 0, y: -.010 });
    expect(clinicHirschbergReflex([37, 50]).x).toBe(-.008);
  });
  it("withholds feedback for incomplete technique or blank entries", () => {
    const finding = { direction: "none", amount: "0", feedback: "centred" };
    const technique = emptyHirschbergTechnique();
    expect(hirschbergSubmission(technique, "none", "0", finding)).toBeNull();
    expect(hirschbergSubmission({ ...technique, ready: true }, "", "0", finding)).toBeNull();
    expect(hirschbergSubmission({ ...technique, ready: true }, "none", "", finding)).toBeNull();
    expect(hirschbergSubmission({ ...technique, ready: true }, "exotropia", "15", finding)).toBe(false);
    expect(hirschbergSubmission({ ...technique, ready: true }, "none", "0", finding)).toBe(true);
  });
});
