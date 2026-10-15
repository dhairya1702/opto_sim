import {
  ROTARY_PRISM_DIAL_SWEEP_RAD, ROTARY_PRISM_MAX_DELTA, ROTARY_PRISM_STABILITY_MS,
  appendRotaryPrismTrace, newRotaryPrismTrace, rotaryPowerAtZero, rotaryPowerInWindow,
  rotaryPrismBaseFromRoll, rotaryPrismDialAngleToPower, rotaryPrismPowerToDialAngle,
  roundedRotaryPower, sampleRotaryPrismMotion, type RotaryPrismTrace,
} from "./rotaryPrismProcedure";

export type VerticalFusionalBase = "BU" | "BD";
export type VerticalFusionalEndpoint = "break" | "recovery";
export type VerticalFusionalPhase = "setup" | "baseline" | "increase" | "decrease-start" | "decrease" | "zero-reset" | "bd-orient" | "captured" | "release" | "entry" | "complete";

export const VERTICAL_FUSIONAL_CASE = Object.freeze({ id: "arun-vertical-distance-01" as const,
  endpoints: Object.freeze({ BU: Object.freeze({ break: 4, recovery: 2 }), BD: Object.freeze({ break: 4, recovery: 2 }) }) });

export type VerticalFusionalSpatialSample = Readonly<{
  nowMs: number; power: number; base: VerticalFusionalBase | null;
  correctionFitted: boolean; targetEstablished: boolean; prismHeld: boolean;
  alignedOD: boolean; patientFacing: boolean; tiltValid: boolean; visible: boolean; tracking: boolean;
}>;
export type VerticalFusionalEndpointCapture = Readonly<{ kind: VerticalFusionalEndpoint; actualDelta: number; capturedAtMs: number; automatic: true }>;
export type VerticalFusionalBaseCapture = Readonly<{ base: VerticalFusionalBase; break: VerticalFusionalEndpointCapture; recovery: VerticalFusionalEndpointCapture; setupRevision: number; motionValid: true }>;
export type VerticalFusionalRecord = Readonly<{ caseId: typeof VERTICAL_FUSIONAL_CASE.id;
  captures: Readonly<Record<VerticalFusionalBase, VerticalFusionalBaseCapture>>;
  submitted: Readonly<Record<VerticalFusionalBase, Readonly<{ break: number; recovery: number }>>> }>;
export type VerticalFusionalGuidedStep = Readonly<{ id: string; index: number; title: string; lines: readonly string[]; complete: boolean }>;

export type VerticalFusionalRun = Readonly<{
  phase: VerticalFusionalPhase; base: VerticalFusionalBase; correctionFitted: boolean; targetEstablished: boolean;
  instructionArmed: boolean; prismHeld: boolean; setupRevision: number; baselineStableSinceMs: number | null;
  endpointStableSinceMs: number | null; zeroStableSinceMs: number | null; trace: RotaryPrismTrace;
  pendingBreak: VerticalFusionalEndpointCapture | null; captures: Readonly<Partial<Record<VerticalFusionalBase, VerticalFusionalBaseCapture>>>;
  released: boolean; entries: Readonly<Record<string, string>>; record: VerticalFusionalRecord | null;
  completionAwarded: boolean; feedback: string; report: string; eventNonce: number;
}>;

export const VERTICAL_FUSIONAL_MAX_DELTA = ROTARY_PRISM_MAX_DELTA;
export const VERTICAL_FUSIONAL_STABILITY_MS = ROTARY_PRISM_STABILITY_MS;
export const VERTICAL_FUSIONAL_DIAL_SWEEP_RAD = ROTARY_PRISM_DIAL_SWEEP_RAD;
const freezeEntries = (entries: Readonly<Record<string, string>>) => Object.freeze({ ...entries });
const freezeCaptures = (captures: Readonly<Partial<Record<VerticalFusionalBase, VerticalFusionalBaseCapture>>>) => Object.freeze({ ...captures });

export function newVerticalFusionalRun(completionAwarded = false): VerticalFusionalRun {
  return Object.freeze({ phase: "setup", base: "BU", correctionFitted: false, targetEstablished: false, instructionArmed: false,
    prismHeld: false, setupRevision: 0, baselineStableSinceMs: null, endpointStableSinceMs: null, zeroStableSinceMs: null,
    trace: newRotaryPrismTrace(), pendingBreak: null, captures: freezeCaptures({}), released: false, entries: freezeEntries({}),
    record: null, completionAwarded, feedback: "Fit Arun's appropriate distance correction.", report: "", eventNonce: 0 });
}

