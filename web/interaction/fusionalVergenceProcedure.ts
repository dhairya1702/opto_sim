import {
  ROTARY_PRISM_DIAL_SWEEP_RAD, ROTARY_PRISM_ENDPOINT_WINDOW, ROTARY_PRISM_JITTER, ROTARY_PRISM_JUMP,
  ROTARY_PRISM_MAX_DELTA, ROTARY_PRISM_MAX_PAUSE_MS, ROTARY_PRISM_MAX_SPEED, ROTARY_PRISM_MIN_SPEED,
  ROTARY_PRISM_REVERSAL, ROTARY_PRISM_ROLL_TOLERANCE_RAD, ROTARY_PRISM_STABILITY_MS, ROTARY_PRISM_ZERO_WINDOW,
  appendRotaryPrismTrace, newRotaryPrismTrace, normalizeRotaryPrismRoll, rotaryPowerAtZero,
  rotaryPowerInWindow, rotaryPrismBaseFromRoll, rotaryPrismDialAngleToPower, rotaryPrismPowerToDialAngle,
  roundedRotaryPower, sampleRotaryPrismMotion, type RotaryPrismTrace,
} from "./rotaryPrismProcedure";

export type FusionalBase = "BI" | "BO";
export type FusionalEndpoint = "blur" | "break" | "recovery";
export type FusionalPhase = "setup" | "baseline" | "increase" | "decrease-start" | "decrease" | "zero-reset" | "bo-orient" | "captured" | "release" | "entry" | "complete";

export type FusionalCase = Readonly<{
  id: "arun-distance-01";
  endpoints: Readonly<Record<FusionalBase, Readonly<{ blur: number | null; break: number; recovery: number }>>>;
}>;

export const FUSIONAL_DISTANCE_CASE: FusionalCase = Object.freeze({
  id: "arun-distance-01",
  endpoints: Object.freeze({
    BI: Object.freeze({ blur: null, break: 7, recovery: 4 }),
    BO: Object.freeze({ blur: 9, break: 19, recovery: 12 }),
  }),
});

export type FusionalSpatialSample = Readonly<{
  nowMs: number;
  power: number;
  base: FusionalBase | null;
  correctionFitted: boolean;
  targetEstablished: boolean;
  prismHeld: boolean;
  alignedOD: boolean;
  patientFacing: boolean;
  tiltValid: boolean;
  visible: boolean;
  tracking: boolean;
}>;

export type FusionalPowerTrace = RotaryPrismTrace;

export type FusionalEndpointCapture = Readonly<{
  kind: FusionalEndpoint;
  actualDelta: number | "X";
  capturedAtMs: number;
  automatic: true;
}>;

export type FusionalBaseCapture = Readonly<{
  base: FusionalBase;
  blur: FusionalEndpointCapture;
  break: FusionalEndpointCapture;
  recovery: FusionalEndpointCapture;
  setupRevision: number;
  motionValid: true;
}>;

export type FusionalRecord = Readonly<{
  caseId: FusionalCase["id"];
  captures: Readonly<Record<FusionalBase, FusionalBaseCapture>>;
  submitted: Readonly<Record<FusionalBase, Readonly<{ blur: number | "X"; break: number; recovery: number }>>>;
}>;

export type FusionalGuidedStep = Readonly<{ id: string; index: number; title: string; lines: readonly string[]; complete: boolean }>;

export type FusionalRun = Readonly<{
  phase: FusionalPhase;
  base: FusionalBase;
  correctionFitted: boolean;
  targetEstablished: boolean;
  instructionArmed: boolean;
  prismHeld: boolean;
  setupRevision: number;
  baselineStableSinceMs: number | null;
  endpointStableSinceMs: number | null;
  zeroStableSinceMs: number | null;
  trace: FusionalPowerTrace;
  pendingBlur: FusionalEndpointCapture | null;
  pendingBreak: FusionalEndpointCapture | null;
  captures: Readonly<Partial<Record<FusionalBase, FusionalBaseCapture>>>;
  released: boolean;
  entries: Readonly<Record<string, string>>;
  record: FusionalRecord | null;
  completionAwarded: boolean;
  feedback: string;
  report: string;
  eventNonce: number;
}>;

