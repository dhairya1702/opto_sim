export type NPCCaseId = "subjective" | "objective";
export type NPCEndpointKind = "break" | "recovery";
export type NPCDetectionMethod = "patient-report" | "objective-observation";
export type NPCPhase = "setup" | "start" | "approach" | "recovery-start" | "recovery" | "captured" | "release" | "entry" | "complete";

export type NPCCase = Readonly<{
  id: NPCCaseId;
  breakCm: number;
  recoveryCm: number;
  method: NPCDetectionMethod;
  breakingEye: "OS";
}>;

export const NPC_CASES: Readonly<Record<NPCCaseId, NPCCase>> = Object.freeze({
  subjective: Object.freeze({ id: "subjective", breakCm: 6, recoveryCm: 8, method: "patient-report", breakingEye: "OS" }),
  objective: Object.freeze({ id: "objective", breakCm: 5, recoveryCm: 9, method: "objective-observation", breakingEye: "OS" }),
});

export type NPCTrial = Readonly<{ number: 1 | 2 | 3; caseId: NPCCaseId }>;
export type NPCSpatialSample = Readonly<{
  nowMs: number;
  distanceCm: number;
  correctionFitted: boolean;
  ruleHeld: boolean;
  ruleDocked: boolean;
  patientFacing: boolean;
  upright: boolean;
  midlineOffsetCm: number;
  visible: boolean;
  tracking: boolean;
}>;
export type NPCMotionTrace = Readonly<{
  samples: readonly Readonly<{ nowMs: number; distanceCm: number }>[];
  valid: boolean;
  direction: "inward" | "outward" | null;
  movingMs: number;
  creditDistanceCm: number | null;
  creditAtMs: number | null;
  pauseSinceMs: number | null;
  lastIssue: string;
}>;
export type NPCEndpointCapture = Readonly<{
  kind: NPCEndpointKind;
  actualCm: number;
  method: NPCDetectionMethod;
  breakingEye: "OS";
  capturedAtMs: number;
  automatic: boolean;
}>;
export type NPCTrialCapture = Readonly<{
  caseId: NPCCaseId;
  trialNumber: 1 | 2 | 3;
  startCm: number;
  break: NPCEndpointCapture;
  recovery: NPCEndpointCapture;
  setupRevision: number;
  motionValid: true;
}>;
export type NPCRecord = Readonly<{
  caseId: NPCCaseId;
  captures: readonly NPCTrialCapture[];
  submittedBreaksCm: readonly [number, number, number];
  submittedRecoveriesCm: readonly [number, number, number];
  submittedMethod: NPCDetectionMethod;
  submittedBreakingEye: "OS";
}>;
export type NPCGuidedStep = Readonly<{ id: string; index: number; title: string; lines: readonly string[]; complete: boolean }>;

export type NPCRun = Readonly<{
  caseId: NPCCaseId;
  trialNumber: 1 | 2 | 3;
  phase: NPCPhase;
  correctionFitted: boolean;
  ruleHeld: boolean;
  ruleDocked: boolean;
  instructionArmed: boolean;
  setupRevision: number;
  startCm: number | null;
  startStableSinceMs: number | null;
  endpointStableSinceMs: number | null;
  trace: NPCMotionTrace;
  breakCapture: NPCEndpointCapture | null;
  captures: readonly NPCTrialCapture[];
  released: boolean;
  entries: Readonly<Record<string, string>>;
  record: NPCRecord | null;
  completionAwarded: boolean;
  feedback: string;
  report: string;
  eventNonce: number;
}>;

export const NPC_TRIAL_COUNT = 3;
export const NPC_START_MIN_CM = 38;
export const NPC_START_MAX_CM = 42;
export const NPC_ENDPOINT_WINDOW_CM = .5;
export const NPC_STABILITY_MS = 250;
export const NPC_MIN_SPEED_CM_S = .5;
export const NPC_MAX_SPEED_CM_S = 4;
export const NPC_JITTER_CM = .2;
export const NPC_MAX_PAUSE_MS = 1000;
export const NPC_REVERSAL_CM = .5;
export const NPC_MIDLINE_TOLERANCE_CM = 2;
export const NPC_RULE_MIN_CM = 2;
export const NPC_RULE_MAX_CM = 42;