export function verticalFusionalBaseFromRoll(rollRad: number): VerticalFusionalBase | null {
  const base = rotaryPrismBaseFromRoll(rollRad);
  return base === "BU" || base === "BD" ? base : null;
}
export const verticalFusionalPowerToDialAngle = rotaryPrismPowerToDialAngle;
export const verticalFusionalDialAngleToPower = rotaryPrismDialAngleToPower;

export function verticalFusionalPrismGeometry(sample: Pick<VerticalFusionalSpatialSample, "prismHeld" | "alignedOD" | "patientFacing" | "tiltValid" | "base">) {
  if (!sample.prismHeld) return "Pick up the dedicated rotary prism.";
  if (!sample.patientFacing) return "Turn the optical aperture toward Arun.";
  if (!sample.alignedOD) return "Align the aperture before OD.";
  if (!sample.tiltValid || !sample.base) return "Roll the prism to its physical BU or BD marking while keeping the aperture level to the eye.";
  return "";
}

const setupIssue = (run: VerticalFusionalRun, sample: VerticalFusionalSpatialSample) => {
  if (!sample.visible || !sample.tracking) return "Restore prism, controller, and headset tracking.";
  if (!run.correctionFitted || !sample.correctionFitted) return "Fit Arun's appropriate distance correction.";
  if (!run.targetEstablished || !sample.targetEstablished) return "Establish the prepared illustrative mirrored isolated target.";
  if (!run.instructionArmed) return "Tell Arun to report sustained diplopia and when the target becomes single again.";
  const geometry = verticalFusionalPrismGeometry(sample);
  if (geometry) return geometry;
  if (sample.base !== run.base) return run.base === "BU" ? "Physically roll the prism to BU before starting the first run." : "At zero, physically roll the prism to BD for the second run.";
  return "";
};

export function configureVerticalFusionalRun(run: VerticalFusionalRun, action: "fit-correction" | "establish-target" | "give-instruction" | "pickup-prism" | "release-prism"): VerticalFusionalRun {
  if (run.phase === "complete") return run;
  if (action === "release-prism") {
    if (!run.captures.BU || !run.captures.BD) return Object.freeze({ ...run, feedback: "Complete BU and BD before releasing the prism." });
    return Object.freeze({ ...run, phase: "release", prismHeld: false, released: true,
      feedback: "Prism released. Independently document the four acquired readings." });
  }
  if (run.released || run.record) return run;
  if (action === "fit-correction") return Object.freeze({ ...run, correctionFitted: true, feedback: "Distance correction fitted." });
  if (action === "establish-target") return Object.freeze({ ...run, targetEstablished: true,
    feedback: "Prepared mirrored isolated target established one line larger than the poorer eye's best-corrected acuity." });
  if (action === "give-instruction") return Object.freeze({ ...run, instructionArmed: true, phase: run.phase === "setup" ? "baseline" : run.phase,
    feedback: "Reporting armed. Align the rotary prism before OD at zero BU." });
  return Object.freeze({ ...run, prismHeld: true, released: false, feedback: "Align the patient-facing aperture before OD at zero BU." });
}

const resetUnfinishedBase = (run: VerticalFusionalRun, issue: string): VerticalFusionalRun => {
  const preserveBUReset = Boolean(run.captures.BU) && run.base === "BU";
  return Object.freeze({ ...run, phase: preserveBUReset ? "zero-reset" : "baseline", baselineStableSinceMs: null,
    endpointStableSinceMs: null, zeroStableSinceMs: null, trace: newRotaryPrismTrace(null, issue), pendingBreak: null,
    feedback: preserveBUReset ? `${issue} The completed BU capture is preserved; return to zero and confirm stable re-fusion before BD.`
      : `${issue} ${run.captures.BU && run.base === "BD" ? "The completed BU capture is preserved; " : ""}Return to zero and restart the ${run.base} baseline.`,
    report: "The target is clear and single.", eventNonce: run.eventNonce + 1 });
};

const endpointCapture = (kind: VerticalFusionalEndpoint, sample: VerticalFusionalSpatialSample): VerticalFusionalEndpointCapture =>
  Object.freeze({ kind, actualDelta: roundedRotaryPower(sample.power), capturedAtMs: sample.nowMs, automatic: true });

