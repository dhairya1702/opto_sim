import { describe, expect, it } from "vitest";
import {
  RELATIVE_RESPONSE_MS, confirmRelativeAccommodationBaseline, confirmRelativeAccommodationInitialClear,
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

  it("restarts all evidence when correction or supported-target conditions change", () => {
    const run = restartRelativeAccommodationConditions(captureNra(), "The target changed.");
    expect(run.nraCapture).toBeNull(); expect(run.powerD).toBe(0); expect(run.phase).toBe("setup");
  });

  it("rejects no-op and wrong-phase dial directions with actionable feedback", () => {
    let run = prepared();
    run = stepRelativeAccommodationPower(run, "minus", valid(0));
    expect(run.powerD).toBe(0); expect(run.feedback).toContain("adding plus");
    for (let i = 0; i < 8; i++) run = stepRelativeAccommodationPower(run, "plus", valid(i));
    const limited = stepRelativeAccommodationPower(run, "plus", valid(9));
    expect(limited.powerD).toBe(2); expect(limited.feedback).toContain("limit");
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

  it("exposes coaching and highlights only in Guided mode", () => {
    expect(relativeAccommodationDisclosure("guided")).toEqual({ showCoach: true, showHighlights: true });
    expect(relativeAccommodationDisclosure("test")).toEqual({ showCoach: false, showHighlights: false });
    expect(relativeAccommodationGuidedStep(newRelativeAccommodationRun(), valid(0, { correctionFitted: false })).title).toBe("Fit near correction");
  });
});