const frozenTrace = (direction: NPCMotionTrace["direction"] = null, issue = ""): NPCMotionTrace => Object.freeze({
  samples: Object.freeze([]), valid: !issue, direction, movingMs: 0, creditDistanceCm: null, creditAtMs: null, pauseSinceMs: null, lastIssue: issue,
});
const freezeEntries = (entries: Readonly<Record<string, string>>) => Object.freeze({ ...entries });

export function newNPCRun(caseId: NPCCaseId = "subjective", completionAwarded = false): NPCRun {
  return Object.freeze({ caseId, trialNumber: 1, phase: "setup", correctionFitted: false, ruleHeld: false, ruleDocked: false,
    instructionArmed: false, setupRevision: 0, startCm: null, startStableSinceMs: null, endpointStableSinceMs: null,
    trace: frozenTrace(), breakCapture: null, captures: Object.freeze([]), released: false, entries: freezeEntries({}), record: null,
    completionAwarded, feedback: "Fit Arun's appropriate near correction.", report: "", eventNonce: 0 });
}

export const npcCaseOrder = (kind: "guided" | "test"): readonly NPCCaseId[] => kind === "test"
  ? Object.freeze(["objective", "subjective"] as const) : Object.freeze(["subjective", "objective"] as const);

export function npcRuleScalePosition(distanceCm: number) {
  return Math.max(NPC_RULE_MIN_CM, Math.min(NPC_RULE_MAX_CM, distanceCm)) / 100;
}
export function npcRuleScaleDistance(positionM: number) {
  return Math.round(Math.max(NPC_RULE_MIN_CM, Math.min(NPC_RULE_MAX_CM, positionM * 100)) * 10) / 10;
}
export function npcRuleGeometry(sample: Pick<NPCSpatialSample, "ruleDocked" | "patientFacing" | "upright" | "midlineOffsetCm">) {
  if (!sample.ruleDocked) return "Dock the patient end of the rule at the spectacle plane.";
  if (!sample.patientFacing) return "Turn the target face toward Arun.";
  if (!sample.upright) return "Level the RAF-style rule before moving the carriage.";
  if (Math.abs(sample.midlineOffsetCm) > NPC_MIDLINE_TOLERANCE_CM) return "Align the rail with the binocular midline.";
  return "";
}

const setupIssue = (run: NPCRun, sample: NPCSpatialSample) => {
  if (!sample.visible || !sample.tracking) return "Restore rule, controller, and headset tracking.";
  if (!run.correctionFitted || !sample.correctionFitted) return "Fit Arun's appropriate near correction.";
  if (!run.ruleHeld && !run.ruleDocked && !sample.ruleHeld && !sample.ruleDocked) return "Pick up the RAF-style rule.";
  const geometry = npcRuleGeometry(sample);
  if (geometry) return geometry;
  if (!run.instructionArmed) return "Tell Arun to keep the target clear and single and report sustained diplopia.";
  return "";
};

export function configureNPCRun(run: NPCRun, action: "fit-correction" | "pickup-rule" | "dock-rule" | "give-instruction" | "release-rule"): NPCRun {
  if (run.phase === "complete") return run;
  if (action === "release-rule") {
    if (run.captures.length !== NPC_TRIAL_COUNT) return Object.freeze({ ...run, feedback: "Complete all three trials before removing the rule." });
    return Object.freeze({ ...run, phase: "release", ruleHeld: false, ruleDocked: false, released: true, feedback: "Rule removed. Enter all three captured break/recovery pairs independently." });
  }
  if (run.captures.length === NPC_TRIAL_COUNT) return run;
  if (action === "fit-correction") return Object.freeze({ ...run, correctionFitted: true, feedback: "Near correction fitted. Pick up the RAF-style rule." });
  if (action === "pickup-rule") return Object.freeze({ ...run, ruleHeld: true, released: false, feedback: "Dock the patient end at the spectacle plane." });
  if (action === "dock-rule") return Object.freeze({ ...run, ruleHeld: false, ruleDocked: true, released: false, feedback: "Align the upright rule on the binocular midline." });
  return Object.freeze({ ...run, instructionArmed: true, phase: "start", feedback: "Set the carriage within 38–42 cm and hold starting fixation." });
}

