import { describe, expect, it } from "vitest";
import {
  RELATIVE_HOLDER_MIN_D, RELATIVE_HOLDER_MAX_D, RELATIVE_RESPONSE_MS, RELATIVE_SETUP_GRACE_MS, confirmRelativeAccommodationBaseline, confirmRelativeAccommodationInitialClear,
  giveRelativeAccommodationInstruction, interruptRelativeAccommodation, newRelativeAccommodationRun,
  relativeAccommodationDisclosure, relativeAccommodationGuidedStep, restartRelativeAccommodationConditions,
  sampleRelativeAccommodation, stepRelativeAccommodationPower, submitRelativeAccommodationRecord,
  type RelativeAccommodationSpatialSample,
} from "../interaction/relativeAccommodationProcedure";

const valid = (nowMs: number, overrides: Partial<RelativeAccommodationSpatialSample> = {}): RelativeAccommodationSpatialSample => ({
  nowMs, correctionFitted: true, targetDocked: true, holderHeld: true, holderAligned: true, visible: true, tracking: true, ...overrides,
});

function prepared() {
  let run = newRelativeAccommodationRun();
  run = giveRelativeAccommodationInstruction(run, valid(0));
  return confirmRelativeAccommodationInitialClear(run, valid(0));
}

function captureNra() {
  let run = prepared();
  for (let i = 0; i < 8; i++) run = stepRelativeAccommodationPower(run, "plus", valid(i));
  run = sampleRelativeAccommodation(run, valid(RELATIVE_RESPONSE_MS + 8));
  return run;
}

function pendingEndpoint(kind: "NRA" | "PRA") {
  let run = kind === "NRA" ? prepared() : captureNra();
  if (kind === "PRA") {
    for (let i = 0; i < 8; i++) run = stepRelativeAccommodationPower(run, "minus", valid(1300 + i));
    run = confirmRelativeAccommodationBaseline(run, valid(1400));
  }
  for (let i = 0; i < (kind === "NRA" ? 8 : 9); i++)
    run = stepRelativeAccommodationPower(run, kind === "NRA" ? "plus" : "minus", valid(2000 + i));
  return run;
}

