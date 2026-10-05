import { fourPrismResponse } from "./sensory";
import { CLINIC_EYE_MIDPOINT } from "./clinicPatient";
import { prismObservationMs, fourPrismGaze, type PrismCase, type PrismEye } from "./fourPrism";
import { xrPracticeCoverPosition, xrPracticeEyePlacement } from "./xrPracticeBatch";
import type { ToolPoint } from "./xrConsultationTools";

export type FourPrismSequence = { observed: readonly PrismEye[]; withdrawn: boolean; eye: PrismEye | null; dwellMs: number };
export const emptyFourPrismSequence = (): FourPrismSequence => ({ observed: [], withdrawn: false, eye: null, dwellMs: 0 });
export function xrFourPrismView(position: ToolPoint, forward: ToolPoint) {
  const delta = CLINIC_EYE_MIDPOINT.map((value, i) => value - position[i]);
  const length = Math.hypot(...delta), look = Math.hypot(...forward);
  return length >= .25 && length <= 1.5 && position[2] > CLINIC_EYE_MIDPOINT[2]
    && look > 0 && delta.reduce((sum, value, i) => sum + value * forward[i], 0) / (length * look) > Math.cos(25 * Math.PI / 180);
}
export function advanceFourPrismSequence(state: FourPrismSequence, input: {
  position: ToolPoint | null; forward: ToolPoint; correction: boolean; fixation: boolean;
  power: number; base: string; view: boolean; dtMs: number;
}): FourPrismSequence {
  if (!input.correction || !input.fixation || input.power !== 4 || input.base !== "BO") return emptyFourPrismSequence();
  if (state.observed.length === 2) return state;
  const eye = input.position && xrPracticeEyePlacement(input.position, input.forward, true);
  const away = input.position && xrPracticeCoverPosition(input.position, input.forward) === "away";
  const withdrawn = state.withdrawn || state.observed.length === 1 && Boolean(away);
  const expected = state.observed.length ? "OS" : "OD";
  // The working face must face the patient; the existing placement check also bounds tilt.
  if (!eye || eye !== expected || input.forward[2] >= 0 || !input.view || expected === "OS" && !withdrawn) {
    return { ...state, withdrawn, eye: null, dwellMs: 0 };
  }
  const dwellMs = (state.eye === eye ? state.dwellMs : 0) + Math.max(0, Math.min(100, input.dtMs));
  if (dwellMs < prismObservationMs) return { ...state, withdrawn, eye, dwellMs };
  return { observed: [...state.observed, eye], withdrawn, eye: null, dwellMs: 0 };
}
export type FourPrismCapture = Readonly<{ attempt: number; revision: number; scenario: PrismCase; observed: readonly PrismEye[]; reports: readonly string[] }>;
export function captureFourPrism(sequence: FourPrismSequence, scenario: PrismCase, attempt: number, revision: number): FourPrismCapture | null {
  return sequence.observed.join(",") === "OD,OS" ? Object.freeze({ attempt, revision, scenario, observed: Object.freeze([...sequence.observed]), reports: Object.freeze(sequence.observed.map(eye => `${eye}: ${fourPrismResponse(scenario, eye)}`)) }) : null;
}
export function fourPrismSubmission(capture: FourPrismCapture | null, answer: string): boolean | null {
  return !capture || !["normal", "suppression"].includes(answer) ? null : answer === capture.scenario;
}
/** Preserve the authored timeline; scale desktop eye offsets to the canonical patient. */
export function clinicFourPrismGaze(eye: PrismEye, scenario: PrismCase, elapsed: number) {
  const gaze = fourPrismGaze(eye, scenario, elapsed);
  return { od: gaze.od * .012 / .035, os: gaze.os * .012 / .035 };
}
