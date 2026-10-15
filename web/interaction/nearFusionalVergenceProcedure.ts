import {
  ROTARY_PRISM_DIAL_SWEEP_RAD, ROTARY_PRISM_ENDPOINT_WINDOW, ROTARY_PRISM_MAX_DELTA,
  ROTARY_PRISM_STABILITY_MS, appendRotaryPrismTrace, newRotaryPrismTrace, rotaryPowerAtZero,
  rotaryPowerInWindow, rotaryPrismBaseFromRoll, rotaryPrismDialAngleToPower, rotaryPrismPowerToDialAngle,
  roundedRotaryPower, sampleRotaryPrismMotion, type RotaryPrismTrace,
} from "./rotaryPrismProcedure";

export type NearFusionalBase = "BI" | "BO";
export type NearFusionalEndpoint = "blur" | "break" | "recovery";
export type NearFusionalPhase = "setup" | "baseline" | "increase" | "decrease-start" | "decrease" | "zero-reset" | "bo-orient" | "captured" | "release" | "entry" | "complete";

export type NearFusionalCase = Readonly<{
  id: "arun-horizontal-near-01";
  endpoints: Readonly<Record<NearFusionalBase, Readonly<{ blur: number | null; break: number; recovery: number }>>>;
}>;

export const NEAR_FUSIONAL_CASE: NearFusionalCase = Object.freeze({
  id: "arun-horizontal-near-01",
  endpoints: Object.freeze({
    BI: Object.freeze({ blur: 13, break: 21, recovery: 13 }),
    BO: Object.freeze({ blur: 17, break: 21, recovery: 11 }),
  }),
});

export type NearFusionalSpatialSample = Readonly<{
  nowMs: number;
  power: number;
  base: NearFusionalBase | null;
  correctionFitted: boolean;
  targetEstablished: boolean;
  targetDistanceCm: number;
  prismHeld: boolean;
  alignedOD: boolean;
  patientFacing: boolean;
  tiltValid: boolean;
  visible: boolean;
  tracking: boolean;
}>;

export type NearFusionalEndpointCapture = Readonly<{
  kind: NearFusionalEndpoint;
  actualDelta: number | "X";
  capturedAtMs: number;
  automatic: true;
}>;

export type NearFusionalBaseCapture = Readonly<{
  base: NearFusionalBase;
  blur: NearFusionalEndpointCapture;
  break: NearFusionalEndpointCapture;
  recovery: NearFusionalEndpointCapture;
  targetDistanceCm: number;
  setupRevision: number;
  motionValid: true;
}>;

export type NearFusionalRecord = Readonly<{
  caseId: NearFusionalCase["id"];
  captures: Readonly<Record<NearFusionalBase, NearFusionalBaseCapture>>;
  submitted: Readonly<Record<NearFusionalBase, Readonly<{ blur: number | "X"; break: number; recovery: number }>>>;
}>;

export type NearFusionalGuidedStep = Readonly<{ id: string; index: number; title: string; lines: readonly string[]; complete: boolean }>;

export type NearFusionalRun = Readonly<{
  phase: NearFusionalPhase;
  base: NearFusionalBase;
  correctionFitted: boolean;
  targetEstablished: boolean;
  instructionArmed: boolean;
  prismHeld: boolean;
  setupRevision: number;
  baselineStableSinceMs: number | null;
  endpointStableSinceMs: number | null;
  zeroStableSinceMs: number | null;
  trace: RotaryPrismTrace;
  pendingBlur: NearFusionalEndpointCapture | null;
  pendingBreak: NearFusionalEndpointCapture | null;
  captures: Readonly<Partial<Record<NearFusionalBase, NearFusionalBaseCapture>>>;
  released: boolean;
  entries: Readonly<Record<string, string>>;
  record: NearFusionalRecord | null;
  completionAwarded: boolean;
  feedback: string;
  report: string;
  eventNonce: number;
}>;

export const NEAR_FUSIONAL_MAX_DELTA = ROTARY_PRISM_MAX_DELTA;
export const NEAR_FUSIONAL_STABILITY_MS = ROTARY_PRISM_STABILITY_MS;
export const NEAR_FUSIONAL_DIAL_SWEEP_RAD = ROTARY_PRISM_DIAL_SWEEP_RAD;
export const NEAR_FUSIONAL_MIN_DISTANCE_CM = 38;
export const NEAR_FUSIONAL_MAX_DISTANCE_CM = 42;

