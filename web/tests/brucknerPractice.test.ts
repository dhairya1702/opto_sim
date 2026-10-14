import { describe, expect, it } from "vitest";
import { BRUCKNER_REFLEX_VISUALS, brucknerReflexVisual } from "../interaction/brucknerPractice";

function rgb(hex: string) {
  const value = Number.parseInt(hex.slice(1), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const;
}

function hueDegrees(hex: string) {
  const [r8, g8, b8] = rgb(hex);
  const r = r8 / 255, g = g8 / 255, b = b8 / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), delta = max - min;
  if (delta === 0) return 0;
  const sector = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
  return (sector * 60 + 360) % 360;
}

function relativeLuminance(hex: string) {
  const linear = rgb(hex).map(channel => {
    const value = channel / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  return .2126 * linear[0] + .7152 * linear[1] + .0722 * linear[2];
}

describe("Bruckner reflex visuals", () => {
  it("keeps dim, equal and bright reflexes in the same red-orange hue family", () => {
    const visuals = Object.values(BRUCKNER_REFLEX_VISUALS);
    const hues = visuals.flatMap(visual => [visual.color, visual.halo, visual.glow]).map(hueDegrees);
    expect(Math.min(...hues)).toBeGreaterThanOrEqual(7);
    expect(Math.max(...hues)).toBeLessThanOrEqual(16);
  });

  it("uses luminance, opacity and glow—not a categorical hue—to show relative brightness", () => {
    const { dim, equal, bright } = BRUCKNER_REFLEX_VISUALS;
    expect(relativeLuminance(dim.color)).toBeLessThan(relativeLuminance(equal.color));
    expect(relativeLuminance(equal.color)).toBeLessThan(relativeLuminance(bright.color));
    expect(dim.opacity).toBeLessThan(equal.opacity);
    expect(equal.opacity).toBeLessThan(bright.opacity);
    expect(dim.glowIntensity).toBeLessThan(equal.glowIntensity);
    expect(equal.glowIntensity).toBeLessThan(bright.glowIntensity);
  });

  it("maps equal, OD-brighter and OS-brighter scenarios to the correct eye luminance", () => {
    expect(brucknerReflexVisual("equal", "od").level).toBe("equal");
    expect(brucknerReflexVisual("equal", "os").level).toBe("equal");
    expect(brucknerReflexVisual("od", "od").level).toBe("bright");
    expect(brucknerReflexVisual("od", "os").level).toBe("dim");
    expect(brucknerReflexVisual("os", "od").level).toBe("dim");
    expect(brucknerReflexVisual("os", "os").level).toBe("bright");
  });
});
