import { describe, expect, it } from "vitest";
import { CLINIC_EYE_MIDPOINT } from "../interaction/clinicPatient";
import { stereoPatientReply, stereoPracticeLevels, stereoTargets } from "../interaction/stereoPractice";
import {
  STEREO_GUIDED_STEP_COUNT, fixateXRStereoPage, initialXRStereoRun,
  interruptXRStereoRun, markXRStereoResponse, nextXRStereoPage, requestXRStereoReply,
  recordXRStereoResponse, resolveXRStereoReply, reviseXRStereoSetup, stereoCircleNames, stereoGuidedStep,
  xrStereoEntryCorrect, xrStereoGeometry, type XRStereoRun,
} from "../interaction/xrStereoPractice";

const answerPage = (run: XRStereoRun, distance = 40) => {
  let next = fixateXRStereoPage(run, true);
  next = requestXRStereoReply(next, true);
  const reply = next.reply;
  if (!reply) throw new Error("Missing authored stereo response");
  return recordXRStereoResponse(next, stereoCircleNames[reply.selected], true, distance);
};

describe("shared stereopsis procedure", () => {
  it("keeps the authored sequence, page keys and exact 38–42 cm geometry", () => {
    expect(STEREO_GUIDED_STEP_COUNT).toBe(9);
    expect(stereoPracticeLevels).toEqual([800, 400, 200, 100, 60, 40]);
    expect(stereoTargets.map(index => stereoCircleNames[index])).toEqual(["middle", "left", "right", "middle", "right", "left"]);
    for (const cm of [38, 40, 42]) {
      expect(xrStereoGeometry([0, 1.5, CLINIC_EYE_MIDPOINT[2] + cm / 100], [0, 0, -1]).ready).toBe(true);
    }
    for (const cm of [37.999, 42.001]) {
      expect(xrStereoGeometry([0, 1.5, CLINIC_EYE_MIDPOINT[2] + cm / 100], [0, 0, -1]).ready).toBe(false);
    }
    const point = [0, 1.5, CLINIC_EYE_MIDPOINT[2] + .40] as const;
    expect(xrStereoGeometry(point, [0, 0, 1]).ready).toBe(false);
    expect(xrStereoGeometry([.11, 1.5, point[2]], [0, 0, -1]).ready).toBe(false);
  });

  it("requires current-page fixation and captures the authored response synchronously and immutably", () => {
    const empty = initialXRStereoRun();
    expect(requestXRStereoReply(empty, true)).toBe(empty);
    const fixed = fixateXRStereoPage(empty, true);
    expect(fixed.fixation?.page).toBe(0);
    const answered = requestXRStereoReply(fixed, true);
    expect(answered.reply).toEqual(stereoPatientReply(0));
    expect(Object.isFrozen(answered.reply)).toBe(true);
    expect(requestXRStereoReply(answered, true)).toBe(answered);
    expect(resolveXRStereoReply(answered, { stale: true }, false)).toBe(answered);
  });

  it("validates transcription and derives classification from the page key", () => {
    let run = requestXRStereoReply(fixateXRStereoPage(initialXRStereoRun(), true), true);
    expect(recordXRStereoResponse(run, "left", true, 40)).toBe(run);
    run = recordXRStereoResponse(run, "middle", true, 40);
    expect(run.markedCircle).toBe("middle");
    expect(run.records[0]).toMatchObject({ page: 0, level: 800, targetCircle: "middle", reportedCircle: "middle", markedCircle: "middle", classification: "correct", derivedCorrect: true, distanceCm: 40, geometryValid: true });
    expect(Object.isFrozen(run.records[0])).toBe(true);
    expect(nextXRStereoPage(run, false)).toBe(run);
    const next = nextXRStereoPage(run, true);
    expect(next.page).toBe(1);
    expect(next.fixation).toBeNull();
    expect(requestXRStereoReply(next, true)).toBe(next);
  });

  it("stops only after two consecutive errors and captures 100 arcsec independently", () => {
    let run = initialXRStereoRun(7, 12, 4);
    for (let page = 0; page < stereoPracticeLevels.length; page++) {
      run = answerPage(run, 39.7);
      expect(Boolean(run.capture)).toBe(page === 5);
      if (page < 5) run = nextXRStereoPage(run, true);
    }
    expect(run.capture?.lastCorrect).toBe(100);
    expect(run.capture?.records.map(record => record.derivedCorrect)).toEqual([true, true, true, true, false, false]);
    expect(run.capture?.distanceCm).toBe(39.7);
    expect(run.capture?.attempt).toBe(7);
    expect(run.capture?.setupRevision).toBe(4);
    expect(Object.isFrozen(run.capture)).toBe(true);
    expect(Object.isFrozen(run.capture?.records)).toBe(true);
    expect(xrStereoEntryCorrect(run.capture, "")).toBe(false);
    expect(xrStereoEntryCorrect(run.capture, "60")).toBe(false);
    expect(xrStereoEntryCorrect(run.capture, "100")).toBe(true);
  });

  it("preserves confirmed pages while cancelling only an unfinished interrupted page", () => {
    let run = answerPage(initialXRStereoRun());
    run = nextXRStereoPage(run, true);
    run = requestXRStereoReply(fixateXRStereoPage(run, true), true);
    const interrupted = interruptXRStereoRun(run);
    expect(interrupted.page).toBe(1);
    expect(interrupted.records).toEqual(run.records);
    expect(interrupted.reply).toBeNull();
    expect(interrupted.fixation).toBeNull();
    expect(interrupted.confirmed).toBe(false);
    expect(requestXRStereoReply(interrupted, true)).toBe(interrupted);
    const refixed = fixateXRStereoPage(interrupted, true);
    expect(refixed.fixationRevision).toBeGreaterThan(run.fixationRevision);
  });

  it("restarts on fitted-equipment revision but lets a completed capture survive release or movement", () => {
    let run = initialXRStereoRun();
    for (let page = 0; page < 6; page++) {
      run = answerPage(run);
      if (page < 5) run = nextXRStereoPage(run, true);
    }
    expect(interruptXRStereoRun(run)).toBe(run);
    const revised = reviseXRStereoSetup(run);
    expect(revised.capture).toBeNull();
    expect(revised.records).toEqual([]);
    expect(revised.setupRevision).toBe(run.setupRevision + 1);
  });

  it("derives all nine Guided states without timer or audio progression", () => {
    const base = { correctionFitted: false, filtersFitted: false, bookletHandled: false, bookletSupported: false,
      geometryReady: false, distanceCm: 32, facing: true, tracking: true, run: initialXRStereoRun() };
    expect(stereoGuidedStep(base).id).toBe("fit-correction");
    expect(stereoGuidedStep({ ...base, correctionFitted: true }).id).toBe("fit-polarised");
    expect(stereoGuidedStep({ ...base, correctionFitted: true, filtersFitted: true }).id).toBe("pickup-booklet");
    expect(stereoGuidedStep({ ...base, correctionFitted: true, filtersFitted: true, bookletHandled: true }).id).toBe("position-booklet");
    const positioned = { ...base, correctionFitted: true, filtersFitted: true, bookletHandled: true, geometryReady: true, distanceCm: 40 };
    expect(stereoGuidedStep(positioned).id).toBe("establish-fixation");
    const fixed = fixateXRStereoPage(positioned.run, true);
    expect(stereoGuidedStep({ ...positioned, run: fixed }).id).toBe("present-ask");
    const answered = requestXRStereoReply(fixed, true);
    expect(stereoGuidedStep({ ...positioned, run: answered }).id).toBe("mark-response");
    const marked = markXRStereoResponse(answered, "middle", true);
    expect(stereoGuidedStep({ ...positioned, run: marked }).id).toBe("compare-response");
    expect(stereoGuidedStep({ ...positioned, run: recordXRStereoResponse(answered, "middle", true, 40) }).id).toBe("turn-page");
  });
});
