import { pushUpAmplitude, pushUpBlurCm } from "./accommodationPractice";
import type { LibraryEye } from "./xrLibraryEquipment";

export type PushUpPhase = "setup" | "start" | "approach" | "confirming-blur" | "captured" | "complete";
export type PushUpSpatialSample = Readonly<{
  nowMs: number;
  distanceCm: number;
  correctionFitted: boolean;
  occlusionReady: boolean;
  ruleDocked: boolean;
  patientFacing: boolean;
  upright: boolean;
  midlineOffsetCm: number;
  visible: boolean;
  tracking: boolean;
}>;
export type PushUpCapture = Readonly<{ eye: LibraryEye; distanceCm: number; amplitudeD: number }>;
export type PushUpRecord = Readonly<{ eye: LibraryEye; captured: PushUpCapture; submittedDistanceCm: number; submittedAmplitudeD: number }>;
export type PushUpRun = Readonly<{
  phase: PushUpPhase;
  eyeIndex: number;
  instructionArmed: boolean;
  startStableSinceMs: number | null;
  blurSinceMs: number | null;
  firstBlurDistanceCm: number | null;
  previousDistanceCm: number | null;
  capture: PushUpCapture | null;
  records: readonly PushUpRecord[];
  feedback: string;
  report: string;
  completionAwarded: boolean;
}>;
export type PushUpGuidedStep = Readonly<{ index: number; title: string; lines: readonly string[] }>;

export const PUSH_UP_EYES = Object.freeze(["OD", "OS", "OU"] as const);
export const PUSH_UP_START_MIN_CM = 38;
export const PUSH_UP_START_MAX_CM = 42;
export const PUSH_UP_START_HOLD_MS = 250;
export const PUSH_UP_BLUR_CONFIRM_MS = 500;
export const PUSH_UP_JITTER_CM = .5;
export const PUSH_UP_MAX_SAMPLE_JUMP_CM = 3;
export const PUSH_UP_MIN_CM = 2;
export const PUSH_UP_MAX_CM = 42;

export const pushUpEye = (run: PushUpRun): LibraryEye => PUSH_UP_EYES[run.eyeIndex] ?? "OU";
const roundedDistance = (value: number) => Math.round(value * 10) / 10;
const roundedAmplitude = (value: number) => Math.round(value * 100) / 100;
const initialFeedback = (eye: LibraryEye) => `Fit the near correction, then prepare ${eye} occlusion.`;

export function newPushUpRun(completionAwarded = false): PushUpRun {
  return Object.freeze({ phase: "setup", eyeIndex: 0, instructionArmed: false, startStableSinceMs: null, blurSinceMs: null,
    firstBlurDistanceCm: null, previousDistanceCm: null, capture: null, records: Object.freeze([]),
    feedback: initialFeedback("OD"), report: "", completionAwarded });
}

export function pushUpGeometryIssue(sample: PushUpSpatialSample) {
  if (!sample.visible || !sample.tracking) return "Restore the ruler, controller, and headset tracking.";
  if (!sample.correctionFitted) return "Fit the near correction.";
  if (!sample.occlusionReady) return "Prepare the required occlusion for the current eye.";
  if (!sample.ruleDocked) return "Dock the patient end of the Push-up ruler at the spectacle plane.";
  if (!sample.patientFacing) return "Turn the letter target toward the patient.";
  if (!sample.upright) return "Level the ruler before moving the card.";
  if (Math.abs(sample.midlineOffsetCm) > 2) return "Align the ruler with the visual midline.";
  return "";
}

function restartCurrent(run: PushUpRun, feedback: string): PushUpRun {
  return Object.freeze({ ...run, phase: "start", startStableSinceMs: null, blurSinceMs: null, firstBlurDistanceCm: null,
    previousDistanceCm: null, capture: null, feedback, report: run.instructionArmed ? "The letters are clear." : "" });
}