const freezeEntries = (entries: Readonly<Record<string, string>>) => Object.freeze({ ...entries });
const freezeCaptures = (captures: Readonly<Partial<Record<NearFusionalBase, NearFusionalBaseCapture>>>) => Object.freeze({ ...captures });
const targetDistanceValid = (distanceCm: number) => distanceCm >= NEAR_FUSIONAL_MIN_DISTANCE_CM && distanceCm <= NEAR_FUSIONAL_MAX_DISTANCE_CM;

export function newNearFusionalRun(completionAwarded = false): NearFusionalRun {
  return Object.freeze({ phase: "setup", base: "BI", correctionFitted: false, targetEstablished: false, instructionArmed: false,
    prismHeld: false, setupRevision: 0, baselineStableSinceMs: null, endpointStableSinceMs: null, zeroStableSinceMs: null,
    trace: newRotaryPrismTrace(), pendingBlur: null, pendingBreak: null, captures: freezeCaptures({}), released: false,
    entries: freezeEntries({}), record: null, completionAwarded, feedback: "Fit Arun's appropriate near correction.", report: "", eventNonce: 0 });
}

export function nearFusionalBaseFromRoll(rollRad: number): NearFusionalBase | null {
  const base = rotaryPrismBaseFromRoll(rollRad);
  return base === "BI" || base === "BO" ? base : null;
}
export const nearFusionalPowerToDialAngle = rotaryPrismPowerToDialAngle;
export const nearFusionalDialAngleToPower = rotaryPrismDialAngleToPower;

export function nearFusionalPrismGeometry(sample: Pick<NearFusionalSpatialSample, "prismHeld" | "alignedOD" | "patientFacing" | "tiltValid" | "base">) {
  if (!sample.prismHeld) return "Pick up the dedicated rotary prism.";
  if (!sample.patientFacing) return "Turn the optical aperture toward Arun.";
  if (!sample.alignedOD) return "Align the aperture before OD.";
  if (!sample.tiltValid || !sample.base) return "Level the prism and use its physical BI or BO orientation marking.";
  return "";
}

const setupIssue = (run: NearFusionalRun, sample: NearFusionalSpatialSample) => {
  if (!sample.visible || !sample.tracking) return "Restore target, prism, controller, and headset tracking.";
  if (!run.correctionFitted || !sample.correctionFitted) return "Fit Arun's appropriate near correction.";
  if (!run.targetEstablished || !sample.targetEstablished || !targetDistanceValid(sample.targetDistanceCm))
    return "Support the patient-facing isolated near target on the stand at 38–42 cm.";
  if (!run.instructionArmed) return "Tell Arun to report first sustained blur, sustained diplopia, and when the target is single again.";
  const geometry = nearFusionalPrismGeometry(sample);
  if (geometry) return geometry;
  if (sample.base !== run.base) return run.base === "BI" ? "Orient the prism BI before starting the first run." : "Return to zero and physically roll the prism BO for the second run.";
  return "";
};

export function configureNearFusionalRun(run: NearFusionalRun, action: "fit-correction" | "establish-target" | "give-instruction" | "pickup-prism" | "release-prism"): NearFusionalRun {
  if (run.phase === "complete") return run;
  if (action === "release-prism") {
    if (!run.captures.BI || !run.captures.BO) return Object.freeze({ ...run, feedback: "Complete BI and BO before releasing the prism." });
    return Object.freeze({ ...run, phase: "release", prismHeld: false, released: true,
      feedback: "Prism released. Independently document all six acquired fields." });
  }
  if (run.released || run.record) return run;
  if (action === "fit-correction") return Object.freeze({ ...run, correctionFitted: true, feedback: "Near correction fitted." });
  if (action === "establish-target") return Object.freeze({ ...run, targetEstablished: true, feedback: "Prepared isolated near target established on the 40 cm stand." });
  if (action === "give-instruction") return Object.freeze({ ...run, instructionArmed: true, phase: run.phase === "setup" ? "baseline" : run.phase,
    feedback: "Reporting armed. Align the rotary prism before OD at zero BI." });
  return Object.freeze({ ...run, prismHeld: true, released: false, feedback: "Align the aperture before OD at zero BI." });
}

