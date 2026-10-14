import { krimskyCases, krimskyEye, krimskyReady, krimskyResidual, type KrimskyBase, type KrimskyMethod } from "./krimsky";
import { CLINIC_EYE_MIDPOINT, CLINIC_PATIENT_EYES, CLINIC_IRIS_RADIUS } from "./clinicPatient";
import { xrHirschbergTechnique, type XRHirschbergTechniqueInput } from "./xrPractice";
import { xrPracticeEyePlacement } from "./xrPracticeBatch";
import type { ToolPoint } from "./xrConsultationTools";

export type KrimskyFinding = typeof krimskyCases[number];
export type ExaminerEye = "left" | "right";
export const KRIMSKY_BASELINE_DWELL_SECONDS = .8;
export const KRIMSKY_PRISM_POWERS = [0, 5, 10, 15, 20, 25, 30, 40] as const;

export function advanceKrimskyBaselineDwell(current: number, ready: boolean, dt: number) {
  if (!ready) return 0;
  return Math.min(KRIMSKY_BASELINE_DWELL_SECONDS, current + Math.max(0, Math.min(dt, .1)));
}

export function krimskyPrismPowerIndex(power: number) {
  let selected = 0;
  for (let index = 1; index < KRIMSKY_PRISM_POWERS.length; index++) {
    if (Math.abs(KRIMSKY_PRISM_POWERS[index] - power) < Math.abs(KRIMSKY_PRISM_POWERS[selected] - power)) selected = index;
  }
  return selected;
}

export function stepKrimskyPrismPower(power: number, direction: -1 | 1) {
  const index = krimskyPrismPowerIndex(power);
  return KRIMSKY_PRISM_POWERS[Math.max(0, Math.min(KRIMSKY_PRISM_POWERS.length - 1, index + direction))];
}

export function krimskyPrismCellY(power: number) {
  return .118 + krimskyPrismPowerIndex(power) * .032;
}

export type XRKrimskyInput = Omit<XRHirschbergTechniqueInput, "eyeMidpoint"> & {
  method: KrimskyMethod; examinerEye: ExaminerEye | null; baseline: boolean; base: string; power: number;
  prismPosition: ToolPoint | null; prismForward: ToolPoint; prismHeld: boolean;
};
export function xrKrimskyTechnique(input: XRKrimskyInput, finding: KrimskyFinding) {
  const spatial = xrHirschbergTechnique({ ...input, eyeMidpoint: CLINIC_EYE_MIDPOINT });
  const viewing = spatial.ready && Boolean(input.examinerEye);
  const prismEye = input.prismHeld && input.prismPosition ? xrPracticeEyePlacement(input.prismPosition, input.prismForward, true) : null;
  const prismPosition = input.prismPosition;
  const prismClear = Boolean(prismPosition && Object.values(CLINIC_PATIENT_EYES).every(eye => Math.hypot(...eye.map((value, i) => value - prismPosition[i])) >= .2));
  const validPower = Number.isInteger(input.power) && input.power >= 0 && input.power <= 40;
  const correctionReady = input.baseline && validPower && (input.base === "BI" || input.base === "BO")
    && input.held && spatial.aimReady && spatial.viewReady
    && krimskyReady(input.method, prismEye ?? "", input.light, input.fixation, spatial.distanceCm, Boolean(input.examinerEye));
  const residual = krimskyResidual(finding.power, correctionReady ? input.power : 0, input.base === finding.base);
  const lit = input.held && input.light && spatial.aimErrorDeg <= 12 && spatial.distanceCm >= 3 && spatial.distanceCm <= 120;
  return { ...spatial, method: input.method, base: input.base, power: input.power, viewing, prismEye, prismClear, correctionReady, residual, lit,
    baselineReady: viewing && prismClear, neutral: correctionReady && residual === 0 };
}
export type XRKrimskyTechnique = ReturnType<typeof xrKrimskyTechnique>;
/** Same signed linear relative-reflex model as desktop, scaled to the clinic iris. */
export function clinicKrimskyReflex(finding: KrimskyFinding, residual: number) {
  return Math.max(-.09, Math.min(.09, residual * finding.sign * .003)) * (CLINIC_IRIS_RADIUS / .1);
}
export type KrimskyComparison = Readonly<{ method: KrimskyMethod; eye: "OD" | "OS"; base: KrimskyBase; power: number; distanceCm: number }>;
export function captureKrimskyComparison(technique: XRKrimskyTechnique): KrimskyComparison | null {
  const { method, base, power } = technique;
  if (!technique.neutral || technique.prismEye !== krimskyEye(method) || (base !== "BI" && base !== "BO") || !Number.isInteger(power) || power < 0 || power > 40) return null;
  return Object.freeze({ method, eye: technique.prismEye, base, power, distanceCm: technique.distanceCm });
}
export function krimskyComparisonSubmission(comparison: KrimskyComparison | null, answer: string) {
  if (!comparison || answer.trim() === "") return null;
  const power = Number(answer);
  return Number.isInteger(power) && power >= 0 && power <= 40 && power === comparison.power;
}
