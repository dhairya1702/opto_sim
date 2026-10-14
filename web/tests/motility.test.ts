import { describe, expect, it } from "vitest";
import { gazeForEye, gazePositions, motilityRecordedObservation, motilityScenarios, observeTarget, scenarioGazeForEye, targetFromControls, type MotilityCoverage } from "../interaction/motility";
import { accumulateAlignedTime, acuityTarget, isAcuityToolAligned } from "../interaction/acuity";
describe("manual fixation", () => {
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
    const empty: MotilityCoverage = { seen: [], current: null, dwell: 0 };
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
    for (const p of gazePositions) {
      for (let i = 0; i < 10; i++) state = observeTarget(state, targetFromControls(p.x, p.y, 0.35), 0.1, true);
    }
    expect(state.seen).toHaveLength(9);
    for (let i = 0; i < 10; i++) state = observeTarget(state, centre, 0.1, true);
    expect(state.seen).toHaveLength(9);
  });
  it("uses forgiving, non-overlapping gaze zones", () => {
    const empty: MotilityCoverage = { seen: [], current: null, dwell: 0 };
    expect(observeTarget(empty, targetFromControls(0.2, 0.7, 0.35), 0.1, true).current).toBe("up");
    expect(observeTarget(empty, targetFromControls(0.25, 0.7, 0.35), 0.1, true).current).toBeNull();
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
