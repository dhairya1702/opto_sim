export type ThoringtonAxis = "horizontal" | "vertical";
export type ThoringtonReportedSide = "right" | "left" | "above" | "below" | "through";
export type ThoringtonInterpretation = "orthophoria" | "esophoria" | "exophoria" | "left-hyperphoria" | "right-hyperphoria";
export type ThoringtonPhase = "setup" | "instruction" | "stability" | "captured" | "entry" | "complete";

export const THORINGTON_CARD_SPACING_M = .004;
export const THORINGTON_CARD_APERTURE_RADIUS_M = .010;
export const THORINGTON_CARD_DISTANCE_CM = Object.freeze({ min: 38, max: 42 });
export const THORINGTON_CARD_ANGLE_TOLERANCE_DEG = 30;
export const THORINGTON_LIGHT_MAX_DISTANCE_M = .30;
export const THORINGTON_STABILITY_DWELL_MS = 250;
export const THORINGTON_POSE_JITTER_MS = 200;
export const THORINGTON_SCALE = Object.freeze(Array.from({ length: 21 }, (_, index) => index - 10));

export type ThoringtonTrial = Readonly<{
  axis: ThoringtonAxis;
  signedCoordinate: number;
  magnitude: number;
  reportedSide: ThoringtonReportedSide;
  interpretation: ThoringtonInterpretation;
  grooveDegrees: 0 | 90;
}>;

export type ThoringtonCase = Readonly<{
  id: "case-a" | "case-b";
  trials: readonly [ThoringtonTrial, ThoringtonTrial];
}>;

const trial = (axis: ThoringtonAxis, signedCoordinate: number): ThoringtonTrial => Object.freeze({
  axis,
  signedCoordinate,
  magnitude: Math.abs(signedCoordinate),
  reportedSide: signedCoordinate === 0 ? "through" : axis === "horizontal" ? signedCoordinate > 0 ? "right" : "left" : signedCoordinate > 0 ? "above" : "below",
  interpretation: signedCoordinate === 0 ? "orthophoria" : axis === "horizontal" ? signedCoordinate > 0 ? "esophoria" : "exophoria" : signedCoordinate > 0 ? "left-hyperphoria" : "right-hyperphoria",
  grooveDegrees: axis === "horizontal" ? 0 : 90,
});

/** The two pre-existing fictional patient patterns; no clinical values are generated at runtime. */
export const THORINGTON_CASES: readonly ThoringtonCase[] = Object.freeze([
  Object.freeze({ id: "case-a", trials: Object.freeze([trial("horizontal", 6), trial("vertical", 4)]) as unknown as readonly [ThoringtonTrial, ThoringtonTrial] }),
  Object.freeze({ id: "case-b", trials: Object.freeze([trial("horizontal", -8), trial("vertical", -3)]) as unknown as readonly [ThoringtonTrial, ThoringtonTrial] }),
]);

export type ThoringtonSpatialSample = Readonly<{
  correctionFitted: boolean;
  correctionRevision: number;
  rodFitted: boolean;
  grooveDegrees: number | null;
  rodFitRevision: number;
  cardPresent: boolean;
  cardHeldOrSupported: boolean;
  cardDistanceCm: number;
  cardFacing: boolean;
  cardUpright: boolean;
  penlightHeld: boolean;
  penlightPowered: boolean;
  penlightExaminerSide: boolean;
  penlightTowardPatient: boolean;
  apertureHit: boolean;
  penlightWithinReach?: boolean;
  fixationInstruction: boolean;
  tracking: boolean;
}>;

export type ThoringtonCapture = Readonly<{
  caseId: ThoringtonCase["id"];
  axis: ThoringtonAxis;
  actualCardDistanceCm: number;
  signedCoordinate: number;
  rawReportedSide: ThoringtonReportedSide;
  report: string;
  setupRevision: number;
  correctionRevision: number;
  rodFitRevision: number;
}>;

export type ThoringtonRecord = Readonly<{
  capture: ThoringtonCapture;
  submittedMagnitude: number;
  submittedSide: ThoringtonReportedSide;
  submittedInterpretation: ThoringtonInterpretation;
}>;

export type ThoringtonRun = Readonly<{
  caseIndex: number;
  trialIndex: number;
  phase: ThoringtonPhase;
  reportInstruction: boolean;
  stableSinceMs: number | null;
  poseInvalidSinceMs: number | null;
  capture: ThoringtonCapture | null;
  entryMagnitude: string;
  entrySide: ThoringtonReportedSide | "";
  entryInterpretation: ThoringtonInterpretation | "";
  records: readonly ThoringtonRecord[];
  setupRevision: number;
  requiredRodRefitRevision: number;
  completionAwarded: boolean;
  feedback: string;
}>;

