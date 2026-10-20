export type RelativeAccommodationPhase =
  | "setup"
  | "initial-clear"
  | "nra"
  | "confirming-nra"
  | "baseline"
  | "baseline-clear"
  | "pra"
  | "confirming-pra"
  | "captured"
  | "complete";

export type RelativeAccommodationSpatialSample = Readonly<{
  nowMs: number;
  correctionFitted: boolean;
  targetDocked: boolean;
  holderHeld: boolean;
  holderAligned: boolean;
  visible: boolean;
  tracking: boolean;
}>;

export type RelativeAccommodationEndpoint = Readonly<{ kind: "NRA" | "PRA"; powerD: number }>;
export type RelativeAccommodationRecord = Readonly<{
  nra: RelativeAccommodationEndpoint;
  pra: RelativeAccommodationEndpoint;
  submittedNraD: number;
  submittedPraD: number;
}>;
export type RelativeAccommodationRun = Readonly<{
  phase: RelativeAccommodationPhase;
  instructionArmed: boolean;
  initialClearConfirmed: boolean;
  baselineConfirmed: boolean;
  powerD: number;
  nraCapture: RelativeAccommodationEndpoint | null;
  praCapture: RelativeAccommodationEndpoint | null;
  blurSinceMs: number | null;
  invalidSinceMs: number | null;
  record: RelativeAccommodationRecord | null;
  feedback: string;
  report: string;
  completionAwarded: boolean;
}>;
export type RelativeAccommodationGuidedStep = Readonly<{ index: number; title: string; lines: readonly string[] }>;

// Illustrative equipment range, independent of the fictional patient responses.
export const RELATIVE_HOLDER_MIN_D = -5;
export const RELATIVE_HOLDER_MAX_D = 5;
export const RELATIVE_NRA_ENDPOINT_D = 2;
export const RELATIVE_PRA_ENDPOINT_D = -2.25;
export const RELATIVE_RESPONSE_MS = 1200;
export const RELATIVE_SETUP_GRACE_MS = 250;

const roundQuarter = (value: number) => Math.round(value * 4) / 4;

export function newRelativeAccommodationRun(completionAwarded = false): RelativeAccommodationRun {
  return Object.freeze({ phase: "setup", instructionArmed: false, initialClearConfirmed: false, baselineConfirmed: false,
    powerD: 0, nraCapture: null, praCapture: null, blurSinceMs: null, invalidSinceMs: null, record: null,
    feedback: "Fit near correction and prepare the supported binocular near target.", report: "", completionAwarded });
}

export function relativeAccommodationGeometryIssue(sample: RelativeAccommodationSpatialSample) {
  if (!sample.visible || !sample.tracking) return "Restore the lens holder, controllers, and headset tracking.";
  if (!sample.correctionFitted) return "Fit the appropriate near correction.";
  if (!sample.targetDocked) return "Release the readable near line on its 40 cm stand, facing the patient.";
  if (!sample.holderHeld) return "Pick up the binocular lens holder.";
  if (!sample.holderAligned) return "Align both clear apertures over OD and OS.";
  return "";
}

export function relativeAccommodationHasProgress(run: RelativeAccommodationRun) {
  return run.instructionArmed || run.initialClearConfirmed || run.powerD !== 0 || Boolean(run.nraCapture || run.praCapture);
}

export function giveRelativeAccommodationInstruction(run: RelativeAccommodationRun, sample: RelativeAccommodationSpatialSample) {
  if (run.phase === "complete" || run.praCapture) return run;
  const issue = relativeAccommodationGeometryIssue(sample);
  if (issue) return Object.freeze({ ...run, feedback: issue });
  return Object.freeze({ ...run, phase: "initial-clear" as const, instructionArmed: true,
    feedback: "At 0.00 D, confirm that the near line is clear and single through both eyes.", report: "The letters are clear and single.", invalidSinceMs: null });
}

