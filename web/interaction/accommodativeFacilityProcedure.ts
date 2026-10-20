import {
  facilityCanFlip, facilityClearDelay, facilityDuration, facilityNext, facilityRemaining,
  type FacilityEye, type FacilitySide,
} from "./accommodativeFacility";

export type FacilitySpatialSample = Readonly<{
  nowMs: number;
  correctionFitted: boolean;
  targetReady: boolean;
  occlusionReady: boolean;
  flipperHeld: boolean;
  flipperAligned: boolean;
  visible: boolean;
  tracking: boolean;
}>;
export type FacilityCapture = Readonly<{ eye: FacilityEye; cycles: number }>;
export type FacilityRecord = Readonly<{ eye: FacilityEye; capture: FacilityCapture; submittedCycles: number }>;
export type FacilityPhase = "setup" | "ready" | "running" | "captured" | "complete";
export type AccommodativeFacilityRun = Readonly<{
  phase: FacilityPhase;
  eyeIndex: number;
  fixation: boolean;
  startMs: number | null;
  presentedMs: number | null;
  side: FacilitySide;
  cycles: number;
  capture: FacilityCapture | null;
  records: readonly FacilityRecord[];
  feedback: string;
  completionAwarded: boolean;
}>;
export type FacilityGuidedStep = Readonly<{ index: number; title: string; lines: readonly string[] }>;

export const ACCOMMODATIVE_FACILITY_EYES = Object.freeze(["OD", "OS", "OU"] as const);
export const accommodativeFacilityEye = (run: AccommodativeFacilityRun) => ACCOMMODATIVE_FACILITY_EYES[run.eyeIndex] ?? "OU";

export function newAccommodativeFacilityRun(completionAwarded = false): AccommodativeFacilityRun {
  return Object.freeze({ phase: "setup", eyeIndex: 0, fixation: false, startMs: null, presentedMs: null,
    side: "plus", cycles: 0, capture: null, records: Object.freeze([]),
    feedback: "Fit near correction and prepare OD at the supported 40 cm target.", completionAwarded });
}

export function facilityGeometryIssue(sample: FacilitySpatialSample) {
  if (!sample.visible || !sample.tracking) return "Restore the flipper and input tracking.";
  if (!sample.correctionFitted) return "Fit the appropriate near correction.";
  if (!sample.targetReady) return "Place the readable near target on its 40 cm stand.";
  if (!sample.occlusionReady) return "Prepare the required occlusion for the current eye.";
  if (!sample.flipperHeld || !sample.flipperAligned) return "Hold the flipper face-on before the tested eye or both eyes.";
  return "";
}

function facilityPreparationIssue(sample: FacilitySpatialSample) {
  if (!sample.visible || !sample.tracking) return "Restore the flipper and input tracking.";
  if (!sample.correctionFitted) return "Fit the appropriate near correction.";
  if (!sample.targetReady) return "Place the readable near target on its 40 cm stand.";
  if (!sample.occlusionReady) return "Prepare the required occlusion for the current eye.";
  return "";
}

export function establishFacilityFixation(run: AccommodativeFacilityRun, sample: FacilitySpatialSample) {
  if (run.phase === "complete" || run.capture) return run;
  const issue = facilityPreparationIssue(sample);
  if (issue) return Object.freeze({ ...run, feedback: issue });
  return Object.freeze({ ...run, phase: "ready" as const, fixation: true,
    feedback: "Fixation established. Begin with the plus side and start the 60-second run." });
}

export function startAccommodativeFacility(run: AccommodativeFacilityRun, sample: FacilitySpatialSample) {
  if (run.phase === "complete" || run.capture || run.startMs !== null) return run;
  const issue = facilityGeometryIssue(sample);
  if (issue) return Object.freeze({ ...run, feedback: issue });
  if (!run.fixation) return Object.freeze({ ...run, feedback: "Establish clear near fixation before starting." });
  return Object.freeze({ ...run, phase: "running" as const, startMs: sample.nowMs, presentedMs: sample.nowMs,
    side: "plus" as const, cycles: 0, feedback: "Patient is clearing the plus side…" });
}

export function flipAccommodativeFacility(run: AccommodativeFacilityRun, sample: FacilitySpatialSample) {
  if (run.phase !== "running" || run.startMs === null || run.presentedMs === null) return run;
  const issue = facilityGeometryIssue(sample);
  if (issue || !run.fixation) return Object.freeze({ ...run, feedback: issue || "Re-establish fixation before flipping." });
  if (!facilityCanFlip(run.startMs, run.presentedMs, sample.nowMs, run.side)) return run;
  const next = facilityNext(run.side, run.cycles);
  return Object.freeze({ ...run, ...next, presentedMs: sample.nowMs,
    feedback: `Flipped to ${next.side}; wait for a clear report.` });
}