const appendTrace = (trace: RotaryPrismTrace, sample: NearFusionalSpatialSample, credit = false) =>
  appendRotaryPrismTrace(trace, sample.nowMs, sample.power, credit);

const resetUnfinishedBase = (run: NearFusionalRun, issue: string): NearFusionalRun => {
  const preserveBIReset = Boolean(run.captures.BI) && run.base === "BI";
  return Object.freeze({ ...run, phase: preserveBIReset ? "zero-reset" : "baseline", baselineStableSinceMs: null,
    endpointStableSinceMs: null, zeroStableSinceMs: null, trace: newRotaryPrismTrace(null, issue), pendingBlur: null, pendingBreak: null,
    feedback: preserveBIReset
      ? `${issue} The completed BI capture is preserved; return to zero and confirm stable re-fusion before BO.`
      : `${issue} ${run.captures.BI && run.base === "BO" ? "The completed BI capture is preserved; " : ""}Return to zero and restart the ${run.base} baseline.`,
    report: "The target is clear and single.", eventNonce: run.eventNonce + 1 });
};

const endpointCapture = (kind: NearFusionalEndpoint, sample: NearFusionalSpatialSample, value?: "X"): NearFusionalEndpointCapture => Object.freeze({
  kind, actualDelta: value ?? roundedRotaryPower(sample.power), capturedAtMs: sample.nowMs, automatic: true,
});

function captureEndpoint(run: NearFusionalRun, kind: NearFusionalEndpoint, sample: NearFusionalSpatialSample): NearFusionalRun {
  if (kind === "blur") return Object.freeze({ ...run, pendingBlur: endpointCapture("blur", sample), endpointStableSinceMs: null,
    trace: appendTrace(newRotaryPrismTrace("increase"), sample, true), feedback: "Sustained blur captured automatically. Continue increasing smoothly toward diplopia.",
    report: nearFusionalPatientReport(run, sample.power) });
  if (kind === "break") {
    const blur = NEAR_FUSIONAL_CASE.endpoints[run.base].blur === null ? endpointCapture("blur", sample, "X") : run.pendingBlur;
    if (!blur) return run;
    return Object.freeze({ ...run, phase: "decrease-start", pendingBlur: blur, pendingBreak: endpointCapture("break", sample), endpointStableSinceMs: null,
      trace: newRotaryPrismTrace("decrease"), feedback: "Sustained diplopia captured automatically. Begin reducing demand from the break region.",
      report: "The target is double and stays double." });
  }
  if (!run.pendingBlur || !run.pendingBreak) return run;
  const capture: NearFusionalBaseCapture = Object.freeze({ base: run.base, blur: run.pendingBlur, break: run.pendingBreak,
    recovery: endpointCapture("recovery", sample), targetDistanceCm: Math.round(sample.targetDistanceCm * 10) / 10,
    setupRevision: run.setupRevision, motionValid: true });
  const captures = freezeCaptures({ ...run.captures, [run.base]: capture });
  if (run.base === "BI") return Object.freeze({ ...run, phase: "zero-reset", captures, pendingBlur: null, pendingBreak: null,
    endpointStableSinceMs: null, zeroStableSinceMs: null, trace: newRotaryPrismTrace("decrease"),
    feedback: "BI captured. Continue reducing to zero and hold stable re-fusion before physically rolling to BO.", report: "It is single again." });
  return Object.freeze({ ...run, phase: "captured", captures, pendingBlur: null, pendingBreak: null, endpointStableSinceMs: null,
    trace: newRotaryPrismTrace(), feedback: "BI and BO captured. Release the rotary prism before documentation.", report: "It is single again." });
}

