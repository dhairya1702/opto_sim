import { describe, expect, it } from "vitest";
import {
  VERTICAL_FUSIONAL_CASE, VERTICAL_FUSIONAL_STABILITY_MS, cancelVerticalFusionalRun, configureVerticalFusionalRun,
  enterVerticalFusionalRecord, interruptVerticalFusionalRun, newVerticalFusionalRun, reviseVerticalFusionalSetup,
  sampleVerticalFusionalRun, submitVerticalFusionalRecord, verticalFusionalBaseFromRoll, verticalFusionalDialAngleToPower,
  verticalFusionalDisclosure, verticalFusionalEyeState, verticalFusionalGuidedStep, verticalFusionalPatientReport,
  verticalFusionalPowerToDialAngle, verticalFusionalPrismGeometry, verticalFusionalRecordFieldIds,
  type VerticalFusionalBase, type VerticalFusionalRun, type VerticalFusionalSpatialSample,
} from "../interaction/verticalFusionalVergenceProcedure";
import { rotaryPrismBaseFromRoll } from "../interaction/rotaryPrismProcedure";

const valid = (nowMs: number, power: number, base: VerticalFusionalBase = "BU", changes: Partial<VerticalFusionalSpatialSample> = {}): VerticalFusionalSpatialSample => ({
  nowMs, power, base, correctionFitted: true, targetEstablished: true, prismHeld: true, alignedOD: true,
  patientFacing: true, tiltValid: true, visible: true, tracking: true, ...changes,
});
const configured = () => {
  let run = newVerticalFusionalRun();
  for (const action of ["fit-correction", "establish-target", "give-instruction", "pickup-prism"] as const)
    run = configureVerticalFusionalRun(run, action);
  return run;
};
const baseline = (run: VerticalFusionalRun, clock: { value: number }, base: VerticalFusionalBase) => {
  run = sampleVerticalFusionalRun(run, valid(clock.value, 0, base));
  clock.value += VERTICAL_FUSIONAL_STABILITY_MS;
  return sampleVerticalFusionalRun(run, valid(clock.value, 0, base));
};
const move = (run: VerticalFusionalRun, clock: { value: number }, from: number, to: number, base: VerticalFusionalBase) => {
  const step = to > from ? .5 : -.5;
  let power = from;
  while (Math.abs(power - to) > .01) {
    power = Math.round((power + step) * 10) / 10;
    clock.value += 250;
    run = sampleVerticalFusionalRun(run, valid(clock.value, power, base));
  }
  clock.value += VERTICAL_FUSIONAL_STABILITY_MS;
  return sampleVerticalFusionalRun(run, valid(clock.value, to, base));
};
const completeBU = (run = configured(), clock = { value: 0 }) => {
  run = baseline(run, clock, "BU");
  run = move(run, clock, 0, 4, "BU");
  expect(run.pendingBreak?.actualDelta).toBe(4);
  run = sampleVerticalFusionalRun(run, valid(clock.value, 4, "BU"));
  run = move(run, clock, 4, 2, "BU");
  return { run, clock };
};
const completeBoth = () => {
  let { run, clock } = completeBU();
  run = move(run, clock, 2, 0, "BU");
  clock.value += VERTICAL_FUSIONAL_STABILITY_MS;
  run = sampleVerticalFusionalRun(run, valid(clock.value, 0, "BU"));
  run = sampleVerticalFusionalRun(run, valid(clock.value, 0, "BD"));
  clock.value += VERTICAL_FUSIONAL_STABILITY_MS;
  run = sampleVerticalFusionalRun(run, valid(clock.value, 0, "BD"));
  run = move(run, clock, 0, 4, "BD");
  run = sampleVerticalFusionalRun(run, valid(clock.value, 4, "BD"));
  run = move(run, clock, 4, 2, "BD");
  return { run, clock };
};

