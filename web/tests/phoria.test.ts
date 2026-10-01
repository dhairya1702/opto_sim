import { describe, expect, it } from "vitest";
import { maddoxStreakOffset, rodOrientationCorrect, thoringtonFinding } from "../interaction/phoria";

describe("phoria practice", () => {
  it("neutralises when prism reaches the authored endpoint", () => expect(maddoxStreakOffset("horizontal", 6, 6)).toBe(0));
  it("requires matching groove orientation", () => { expect(rodOrientationCorrect("horizontal", "horizontal")).toBe(true); expect(rodOrientationCorrect("vertical", "horizontal")).toBe(false); });
  it("interprets Modified Thorington direction", () => { expect(thoringtonFinding("horizontal", 4)).toBe("esophoria"); expect(thoringtonFinding("horizontal", -4)).toBe("exophoria"); expect(thoringtonFinding("vertical", 3)).toBe("left-hyperphoria"); expect(thoringtonFinding("vertical", -3)).toBe("right-hyperphoria"); });
});
