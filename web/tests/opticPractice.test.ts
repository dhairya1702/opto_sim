import { describe, expect, it } from "vitest";
import { opticTechniqueChecks } from "../interaction/opticPractice";

const aligned = {
  aimX: 0,
  aimY: 0,
  light: true,
  fixation: true,
  largeSpot: true,
  viewAligned: true,
};

describe("optic practice technique gates", () => {
  it("accepts Bruckner only near one metre with the complete setup", () => {
    expect(opticTechniqueChecks("bruckner", { ...aligned, distanceCm: 100 }).ready).toBe(true);
    expect(opticTechniqueChecks("bruckner", { ...aligned, distanceCm: 78 }).ready).toBe(false);
    expect(opticTechniqueChecks("bruckner", { ...aligned, distanceCm: 100, largeSpot: false }).ready).toBe(false);
  });

  it("uses the narrower Hirschberg working-distance window", () => {
    expect(opticTechniqueChecks("hirschberg", { ...aligned, distanceCm: 50 }).ready).toBe(true);
    expect(opticTechniqueChecks("hirschberg", { ...aligned, distanceCm: 55 }).ready).toBe(false);
  });

  it("requires centred aim, illumination, fixation, and viewing alignment", () => {
    expect(opticTechniqueChecks("bruckner", { ...aligned, distanceCm: 100, aimX: .3 }).ready).toBe(false);
    expect(opticTechniqueChecks("bruckner", { ...aligned, distanceCm: 100, light: false }).ready).toBe(false);
    expect(opticTechniqueChecks("bruckner", { ...aligned, distanceCm: 100, fixation: false }).ready).toBe(false);
    expect(opticTechniqueChecks("bruckner", { ...aligned, distanceCm: 100, viewAligned: false }).ready).toBe(false);
  });
});
