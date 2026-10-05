export type RetinoscopyEye = "OD" | "OS";
export type RetinoscopePose = { x: number; y: number };
export type ReflexMotion = "with" | "neutral" | "against";
export type SweepZone = "left" | "centre" | "right";

export const retinoscopyTargets: Record<RetinoscopyEye, RetinoscopePose> = {
  OD: { x: -0.34, y: 0 },
  OS: { x: 0.34, y: 0 },
};

export const authoredNetSphere: Record<RetinoscopyEye, number> = {
  OD: -1.25,
  OS: -1.5,
};

export function workingDistanceDioptres(distanceCm: number) {
  return 100 / Math.max(1, distanceCm);
}

export function grossNeutralLens(eye: RetinoscopyEye, distanceCm: number, netSphere = authoredNetSphere[eye]) {
  const result = Math.round((netSphere + workingDistanceDioptres(distanceCm)) * 4) / 4;
  return Object.is(result, -0) ? 0 : result;
}

export function reflexMotion(eye: RetinoscopyEye, distanceCm: number, trialLens: number, netSphere = authoredNetSphere[eye]): ReflexMotion {
  const difference = grossNeutralLens(eye, distanceCm, netSphere) - trialLens;
  if (Math.abs(difference) <= 0.12) return "neutral";
  return difference > 0 ? "with" : "against";
}

export function reflexQuality(eye: RetinoscopyEye, distanceCm: number, trialLens: number, netSphere = authoredNetSphere[eye]) {
  const error = Math.abs(grossNeutralLens(eye, distanceCm, netSphere) - trialLens);
  return {
    brightness: Math.max(0.28, 1 - error * 0.25),
    width: Math.max(0.18, 1 - error * 0.32),
    speed: Math.max(0.2, 1 - error * 0.28),
  };
}

export function retinoscopeAligned(eye: RetinoscopyEye, pose: RetinoscopePose) {
  const target = retinoscopyTargets[eye];
  return Math.abs(pose.x - target.x) <= 0.2 && Math.abs(pose.y - target.y) <= 0.22;
}

export function retinoscopySweepZone(eye: RetinoscopyEye, pose: RetinoscopePose): SweepZone {
  const dx = pose.x - retinoscopyTargets[eye].x;
  if (dx < -0.055) return "left";
  if (dx > 0.055) return "right";
  return "centre";
}

export function formatSignedDioptres(value: number) {
  if (value === 0) return "0.00 D";
  return `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(2)} D`;
}