export function confirmRelativeAccommodationInitialClear(run: RelativeAccommodationRun, sample: RelativeAccommodationSpatialSample) {
  if (run.phase === "complete" || run.praCapture) return run;
  const issue = relativeAccommodationGeometryIssue(sample);
  if (issue) return Object.freeze({ ...run, feedback: issue });
  if (!run.instructionArmed) return Object.freeze({ ...run, feedback: "First ask the patient to keep the line clear and single and report sustained blur." });
  if (run.powerD !== 0) return Object.freeze({ ...run, feedback: "Return the holder to 0.00 D before confirming initial clarity." });
  return Object.freeze({ ...run, phase: "nra" as const, initialClearConfirmed: true, feedback: "Initial clarity confirmed. Add plus in 0.25 D steps.",
    report: "The letters are clear and single.", invalidSinceMs: null });
}

export function confirmRelativeAccommodationBaseline(run: RelativeAccommodationRun, sample: RelativeAccommodationSpatialSample) {
  if (!run.nraCapture || run.praCapture || run.phase === "complete") return Object.freeze({ ...run, feedback: "Capture NRA before confirming the baseline." });
  const issue = relativeAccommodationGeometryIssue(sample);
  if (issue) return Object.freeze({ ...run, feedback: issue });
  if (run.powerD !== 0) return Object.freeze({ ...run, feedback: "Remove all plus power and return the holder to 0.00 D first." });
  return Object.freeze({ ...run, phase: "pra" as const, baselineConfirmed: true, blurSinceMs: null, invalidSinceMs: null,
    feedback: "Clear, single baseline confirmed. Add minus in 0.25 D steps.", report: "The letters are clear and single." });
}

export function stepRelativeAccommodationPower(run: RelativeAccommodationRun, direction: "plus" | "minus", sample: RelativeAccommodationSpatialSample) {
  if (run.phase === "complete" || run.praCapture) return run;
  const issue = relativeAccommodationGeometryIssue(sample);
  if (issue) return Object.freeze({ ...run, feedback: issue });
  if (!run.initialClearConfirmed) return Object.freeze({ ...run, feedback: "Confirm initial binocular clarity at 0.00 D before changing power." });

  let minimum = 0, maximum = RELATIVE_HOLDER_MAX_D;
  if (run.nraCapture && !run.baselineConfirmed) {
    if (direction === "plus") return Object.freeze({ ...run, feedback: "Remove plus power toward 0.00 D before confirming baseline clarity." });
  } else if (run.baselineConfirmed) {
    minimum = RELATIVE_HOLDER_MIN_D; maximum = 0;
    if (direction === "plus") return Object.freeze({ ...run, feedback: "Continue adding minus in 0.25 D steps during PRA." });
  } else if (direction === "minus") {
    return Object.freeze({ ...run, feedback: "Continue adding plus in 0.25 D steps during NRA." });
  }

  const delta = direction === "plus" ? .25 : -.25;
  const powerD = Math.max(minimum, Math.min(maximum, roundQuarter(run.powerD + delta)));
  if (powerD === run.powerD) {
    const limit = run.nraCapture && !run.baselineConfirmed ? "0.00 D baseline" : run.baselineConfirmed ? "PRA limit" : "NRA limit";
    return Object.freeze({ ...run, feedback: `The holder is already at the ${limit}.` });
  }
  const nraEndpoint = !run.nraCapture && powerD >= RELATIVE_NRA_ENDPOINT_D;
  const praEndpoint = run.baselineConfirmed && powerD <= RELATIVE_PRA_ENDPOINT_D;
  return Object.freeze({ ...run, powerD, phase: nraEndpoint ? "confirming-nra" as const : praEndpoint ? "confirming-pra" as const
    : run.nraCapture && !run.baselineConfirmed ? powerD === 0 ? "baseline-clear" as const : "baseline" as const
    : run.baselineConfirmed ? "pra" as const : "nra" as const,
    blurSinceMs: nraEndpoint || praEndpoint ? sample.nowMs : null, invalidSinceMs: null,
    feedback: nraEndpoint || praEndpoint ? "Blur is developing; maintain binocular alignment while the response is confirmed."
      : run.nraCapture && !run.baselineConfirmed && powerD === 0 ? "0.00 D restored. Confirm clear, single baseline vision."
      : run.nraCapture && !run.baselineConfirmed ? "Continue removing plus toward 0.00 D."
      : run.baselineConfirmed ? "The letters remain clear. Continue adding minus." : "The letters remain clear. Continue adding plus.",
    report: nraEndpoint || praEndpoint ? "They are becoming blurred." : "The letters are clear and single." });
}

