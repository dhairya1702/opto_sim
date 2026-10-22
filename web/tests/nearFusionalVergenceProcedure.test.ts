import { describe, expect, it } from "vitest";
import {
  NEAR_FUSIONAL_CASE, NEAR_FUSIONAL_STABILITY_MS, cancelNearFusionalRun, configureNearFusionalRun,
  enterNearFusionalRecord, interruptNearFusionalRun, nearFusionalBaseFromRoll, nearFusionalDialAngleToPower,
  nearFusionalDisclosure, nearFusionalEyeState, nearFusionalGuidedStep, nearFusionalPatientReport,
  nearFusionalPowerToDialAngle, nearFusionalPrismGeometry, nearFusionalRecordFieldIds, newNearFusionalRun,
  reviseNearFusionalSetup, sampleNearFusionalRun, submitNearFusionalRecord,
  type NearFusionalBase, type NearFusionalRun, type NearFusionalSpatialSample,
} from "../interaction/nearFusionalVergenceProcedure";

const valid = (nowMs: number, power: number, base: NearFusionalBase = "BI", changes: Partial<NearFusionalSpatialSample> = {}): NearFusionalSpatialSample => ({
  nowMs, power, base, correctionFitted: true, targetEstablished: true, targetDistanceCm: 40, prismHeld: true,
  alignedOD: true, patientFacing: true, tiltValid: true, visible: true, tracking: true, ...changes,
});

const configured = () => {
  let run = newNearFusionalRun();
  for (const action of ["fit-correction", "establish-target", "give-instruction", "pickup-prism"] as const)
    run = configureNearFusionalRun(run, action);
  return run;
};

function baseline(run: NearFusionalRun, clock: { value: number }, base: NearFusionalBase) {
  run = sampleNearFusionalRun(run, valid(clock.value, 0, base));
  clock.value += NEAR_FUSIONAL_STABILITY_MS;
  return sampleNearFusionalRun(run, valid(clock.value, 0, base));
}

function move(run: NearFusionalRun, clock: { value: number }, from: number, to: number, base: NearFusionalBase) {
  const step = to > from ? .5 : -.5;
  let power = from;
  while (Math.abs(power - to) > .01) {
    power = Math.round((power + step) * 10) / 10;
    clock.value += 250;
    run = sampleNearFusionalRun(run, valid(clock.value, power, base));
  }
  clock.value += NEAR_FUSIONAL_STABILITY_MS;
  return sampleNearFusionalRun(run, valid(clock.value, to, base));
}

function completeBI(run = configured(), clock = { value: 0 }) {
  run = baseline(run, clock, "BI");
  run = move(run, clock, 0, 13, "BI");
  run = move(run, clock, 13, 21, "BI");
  run = sampleNearFusionalRun(run, valid(clock.value, 21, "BI"));
  run = move(run, clock, 21, 13, "BI");
  return { run, clock };
}

function completeBoth() {
  let { run, clock } = completeBI();
  run = move(run, clock, 13, 0, "BI");
  clock.value += NEAR_FUSIONAL_STABILITY_MS;
  run = sampleNearFusionalRun(run, valid(clock.value, 0, "BI"));
  run = sampleNearFusionalRun(run, valid(clock.value, 0, "BO"));
  clock.value += NEAR_FUSIONAL_STABILITY_MS;
  run = sampleNearFusionalRun(run, valid(clock.value, 0, "BO"));
  run = move(run, clock, 0, 17, "BO");
  run = move(run, clock, 17, 21, "BO");
  run = sampleNearFusionalRun(run, valid(clock.value, 21, "BO"));
  run = move(run, clock, 21, 11, "BO");
  return { run, clock };
}

