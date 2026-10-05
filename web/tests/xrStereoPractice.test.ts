import { describe, expect, it } from "vitest";
import { CLINIC_EYE_MIDPOINT } from "../interaction/clinicPatient";
import { stereoPatientReply, stereoPracticeLevels } from "../interaction/stereoPractice";
import {
  confirmXRStereoReply, initialXRStereoRun, interruptXRStereoRun, nextXRStereoPage, requestXRStereoReply,
  resolveXRStereoReply, reviseXRStereoSetup, xrStereoEntryCorrect, xrStereoGeometry,
} from "../interaction/xrStereoPractice";

describe("shared-clinic stereo practice", () => {
  it("uses actual patient-relative 38/42 cm boundaries and a patient-facing booklet", () => {
    for (const cm of [38, 40, 42]) {
      expect(xrStereoGeometry([0, 1.5, CLINIC_EYE_MIDPOINT[2] + cm / 100], [0, 0, -1]).ready).toBe(true);
    }
    for (const cm of [37.999, 42.001]) {
      expect(xrStereoGeometry([0, 1.5, CLINIC_EYE_MIDPOINT[2] + cm / 100], [0, 0, -1]).ready).toBe(false);
    }
    const point = [0, 1.5, CLINIC_EYE_MIDPOINT[2] + .40] as const;
    expect(xrStereoGeometry(point, [0, 0, 1]).ready).toBe(false);
    expect(xrStereoGeometry(point, [0, 0, 0]).ready).toBe(false);
    expect(xrStereoGeometry([0, 1.5, CLINIC_EYE_MIDPOINT[2] - .40], [0, 0, 1]).ready).toBe(false);
  });
  it("allows one pending reply and no page turn before a matching named-circle confirmation", () => {
    const empty = initialXRStereoRun();
    expect(requestXRStereoReply(empty, false)).toBe(empty);
    let run = requestXRStereoReply(empty, true);
    expect(requestXRStereoReply(run, true)).toBe(run);
    expect(nextXRStereoPage(run, true)).toBe(run);
    const token = run.pending!;
    run = resolveXRStereoReply(run, token, true);
    expect(run.reply).toEqual(stereoPatientReply(0));
    expect(confirmXRStereoReply(run, 0, true, 40)).toBe(run);
    expect(nextXRStereoPage(run, true)).toBe(run);
    run = confirmXRStereoReply(run, 1, true, 40);
    expect(confirmXRStereoReply(run, 1, true, 40)).toBe(run);
    expect(nextXRStereoPage(run, false)).toBe(run);
    expect(nextXRStereoPage(run, true).page).toBe(1);
  });
  it("preserves six authored reports, stops after the two patient errors, and independently validates last correct entry", () => {
    let run = initialXRStereoRun(7, 12, 4);
    for (let page = 0; page < stereoPracticeLevels.length; page++) {
      run = requestXRStereoReply(run, true);
      run = resolveXRStereoReply(run, run.pending!, true);
      expect(run.reply).toEqual(stereoPatientReply(page));
      if (page >= 4) {
        expect(confirmXRStereoReply(run, run.reply!.target, true, 39.7)).toBe(run);
      }
      run = confirmXRStereoReply(run, run.reply!.selected, true, 39.7);
      expect(Boolean(run.capture)).toBe(page === 5);
      if (page < 5) run = nextXRStereoPage(run, true);
    }
    expect(run.capture?.lastCorrect).toBe(100);
    expect(run.capture?.distanceCm).toBe(39.7);
    expect(run.capture?.attempt).toBe(7);
    expect(run.capture?.setupRevision).toBe(4);
    expect(run.capture?.replies.map(reply => reply.correct)).toEqual([true, true, true, true, false, false]);
    expect(Object.isFrozen(run.capture)).toBe(true);
    expect(Object.isFrozen(run.capture?.replies)).toBe(true);
    expect(Object.isFrozen(run.capture?.replies[0])).toBe(true);
    expect(nextXRStereoPage(run, true)).toBe(run);
    expect(requestXRStereoReply(run, true)).toBe(run);
    expect(xrStereoEntryCorrect(run.capture, "")).toBe(false);
    expect(xrStereoEntryCorrect(run.capture, "60")).toBe(false);
    expect(xrStereoEntryCorrect(run.capture, "100")).toBe(true);
    expect(interruptXRStereoRun(run)).toBe(run);
    expect(reviseXRStereoSetup(run).capture).toBeNull();
  });
  it("ignores delayed replies after geometry interruption, setup change, page change, reset or exit", () => {
    const pending = requestXRStereoReply(initialXRStereoRun(3), true), token = pending.pending!;
    for (const invalidated of [interruptXRStereoRun(pending), reviseXRStereoSetup(pending), initialXRStereoRun(4), initialXRStereoRun(3, 1)]) {
      expect(resolveXRStereoReply(invalidated, token, true)).toBe(invalidated);
    }
    expect(resolveXRStereoReply(pending, token, false)).toBe(pending);
    const answered = resolveXRStereoReply(pending, token, true);
    expect(resolveXRStereoReply(answered, token, true)).toBe(answered);
    const confirmed = confirmXRStereoReply(answered, answered.reply!.selected, true, 40);
    const next = nextXRStereoPage(confirmed, true);
    expect(resolveXRStereoReply(next, token, true)).toBe(next);
    expect(interruptXRStereoRun(confirmed).replies).toEqual([]);
    expect(xrStereoEntryCorrect(null, "100")).toBe(false);
  });
});
