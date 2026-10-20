import { describe, expect, it } from "vitest";
import {
  MADDOX_PRISM_CELLS, MADDOX_PRISM_CELL_Y, MADDOX_TRIALS, armMaddoxReport, cancelMaddoxEntry,
  captureMaddox, enterMaddox, interruptMaddox, maddoxBaseFromRoll, maddoxFittingGuideSocketIds, maddoxGuidedStep, maddoxGrooveCorrect,
  maddoxNearestCell, maddoxPatientReport, maddoxSetupIssue, newMaddoxRun, sampleMaddox, submitMaddox, type MaddoxSpatialSample,
} from "../interaction/maddoxProcedure";

const sample = (overrides: Partial<MaddoxSpatialSample> = {}): MaddoxSpatialSample => ({
  correctionFitted: true, rodFitted: true, grooveDegrees: 0, targetReady: true, targetPowered: true,
  targetSite: "distance", distanceCm: 600, fixationInstruction: true, prismHeld: true, prismForward: true,
  prismAligned: true, cell: 20, base: "BI", tracking: true, ...overrides,
});

function captureTrial(run = newMaddoxRun(), overrides: Partial<MaddoxSpatialSample> = {}) {
  const trial = MADDOX_TRIALS[run.trialIndex];
  const ready = sample({ targetSite: trial.site, distanceCm: trial.site === "near" ? 40 : 600, grooveDegrees: trial.grooveDegrees, base: trial.base, ...overrides });
  let next = armMaddoxReport(run, ready);
  next = sampleMaddox(next, { ...ready, cell: 20 }, 0);
  next = sampleMaddox(next, { ...ready, cell: 20 }, 250);
  next = sampleMaddox(next, { ...ready, cell: trial.neutral }, 300);
  next = sampleMaddox(next, { ...ready, cell: trial.neutral }, 550);
  return captureMaddox(next, { ...ready, cell: trial.neutral });
}