const resetUnfinishedApproach = (run: NPCRun, issue: string): NPCRun => {
  const hasBreak = Boolean(run.breakCapture);
  return Object.freeze({ ...run, phase: hasBreak ? "recovery-start" : "start", startStableSinceMs: null, endpointStableSinceMs: null,
    trace: frozenTrace(hasBreak ? "outward" : "inward", issue), feedback: hasBreak
      ? `${issue} The captured break is preserved; return to its region and restart recovery.`
      : `${issue} Return the carriage to 38–42 cm and restart the inward approach.` });
};

const appendTrace = (trace: NPCMotionTrace, sample: NPCSpatialSample, movingMs = trace.movingMs, credit = false): NPCMotionTrace => Object.freeze({
  ...trace, samples: Object.freeze([...trace.samples, Object.freeze({ nowMs: sample.nowMs, distanceCm: sample.distanceCm })].slice(-240)), movingMs,
  creditDistanceCm: credit || trace.creditDistanceCm === null ? sample.distanceCm : trace.creditDistanceCm,
  creditAtMs: credit || trace.creditAtMs === null ? sample.nowMs : trace.creditAtMs,
});

const endpointInWindow = (distanceCm: number, expectedCm: number) => Math.abs(distanceCm - expectedCm) <= NPC_ENDPOINT_WINDOW_CM + 1e-8;

function freezeEndpoint(run: NPCRun, kind: NPCEndpointKind, sample: NPCSpatialSample, automatic: boolean): NPCRun {
  const authored = NPC_CASES[run.caseId];
  const endpoint: NPCEndpointCapture = Object.freeze({ kind, actualCm: Math.round(sample.distanceCm * 10) / 10, method: authored.method,
    breakingEye: authored.breakingEye, capturedAtMs: sample.nowMs, automatic });
  if (kind === "break") return Object.freeze({ ...run, phase: "recovery-start", breakCapture: endpoint, endpointStableSinceMs: null,
    trace: frozenTrace("outward"), feedback: "Break captured. Move outward from the break region to recovery.", report: npcPatientReport(run, sample.distanceCm) });
  if (!run.breakCapture || run.startCm === null) return run;
  const capture: NPCTrialCapture = Object.freeze({ caseId: run.caseId, trialNumber: run.trialNumber, startCm: run.startCm,
    break: run.breakCapture, recovery: endpoint, setupRevision: run.setupRevision, motionValid: true });
  const captures = Object.freeze([...run.captures, capture]);
  if (captures.length === NPC_TRIAL_COUNT) return Object.freeze({ ...run, phase: "captured", captures, breakCapture: null, endpointStableSinceMs: null,
    trace: frozenTrace(), feedback: "Three trials captured. Remove or release the rule before documenting.", report: npcPatientReport(run, sample.distanceCm) });
  return Object.freeze({ ...run, trialNumber: (captures.length + 1) as 1 | 2 | 3, phase: "start", captures, startCm: null,
    startStableSinceMs: null, endpointStableSinceMs: null, breakCapture: null, trace: frozenTrace(),
    feedback: `Trial ${captures.length} captured. Return to 38–42 cm for trial ${captures.length + 1}.`, report: npcPatientReport(run, sample.distanceCm) });
}

