export type MaddoxSite = "distance" | "near";
export type MaddoxAxis = "horizontal" | "vertical";
export type MaddoxBase = "BI" | "BO" | "BU" | "BD";
export type MaddoxPhase = "setup" | "instruction" | "introduction" | "neutralisation" | "captured" | "entry" | "complete";

export const MADDOX_PRISM_CELLS = [2, 4, 6, 8, 10, 12, 15, 20] as const;
export type MaddoxPrismPower = typeof MADDOX_PRISM_CELLS[number];
export const MADDOX_ORIENTATION_TOLERANCE_DEG = 30;
export const MADDOX_REPORT_DWELL_MS = 250;
export const MADDOX_GUIDED_STEP_COUNT = 9;

export type MaddoxTrial = Readonly<{
  id: string;
  site: MaddoxSite;
  axis: MaddoxAxis;
  neutral: MaddoxPrismPower;
  base: MaddoxBase;
  grooveDegrees: 0 | 90;
}>;

export const MADDOX_TRIALS: readonly MaddoxTrial[] = Object.freeze([
  Object.freeze({ id: "distance-horizontal", site: "distance", axis: "horizontal", neutral: 6, base: "BI", grooveDegrees: 0 }),
  Object.freeze({ id: "distance-vertical", site: "distance", axis: "vertical", neutral: 4, base: "BU", grooveDegrees: 90 }),
  Object.freeze({ id: "near-horizontal", site: "near", axis: "horizontal", neutral: 6, base: "BI", grooveDegrees: 0 }),
  Object.freeze({ id: "near-vertical", site: "near", axis: "vertical", neutral: 4, base: "BU", grooveDegrees: 90 }),
]);

export type MaddoxSpatialSample = Readonly<{
  correctionFitted: boolean;
  rodFitted: boolean;
  grooveDegrees: number | null;
  targetReady: boolean;
  targetPowered: boolean;
  targetSite: MaddoxSite | null;
  distanceCm: number;
  fixationInstruction: boolean;
  prismHeld: boolean;
  prismForward: boolean;
  prismAligned: boolean;
  cell: MaddoxPrismPower | null;
  base: MaddoxBase | null;
  tracking: boolean;
}>;

export type MaddoxCapture = Readonly<{
  trialId: string;
  site: MaddoxSite;
  axis: MaddoxAxis;
  distanceCm: number;
  cell: MaddoxPrismPower;
  base: MaddoxBase;
  report: string;
  setupRevision: number;
}>;

export type MaddoxRecord = Readonly<{
  capture: MaddoxCapture;
  submittedPower: MaddoxPrismPower;
  submittedBase: MaddoxBase;
}>;

export type MaddoxRun = Readonly<{
  trialIndex: number;
  phase: MaddoxPhase;
  reportInstruction: boolean;
  introduced20: boolean;
  stableCell: MaddoxPrismPower | null;
  stableBase: MaddoxBase | null;
  stableSinceMs: number | null;
  report: string;
  capture: MaddoxCapture | null;
  entryPower: string;
  entryBase: MaddoxBase | "";
  records: readonly MaddoxRecord[];
  setupRevision: number;
  completionAwarded: boolean;
  feedback: string;
}>;

export type MaddoxGuidedStep = Readonly<{ id: string; title: string; lines: readonly string[]; complete: boolean }>;

export function newMaddoxRun(records: readonly MaddoxRecord[] = []): MaddoxRun {
  const complete = records.length >= MADDOX_TRIALS.length;
  return Object.freeze({ trialIndex: Math.min(records.length, MADDOX_TRIALS.length - 1), phase: complete ? "complete" : "setup", reportInstruction: false,
    introduced20: false, stableCell: null, stableBase: null, stableSinceMs: null, report: "", capture: null, entryPower: "", entryBase: "", records: Object.freeze([...records]),
    setupRevision: 0, completionAwarded: complete, feedback: "" });
}

const angularGap = (a: number, b: number) => {
  const delta = Math.abs(((a - b + 180) % 360 + 360) % 360 - 180);
  return Math.min(delta, Math.abs(delta - 180));
};
export const maddoxGrooveCorrect = (axis: MaddoxAxis, degrees: number | null) => degrees !== null
  && angularGap(degrees, axis === "horizontal" ? 0 : 90) <= MADDOX_ORIENTATION_TOLERANCE_DEG;