function cancelUnfinishedDwell(run: RelativeAccommodationRun, feedback: string) {
  const phase = run.phase === "confirming-nra" ? "nra" : run.phase === "confirming-pra" ? "pra" : run.phase;
  return Object.freeze({ ...run, phase, blurSinceMs: null, invalidSinceMs: null, feedback,
    report: run.instructionArmed ? "The letters are clear and single." : "" });
}

export function interruptRelativeAccommodation(run: RelativeAccommodationRun, reason: string) {
  if (run.phase === "complete" || run.praCapture) return run;
  return cancelUnfinishedDwell(run, `${reason} Frozen endpoints were preserved; restore alignment to continue.`);
}

export function restartRelativeAccommodationConditions(run: RelativeAccommodationRun, reason: string) {
  if (run.phase === "complete") return run;
  return Object.freeze({ ...newRelativeAccommodationRun(run.completionAwarded), feedback: `${reason} Restart NRA/PRA at 0.00 D.` });
}

export function sampleRelativeAccommodation(run: RelativeAccommodationRun, sample: RelativeAccommodationSpatialSample) {
  if (run.phase === "complete" || run.praCapture) return run;
  const issue = relativeAccommodationGeometryIssue(sample);
  if (issue) {
    if (!relativeAccommodationHasProgress(run)) return Object.freeze({ ...run, invalidSinceMs: null, feedback: issue, report: "" });
    const invalidSinceMs = run.invalidSinceMs ?? sample.nowMs;
    if (sample.nowMs - invalidSinceMs < RELATIVE_SETUP_GRACE_MS)
      return Object.freeze({ ...run, invalidSinceMs, feedback: `${issue} Restore the setup within 250 ms to continue.` });
    return cancelUnfinishedDwell(run, `${issue} Frozen endpoints were preserved; restore the setup to continue.`);
  }
  if (run.invalidSinceMs !== null) run = Object.freeze({ ...run, invalidSinceMs: null });
  if (!run.instructionArmed) return Object.freeze({ ...run, feedback: "Ask the patient to keep the line clear and single and report the first sustained blur." });
  if (!run.initialClearConfirmed) return Object.freeze({ ...run, phase: "initial-clear" as const,
    feedback: "Confirm that the near line is initially clear and single at 0.00 D.", report: "The letters are clear and single." });
  // Interruption preserves lens power, so an uncaptured endpoint must be able to
  // start a fresh dwell without requiring another dial step.
  if (run.phase === "nra" && !run.nraCapture && run.powerD >= RELATIVE_NRA_ENDPOINT_D)
    run = Object.freeze({ ...run, phase: "confirming-nra" as const, blurSinceMs: sample.nowMs });
  else if (run.phase === "pra" && run.nraCapture && run.baselineConfirmed && run.powerD <= RELATIVE_PRA_ENDPOINT_D)
    run = Object.freeze({ ...run, phase: "confirming-pra" as const, blurSinceMs: sample.nowMs });
  if (run.phase !== "confirming-nra" && run.phase !== "confirming-pra") return run;

  const blurSinceMs = run.blurSinceMs ?? sample.nowMs;
  if (sample.nowMs - blurSinceMs < RELATIVE_RESPONSE_MS) return Object.freeze({ ...run, blurSinceMs,
    feedback: "Blur is developing; maintain binocular alignment while the response is confirmed.", report: "They are becoming blurred." });
  if (run.phase === "confirming-nra") {
    const nraCapture = Object.freeze({ kind: "NRA" as const, powerD: run.powerD });
    return Object.freeze({ ...run, phase: "baseline" as const, nraCapture, blurSinceMs: null,
      feedback: "NRA endpoint frozen. Remove plus in 0.25 D steps until the holder reads 0.00 D.",
      report: "The letters remain blurred; I cannot clear them." });
  }
  const praCapture = Object.freeze({ kind: "PRA" as const, powerD: run.powerD });
  return Object.freeze({ ...run, phase: "captured" as const, praCapture, blurSinceMs: null,
    feedback: "PRA endpoint frozen. Release the holder and independently record both signed values.",
    report: "The letters remain blurred; I cannot clear them." });
}