export function sampleNPC(run: NPCRun, sample: NPCSpatialSample): NPCRun {
  if (run.phase === "complete" || run.record || run.released || run.captures.length === NPC_TRIAL_COUNT) return run;
  const issue = setupIssue(run, sample);
  if (issue) return (run.phase === "approach" || run.phase === "recovery" || run.phase === "recovery-start")
    ? resetUnfinishedApproach(run, issue) : Object.freeze({ ...run, feedback: issue, report: "" });

  if (run.phase === "setup") return Object.freeze({ ...run, phase: "start", feedback: "Set the carriage within 38–42 cm." });
  if (run.phase === "start") {
    const inBand = sample.distanceCm >= NPC_START_MIN_CM && sample.distanceCm <= NPC_START_MAX_CM;
    if (!inBand) return Object.freeze({ ...run, startStableSinceMs: null, feedback: "Set the carriage within 38–42 cm before moving inward.", report: "The target is clear and single." });
    const since = run.startStableSinceMs ?? sample.nowMs;
    if (sample.nowMs - since < NPC_STABILITY_MS) return Object.freeze({ ...run, startStableSinceMs: since, feedback: "Hold valid starting fixation for 250 ms.", report: "The target is clear and single." });
    return Object.freeze({ ...run, phase: "approach", startCm: Math.round(sample.distanceCm * 10) / 10, startStableSinceMs: since,
      trace: appendTrace(frozenTrace("inward"), sample), feedback: "Move the carriage inward continuously at about 1–2 cm/s.", report: "The target is clear and single." });
  }

  if (run.phase === "recovery-start") {
    const breakCm = run.breakCapture?.actualCm;
    if (breakCm === undefined || !endpointInWindow(sample.distanceCm, breakCm)) return Object.freeze({ ...run, feedback: "Return to the captured break region before restarting outward recovery." });
    return Object.freeze({ ...run, phase: "recovery", trace: appendTrace(frozenTrace("outward"), sample),
      feedback: "Move outward continuously at about 1–2 cm/s." });
  }

  if (run.phase !== "approach" && run.phase !== "recovery") return run;
  const expected = run.phase === "approach" ? NPC_CASES[run.caseId].breakCm : NPC_CASES[run.caseId].recoveryCm;
  const kind: NPCEndpointKind = run.phase === "approach" ? "break" : "recovery";
  const last = run.trace.samples.at(-1);
  if (!last) return Object.freeze({ ...run, trace: appendTrace(run.trace, sample) });
  const creditDistance = run.trace.creditDistanceCm ?? last.distanceCm;
  const creditAt = run.trace.creditAtMs ?? last.nowMs;
  const dt = sample.nowMs - creditAt;
  if (dt <= 0) return run;
  const delta = sample.distanceCm - creditDistance;
  const absDelta = Math.abs(delta);
  const inWindow = endpointInWindow(sample.distanceCm, expected);
  let endpointSince = inWindow ? (run.endpointStableSinceMs ?? sample.nowMs) : null;
  if (absDelta <= NPC_JITTER_CM) {
    const pauseSinceMs = run.trace.pauseSinceMs ?? creditAt;
    if (sample.nowMs - pauseSinceMs > NPC_MAX_PAUSE_MS && !inWindow) return resetUnfinishedApproach(run, "The carriage paused for more than one second.");
    const next = Object.freeze({ ...run, endpointStableSinceMs: endpointSince, trace: Object.freeze({ ...appendTrace(run.trace, sample), pauseSinceMs }), report: npcPatientReport(run, sample.distanceCm),
      feedback: inWindow ? (run.caseId === "objective" ? `Hold steady, then explicitly mark the observed ${kind}.` : `Hold steady for Arun's ${kind} report.`) : run.feedback });
    if (inWindow && endpointSince !== null && sample.nowMs - endpointSince >= NPC_STABILITY_MS && run.caseId === "subjective") return freezeEndpoint(next, kind, sample, true);
    return next;
  }
  const correctDirection = kind === "break" ? delta < 0 : delta > 0;
  if (!correctDirection && absDelta > NPC_REVERSAL_CM) return resetUnfinishedApproach(run, "The carriage reversed before the endpoint was captured.");
  if (!correctDirection) return Object.freeze({ ...run, endpointStableSinceMs: null, trace: appendTrace(run.trace, sample),
    feedback: `Continue ${kind === "break" ? "inward" : "outward"}; this small opposite movement earns no motion credit.` });
  const speed = absDelta / (dt / 1000);
  if (speed > NPC_MAX_SPEED_CM_S) return resetUnfinishedApproach(run, "The carriage moved too quickly or discontinuously.");
  if (speed < NPC_MIN_SPEED_CM_S && !inWindow) return resetUnfinishedApproach(run, "Keep the carriage moving continuously; the approach was too slow.");
  endpointSince = inWindow ? sample.nowMs : null;
  const next = Object.freeze({ ...run, endpointStableSinceMs: endpointSince, trace: Object.freeze({ ...appendTrace(run.trace, sample, run.trace.movingMs + dt, true), pauseSinceMs: null }),
    report: npcPatientReport(run, sample.distanceCm), feedback: inWindow
      ? (run.caseId === "objective" ? `Hold steady, then explicitly mark the observed ${kind}.` : `Hold steady for Arun's ${kind} report.`)
      : `Continue ${kind === "break" ? "inward" : "outward"} while maintaining alignment.` });
  if (inWindow && endpointSince !== null && sample.nowMs - endpointSince >= NPC_STABILITY_MS && run.caseId === "subjective") return freezeEndpoint(next, kind, sample, true);
  return next;
}

