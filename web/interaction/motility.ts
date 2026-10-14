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

export type MotilityEye = "OD" | "OS";
export type MotilityScenarioId = "full" | "od-abduction" | "os-abduction" | "od-elevation" | "right-gaze-nystagmus";
export type MotilityScenario = {
  id: MotilityScenarioId;
  label: string;
  shortLabel: string;
  patientReply: string;
  recordedFinding: string;
  teachingFeedback: string;
};

/**
 * Authored educational examples for the Practice module. These are observable
 * findings, not diagnoses or a physiologically complete motility model.
 */
export const motilityScenarios: readonly MotilityScenario[] = [
  {
    id: "full",
    label: "FROM · full, smooth and accurate OU",
    shortLabel: "Full movements OU",
    patientReply: "No double vision, pain, or discomfort in any direction.",
    recordedFinding: "FROM; smooth and accurate OU; no diplopia, pain, or discomfort reported.",
    teachingFeedback: "Full movements were smooth and accurate in both eyes, with no symptoms reported.",
  },
  {
    id: "od-abduction",
    label: "OD abduction restricted in right gaze",
    shortLabel: "OD abduction restriction",
    patientReply: "I see two images when I look to my right. I do not have pain or discomfort.",
    recordedFinding: "OD abduction restricted in right gaze; horizontal diplopia reported in right gaze.",
    teachingFeedback: "OD did not abduct fully in right gaze, and the patient localized horizontal diplopia to that direction.",
  },
  {
    id: "os-abduction",
    label: "OS abduction restricted in left gaze",
    shortLabel: "OS abduction restriction",
    patientReply: "I see two images when I look to my left. I do not have pain or discomfort.",
    recordedFinding: "OS abduction restricted in left gaze; horizontal diplopia reported in left gaze.",
    teachingFeedback: "OS did not abduct fully in left gaze, and the patient localized horizontal diplopia to that direction.",
  },
  {
    id: "od-elevation",
    label: "OD elevation restricted in upgaze",
    shortLabel: "OD elevation restriction",
    patientReply: "I see two images when I look up. I do not have pain or discomfort.",
    recordedFinding: "OD elevation restricted in upgaze; diplopia reported in upgaze.",
    teachingFeedback: "OD showed reduced elevation compared with OS, with diplopia localized to upgaze.",
  },
  {
    id: "right-gaze-nystagmus",
    label: "Horizontal jerk nystagmus in right gaze",
    shortLabel: "Right-gaze nystagmus",
    patientReply: "I do not see double and I do not have pain, but things feel slightly unsteady when I look to my right.",
    recordedFinding: "Horizontal jerk nystagmus observed in right gaze; no diplopia or pain reported.",
    teachingFeedback: "A horizontal jerk-like oscillation was present in right gaze; the patient reported slight visual unsteadiness without diplopia or pain.",
  },
] as const;

export const motilityScenarioIds = motilityScenarios.map(scenario => scenario.id);
export const motilityScenario = (id: MotilityScenarioId) => motilityScenarios.find(scenario => scenario.id === id) ?? motilityScenarios[0];

/** Patient-facing gaze: screen left is the patient's right gaze. */
export function scenarioGazeForEye(id: MotilityScenarioId, target: FixationTarget, eye: MotilityEye, elapsedSeconds = 0) {
  const base = gazeForEye(target, eye === "OD" ? -0.032 : 0.032);
  const horizontal = target.x / Math.max(target.z, .001);
  const vertical = target.y / Math.max(target.z, .001);
  if (id === "od-abduction" && eye === "OD" && horizontal < -.15) return { ...base, yaw: base.yaw * .22 };
  if (id === "os-abduction" && eye === "OS" && horizontal > .15) return { ...base, yaw: base.yaw * .22 };
  if (id === "od-elevation" && eye === "OD" && vertical > .15) return { ...base, pitch: base.pitch * .2 };
  if (id === "right-gaze-nystagmus" && horizontal < -.15) {
    const phase = elapsedSeconds * 3.2;
    const jerk = ((phase - Math.floor(phase)) * 2 - 1) * .055;
    return { ...base, yaw: base.yaw + jerk };
  }
  return base;
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

export const motilityObservations = motilityScenarios.map(scenario => [scenario.id, scenario.label] as const);
export const MOTILITY_PATIENT_REPLY = motilityScenarios[0].patientReply;
export function motilityRecordedObservation(observation: string) {
  return motilityScenarios.find(scenario => scenario.id === observation)?.recordedFinding
    ?? (observation === "limited" ? "Restricted or unequal ocular movement suspected; repeat examination required."
      : observation === "unsure" ? "Ocular motility assessment uncertain; repeat examination required." : "");
}
