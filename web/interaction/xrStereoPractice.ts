import { sensoryNearCondition } from "./xrSensoryEquipment";
import { stereoDistanceReady, stereoPatientReply, stereoPracticeLevels, type StereoReply } from "./stereoPractice";
import type { ToolPoint } from "./xrConsultationTools";

export const STEREO_GUIDED_STEP_COUNT = 9;
export const stereoCircleNames = ["left", "middle", "right"] as const;
export type StereoCircle = typeof stereoCircleNames[number];
export type StereoClassification = "correct" | "incorrect";

/** Shared patient-relative near geometry with the existing booklet teaching range. */
export function xrStereoGeometry(position: ToolPoint, forward: ToolPoint) {
  const geometry = sensoryNearCondition({ position, forward });
  // Avoid floating point rejecting exact 38/42 cm boundaries, without widening the taught range.
  return { ...geometry, ready: geometry.ready && stereoDistanceReady(Math.round(geometry.distanceCm * 1e9) / 1e9) };
}

export type StereoPageRecord = Readonly<{
  page: number;
  level: number;
  targetCircle: StereoCircle;
  reportedCircle: StereoCircle;
  markedCircle: StereoCircle;
  classification: StereoClassification;
  derivedCorrect: boolean;
  distanceCm: number;
  geometryValid: true;
  setupRevision: number;
  fixationRevision: number;
}>;

export type StereoRunCapture = Readonly<{
  attempt: number;
  generation: number;
  setupRevision: number;
  distanceCm: number;
  records: readonly StereoPageRecord[];
  /** Retained for consumers that only need the original authored reply shape. */
  replies: readonly Readonly<StereoReply>[];
  lastCorrect: number | null;
}>;

export type XRStereoRun = {
  attempt: number;
  generation: number;
  setupRevision: number;
  page: number;
  records: StereoPageRecord[];
  replies: StereoReply[];
  fixation: Readonly<{ page: number; setupRevision: number; revision: number }> | null;
  fixationRevision: number;
  reply: Readonly<StereoReply> | null;
  markedCircle: StereoCircle | null;
  classification: StereoClassification | null;
  capture: StereoRunCapture | null;
  /** Deprecated timer-era fields are inert; clinical evidence is always event-driven. */
  pending: null;
  confirmed: boolean;
};

export function initialXRStereoRun(attempt = 0, generation = 0, setupRevision = 0): XRStereoRun {
  return {
    attempt, generation, setupRevision, page: 0, records: [], replies: [], fixation: null, fixationRevision: 0,
    reply: null, markedCircle: null, classification: null, capture: null, pending: null, confirmed: false,
  };
}

const immutableReply = (reply: StereoReply) => Object.freeze({ ...reply });
const fixationCurrent = (run: XRStereoRun) => Boolean(run.fixation
  && run.fixation.page === run.page && run.fixation.setupRevision === run.setupRevision);

export function fixateXRStereoPage(run: XRStereoRun, ready: boolean): XRStereoRun {
  if (!ready || run.capture || fixationCurrent(run)) return run;
  const revision = run.fixationRevision + 1;
  return { ...run, fixationRevision: revision, fixation: Object.freeze({ page: run.page, setupRevision: run.setupRevision, revision }) };
}

/** Capture Arun's deterministic reply synchronously at the accepted question event. */
export function requestXRStereoReply(run: XRStereoRun, ready: boolean): XRStereoRun {
  if (!ready || !fixationCurrent(run) || run.capture || run.reply || run.page >= stereoPracticeLevels.length) return run;
  const reply = stereoPatientReply(run.page);
  return reply ? { ...run, reply: immutableReply(reply), pending: null } : run;
}

/** Kept as a no-op compatibility boundary: audio/timers can never create evidence. */
export function resolveXRStereoReply(run: XRStereoRun, _token?: unknown, _ready?: boolean): XRStereoRun { return run; }

