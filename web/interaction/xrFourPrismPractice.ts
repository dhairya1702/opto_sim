import { CLINIC_EYE_MIDPOINT } from "./clinicPatient";
import { prismObservationMs, fourPrismGaze, type PrismCase, type PrismEye } from "./fourPrism";
import { xrPracticeCoverPosition } from "./xrPracticeBatch";
import type { ToolPoint } from "./xrConsultationTools";

export const FOUR_PRISM_GUIDED_STEP_COUNT = 10;
export const FOUR_PRISM_BO_ROLL_TOLERANCE_RAD = 20 * Math.PI / 180;
export const FOUR_PRISM_MAX_FRAME_SAMPLE_MS = 100;

export type FourPrismObservation = "version-with-refixation" | "version-without-refixation" | "no-movement";
export type FourPrismPhase = "fitting" | "fixation" | "pickup" | "orient-od" | "observe-od" | "withdraw" | "orient-os" | "observe-os" | "record" | "interpret" | "complete" | "inactive";
export type FourPrismSample = Readonly<{
  trackingValid: boolean; examinerViewValid: boolean; correctionRevision: number; fixationRevision: number;
  prismToolRevision: number; prismHeld: boolean; position: ToolPoint | null; forward: ToolPoint; baseAxis: ToolPoint;
  detectedEye: PrismEye | null; boAlignmentErrorRad: number; sampledDurationMs: number;
}>;
export type FourPrismEyeCapture = Readonly<{
  eye: PrismEye; authoredObservation: FourPrismObservation; observedDurationMs: number; position: ToolPoint;
  forward: ToolPoint; baseAxis: ToolPoint; boAlignmentErrorRad: number; correctionRevision: number;
  fixationRevision: number; setupRevision: number; prismToolRevision: number; trackingValid: true; examinerViewValid: true;
}>;
export type FourPrismEyeRecord = Readonly<{ capture: FourPrismEyeCapture; learnerObservation: FourPrismObservation; transcriptionCorrect: boolean }>;
export type FourPrismRunCapture = Readonly<{
  records: readonly [FourPrismEyeRecord, FourPrismEyeRecord]; scenario: PrismCase; attempt: number; generation: number;
  setupRevision: number; withdrawalConfirmed: true; noEyeUnfinished: true;
}>;
export type FourPrismRunState = Readonly<{
  scenario: PrismCase; attempt: number; generation: number; active: boolean; fitted: boolean; targetOn: boolean; correctionRevision: number;
  fixationRevision: number; fixationSetupRevision: number | null; setupRevision: number; prismToolRevision: number;
  prismHandled: boolean; phase: FourPrismPhase; expectedEye: PrismEye; dwellMs: number; currentEye: PrismEye | null;
  withdrawalConfirmed: boolean; eyeCaptures: Readonly<Partial<Record<PrismEye, FourPrismEyeCapture>>>;
  markings: Readonly<Partial<Record<PrismEye, FourPrismObservation>>>; eyeRecords: Readonly<Partial<Record<PrismEye, FourPrismEyeRecord>>>;
  completedRun: FourPrismRunCapture | null; interpretation: PrismCase | null; interpretationCorrect: boolean | null;
  recorded: boolean; notice: string;
}>;
export type FourPrismGuidedState = Pick<FourPrismRunState, "fitted" | "targetOn" | "fixationSetupRevision" | "prismHandled" | "phase" | "eyeCaptures" | "eyeRecords" | "completedRun" | "recorded">;
export type FourPrismGuidedStep = Readonly<{ id: string; index: number; title: string; lines: readonly string[]; complete: boolean }>;

const freezePoint = (point: ToolPoint) => Object.freeze([...point]) as unknown as ToolPoint;
const immutable = <T extends object>(value: T) => Object.freeze(value);
const freezeState = (value: FourPrismRunState): FourPrismRunState => Object.freeze(value);
const validFixation = (state: FourPrismRunState) => state.targetOn && state.fixationSetupRevision === state.setupRevision;

