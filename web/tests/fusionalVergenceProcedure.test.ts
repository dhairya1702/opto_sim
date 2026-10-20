import { describe, expect, it } from "vitest";
import {
  FUSIONAL_DISTANCE_CASE, FUSIONAL_STABILITY_MS, cancelFusionalRun, configureFusionalRun, enterFusionalRecord,
  fusionalBaseFromRoll, fusionalDialAngleToPower, fusionalDisclosure, fusionalEyeState, fusionalGuidedStep,
  fusionalPatientReport, fusionalPowerToDialAngle, fusionalPrismGeometry, interruptFusionalRun, newFusionalRun, reviseFusionalSetup,
  sampleFusionalRun, submitFusionalRecord, type FusionalBase, type FusionalRun, type FusionalSpatialSample,
} from "../interaction/fusionalVergenceProcedure";

const valid = (nowMs: number, power: number, base: FusionalBase = "BI", changes: Partial<FusionalSpatialSample> = {}): FusionalSpatialSample => ({
  nowMs, power, base, correctionFitted: true, targetEstablished: true, prismHeld: true, alignedOD: true,
  patientFacing: true, tiltValid: true, visible: true, tracking: true, ...changes,
});

const configured = () => {
  let run = newFusionalRun();
  run = configureFusionalRun(run, "fit-correction");
  run = configureFusionalRun(run, "establish-target");
  run = configureFusionalRun(run, "give-instruction");
  run = configureFusionalRun(run, "pickup-prism");
  return run;
};

function baseline(run: FusionalRun, clock: { value: number }, base: FusionalBase) {
  run = sampleFusionalRun(run, valid(clock.value, 0, base));
  clock.value += FUSIONAL_STABILITY_MS;
  return sampleFusionalRun(run, valid(clock.value, 0, base));
}

function move(run: FusionalRun, clock: { value: number }, from: number, to: number, base: FusionalBase) {
  const step = to > from ? .5 : -.5;
  let power = from;
  while (Math.abs(power - to) > .01) {
    power = Math.round((power + step) * 10) / 10;
    clock.value += 250;
    run = sampleFusionalRun(run, valid(clock.value, power, base));
  }
  clock.value += FUSIONAL_STABILITY_MS;
  return sampleFusionalRun(run, valid(clock.value, to, base));
}

function completeBI(run = configured(), clock = { value: 0 }) {
  run = baseline(run, clock, "BI");
  run = move(run, clock, 0, 7, "BI");
  expect(run.pendingBlur?.actualDelta).toBe("X");
  expect(run.pendingBreak?.actualDelta).toBe(7);
  run = sampleFusionalRun(run, valid(clock.value, 7, "BI"));
  run = move(run, clock, 7, 4, "BI");
  return { run, clock };
}

function completeBoth() {
  let { run, clock } = completeBI();
  run = move(run, clock, 4, 0, "BI");
  clock.value += FUSIONAL_STABILITY_MS;
  run = sampleFusionalRun(run, valid(clock.value, 0, "BI"));
  run = sampleFusionalRun(run, valid(clock.value, 0, "BO"));
  clock.value += FUSIONAL_STABILITY_MS;
  run = sampleFusionalRun(run, valid(clock.value, 0, "BO"));
  run = move(run, clock, 0, 9, "BO");
  expect(run.pendingBlur?.actualDelta).toBe(9);
  run = move(run, clock, 9, 19, "BO");
  run = sampleFusionalRun(run, valid(clock.value, 19, "BO"));
  run = move(run, clock, 19, 12, "BO");
  return { run, clock };
}