export function maddoxSetupIssue(sample: MaddoxSpatialSample, trial: MaddoxTrial) {
  if (!sample.tracking) return "Restore headset, controller and instrument tracking.";
  if (!sample.correctionFitted) return "Fit the trial frame over both eyes.";
  if (!sample.rodFitted) return "Fit the Maddox rod before OD.";
  if (!maddoxGrooveCorrect(trial.axis, sample.grooveDegrees)) return `Remove, roll and refit the rod with ${trial.axis} grooves.`;
  if (!sample.targetReady || sample.targetSite !== trial.site) return trial.site === "distance"
    ? "Pick up the point target and place it on the Distance Target Dock beside Arun."
    : "Pick up the penlight and hold it 38–42 cm in front of Arun's eyes, aimed toward him.";
  if (!sample.targetPowered) return trial.site === "distance"
    ? "Press the target's switch and confirm that the illuminated point appears in the mirror."
    : "Hold the penlight trigger to keep its light on.";
  if (!sample.fixationInstruction) return "Ask Arun to fixate and report where the streak lies relative to the light.";
  if (!sample.prismHeld) return "Pick up the stepped prism bar.";
  if (!sample.prismForward) return "Turn the prism bar's working face toward Arun.";
  if (sample.cell === null) return "Slide a labelled prism cell over OD.";
  if (!sample.prismAligned) return `Centre the ${sample.cell}Δ cell over OD.`;
  if (sample.base !== trial.base) return sample.base === null ? `Roll the bar until its base arrow shows ${trial.base}.` : `Change the physical base from ${sample.base} to ${trial.base}.`;
  return "";
}

export function maddoxPatientReport(trial: MaddoxTrial, power: MaddoxPrismPower, base: MaddoxBase) {
  const correctAxis = trial.axis === "horizontal" ? base === "BI" || base === "BO" : base === "BU" || base === "BD";
  if (!correctAxis) return `The ${trial.axis === "horizontal" ? "vertical" : "horizontal"} streak does not move toward the light on this prism axis.`;
  const correctDirection = base === trial.base;
  const residual = correctDirection ? power - trial.neutral : power + trial.neutral;
  if (correctDirection && residual === 0) return "The streak passes through the light.";
  const positive = trial.axis === "horizontal" ? "right" : "below";
  const negative = trial.axis === "horizontal" ? "left" : "above";
  return `The streak is ${residual > 0 ? positive : negative} of the light${correctDirection ? "." : " and moves farther away."}`;
}

const resetCurrent = (run: MaddoxRun, feedback: string, revision = run.setupRevision + 1): MaddoxRun => Object.freeze({ ...run,
  phase: "instruction", reportInstruction: false, introduced20: false, stableCell: null, stableBase: null, stableSinceMs: null, report: "", capture: null,
  entryPower: "", entryBase: "", setupRevision: revision, feedback,
});

export function armMaddoxReport(run: MaddoxRun, sample: MaddoxSpatialSample): MaddoxRun {
  if (run.phase === "complete" || run.capture) return run;
  const trial = MADDOX_TRIALS[run.trialIndex];
  const issue = maddoxSetupIssue({ ...sample, fixationInstruction: true, prismHeld: true, prismForward: true, prismAligned: true, cell: 20, base: trial.base }, trial);
  if (issue) return Object.freeze({ ...run, feedback: issue });
  return Object.freeze({ ...run, phase: "introduction", reportInstruction: true, feedback: "Arun is ready to report the streak/light relationship." });
}