describe("shared Maddox procedure", () => {
  it.each(MADDOX_TRIALS)("conceals the required base in independent $id setup and capture feedback", trial => {
    for (const base of [null, "BI", "BO", "BU", "BD"] as const) {
      if (base === trial.base) continue;
      const wrong = sample({ base, grooveDegrees: trial.grooveDegrees, targetSite: trial.site });
      const run = armMaddoxReport({ ...newMaddoxRun(), trialIndex: MADDOX_TRIALS.indexOf(trial) }, wrong);
      const neutral = maddoxSetupIssue(wrong, trial, "test");
      expect(neutral).toContain("Reassess the base direction");
      expect(neutral).not.toMatch(/\b(BI|BO|BU|BD)\b/);
      expect(maddoxSetupIssue(wrong, trial)).toBe(neutral);
      expect(sampleMaddox(run, wrong, 0, "test").feedback).toBe(neutral);
      expect(captureMaddox(run, wrong, "test").feedback).toBe(neutral);
      const guided = maddoxSetupIssue(wrong, trial, "guided");
      expect(guided).toContain(trial.base);
      expect(sampleMaddox(run, wrong, 0, "guided").feedback).toBe(guided);
      expect(captureMaddox(run, wrong, "guided").feedback).toBe(guided);
      expect(captureMaddox(run, wrong, "test").capture).toBeNull();
    }
  });

  it("keeps captured observations on recording after putting tools down, without skipping the next trial", () => {
    const released = sample({ prismHeld: false, prismAligned: false, correctionFitted: false, targetReady: false, targetPowered: false });
    let run = newMaddoxRun();
    for (let index = 0; index < 4; index++) {
      run = captureTrial(run);
      expect(maddoxGuidedStep(run, released)).toMatchObject({ index: 8, title: "Record independently" });
      if (!run.capture) throw new Error("Expected captured Maddox observation");
      run = submitMaddox(enterMaddox(run, String(run.capture.cell), run.capture.base));
      expect(maddoxGuidedStep(run, released).index).toBe(index === 3 ? 8 : 0);
    }
    expect(maddoxGuidedStep(run, released).complete).toBe(true);
  });
  it("preserves the four authored findings in order", () => {
    expect(MADDOX_TRIALS.map(({ site, axis, neutral, base }) => [site, axis, neutral, base])).toEqual([
      ["distance", "horizontal", 6, "BI"], ["distance", "vertical", 4, "BU"],
      ["near", "horizontal", 6, "BI"], ["near", "vertical", 4, "BU"],
    ]);
  });

  it("shares all rendered cell coordinates with physical selection", () => {
    expect(MADDOX_PRISM_CELLS).toEqual([2, 4, 6, 8, 10, 12, 15, 20]);
    MADDOX_PRISM_CELL_Y.forEach((y, index) => expect(maddoxNearestCell(y)).toBe(MADDOX_PRISM_CELLS[index]));
    expect(maddoxNearestCell(-1)).toBeNull();
  });

  it("accepts only the two rod orientations within 30 degrees and classifies all bases", () => {
    expect(maddoxGrooveCorrect("horizontal", 30)).toBe(true);
    expect(maddoxGrooveCorrect("horizontal", 31)).toBe(false);
    expect(maddoxGrooveCorrect("vertical", 120)).toBe(true);
    expect(maddoxGrooveCorrect("vertical", 45)).toBe(false);
    expect([0, 90, 180, 270].map(maddoxBaseFromRoll)).toEqual(["BI", "BU", "BO", "BD"]);
    expect(maddoxBaseFromRoll(45)).toBeNull();
  });

  it("models correct reduction, opposite-base worsening and wrong-axis response", () => {
    const trial = MADDOX_TRIALS[0];
    expect(maddoxPatientReport(trial, 6, "BI")).toContain("passes through");
    expect(maddoxPatientReport(trial, 6, "BO")).toContain("farther away");
    expect(maddoxPatientReport(trial, 6, "BU")).toContain("does not move");
    let run = armMaddoxReport(newMaddoxRun(), sample());
    run = sampleMaddox(run, sample(), 0); run = sampleMaddox(run, sample(), 250);
    run = sampleMaddox(run, sample({ cell: 6, base: "BO" }), 300);
    run = sampleMaddox(run, sample({ cell: 6, base: "BO" }), 550);
    expect(run.report).toContain("farther away");
    expect(captureMaddox(run, sample({ cell: 6, base: "BO" })).capture).toBeNull();
  });

  it("requires reporting, a stable 20Δ introduction and stable coincidence", () => {
    const ready = sample();
    let run = newMaddoxRun();
    run = sampleMaddox(run, { ...ready, cell: 6 }, 300);
    expect(run.phase).toBe("instruction");
    run = armMaddoxReport(run, ready);
    run = sampleMaddox(run, { ...ready, cell: 6 }, 400);
    expect(run.introduced20).toBe(false);
    run = sampleMaddox(run, ready, 500);
    run = sampleMaddox(run, ready, 750);
    run = sampleMaddox(run, { ...ready, cell: 6 }, 800);
    expect(captureMaddox(run, { ...ready, cell: 6 }).capture).toBeNull();
    run = sampleMaddox(run, { ...ready, cell: 6 }, 1050);
    expect(captureMaddox(run, { ...ready, cell: 6 }).capture).not.toBeNull();
  });

  it.each(["guided", "test"] as const)("rejects a fleeting 20Δ introduction and requires a fresh continuous hold in %s", kind => {
    const ready = sample();
    let run = armMaddoxReport(newMaddoxRun(), ready);
    run = sampleMaddox(run, ready, 0, kind);
    run = sampleMaddox(run, ready, 249, kind);
    expect(run.introduced20).toBe(false);
    expect(run.phase).toBe("introduction");
    run = sampleMaddox(run, sample({ cell: 6 }), 250, kind);
    run = sampleMaddox(run, sample({ cell: 6 }), 600, kind);
    expect(run.introduced20).toBe(false);
    expect(run.stableSinceMs).toBeNull();
    expect(run.feedback).toContain("20Δ cell first");
    expect(captureMaddox(run, sample({ cell: 6 }), kind).capture).toBeNull();
    run = sampleMaddox(run, ready, 700, kind);
    run = sampleMaddox(run, ready, 949, kind);
    expect(run.introduced20).toBe(false);
    run = sampleMaddox(run, ready, 950, kind);
    expect(run.introduced20).toBe(true);
    expect(run.phase).toBe("neutralisation");
    run = sampleMaddox(run, sample({ cell: 6 }), 1000, kind);
    run = sampleMaddox(run, sample({ cell: 6 }), 1250, kind);
    expect(captureMaddox(run, sample({ cell: 6 }), kind).capture).not.toBeNull();
  });

  it.each([{ prismAligned: false }, { tracking: false }, { base: "BO" as const }])("discards an unfinished introduction on invalid setup %j", invalid => {
    let run = armMaddoxReport(newMaddoxRun(), sample());
    run = sampleMaddox(run, sample(), 0);
    run = sampleMaddox(run, sample(invalid), 200);
    expect(run.introduced20).toBe(false);
    expect(run.stableSinceMs).toBeNull();
    run = armMaddoxReport(run, sample());
    run = sampleMaddox(run, sample(), 250);
    run = sampleMaddox(run, sample(), 499);
    expect(run.introduced20).toBe(false);
    run = sampleMaddox(run, sample(), 500);
    expect(run.introduced20).toBe(true);
  });

  it("keeps capture immutable, grades power and base independently, and completes once", () => {
    let run = newMaddoxRun();
    let attemptedWrongBase = false;
    while (run.records.length < 4) {
      run = captureTrial(run);
      expect(Object.isFrozen(run.capture)).toBe(true);
      const wrong = run.trialIndex === 1 && !attemptedWrongBase;
      run = enterMaddox(run, String(run.capture?.cell), wrong ? "BI" : run.capture?.base ?? "");
      run = submitMaddox(run);
      if (wrong) {
        attemptedWrongBase = true;
        expect(run.records).toHaveLength(1);
        run = enterMaddox(run, String(run.capture?.cell), run.capture?.base ?? "");
        run = submitMaddox(run);
      }
    }
    expect(run.records).toHaveLength(4);
    expect(run.phase).toBe("complete");
    expect(submitMaddox(run)).toBe(run);
  });

  it("preserves records while cancellation and interruption reset unfinished work", () => {
    let run = captureTrial();
    run = enterMaddox(run, "6", "BI");
    run = cancelMaddoxEntry(run);
    expect(run.capture).toBeNull(); expect(run.reportInstruction).toBe(false);
    run = captureTrial(run); run = enterMaddox(run, "6", "BI"); run = submitMaddox(run);
    const interrupted = interruptMaddox(armMaddoxReport(run, sample({ grooveDegrees: 90 })), "Tracking was interrupted.");
    expect(interrupted.records).toHaveLength(1); expect(interrupted.introduced20).toBe(false);
  });

  it("derives all nine guided steps and completion from the same state", () => {
    let run = newMaddoxRun();
    const first = maddoxGuidedStep(run, sample({ correctionFitted: false }));
    expect(first.index).toBe(0);
    expect(first.title).toBe("Fit the trial frame");
    expect(maddoxGuidedStep(run, sample({ rodFitted: false })).index).toBe(1);
    const distanceTarget = maddoxGuidedStep(run, sample({ targetReady: false, targetPowered: false, targetSite: null }));
    expect(distanceTarget.title).toBe("Dock the distance target");
    expect(distanceTarget.lines[1]).toContain("DISTANCE TARGET DOCK beside Arun");
    const distancePower = maddoxGuidedStep(run, sample({ targetPowered: false }));
    expect(distancePower.title).toBe("Turn on the distance target");
    expect(distancePower.lines[0]).toContain("highlighted POWER switch");
    const nearTarget = maddoxGuidedStep({ ...run, trialIndex: 2 }, sample({ grooveDegrees: 0, targetReady: false, targetPowered: false, targetSite: null }));
    expect(nearTarget.title).toBe("Position the near penlight");
    expect(nearTarget.lines[1]).toContain("38–42 cm in front of his eyes");
    run = armMaddoxReport(run, sample());
    expect(maddoxGuidedStep(run, sample()).index).toBe(5);
    for (let i = 0; i < 4; i++) { run = captureTrial(run); run = enterMaddox(run, String(run.capture?.cell), run.capture?.base ?? ""); run = submitMaddox(run); }
    expect(maddoxGuidedStep(run, sample()).complete).toBe(true);
  });

  it("shows only the fitting guide required by the current setup step", () => {
    expect(maddoxFittingGuideSocketIds(sample({ correctionFitted: false }), MADDOX_TRIALS[0])).toEqual(["sensory-correction"]);
    expect(maddoxFittingGuideSocketIds(sample({ rodFitted: false }), MADDOX_TRIALS[0])).toEqual(["sensory-maddox-horizontal"]);
    expect(maddoxFittingGuideSocketIds(sample({ grooveDegrees: 0 }), MADDOX_TRIALS[1])).toEqual(["sensory-maddox-vertical"]);
    expect(maddoxFittingGuideSocketIds(sample(), MADDOX_TRIALS[0])).toEqual([]);
  });
});