export type ThoringtonGuidedStep = Readonly<{ id: string; title: string; lines: readonly string[]; complete: boolean }>;

export function newThoringtonRun(caseIndex = 0, completionAwarded = false): ThoringtonRun {
  return Object.freeze({ caseIndex: ((caseIndex % THORINGTON_CASES.length) + THORINGTON_CASES.length) % THORINGTON_CASES.length,
    trialIndex: 0, phase: "setup", reportInstruction: false, stableSinceMs: null, poseInvalidSinceMs: null, capture: null,
    entryMagnitude: "", entrySide: "", entryInterpretation: "", records: Object.freeze([]), setupRevision: 0,
    requiredRodRefitRevision: -1, completionAwarded, feedback: "" });
}

export const thoringtonCardCoordinate = (value: number) => value * THORINGTON_CARD_SPACING_M;
export const thoringtonDistanceReady = (distanceCm: number) => distanceCm >= THORINGTON_CARD_DISTANCE_CM.min - 1e-8 && distanceCm <= THORINGTON_CARD_DISTANCE_CM.max + 1e-8;

const angularGap = (a: number, b: number) => {
  const delta = Math.abs(((a - b + 180) % 360 + 360) % 360 - 180);
  return Math.min(delta, Math.abs(delta - 180));
};
export const thoringtonGrooveCorrect = (axis: ThoringtonAxis, degrees: number | null) => degrees !== null
  && angularGap(degrees, axis === "horizontal" ? 0 : 90) <= THORINGTON_CARD_ANGLE_TOLERANCE_DEG;

