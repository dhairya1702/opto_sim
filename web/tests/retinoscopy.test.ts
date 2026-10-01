import { describe, expect, it } from "vitest";
import {
  formatSignedDioptres,
  grossNeutralLens,
  reflexMotion,
  reflexQuality,
  retinoscopeAligned,
  retinoscopySweepZone,
  retinoscopyTargets,
  workingDistanceDioptres,
} from "../interaction/retinoscopy";

describe("manual retinoscopy model", () => {
  it("calculates gross neutralisation from net refraction and working distance", () => {
    expect(workingDistanceDioptres(67)).toBeCloseTo(1.4925, 3);
    expect(grossNeutralLens("OD", 67)).toBe(0.25);
    expect(grossNeutralLens("OS", 67)).toBe(0);
  });

  it("reverses from with to against motion through neutral", () => {
    expect(reflexMotion("OD", 67, 0)).toBe("with");
    expect(reflexMotion("OD", 67, 0.25)).toBe("neutral");
    expect(reflexMotion("OD", 67, 0.5)).toBe("against");
    expect(reflexQuality("OD", 67, 0.25).brightness).toBeGreaterThan(reflexQuality("OD", 67, -2).brightness);
  });

  it("requires pupil alignment and recognises a complete horizontal sweep", () => {
    const target = retinoscopyTargets.OS;
    expect(retinoscopeAligned("OS", target)).toBe(true);
    expect(retinoscopeAligned("OS", { x: target.x, y: 0.4 })).toBe(false);
    expect(retinoscopySweepZone("OS", { x: target.x - 0.1, y: 0 })).toBe("left");
    expect(retinoscopySweepZone("OS", target)).toBe("centre");
    expect(retinoscopySweepZone("OS", { x: target.x + 0.1, y: 0 })).toBe("right");
  });

  it("formats signed clinical lens powers", () => {
    expect(formatSignedDioptres(0.25)).toBe("+0.25 D");
    expect(formatSignedDioptres(-1.5)).toBe("−1.50 D");
    expect(formatSignedDioptres(0)).toBe("0.00 D");
  });
});
