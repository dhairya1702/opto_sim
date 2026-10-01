import { describe, expect, it } from "vitest";
import { canRecordMinusLens, minusLensAmplitude, nextMinusLens } from "../interaction/minusLens";
describe("minus-lens amplitude", () => {
  it("steps to first sustained blur without overshooting and returns to baseline", () => {
    let power = 0;
    for (let i = 0; i < 16; i++) power = nextMinusLens(power, "add");
    expect(power).toBe(-4);
    expect(nextMinusLens(power, "add")).toBe(-4);
    for (let i = 0; i < 16; i++) power = nextMinusLens(power, "remove");
    expect(power).toBe(0);
    expect(nextMinusLens(power, "remove")).toBe(0);
  });
  it("requires completed setup and a settled blur response", () => {
    expect(canRecordMinusLens(-3.75, true, true)).toBe(false);
    expect(canRecordMinusLens(-4, false, true)).toBe(false);
    expect(canRecordMinusLens(-4, true, false)).toBe(false);
    expect(canRecordMinusLens(-4, true, true)).toBe(true);
  });
  it("adds the 40 cm demand to added minus magnitude", () => {
    expect(minusLensAmplitude(-4)).toBe(6.5);
  });
});
