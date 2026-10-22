import { minusLensAmplitude, minusLensBlurPower, minusLensResponseMs, nextMinusLens } from "./minusLens";

export type MinusLensPhase = "setup" | "initial-clear" | "adding-minus" | "confirming-blur" | "captured" | "complete";
export type MinusLensSpatialSample = Readonly<{
  nowMs: number;
  correctionFitted: boolean;
  targetReady: boolean;
  occlusionReady: boolean;
  lensHeld: boolean;
  lensAligned: boolean;
  visible: boolean;
  tracking: boolean;
}>;
export type MinusLensCapture = Readonly<{ eye: "OD" | "OS"; powerD: number; amplitudeD: number }>;
export type MinusLensRecord = Readonly<{
  eye: "OD" | "OS";
  captured: MinusLensCapture;
  submittedPowerD: number;
  submittedAmplitudeD: number;
}>;
export type MinusLensRun = Readonly<{
  phase: MinusLensPhase;
  eyeIndex: number;
  instructionArmed: boolean;
  initialClearConfirmed: boolean;
  powerD: number;
  blurSinceMs: number | null;
  invalidSinceMs: number | null;
  capture: MinusLensCapture | null;
  records: readonly MinusLensRecord[];
  feedback: string;
  report: string;
  completionAwarded: boolean;
}>;
export type MinusLensGuidedStep = Readonly<{ index: number; title: string; lines: readonly string[] }>;

export const MINUS_LENS_EYES = Object.freeze(["OD", "OS"] as const);
export const MINUS_LENS_SETUP_GRACE_MS = 250;
export const minusLensEye = (run: MinusLensRun): "OD" | "OS" => MINUS_LENS_EYES[run.eyeIndex] ?? "OS";
const initialFeedback = (eye: "OD" | "OS") => `Prepare ${eye}: fit the near correction, target, and opposite-eye cover.`;

export function newMinusLensRun(completionAwarded = false): MinusLensRun {
  return Object.freeze({ phase: "setup", eyeIndex: 0, instructionArmed: false, initialClearConfirmed: false,
    powerD: 0, blurSinceMs: null, invalidSinceMs: null, capture: null, records: Object.freeze([]), feedback: initialFeedback("OD"),
    report: "", completionAwarded });
}

export function minusLensGeometryIssue(sample: MinusLensSpatialSample) {
  if (!sample.tracking) return "Restore headset and controller tracking.";
  if (!sample.visible) return "Restore the minus-lens holder to view.";
  if (!sample.correctionFitted) return "Fit the near correction.";
  if (!sample.targetReady) return "Place the readable near target at 40 cm and turn it toward the patient.";
  if (!sample.occlusionReady) return `Cover the eye opposite ${"the tested eye"}.`;
  if (!sample.lensHeld) return "Pick up the monocular minus-lens holder.";
  if (!sample.lensAligned) return "Centre the holder's visible aperture over the tested eye.";
  return "";
}

function restartCurrent(run: MinusLensRun, feedback: string): MinusLensRun {
  return Object.freeze({ ...run, phase: "setup", instructionArmed: false, initialClearConfirmed: false,
    powerD: 0, blurSinceMs: null, invalidSinceMs: null, capture: null, feedback, report: "" });
}

export function interruptMinusLens(run: MinusLensRun, reason: string): MinusLensRun {
  if (run.capture || run.phase === "complete") return run;
  return restartCurrent(run, `${reason} Restore the setup and restart ${minusLensEye(run)} at 0.00 D.`);
}

export function giveMinusLensInstruction(run: MinusLensRun, sample: MinusLensSpatialSample): MinusLensRun {
  if (run.capture || run.phase === "complete" || run.instructionArmed) return run;
  const issue = minusLensGeometryIssue(sample);
  if (issue) return Object.freeze({ ...run, feedback: issue });
  return Object.freeze({ ...run, phase: "initial-clear", instructionArmed: true, feedback: "Confirm that the selected near line is clear at 0.00 D.",
    report: "The letters are clear.", invalidSinceMs: null });
}

