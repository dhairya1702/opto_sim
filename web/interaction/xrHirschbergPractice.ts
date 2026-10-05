import { hirschbergReflexOffset } from "./opticPractice";
import { CLINIC_IRIS_RADIUS, CLINIC_PUPIL_RADIUS } from "./clinicPatient";
import type { XRHirschbergTechnique } from "./xrPractice";

/** Preserve the existing lesson's direction/landmarks at the canonical patient's eye scale. */
export function clinicHirschbergReflex(position: readonly [number, number]) {
  const source = hirschbergReflexOffset(position);
  const length = Math.hypot(source.x, source.y);
  if (!length) return { x: 0, y: 0 };
  const radius = length <= .030001 ? CLINIC_PUPIL_RADIUS
    : length <= .048001 ? (CLINIC_PUPIL_RADIUS + CLINIC_IRIS_RADIUS) / 2 : CLINIC_IRIS_RADIUS;
  return { x: source.x / length * radius, y: source.y / length * radius };
}

export const emptyHirschbergTechnique = (): XRHirschbergTechnique => ({
  distanceCm: 0, aimErrorDeg: 180, viewErrorDeg: 180,
  distanceReady: false, aimReady: false, viewReady: false, ready: false, quality: 0,
});

export type HirschbergPracticeFinding = { direction: string; amount: string; feedback: string };
export function hirschbergSubmission(technique: XRHirschbergTechnique, direction: string, amount: string, finding: HirschbergPracticeFinding) {
  if (!technique.ready || !direction || !amount) return null;
  return direction === finding.direction && amount === finding.amount;
}