export function markXRStereoResponse(run: XRStereoRun, circle: StereoCircle, ready: boolean): XRStereoRun {
  if (!ready || !run.reply || run.capture || run.markedCircle === circle) return run;
  if (circle !== stereoCircleNames[run.reply.selected]) return run;
  return { ...run, markedCircle: circle, classification: null };
}

function lastCorrect(records: readonly StereoPageRecord[]) {
  return [...records].reverse().find(record => record.derivedCorrect)?.level ?? null;
}
function stopped(records: readonly StereoPageRecord[]) {
  return records.length >= 2 && records.slice(-2).every(record => !record.derivedCorrect);
}

export function classifyXRStereoResponse(run: XRStereoRun, classification: StereoClassification, ready: boolean, distanceCm: number): XRStereoRun {
  if (!ready || !run.reply || !run.markedCircle || run.capture || run.confirmed) return run;
  const derivedCorrect = run.reply.selected === run.reply.target;
  if ((classification === "correct") !== derivedCorrect) return run;
  const record = Object.freeze({
    page: run.page,
    level: stereoPracticeLevels[run.page],
    targetCircle: stereoCircleNames[run.reply.target],
    reportedCircle: stereoCircleNames[run.reply.selected],
    markedCircle: run.markedCircle,
    classification,
    derivedCorrect,
    distanceCm,
    geometryValid: true as const,
    setupRevision: run.setupRevision,
    fixationRevision: run.fixation?.revision ?? run.fixationRevision,
  });
  const records = [...run.records, record];
  const finished = stopped(records) || run.page === stereoPracticeLevels.length - 1;
  const capture = finished ? Object.freeze({
    attempt: run.attempt,
    generation: run.generation,
    setupRevision: run.setupRevision,
    distanceCm,
    records: Object.freeze(records.map(item => Object.freeze({ ...item }))),
    replies: Object.freeze(records.map(item => immutableReply({
      level: item.level,
      target: stereoCircleNames.indexOf(item.targetCircle),
      selected: stereoCircleNames.indexOf(item.reportedCircle),
      correct: item.derivedCorrect,
    }))),
    lastCorrect: lastCorrect(records),
  }) : null;
  return { ...run, records, replies: records.map(item => ({ level: item.level, target: stereoCircleNames.indexOf(item.targetCircle), selected: stereoCircleNames.indexOf(item.reportedCircle), correct: item.derivedCorrect })), classification, confirmed: true, capture };
}

export function nextXRStereoPage(run: XRStereoRun, ready: boolean): XRStereoRun {
  if (!ready || !run.confirmed || run.capture || run.page >= stereoPracticeLevels.length - 1 || stopped(run.records)) return run;
  return {
    ...run, page: run.page + 1, generation: run.generation + 1, fixation: null,
    reply: null, markedCircle: null, classification: null, confirmed: false, pending: null,
  };
}

/** Invalid geometry/tracking preserves confirmed pages and cancels only the unfinished page. */
export function interruptXRStereoRun(run: XRStereoRun): XRStereoRun {
  if (run.capture) return run;
  if (run.confirmed) return run;
  if (!run.fixation && !run.reply && !run.markedCircle && !run.classification) return run;
  return {
    ...run, generation: run.generation + 1, page: run.records.length, fixation: null,
    reply: null, markedCircle: null, classification: null, confirmed: false, pending: null,
  };
}

/** Removing or refitting required equipment restarts the entire comparison. */
export function reviseXRStereoSetup(run: XRStereoRun): XRStereoRun {
  return initialXRStereoRun(run.attempt, run.generation + 1, run.setupRevision + 1);
}

export function xrStereoEntryCorrect(capture: StereoRunCapture | null, entry: string) {
  return Boolean(capture && entry !== "" && Number(entry) === capture.lastCorrect);
}