function motionSample(run: NearFusionalRun, sample: NearFusionalSpatialSample, direction: "increase" | "decrease", target: number, kind: NearFusionalEndpoint) {
  const result = sampleRotaryPrismMotion(run.trace, run.endpointStableSinceMs, sample, direction, target);
  if (result.resetIssue) return resetUnfinishedBase(run, result.resetIssue);
  const next = Object.freeze({ ...run, endpointStableSinceMs: result.endpointStableSinceMs, trace: result.trace,
    report: nearFusionalPatientReport(run, sample.power), feedback: result.atEndpoint
      ? `Hold steady for Arun's sustained ${kind === "recovery" ? "single" : kind} report.`
      : result.advanced ? `Continue ${direction === "increase" ? "increasing" : "reducing"} smoothly at about 1–2Δ/s.`
      : `Continue ${direction === "increase" ? "increasing" : "reducing"}; small opposite jitter earns no motion credit.` });
  return result.capture ? captureEndpoint(next, kind, sample) : next;
}

export function sampleNearFusionalRun(run: NearFusionalRun, sample: NearFusionalSpatialSample): NearFusionalRun {
  if (run.phase === "complete" || run.record || run.released || run.phase === "captured") return run;
  const issue = setupIssue(run, sample);
  if (issue) {
    const active = ["increase", "decrease-start", "decrease", "zero-reset"].includes(run.phase);
    return active ? resetUnfinishedBase(run, issue) : Object.freeze({ ...run, prismHeld: sample.prismHeld, feedback: issue, report: "" });
  }
  let current = run.prismHeld === sample.prismHeld ? run : Object.freeze({ ...run, prismHeld: sample.prismHeld });
  if (current.phase === "setup") current = Object.freeze({ ...current, phase: "baseline" });
  if (current.phase === "bo-orient") {
    if (sample.base !== "BO" || !rotaryPowerAtZero(sample.power)) return Object.freeze({ ...current, feedback: "At zero demand, physically roll the prism BO before OD." });
    current = Object.freeze({ ...current, base: "BO", phase: "baseline", baselineStableSinceMs: null, trace: newRotaryPrismTrace(),
      feedback: "Hold the BO zero-demand baseline for 250 ms." });
  }
  if (current.phase === "baseline") {
    if (!rotaryPowerAtZero(sample.power)) return Object.freeze({ ...current, baselineStableSinceMs: null, feedback: "Return the dial to zero before establishing baseline fixation." });
    const since = current.baselineStableSinceMs ?? sample.nowMs;
    if (sample.nowMs - since < ROTARY_PRISM_STABILITY_MS) return Object.freeze({ ...current, baselineStableSinceMs: since,
      feedback: "Hold valid zero-demand near fixation for 250 ms.", report: "The target is clear and single." });
    return Object.freeze({ ...current, phase: "increase", baselineStableSinceMs: since,
      trace: appendTrace(newRotaryPrismTrace("increase"), sample, true), feedback: `Increase ${current.base} demand gradually at about 1–2Δ/s.`,
      report: "The target is clear and single." });
  }
  if (current.phase === "decrease-start") {
    const breakPower = current.pendingBreak?.actualDelta;
    if (typeof breakPower !== "number" || !rotaryPowerInWindow(sample.power, breakPower)) return Object.freeze({ ...current,
      feedback: "Return to the captured break region before beginning recovery." });
    return Object.freeze({ ...current, phase: "decrease", trace: appendTrace(newRotaryPrismTrace("decrease"), sample, true),
      feedback: "Reduce demand smoothly at about 1–2Δ/s." });
  }
  if (current.phase === "zero-reset") {
    const next = motionSample(current, sample, "decrease", 0, "recovery");
    if (next.phase !== "zero-reset") return next;
    if (!rotaryPowerAtZero(sample.power)) return next;
    const since = current.zeroStableSinceMs ?? sample.nowMs;
    if (sample.nowMs - since < ROTARY_PRISM_STABILITY_MS) return Object.freeze({ ...next, zeroStableSinceMs: since,
      feedback: "Hold zero demand and stable near re-fusion for 250 ms." });
    return Object.freeze({ ...next, phase: "bo-orient", base: "BO", zeroStableSinceMs: since, trace: newRotaryPrismTrace(),
      feedback: "Stable re-fusion confirmed. Physically roll the prism to BO while keeping the dial at zero." });
  }
  const finding = NEAR_FUSIONAL_CASE.endpoints[current.base];
  if (current.phase === "increase") {
    const kind: NearFusionalEndpoint = !current.pendingBlur && finding.blur !== null ? "blur" : "break";
    return motionSample(current, sample, "increase", kind === "blur" ? finding.blur! : finding.break, kind);
  }
  if (current.phase === "decrease") return motionSample(current, sample, "decrease", finding.recovery, "recovery");
  return current;
}