export function confirmMinusLensInitialClear(run: MinusLensRun, sample: MinusLensSpatialSample): MinusLensRun {
  if (run.capture || run.phase === "complete" || run.initialClearConfirmed) return run;
  const issue = minusLensGeometryIssue(sample);
  if (issue) return Object.freeze({ ...run, feedback: issue });
  if (!run.instructionArmed) return Object.freeze({ ...run, feedback: "First ask the patient to report the first sustained blur." });
  if (run.powerD !== 0) return restartCurrent(run, "Return the dial to 0.00 D before confirming initial clarity.");
  return Object.freeze({ ...run, phase: "adding-minus", initialClearConfirmed: true, feedback: "Initial clarity confirmed. Add minus in 0.25 D steps.",
    report: "The letters are clear.", invalidSinceMs: null });
}

export function stepMinusLensPower(run: MinusLensRun, direction: "add" | "remove", sample: MinusLensSpatialSample): MinusLensRun {
  if (run.capture || run.phase === "complete") return run;
  const issue = minusLensGeometryIssue(sample);
  if (issue) return Object.freeze({ ...run, feedback: issue });
  if (!run.initialClearConfirmed) return Object.freeze({ ...run, feedback: "Confirm that the line is initially clear at 0.00 D before changing power." });
  const powerD = nextMinusLens(run.powerD, direction);
  if (powerD === run.powerD) return Object.freeze({ ...run, feedback: direction === "add"
    ? "The holder is already at its −4.00 D limit." : "The holder is already at 0.00 D." });
  const endpoint = powerD === minusLensBlurPower;
  return Object.freeze({ ...run, powerD, phase: endpoint ? "confirming-blur" : "adding-minus",
    blurSinceMs: endpoint ? sample.nowMs : null, invalidSinceMs: null,
    feedback: endpoint ? "Blur is developing; maintain alignment while the response is confirmed." : "The letters remain clear. Continue in 0.25 D steps.",
    report: endpoint ? "They are becoming blurred." : "The letters are clear." });
}

export function sampleMinusLens(run: MinusLensRun, sample: MinusLensSpatialSample): MinusLensRun {
  if (run.capture || run.phase === "complete") return run;
  const issue = minusLensGeometryIssue(sample);
  if (issue) {
    const hasProgress = run.instructionArmed || run.initialClearConfirmed || run.powerD !== 0;
    if (!hasProgress) return Object.freeze({ ...run, invalidSinceMs: null, feedback: issue, report: "" });
    const invalidSinceMs = run.invalidSinceMs ?? sample.nowMs;
    // Grace preserves setup, not sustained-blur credit across invalid geometry.
    if (sample.nowMs - invalidSinceMs < MINUS_LENS_SETUP_GRACE_MS)
      return Object.freeze({ ...run, invalidSinceMs, blurSinceMs: null, feedback: `${issue} Restore the setup within 250 ms to continue.` });
    return restartCurrent(run, `${issue} Restart ${minusLensEye(run)} at 0.00 D.`);
  }
  if (run.invalidSinceMs !== null) {
    if (sample.nowMs - run.invalidSinceMs >= MINUS_LENS_SETUP_GRACE_MS)
      return restartCurrent(run, `The setup interruption exceeded 250 ms. Restart ${minusLensEye(run)} at 0.00 D.`);
    run = Object.freeze({ ...run, invalidSinceMs: null });
  }
  if (!run.instructionArmed) return Object.freeze({ ...run, feedback: "Ask the patient to report the first blur that remains blurred." });
  if (!run.initialClearConfirmed) return Object.freeze({ ...run, phase: "initial-clear", feedback: "Confirm that the selected line is clear at 0.00 D.", report: "The letters are clear." });
  if (run.powerD !== minusLensBlurPower) return run;
  const blurSinceMs = run.blurSinceMs ?? sample.nowMs;
  if (sample.nowMs - blurSinceMs < minusLensResponseMs) return Object.freeze({ ...run, phase: "confirming-blur", blurSinceMs,
    feedback: "Blur is developing; maintain alignment while the response is confirmed.", report: "They are becoming blurred." });
  const capture = Object.freeze({ eye: minusLensEye(run), powerD: minusLensBlurPower,
    amplitudeD: minusLensAmplitude(minusLensBlurPower) });
  return Object.freeze({ ...run, phase: "captured", capture, blurSinceMs, invalidSinceMs: null,
    feedback: `${capture.eye} endpoint frozen. Read the added-minus power and calculate minus added + 2.50 D.`,
    report: "The letters remain blurred; I cannot clear them." });
}