type Point3 = readonly [number, number, number];
const subtract = (a: Point3, b: Point3): [number, number, number] => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const addScaled = (a: Point3, b: Point3, scale: number): [number, number, number] => [a[0] + b[0] * scale, a[1] + b[1] * scale, a[2] + b[2] * scale];
const dot = (a: Point3, b: Point3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const length = (a: Point3) => Math.hypot(...a);
const unit = (a: Point3): [number, number, number] => { const size = length(a); return size ? [a[0] / size, a[1] / size, a[2] / size] : [0, 0, 0]; };

export type ThoringtonCardPose = Readonly<{ position: Point3; patientFacingNormal: Point3; up: Point3 }>;
export type ThoringtonLightRay = Readonly<{ position: Point3; direction: Point3 }>;

export function classifyThoringtonCard(card: ThoringtonCardPose, patient: Point3) {
  const normal = unit(card.patientFacingNormal), towardPatient = unit(subtract(patient, card.position)), up = unit(card.up);
  const cosine = Math.cos(THORINGTON_CARD_ANGLE_TOLERANCE_DEG * Math.PI / 180);
  return Object.freeze({ patientFacing: dot(normal, towardPatient) >= cosine, upright: dot(up, [0, 1, 0]) >= cosine,
    distanceCm: length(subtract(card.position, patient)) * 100 });
}

/** True ray/plane intersection against the physical 10 mm card aperture. */
export function thoringtonLightIntersection(card: ThoringtonCardPose, light: ThoringtonLightRay) {
  const normal = unit(card.patientFacingNormal), direction = unit(light.direction);
  const fromCardToLight = subtract(light.position, card.position);
  const denominator = dot(direction, normal);
  const numerator = dot(subtract(card.position, light.position), normal);
  const distanceAlongRay = Math.abs(denominator) > 1e-9 ? numerator / denominator : -1;
  const intersection = distanceAlongRay > 0 ? addScaled(light.position, direction, distanceAlongRay) : null;
  const radialDistanceM = intersection ? length(subtract(intersection, card.position)) : Number.POSITIVE_INFINITY;
  const cosine = Math.cos(THORINGTON_CARD_ANGLE_TOLERANCE_DEG * Math.PI / 180);
  const examinerSide = dot(fromCardToLight, normal) < 0;
  const towardPatient = dot(direction, normal) >= cosine;
  const withinReach = distanceAlongRay > 0 && distanceAlongRay <= THORINGTON_LIGHT_MAX_DISTANCE_M + 1e-8;
  // Contact with the metal aperture rim is rejected rather than counted as light through the hole.
  const apertureHit = Boolean(intersection && examinerSide && towardPatient && withinReach && radialDistanceM < THORINGTON_CARD_APERTURE_RADIUS_M - 1e-8);
  return Object.freeze({ examinerSide, towardPatient, withinReach, apertureHit, distanceAlongRay, radialDistanceM, intersection });
}

export function thoringtonSetupIssue(sample: ThoringtonSpatialSample, trialValue: ThoringtonTrial, requiredRodRefitRevision = -1) {
  if (!sample.tracking) return "Restore headset, controller and instrument tracking.";
  if (!sample.correctionFitted) return "Fit Arun's usual near correction.";
  if (!sample.rodFitted) return "Pick up and physically fit the Maddox rod before OD.";
  if (sample.rodFitRevision <= requiredRodRefitRevision) return "Remove the rod, roll it 90°, and physically refit it before OD.";
  if (!thoringtonGrooveCorrect(trialValue.axis, sample.grooveDegrees)) return `Use ${trialValue.axis} grooves for the ${trialValue.axis} measurement.`;
  if (!sample.cardPresent || !sample.cardHeldOrSupported) return "Pick up the combined cross card or place it on its support stand.";
  if (!thoringtonDistanceReady(sample.cardDistanceCm)) return "Position the card 38–42 cm from Arun.";
  if (!sample.cardFacing) return "Turn the numbered card surface toward Arun.";
  if (!sample.cardUpright) return "Keep the combined cross card upright.";
  if (!sample.penlightHeld) return "Pick up and keep holding the penlight.";
  if (!sample.penlightPowered) return "Keep the penlight trigger depressed.";
  if (!sample.penlightExaminerSide) return "Keep the penlight on the examiner side of the card.";
  if (!sample.penlightTowardPatient) return "Point the penlight through the card toward Arun.";
  if (sample.penlightWithinReach === false) return "Move the penlight closer to the card; keep the light path to its aperture within 30 cm.";
  if (!sample.apertureHit) return "Aim the penlight ray through the actual 10 mm central aperture.";
  if (!sample.fixationInstruction) return "Ask Arun to fixate and report the numbered line and side.";
  return "";
}

const resetCurrent = (run: ThoringtonRun, feedback: string, incrementRevision = true): ThoringtonRun => Object.freeze({ ...run,
  phase: "instruction", reportInstruction: false, stableSinceMs: null, poseInvalidSinceMs: null, capture: null, entryMagnitude: "", entrySide: "", entryInterpretation: "",
  setupRevision: run.setupRevision + (incrementRevision ? 1 : 0), feedback,
});

export function armThoringtonReport(run: ThoringtonRun, sample: ThoringtonSpatialSample): ThoringtonRun {
  if (run.phase === "complete" || run.capture || run.reportInstruction) return run;
  const current = THORINGTON_CASES[run.caseIndex].trials[run.trialIndex];
  const issue = thoringtonSetupIssue({ ...sample, fixationInstruction: true }, current, run.requiredRodRefitRevision);
  if (issue) return Object.freeze({ ...run, feedback: issue });
  return Object.freeze({ ...run, phase: "stability", reportInstruction: true, stableSinceMs: null,
    feedback: "Instruction given. Maintain the complete physical setup for 250 ms." });
}

export const thoringtonPatientReport = (trialValue: ThoringtonTrial) => `${trialValue.magnitude}, ${trialValue.reportedSide}.`;

export function sampleThorington(run: ThoringtonRun, sample: ThoringtonSpatialSample, nowMs: number): ThoringtonRun {
  if (run.phase === "complete") return run;
  const current = THORINGTON_CASES[run.caseIndex].trials[run.trialIndex];
  if (run.capture) {
    const rodChanged = !sample.correctionFitted || sample.correctionRevision !== run.capture.correctionRevision
      || !sample.rodFitted || !thoringtonGrooveCorrect(current.axis, sample.grooveDegrees)
      || sample.rodFitRevision !== run.capture.rodFitRevision;
    return rodChanged ? resetCurrent(run, "Correction or rod fitting changed. The unrecorded capture was cleared.") : run;
  }
  const issue = thoringtonSetupIssue(sample, current, run.requiredRodRefitRevision);
  if (issue) {
    // Geometry misses pause the request briefly, but never retain dwell credit.
    const poseOnly = run.reportInstruction && !thoringtonSetupIssue({ ...sample,
      cardDistanceCm: 40, cardFacing: true, cardUpright: true, penlightExaminerSide: true,
      penlightTowardPatient: true, penlightWithinReach: true, apertureHit: true }, current, run.requiredRodRefitRevision);
    const poseInvalidSinceMs = run.poseInvalidSinceMs ?? nowMs;
    if (poseOnly && nowMs - poseInvalidSinceMs < THORINGTON_POSE_JITTER_MS) return Object.freeze({ ...run,
      phase: "stability", stableSinceMs: null, poseInvalidSinceMs, feedback: issue });
    if (run.reportInstruction || run.stableSinceMs !== null) return resetCurrent(run, `${issue} Restart from the reporting instruction.`);
    return Object.freeze({ ...run, phase: "setup", stableSinceMs: null, feedback: issue });
  }
  if (!run.reportInstruction) return Object.freeze({ ...run, phase: "instruction", feedback: "Ask Arun to fixate and report the numbered line and side." });
  if (run.poseInvalidSinceMs !== null && nowMs - run.poseInvalidSinceMs >= THORINGTON_POSE_JITTER_MS) return resetCurrent(run, "Reposition the card and light, then ask Arun to fixate again.");
  const stableSinceMs = run.stableSinceMs ?? nowMs;
  if (nowMs - stableSinceMs < THORINGTON_STABILITY_DWELL_MS) return Object.freeze({ ...run, phase: "stability", stableSinceMs, poseInvalidSinceMs: null,
    feedback: `Hold the valid card and light geometry steady for ${Math.max(0, Math.ceil(THORINGTON_STABILITY_DWELL_MS - (nowMs - stableSinceMs)))} ms.` });
  const capture: ThoringtonCapture = Object.freeze({ caseId: THORINGTON_CASES[run.caseIndex].id, axis: current.axis,
    actualCardDistanceCm: sample.cardDistanceCm, signedCoordinate: current.signedCoordinate, rawReportedSide: current.reportedSide,
    report: thoringtonPatientReport(current), setupRevision: run.setupRevision, correctionRevision: sample.correctionRevision, rodFitRevision: sample.rodFitRevision });
  return Object.freeze({ ...run, phase: "captured", stableSinceMs, poseInvalidSinceMs: null, capture,
    feedback: "Report captured. Put the card and penlight down, then transcribe and interpret it independently." });
}

export function enterThorington(run: ThoringtonRun, magnitude: string, side: ThoringtonReportedSide | "", interpretation: ThoringtonInterpretation | "") {
  if (!run.capture || run.phase === "complete") return run;
  return Object.freeze({ ...run, phase: "entry" as const, entryMagnitude: magnitude, entrySide: side, entryInterpretation: interpretation, feedback: "" });
}

export function submitThorington(run: ThoringtonRun): ThoringtonRun {
  if (run.phase === "complete") return run;
  const capture = run.capture;
  if (!capture || !run.entryMagnitude.trim() || !run.entrySide || !run.entryInterpretation)
    return Object.freeze({ ...run, feedback: "Enter magnitude, Arun's raw reported side, and your clinical interpretation." });
  const expected = THORINGTON_CASES[run.caseIndex].trials[run.trialIndex];
  if (Number(run.entryMagnitude) !== expected.magnitude || run.entrySide !== capture.rawReportedSide || run.entryInterpretation !== expected.interpretation)
    return Object.freeze({ ...run, feedback: "That entry does not match the immutable report. Recheck the number, raw side, and interpretation separately." });
  const record: ThoringtonRecord = Object.freeze({ capture, submittedMagnitude: expected.magnitude, submittedSide: run.entrySide,
    submittedInterpretation: run.entryInterpretation });
  const records = Object.freeze([...run.records, record]);
  if (records.length === 2) return Object.freeze({ ...run, records, phase: "complete", completionAwarded: true,
    feedback: "Both axes recorded. The other authored case is now available." });
  return Object.freeze({ ...run, records, trialIndex: 1, phase: "setup", reportInstruction: false, stableSinceMs: null, poseInvalidSinceMs: null, capture: null,
    entryMagnitude: "", entrySide: "", entryInterpretation: "", requiredRodRefitRevision: capture.rodFitRevision,
    setupRevision: run.setupRevision + 1, feedback: "Horizontal recorded. Remove the rod, roll it 90°, and refit it for vertical measurement." });
}

export const cancelThoringtonEntry = (run: ThoringtonRun) => run.phase === "complete" ? run
  : resetCurrent(run, "Recording cancelled. Restart this axis from the reporting instruction.", false);
export const interruptThorington = (run: ThoringtonRun, reason: string) => run.capture || run.phase === "complete" ? run
  : resetCurrent(run, `${reason} Restart from the reporting instruction.`);
export const nextThoringtonCase = (run: ThoringtonRun) => newThoringtonRun(run.caseIndex + 1, run.completionAwarded);

export function thoringtonGuidedStep(run: ThoringtonRun, sample: ThoringtonSpatialSample): ThoringtonGuidedStep & { index: number } {
  const current = THORINGTON_CASES[run.caseIndex].trials[run.trialIndex];
  const cardGeometry = thoringtonDistanceReady(sample.cardDistanceCm) && sample.cardFacing && sample.cardUpright;
  const lightGeometry = sample.penlightHeld && sample.penlightPowered && sample.penlightExaminerSide && sample.penlightTowardPatient && sample.apertureHit;
  const checks = [
    ["correction", "Fit near correction", "Fit Arun's usual near correction before beginning.", sample.correctionFitted],
    ["rod", "Physically fit the rod", "Pick up the Maddox rod and fit its lens centre before OD.", sample.rodFitted && sample.rodFitRevision > run.requiredRodRefitRevision],
    ["grooves", "Set the groove direction", `Remove, roll and refit the rod with ${current.axis} grooves.`, thoringtonGrooveCorrect(current.axis, sample.grooveDegrees)],
    ["card", "Pick up or support the card", "Use the combined cross card in hand or on its support stand.", sample.cardPresent && sample.cardHeldOrSupported],
    ["card-geometry", "Set card geometry", !thoringtonDistanceReady(sample.cardDistanceCm) ? "Move the card to 38–42 cm; watch the distance beside its ray." : !sample.cardFacing ? "Turn the numbered card surface toward Arun." : "Keep the combined cross card upright.", cardGeometry],
    ["light", "Hold and aim the penlight", thoringtonSetupIssue({ ...sample, fixationInstruction: true }, current, run.requiredRodRefitRevision) || "Hold the lit penlight through the central aperture toward Arun.", lightGeometry],
    ["instruction", "Ask for number and side", "Select ASK ARUN TO FIXATE / REPORT on the right-side panel.", run.reportInstruction],
    ["stability", "Maintain stability", "Keep the card and lit penlight steady briefly. Arun’s reply is captured automatically.", run.stableSinceMs !== null],
    ["capture", "Preserve the report", "The number and side are now immutable. Put the card and light down.", Boolean(run.capture)],
    ["record", "Transcribe and interpret", "Put the card and penlight down, then enter number, reported side and interpretation.", run.records.length > run.trialIndex || run.phase === "complete"],
  ] as const;
  const index = run.capture || run.phase === "complete" ? checks.length - 1 : Math.max(0, checks.findIndex(check => !check[3]));
  const step = checks[index];
  return { id: `${THORINGTON_CASES[run.caseIndex].id}-${current.axis}-${step[0]}`, index, title: step[1],
    lines: [step[2], `Axis ${run.trialIndex + 1} of 2: ${current.axis}.`], complete: run.phase === "complete" };
}

export function thoringtonStatusDetail(run: ThoringtonRun, sample: ThoringtonSpatialSample) {
  const current = THORINGTON_CASES[run.caseIndex].trials[run.trialIndex];
  if (run.capture) return `Captured report: ${run.capture.report}`;
  const issue = thoringtonSetupIssue(sample, current, run.requiredRodRefitRevision);
  if (issue) return issue;
  if (!run.reportInstruction) return "Ask Arun to fixate and report the numbered line and side.";
  return run.feedback || "Maintain stable geometry for the report.";
}

/** Non-answer-bearing status categories used by independent Test. */
export function thoringtonTestStatus(run: ThoringtonRun, sample: ThoringtonSpatialSample) {
  const current = THORINGTON_CASES[run.caseIndex].trials[run.trialIndex];
  if (run.capture) return "Captured report; complete every required recording field.";
  if (!sample.tracking) return "Tracking/interruption state is not ready.";
  if (!sample.correctionFitted) return "Correction setup is incomplete.";
  if (!sample.rodFitted) return "Rod fitting is incomplete.";
  if (sample.rodFitRevision <= run.requiredRodRefitRevision) return "Rod reconfiguration is incomplete.";
  if (!thoringtonGrooveCorrect(current.axis, sample.grooveDegrees)) return "Groove direction is not ready.";
  if (!sample.cardPresent || !sample.cardHeldOrSupported) return "Card pickup/support is incomplete.";
  if (!thoringtonDistanceReady(sample.cardDistanceCm)) return "Card distance is not ready.";
  if (!sample.cardFacing) return "Card facing is not ready.";
  if (!sample.cardUpright) return "Card roll is not ready.";
  if (!sample.penlightHeld) return "Penlight pickup is incomplete.";
  if (!sample.penlightPowered) return "Trigger illumination is not ready.";
  if (!sample.penlightExaminerSide || !sample.penlightTowardPatient) return "Penlight side/direction is not ready.";
  if (sample.penlightWithinReach === false) return "Penlight-to-card distance is not ready.";
  if (!sample.apertureHit) return "Aperture aim is not ready.";
  if (!run.reportInstruction) return "Fixation/reporting instruction is required.";
  return "Stability dwell is in progress.";
}
