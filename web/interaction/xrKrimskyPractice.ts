import { krimskyCases, krimskyEye, krimskyReady, krimskyResidual, type KrimskyBase, type KrimskyMethod } from "./krimsky";
import { CLINIC_EYE_MIDPOINT, CLINIC_PATIENT_EYES, CLINIC_IRIS_RADIUS } from "./clinicPatient";
import { xrHirschbergTechnique, type XRHirschbergTechniqueInput } from "./xrPractice";
import { xrPracticeEyePlacement } from "./xrPracticeBatch";
import type { ToolPoint } from "./xrConsultationTools";

export type KrimskyFinding = typeof krimskyCases[number];
export type XRKrimskyInput = Omit<XRHirschbergTechniqueInput, "eyeMidpoint"> & {
  method: KrimskyMethod; monocular: boolean; baseline: boolean; base: string; power: number;
  prismPosition: ToolPoint | null; prismForward: ToolPoint; prismHeld: boolean;
};
export function xrKrimskyTechnique(input: XRKrimskyInput, finding: KrimskyFinding) {
  const spatial = xrHirschbergTechnique({ ...input, eyeMidpoint: CLINIC_EYE_MIDPOINT });
  const viewing = spatial.ready && input.monocular;
  const prismEye = input.prismHeld && input.prismPosition ? xrPracticeEyePlacement(input.prismPosition, input.prismForward, true) : null;
  const prismPosition = input.prismPosition;
  const prismClear = Boolean(prismPosition && Object.values(CLINIC_PATIENT_EYES).every(eye => Math.hypot(...eye.map((value, i) => value - prismPosition[i])) >= .2));
  const validPower = Number.isInteger(input.power) && input.power >= 0 && input.power <= 40;
  const correctionReady = input.baseline && validPower && (input.base === "BI" || input.base === "BO")
    && input.held && spatial.aimReady && spatial.viewReady
    && krimskyReady(input.method, prismEye ?? "", input.light, input.fixation, spatial.distanceCm, input.monocular);
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
