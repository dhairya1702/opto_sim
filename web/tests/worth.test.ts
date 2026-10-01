import { expect, it } from "vitest";
import { worthAtDistance, worthDots } from "../interaction/worth";
it("uses distance-dependent suppression only in the authored central scenario", () => {
  expect(worthAtDistance("central-os", 40)).toBe("fusion");
  expect(worthAtDistance("central-os", 600)).toBe("suppress-os");
  expect(worthAtDistance("suppress-od", 40)).toBe("suppress-od");
});
it("shows the correct count for fusion, suppression, and diplopia", () => {
  expect(worthDots("fusion")).toHaveLength(4);
  expect(worthDots("suppress-os")).toHaveLength(2);
  expect(worthDots("suppress-od")).toHaveLength(3);
  for (const finding of ["eso", "exo", "left-hyper", "right-hyper"] as const) expect(worthDots(finding)).toHaveLength(5);
});
it("places red dots correctly relative to the green group", () => {
  const mean = (finding: Parameters<typeof worthDots>[0], color: string, axis: "x" | "y") => {
    const dots = worthDots(finding).filter(dot => dot.color === color);
    return dots.reduce((sum, dot) => sum + dot[axis], 0) / dots.length;
  };
  expect(mean("eso", "#ff5757", "x")).toBeGreaterThan(mean("eso", "#48e88c", "x"));
  expect(mean("exo", "#ff5757", "x")).toBeLessThan(mean("exo", "#48e88c", "x"));
  expect(mean("left-hyper", "#ff5757", "y")).toBeLessThan(mean("left-hyper", "#48e88c", "y"));
  expect(mean("right-hyper", "#ff5757", "y")).toBeGreaterThan(mean("right-hyper", "#48e88c", "y"));
});