describe("horizontal near fusional vergence procedure", () => {
  it("keeps bilateral captures on recording guidance after release, but not an unfinished BO run", () => {
    const released = valid(100000, 11, "BO", { prismHeld: false, alignedOD: false, base: null, correctionFitted: false, targetEstablished: false });
    expect(nearFusionalGuidedStep(completeBI().run, released).index).not.toBe(9);
    let { run } = completeBoth();
    expect(nearFusionalGuidedStep(run, released)).toMatchObject({ index: 9, title: "Release and record" });
    run = configureNearFusionalRun(run, "release-prism");
    expect(nearFusionalGuidedStep(run, released).index).toBe(9);
    for (const [id, value] of Object.entries({ "bi-blur": "13", "bi-break": "21", "bi-recovery": "13", "bo-blur": "17", "bo-break": "21", "bo-recovery": "11" }))
      run = enterNearFusionalRecord(run, id, value);
    expect(nearFusionalGuidedStep(submitNearFusionalRecord(run), released)).toMatchObject({ index: 9, complete: true });
  });
  it("preserves the concealed fictional BI 13/21/13 and BO 17/21/11 pattern", () => {
    expect(NEAR_FUSIONAL_CASE.endpoints).toEqual({ BI: { blur: 13, break: 21, recovery: 13 }, BO: { blur: 17, break: 21, recovery: 11 } });
    const { run } = completeBoth();
    expect(run.captures.BI && [run.captures.BI.blur.actualDelta, run.captures.BI.break.actualDelta, run.captures.BI.recovery.actualDelta]).toEqual([13, 21, 13]);
    expect(run.captures.BO && [run.captures.BO.blur.actualDelta, run.captures.BO.break.actualDelta, run.captures.BO.recovery.actualDelta]).toEqual([17, 21, 11]);
    expect(run.captures.BI?.targetDistanceCm).toBe(40);
    expect(run.phase).toBe("captured");
  });

  it("requires BI first, stable near target, continuous motion and zero re-fusion", () => {
    let run = configured();
    run = sampleNearFusionalRun(run, valid(0, 0, "BO"));
    expect(run.phase).toBe("baseline");
    expect(run.feedback).toContain("BI");
    run = sampleNearFusionalRun(run, valid(0, 0, "BI", { targetDistanceCm: 43 }));
    expect(run.feedback).toContain("38–42");
    run = sampleNearFusionalRun(run, valid(0, 0));
    run = sampleNearFusionalRun(run, valid(249, 0));
    expect(run.phase).toBe("baseline");
    run = sampleNearFusionalRun(run, valid(250, 0));
    expect(run.phase).toBe("increase");
  });

  it("captures the accepted dial reading rather than replacing it with the authored threshold", () => {
    const clock = { value: 0 };
    let run = baseline(configured(), clock, "BI"), power = 0;
    while (power < 12.5) { power += .5; clock.value += 250; run = sampleNearFusionalRun(run, valid(clock.value, power)); }
    clock.value += 150; run = sampleNearFusionalRun(run, valid(clock.value, 12.8));
    clock.value += NEAR_FUSIONAL_STABILITY_MS; run = sampleNearFusionalRun(run, valid(clock.value, 12.8));
    expect(run.pendingBlur?.actualDelta).toBe(12.8);
  });

  it("rejects excessive speed, jumps, pauses, reversals and invalid geometry", () => {
    const clock = { value: 0 };
    let run = baseline(configured(), clock, "BI");
    run = sampleNearFusionalRun(run, valid(clock.value + 100, 1));
    expect(run.feedback).toContain("too quickly");
    run = baseline(run, clock, "BI");
    run = sampleNearFusionalRun(run, valid(clock.value + 500, 2.5));
    expect(run.feedback).toContain("jumped");
    run = baseline(run, clock, "BI");
    run = sampleNearFusionalRun(run, valid(clock.value + 1250, .1));
    expect(run.feedback).toContain("paused");
    run = baseline(run, clock, "BI");
    run = sampleNearFusionalRun(run, valid(clock.value + 250, .6));
    run = sampleNearFusionalRun(run, valid(clock.value + 500, 0));
    expect(run.feedback).toContain("reversed");
    run = baseline(run, clock, "BI");
    run = sampleNearFusionalRun(run, valid(clock.value + 250, .5, "BI", { alignedOD: false }));
    expect(run.feedback).toContain("Align the aperture");
  });

  it("preserves completed BI for interruption but clears it when measurement conditions change", () => {
    let { run } = completeBI();
    run = interruptNearFusionalRun(run, "Tracking was lost.");
    expect(run.captures.BI).toBeDefined();
    run = reviseNearFusionalSetup(run, "The near target moved.", true, false);
    expect(run.captures).toEqual({});
    expect(run.base).toBe("BI");
    expect(run.targetEstablished).toBe(false);
  });

  it("retains immutable captures and grades six independent decimal entries once", () => {
    let { run } = completeBoth();
    run = configureNearFusionalRun(run, "release-prism");
    const nonce = run.eventNonce;
    const values = { "bi-blur": "13.0", "bi-break": "21", "bi-recovery": "13", "bo-blur": "17", "bo-break": "21", "bo-recovery": "11" };
    for (const [id, value] of Object.entries(values)) run = enterNearFusionalRecord(run, id, value);
    const complete = submitNearFusionalRecord(run, nonce);
    expect(complete.record?.submitted.BI).toEqual({ blur: 13, break: 21, recovery: 13 });
    expect(complete.completionAwarded).toBe(true);
    expect(submitNearFusionalRecord(complete)).toBe(complete);
    expect(submitNearFusionalRecord(run, nonce - 1)).toBe(run);
  });

  it("does not open recording on early release", () => {
    const released = configureNearFusionalRun(configured(), "release-prism");
    expect(released.released).toBe(false);
    expect(released.feedback).toContain("Complete BI and BO");
    expect(submitNearFusionalRecord(released)).toBe(released);
  });

  it("supports future X blur records without exposing X in this case", () => {
    expect(Object.values(NEAR_FUSIONAL_CASE.endpoints).every(value => value.blur !== null)).toBe(true);
    expect(nearFusionalRecordFieldIds).toContain("bi-blur");
  });

  it("maps physical roll, dial and geometry deterministically", () => {
    expect(nearFusionalBaseFromRoll(0)).toBe("BI");
    expect(nearFusionalBaseFromRoll(Math.PI)).toBe("BO");
    expect(nearFusionalBaseFromRoll(Math.PI / 2)).toBeNull();
    for (const power of [0, .1, 13, 21, 30]) expect(nearFusionalDialAngleToPower(nearFusionalPowerToDialAngle(power))).toBe(power);
    const geometry = { prismHeld: true, alignedOD: true, patientFacing: true, tiltValid: true, base: "BI" as const };
    expect(nearFusionalPrismGeometry(geometry)).toBe("");
    expect(nearFusionalPrismGeometry({ ...geometry, prismHeld: false })).toContain("Pick up");
    expect(nearFusionalPrismGeometry({ ...geometry, patientFacing: false })).toContain("toward Arun");
  });

  it("owns patient reports and starts eye motion from a converged near baseline", () => {
    let run = baseline(configured(), { value: 0 }, "BI");
    expect(nearFusionalPatientReport(run, 12)).toContain("clear");
    expect(nearFusionalPatientReport(run, 13)).toContain("blurred");
    expect(nearFusionalPatientReport(run, 21)).toContain("double");
    const baselineEyes = nearFusionalEyeState(run, 0);
    expect(baselineEyes.OD).toBeGreaterThan(0);
    expect(baselineEyes.OS).toBeLessThan(0);
    const bi = nearFusionalEyeState(run, 21);
    run = Object.freeze({ ...run, base: "BO" as const });
    const bo = nearFusionalEyeState(run, 21);
    expect(bi.OD).toBeGreaterThan(0);
    expect(bo.OD).toBeLessThan(0);
    const recovered = completeBI().run;
    expect(nearFusionalPatientReport(recovered, 13)).toContain("single");
    expect(nearFusionalEyeState(recovered, 13).broken).toBe(false);
  });

  it("conceals thresholds in Test and cancellation creates no evidence", () => {
    const run = configured(), sample = valid(0, 0);
    expect(nearFusionalGuidedStep(run, sample).title).not.toMatch(/13|17|21/);
    expect(nearFusionalDisclosure("guided")).toMatchObject({ showCoach: true, showHighlights: true, revealThresholds: false });
    expect(nearFusionalDisclosure("test")).toMatchObject({ showCoach: false, showHighlights: false, revealThresholds: false });
    const cancelled = cancelNearFusionalRun(completeBoth().run);
    expect(cancelled.captures).toEqual({});
    expect(cancelled.record).toBeNull();
  });
});

it.each(["alignedOD", "targetEstablished", "tracking", "correctionFitted"] as const)("requires fresh vergence baseline dwell after invalid %s", field => {
  let run = sampleNearFusionalRun(configured(), valid(0, 0, "BI"));
  run = sampleNearFusionalRun(run, valid(200, 0, "BI", { [field]: false }));
  expect(run.baselineStableSinceMs).toBeNull();
  run = sampleNearFusionalRun(run, valid(300, 0, "BI")); expect(run.phase).toBe("baseline");
  run = sampleNearFusionalRun(run, valid(549, 0, "BI")); expect(run.phase).toBe("baseline");
  run = sampleNearFusionalRun(run, valid(550, 0, "BI")); expect(run.phase).toBe("increase");
  expect(configureNearFusionalRun(run, "give-instruction")).toBe(run);
});
