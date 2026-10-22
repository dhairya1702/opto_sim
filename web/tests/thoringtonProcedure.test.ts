import { describe, expect, it } from "vitest";
import {
  THORINGTON_CARD_APERTURE_RADIUS_M, THORINGTON_CARD_SPACING_M, THORINGTON_CASES, THORINGTON_SCALE,
  armThoringtonReport, cancelThoringtonEntry, classifyThoringtonCard, enterThorington, interruptThorington,
  newThoringtonRun, nextThoringtonCase, sampleThorington, submitThorington, thoringtonCardCoordinate,
  thoringtonGuidedStep, thoringtonGrooveCorrect, thoringtonLightIntersection, type ThoringtonRun,
  thoringtonTestStatus,
  type ThoringtonSpatialSample,
} from "../interaction/thoringtonProcedure";

const sample = (overrides: Partial<ThoringtonSpatialSample> = {}): ThoringtonSpatialSample => ({
  correctionFitted: true, correctionRevision: 1, rodFitted: true, grooveDegrees: 0, rodFitRevision: 1, cardPresent: true,
  cardHeldOrSupported: true, cardDistanceCm: 40, cardFacing: true, cardUpright: true, penlightHeld: true,
  penlightPowered: true, penlightExaminerSide: true, penlightTowardPatient: true, apertureHit: true,
  fixationInstruction: true, tracking: true, ...overrides,
});

function capture(run = newThoringtonRun(), overrides: Partial<ThoringtonSpatialSample> = {}) {
  const axis = THORINGTON_CASES[run.caseIndex].trials[run.trialIndex].axis;
  const ready = sample({ grooveDegrees: axis === "horizontal" ? 0 : 90, rodFitRevision: run.requiredRodRefitRevision + 1, ...overrides });
  let next = armThoringtonReport(run, ready);
  next = sampleThorington(next, ready, 100);
  next = sampleThorington(next, ready, 350);
  return next;
}

function record(run: ThoringtonRun) {
  const current = THORINGTON_CASES[run.caseIndex].trials[run.trialIndex];
  return submitThorington(enterThorington(run, String(current.magnitude), current.reportedSide, current.interpretation));
}