export function nearFusionalPatientReport(run: NearFusionalRun, power: number) {
  const finding = NEAR_FUSIONAL_CASE.endpoints[run.base];
  const captured = Boolean(run.captures[run.base]);
  const broken = captured || Boolean(run.pendingBreak) || (run.phase === "increase" && power >= finding.break - ROTARY_PRISM_ENDPOINT_WINDOW);
  const recovered = captured || broken && ["decrease", "zero-reset", "bo-orient", "captured", "release", "entry", "complete"].includes(run.phase)
    && power <= finding.recovery + ROTARY_PRISM_ENDPOINT_WINDOW;
  if (recovered) return "It is single again.";
  if (broken) return "The target is double and stays double.";
  if (finding.blur !== null && power >= finding.blur - ROTARY_PRISM_ENDPOINT_WINDOW) return "The target has become blurred and stays blurred.";
  return "The target is clear and single.";
}

export function nearFusionalEyeState(run: NearFusionalRun, power: number) {
  const finding = NEAR_FUSIONAL_CASE.endpoints[run.base];
  const captured = Boolean(run.captures[run.base]);
  const broken = captured || Boolean(run.pendingBreak) || (run.phase === "increase" && power >= finding.break - ROTARY_PRISM_ENDPOINT_WINDOW);
  const recovered = captured || broken && ["decrease", "zero-reset", "bo-orient", "captured", "release", "entry", "complete"].includes(run.phase)
    && power <= finding.recovery + ROTARY_PRISM_ENDPOINT_WINDOW;
  const nearConvergence = .012;
  const demand = Math.min(.027, Math.max(0, power) * .00135);
  const fusedOD = nearConvergence + (run.base === "BO" ? demand : -demand);
  const fusedOS = -nearConvergence - (run.base === "BO" ? demand : -demand);
  const drift = run.base === "BO" ? -.045 : .045;
  return Object.freeze({ broken: broken && !recovered, OD: broken && !recovered ? drift : fusedOD,
    OS: broken && !recovered ? -drift : fusedOS });
}

export function interruptNearFusionalRun(run: NearFusionalRun, reason: string) {
  if (run.phase === "complete" || run.record || run.phase === "captured" || run.released) return run;
  return resetUnfinishedBase(run, reason);
}

export function reviseNearFusionalSetup(run: NearFusionalRun, reason: string, correctionStillFitted = true, targetStillEstablished = true): NearFusionalRun {
  if (run.phase === "complete" || run.record) return run;
  return Object.freeze({ ...newNearFusionalRun(run.completionAwarded), correctionFitted: correctionStillFitted && run.correctionFitted,
    targetEstablished: targetStillEstablished && run.targetEstablished, instructionArmed: run.instructionArmed,
    setupRevision: run.setupRevision + 1, feedback: `${reason} Correction or target conditions changed, so both BI and BO were cleared.`,
    eventNonce: run.eventNonce + 1 });
}

export const nearFusionalRecordFieldIds = Object.freeze(["bi-blur", "bi-break", "bi-recovery", "bo-blur", "bo-break", "bo-recovery"] as const);

export function enterNearFusionalRecord(run: NearFusionalRun, id: string, value: string): NearFusionalRun {
  if (!run.released || run.record || run.phase === "complete") return run;
  return Object.freeze({ ...run, phase: "entry", entries: freezeEntries({ ...run.entries, [id]: value }), feedback: "" });
}

