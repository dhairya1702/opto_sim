// Positions in metres, in patient-facing coordinates. Input devices (mouse,
// touch, keyboard, or a future XR controller) only update this target pose.
export type FixationTarget = { x: number; y: number; z: number };
export const gazePositions = [
  { id: "centre", label: "Centre", x: 0, y: 0 },
  { id: "up", label: "Up", x: 0, y: 0.7 },
  { id: "down", label: "Down", x: 0, y: -0.7 },
  { id: "left", label: "Screen left", x: -0.8, y: 0 },
  { id: "left-up", label: "Left + up", x: -0.8, y: 0.7 },
  { id: "left-down", label: "Left + down", x: -0.8, y: -0.7 },
  { id: "right", label: "Screen right", x: 0.8, y: 0 },
  { id: "right-up", label: "Right + up", x: 0.8, y: 0.7 },
  { id: "right-down", label: "Right + down", x: 0.8, y: -0.7 },
] as const;
export const MOTILITY_TARGET_RADIUS = 0.24;
export const MOTILITY_DWELL_SECONDS = 0.7;
export const MOTILITY_SPATIAL_GRACE_SECONDS = 0.2;
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));
export function targetFromControls(x: number, y: number, z: number): FixationTarget {
  const distance = clamp(z, 0.3, 0.4);
  return { x: clamp(x, -1, 1) * distance * 0.65, y: clamp(y, -1, 1) * distance * 0.45, z: distance };
}
export function gazeForEye(target: FixationTarget, eyeX: number) {
  return {
    yaw: clamp(Math.atan2(target.x - eyeX, target.z), -0.65, 0.65),
    pitch: clamp(Math.atan2(target.y, Math.hypot(target.z, target.x - eyeX)), -0.48, 0.48),
  };
}
export type MotilityCoverage = { seen: string[]; current: string | null; dwell: number; spatialGrace?: number };
export function observeTarget(state: MotilityCoverage, target: FixationTarget, dt: number, active: boolean): MotilityCoverage {
  const x = target.x / (target.z * 0.65), y = target.y / (target.z * 0.45);
  if (!active) return { ...state, current: null, dwell: 0, spatialGrace: 0 };
  const position = gazePositions.find(p => Math.hypot(p.x - x, p.y - y) < MOTILITY_TARGET_RADIUS);
  if (!position) {
    const spatialGrace = (state.spatialGrace ?? 0) + clamp(dt, 0, 0.1);
    return state.current && spatialGrace < MOTILITY_SPATIAL_GRACE_SECONDS
      ? { ...state, spatialGrace }
      : { ...state, current: null, dwell: 0, spatialGrace: 0 };
  }
  // Cap a frame's contribution: tab suspension must not complete an observation.
  const dwell = (state.current === position.id ? state.dwell : 0) + clamp(dt, 0, 0.1);
  const seen = dwell >= MOTILITY_DWELL_SECONDS && !state.seen.includes(position.id) ? [...state.seen, position.id] : state.seen;
  return { seen, current: position.id, dwell, spatialGrace: 0 };
}

export const motilityObservations = [
  ["full", "FROM · full, smooth and accurate OU"],
  ["limited", "Restricted, jerky or unequal"],
  ["unsure", "Unsure · repeat assessment"],
] as const;
export const MOTILITY_PATIENT_REPLY = "No double vision, pain, or discomfort in any direction.";
export function motilityRecordedObservation(observation: string) {
  return observation === "full"
    ? "Full movements; no diplopia reported during the simulated assessment."
    : observation === "limited"
      ? "Restricted or unequal ocular movement suspected; no diplopia reported."
      : observation === "unsure" ? "Ocular motility assessment uncertain; repeat examination required." : "";
}
