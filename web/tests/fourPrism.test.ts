import { expect, it } from "vitest";
import { fourPrismGaze, prismEyeAt } from "../interaction/fourPrism";
it("identifies placement before each eye", () => {
  expect(prismEyeAt(-0.22, 0.2)).toBe("OD");
  expect(prismEyeAt(0.22, 0.2)).toBe("OS");
  expect(prismEyeAt(0, -0.4)).toBeNull();
});
it("shows conjugate version then fellow-eye refixation for both normal placements", () => {
  expect(fourPrismGaze("OD", "normal", 700)).toEqual({ od: 0.035, os: 0.035 });
  expect(fourPrismGaze("OD", "normal", 2000)).toEqual({ od: 0.035, os: 0 });
  expect(fourPrismGaze("OS", "normal", 700)).toEqual({ od: -0.035, os: -0.035 });
  expect(fourPrismGaze("OS", "normal", 2000)).toEqual({ od: 0, os: -0.035 });
});
it("omits refixation or all movement for the two suppression placements", () => {
  expect(fourPrismGaze("OD", "suppression", 2000)).toEqual({ od: 0.035, os: 0.035 });
  expect(fourPrismGaze("OS", "suppression", 700)).toEqual({ od: 0, os: 0 });
  expect(fourPrismGaze("OS", "suppression", 2000)).toEqual({ od: 0, os: 0 });
});