describe("horizontal distance fusional vergence procedure", () => {
  it("guides BI increase, partial break capture, recovery, and zero reset in procedure order", () => {
    const clock = { value: 0 };
    let run = baseline(configured(), clock, "BI");
    const coach = (power: number, base: FusionalBase = "BI") => fusionalGuidedStep(run, valid(clock.value, power, base));
    expect(coach(0).id).toBe("bi-increase");
    run = move(run, clock, 0, 7, "BI");
    expect(run.phase).toBe("decrease-start");
    expect(run.pendingBreak).not.toBeNull();
    expect(run.captures.BI).toBeUndefined();
    expect(coach(7)).toMatchObject({ id: "bi-recovery", title: "Reduce BI to recovery" });
    run = sampleFusionalRun(run, valid(clock.value, 7, "BI"));
    expect(run.phase).toBe("decrease");
    run = move(run, clock, 7, 5, "BI");
    expect(run.captures.BI).toBeUndefined();
    expect(coach(5).id).toBe("bi-recovery");
    run = move(run, clock, 5, 4, "BI");
    expect(run.phase).toBe("zero-reset");
    expect(run.captures.BI).toBeDefined();
    expect(coach(4).id).toBe("bo-run");
    run = move(run, clock, 4, 0, "BI");
    expect(run.phase).toBe("bo-orient");
    expect(coach(0).id).toBe("bo-run");
    run = baseline(run, clock, "BO");
    expect(run.phase).toBe("increase");
    expect(coach(0, "BO").id).toBe("bo-run");
  });

  it("returns to BI baseline guidance when an unfinished recovery is interrupted", () => {
    const clock = { value: 0 };
    let run = baseline(configured(), clock, "BI");
    run = move(run, clock, 0, 7, "BI");
    run = interruptFusionalRun(run, "Tracking was lost.");
    expect(run.pendingBreak).toBeNull();
    expect(fusionalGuidedStep(run, valid(clock.value, 0)).id).toBe("baseline");
    run = baseline(run, clock, "BI");
    expect(fusionalGuidedStep(run, valid(clock.value, 0)).id).toBe("bi-increase");
  });

  it("keeps bilateral captures on release and recording guidance without live setup", () => {
    let { run, clock } = completeBoth();
    const putDown = valid(clock.value, 12, "BI", {
      base: null,
      prismHeld: false, alignedOD: false, patientFacing: false, tiltValid: false,
      correctionFitted: false, targetEstablished: false, visible: false, tracking: false,
    });
    expect(fusionalGuidedStep(run, putDown)).toMatchObject({ id: "record", complete: false });
    run = configureFusionalRun(run, "release-prism");
    expect(fusionalGuidedStep(run, putDown).id).toBe("record");
    const values = { "bi-blur": "X", "bi-break": "7", "bi-recovery": "4", "bo-blur": "9", "bo-break": "19", "bo-recovery": "12" };
    for (const [id, value] of Object.entries(values)) run = enterFusionalRecord(run, id, value);
    expect(fusionalGuidedStep(run, putDown).id).toBe("record");
    run = submitFusionalRecord(run);
    expect(fusionalGuidedStep(run, putDown)).toMatchObject({ id: "record", complete: true });
  });

  it("preserves the concealed fictional BI X/7/4 and BO 9/19/12 pattern", () => {
    expect(FUSIONAL_DISTANCE_CASE.endpoints).toEqual({ BI: { blur: null, break: 7, recovery: 4 }, BO: { blur: 9, break: 19, recovery: 12 } });
    const { run } = completeBoth();
    expect(run.captures.BI && [run.captures.BI.blur.actualDelta, run.captures.BI.break.actualDelta, run.captures.BI.recovery.actualDelta]).toEqual(["X", 7, 4]);
    expect(run.captures.BO && [run.captures.BO.blur.actualDelta, run.captures.BO.break.actualDelta, run.captures.BO.recovery.actualDelta]).toEqual([9, 19, 12]);
    expect(run.phase).toBe("captured");
  });

  it("requires BI before BO, stable baseline, continuous motion and zero re-fusion", () => {
    let run = configured();
    run = sampleFusionalRun(run, valid(0, 0, "BO"));
    expect(run.phase).toBe("baseline");
    expect(run.feedback).toContain("BI");
    run = sampleFusionalRun(run, valid(0, 0, "BI"));
    expect(run.phase).toBe("baseline");
    run = sampleFusionalRun(run, valid(249, 0, "BI"));
    expect(run.phase).toBe("baseline");
    run = sampleFusionalRun(run, valid(250, 0, "BI"));
    expect(run.phase).toBe("increase");
    run = sampleFusionalRun(run, valid(500, .6, "BI"));
    run = sampleFusionalRun(run, valid(750, -.1, "BI"));
    expect(run.phase).toBe("baseline");
    expect(run.feedback).toContain("reversed");
  });

  it("rejects excessive speed, jumps, long pauses and invalid alignment", () => {
    const clock = { value: 0 };
    let run = baseline(configured(), clock, "BI");
    clock.value += 100;
    run = sampleFusionalRun(run, valid(clock.value, 1, "BI"));
    expect(run.feedback).toContain("too quickly");
    run = baseline(run, clock, "BI");
    clock.value += 1250;
    run = sampleFusionalRun(run, valid(clock.value, .1, "BI"));
    expect(run.feedback).toContain("paused");
    run = baseline(run, clock, "BI");
    clock.value += 250;
    run = sampleFusionalRun(run, valid(clock.value, .5, "BI", { alignedOD: false }));
    expect(run.feedback).toContain("Align the aperture");
    run = baseline(run, clock, "BI");
    clock.value += 500;
    run = sampleFusionalRun(run, valid(clock.value, 2.5, "BI"));
    expect(run.feedback).toContain("jumped");
  });

  it("preserves completed BI across BO interruption and setup revision", () => {
    let { run } = completeBI();
    expect(run.captures.BI).toBeDefined();
    run = interruptFusionalRun(run, "Tracking was lost.");
    expect(run.captures.BI).toBeDefined();
    expect(run.phase).toBe("zero-reset");
    run = reviseFusionalSetup(run, "Distance correction changed.");
    expect(run.captures.BI).toBeDefined();
    expect(run.captures.BO).toBeUndefined();
    expect(run.base).toBe("BO");
  });

  it("retains immutable captures and accepts independent X/decimal entry once", () => {
    let { run } = completeBoth();
    run = configureFusionalRun(run, "release-prism");
    const nonce = run.eventNonce;
    const values = { "bi-blur": "X", "bi-break": "7.0", "bi-recovery": "4", "bo-blur": "9", "bo-break": "19", "bo-recovery": "12" };
    for (const [id, value] of Object.entries(values)) run = enterFusionalRecord(run, id, value);
    const complete = submitFusionalRecord(run, nonce);
    expect(complete.record?.submitted.BI).toEqual({ blur: "X", break: 7, recovery: 4 });
    expect(complete.completionAwarded).toBe(true);
    expect(submitFusionalRecord(complete)).toBe(complete);
    expect(submitFusionalRecord(run, nonce - 1)).toBe(run);
  });

  it("clears cancellation without inventing evidence", () => {
    const { run } = completeBoth();
    const cancelled = cancelFusionalRun(run);
    expect(cancelled.captures).toEqual({});
    expect(cancelled.record).toBeNull();
    expect(cancelled.eventNonce).toBeGreaterThan(run.eventNonce);
  });

  it("maps physical roll and the continuous 0–30Δ dial deterministically", () => {
    expect(fusionalBaseFromRoll(0)).toBe("BI");
    expect(fusionalBaseFromRoll(Math.PI)).toBe("BO");
    expect(fusionalBaseFromRoll(Math.PI / 2)).toBeNull();
    for (const power of [0, .1, 7, 19, 30]) expect(fusionalDialAngleToPower(fusionalPowerToDialAngle(power))).toBe(power);
    const geometry = { prismHeld: true, alignedOD: true, patientFacing: true, tiltValid: true, base: "BI" as const };
    expect(fusionalPrismGeometry(geometry)).toBe("");
    expect(fusionalPrismGeometry({ ...geometry, prismHeld: false })).toContain("Pick up");
    expect(fusionalPrismGeometry({ ...geometry, patientFacing: false })).toContain("toward Arun");
    expect(fusionalPrismGeometry({ ...geometry, alignedOD: false })).toContain("before OD");
    expect(fusionalPrismGeometry({ ...geometry, tiltValid: false })).toContain("Level");
  });

  it("owns patient reports and uses base-aware persistent breakdown", () => {
    let run = baseline(configured(), { value: 0 }, "BI");
    expect(fusionalPatientReport(run, 6.4)).toContain("clear");
    expect(fusionalPatientReport(run, 7)).toContain("double");
    const bi = fusionalEyeState(run, 7);
    run = Object.freeze({ ...run, base: "BO" as const });
    const bo = fusionalEyeState(run, 19);
    expect(bi.OD).toBeGreaterThan(0);
    expect(bo.OD).toBeLessThan(0);
  });

  it("conceals thresholds and removes coach/highlights in independent Test", () => {
    const run = configured();
    const sample = valid(0, 0, "BI");
    expect(fusionalGuidedStep(run, sample).title).not.toMatch(/7|19/);
    expect(fusionalDisclosure("guided")).toMatchObject({ showCoach: true, showHighlights: true, revealThresholds: false });
    expect(fusionalDisclosure("test")).toMatchObject({ showCoach: false, showHighlights: false, revealThresholds: false });
  });
});