export function sampleAccommodativeFacility(run: AccommodativeFacilityRun, sample: FacilitySpatialSample) {
  if (run.phase === "complete" || run.capture) return run;
  if (run.phase !== "running" || run.startMs === null || run.presentedMs === null) return run;
  const issue = facilityGeometryIssue(sample);
  if (issue || !run.fixation) return Object.freeze({ ...run, phase: "setup" as const, fixation: false,
    startMs: null, presentedMs: null, side: "plus" as const, cycles: 0,
    feedback: `${issue || "Fixation was interrupted."} Restart the current 60-second run.` });
  if (sample.nowMs - run.startMs >= facilityDuration) {
    const capture = Object.freeze({ eye: accommodativeFacilityEye(run), cycles: run.cycles });
    return Object.freeze({ ...run, phase: "captured" as const, capture, startMs: null, presentedMs: null,
      feedback: `${capture.eye} count frozen at ${capture.cycles} full plus/minus pairs.` });
  }
  const clear = sample.nowMs - run.presentedMs >= facilityClearDelay[run.side];
  const feedback = clear ? "Clear; flip now." : `Patient is clearing the ${run.side} side…`;
  return feedback === run.feedback ? run : Object.freeze({ ...run, feedback });
}

export function interruptAccommodativeFacility(run: AccommodativeFacilityRun, reason: string) {
  if (run.phase !== "running" || run.capture) return run;
  return Object.freeze({ ...run, phase: "ready" as const, startMs: null, presentedMs: null,
    side: "plus" as const, cycles: 0, feedback: `${reason} Restart the current 60-second run.` });
}

export function restartAccommodativeFacilityEye(run: AccommodativeFacilityRun) {
  if (run.phase === "complete") return run;
  return Object.freeze({ ...run, phase: "setup" as const, fixation: false, startMs: null, presentedMs: null,
    side: "plus" as const, cycles: 0, capture: null,
    feedback: `${accommodativeFacilityEye(run)} restarted. Restore the setup and begin with plus.` });
}

export function submitAccommodativeFacility(run: AccommodativeFacilityRun, cyclesEntry: string) {
  if (!run.capture || run.phase !== "captured") return Object.freeze({ ...run, feedback: "Complete the timed run before recording." });
  const cycles = Number(cyclesEntry);
  if (!Number.isFinite(cycles) || cycles !== run.capture.cycles)
    return Object.freeze({ ...run, feedback: "Check the frozen full-cycle count." });
  const record = Object.freeze({ eye: run.capture.eye, capture: run.capture, submittedCycles: cycles });
  const records = Object.freeze([...run.records, record]);
  if (run.eyeIndex === ACCOMMODATIVE_FACILITY_EYES.length - 1)
    return Object.freeze({ ...run, phase: "complete" as const, records, capture: null, completionAwarded: true,
      feedback: "OD, OS, and OU accommodative facility recorded." });
  const eyeIndex = run.eyeIndex + 1;
  return Object.freeze({ ...run, phase: "ready" as const, eyeIndex, fixation: true, startMs: null, presentedMs: null,
    side: "plus" as const, cycles: 0, capture: null, records,
    feedback: `${record.eye} saved. Prepare ${ACCOMMODATIVE_FACILITY_EYES[eyeIndex]} and begin with plus.` });
}

export function accommodativeFacilitySeconds(run: AccommodativeFacilityRun, nowMs: number) {
  return run.startMs === null ? run.capture ? 0 : 60 : facilityRemaining(run.startMs, nowMs);
}

export function accommodativeFacilityGuidedStep(run: AccommodativeFacilityRun, sample: FacilitySpatialSample): FacilityGuidedStep {
  if (!sample.correctionFitted) return { index: 0, title: "Fit near correction", lines: ["Fit the appropriate near correction."] };
  if (!sample.targetReady) return { index: 1, title: "Place the near target", lines: ["Dock the readable line on its 40 cm stand."] };
  if (!sample.occlusionReady) return { index: 2, title: `Prepare ${accommodativeFacilityEye(run)}`, lines: ["Set the required monocular occlusion, or uncover both eyes for OU."] };
  if (!sample.flipperHeld || !sample.flipperAligned) return { index: 3, title: "Align the flipper", lines: ["Hold the ±2.00 D flipper face-on before the tested eye or both eyes."] };
  if (!run.fixation) return { index: 4, title: "Establish fixation", lines: ["Confirm the near line is clear through the plus side."] };
  if (run.phase === "ready") return { index: 5, title: "Start the timed run", lines: ["Start the 60-second run with plus presented."] };
  if (run.phase === "running") return { index: 6, title: "Flip after clear", lines: [run.feedback] };
  return { index: 7, title: run.phase === "complete" ? "Series complete" : "Record the frozen count", lines: [run.feedback] };
}
