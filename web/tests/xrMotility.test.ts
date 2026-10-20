import { describe, expect, it } from "vitest";
import { gazePositions, motilityHRoutePositions, newMotilityCoverage, observeTarget, targetFromControls, type MotilityCoverage } from "../interaction/motility";
import { xrMotilityTarget } from "../interaction/xrMotility";

const eyeMidpoint = [0, 1.5, -.57] as const;

describe("XR ocular motility", () => {
  it("derives patient-relative depth without changing working distance during a gaze scan", () => {
    const centre = xrMotilityTarget([0, 1.5, -.22], eyeMidpoint);
    const lateral = xrMotilityTarget([-.18, 1.5, -.22], eyeMidpoint);
    const vertical = xrMotilityTarget([0, 1.62, -.22], eyeMidpoint);
    const farther = xrMotilityTarget([0, 1.5, .03], eyeMidpoint);
    expect(centre.distanceCm).toBeCloseTo(35);
    expect(lateral.distanceCm).toBeCloseTo(centre.distanceCm);
    expect(vertical.distanceCm).toBeCloseTo(centre.distanceCm);
    expect(centre.distanceReady).toBe(true);
    expect(lateral.distanceReady).toBe(true);
    expect(vertical.distanceReady).toBe(true);
    expect(farther.distanceCm).toBeCloseTo(60);
    expect(farther.distanceReady).toBe(false);
  });

  it("feeds spatial checkpoints into the shared nine-position coverage logic", () => {
    let coverage: MotilityCoverage = newMotilityCoverage();
    let previous = motilityHRoutePositions[0];
    const sample = (x: number, y: number, dt: number) => {
      const relative = targetFromControls(x, y, .35);
      const world = [relative.x, eyeMidpoint[1] + relative.y, eyeMidpoint[2] + relative.z] as const;
      const spatial = xrMotilityTarget(world, eyeMidpoint);
      coverage = observeTarget(coverage, spatial.target, dt, spatial.distanceReady);
    };
    for (let index = 0; index < 8; index += 1) sample(previous.x, previous.y, .1);
    for (const position of motilityHRoutePositions.slice(1)) {
      for (let index = 1; index <= 8; index += 1)
        sample(previous.x + (position.x - previous.x) * index / 8, previous.y + (position.y - previous.y) * index / 8, .05);
      for (let index = 0; index < 8; index += 1) sample(position.x, position.y, .1);
      previous = position;
    }
    expect(coverage.seen).toHaveLength(gazePositions.length);
  });
});