export const FUSIONAL_MAX_DELTA = ROTARY_PRISM_MAX_DELTA;
export const FUSIONAL_STABILITY_MS = ROTARY_PRISM_STABILITY_MS;
export const FUSIONAL_ENDPOINT_WINDOW = ROTARY_PRISM_ENDPOINT_WINDOW;
export const FUSIONAL_MIN_SPEED = ROTARY_PRISM_MIN_SPEED;
export const FUSIONAL_MAX_SPEED = ROTARY_PRISM_MAX_SPEED;
export const FUSIONAL_JITTER = ROTARY_PRISM_JITTER;
export const FUSIONAL_MAX_PAUSE_MS = ROTARY_PRISM_MAX_PAUSE_MS;
export const FUSIONAL_REVERSAL = ROTARY_PRISM_REVERSAL;
export const FUSIONAL_JUMP = ROTARY_PRISM_JUMP;
export const FUSIONAL_ZERO_WINDOW = ROTARY_PRISM_ZERO_WINDOW;
export const FUSIONAL_DIAL_SWEEP_RAD = ROTARY_PRISM_DIAL_SWEEP_RAD;
export const FUSIONAL_ROLL_TOLERANCE_RAD = ROTARY_PRISM_ROLL_TOLERANCE_RAD;

const freezeEntries = (entries: Readonly<Record<string, string>>) => Object.freeze({ ...entries });
const freezeCaptures = (captures: Readonly<Partial<Record<FusionalBase, FusionalBaseCapture>>>) => Object.freeze({ ...captures });
const newTrace = newRotaryPrismTrace;

export function newFusionalRun(completionAwarded = false): FusionalRun {
  return Object.freeze({ phase: "setup", base: "BI", correctionFitted: false, targetEstablished: false, instructionArmed: false,
    prismHeld: false, setupRevision: 0, baselineStableSinceMs: null, endpointStableSinceMs: null, zeroStableSinceMs: null,
    trace: newTrace(), pendingBlur: null, pendingBreak: null, captures: freezeCaptures({}), released: false,
    entries: freezeEntries({}), record: null, completionAwarded, feedback: "Fit Arun's appropriate distance correction.", report: "",
    eventNonce: 0 });
}

const roundedPower = roundedRotaryPower;
const inWindow = rotaryPowerInWindow;
const atZero = rotaryPowerAtZero;

export function normalizeFusionalRoll(rollRad: number) {
  return normalizeRotaryPrismRoll(rollRad);
}

export function fusionalBaseFromRoll(rollRad: number): FusionalBase | null {
  const base = rotaryPrismBaseFromRoll(rollRad);
  return base === "BI" || base === "BO" ? base : null;
}

export function fusionalPowerToDialAngle(power: number) {
  return rotaryPrismPowerToDialAngle(power);
}

export function fusionalDialAngleToPower(angleRad: number) {
  return rotaryPrismDialAngleToPower(angleRad);
}

export function fusionalPrismGeometry(sample: Pick<FusionalSpatialSample, "prismHeld" | "alignedOD" | "patientFacing" | "tiltValid" | "base">) {
  if (!sample.prismHeld) return "Pick up the dedicated rotary prism.";
  if (!sample.patientFacing) return "Turn the optical aperture toward Arun.";
  if (!sample.alignedOD) return "Align the aperture before OD.";
  if (!sample.tiltValid || !sample.base) return "Level the prism and use its physical BI or BO orientation marking.";
  return "";
}

const setupIssue = (run: FusionalRun, sample: FusionalSpatialSample) => {
  if (!sample.visible || !sample.tracking) return "Restore prism, controller, and headset tracking.";
  if (!run.correctionFitted || !sample.correctionFitted) return "Fit Arun's appropriate distance correction.";
  if (!run.targetEstablished || !sample.targetEstablished) return "Establish the illustrative mirrored 6 m isolated target.";
  if (!run.instructionArmed) return "Tell Arun to report first sustained blur, sustained diplopia, and when the target is single again.";
  const geometry = fusionalPrismGeometry(sample);
  if (geometry) return geometry;
  if (sample.base !== run.base) return run.base === "BI" ? "Orient the prism BI before starting the first run." : "Return to zero and orient the prism BO for the second run.";
  return "";
};

