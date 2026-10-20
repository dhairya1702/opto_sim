import { describe, expect, it } from "vitest";
import {
  confirmMinusLensInitialClear, giveMinusLensInstruction, interruptMinusLens, minusLensEye, minusLensGuidedStep,
  newMinusLensRun, sampleMinusLens, stepMinusLensPower, submitMinusLensRecord,
  type MinusLensRun, type MinusLensSpatialSample,
} from "../interaction/minusLensProcedure";

const valid = (nowMs: number, overrides: Partial<MinusLensSpatialSample> = {}): MinusLensSpatialSample => ({
  nowMs, correctionFitted: true, targetReady: true, occlusionReady: true, lensHeld: true, lensAligned: true,
  visible: true, tracking: true, ...overrides,
});
function arm(run = newMinusLensRun()) {
  const instructed = giveMinusLensInstruction(run, valid(0));
  return confirmMinusLensInitialClear(instructed, valid(0));
}
function reachEndpoint(run: MinusLensRun, nowMs = 0) {
  let next = run;
  for (let index = 0; index < 16; index++) next = stepMinusLensPower(next, "add", valid(nowMs));
  return next;
}
function capture(run = newMinusLensRun(), start = 0) {
  let next = reachEndpoint(arm(run), start);
  next = sampleMinusLens(next, valid(start + 1199));
  return sampleMinusLens(next, valid(start + 1200));
}

describe("dedicated minus-lens procedure", () => {
  it("keeps captured-eye recording and final completion ahead of live holder setup", () => {
    const released = valid(1300, { lensHeld: false, lensAligned: false, correctionFitted: false, targetReady: false, occlusionReady: false });
    let run = capture();
    expect(minusLensGuidedStep(run, released)).toMatchObject({ index: 7, title: "Record OD" });
    run = submitMinusLensRecord(run, "-4", "6.5");
    expect(minusLensGuidedStep(run, released).index).toBe(0);
    run = capture(run, 2000);
    expect(minusLensGuidedStep(run, released).title).toBe("Record OS");
    run = submitMinusLensRecord(run, "-4", "6.5");
    expect(minusLensGuidedStep(run, released).title).toBe("Series complete");
  });
  it("requires OD setup, instruction and eye-specific initial clarity before changing power", () => {
    let run = newMinusLensRun();
    expect(minusLensEye(run)).toBe("OD");
    run = stepMinusLensPower(run, "add", valid(0)); expect(run.powerD).toBe(0); expect(run.feedback).toContain("Confirm");
    run = giveMinusLensInstruction(run, valid(0, { targetReady: false })); expect(run.instructionArmed).toBe(false); expect(run.feedback).toContain("40 cm");
    run = giveMinusLensInstruction(run, valid(0)); run = confirmMinusLensInitialClear(run, valid(0));
    expect(run.initialClearConfirmed).toBe(true); expect(stepMinusLensPower(run, "add", valid(0)).powerD).toBe(-.25);
  });

  it("clamps the physical dial without destroying valid progress at either limit", () => {
    let run = arm();
    run = stepMinusLensPower(run, "remove", valid(0)); expect(run.powerD).toBe(0); expect(run.initialClearConfirmed).toBe(true);
    run = reachEndpoint(run); const limited = stepMinusLensPower(run, "add", valid(0));
    expect(limited.powerD).toBe(-4); expect(limited.initialClearConfirmed).toBe(true); expect(limited.feedback).toContain("limit");
  });

  it("automatically freezes the authored endpoint only after 1.2 seconds of valid sustained blur", () => {
    let run = reachEndpoint(arm());
    expect(run.phase).toBe("confirming-blur"); expect(run.capture).toBeNull();
    run = sampleMinusLens(run, valid(1199)); expect(run.capture).toBeNull();
    run = sampleMinusLens(run, valid(1200));
    expect(run.capture).toEqual({ eye: "OD", powerD: -4, amplitudeD: 6.5 });
    expect(run.report).toContain("remain blurred");
  });

  it("invalidates unfinished work on material setup changes but preserves frozen evidence through release and tracking loss", () => {
    let run = reachEndpoint(arm());
    run = sampleMinusLens(run, valid(500, { lensAligned: false }));
    expect(run.powerD).toBe(-4); expect(run.feedback).toContain("within 250 ms");
    run = sampleMinusLens(run, valid(750, { lensAligned: false }));
    expect(run.powerD).toBe(0); expect(run.initialClearConfirmed).toBe(false); expect(run.feedback).toContain("Restart OD");
    run = capture(); const frozen = run;
    expect(sampleMinusLens(run, valid(1300, { lensHeld: false, tracking: false }))).toBe(frozen);
    expect(interruptMinusLens(run, "Tracking was lost.")).toBe(frozen);
  });

  it("records raw power and calculated amplitude independently, then resets clarity for OS", () => {
    let run = capture();
    let rejected = submitMinusLensRecord(run, "-4", "4"); expect(rejected.records).toHaveLength(0); expect(rejected.feedback).toContain("calculation");
    run = submitMinusLensRecord(run, "-4", "6.5");
    expect(run.records).toHaveLength(1); expect(minusLensEye(run)).toBe("OS"); expect(run.initialClearConfirmed).toBe(false); expect(run.powerD).toBe(0);
    run = capture(run, 2000); run = submitMinusLensRecord(run, "-4", "6.5");
    expect(run.phase).toBe("complete"); expect(run.records.map(record => record.eye)).toEqual(["OD", "OS"]);
  });

  it("provides condition-specific Guided steps while Test disclosure remains neutral", () => {
    const run = newMinusLensRun();
    expect(minusLensGuidedStep(run, valid(0, { correctionFitted: false })).title).toContain("correction");
    expect(minusLensGuidedStep(run, valid(0, { targetReady: false })).title).toContain("near line");
    expect(minusLensGuidedStep(run, valid(0, { occlusionReady: false })).title).toContain("OD");
    expect(minusLensGuidedStep(run, valid(0, { lensAligned: false })).title).toContain("lens holder");
  });
});