export function sampleMaddox(run: MaddoxRun, sample: MaddoxSpatialSample, nowMs: number): MaddoxRun {
  if (run.phase === "complete" || run.capture) return run;
  const trial = MADDOX_TRIALS[run.trialIndex];
  // The required base is mandatory for the 20Δ introduction. After that valid
  // opposite/wrong-axis rolls still produce the fictional report, but cannot capture.
  const issue = run.introduced20 && sample.base !== null
    ? maddoxSetupIssue({ ...sample, base: trial.base }, trial)
    : maddoxSetupIssue(sample, trial);
  if (issue) {
    if (run.introduced20 || run.stableCell !== null) return resetCurrent(run, issue);
    return Object.freeze({ ...run, phase: run.reportInstruction ? "introduction" : "setup", stableCell: null, stableBase: null, stableSinceMs: null, report: "", feedback: issue });
  }
  if (!run.reportInstruction) return Object.freeze({ ...run, phase: "instruction", feedback: "Ask Arun to fixate and report before introducing prism." });
  if (!run.introduced20 && sample.cell !== 20) return Object.freeze({ ...run, phase: "introduction", stableCell: null, stableBase: null, stableSinceMs: null, report: "", feedback: "Introduce and stably centre the 20Δ cell first." });
  const introduced20 = run.introduced20 || sample.cell === 20;
  const same = run.stableCell === sample.cell && run.stableBase === sample.base;
  const stableSinceMs = same ? run.stableSinceMs : nowMs;
  const stable = stableSinceMs !== null && nowMs - stableSinceMs >= MADDOX_REPORT_DWELL_MS;
  const report = stable && sample.cell !== null ? maddoxPatientReport(trial, sample.cell, sample.base ?? trial.base) : same ? run.report : "";
  return Object.freeze({ ...run, phase: "neutralisation", introduced20, stableCell: sample.cell, stableBase: sample.base, stableSinceMs, report,
    feedback: stable ? report : `Hold the ${sample.cell}Δ cell steady for Arun's report.` });
}

export function captureMaddox(run: MaddoxRun, sample: MaddoxSpatialSample): MaddoxRun {
  if (run.capture || run.phase === "complete") return run;
  const trial = MADDOX_TRIALS[run.trialIndex];
  const issue = maddoxSetupIssue(sample, trial);
  if (issue) return Object.freeze({ ...run, feedback: issue });
  if (!run.introduced20) return Object.freeze({ ...run, feedback: "Introduce 20Δ before reducing the stepped bar." });
  if (sample.cell !== trial.neutral || sample.base !== trial.base || run.stableCell !== sample.cell || run.report !== "The streak passes through the light.") {
    return Object.freeze({ ...run, feedback: "Coincidence has not been reached. Continue through the stepped cells and listen to Arun's report." });
  }
  const capture: MaddoxCapture = Object.freeze({ trialId: trial.id, site: trial.site, axis: trial.axis, distanceCm: sample.distanceCm,
    cell: sample.cell, base: sample.base, report: run.report, setupRevision: run.setupRevision });
  return Object.freeze({ ...run, phase: "captured", capture, feedback: "Coincidence captured. Put the tools down and enter power and base independently." });
}

export function enterMaddox(run: MaddoxRun, power: string, base: MaddoxBase | ""): MaddoxRun {
  if (!run.capture || run.phase === "complete") return run;
  return Object.freeze({ ...run, phase: "entry", entryPower: power, entryBase: base, feedback: "" });
}

export function submitMaddox(run: MaddoxRun): MaddoxRun {
  if (run.phase === "complete") return run;
  const capture = run.capture;
  if (!capture || !run.entryPower.trim() || !run.entryBase) return Object.freeze({ ...run, feedback: "Enter both the captured prism power and base direction." });
  if (Number(run.entryPower) !== capture.cell || run.entryBase !== capture.base) return Object.freeze({ ...run, feedback: "That entry does not match the immutable coincidence capture. Recheck both power and base." });
  const record = Object.freeze({ capture, submittedPower: capture.cell, submittedBase: capture.base });
  const records = Object.freeze([...run.records, record]);
  if (records.length === MADDOX_TRIALS.length) return Object.freeze({ ...run, records, phase: "complete", completionAwarded: true, feedback: "All four Maddox measurements recorded once." });
  return Object.freeze({ ...newMaddoxRun(records), feedback: "Recorded. Remove, roll and refit the rod for the next trial." });
}

export const cancelMaddoxEntry = (run: MaddoxRun) => run.phase === "complete" ? run : resetCurrent(run, "Recording cancelled. Restart this trial from the reporting instruction and 20Δ introduction.", run.setupRevision);
export const interruptMaddox = (run: MaddoxRun, reason: string) => run.capture || run.phase === "complete" ? run : resetCurrent(run, `${reason} Restart from the reporting instruction and 20Δ introduction.`);