export function configureFusionalRun(run: FusionalRun, action: "fit-correction" | "establish-target" | "give-instruction" | "pickup-prism" | "release-prism"): FusionalRun {
  if (run.phase === "complete") return run;
  if (action === "release-prism") {
    if (!run.captures.BI || !run.captures.BO) return Object.freeze({ ...run, feedback: "Complete BI and BO before releasing the prism." });
    return Object.freeze({ ...run, phase: "release", prismHeld: false, released: true,
      feedback: "Prism released. Independently document all six acquired fields." });
  }
  if (run.released || run.record) return run;
  if (action === "fit-correction") return Object.freeze({ ...run, correctionFitted: true, feedback: "Distance correction fitted." });
  if (action === "establish-target") return Object.freeze({ ...run, targetEstablished: true, feedback: "Mirrored distance target established." });
  if (action === "give-instruction") return Object.freeze({ ...run, instructionArmed: true, phase: run.phase === "setup" ? "baseline" : run.phase,
    feedback: "Reporting armed. Align the rotary prism before OD at zero demand." });
  return Object.freeze({ ...run, prismHeld: true, released: false, feedback: "Align the aperture before OD at zero demand." });
}

const appendTrace = (trace: FusionalPowerTrace, sample: FusionalSpatialSample, credit = false): FusionalPowerTrace =>
  appendRotaryPrismTrace(trace, sample.nowMs, sample.power, credit);

const resetUnfinishedBase = (run: FusionalRun, issue: string): FusionalRun => {
  const preserveBIReset = Boolean(run.captures.BI) && run.base === "BI";
  return Object.freeze({ ...run,
  phase: preserveBIReset ? "zero-reset" : "baseline", baselineStableSinceMs: null, endpointStableSinceMs: null,
  zeroStableSinceMs: null, trace: newTrace(null, issue), pendingBlur: null, pendingBreak: null,
  feedback: preserveBIReset
    ? `${issue} The completed BI capture is preserved; return to zero and confirm stable re-fusion before BO.`
    : `${issue} ${run.captures.BI && run.base === "BO" ? "The completed BI capture is preserved; " : ""}Return to zero and restart the ${run.base} baseline.`,
  report: "The target is clear and single.", eventNonce: run.eventNonce + 1,
  });
};

const endpointCapture = (kind: FusionalEndpoint, sample: FusionalSpatialSample, value?: "X"): FusionalEndpointCapture => Object.freeze({
  kind, actualDelta: value ?? roundedPower(sample.power), capturedAtMs: sample.nowMs, automatic: true,
});

function captureEndpoint(run: FusionalRun, kind: FusionalEndpoint, sample: FusionalSpatialSample): FusionalRun {
  if (kind === "blur") return Object.freeze({ ...run, pendingBlur: endpointCapture("blur", sample), endpointStableSinceMs: null,
    trace: appendTrace(newTrace("increase"), sample, true), feedback: "Sustained blur captured automatically. Continue increasing smoothly toward diplopia.",
    report: fusionalPatientReport(run, sample.power) });
  if (kind === "break") {
    const blur = run.base === "BI" ? endpointCapture("blur", sample, "X") : run.pendingBlur;
    if (!blur) return run;
    return Object.freeze({ ...run, phase: "decrease-start", pendingBlur: blur, pendingBreak: endpointCapture("break", sample), endpointStableSinceMs: null,
      trace: newTrace("decrease"), feedback: run.base === "BI"
        ? "Diplopia captured; BI blur recorded as X. Begin reducing demand from the break region."
        : "Diplopia captured. Begin reducing demand from the break region.", report: "The target is double and stays double." });
  }
  if (!run.pendingBlur || !run.pendingBreak) return run;
  const capture: FusionalBaseCapture = Object.freeze({ base: run.base, blur: run.pendingBlur, break: run.pendingBreak,
    recovery: endpointCapture("recovery", sample), setupRevision: run.setupRevision, motionValid: true });
  const captures = freezeCaptures({ ...run.captures, [run.base]: capture });
  if (run.base === "BI") return Object.freeze({ ...run, phase: "zero-reset", captures, pendingBlur: null, pendingBreak: null,
    endpointStableSinceMs: null, zeroStableSinceMs: null, trace: newTrace("decrease"),
    feedback: "BI captured. Continue reducing to zero and hold stable re-fusion before reorienting BO.", report: "It is single again." });
  return Object.freeze({ ...run, phase: "captured", captures, pendingBlur: null, pendingBreak: null, endpointStableSinceMs: null,
    trace: newTrace(), feedback: "BI and BO captured. Release the rotary prism before documentation.", report: "It is single again." });
}

