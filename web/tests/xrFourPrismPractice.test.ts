import { describe, expect, it } from "vitest";
import { advanceFourPrismSequence, captureFourPrism, clinicFourPrismGaze, emptyFourPrismSequence, fourPrismSubmission, xrFourPrismView } from "../interaction/xrFourPrismPractice";
import type { ToolPoint } from "../interaction/xrConsultationTools";
const od: ToolPoint = [-.048, 1.5, -.48], os: ToolPoint = [.048, 1.5, -.48], away: ToolPoint = [.4, 1.5, -.48];
const input = { position: od, forward: [0, 0, -1] as ToolPoint, correction: true, fixation: true, power: 4, base: "BO", view: true, dtMs: 100 };
const dwell = (state = emptyFourPrismSequence(), position = od) => {
  for (let i = 0; i < 24; i++) state = advanceFourPrismSequence(state, { ...input, position });
  return state;
};
describe("canonical XR 4Δ base-out technique", () => {
  it("requires OD first, complete dwell and actual withdrawal before OS", () => {
    expect(dwell(undefined, os).observed).toEqual([]);
    const first = dwell(); expect(first.observed).toEqual(["OD"]);
    expect(dwell(first, os).observed).toEqual(["OD"]);
    const withdrawn = advanceFourPrismSequence(first, { ...input, position: away });
    const complete = dwell(withdrawn, os); expect(complete.observed).toEqual(["OD", "OS"]);
    expect(dwell(complete, os)).toBe(complete);
    expect(advanceFourPrismSequence(complete, { ...input, power: 3 })).toEqual(emptyFourPrismSequence());
    const capture = captureFourPrism(complete, "normal", 1, 2);
    expect(capture).toMatchObject({ attempt: 1, revision: 2, observed: ["OD", "OS"] });
    expect(fourPrismSubmission(capture, "")).toBeNull(); expect(fourPrismSubmission(capture, "suppression")).toBe(false);
    expect(fourPrismSubmission(capture, "normal")).toBe(true);
  });
  it("resets unfinished dwell on view/pose interruption and clears comparison on settings", () => {
    let state = advanceFourPrismSequence(emptyFourPrismSequence(), input);
    expect(state.dwellMs).toBe(100);
    for (const change of [{ view: false }, { position: null }, { forward: [0, 0, 1] as ToolPoint }, { forward: [1, 0, 0] as ToolPoint }]) {
      expect(advanceFourPrismSequence(state, { ...input, ...change }).dwellMs).toBe(0);
    }
    state = dwell();
    for (const change of [{ power: 3 }, { power: 5 }, { base: "BI" }, { correction: false }, { fixation: false }]) {
      expect(advanceFourPrismSequence(state, { ...input, ...change })).toEqual(emptyFourPrismSequence());
    }
    expect(captureFourPrism(state, "normal", 0, 0)).toBeNull();
  });
  it("preserves the authored gaze timeline for both scenarios at patient scale", () => {
    expect(clinicFourPrismGaze("OD", "normal", 299)).toEqual({ od: 0, os: 0 });
    expect(clinicFourPrismGaze("OD", "normal", 300)).toEqual({ od: .012, os: .012 });
    expect(clinicFourPrismGaze("OD", "normal", 1200)).toEqual({ od: .012, os: 0 });
    expect(clinicFourPrismGaze("OS", "normal", 1200)).toEqual({ od: 0, os: -.012 });
    expect(clinicFourPrismGaze("OD", "suppression", 2400)).toEqual({ od: .012, os: .012 });
    expect(clinicFourPrismGaze("OS", "suppression", 2400)).toEqual({ od: 0, os: 0 });
  });
  it("requires a patient-facing examiner view with unobstructed frontal geometry", () => {
    expect(xrFourPrismView([0, 1.5, .5], [0, 0, -1])).toBe(true);
    expect(xrFourPrismView([0, 1.5, .5], [0, 0, 1])).toBe(false);
    expect(xrFourPrismView([1, 1.5, -.573], [-1, 0, 0])).toBe(false);
    expect(xrFourPrismView([0, 1.5, -.5], [0, 0, -1])).toBe(false);
  });
});
