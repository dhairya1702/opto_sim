import { describe, expect, it } from "vitest";
import { gazeForEye, gazePositions, motilityHRoutePositions, motilityNextGazeIds, motilityRecordedObservation, motilityScenarios, newMotilityCoverage, observeTarget, scenarioGazeForEye, targetFromControls, type MotilityCoverage } from "../interaction/motility";
import { accumulateAlignedTime, acuityTarget, isAcuityToolAligned } from "../interaction/acuity";
describe("manual fixation", () => {
  const at = (state: MotilityCoverage, x: number, y: number, dt = .1, active = true) => observeTarget(state, targetFromControls(x, y, .35), dt, active);
  const hold = (state: MotilityCoverage, x: number, y: number, frames = 8) => {
    for (let index = 0; index < frames; index++) state = at(state, x, y);
    return state;
  };
  const move = (state: MotilityCoverage, from: { x: number; y: number }, to: { x: number; y: number }) => {
    for (let index = 1; index <= 8; index++) state = at(state, from.x + (to.x - from.x) * index / 8, from.y + (to.y - from.y) * index / 8, .05);
    return state;
  };
  it("converges symmetrically at centre and more at a nearer distance", () => {
    const far = targetFromControls(0, 0, 0.4), near = targetFromControls(0, 0, 0.3);
    expect(gazeForEye(far, -0.032).yaw).toBeCloseTo(-gazeForEye(far, 0.032).yaw);
    expect(gazeForEye(near, -0.032).yaw).toBeGreaterThan(gazeForEye(far, -0.032).yaw);
  });
  it("tracks both eyes toward the same target within movement limits", () => {
    for (const x of [-1, 1]) {
      const target = targetFromControls(x, 1, 0.35);
      for (const eye of [-0.032, 0.032]) {
        const gaze = gazeForEye(target, eye);
        expect(Math.sign(gaze.yaw)).toBe(x);
        expect(gaze.pitch).toBeGreaterThan(0);
        expect(Math.abs(gaze.yaw)).toBeLessThanOrEqual(0.65);
      }
    }
  });
  it("requires sustained observation, tolerates brief spatial jitter, and never grants idle coverage", () => {
    const empty = newMotilityCoverage();
    const centre = targetFromControls(0, 0, 0.35);
    expect(observeTarget(empty, centre, 30, false).seen).toEqual([]);
    expect(observeTarget(empty, centre, 30, true).seen).toEqual([]);
    let state = empty;
    for (let i = 0; i < 5; i++) state = observeTarget(state, centre, 0.1, true);
    state = observeTarget(state, targetFromControls(0.4, 0.4, 0.35), 0.1, true);
    expect(state.current).toBe("centre");
    expect(state.dwell).toBeCloseTo(0.5);
    state = observeTarget(state, centre, 0.1, true);
    expect(state.dwell).toBeCloseTo(0.6);
    const inactive = observeTarget(state, centre, 0.1, false);
    expect(inactive.current).toBeNull();
    expect(inactive.dwell).toBe(0);
    state = observeTarget(state, targetFromControls(0.4, 0.4, 0.35), 0.1, true);
    state = observeTarget(state, targetFromControls(0.4, 0.4, 0.35), 0.1, true);
    expect(state.dwell).toBe(0);
    let previous = motilityHRoutePositions[0];
    state = hold(newMotilityCoverage(), previous.x, previous.y);
    for (const position of motilityHRoutePositions.slice(1)) {
      state = move(state, previous, position);
      state = hold(state, position.x, position.y);
      previous = position;
    }
    expect(state.seen).toHaveLength(9);
    for (let i = 0; i < 10; i++) state = observeTarget(state, centre, 0.1, true);
    expect(state.seen).toHaveLength(9);
  });
  it("uses forgiving, non-overlapping gaze zones", () => {
    const centred = hold(newMotilityCoverage(), 0, 0);
    expect(observeTarget(centred, targetFromControls(0.2, 0.7, 0.35), 0.1, true, { assisted: true }).current).toBe("up");
    expect(observeTarget(centred, targetFromControls(0.25, 0.7, 0.35), 0.1, true, { assisted: true }).current).toBeNull();
  });
  it("credits only adjacent continuous H transitions and locally repairs a route break", () => {
    let state = hold(newMotilityCoverage(), 0, 0);
    expect(state.seen).toEqual(["centre"]);
    expect(motilityNextGazeIds(state)).toEqual(["left", "right", "up", "down"]);
    state = move(state, { x: 0, y: 0 }, { x: -.8, y: 0 });
    state = hold(state, -.8, 0);
    expect(state.seen).toEqual(["centre", "left"]);
    for (let index = 1; index <= 8; index++) state = at(state, -.8 + 1.6 * index / 8, .7 * index / 8, .1);
    expect(state.seen).toEqual(["centre", "left"]);
    expect(state.recovery).toEqual({ returnTo: "left", reason: "route" });
    state = hold(state, -.8, 0, 4);
    expect(state.recovery).toBeNull();
    expect(state.seen).toEqual(["centre", "left"]);
    state = move(state, { x: -.8, y: 0 }, { x: -.8, y: .7 });
    state = hold(state, -.8, .7);
    expect(state.seen).toEqual(["centre", "left", "left-up"]);
  });
  it("rejects an abrupt jump and requires fixation recovery without erasing completed points", () => {
    let state = hold(newMotilityCoverage(), 0, 0);
    state = at(state, -.8, 0, .05);
    expect(state.recovery).toEqual({ returnTo: "centre", reason: "speed" });
    expect(state.seen).toEqual(["centre"]);
    state = at(state, 0, 0, .1);
    state = at(state, 0, 0, .1);
    state = at(state, 0, 0, .1);
    expect(state.recovery).toBeNull();
    state = observeTarget(state, targetFromControls(0, 0, .35), .1, false);
    expect(state.recovery).toEqual({ returnTo: "centre", reason: "fixation" });
    expect(state.seen).toEqual(["centre"]);
  });
  it("uses patient-relative direction names only for accessible descriptions", () => {
    expect(gazePositions.find(position => position.id === "left")?.label).toBe("Right gaze");
    expect(gazePositions.find(position => position.id === "right")?.label).toBe("Left gaze");
  });
  it("authors five distinct draft findings with matching records and symptom replies", () => {
    expect(motilityScenarios.map(scenario => scenario.id)).toEqual([
      "full", "od-abduction", "os-abduction", "od-elevation", "right-gaze-nystagmus",
    ]);
    expect(new Set(motilityScenarios.map(scenario => scenario.patientReply)).size).toBe(5);
    for (const scenario of motilityScenarios) {
      expect(motilityRecordedObservation(scenario.id)).toBe(scenario.recordedFinding);
      expect(scenario.recordedFinding).not.toMatch(/diagnos/i);
    }
  });
  it("applies each authored restriction only to its observable eye and direction", () => {
    const patientRight = targetFromControls(-1, 0, .35);
    const patientLeft = targetFromControls(1, 0, .35);
    const up = targetFromControls(0, 1, .35);
    expect(Math.abs(scenarioGazeForEye("od-abduction", patientRight, "OD").yaw)).toBeLessThan(Math.abs(scenarioGazeForEye("full", patientRight, "OD").yaw) / 2);
    expect(scenarioGazeForEye("od-abduction", patientRight, "OS")).toEqual(scenarioGazeForEye("full", patientRight, "OS"));
    expect(Math.abs(scenarioGazeForEye("os-abduction", patientLeft, "OS").yaw)).toBeLessThan(Math.abs(scenarioGazeForEye("full", patientLeft, "OS").yaw) / 2);
    expect(Math.abs(scenarioGazeForEye("od-elevation", up, "OD").pitch)).toBeLessThan(Math.abs(scenarioGazeForEye("full", up, "OD").pitch) / 2);
    expect(scenarioGazeForEye("od-elevation", up, "OS")).toEqual(scenarioGazeForEye("full", up, "OS"));
  });
  it("limits the nystagmus example to patient-right gaze", () => {
    const patientRight = targetFromControls(-1, 0, .35);
    const patientLeft = targetFromControls(1, 0, .35);
    expect(scenarioGazeForEye("right-gaze-nystagmus", patientRight, "OD", 0).yaw)
      .not.toBe(scenarioGazeForEye("right-gaze-nystagmus", patientRight, "OD", .1).yaw);
    expect(scenarioGazeForEye("right-gaze-nystagmus", patientLeft, "OD", 0))
      .toEqual(scenarioGazeForEye("right-gaze-nystagmus", patientLeft, "OD", .1));
  });
});
describe("manual acuity tools", () => {
  it("puts the plain occluder over the fellow eye and the pinhole over the tested eye", () => {
    expect(acuityTarget("distance", "OD").x).toBeGreaterThan(0);
    expect(acuityTarget("distance", "OS").x).toBeLessThan(0);
    expect(acuityTarget("pinhole", "OD").x).toBeLessThan(0);
    expect(acuityTarget("pinhole", "OS").x).toBeGreaterThan(0);
  });
  it("uses tighter pinhole alignment and requires uninterrupted steady positioning", () => {
    const target = acuityTarget("pinhole", "OD");
    expect(isAcuityToolAligned("pinhole", "OD", target)).toBe(true);
    expect(isAcuityToolAligned("pinhole", "OD", { x: target.x + 0.12, y: 0 })).toBe(false);
    let dwell = 0;
    for (let i = 0; i < 5; i++) dwell = accumulateAlignedTime(dwell, true, 0.1);
    expect(dwell).toBeCloseTo(0.5);
    expect(accumulateAlignedTime(dwell, false, 0.1)).toBe(0);
    expect(accumulateAlignedTime(0, true, 5)).toBe(0.1);
  });
});