function motionSample(run: FusionalRun, sample: FusionalSpatialSample, direction: "increase" | "decrease", target: number, kind: FusionalEndpoint) {
  const result = sampleRotaryPrismMotion(run.trace, run.endpointStableSinceMs, sample, direction, target);
  if (result.resetIssue) return resetUnfinishedBase(run, result.resetIssue);
  const next = Object.freeze({ ...run, endpointStableSinceMs: result.endpointStableSinceMs, trace: result.trace,
    report: fusionalPatientReport(run, sample.power), feedback: result.atEndpoint
      ? `Hold steady for Arun's sustained ${kind === "recovery" ? "single" : kind} report.`
      : result.advanced ? `Continue ${direction === "increase" ? "increasing" : "reducing"} smoothly at about 1–2Δ/s.`
      : `Continue ${direction === "increase" ? "increasing" : "reducing"}; small opposite jitter earns no motion credit.` });
  return result.capture ? captureEndpoint(next, kind, sample) : next;
}

export function sampleFusionalRun(run: FusionalRun, sample: FusionalSpatialSample): FusionalRun {
  if (run.phase === "complete" || run.record || run.released || run.phase === "captured") return run;
  const issue = setupIssue(run, sample);
  if (issue) {
    const active = ["increase", "decrease-start", "decrease", "zero-reset"].includes(run.phase);
    return active ? resetUnfinishedBase(run, issue) : Object.freeze({ ...run, prismHeld: sample.prismHeld, feedback: issue, report: "" });
  }
  let current = run.prismHeld === sample.prismHeld ? run : Object.freeze({ ...run, prismHeld: sample.prismHeld });
  if (current.phase === "setup") current = Object.freeze({ ...current, phase: "baseline" });
  if (current.phase === "bo-orient") {
    if (sample.base !== "BO" || !atZero(sample.power)) return Object.freeze({ ...current, feedback: "At zero demand, physically reorient the prism BO before OD." });
    current = Object.freeze({ ...current, base: "BO", phase: "baseline", baselineStableSinceMs: null, trace: newTrace(),
      feedback: "Hold the BO zero-demand baseline for 250 ms." });
  }
  if (current.phase === "baseline") {
    if (!atZero(sample.power)) return Object.freeze({ ...current, baselineStableSinceMs: null, feedback: "Return the dial to zero before establishing baseline fixation." });
    const since = current.baselineStableSinceMs ?? sample.nowMs;
    if (sample.nowMs - since < FUSIONAL_STABILITY_MS) return Object.freeze({ ...current, baselineStableSinceMs: since,
      feedback: "Hold valid zero-demand baseline fixation for 250 ms.", report: "The target is clear and single." });
    return Object.freeze({ ...current, phase: "increase", baselineStableSinceMs: since, trace: appendTrace(newTrace("increase"), sample, true),
      feedback: `Increase ${current.base} demand gradually at about 1–2Δ/s.`, report: "The target is clear and single." });
  }
  if (current.phase === "decrease-start") {
    const breakPower = current.pendingBreak?.actualDelta;
    if (typeof breakPower !== "number" || !inWindow(sample.power, breakPower)) return Object.freeze({ ...current,
      feedback: "Return to the captured break region before beginning recovery." });
    return Object.freeze({ ...current, phase: "decrease", trace: appendTrace(newTrace("decrease"), sample, true),
      feedback: "Reduce demand smoothly at about 1–2Δ/s." });
  }
  if (current.phase === "zero-reset") {
    const next = motionSample(current, sample, "decrease", 0, "recovery");
    if (next.phase !== "zero-reset") return next;
    if (!atZero(sample.power)) return next;
    const since = current.zeroStableSinceMs ?? sample.nowMs;
    if (sample.nowMs - since < FUSIONAL_STABILITY_MS) return Object.freeze({ ...next, zeroStableSinceMs: since,
      feedback: "Hold zero demand and stable re-fusion for 250 ms." });
    return Object.freeze({ ...next, phase: "bo-orient", base: "BO", zeroStableSinceMs: since, trace: newTrace(),
      feedback: "Stable re-fusion confirmed. Reorient the prism BO while keeping the dial at zero." });
  }
  if (current.phase === "increase") {
    const finding = FUSIONAL_DISTANCE_CASE.endpoints[current.base];
    const kind: FusionalEndpoint = current.base === "BO" && !current.pendingBlur ? "blur" : "break";
    return motionSample(current, sample, "increase", kind === "blur" ? finding.blur! : finding.break, kind);
  }
  if (current.phase === "decrease") return motionSample(current, sample, "decrease", FUSIONAL_DISTANCE_CASE.endpoints[current.base].recovery, "recovery");
  return current;
}