export function restartMinusLensEye(run: MinusLensRun): MinusLensRun {
  if (run.phase === "complete") return run;
  return restartCurrent(run, `${minusLensEye(run)} restarted. Restore the setup and begin at 0.00 D.`);
}

export function submitMinusLensRecord(run: MinusLensRun, powerEntry: string, amplitudeEntry: string): MinusLensRun {
  if (!run.capture || run.phase !== "captured") return Object.freeze({ ...run, feedback: "Capture the current eye before recording." });
  const power = Number(powerEntry), amplitude = Number(amplitudeEntry);
  if (!Number.isFinite(power) || !Number.isFinite(amplitude))
    return Object.freeze({ ...run, feedback: "Enter both the raw added-minus power and calculated amplitude." });
  if (Math.abs(power - run.capture.powerD) > .011 || Math.abs(amplitude - run.capture.amplitudeD) > .011)
    return Object.freeze({ ...run, feedback: "Recheck the frozen lens scale and the minus-added + 2.50 D calculation." });
  const record = Object.freeze({ eye: run.capture.eye, captured: run.capture, submittedPowerD: power, submittedAmplitudeD: amplitude });
  const records = Object.freeze([...run.records, record]);
  if (run.eyeIndex === MINUS_LENS_EYES.length - 1) return Object.freeze({ ...run, phase: "complete", records, capture: null,
    completionAwarded: true, feedback: "OD and OS minus-lens amplitudes recorded.", report: "" });
  const eyeIndex = run.eyeIndex + 1;
  return Object.freeze({ ...run, phase: "setup", eyeIndex, instructionArmed: false, initialClearConfirmed: false, powerD: 0,
    blurSinceMs: null, invalidSinceMs: null, capture: null, records,
    feedback: `${record.eye} saved. Move the cover and lens holder to prepare ${MINUS_LENS_EYES[eyeIndex]} at 0.00 D.`, report: "" });
}

export function minusLensGuidedStep(run: MinusLensRun, sample: MinusLensSpatialSample): MinusLensGuidedStep {
  const eye = minusLensEye(run);
  if (run.capture || run.phase === "complete")
    return { index: 7, title: run.phase === "complete" ? "Series complete" : `Record ${eye}`, lines: [run.feedback] };
  if (!sample.correctionFitted) return { index: 0, title: "Fit near correction", lines: ["Fit the appropriate near correction in the trial frame."] };
  if (!sample.targetReady) return { index: 1, title: "Prepare the near line", lines: ["Release the readable near target on its 40 cm stand, facing the patient."] };
  if (!sample.occlusionReady) return { index: 2, title: `Prepare ${eye}`, lines: [eye === "OD" ? "Cover OS to test OD." : "Move the cover to OD to test OS."] };
  if (!sample.lensHeld || !sample.lensAligned) return { index: 3, title: "Align the lens holder", lines: [`Hold its single visible aperture over ${eye}. Keep the other controller free for the dial.`] };
  if (!run.instructionArmed) return { index: 4, title: "Give the instruction", lines: ["Ask the patient to report the first blur that remains blurred."] };
  if (!run.initialClearConfirmed) return { index: 5, title: "Confirm initial clarity", lines: ["At 0.00 D, confirm that the selected letter line is clear."] };
  return { index: 6, title: "Add minus", lines: ["Turn the physical dial in 0.25 D steps while maintaining eye alignment.", run.feedback] };
}

export function minusLensDisclosure(kind: "guided" | "test") {
  return Object.freeze({ showCoach: kind === "guided", showHighlights: kind === "guided" });
}

export function minusLensPatientReport(run: MinusLensRun) {
  return run.instructionArmed ? run.report || "The letters are clear." : "";
}