export function submitNearFusionalRecord(run: NearFusionalRun, callbackNonce = run.eventNonce): NearFusionalRun {
  if (callbackNonce !== run.eventNonce || !run.released || run.record || !run.captures.BI || !run.captures.BO) return run;
  if (nearFusionalRecordFieldIds.some(id => !run.entries[id]?.trim())) return Object.freeze({ ...run, feedback: "Complete all six fields." });
  const expected = { "bi-blur": run.captures.BI.blur.actualDelta, "bi-break": run.captures.BI.break.actualDelta,
    "bi-recovery": run.captures.BI.recovery.actualDelta, "bo-blur": run.captures.BO.blur.actualDelta,
    "bo-break": run.captures.BO.break.actualDelta, "bo-recovery": run.captures.BO.recovery.actualDelta } as const;
  for (const [id, value] of Object.entries(expected)) {
    const entry = run.entries[id].trim();
    if (value === "X" ? entry.toUpperCase() !== "X" : !Number.isFinite(Number(entry)) || Math.abs(Number(entry) - value) >= .051)
      return Object.freeze({ ...run, feedback: "The entry does not match the immutable captured dial readings. Recheck all six fields." });
  }
  const submitted = Object.freeze({
    BI: Object.freeze({ blur: expected["bi-blur"], break: Number(run.entries["bi-break"]), recovery: Number(run.entries["bi-recovery"]) }),
    BO: Object.freeze({ blur: expected["bo-blur"], break: Number(run.entries["bo-break"]), recovery: Number(run.entries["bo-recovery"]) }),
  });
  const record: NearFusionalRecord = Object.freeze({ caseId: NEAR_FUSIONAL_CASE.id,
    captures: Object.freeze({ BI: run.captures.BI, BO: run.captures.BO }), submitted });
  return Object.freeze({ ...run, phase: "complete", record, completionAwarded: true,
    feedback: "Horizontal near vergence finding recorded once." });
}

export function releaseNearFusionalPrism(run: NearFusionalRun) { return configureNearFusionalRun(run, "release-prism"); }
export function cancelNearFusionalRun(run: NearFusionalRun) {
  if (run.phase === "complete") return run;
  return Object.freeze({ ...newNearFusionalRun(run.completionAwarded), feedback: "Recording cancelled. The unrecorded attempt was cleared.",
    eventNonce: run.eventNonce + 1 });
}

export function nearFusionalGuidedStep(run: NearFusionalRun, sample: NearFusionalSpatialSample): NearFusionalGuidedStep {
  const geometryReady = !nearFusionalPrismGeometry(sample);
  const targetReady = run.targetEstablished && sample.targetEstablished && targetDistanceValid(sample.targetDistanceCm);
  const checks = [
    ["correction", "Fit near correction", "Fit Arun's appropriate near correction.", run.correctionFitted && sample.correctionFitted],
    ["target", "Support the prepared near target", "Use the patient-facing isolated target on its stand at 38–42 cm.", targetReady],
    ["instruction", "Give the reporting instruction", "Ask for first sustained blur, sustained diplopia, and recovery to single.", run.instructionArmed],
    ["pickup", "Pick up the rotary prism", "Hold its grip while the free hand operates the dial.", run.prismHeld || sample.prismHeld],
    ["align", "Align BI before OD", "Centre the patient-facing aperture before OD and physically roll to BI.", geometryReady],
    ["baseline", "Hold the BI zero baseline", "Hold valid zero-demand near fixation for 250 ms.", run.phase !== "setup" && run.phase !== "baseline"],
    ["bi-increase", "Complete the BI increase", "Increase continuously at about 1–2Δ/s; blur and diplopia capture automatically.", Boolean(run.pendingBreak) || Boolean(run.captures.BI)],
    ["bi-recovery", "Reduce BI and return to zero", "Reduce through recovery, then continue to zero and hold stable re-fusion.", Boolean(run.captures.BI)],
    ["bo-run", "Roll to BO and repeat", "At zero, physically roll to BO, establish a fresh baseline, then repeat the full run.", Boolean(run.captures.BO)],
    ["record", "Release and record", "Physically release the prism and independently enter all six acquired fields.", Boolean(run.record)],
  ] as const;
  const index = run.phase === "complete" ? 9 : Math.max(0, checks.findIndex(check => !check[3]));
  const step = checks[index];
  return Object.freeze({ id: step[0], index, title: step[1], lines: Object.freeze([step[2]]), complete: Boolean(run.record) });
}

export function nearFusionalDisclosure(kind: "guided" | "test") {
  return Object.freeze({ showCoach: kind === "guided", showHighlights: kind === "guided", revealThresholds: false,
    answerBearingPhaseLabels: kind === "guided" });
}

export function nearFusionalVoiceInstruction(run: NearFusionalRun) { return configureNearFusionalRun(run, "give-instruction"); }
export function nearFusionalVoiceReply(run: NearFusionalRun, power: number) { return nearFusionalPatientReport(run, power); }