export function fusionalPatientReport(run: FusionalRun, power: number) {
  const finding = FUSIONAL_DISTANCE_CASE.endpoints[run.base];
  const broken = Boolean(run.pendingBreak) || (run.phase === "increase" && power >= finding.break - FUSIONAL_ENDPOINT_WINDOW);
  const recovered = broken && (run.phase === "decrease" || run.phase === "zero-reset" || run.phase === "bo-orient" || run.phase === "captured") && power <= finding.recovery + FUSIONAL_ENDPOINT_WINDOW;
  if (recovered) return "It is single again.";
  if (broken) return "The target is double and stays double.";
  if (run.base === "BO" && finding.blur !== null && power >= finding.blur - FUSIONAL_ENDPOINT_WINDOW) return "The target has become blurred and stays blurred.";
  return "The target is clear and single.";
}

export function fusionalEyeState(run: FusionalRun, power: number) {
  const finding = FUSIONAL_DISTANCE_CASE.endpoints[run.base];
  const broken = Boolean(run.pendingBreak) || (run.phase === "increase" && power >= finding.break - FUSIONAL_ENDPOINT_WINDOW);
  const recovered = broken && ["decrease", "zero-reset", "bo-orient", "captured", "release", "entry", "complete"].includes(run.phase) && power <= finding.recovery + FUSIONAL_ENDPOINT_WINDOW;
  const demand = Math.min(.027, Math.max(0, power) * .00135);
  const fusedOD = run.base === "BO" ? demand : -demand;
  const drift = run.base === "BO" ? -.045 : .045;
  return Object.freeze({ broken: broken && !recovered, OD: broken && !recovered ? drift : fusedOD, OS: broken && !recovered ? -drift : -fusedOD });
}

export function interruptFusionalRun(run: FusionalRun, reason: string) {
  if (run.phase === "complete" || run.record || run.phase === "captured" || run.released) return run;
  return resetUnfinishedBase(run, reason);
}

export function reviseFusionalSetup(run: FusionalRun, reason: string, correctionStillFitted = true): FusionalRun {
  if (run.phase === "complete" || run.record) return run;
  const preserveBI = run.captures.BI;
  return Object.freeze({ ...newFusionalRun(run.completionAwarded), correctionFitted: correctionStillFitted && run.correctionFitted,
    targetEstablished: run.targetEstablished, instructionArmed: run.instructionArmed, setupRevision: run.setupRevision + 1,
    base: preserveBI ? "BO" : "BI", phase: preserveBI ? "baseline" : "baseline", captures: freezeCaptures(preserveBI ? { BI: preserveBI } : {}),
    feedback: `${reason} The unrecorded ${preserveBI ? "BO" : "BI"} run was cleared${preserveBI ? "; completed BI is preserved" : ""}.`,
    eventNonce: run.eventNonce + 1 });
}

export function releaseFusionalPrism(run: FusionalRun) { return configureFusionalRun(run, "release-prism"); }

export const fusionalRecordFieldIds = Object.freeze(["bi-blur", "bi-break", "bi-recovery", "bo-blur", "bo-break", "bo-recovery"] as const);

export function enterFusionalRecord(run: FusionalRun, id: string, value: string): FusionalRun {
  if (!run.released || run.record || run.phase === "complete") return run;
  return Object.freeze({ ...run, phase: "entry", entries: freezeEntries({ ...run.entries, [id]: value }), feedback: "" });
}