export function givePushUpInstruction(run: PushUpRun): PushUpRun {
  if (run.phase === "complete" || run.capture) return run;
  return Object.freeze({ ...run, instructionArmed: true, phase: "start", startStableSinceMs: null,
    feedback: "Set the letter card within 38–42 cm and hold the starting position.", report: "The letters are clear." });
}

export function restartPushUpEye(run: PushUpRun): PushUpRun {
  if (run.phase === "complete") return run;
  return Object.freeze({ ...run, phase: "setup", instructionArmed: false, startStableSinceMs: null, blurSinceMs: null,
    firstBlurDistanceCm: null, previousDistanceCm: null, capture: null,
    feedback: `${pushUpEye(run)} restarted. Restore the setup and return the card to 38–42 cm.`, report: "" });
}

export function interruptPushUp(run: PushUpRun, reason: string): PushUpRun {
  if (run.capture || run.phase === "complete" || run.phase === "setup" || run.phase === "start") return run;
  return restartCurrent(run, `${reason} Return the card to 38–42 cm and restart the inward approach.`);
}

export function samplePushUp(run: PushUpRun, sample: PushUpSpatialSample): PushUpRun {
  if (run.phase === "complete") return run;
  if (run.capture) {
    if (!sample.correctionFitted || !sample.occlusionReady)
      return restartPushUpEye(Object.freeze({ ...run, feedback: "The correction or occlusion changed before recording." }));
    return run;
  }
  const issue = pushUpGeometryIssue(sample);
  if (issue) return run.phase === "approach" || run.phase === "confirming-blur"
    ? restartCurrent(run, `${issue} Return the card to 38–42 cm and restart.`)
    : Object.freeze({ ...run, phase: "setup", startStableSinceMs: null, previousDistanceCm: null, feedback: issue, report: "" });
  if (!run.instructionArmed) return Object.freeze({ ...run, phase: "setup", feedback: "Tell the patient to report the first blur that remains blurred.", report: "" });

  if (run.phase === "setup") return Object.freeze({ ...run, phase: "start", feedback: "Set the letter card within 38–42 cm." });
  if (run.phase === "start") {
    const inBand = sample.distanceCm >= PUSH_UP_START_MIN_CM && sample.distanceCm <= PUSH_UP_START_MAX_CM;
    if (!inBand) return Object.freeze({ ...run, startStableSinceMs: null, previousDistanceCm: null,
      feedback: "Return the card to the highlighted 38–42 cm starting region.", report: "The letters are clear." });
    const since = run.startStableSinceMs ?? sample.nowMs;
    if (sample.nowMs - since < PUSH_UP_START_HOLD_MS) return Object.freeze({ ...run, startStableSinceMs: since,
      feedback: "Hold the starting position for 250 ms.", report: "The letters are clear." });
    return Object.freeze({ ...run, phase: "approach", startStableSinceMs: since, previousDistanceCm: sample.distanceCm,
      feedback: "Move the letter card inward steadily while maintaining alignment.", report: "The letters are clear." });
  }

  const previous = run.previousDistanceCm ?? sample.distanceCm;
  const delta = sample.distanceCm - previous;
  if (delta < -PUSH_UP_MAX_SAMPLE_JUMP_CM)
    return restartCurrent(run, "The card jumped too far to represent a continuous approach. Return to 38–42 cm.");
  if (delta > PUSH_UP_JITTER_CM)
    return restartCurrent(run, "The card reversed outward before capture. Return to 38–42 cm.");
  const threshold = pushUpBlurCm[pushUpEye(run)];
  if (sample.distanceCm > threshold) return Object.freeze({ ...run, phase: "approach", previousDistanceCm: sample.distanceCm,
    blurSinceMs: null, firstBlurDistanceCm: null, feedback: "Continue inward steadily.", report: "The letters are clear." });

  const blurSince = run.blurSinceMs ?? sample.nowMs;
  const firstBlur = run.firstBlurDistanceCm ?? roundedDistance(sample.distanceCm);
  if (sample.nowMs - blurSince < PUSH_UP_BLUR_CONFIRM_MS) return Object.freeze({ ...run, phase: "confirming-blur", previousDistanceCm: sample.distanceCm,
    blurSinceMs: blurSince, firstBlurDistanceCm: firstBlur, feedback: "Blur reported; maintain the valid position while it is confirmed.", report: "They are becoming blurred." });
  const distanceCm = firstBlur;
  const capture = Object.freeze({ eye: pushUpEye(run), distanceCm, amplitudeD: roundedAmplitude(pushUpAmplitude(distanceCm)) });
  return Object.freeze({ ...run, phase: "captured", capture, previousDistanceCm: sample.distanceCm,
    feedback: `${capture.eye} endpoint captured. Read the ruler and calculate 100 ÷ distance.`,
    report: "The letters remain blurred; I cannot clear them." });
}

