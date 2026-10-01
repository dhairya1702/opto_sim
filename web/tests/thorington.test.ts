import { expect, it } from "vitest";
import { thoringtonDirection, thoringtonDistanceReady, thoringtonLightAligned } from "../interaction/thorington";
it("accepts the illustrative 40 cm card range", () => {
  expect(thoringtonDistanceReady(38)).toBe(true);
  expect(thoringtonDistanceReady(42)).toBe(true);
  expect(thoringtonDistanceReady(37)).toBe(false);
  expect(thoringtonDistanceReady(43)).toBe(false);
});
it("requires the light at the central hole", () => {
  expect(thoringtonLightAligned(0, 0)).toBe(true);
  expect(thoringtonLightAligned(0.3, 0.2)).toBe(false);
});
it("interprets patient-view streak positions consistently on both axes", () => {
  expect(thoringtonDirection("horizontal", 6)).toBe("esophoria");
  expect(thoringtonDirection("horizontal", -8)).toBe("exophoria");
  expect(thoringtonDirection("vertical", 4)).toBe("left-hyperphoria");
  expect(thoringtonDirection("vertical", -3)).toBe("right-hyperphoria");
  expect(thoringtonDirection("vertical", 0)).toBe("orthophoria");
});