export function submitFusionalRecord(run: FusionalRun, callbackNonce = run.eventNonce): FusionalRun {
  if (callbackNonce !== run.eventNonce || !run.released || run.record || !run.captures.BI || !run.captures.BO) return run;
  if (fusionalRecordFieldIds.some(id => !run.entries[id]?.trim())) return Object.freeze({ ...run, feedback: "Complete all six fields, using X for BI blur." });
  if (run.entries["bi-blur"].trim().toUpperCase() !== "X") return Object.freeze({ ...run, feedback: "BI blur must be documented as X when break occurred without a blur report." });
  const read = (id: string) => Number(run.entries[id]);
  const numericIds = fusionalRecordFieldIds.filter(id => id !== "bi-blur");
  if (numericIds.some(id => !Number.isFinite(read(id)))) return Object.freeze({ ...run, feedback: "Enter X for BI blur and decimal prism values for all other endpoints." });
  const expected = { "bi-break": run.captures.BI.break.actualDelta, "bi-recovery": run.captures.BI.recovery.actualDelta,
    "bo-blur": run.captures.BO.blur.actualDelta, "bo-break": run.captures.BO.break.actualDelta, "bo-recovery": run.captures.BO.recovery.actualDelta } as const;
  if (Object.entries(expected).some(([id, value]) => typeof value !== "number" || Math.abs(read(id) - value) >= .051))
    return Object.freeze({ ...run, feedback: "The entry does not match the immutable captured dial readings. Recheck all six fields." });
  const submitted = Object.freeze({
    BI: Object.freeze({ blur: "X" as const, break: read("bi-break"), recovery: read("bi-recovery") }),
    BO: Object.freeze({ blur: read("bo-blur"), break: read("bo-break"), recovery: read("bo-recovery") }),
  });
  const record: FusionalRecord = Object.freeze({ caseId: FUSIONAL_DISTANCE_CASE.id,
    captures: Object.freeze({ BI: run.captures.BI, BO: run.captures.BO }), submitted });
  return Object.freeze({ ...run, phase: "complete", record, completionAwarded: true, feedback: "Horizontal distance vergence finding recorded once." });
}

export function cancelFusionalRun(run: FusionalRun) {
  if (run.phase === "complete") return run;
  const fresh = newFusionalRun(run.completionAwarded);
  return Object.freeze({ ...fresh, feedback: "Recording cancelled. The unrecorded attempt was cleared.", eventNonce: run.eventNonce + 1 });
}

export function fusionalGuidedStep(run: FusionalRun, sample: FusionalSpatialSample): FusionalGuidedStep {
  const geometryReady = !fusionalPrismGeometry(sample);
  const checks = [
    ["correction", "Fit distance correction", "Fit Arun's appropriate distance correction.", run.correctionFitted && sample.correctionFitted],
    ["target", "Establish the target", "Use the illustrative mirrored 6 m isolated target.", run.targetEstablished && sample.targetEstablished],
    ["instruction", "Give the reporting instruction", "Ask for first sustained blur, diplopia, and recovery to single.", run.instructionArmed],
    ["pickup", "Pick up the rotary prism", "Hold its grip while the free hand operates the dial.", run.prismHeld || sample.prismHeld],
    ["align", "Align before OD", "Centre the patient-facing aperture before OD in the required orientation.", geometryReady],
    ["baseline", "Hold zero baseline", "Hold valid zero-demand fixation for 250 ms.", run.phase !== "setup" && run.phase !== "baseline"],
    ["bi-increase", "Increase BI demand", "Increase continuously at about 1–2Δ/s; reports capture automatically.", Boolean(run.captures.BI) || run.base === "BO"],
    ["bi-recovery", "Reduce BI to recovery", "After diplopia, reduce smoothly until Arun reports single.", Boolean(run.captures.BI)],
    ["bo-run", "Reset and complete BO", "Return to zero, confirm re-fusion, reorient BO, then repeat the full run.", Boolean(run.captures.BO)],
    ["record", "Release and record", "Release the prism and independently enter all six acquired fields.", Boolean(run.record)],
  ] as const;
  const index = run.phase === "complete" ? 9 : Math.max(0, checks.findIndex(check => !check[3]));
  const step = checks[index];
  return Object.freeze({ id: step[0], index, title: step[1], lines: Object.freeze([step[2]]), complete: Boolean(run.record) });
}

export function fusionalDisclosure(kind: "guided" | "test") {
  return Object.freeze({ showCoach: kind === "guided", showHighlights: kind === "guided", revealThresholds: false,
    answerBearingPhaseLabels: kind === "guided" });
}

export function fusionalVoiceInstruction(run: FusionalRun) { return configureFusionalRun(run, "give-instruction"); }
export function fusionalVoiceReply(run: FusionalRun, power: number) { return fusionalPatientReport(run, power); }