export function authoredFourPrismObservation(scenario: PrismCase, eye: PrismEye): FourPrismObservation {
  if (scenario === "normal") return "version-with-refixation";
  return eye === "OD" ? "version-without-refixation" : "no-movement";
}
export function fourPrismObservationLabel(observation: FourPrismObservation) {
  return ({ "version-with-refixation": "version with refixation", "version-without-refixation": "version without refixation", "no-movement": "no movement" } as const)[observation];
}
export function initialFourPrismRun(scenario: PrismCase = "normal", attempt = 0, generation = 0): FourPrismRunState {
  return freezeState({ scenario, attempt, generation, active: true, fitted: false, targetOn: false, correctionRevision: 0, fixationRevision: 0,
    fixationSetupRevision: null, setupRevision: 0, prismToolRevision: 0, prismHandled: false, phase: "fitting", expectedEye: "OD",
    dwellMs: 0, currentEye: null, withdrawalConfirmed: false, eyeCaptures: immutable({}), markings: immutable({}),
    eyeRecords: immutable({}), completedRun: null, interpretation: null, interpretationCorrect: null, recorded: false, notice: "" });
}
function restartComparison(state: FourPrismRunState, patch: Partial<FourPrismRunState>, notice: string): FourPrismRunState {
  const fitted = patch.fitted ?? state.fitted;
  return freezeState({ ...state, ...patch, setupRevision: state.setupRevision + 1, fixationSetupRevision: null,
    phase: fitted ? "fixation" : "fitting", expectedEye: "OD", dwellMs: 0, currentEye: null, withdrawalConfirmed: false,
    eyeCaptures: immutable({}), markings: immutable({}), eyeRecords: immutable({}), completedRun: null,
    interpretation: null, interpretationCorrect: null, recorded: false, notice });
}
export function reviseFourPrismFitting(state: FourPrismRunState, fitted: boolean, correctionRevision = state.correctionRevision + 1) {
  if (!state.active || state.recorded || state.fitted === fitted && state.correctionRevision === correctionRevision) return state;
  const progressed = state.fixationSetupRevision !== null || Object.keys(state.eyeCaptures).length > 0 || state.dwellMs > 0;
  return restartComparison(state, { fitted, correctionRevision }, progressed ? "Correction changed—the bilateral comparison restarted." : "");
}
/** Power changes never grant fixation; switching off invalidates the comparison. */
export function setFourPrismTargetPower(state: FourPrismRunState, powered: boolean) {
  if (!state.active || !state.fitted || state.recorded || state.targetOn === powered) return state;
  return powered ? freezeState({ ...state, targetOn: true, notice: "" })
    : restartComparison(state, { targetOn: false }, "Distance target switched off. Restart the comparison.");
}
/** Explicitly present the fixation target; never creates fixation or observation credit. */
export function presentFourPrismTarget(state: FourPrismRunState) {
  if (!state.active || !state.fitted || state.recorded || state.targetOn) return state;
  return setFourPrismTargetPower(state, true);
}
export function establishFourPrismFixation(state: FourPrismRunState) {
  if (!state.active || !state.fitted || !state.targetOn || state.recorded || validFixation(state)) return state;
  const phase: FourPrismPhase = state.eyeCaptures.OD
    ? state.eyeCaptures.OS ? "record" : state.withdrawalConfirmed ? "orient-os" : "withdraw"
    : state.prismHandled ? "orient-od" : "pickup";
  return freezeState({ ...state, fixationRevision: state.fixationRevision + 1, fixationSetupRevision: state.setupRevision,
    phase, notice: "Arun: Okay, I’m looking at the letter and keeping it single." });
}
export function clearFourPrismFixation(state: FourPrismRunState) {
  if (!state.active || state.fixationSetupRevision === null) return state;
  return restartComparison(state, {}, "Fixation was cleared—the bilateral comparison restarted.");
}
export function handleFourPrismTool(state: FourPrismRunState, held: boolean, prismToolRevision = state.prismToolRevision) {
  if (!state.active || state.recorded) return state;
  const prismHandled = state.prismHandled || held;
  const phase = !state.completedRun && held && validFixation(state) && state.phase === "pickup" ? "orient-od" : state.phase;
  const next = prismHandled === state.prismHandled && prismToolRevision === state.prismToolRevision && phase === state.phase
    ? state : freezeState({ ...state, prismHandled, prismToolRevision, phase });
  return state.completedRun || held ? next : interruptFourPrismEye(next, false);
}
export function fourPrismTemporalBaseAxis(eye: PrismEye): ToolPoint { return eye === "OD" ? [-1, 0, 0] : [1, 0, 0]; }
export function fourPrismBaseAlignmentError(baseAxis: ToolPoint, eye: PrismEye) {
  const target = fourPrismTemporalBaseAxis(eye), length = Math.hypot(...baseAxis);
  if (!length) return Infinity;
  return Math.acos(Math.max(-1, Math.min(1, baseAxis.reduce((sum, value, index) => sum + value * target[index], 0) / length)));
}
export function xrFourPrismView(position: ToolPoint, forward: ToolPoint) {
  const delta = CLINIC_EYE_MIDPOINT.map((value, i) => value - position[i]);
  const length = Math.hypot(...delta), look = Math.hypot(...forward);
  return length >= .25 && length <= 1.5 && position[2] > CLINIC_EYE_MIDPOINT[2] && look > 0
    && delta.reduce((sum, value, i) => sum + value * forward[i], 0) / (length * look) > Math.cos(25 * Math.PI / 180);
}
export type FourPrismTechnique = Readonly<{ valid: boolean; reason: "tracking" | "fitting" | "fixation" | "held" | "wrong-eye" | "position" | "face" | "orientation" | "view" | null }>;
export function fourPrismTechnique(state: FourPrismRunState, sample: FourPrismSample): FourPrismTechnique {
  if (!sample.trackingValid) return { valid: false, reason: "tracking" };
  if (!state.fitted || sample.correctionRevision !== state.correctionRevision) return { valid: false, reason: "fitting" };
  if (!validFixation(state) || sample.fixationRevision !== state.fixationRevision) return { valid: false, reason: "fixation" };
  if (!sample.prismHeld) return { valid: false, reason: "held" };
  if (sample.detectedEye !== state.expectedEye) return { valid: false, reason: sample.detectedEye ? "wrong-eye" : "position" };
  if (sample.forward[2] >= 0) return { valid: false, reason: "face" };
  if (sample.boAlignmentErrorRad > FOUR_PRISM_BO_ROLL_TOLERANCE_RAD) return { valid: false, reason: "orientation" };
  if (!sample.examinerViewValid) return { valid: false, reason: "view" };
  return { valid: true, reason: null };
}
function eyeCapture(state: FourPrismRunState, sample: FourPrismSample): FourPrismEyeCapture | null {
  if (!sample.position) return null;
  return immutable({ eye: state.expectedEye, authoredObservation: authoredFourPrismObservation(state.scenario, state.expectedEye),
    observedDurationMs: prismObservationMs, position: freezePoint(sample.position), forward: freezePoint(sample.forward), baseAxis: freezePoint(sample.baseAxis),
    boAlignmentErrorRad: sample.boAlignmentErrorRad, correctionRevision: state.correctionRevision, fixationRevision: state.fixationRevision,
    setupRevision: state.setupRevision, prismToolRevision: sample.prismToolRevision, trackingValid: true, examinerViewValid: true });
}
export function advanceFourPrismSample(state: FourPrismRunState, sample: FourPrismSample): FourPrismRunState {
  if (!state.active || state.recorded || state.completedRun || !["orient-od", "observe-od", "orient-os", "observe-os"].includes(state.phase)) return state;
  const technique = fourPrismTechnique(state, sample);
  if (!technique.valid) return state.dwellMs || state.currentEye ? freezeState({ ...state, dwellMs: 0, currentEye: null,
    phase: state.expectedEye === "OD" ? "orient-od" : "orient-os" }) : state;
  const sampled = Math.max(0, Math.min(FOUR_PRISM_MAX_FRAME_SAMPLE_MS, sample.sampledDurationMs));
  const dwellMs = (state.currentEye === state.expectedEye ? state.dwellMs : 0) + sampled;
  if (dwellMs < prismObservationMs) return freezeState({ ...state, currentEye: state.expectedEye, dwellMs,
    phase: state.expectedEye === "OD" ? "observe-od" : "observe-os", notice: "" });
  const capture = eyeCapture(state, sample); if (!capture) return state;
  if (state.expectedEye === "OD") return freezeState({ ...state, currentEye: null, dwellMs: 0, phase: "withdraw",
    eyeCaptures: immutable({ ...state.eyeCaptures, OD: capture }), notice: "" });
  return freezeState({ ...state, currentEye: null, dwellMs: 0, phase: "record",
    eyeCaptures: immutable({ ...state.eyeCaptures, OS: capture }), notice: "" });
}
export function interruptFourPrismEye(state: FourPrismRunState, clearFixation: boolean, notice = "") {
  if (!state.active || state.completedRun) return state;
  const fixationSetupRevision = clearFixation ? null : state.fixationSetupRevision;
  const phase = clearFixation && state.fixationSetupRevision !== null ? state.fitted ? "fixation" : "fitting"
    : state.phase === "observe-od" ? "orient-od" : state.phase === "observe-os" ? "orient-os" : state.phase;
  if (state.currentEye === null && state.dwellMs === 0 && state.phase === phase
    && state.notice === notice && state.fixationSetupRevision === fixationSetupRevision) return state;
  return freezeState({ ...state, currentEye: null, dwellMs: 0, phase, notice, fixationSetupRevision });
}
export function confirmFourPrismWithdrawal(state: FourPrismRunState, position: ToolPoint | null, forward: ToolPoint) {
  if (!state.active || state.phase !== "withdraw" || !state.eyeCaptures.OD || !position || xrPracticeCoverPosition(position, forward) !== "away") return state;
  return freezeState({ ...state, withdrawalConfirmed: true, expectedEye: "OS", phase: "orient-os", notice: "" });
}
export function markFourPrismObservation(state: FourPrismRunState, eye: PrismEye, observation: FourPrismObservation) {
  if (!state.active || state.recorded || !state.eyeCaptures.OD || !state.eyeCaptures.OS || state.completedRun) return state;
  const capture = state.eyeCaptures[eye]; if (!capture) return state;
  const correct = capture.authoredObservation === observation, markings = immutable({ ...state.markings, [eye]: observation });
  if (!correct) {
    const eyeRecords = { ...state.eyeRecords };
    delete eyeRecords[eye];
    return freezeState({ ...state, markings, eyeRecords: immutable(eyeRecords),
      notice: `${eye} entry does not match the movement you observed. Review that eye and try again.` });
  }
  const eyeRecords = immutable({ ...state.eyeRecords, [eye]: immutable({ capture, learnerObservation: observation, transcriptionCorrect: true }) });
  return freezeState({ ...state, markings, eyeRecords, notice: `${eye} observation confirmed.` });
}
export function finalizeFourPrismRun(state: FourPrismRunState) {
  const od = state.eyeRecords.OD, os = state.eyeRecords.OS;
  if (!state.active || state.completedRun) return state;
  if (!od || !os || state.markings.OD !== od.learnerObservation || state.markings.OS !== os.learnerObservation)
    return freezeState({ ...state, notice: "Both current entries must match the movements you observed. Review OD and OS and try again." });
  if (!state.withdrawalConfirmed || state.dwellMs !== 0
    || od.capture.setupRevision !== state.setupRevision || os.capture.setupRevision !== state.setupRevision) return state;
  const completedRun = immutable({ records: Object.freeze([od, os]) as readonly [FourPrismEyeRecord, FourPrismEyeRecord], scenario: state.scenario,
    attempt: state.attempt, generation: state.generation, setupRevision: state.setupRevision, withdrawalConfirmed: true as const, noEyeUnfinished: true as const });
  return freezeState({ ...state, completedRun, phase: "interpret", notice: "Correct Observations" });
}
export function submitFourPrismInterpretation(state: FourPrismRunState, interpretation: PrismCase) {
  if (!state.active || state.recorded || !state.completedRun) return state;
  const correct = interpretation === state.scenario;
  return freezeState({ ...state, interpretation, interpretationCorrect: correct, recorded: correct, phase: correct ? "complete" : "interpret",
    notice: correct ? "Bilateral comparison recorded." : "That interpretation does not match your confirmed bilateral observations. Try again." });
}
export function repeatFourPrismComparison(state: FourPrismRunState) {
  if (!state.active) return state;
  return freezeState({ ...initialFourPrismRun(state.scenario, state.attempt + 1, state.generation + 1), fitted: state.fitted, targetOn: state.targetOn,
    correctionRevision: state.correctionRevision, setupRevision: state.setupRevision + 1, prismToolRevision: state.prismToolRevision,
    prismHandled: state.prismHandled, phase: state.fitted ? "fixation" : "fitting", notice: "Repeat the same comparison from fixation." });
}
export function resetFourPrismRun(state: FourPrismRunState) { return initialFourPrismRun(state.scenario, state.attempt + 1, state.generation + 1); }
export function cancelFourPrismRun(state: FourPrismRunState) {
  if (!state.active || state.recorded) return state;
  return freezeState({ ...initialFourPrismRun(state.scenario, state.attempt, state.generation + 1), active: state.active, fitted: state.fitted, targetOn: state.targetOn,
    correctionRevision: state.correctionRevision, setupRevision: state.setupRevision + 1, phase: state.fitted ? "fixation" : "fitting" });
}
export function exitFourPrismRun(state: FourPrismRunState) {
  if (!state.active) return state;
  return freezeState({ ...cancelFourPrismRun(state), active: false, targetOn: false, phase: "inactive", notice: "" });
}
export function fourPrismGuidedStep(state: FourPrismGuidedState): FourPrismGuidedStep {
  const step = (id: string, index: number, title: string, lines: readonly string[], complete = false) => immutable({ id, index, title, lines, complete });
  if (state.recorded) return step("complete", 9, "Comparison recorded", ["Guided comparison complete."], true);
  if (!state.fitted) return step("fit", 0, "Fit the trial frame", []);
  if (!state.targetOn) return step("target", 1, "Switch on the distance target", ["Use the power button on the distance display."]);
  if (state.fixationSetupRevision === null) return step("fixate", 2, "Establish fixation", ["Ask Arun to look at the isolated letter and keep it single."]);
  if (!state.prismHandled) return step("pickup", 3, "Pick up the 4Δ prism", []);
  if (state.phase === "orient-od") return step("orient-od", 4, "Place the prism before the right eye", ["Point its base toward Arun’s right temple."]);
  if (state.phase === "observe-od") return step("observe-od", 5, "Observe OD", ["Maintain the view."]);
  if (state.phase === "withdraw") return step("withdraw", 6, "Remove Prism", []);
  if (["orient-os", "observe-os"].includes(state.phase)) return step("observe-os", 7, "Place the prism before the left eye", ["Point its base toward Arun’s left temple, then observe continuously."]);
  if (!state.completedRun) return step("record", 8, "Observations", []);
  return step("interpret", 9, "Record", []);
}
export function seededFourPrismDeck(seed: number, length = 8): readonly PrismCase[] {
  const size = Math.max(2, length + length % 2); let value = seed >>> 0 || 0x9e3779b9;
  const random = () => { value ^= value << 13; value ^= value >>> 17; value ^= value << 5; return (value >>> 0) / 0x100000000; };
  const deck: PrismCase[] = Array.from({ length: size / 2 }, () => ["normal", "suppression"] as PrismCase[]).flat();
  for (let index = deck.length - 1; index > 0; index--) { const other = Math.floor(random() * (index + 1)); [deck[index], deck[other]] = [deck[other], deck[index]]; }
  if (deck.every((item, index) => index === 0 || item !== deck[index - 1]) && deck.length >= 4) [deck[1], deck[2]] = [deck[2], deck[1]];
  return Object.freeze(deck.slice(0, length));
}
export function fourPrismScenarioAt(deck: readonly PrismCase[], index: number) {
  if (!deck.length) throw new Error("Four-prism scenario deck cannot be empty.");
  return deck[((index % deck.length) + deck.length) % deck.length];
}
export function clinicFourPrismGaze(eye: PrismEye, scenario: PrismCase, elapsed: number) {
  const gaze = fourPrismGaze(eye, scenario, elapsed); return { od: gaze.od * .012 / .035, os: gaze.os * .012 / .035 };
}