export function markNPCObjectiveEndpoint(run: NPCRun, sample: NPCSpatialSample, callbackNonce = run.eventNonce): NPCRun {
  if (run.caseId !== "objective" || callbackNonce !== run.eventNonce || (run.phase !== "approach" && run.phase !== "recovery")) return run;
  const kind: NPCEndpointKind = run.phase === "approach" ? "break" : "recovery";
  const expected = kind === "break" ? NPC_CASES.objective.breakCm : NPC_CASES.objective.recoveryCm;
  if (!endpointInWindow(sample.distanceCm, expected) || run.endpointStableSinceMs === null || sample.nowMs - run.endpointStableSinceMs < NPC_STABILITY_MS)
    return Object.freeze({ ...run, feedback: `Hold the visible ${kind === "break" ? "OS loss of fixation" : "OS realignment"} within the scale window for 250 ms before marking.` });
  return freezeEndpoint(run, kind, sample, false);
}

export function npcPatientReport(run: NPCRun, distanceCm: number) {
  const authored = NPC_CASES[run.caseId];
  const broken = Boolean(run.breakCapture) || (run.phase === "approach" && distanceCm <= authored.breakCm);
  const recovered = broken && run.phase !== "approach" && distanceCm >= authored.recoveryCm;
  if (run.caseId === "objective") return "The target still appears clear and single.";
  if (recovered) return "It is single again.";
  if (broken) return "It has become double and stays double.";
  return "The target is clear and single.";
}

export function npcEyeState(run: NPCRun, distanceCm: number) {
  const authored = NPC_CASES[run.caseId];
  const converging = Math.max(0, Math.min(1, (40 - distanceCm) / 35));
  const broken = Boolean(run.breakCapture) || (run.phase === "approach" && distanceCm <= authored.breakCm);
  const recovered = broken && run.phase !== "approach" && distanceCm >= authored.recoveryCm;
  return Object.freeze({ converging, osDrifted: broken && !recovered });
}

export function releaseNPCRule(run: NPCRun) { return configureNPCRun(run, "release-rule"); }

export function enterNPCRecord(run: NPCRun, id: string, value: string): NPCRun {
  if (!run.released || run.record || run.phase === "complete") return run;
  return Object.freeze({ ...run, phase: "entry", entries: freezeEntries({ ...run.entries, [id]: value }), feedback: "" });
}

export const npcRecordFieldIds = Object.freeze([
  "trial-1-break", "trial-1-recovery", "trial-2-break", "trial-2-recovery", "trial-3-break", "trial-3-recovery", "detection-method", "breaking-eye",
] as const);

export function submitNPCRecord(run: NPCRun): NPCRun {
  if (!run.released || run.record || run.captures.length !== NPC_TRIAL_COUNT) return run;
  if (npcRecordFieldIds.some(id => !run.entries[id]?.trim())) return Object.freeze({ ...run, feedback: "Complete all six distances, detection method, and breaking eye." });
  const breaks = [1, 2, 3].map(number => Number(run.entries[`trial-${number}-break`])) as [number, number, number];
  const recoveries = [1, 2, 3].map(number => Number(run.entries[`trial-${number}-recovery`])) as [number, number, number];
  if ([...breaks, ...recoveries].some(value => !Number.isFinite(value))) return Object.freeze({ ...run, feedback: "Enter each captured distance as a decimal number." });
  const method = run.entries["detection-method"] as NPCDetectionMethod;
  const eye = run.entries["breaking-eye"];
  const distancesCorrect = run.captures.every((capture, index) => Math.abs(breaks[index] - capture.break.actualCm) < .051 && Math.abs(recoveries[index] - capture.recovery.actualCm) < .051);
  if (!distancesCorrect || method !== NPC_CASES[run.caseId].method || eye !== "OS") return Object.freeze({ ...run, feedback: "The entry does not match the immutable captures. Recheck every trial, the detection method, and the breaking eye." });
  const record: NPCRecord = Object.freeze({ caseId: run.caseId, captures: Object.freeze([...run.captures]), submittedBreaksCm: Object.freeze(breaks),
    submittedRecoveriesCm: Object.freeze(recoveries), submittedMethod: method, submittedBreakingEye: "OS" });
  return Object.freeze({ ...run, phase: "complete", record, completionAwarded: true, feedback: "Three-trial NPC finding recorded once." });
}