export type StereoGuidedState = Readonly<{
  correctionFitted: boolean;
  filtersFitted: boolean;
  bookletHandled: boolean;
  bookletSupported: boolean;
  geometryReady: boolean;
  distanceCm: number;
  facing: boolean;
  tracking: boolean;
  run: XRStereoRun;
  recorded?: boolean;
}>;
export type StereoGuidedStep = Readonly<{ id: string; index: number; title: string; lines: readonly string[]; complete: boolean }>;

export function stereoGuidedStep(state: StereoGuidedState): StereoGuidedStep {
  const { run } = state;
  if (state.recorded) return { id: "complete", index: 8, title: "Threshold recorded", lines: ["Guided comparison complete."], complete: true };
  if (!state.correctionFitted) return { id: "fit-correction", index: 0, title: "Fit the near correction", lines: ["Seat the trial-frame correction at Arun's bridge.", "The fitting socket and orientation must be valid."], complete: false };
  if (!state.filtersFitted) return { id: "fit-polarised", index: 1, title: "Fit the polarised glasses", lines: ["Place them as a separate layer over the correction."], complete: false };
  if (!state.bookletHandled && !state.bookletSupported) return { id: "pickup-booklet", index: 2, title: "Pick up the stereo booklet", lines: ["Use the booklet's side grip, then bring it to Arun."], complete: false };
  if (!state.geometryReady) {
    const correction = !state.tracking ? "Restore headset and controller tracking."
      : !state.facing ? "Turn the booklet so its circle page faces Arun."
        : state.distanceCm < 38 ? "Move the booklet farther from Arun."
          : state.distanceCm > 42 ? "Move the booklet closer to Arun."
            : "Centre and support the booklet in front of Arun.";
    return { id: "position-booklet", index: 3, title: "Position the booklet", lines: [correction, "Use 38–42 cm or the authored near stand."], complete: false };
  }
  if (!fixationCurrent(run)) return { id: "establish-fixation", index: 4, title: "Establish fixation", lines: ["Ask Arun to look at the circles.", `PAGE ${run.page + 1} OF ${stereoPracticeLevels.length}`], complete: false };
  if (!run.reply) return { id: "present-ask", index: 5, title: "Present and ask", lines: ["Ask which circle appears raised or closer.", `PAGE ${run.page + 1} OF ${stereoPracticeLevels.length}`], complete: false };
  if (!run.markedCircle) return { id: "mark-response", index: 6, title: "Mark Arun's response", lines: ["Transcribe only the circle Arun named: left, middle, or right.", `PAGE ${run.page + 1} OF ${stereoPracticeLevels.length}`], complete: false };
  if (!run.confirmed) return { id: "classify", index: 7, title: "Classify and continue", lines: ["Compare Arun's answer with the examiner-only page key.", `PAGE ${run.page + 1} OF ${stereoPracticeLevels.length} · choose CORRECT or INCORRECT.`], complete: false };
  if (!run.capture) return { id: "turn-page", index: 7, title: "Classify and continue", lines: ["Turn exactly one page, then establish fixation again.", `PAGE ${run.page + 1} OF ${stereoPracticeLevels.length} confirmed`], complete: false };
  return { id: "record-threshold", index: 8, title: "Record the threshold", lines: ["Select the last correct level independently.", "No answer is preselected."], complete: false };
}

/** @deprecated Responses no longer use a delay. */
export const stereoResponseDelayMs = 0;

/** @deprecated Use markXRStereoResponse followed by classifyXRStereoResponse. */
export function confirmXRStereoReply(run: XRStereoRun, selected: number, ready: boolean, distanceCm: number): XRStereoRun {
  const circle = stereoCircleNames[selected];
  if (!circle) return run;
  const marked = markXRStereoResponse(run, circle, ready);
  if (marked === run || !marked.reply) return marked;
  return classifyXRStereoResponse(marked, marked.reply.correct ? "correct" : "incorrect", ready, distanceCm);
}