function captureEndpoint(run: VerticalFusionalRun, kind: VerticalFusionalEndpoint, sample: VerticalFusionalSpatialSample): VerticalFusionalRun {
  if (kind === "break") return Object.freeze({ ...run, phase: "decrease-start", pendingBreak: endpointCapture("break", sample), endpointStableSinceMs: null,
    trace: newRotaryPrismTrace("decrease"), feedback: "Sustained diplopia captured automatically. Begin reducing demand from the break region.",
    report: "The target is double and stays double." });
  if (!run.pendingBreak) return run;
  const capture: VerticalFusionalBaseCapture = Object.freeze({ base: run.base, break: run.pendingBreak, recovery: endpointCapture("recovery", sample),
    setupRevision: run.setupRevision, motionValid: true });
  const captures = freezeCaptures({ ...run.captures, [run.base]: capture });
  if (run.base === "BU") return Object.freeze({ ...run, phase: "zero-reset", captures, pendingBreak: null, endpointStableSinceMs: null,
    zeroStableSinceMs: null, trace: newRotaryPrismTrace("decrease"),
    feedback: "BU captured. Continue to zero and hold stable re-fusion before rolling to BD.", report: "It is single again." });
  return Object.freeze({ ...run, phase: "captured", captures, pendingBreak: null, endpointStableSinceMs: null, trace: newRotaryPrismTrace(),
    feedback: "BU and BD captured. Physically release the rotary prism before documentation.", report: "It is single again." });
}

function motionSample(run: VerticalFusionalRun, sample: VerticalFusionalSpatialSample, direction: "increase" | "decrease", target: number, kind: VerticalFusionalEndpoint) {
  const result = sampleRotaryPrismMotion(run.trace, run.endpointStableSinceMs, sample, direction, target);
  if (result.resetIssue) return resetUnfinishedBase(run, result.resetIssue);
  const next = Object.freeze({ ...run, endpointStableSinceMs: result.endpointStableSinceMs, trace: result.trace,
    report: verticalFusionalPatientReport(run, sample.power), feedback: result.atEndpoint
      ? `Hold steady for Arun's sustained ${kind === "break" ? "diplopia" : "single"} report.`
      : result.advanced ? `Continue ${direction === "increase" ? "increasing" : "reducing"} smoothly at about 1–2Δ/s.`
      : `Continue ${direction === "increase" ? "increasing" : "reducing"}; small opposite jitter earns no motion credit.` });
  return result.capture ? captureEndpoint(next, kind, sample) : next;
}

export function sampleVerticalFusionalRun(run: VerticalFusionalRun, sample: VerticalFusionalSpatialSample): VerticalFusionalRun {
  if (run.phase === "complete" || run.record || run.released || run.phase === "captured") return run;
  const issue = setupIssue(run, sample);
  if (issue) {
    const active = ["increase", "decrease-start", "decrease", "zero-reset"].includes(run.phase);
    return active ? resetUnfinishedBase(run, issue) : Object.freeze({ ...run, prismHeld: sample.prismHeld, feedback: issue, report: "" });
  }
  let current = run.prismHeld === sample.prismHeld ? run : Object.freeze({ ...run, prismHeld: sample.prismHeld });
  if (current.phase === "setup") current = Object.freeze({ ...current, phase: "baseline" });
  if (current.phase === "bd-orient") {
    if (sample.base !== "BD" || !rotaryPowerAtZero(sample.power)) return Object.freeze({ ...current, feedback: "At zero demand, physically roll the prism to BD before OD." });
    current = Object.freeze({ ...current, base: "BD", phase: "baseline", baselineStableSinceMs: null, trace: newRotaryPrismTrace(),
      feedback: "Hold the BD zero-demand baseline for 250 ms." });
  }
  if (current.phase === "baseline") {
    if (!rotaryPowerAtZero(sample.power)) return Object.freeze({ ...current, baselineStableSinceMs: null, feedback: "Return the dial to zero before establishing baseline fixation." });
    const since = current.baselineStableSinceMs ?? sample.nowMs;
    if (sample.nowMs - since < ROTARY_PRISM_STABILITY_MS) return Object.freeze({ ...current, baselineStableSinceMs: since,
      feedback: "Hold valid zero-demand baseline fixation for 250 ms.", report: "The target is clear and single." });
    return Object.freeze({ ...current, phase: "increase", baselineStableSinceMs: since,
      trace: appendRotaryPrismTrace(newRotaryPrismTrace("increase"), sample.nowMs, sample.power, true),
      feedback: `Increase ${current.base} demand gradually at about 1–2Δ/s.`, report: "The target is clear and single." });
  }
  if (current.phase === "decrease-start") {
    const breakPower = current.pendingBreak?.actualDelta;
    if (typeof breakPower !== "number" || !rotaryPowerInWindow(sample.power, breakPower)) return Object.freeze({ ...current,
      feedback: "Return to the captured break region before beginning recovery." });
    return Object.freeze({ ...current, phase: "decrease", trace: appendRotaryPrismTrace(newRotaryPrismTrace("decrease"), sample.nowMs, sample.power, true),
      feedback: "Reduce demand smoothly at about 1–2Δ/s." });
  }
  if (current.phase === "zero-reset") {
    const next = motionSample(current, sample, "decrease", 0, "recovery");
    if (next.phase !== "zero-reset") return next;
    if (!rotaryPowerAtZero(sample.power)) return next;
    const since = current.zeroStableSinceMs ?? sample.nowMs;
    if (sample.nowMs - since < ROTARY_PRISM_STABILITY_MS) return Object.freeze({ ...next, zeroStableSinceMs: since,
      feedback: "Hold zero demand and stable re-fusion for 250 ms." });
    return Object.freeze({ ...next, phase: "bd-orient", base: "BD", zeroStableSinceMs: since, trace: newRotaryPrismTrace(),
      feedback: "Stable re-fusion confirmed. Physically roll the prism to BD while keeping the dial at zero." });
  }
  const finding = VERTICAL_FUSIONAL_CASE.endpoints[current.base];
  if (current.phase === "increase") return motionSample(current, sample, "increase", finding.break, "break");
  if (current.phase === "decrease") return motionSample(current, sample, "decrease", finding.recovery, "recovery");
  return current;
}