describe("relative accommodation procedure", () => {
  it("requires supported binocular setup, instruction, and initial clarity", () => {
    let run = newRelativeAccommodationRun();
    run = giveRelativeAccommodationInstruction(run, valid(0, { targetDocked: false }));
    expect(run.instructionArmed).toBe(false); expect(run.feedback).toContain("40 cm");
    run = giveRelativeAccommodationInstruction(run, valid(0));
    expect(run.phase).toBe("initial-clear");
    run = confirmRelativeAccommodationInitialClear(run, valid(0));
    expect(run.phase).toBe("nra"); expect(run.initialClearConfirmed).toBe(true);
  });

  it("automatically freezes NRA, requires a clear zero baseline, then freezes PRA", () => {
    let run = captureNra();
    expect(run.nraCapture).toEqual({ kind: "NRA", powerD: 2 }); expect(run.phase).toBe("baseline");
    expect(confirmRelativeAccommodationBaseline(run, valid(0)).baselineConfirmed).toBe(false);
    for (let i = 0; i < 8; i++) run = stepRelativeAccommodationPower(run, "minus", valid(20 + i));
    expect(run.powerD).toBe(0); expect(run.phase).toBe("baseline-clear");
    run = confirmRelativeAccommodationBaseline(run, valid(30));
    expect(run.phase).toBe("pra"); expect(run.baselineConfirmed).toBe(true);
    for (let i = 0; i < 9; i++) run = stepRelativeAccommodationPower(run, "minus", valid(40 + i));
    expect(run.phase).toBe("confirming-pra");
    run = sampleRelativeAccommodation(run, valid(40 + 8 + RELATIVE_RESPONSE_MS));
    expect(run.praCapture).toEqual({ kind: "PRA", powerD: -2.25 }); expect(run.phase).toBe("captured");
  });

  it("keeps frozen NRA through interruption and cancels only unfinished response dwell", () => {
    let run = captureNra();
    const nra = run.nraCapture;
    for (let i = 0; i < 8; i++) run = stepRelativeAccommodationPower(run, "minus", valid(20 + i));
    run = confirmRelativeAccommodationBaseline(run, valid(30));
    for (let i = 0; i < 9; i++) run = stepRelativeAccommodationPower(run, "minus", valid(40 + i));
    run = interruptRelativeAccommodation(run, "Tracking was interrupted.");
    expect(run.nraCapture).toBe(nra); expect(run.praCapture).toBeNull(); expect(run.phase).toBe("pra"); expect(run.powerD).toBe(-2.25);
    run = sampleRelativeAccommodation(run, valid(50));
    expect(run.praCapture).toBeNull();
  });

  describe.each(["NRA", "PRA"] as const)("%s endpoint recovery", (kind) => {
    it.each(["explicit interruption", "invalid geometry"] as const)("restarts a full dwell after %s", (interruption) => {
      let run = pendingEndpoint(kind);
      const nra = run.nraCapture;
      const powerD = run.powerD;
      run = sampleRelativeAccommodation(run, valid(2500));
      if (interruption === "explicit interruption") {
        run = interruptRelativeAccommodation(run, "Tracking was interrupted.");
      } else {
        run = sampleRelativeAccommodation(run, valid(2600, { holderAligned: false }));
        run = sampleRelativeAccommodation(run, valid(2600 + RELATIVE_SETUP_GRACE_MS, { holderAligned: false }));
      }
      expect(run.phase).toBe(kind === "NRA" ? "nra" : "pra");
      expect(run.blurSinceMs).toBeNull();
      expect(run.powerD).toBe(powerD);
      expect(run.nraCapture).toBe(nra);
      expect(run.praCapture).toBeNull();

      // Even a long pause must not count toward the restored confirmation.
      run = sampleRelativeAccommodation(run, valid(10000));
      expect(run.phase).toBe(kind === "NRA" ? "confirming-nra" : "confirming-pra");
      expect(run.blurSinceMs).toBe(10000);
      expect(run.powerD).toBe(powerD);
      expect(run.nraCapture).toBe(nra);
      expect(run.praCapture).toBeNull();
      run = sampleRelativeAccommodation(run, valid(10000 + RELATIVE_RESPONSE_MS - 1));
      expect(kind === "NRA" ? run.nraCapture : run.praCapture).toBeNull();
      run = sampleRelativeAccommodation(run, valid(10000 + RELATIVE_RESPONSE_MS));
      expect(kind === "NRA" ? run.nraCapture : run.praCapture).toEqual({ kind, powerD });
      expect(run.phase).toBe(kind === "NRA" ? "baseline" : "captured");
      if (kind === "PRA") expect(run.nraCapture).toBe(nra);
    });
  });

  it("preserves the short geometry grace period", () => {
    let run = pendingEndpoint("NRA");
    const startedAt = run.blurSinceMs;
    run = sampleRelativeAccommodation(run, valid(2500, { holderAligned: false }));
    run = sampleRelativeAccommodation(run, valid(2500 + RELATIVE_SETUP_GRACE_MS - 1));
    expect(run.phase).toBe("confirming-nra");
    expect(run.blurSinceMs).toBe(startedAt);
    expect(run.invalidSinceMs).toBeNull();
  });

  it("does not rearm before instructions, initial clarity, or the clear baseline", () => {
    const pendingNra = interruptRelativeAccommodation(pendingEndpoint("NRA"), "Interrupted.");
    expect(sampleRelativeAccommodation({ ...pendingNra, instructionArmed: false }, valid(10000)).blurSinceMs).toBeNull();
    expect(sampleRelativeAccommodation({ ...pendingNra, initialClearConfirmed: false }, valid(10000)).blurSinceMs).toBeNull();
    const pendingPra = interruptRelativeAccommodation(pendingEndpoint("PRA"), "Interrupted.");
    expect(sampleRelativeAccommodation({ ...pendingPra, baselineConfirmed: false }, valid(10000)).blurSinceMs).toBeNull();
    const baseline = captureNra();
    expect(sampleRelativeAccommodation(interruptRelativeAccommodation(baseline, "Interrupted."), valid(10000)))
      .toMatchObject({ phase: "baseline", nraCapture: baseline.nraCapture, baselineConfirmed: false, blurSinceMs: null });
  });

  it("leaves captured and recorded endpoints unchanged after interruption and sampling", () => {
    const captured = sampleRelativeAccommodation(pendingEndpoint("PRA"), valid(4000));
    const complete = submitRelativeAccommodationRecord(captured, "2", "-2.25");
    expect(captured.phase).toBe("captured");
    expect(complete.phase).toBe("complete");
    for (const run of [captured, complete]) {
      expect(interruptRelativeAccommodation(run, "Interrupted.")).toBe(run);
      expect(sampleRelativeAccommodation(run, valid(10000))).toBe(run);
      expect(sampleRelativeAccommodation(run, valid(10000, { holderAligned: false }))).toBe(run);
    }
  });

  it("restarts all evidence when correction or supported-target conditions change", () => {
    const run = restartRelativeAccommodationConditions(captureNra(), "The target changed.");
    expect(run.nraCapture).toBeNull(); expect(run.powerD).toBe(0); expect(run.phase).toBe("setup");
  });

  it("rejects no-op and wrong-phase dial directions with actionable feedback", () => {
    let run = prepared();
    run = stepRelativeAccommodationPower(run, "minus", valid(0));
    expect(run.powerD).toBe(0); expect(run.feedback).toContain("adding plus");
    for (let i = 0; i < RELATIVE_HOLDER_MAX_D * 4; i++) run = stepRelativeAccommodationPower(run, "plus", valid(i));
    const limited = stepRelativeAccommodationPower(run, "plus", valid(100));
    expect(limited.powerD).toBe(RELATIVE_HOLDER_MAX_D); expect(limited.feedback).toContain("limit");
  });

  it.each(["NRA", "PRA"] as const)("allows %s overshoot while preserving blur, fresh confirmation, and interruption recovery", kind => {
    let run = pendingEndpoint(kind);
    const direction = kind === "NRA" ? "plus" : "minus";
    const expectedPower = run.powerD + (kind === "NRA" ? .25 : -.25);
    run = stepRelativeAccommodationPower(run, direction, valid(2500));
    expect(run.powerD).toBe(expectedPower);
    expect(run.phase).toBe(kind === "NRA" ? "confirming-nra" : "confirming-pra");
    expect(run.report).toContain("blurred");
    expect(run.blurSinceMs).toBe(2500);
    run = sampleRelativeAccommodation(run, valid(2500 + RELATIVE_RESPONSE_MS - 1));
    expect(kind === "NRA" ? run.nraCapture : run.praCapture).toBeNull();
    run = interruptRelativeAccommodation(run, "Interrupted.");
    run = sampleRelativeAccommodation(run, valid(10000));
    expect(run.blurSinceMs).toBe(10000);
    run = sampleRelativeAccommodation(run, valid(10000 + RELATIVE_RESPONSE_MS));
    expect(kind === "NRA" ? run.nraCapture : run.praCapture).toEqual({ kind, powerD: expectedPower });
    if (kind === "NRA") {
      for (let i = 0; i < expectedPower * 4; i++) run = stepRelativeAccommodationPower(run, "minus", valid(12000 + i));
      expect(run.powerD).toBe(0);
      expect(confirmRelativeAccommodationBaseline(run, valid(13000)).phase).toBe("pra");
    }
  });

  it("bounds PRA at the equipment minimum rather than the patient response", () => {
    let run = pendingEndpoint("PRA");
    for (let i = 0; i < 30; i++) run = stepRelativeAccommodationPower(run, "minus", valid(3000 + i));
    expect(run.powerD).toBe(RELATIVE_HOLDER_MIN_D);
    expect(run.praCapture).toBeNull();
    expect(run.report).toContain("blurred");
    expect(run.feedback).toContain("limit");
  });

  it("keeps recording independent and accepts only both frozen signed readings", () => {
    let run = captureNra();
    for (let i = 0; i < 8; i++) run = stepRelativeAccommodationPower(run, "minus", valid(20 + i));
    run = confirmRelativeAccommodationBaseline(run, valid(30));
    for (let i = 0; i < 9; i++) run = stepRelativeAccommodationPower(run, "minus", valid(40 + i));
    run = sampleRelativeAccommodation(run, valid(40 + 8 + RELATIVE_RESPONSE_MS));
    expect(submitRelativeAccommodationRecord(run, "2", "-2").phase).toBe("captured");
    run = submitRelativeAccommodationRecord(run, "2", "-2.25");
    expect(run.phase).toBe("complete"); expect(run.record).toMatchObject({ submittedNraD: 2, submittedPraD: -2.25 });
  });

  it("guides the zero-baseline transition separately from negative PRA power and blur confirmation", () => {
    let run = prepared();
    expect(relativeAccommodationGuidedStep(run, valid(0)).lines[0]).toContain("toward plus");
    run = pendingEndpoint("NRA");
    expect(relativeAccommodationGuidedStep(run, valid(2100))).toMatchObject({ index: 5, lines: expect.arrayContaining([expect.stringContaining("Hold the power steady")]) });
    run = sampleRelativeAccommodation(run, valid(4000));
    for (let i = 0; i < 8; i++) {
      expect(relativeAccommodationGuidedStep(run, valid(4100 + i)).title).toBe("Return to baseline");
      run = stepRelativeAccommodationPower(run, "minus", valid(4100 + i));
    }
    expect(relativeAccommodationGuidedStep(run, valid(4200)).title).toBe("Confirm clear baseline");
    run = confirmRelativeAccommodationBaseline(run, valid(4300));
    for (let i = 0; i < 9; i++) {
      const coach = relativeAccommodationGuidedStep(run, valid(4400 + i));
      expect(coach.title).toBe("Measure PRA");
      expect(coach.lines[0]).toContain("toward minus");
      run = stepRelativeAccommodationPower(run, "minus", valid(4400 + i));
    }
    expect(relativeAccommodationGuidedStep(run, valid(4500))).toMatchObject({ index: 8, lines: expect.arrayContaining([expect.stringContaining("Hold the power steady")]) });
    run = interruptRelativeAccommodation(run, "Interrupted.");
    run = sampleRelativeAccommodation(run, valid(5000));
    expect(relativeAccommodationGuidedStep(run, valid(5000)).lines[0]).toContain("Hold the power steady");
    expect(relativeAccommodationGuidedStep(run, valid(5000, { holderAligned: false })).index).toBe(2);
  });

  it("keeps completed measurements on recording guidance after the holder is released", () => {
    let run = sampleRelativeAccommodation(pendingEndpoint("PRA"), valid(4000));
    const released = valid(5000, { holderHeld: false, holderAligned: false, correctionFitted: false, targetDocked: false });
    expect(relativeAccommodationGuidedStep(run, released)).toMatchObject({ index: 9, title: "Record NRA and PRA" });
    run = submitRelativeAccommodationRecord(run, "2", "-2.25");
    expect(relativeAccommodationGuidedStep(run, released)).toMatchObject({ index: 9, title: "Series complete" });
  });

  it("exposes coaching and highlights only in Guided mode", () => {
    expect(relativeAccommodationDisclosure("guided")).toEqual({ showCoach: true, showHighlights: true });
    expect(relativeAccommodationDisclosure("test")).toEqual({ showCoach: false, showHighlights: false });
    expect(relativeAccommodationGuidedStep(newRelativeAccommodationRun(), valid(0, { correctionFitted: false })).title).toBe("Fit near correction");
  });
});