describe("vertical distance fusional vergence procedure", () => {
  it("keeps bilateral captures on recording guidance after release, but not an unfinished BD run", () => {
    const released = valid(100000, 2, "BD", { prismHeld: false, alignedOD: false, base: null, correctionFitted: false, targetEstablished: false });
    expect(verticalFusionalGuidedStep(completeBU().run, released).index).not.toBe(9);
    let { run } = completeBoth();
    expect(verticalFusionalGuidedStep(run, released)).toMatchObject({ index: 9, title: "Release and record" });
    run = configureVerticalFusionalRun(run, "release-prism");
    expect(verticalFusionalGuidedStep(run, released).index).toBe(9);
    for (const [id, value] of Object.entries({ "bu-break": "4", "bu-recovery": "2", "bd-break": "4", "bd-recovery": "2" }))
      run = enterVerticalFusionalRecord(run, id, value);
    expect(verticalFusionalGuidedStep(submitVerticalFusionalRecord(run), released)).toMatchObject({ index: 9, complete: true });
  });
  it("preserves concealed BU 4/2 and BD 4/2 with no blur or X model", () => {
    expect(VERTICAL_FUSIONAL_CASE.endpoints).toEqual({ BU: { break: 4, recovery: 2 }, BD: { break: 4, recovery: 2 } });
    expect(verticalFusionalRecordFieldIds).toEqual(["bu-break", "bu-recovery", "bd-break", "bd-recovery"]);
    expect(JSON.stringify(newVerticalFusionalRun())).not.toMatch(/blur|"X"/i);
    const { run } = completeBoth();
    expect(run.captures.BU && [run.captures.BU.break.actualDelta, run.captures.BU.recovery.actualDelta]).toEqual([4, 2]);
    expect(run.captures.BD && [run.captures.BD.break.actualDelta, run.captures.BD.recovery.actualDelta]).toEqual([4, 2]);
  });

  it("requires BU before BD, break before recovery, stable baseline and stable zero reset", () => {
    let run = configured();
    run = sampleVerticalFusionalRun(run, valid(0, 0, "BD"));
    expect(run.phase).toBe("baseline"); expect(run.feedback).toContain("BU");
    run = sampleVerticalFusionalRun(run, valid(0, 0, "BU"));
    run = sampleVerticalFusionalRun(run, valid(249, 0, "BU")); expect(run.phase).toBe("baseline");
    run = sampleVerticalFusionalRun(run, valid(250, 0, "BU")); expect(run.phase).toBe("increase");
    run = sampleVerticalFusionalRun(run, valid(500, .5, "BU"));
    run = sampleVerticalFusionalRun(run, valid(750, 0, "BU"));
    expect(run.feedback).toContain("increasing");
  });

  it("captures accepted decimal dial readings and grades independent immutable entries", () => {
    let { run } = completeBoth();
    run = configureVerticalFusionalRun(run, "release-prism");
    const captures = run.captures;
    for (const [id, value] of Object.entries({ "bu-break": "4.0", "bu-recovery": "2", "bd-break": "4", "bd-recovery": "2.0" }))
      run = enterVerticalFusionalRecord(run, id, value);
    const complete = submitVerticalFusionalRecord(run);
    expect(complete.record?.submitted).toEqual({ BU: { break: 4, recovery: 2 }, BD: { break: 4, recovery: 2 } });
    expect(complete.record?.captures).toEqual({ BU: captures.BU, BD: captures.BD });
    expect(submitVerticalFusionalRecord(complete)).toBe(complete);
  });

  it("stores the actual accepted readings inside the endpoint windows rather than authored centres", () => {
    const clock = { value: 0 };
    let run = baseline(configured(), clock, "BU");
    run = move(run, clock, 0, 3.5, "BU");
    expect(run.pendingBreak?.actualDelta).toBe(3.5);
    run = sampleVerticalFusionalRun(run, valid(clock.value, 3.5, "BU"));
    run = move(run, clock, 3.5, 2.5, "BU");
    expect(run.captures.BU?.break.actualDelta).toBe(3.5);
    expect(run.captures.BU?.recovery.actualDelta).toBe(2.5);
  });

  it("shares continuous speed, jitter, pause, reversal and jump rejection", () => {
    const clock = { value: 0 };
    let run = baseline(configured(), clock, "BU");
    clock.value += 100; run = sampleVerticalFusionalRun(run, valid(clock.value, 1, "BU")); expect(run.feedback).toContain("too quickly");
    run = baseline(run, clock, "BU");
    clock.value += 1250; run = sampleVerticalFusionalRun(run, valid(clock.value, .1, "BU")); expect(run.feedback).toContain("paused");
    run = baseline(run, clock, "BU");
    clock.value += 500; run = sampleVerticalFusionalRun(run, valid(clock.value, 2.5, "BU")); expect(run.feedback).toContain("jumped");
    run = baseline(run, clock, "BU");
    clock.value += 250; run = sampleVerticalFusionalRun(run, valid(clock.value, .6, "BU"));
    clock.value += 250; run = sampleVerticalFusionalRun(run, valid(clock.value, 0, "BU")); expect(run.feedback).toContain("reversed");
  });

  it("classifies all four signed physical rolls and filters vertical BU/BD", () => {
    expect(rotaryPrismBaseFromRoll(0)).toBe("BI");
    expect(rotaryPrismBaseFromRoll(Math.PI / 2)).toBe("BU");
    expect(rotaryPrismBaseFromRoll(Math.PI)).toBe("BO");
    expect(rotaryPrismBaseFromRoll(-Math.PI / 2)).toBe("BD");
    expect(verticalFusionalBaseFromRoll(Math.PI / 2)).toBe("BU");
    expect(verticalFusionalBaseFromRoll(-Math.PI / 2)).toBe("BD");
    expect(verticalFusionalBaseFromRoll(0)).toBeNull();
    for (const power of [0, .1, 4, 12.3, 30]) expect(verticalFusionalDialAngleToPower(verticalFusionalPowerToDialAngle(power))).toBe(power);
  });

  it("requires OD placement, patient-facing aperture and valid tilt", () => {
    const geometry = { prismHeld: true, alignedOD: true, patientFacing: true, tiltValid: true, base: "BU" as const };
    expect(verticalFusionalPrismGeometry(geometry)).toBe("");
    expect(verticalFusionalPrismGeometry({ ...geometry, prismHeld: false })).toContain("Pick up");
    expect(verticalFusionalPrismGeometry({ ...geometry, alignedOD: false })).toContain("before OD");
    expect(verticalFusionalPrismGeometry({ ...geometry, patientFacing: false })).toContain("toward Arun");
    expect(verticalFusionalPrismGeometry({ ...geometry, tiltValid: false })).toContain("BU or BD");
  });

  it("preserves completed BU through unfinished BD interruption and revision", () => {
    let { run } = completeBU();
    run = interruptVerticalFusionalRun(run, "Tracking was lost.");
    expect(run.captures.BU).toBeDefined(); expect(run.phase).toBe("zero-reset");
    run = reviseVerticalFusionalSetup(run, "Correction changed.");
    expect(run.captures.BU).toBeDefined(); expect(run.captures.BD).toBeUndefined(); expect(run.base).toBe("BD");
    const cancelled = cancelVerticalFusionalRun(run);
    expect(cancelled.captures).toEqual({}); expect(cancelled.record).toBeNull();
  });

  it("rejects stale submission and setup callbacks", () => {
    let { run } = completeBoth(); run = configureVerticalFusionalRun(run, "release-prism");
    const staleNonce = run.eventNonce - 1;
    for (const id of verticalFusionalRecordFieldIds) run = enterVerticalFusionalRecord(run, id, id.includes("break") ? "4" : "2");
    expect(submitVerticalFusionalRecord(run, staleNonce)).toBe(run);
  });

  it("owns diplopia/recovery reports and opposing base-aware vertical eye drift", () => {
    let run = baseline(configured(), { value: 0 }, "BU");
    expect(verticalFusionalPatientReport(run, 3.4)).toContain("clear");
    expect(verticalFusionalPatientReport(run, 4)).toContain("double");
    const bu = verticalFusionalEyeState(run, 4);
    run = Object.freeze({ ...run, base: "BD" as const });
    const bd = verticalFusionalEyeState(run, 4);
    expect(bu.OD.y).toBeGreaterThan(0); expect(bu.OS.y).toBeLessThan(0);
    expect(bd.OD.y).toBeLessThan(0); expect(bd.OS.y).toBeGreaterThan(0);
  });

  it("conceals endpoints and coaching in Test while keeping neutral disclosure", () => {
    const run = configured(), sample = valid(0, 0, "BU");
    expect(verticalFusionalGuidedStep(run, sample).title).not.toMatch(/4|2/);
    expect(verticalFusionalDisclosure("guided")).toMatchObject({ showCoach: true, showHighlights: true, revealThresholds: false });
    expect(verticalFusionalDisclosure("test")).toMatchObject({ showCoach: false, showHighlights: false, revealThresholds: false });
  });
});

it.each(["alignedOD", "targetEstablished", "tracking", "correctionFitted"] as const)("requires fresh vergence baseline dwell after invalid %s", field => {
  let run = sampleVerticalFusionalRun(configured(), valid(0, 0, "BU"));
  run = sampleVerticalFusionalRun(run, valid(200, 0, "BU", { [field]: false }));
  expect(run.baselineStableSinceMs).toBeNull();
  run = sampleVerticalFusionalRun(run, valid(300, 0, "BU")); expect(run.phase).toBe("baseline");
  run = sampleVerticalFusionalRun(run, valid(549, 0, "BU")); expect(run.phase).toBe("baseline");
  run = sampleVerticalFusionalRun(run, valid(550, 0, "BU")); expect(run.phase).toBe("increase");
  expect(configureVerticalFusionalRun(run, "give-instruction")).toBe(run);
});