export function maddoxGuidedStep(run: MaddoxRun, sample: MaddoxSpatialSample): MaddoxGuidedStep & { index: number } {
  const trial = MADDOX_TRIALS[run.trialIndex];
  const correctTarget = sample.targetReady && sample.targetSite === trial.site;
  const targetGuidance = trial.site === "distance"
    ? !correctTarget
      ? { title: "Dock the distance target", lines: ["Pick up the point target from the left instrument table.", "Place it on the DISTANCE TARGET DOCK beside Arun."] }
      : { title: "Turn on the distance target", lines: ["Press the highlighted POWER switch on either side of the target.", "Confirm that the white point appears in the mirror."] }
    : !correctTarget
      ? { title: "Position the near penlight", lines: ["Pick up the penlight and aim it toward Arun.", "Hold it 38–42 cm in front of his eyes."] }
      : { title: "Turn on the near penlight", lines: ["Hold the penlight trigger to keep its light on.", "Keep it aimed toward Arun for this measurement."] };
  const checks = [
    ["correction", "Fit the trial frame", ["Pick up the trial frame from the instrument table.", "Place it over both of Arun's eyes."], sample.correctionFitted],
    ["rod", `Fit the rod for the ${trial.axis} test`, ["Place the red Maddox lens over Arun's right eye (OD).", `Rotate it to match the single ${trial.axis} guide.`], sample.rodFitted && maddoxGrooveCorrect(trial.axis, sample.grooveDegrees)],
    ["target", targetGuidance.title, targetGuidance.lines, correctTarget && sample.targetPowered],
    ["instruction", "Ask for the report", ["Ask Arun to fixate and report where the streak lies.", "Continue until he says it passes through the light."], run.reportInstruction],
    ["pickup", "Pick up the prism bar", ["Use the free hand to pick up the stepped prism bar."], sample.prismHeld],
    ["introduce", "Introduce 20Δ", ["Centre the prism's working ring over OD.", `Use up/down for 20Δ; ${trial.axis === "horizontal" ? "left selects BI and right selects BO" : "left selects BU and right selects BD"}.`], run.introduced20],
    ["reduce", "Reduce through the cells", ["Press the prism-hand thumbstick down to reduce power.", "Keep the working ring centred over OD until Arun reports coincidence."], run.report === "The streak passes through the light."],
    ["capture", "Capture coincidence", ["Press the prism-hand trigger only when Arun reports coincidence."], Boolean(run.capture)],
    ["record", "Record independently", ["Put the tools down.", "Enter the captured prism power and base without a preselected answer."], run.records.length > run.trialIndex || run.phase === "complete"],
  ] as const;
  const index = run.phase === "complete" ? checks.length - 1 : Math.max(0, checks.findIndex(check => !check[3]));
  const step = checks[index];
  return { id: `${trial.id}-${step[0]}`, index, title: step[1], lines: step[2], complete: run.phase === "complete" };
}

/** Show only the fitting guide needed by the current Maddox setup step. */
export function maddoxFittingGuideSocketIds(sample: MaddoxSpatialSample, trial: MaddoxTrial): readonly string[] {
  if (!sample.correctionFitted) return ["sensory-correction"];
  if (!sample.rodFitted || !maddoxGrooveCorrect(trial.axis, sample.grooveDegrees)) {
    return [trial.axis === "horizontal" ? "sensory-maddox-horizontal" : "sensory-maddox-vertical"];
  }
  return [];
}

/** Classify the visible base arrow after tracked roll. Zero degrees is BI; positive quarter turns follow BO, BU, BD. */
export function maddoxBaseFromRoll(degrees: number): MaddoxBase | null {
  const normalized = ((degrees % 360) + 360) % 360;
  const candidates: readonly [MaddoxBase, number][] = [["BI", 0], ["BU", 90], ["BO", 180], ["BD", 270]];
  return candidates.find(([, angle]) => Math.min(Math.abs(normalized - angle), 360 - Math.abs(normalized - angle)) <= MADDOX_ORIENTATION_TOLERANCE_DEG)?.[0] ?? null;
}

export function maddoxNearestCell(localY: number): MaddoxPrismPower | null {
  const index = MADDOX_PRISM_CELL_Y.reduce((best, y, candidate) => Math.abs(y - localY) < Math.abs(MADDOX_PRISM_CELL_Y[best] - localY) ? candidate : best, 0);
  return Math.abs(MADDOX_PRISM_CELL_Y[index] - localY) <= .018 ? MADDOX_PRISM_CELLS[index] : null;
}

export const MADDOX_PRISM_CELL_Y = MADDOX_PRISM_CELLS.map((_, index) => .118 + index * .032) as readonly number[];