export function submitPushUpRecord(run: PushUpRun, distanceEntry: string, amplitudeEntry: string): PushUpRun {
  if (!run.capture || run.phase !== "captured") return Object.freeze({ ...run, feedback: "Capture the current eye before recording." });
  const distance = Number(distanceEntry), amplitude = Number(amplitudeEntry);
  if (!Number.isFinite(distance) || !Number.isFinite(amplitude)) return Object.freeze({ ...run, feedback: "Enter both the ruler distance and calculated amplitude." });
  if (Math.abs(distance - run.capture.distanceCm) > .011 || Math.abs(amplitude - run.capture.amplitudeD) > .011)
    return Object.freeze({ ...run, feedback: "Recheck the ruler reading and the 100 ÷ distance calculation." });
  const record = Object.freeze({ eye: run.capture.eye, captured: run.capture, submittedDistanceCm: distance, submittedAmplitudeD: amplitude });
  const records = Object.freeze([...run.records, record]);
  if (run.eyeIndex === PUSH_UP_EYES.length - 1) return Object.freeze({ ...run, phase: "complete", records, capture: null,
    completionAwarded: true, feedback: "OD, OS, and OU Push-up amplitudes recorded.", report: "" });
  const eyeIndex = run.eyeIndex + 1;
  const nextEye = PUSH_UP_EYES[eyeIndex];
  return Object.freeze({ ...run, phase: "setup", eyeIndex, records, instructionArmed: false, startStableSinceMs: null,
    blurSinceMs: null, firstBlurDistanceCm: null, previousDistanceCm: null, capture: null,
    feedback: `${record.eye} saved. Prepare ${nextEye} and return the card to 38–42 cm.`, report: "" });
}

export function pushUpGuidedStep(run: PushUpRun, sample: PushUpSpatialSample): PushUpGuidedStep {
  const eye = pushUpEye(run);
  if (!sample.correctionFitted) return { index: 0, title: "Fit near correction", lines: ["Fit the appropriate correction in the trial frame."] };
  if (!sample.occlusionReady) return { index: 1, title: `Prepare ${eye}`, lines: [eye === "OD" ? "Cover OS to test OD." : eye === "OS" ? "Move the cover to OD to test OS." : "Remove the cover so both eyes are open."] };
  if (!sample.ruleDocked) return { index: 2, title: "Dock the ruler", lines: ["Pick up the Push-up ruler and dock its patient end at the spectacle plane."] };
  if (!run.instructionArmed) return { index: 3, title: "Give the instruction", lines: ["Ask the patient to read the line and report the first blur that remains blurred."] };
  if (run.phase === "start" || run.phase === "setup") return { index: 4, title: "Set the starting distance", lines: ["Slide the card to the highlighted 40 cm region and hold it briefly."] };
  if (run.phase === "approach" || run.phase === "confirming-blur") return { index: 5, title: "Move inward", lines: [run.feedback] };
  return { index: 6, title: run.phase === "complete" ? "Series complete" : `Record ${eye}`, lines: [run.feedback] };
}

export function pushUpDisclosure(kind: "guided" | "test") {
  return Object.freeze({ showCoach: kind === "guided", showHighlights: kind === "guided" });
}