describe("shared Modified Thorington procedure", () => {
  it("keeps captured reports on transcription after release and requires setup for the next axis", () => {
    const released = sample({ penlightHeld: false, penlightPowered: false, cardPresent: false, cardHeldOrSupported: false, correctionFitted: false });
    let run = capture();
    expect(thoringtonGuidedStep(run, released)).toMatchObject({ index: 9, title: "Transcribe and interpret" });
    run = record(run);
    expect(thoringtonGuidedStep(run, released).index).toBe(0);
    run = capture(run);
    expect(thoringtonGuidedStep(run, released).index).toBe(9);
    run = record(run);
    expect(thoringtonGuidedStep(run, released)).toMatchObject({ index: 9, complete: true });
  });
  it("preserves both authored cases and horizontal-before-vertical order", () => {
    expect(THORINGTON_CASES.map(item => item.trials.map(value => [value.axis, value.signedCoordinate, value.reportedSide, value.interpretation]))).toEqual([
      [["horizontal", 6, "right", "esophoria"], ["vertical", 4, "above", "left-hyperphoria"]],
      [["horizontal", -8, "left", "exophoria"], ["vertical", -3, "below", "right-hyperphoria"]],
    ]);
  });

  it("uses one combined −10…+10 card at uniform 4 mm/Δ and contains every authored number", () => {
    expect(THORINGTON_CARD_SPACING_M).toBe(.004);
    expect(THORINGTON_SCALE).toEqual(Array.from({ length: 21 }, (_, index) => index - 10));
    THORINGTON_SCALE.forEach(value => expect(thoringtonCardCoordinate(value)).toBeCloseTo(value * .004, 8));
    THORINGTON_CASES.flatMap(item => item.trials).forEach(value => expect(THORINGTON_SCALE).toContain(value.signedCoordinate));
  });

  it("classifies the patient-facing surface and upright roll with a 30° tolerance", () => {
    const patient = [0, 1.5, -.5] as const;
    expect(classifyThoringtonCard({ position: [0, 1.5, -.1], patientFacingNormal: [0, 0, -1], up: [0, 1, 0] }, patient)).toMatchObject({ patientFacing: true, upright: true, distanceCm: 40 });
    expect(classifyThoringtonCard({ position: [0, 1.5, -.1], patientFacingNormal: [0, 0, 1], up: [0, 1, 0] }, patient).patientFacing).toBe(false);
    expect(classifyThoringtonCard({ position: [0, 1.5, -.1], patientFacingNormal: [0, 0, -1], up: [1, 0, 0] }, patient).upright).toBe(false);
  });

  it("uses a true ray/plane aperture intersection and rejects wrong side, direction, distance, and the rim", () => {
    const card = { position: [0, 0, 0] as const, patientFacingNormal: [0, 0, -1] as const, up: [0, 1, 0] as const };
    expect(thoringtonLightIntersection(card, { position: [0, 0, .2], direction: [0, 0, -1] }).apertureHit).toBe(true);
    expect(thoringtonLightIntersection(card, { position: [0, 0, -.2], direction: [0, 0, 1] }).examinerSide).toBe(false);
    expect(thoringtonLightIntersection(card, { position: [0, 0, .2], direction: [0, 0, 1] }).towardPatient).toBe(false);
    expect(thoringtonLightIntersection(card, { position: [0, 0, .31], direction: [0, 0, -1] }).withinReach).toBe(false);
    expect(thoringtonLightIntersection(card, { position: [THORINGTON_CARD_APERTURE_RADIUS_M, 0, .2], direction: [0, 0, -1] }).apertureHit).toBe(false);
  });

  it("accepts 38–42 cm, stores the actual distance, and auto-freezes one report after 250 ms", () => {
    for (const cardDistanceCm of [38, 42]) expect(capture(newThoringtonRun(), { cardDistanceCm }).capture?.actualCardDistanceCm).toBe(cardDistanceCm);
    let run = armThoringtonReport(newThoringtonRun(), sample({ cardDistanceCm: 39.4 }));
    run = sampleThorington(run, sample({ cardDistanceCm: 39.4 }), 0);
    expect(sampleThorington(run, sample({ cardDistanceCm: 39.4 }), 249).capture).toBeNull();
    run = sampleThorington(run, sample({ cardDistanceCm: 39.4 }), 250);
    expect(run.capture).toMatchObject({ actualCardDistanceCm: 39.4, signedCoordinate: 6, rawReportedSide: "right", report: "6, right." });
    expect(Object.isFrozen(run.capture)).toBe(true);
    expect(sampleThorington(run, sample({ cardDistanceCm: 41 }), 900)).toBe(run);
  });

  it("resets unfinished dwell on jitter, trigger loss, missed aperture, and tracking interruption", () => {
    for (const change of [{ cardDistanceCm: 37.9 }, { penlightPowered: false }, { apertureHit: false }, { tracking: false }]) {
      let run = armThoringtonReport(newThoringtonRun(), sample());
      run = sampleThorington(run, sample(), 0);
      run = sampleThorington(run, sample(change), 200);
      expect(run.reportInstruction).toBe(false); expect(run.stableSinceMs).toBeNull(); expect(run.capture).toBeNull();
    }
  });

  it("grades magnitude, raw side, and interpretation separately without defaults", () => {
    const captured = capture();
    expect(submitThorington(enterThorington(captured, "", "", "")).records).toHaveLength(0);
    expect(submitThorington(enterThorington(captured, "6", "left", "esophoria")).records).toHaveLength(0);
    expect(submitThorington(enterThorington(captured, "6", "right", "exophoria")).records).toHaveLength(0);
    const recorded = record(captured);
    expect(recorded.records[0]).toMatchObject({ submittedMagnitude: 6, submittedSide: "right", submittedInterpretation: "esophoria" });
  });

  it("requires physical remove/roll/refit before vertical and accepts only socket orientations", () => {
    expect(thoringtonGrooveCorrect("horizontal", 30)).toBe(true); expect(thoringtonGrooveCorrect("horizontal", 31)).toBe(false);
    expect(thoringtonGrooveCorrect("vertical", 120)).toBe(true); expect(thoringtonGrooveCorrect("vertical", 45)).toBe(false);
    let run = record(capture());
    expect(run.trialIndex).toBe(1);
    const stale = sample({ grooveDegrees: 90, rodFitRevision: run.requiredRodRefitRevision });
    expect(armThoringtonReport(run, stale).reportInstruction).toBe(false);
    expect(capture(run, { grooveDegrees: 90, rodFitRevision: run.requiredRodRefitRevision + 1 }).capture?.axis).toBe("vertical");
  });

  it("preserves recorded trials across cancellation and interruption while setup revision clears unrecorded capture", () => {
    let run = record(capture());
    run = capture(run, { grooveDegrees: 90, rodFitRevision: run.requiredRodRefitRevision + 1 });
    expect(cancelThoringtonEntry(run).records).toHaveLength(1);
    expect(interruptThorington(cancelThoringtonEntry(run), "Teleport interrupted.").records).toHaveLength(1);
    const horizontal = capture();
    expect(sampleThorington(horizontal, sample({ rodFitted: false, grooveDegrees: null }), 500).capture).toBeNull();
    expect(sampleThorington(horizontal, sample({ correctionRevision: (horizontal.capture?.correctionRevision ?? 0) + 1 }), 500).capture).toBeNull();
    expect(sampleThorington(horizontal, sample({ rodFitRevision: horizontal.capture?.rodFitRevision ?? 0, cardPresent: false, cardHeldOrSupported: false, penlightHeld: false, penlightPowered: false }), 500)).toBe(horizontal);
  });

  it("completes once, rejects duplicate submission, and offers the other case without losing the completion flag", () => {
    let run = record(capture());
    run = record(capture(run, { grooveDegrees: 90, rodFitRevision: run.requiredRodRefitRevision + 1 }));
    expect(run.phase).toBe("complete"); expect(run.completionAwarded).toBe(true); expect(run.records).toHaveLength(2);
    expect(submitThorington(run)).toBe(run);
    const repeated = nextThoringtonCase(run);
    expect(repeated.caseIndex).toBe(1); expect(repeated.completionAwarded).toBe(true); expect(repeated.records).toHaveLength(0);
  });

  it("derives all ten Guided steps from procedure state", () => {
    const valid = sample();
    const states: [ThoringtonRun, ThoringtonSpatialSample][] = [
      [newThoringtonRun(), sample({ correctionFitted: false })], [newThoringtonRun(), sample({ rodFitted: false })],
      [newThoringtonRun(), sample({ grooveDegrees: 90 })], [newThoringtonRun(), sample({ cardPresent: false, cardHeldOrSupported: false })],
      [newThoringtonRun(), sample({ cardDistanceCm: 35 })], [newThoringtonRun(), sample({ penlightHeld: false, penlightPowered: false })],
      [newThoringtonRun(), valid],
    ];
    let armed = armThoringtonReport(newThoringtonRun(), valid); states.push([armed, valid]);
    armed = sampleThorington(armed, valid, 0); states.push([armed, valid]);
    const captured = sampleThorington(armed, valid, 250); states.push([captured, valid]);
    expect(states.map(([run, value]) => thoringtonGuidedStep(run, value).index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });
  it("provides neutral independent-Test categories without authored answers", () => {
    expect(thoringtonTestStatus(newThoringtonRun(), sample({ correctionFitted: false }))).toBe("Correction setup is incomplete.");
    expect(thoringtonTestStatus(newThoringtonRun(), sample({ grooveDegrees: 90 }))).toBe("Groove direction is not ready.");
    expect(thoringtonTestStatus(newThoringtonRun(), sample({ apertureHit: false }))).toBe("Aperture aim is not ready.");
    expect(thoringtonTestStatus(newThoringtonRun(), sample())).not.toMatch(/6|right|esophoria/i);
  });
});

it("does not restart valid stability when the reporting instruction is repeated", () => {
  let run = sampleThorington(armThoringtonReport(newThoringtonRun(), sample()), sample(), 100);
  expect(armThoringtonReport(run, sample())).toBe(run);
  run = sampleThorington(run, sample(), 350);
  expect(run.capture).not.toBeNull();
});
