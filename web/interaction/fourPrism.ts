export type PrismEye = "OD" | "OS";
export type PrismCase = "normal" | "suppression";
export const prismObservationMs = 2400;
export function prismEyeAt(x: number, y: number): PrismEye | null {
  if (Math.hypot(x + 0.22, y - 0.2) < 0.085) return "OD";
  if (Math.hypot(x - 0.22, y - 0.2) < 0.085) return "OS";
  return null;
}
// Examiner-view gaze offsets: positive x is screen-right. OS is the suppressed eye.
export function fourPrismGaze(eye: PrismEye, scenario: PrismCase, elapsed: number) {
  if (elapsed < 300 || scenario === "suppression" && eye === "OS") return { od: 0, os: 0 };
  const version = eye === "OD" ? 0.035 : -0.035;
  if (elapsed < 1200 || scenario === "suppression") return { od: version, os: version };
  return eye === "OD" ? { od: version, os: 0 } : { od: 0, os: version };
}
