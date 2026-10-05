import { describe, expect, it } from "vitest";
import { gazePositions, observeTarget, targetFromControls, type MotilityCoverage } from "../interaction/motility";
import { xrMotilityTarget } from "../interaction/xrMotility";

const eyeMidpoint = [0, 1.5, -.57] as const;

describe("XR ocular motility", () => {
  it("derives the patient-relative target and working distance from controller position", () => {
    const result = xrMotilityTarget([0, 1.5, -.22], eyeMidpoint);
    expect(result.distanceCm).toBeCloseTo(35);
    expect(result.distanceReady).toBe(true);
    expect(xrMotilityTarget([0, 1.5, .03], eyeMidpoint).distanceReady).toBe(false);
  });

  it("feeds spatial checkpoints into the shared nine-position coverage logic", () => {
    let coverage: MotilityCoverage = { seen: [], current: null, dwell: 0 };
    for (const position of gazePositions) {
      const relative = targetFromControls(position.x, position.y, .35);
      const world = [relative.x, eyeMidpoint[1] + relative.y, eyeMidpoint[2] + relative.z] as const;
      const spatial = xrMotilityTarget(world, eyeMidpoint);
      for (let index = 0; index < 7; index += 1) coverage = observeTarget(coverage, spatial.target, .1, spatial.distanceReady);
    }
    expect(coverage.seen).toHaveLength(gazePositions.length);
  });
});