export function restartNPCTrial(run: NPCRun): NPCRun {
  if (run.phase === "complete") return run;
  return Object.freeze({ ...run, phase: "start", startCm: null, startStableSinceMs: null, endpointStableSinceMs: null, breakCapture: null,
    trace: frozenTrace(), entries: freezeEntries({}), released: false, ruleDocked: true, feedback: `Trial ${run.trialNumber} restarted; earlier completed trials are preserved.`, report: "", eventNonce: run.eventNonce + 1 });
}

export function cancelNPCRun(run: NPCRun): NPCRun {
  if (run.phase === "complete") return run;
  const fresh = newNPCRun(run.caseId, run.completionAwarded);
  return Object.freeze({ ...fresh, feedback: "Recording cancelled. The unrecorded case was cleared and restarted at trial one.", eventNonce: run.eventNonce + 1 });
}

export function interruptNPCRun(run: NPCRun, reason: string) {
  if (run.phase === "complete" || run.record || run.captures.length === NPC_TRIAL_COUNT) return run;
  return resetUnfinishedApproach(Object.freeze({ ...run, eventNonce: run.eventNonce + 1 }), reason);
}

export function reviseNPCSetup(run: NPCRun, reason: string): NPCRun {
  if (run.phase === "complete" || run.record) return run;
  return Object.freeze({ ...newNPCRun(run.caseId, run.completionAwarded), setupRevision: run.setupRevision + 1, correctionFitted: run.correctionFitted,
    feedback: `${reason} Unrecorded captures for this case were cleared.`, eventNonce: run.eventNonce + 1 });
}

export function npcGuidedStep(run: NPCRun, sample: NPCSpatialSample): NPCGuidedStep {
  const geometryReady = !npcRuleGeometry(sample);
  const currentCapture = run.captures.length === NPC_TRIAL_COUNT;
  const checks = [
    ["correction", "Fit near correction", "Fit Arun's appropriate near correction.", run.correctionFitted && sample.correctionFitted],
    ["pickup", "Pick up the rule", "Pick up the RAF-style rule by its handle.", run.ruleHeld || run.ruleDocked || sample.ruleHeld || sample.ruleDocked],
    ["dock", "Dock at spectacle plane", "Dock the patient end and align the upright rail on the binocular midline.", geometryReady],
    ["start", "Set the start distance", "Set the target within 38–42 cm.", sample.distanceCm >= NPC_START_MIN_CM && sample.distanceCm <= NPC_START_MAX_CM],
    ["instruction", "Give the patient instruction", "Ask Arun to keep the target clear and single and report sustained diplopia.", run.instructionArmed],
    ["stability", "Establish starting fixation", "Hold valid starting fixation for 250 ms.", run.phase !== "start" && run.phase !== "setup"],
    ["approach", "Move inward", "Move inward continuously at about 1–2 cm/s while preserving alignment.", Boolean(run.breakCapture) || run.captures.length > 0],
    ["break", "Capture break", run.caseId === "subjective" ? "Hold at Arun's sustained diplopia report." : "Observe OS and explicitly mark its loss of fixation.", Boolean(run.breakCapture) || run.captures.length > 0],
    ["recovery", "Move outward and capture recovery", "Reverse only after break, then move outward to recovery.", run.captures.length > 0],
    ["record", "Release and record independently", "After three trials, release the rule and enter all findings without defaults.", Boolean(run.record)],
  ] as const;
  const index = run.phase === "complete" ? 9 : Math.max(0, checks.findIndex(check => !check[3]));
  const step = checks[index];
  return Object.freeze({ id: step[0], index, title: step[1], lines: Object.freeze([step[2], `Trial ${run.trialNumber} of ${NPC_TRIAL_COUNT}.`]), complete: Boolean(run.record) && currentCapture });
}

export function npcVoiceInstruction(run: NPCRun) { return configureNPCRun(run, "give-instruction"); }
export function npcVoiceReply(run: NPCRun, distanceCm: number) { return npcPatientReport(run, distanceCm); }

export function npcDisclosure(kind: "guided" | "test") {
  return Object.freeze({ showCoach: kind === "guided", showHighlights: kind === "guided", revealCaseIdentity: kind === "guided",
    revealThresholds: false, answerBearingPhaseLabels: kind === "guided" });
}
