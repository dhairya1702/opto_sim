import { expect, it } from "vitest";
import { krimskyEye, krimskyReady, krimskyResidual } from "../interaction/krimsky";
it("selects the deviating eye for standard and fixating eye for modified", () => {
  expect(krimskyEye("standard")).toBe("OS");
  expect(krimskyEye("modified")).toBe("OD");
  expect(krimskyReady("standard", "OD", true, true, 50, true)).toBe(false);
  expect(krimskyReady("modified", "OD", true, true, 50, true)).toBe(true);
  expect(krimskyReady("modified", "OD", true, true, 40, true)).toBe(false);
});
it("neutralises only with correct base and shows overcorrection", () => {
  expect(krimskyResidual(20, 20, true)).toBe(0);
  expect(krimskyResidual(20, 20, false)).toBe(40);
  expect(krimskyResidual(20, 25, true)).toBe(-5);
});

it("requires every viewing gate for either method", () => {
  for (const method of ["standard", "modified"] as const) {
    const eye = krimskyEye(method);
    expect(krimskyReady(method, eye, true, true, 50, true)).toBe(true);
    expect(krimskyReady(method, eye, false, true, 50, true)).toBe(false);
    expect(krimskyReady(method, eye, true, false, 50, true)).toBe(false);
    expect(krimskyReady(method, eye, true, true, 50, false)).toBe(false);
  }
});
it("matches the esodeviation endpoint with base out", () => {
  expect(krimskyResidual(15, 15, true)).toBe(0);
  expect(krimskyResidual(15, 15, false)).toBe(30);
  expect(krimskyResidual(15, 14, true)).toBe(1);
});
