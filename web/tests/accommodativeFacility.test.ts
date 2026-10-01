import { expect, it } from "vitest";
import { facilityCanFlip, facilityNext, facilityRemaining } from "../interaction/accommodativeFacility";
it("counts only a cleared plus/minus pair", () => {
  expect(facilityNext("plus", 0)).toEqual({ side: "minus", cycles: 0 });
  expect(facilityNext("minus", 0)).toEqual({ side: "plus", cycles: 1 });
});
it("requires clearing time for each newly presented side", () => {
  expect(facilityCanFlip(0, 0, 1499, "plus")).toBe(false);
  expect(facilityCanFlip(0, 0, 1500, "plus")).toBe(true);
  expect(facilityCanFlip(0, 1500, 3299, "minus")).toBe(false);
  expect(facilityCanFlip(0, 1500, 3300, "minus")).toBe(true);
});
it("rejects flips at the deadline even if a timer callback is delayed", () => {
  expect(facilityRemaining(1000, 60500)).toBe(1);
  expect(facilityCanFlip(1000, 57000, 61000, "minus")).toBe(false);
  expect(facilityRemaining(1000, 90000)).toBe(0);
});