export function restartRelativeAccommodation(run: RelativeAccommodationRun) {
  if (run.phase === "complete") return run;
  return Object.freeze({ ...newRelativeAccommodationRun(run.completionAwarded), feedback: "NRA/PRA restarted. Restore the setup and begin at 0.00 D." });
}

export function submitRelativeAccommodationRecord(run: RelativeAccommodationRun, nraEntry: string, praEntry: string) {
  if (!run.nraCapture || !run.praCapture || run.phase !== "captured")
    return Object.freeze({ ...run, feedback: "Capture both NRA and PRA endpoints before recording." });
  const nra = Number(nraEntry), pra = Number(praEntry);
  if (!Number.isFinite(nra) || !Number.isFinite(pra)) return Object.freeze({ ...run, feedback: "Enter both signed NRA and PRA values." });
  if (Math.abs(nra - run.nraCapture.powerD) > .011 || Math.abs(pra - run.praCapture.powerD) > .011)
    return Object.freeze({ ...run, feedback: "Recheck both frozen signed readings on the modeled holder scale." });
  const record = Object.freeze({ nra: run.nraCapture, pra: run.praCapture, submittedNraD: nra, submittedPraD: pra });
  return Object.freeze({ ...run, phase: "complete" as const, record, completionAwarded: true,
    feedback: "Binocular NRA and PRA recorded.", report: "" });
}

export function relativeAccommodationGuidedStep(run: RelativeAccommodationRun, sample: RelativeAccommodationSpatialSample): RelativeAccommodationGuidedStep {
  // Finished measurements remain ready to record after the holder is released.
  if (run.praCapture || run.phase === "complete")
    return { index: 9, title: run.phase === "complete" ? "Series complete" : "Record NRA and PRA", lines: [run.feedback] };
  if (!sample.correctionFitted) return { index: 0, title: "Fit near correction", lines: ["Fit the appropriate near correction in the trial frame."] };
  if (!sample.targetDocked) return { index: 1, title: "Prepare the near line", lines: ["Release the readable target on its 40 cm stand, facing the patient."] };
  if (!sample.holderHeld || !sample.holderAligned) return { index: 2, title: "Align the binocular holder", lines: ["Hold both clear apertures face-on over OD and OS. Keep the other controller free for the dial."] };
  if (!run.instructionArmed) return { index: 3, title: "Give the instruction", lines: ["Ask the patient to keep the line clear and single and report the first blur that remains blurred."] };
  if (!run.initialClearConfirmed) return { index: 4, title: "Confirm initial clarity", lines: ["At 0.00 D, confirm that the line is clear and single through both eyes."] };
  if (!run.nraCapture) return { index: 5, title: "Measure NRA", lines: [run.phase === "confirming-nra"
    ? "Hold the power steady and maintain binocular alignment while sustained blur is confirmed."
    : "Turn the dial toward plus in 0.25 D steps.", run.feedback] };
  // Returning to zero belongs only to the transition between NRA and PRA.
  if (!run.baselineConfirmed) {
    if (run.powerD !== 0) return { index: 6, title: "Return to baseline", lines: ["Turn the dial back toward 0.00 D in 0.25 D steps.", run.feedback] };
    return { index: 7, title: "Confirm clear baseline", lines: ["Confirm clear, single vision at the restored 0.00 D baseline."] };
  }
  return { index: 8, title: "Measure PRA", lines: [run.phase === "confirming-pra"
    ? "Hold the power steady and maintain binocular alignment while sustained blur is confirmed."
    : "Turn the dial toward minus in 0.25 D steps.", run.feedback] };
}

export function relativeAccommodationDisclosure(kind: "guided" | "test") {
  return Object.freeze({ showCoach: kind === "guided", showHighlights: kind === "guided" });
}

export function relativeAccommodationPatientReport(run: RelativeAccommodationRun) {
  return run.instructionArmed ? run.report || "The letters are clear and single." : "";
}