export function verticalFusionalPatientReport(run: VerticalFusionalRun, power: number) {
  const finding = VERTICAL_FUSIONAL_CASE.endpoints[run.base];
  const broken = Boolean(run.pendingBreak) || (run.phase === "increase" && power >= finding.break - .5);
  const recovered = broken && ["decrease", "zero-reset", "bd-orient", "captured", "release", "entry", "complete"].includes(run.phase)
    && power <= finding.recovery + .5;
  if (recovered) return "It is single again.";
  if (broken) return "The target is double and stays double.";
  return "The target is clear and single.";
}

export function verticalFusionalEyeState(run: VerticalFusionalRun, power: number) {
  const finding = VERTICAL_FUSIONAL_CASE.endpoints[run.base];
  const broken = Boolean(run.pendingBreak) || (run.phase === "increase" && power >= finding.break - .5);
  const recovered = broken && ["decrease", "zero-reset", "bd-orient", "captured", "release", "entry", "complete"].includes(run.phase)
    && power <= finding.recovery + .5;
  const direction = run.base === "BU" ? 1 : -1;
  const demand = Math.min(.027, Math.max(0, power) * .00135) * direction;
  const drift = .04 * direction;
  return Object.freeze({ broken: broken && !recovered, OD: { x: 0, y: broken && !recovered ? drift : demand },
    OS: { x: 0, y: broken && !recovered ? -drift : -demand } });
}

export function interruptVerticalFusionalRun(run: VerticalFusionalRun, reason: string) {
  if (run.phase === "complete" || run.record || run.phase === "captured" || run.released) return run;
  return resetUnfinishedBase(run, reason);
}

export function reviseVerticalFusionalSetup(run: VerticalFusionalRun, reason: string, correctionStillFitted = true, targetStillEstablished = true): VerticalFusionalRun {
  if (run.phase === "complete" || run.record) return run;
  const preserveBU = run.captures.BU;
  return Object.freeze({ ...newVerticalFusionalRun(run.completionAwarded), correctionFitted: correctionStillFitted && run.correctionFitted,
    targetEstablished: targetStillEstablished && run.targetEstablished, instructionArmed: run.instructionArmed,
    setupRevision: run.setupRevision + 1, base: preserveBU ? "BD" : "BU", phase: "baseline",
    captures: freezeCaptures(preserveBU ? { BU: preserveBU } : {}),
    feedback: `${reason} The unfinished ${preserveBU ? "BD" : "BU"} run was cleared${preserveBU ? "; completed BU is preserved" : ""}.`,
    eventNonce: run.eventNonce + 1 });
}

