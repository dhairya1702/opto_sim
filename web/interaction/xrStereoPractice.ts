import { sensoryNearCondition } from "./xrSensoryEquipment";
import { stereoDistanceReady, stereoLastCorrect, stereoPatientReply, stereoPracticeLevels, stereoStopped, type StereoReply } from "./stereoPractice";
import type { ToolPoint } from "./xrConsultationTools";

export const stereoResponseDelayMs = 1000;
export const stereoCircleNames = ["left", "middle", "right"] as const;
/** Shared patient-relative near geometry with the existing booklet teaching range. */
export function xrStereoGeometry(position: ToolPoint, forward: ToolPoint) {
  const geometry = sensoryNearCondition({ position, forward });
  // Avoid floating point rejecting exact 38/42 cm boundaries, without widening the taught range.
  return { ...geometry, ready: geometry.ready && stereoDistanceReady(Math.round(geometry.distanceCm * 1e9) / 1e9) };
}
export type StereoResponseToken = Readonly<{ attempt: number; generation: number; page: number; setupRevision: number }>;
export type StereoRunCapture = Readonly<{
  attempt: number; generation: number; setupRevision: number; distanceCm: number;
  replies: readonly Readonly<StereoReply>[]; lastCorrect: number | null;
}>;
export type XRStereoRun = {
  attempt: number; generation: number; setupRevision: number; page: number;
  replies: StereoReply[]; pending: StereoResponseToken | null; reply: StereoReply | null; confirmed: boolean;
  capture: StereoRunCapture | null;
};
export function initialXRStereoRun(attempt = 0, generation = 0, setupRevision = 0): XRStereoRun {
  return { attempt, generation, setupRevision, page: 0, replies: [], pending: null, reply: null, confirmed: false, capture: null };
}
/** Geometry/menu interruption clears unfinished work; completed evidence survives putting the book down. */
export function interruptXRStereoRun(run: XRStereoRun): XRStereoRun {
  if (run.capture || (!run.pending && !run.reply && run.replies.length === 0 && run.page === 0)) return run;
  return initialXRStereoRun(run.attempt, run.generation + 1, run.setupRevision);
}
/** Removing required fitted equipment invalidates even a completed, unrecorded capture. */
export function reviseXRStereoSetup(run: XRStereoRun): XRStereoRun {
  return initialXRStereoRun(run.attempt, run.generation + 1, run.setupRevision + 1);
}
export function requestXRStereoReply(run: XRStereoRun, ready: boolean): XRStereoRun {
  if (!ready || run.capture || run.pending || run.reply || stereoStopped(run.replies) || run.page >= stereoPracticeLevels.length) return run;
  const pending = Object.freeze({ attempt: run.attempt, generation: run.generation, page: run.page, setupRevision: run.setupRevision });
  return { ...run, pending };
}
export function resolveXRStereoReply(run: XRStereoRun, token: StereoResponseToken, ready: boolean): XRStereoRun {
  if (!ready || run.capture || run.pending !== token || run.attempt !== token.attempt || run.generation !== token.generation
    || run.page !== token.page || run.setupRevision !== token.setupRevision) return run;
  return { ...run, pending: null, reply: stereoPatientReply(run.page) };
}
/** Confirm the patient's named circle, including their authored mistakes, rather than the answer key. */
export function confirmXRStereoReply(run: XRStereoRun, selected: number, ready: boolean, distanceCm: number): XRStereoRun {
  if (!ready || !run.reply || run.confirmed || run.capture || selected !== run.reply.selected) return run;
  const replies = [...run.replies, run.reply];
  const finished = stereoStopped(replies) || run.page === stereoPracticeLevels.length - 1;
  const capture: StereoRunCapture | null = finished ? Object.freeze({
    attempt: run.attempt, generation: run.generation, setupRevision: run.setupRevision, distanceCm,
    replies: Object.freeze(replies.map(reply => Object.freeze({ ...reply }))), lastCorrect: stereoLastCorrect(replies),
  }) : null;
  return { ...run, replies, confirmed: true, capture };
}
export function nextXRStereoPage(run: XRStereoRun, ready: boolean): XRStereoRun {
  if (!ready || !run.confirmed || run.capture || run.page >= stereoPracticeLevels.length - 1 || stereoStopped(run.replies)) return run;
  return { ...run, page: run.page + 1, generation: run.generation + 1, pending: null, reply: null, confirmed: false };
}
export function xrStereoEntryCorrect(capture: StereoRunCapture | null, entry: string) {
  return Boolean(capture && entry !== "" && Number(entry) === capture.lastCorrect);
}