export const verticalFusionalRecordFieldIds = Object.freeze(["bu-break", "bu-recovery", "bd-break", "bd-recovery"] as const);
export function enterVerticalFusionalRecord(run: VerticalFusionalRun, id: string, value: string): VerticalFusionalRun {
  if (!run.released || run.record || run.phase === "complete") return run;
  return Object.freeze({ ...run, phase: "entry", entries: freezeEntries({ ...run.entries, [id]: value }), feedback: "" });
}
export function submitVerticalFusionalRecord(run: VerticalFusionalRun, callbackNonce = run.eventNonce): VerticalFusionalRun {
  if (callbackNonce !== run.eventNonce || !run.released || run.record || !run.captures.BU || !run.captures.BD) return run;
  if (verticalFusionalRecordFieldIds.some(id => !run.entries[id]?.trim())) return Object.freeze({ ...run, feedback: "Complete all four decimal fields." });
  const read = (id: string) => Number(run.entries[id]);
  if (verticalFusionalRecordFieldIds.some(id => !Number.isFinite(read(id)))) return Object.freeze({ ...run, feedback: "Enter decimal prism values for all four endpoints." });
  const expected = { "bu-break": run.captures.BU.break.actualDelta, "bu-recovery": run.captures.BU.recovery.actualDelta,
    "bd-break": run.captures.BD.break.actualDelta, "bd-recovery": run.captures.BD.recovery.actualDelta } as const;
  if (Object.entries(expected).some(([id, value]) => Math.abs(read(id) - value) >= .051))
    return Object.freeze({ ...run, feedback: "The entry does not match the immutable captured dial readings. Recheck all four fields." });
  const submitted = Object.freeze({ BU: Object.freeze({ break: read("bu-break"), recovery: read("bu-recovery") }),
    BD: Object.freeze({ break: read("bd-break"), recovery: read("bd-recovery") }) });
  const record: VerticalFusionalRecord = Object.freeze({ caseId: VERTICAL_FUSIONAL_CASE.id,
    captures: Object.freeze({ BU: run.captures.BU, BD: run.captures.BD }), submitted });
  return Object.freeze({ ...run, phase: "complete", record, completionAwarded: true,
    feedback: "Vertical distance vergence finding recorded once." });
}
export function releaseVerticalFusionalPrism(run: VerticalFusionalRun) { return configureVerticalFusionalRun(run, "release-prism"); }
export function cancelVerticalFusionalRun(run: VerticalFusionalRun) {
  if (run.phase === "complete") return run;
  return Object.freeze({ ...newVerticalFusionalRun(run.completionAwarded), feedback: "Recording cancelled. The unrecorded attempt was cleared.", eventNonce: run.eventNonce + 1 });
}

export function verticalFusionalGuidedStep(run: VerticalFusionalRun, sample: VerticalFusionalSpatialSample): VerticalFusionalGuidedStep {
  const geometryReady = !verticalFusionalPrismGeometry(sample);
  const checks = [
    ["correction", "Fit distance correction", "Fit Arun's appropriate distance correction.", run.correctionFitted && sample.correctionFitted],
    ["target", "Establish the prepared target", "Use the illustrative mirrored isolated target prepared one line larger than the poorer eye's best-corrected acuity.", run.targetEstablished && sample.targetEstablished],
    ["instruction", "Give the reporting instruction", "Ask only for sustained diplopia and recovery to single.", run.instructionArmed],
    ["pickup", "Pick up the rotary prism", "Hold its grip while the free hand operates the dial.", run.prismHeld || sample.prismHeld],
    ["align", "Align BU before OD", "Centre the patient-facing aperture before OD and physically roll to BU.", geometryReady],
    ["baseline", "Hold the BU zero baseline", "Hold valid zero-demand fixation for 250 ms.", run.phase !== "setup" && run.phase !== "baseline"],
    ["bu-run", "Complete the BU run", "Increase continuously at about 1–2Δ/s, then reduce after diplopia; reports capture automatically.", Boolean(run.captures.BU)],
    ["zero", "Return to zero", "Continue to zero and hold stable re-fusion for 250 ms before changing direction.", run.base === "BD"],
    ["bd-run", "Roll to BD and repeat", "At zero, physically roll to BD, establish a fresh baseline, then repeat break and recovery.", Boolean(run.captures.BD)],
    ["record", "Release and record", "Physically release the prism and independently enter all four acquired fields.", Boolean(run.record)],
  ] as const;
  const index = run.phase === "complete" ? 9 : Math.max(0, checks.findIndex(check => !check[3]));
  const step = checks[index];
  return Object.freeze({ id: step[0], index, title: step[1], lines: Object.freeze([step[2]]), complete: Boolean(run.record) });
}
export function verticalFusionalDisclosure(kind: "guided" | "test") {
  return Object.freeze({ showCoach: kind === "guided", showHighlights: kind === "guided", revealThresholds: false,
    answerBearingPhaseLabels: kind === "guided" });
}
export function verticalFusionalVoiceInstruction(run: VerticalFusionalRun) { return configureVerticalFusionalRun(run, "give-instruction"); }
export function verticalFusionalVoiceReply(run: VerticalFusionalRun, power: number) { return verticalFusionalPatientReport(run, power); }
