// Positions in metres, in patient-facing coordinates. Input devices (mouse,
// touch, keyboard, or a future XR controller) only update this target pose.
export type FixationTarget = { x: number; y: number; z: number };
export const gazePositions = [
  { id: "centre", label: "Primary gaze", x: 0, y: 0 },
  { id: "up", label: "Up gaze", x: 0, y: 0.7 },
  { id: "down", label: "Down gaze", x: 0, y: -0.7 },
  // The learner faces the patient: screen left is the patient's right gaze.
  { id: "left", label: "Right gaze", x: -0.8, y: 0 },
  { id: "left-up", label: "Right and up gaze", x: -0.8, y: 0.7 },
  { id: "left-down", label: "Right and down gaze", x: -0.8, y: -0.7 },
  { id: "right", label: "Left gaze", x: 0.8, y: 0 },
  { id: "right-up", label: "Left and up gaze", x: 0.8, y: 0.7 },
  { id: "right-down", label: "Left and down gaze", x: 0.8, y: -0.7 },
] as const;
export type GazePositionId = typeof gazePositions[number]["id"];
export const MOTILITY_TARGET_RADIUS = 0.24;
export const MOTILITY_DWELL_SECONDS = 0.7;
export const MOTILITY_SPATIAL_GRACE_SECONDS = 0.2;
export const MOTILITY_RECOVERY_DWELL_SECONDS = 0.3;
// Illustrative interaction tolerances, not a calibrated clinical target speed.
export const MOTILITY_MAX_NORMALIZED_SPEED = 3.2;
export const MOTILITY_ROUTE_CORRIDOR = 0.22;
export const MOTILITY_H_ROUTE: readonly GazePositionId[] = [
  "centre", "left", "left-up", "left", "left-down", "left", "centre",
  "up", "centre", "down", "centre",
  "right", "right-up", "right", "right-down",
];
const MOTILITY_NEIGHBOURS: Readonly<Record<GazePositionId, readonly GazePositionId[]>> = {
  centre: ["left", "right", "up", "down"],
  up: ["centre"], down: ["centre"],
  left: ["centre", "left-up", "left-down"],
  "left-up": ["left"], "left-down": ["left"],
  right: ["centre", "right-up", "right-down"],
  "right-up": ["right"], "right-down": ["right"],
};
export const motilityHRoutePositions = MOTILITY_H_ROUTE.map(id => gazePositions.find(position => position.id === id)!);
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
export type MotilityRecoveryReason = "route" | "speed" | "fixation";
export type MotilityCoverage = {
  seen: string[];
  current: string | null;
  dwell: number;
  spatialGrace?: number;
  anchor?: string | null;
  transition?: Readonly<{ from: string; to: string }> | null;
  recovery?: Readonly<{ returnTo: string; reason: MotilityRecoveryReason }> | null;
  previous?: Readonly<{ x: number; y: number }> | null;
  notice?: string;
};
export type MotilityObservationOptions = Readonly<{ assisted?: boolean }>;
export const newMotilityCoverage = (): MotilityCoverage => ({
  seen: [], current: null, dwell: 0, spatialGrace: 0, anchor: null,
  transition: null, recovery: null, previous: null, notice: "",
});
const gazePosition = (id: string | null | undefined) => gazePositions.find(position => position.id === id);
const neighbours = (id: string | null | undefined): readonly GazePositionId[] => {
  const position = gazePosition(id);
  return position ? MOTILITY_NEIGHBOURS[position.id] : [];
};
const recoveryNotice = (reason: MotilityRecoveryReason) => reason === "speed"
  ? "Move the target more slowly, then return to the last confirmed point."
  : reason === "fixation"
    ? "Re-establish fixation at the last confirmed point."
    : "Return to the last confirmed point.";
function pointSegmentDistance(point: { x: number; y: number }, from: { x: number; y: number }, to: { x: number; y: number }) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  const projection = lengthSquared ? ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared : 0;
  const bounded = clamp(projection, 0, 1);
  return { distance: Math.hypot(point.x - (from.x + dx * bounded), point.y - (from.y + dy * bounded)), projection };
}
function recoverMotility(state: MotilityCoverage, reason: MotilityRecoveryReason): MotilityCoverage {
  const anchor = gazePosition(state.anchor)?.id ?? (state.seen.includes("centre") ? "centre" : null);
  return { ...state, current: null, dwell: 0, spatialGrace: 0, transition: null, previous: null,
    recovery: anchor ? { returnTo: anchor, reason } : null,
    notice: anchor ? recoveryNotice(reason) : "Begin at the starting point." };
}
export function interruptMotility(state: MotilityCoverage): MotilityCoverage {
  if (state.seen.length === gazePositions.length)
    return { ...state, current: null, dwell: 0, spatialGrace: 0, transition: null, recovery: null, previous: null, notice: "" };
  return recoverMotility(state, "fixation");
}
export function motilityNextGazeIds(state: MotilityCoverage): readonly string[] {
  if (state.recovery?.returnTo) return [state.recovery.returnTo];
  if (state.transition?.to) return [state.transition.to];
  if (!state.anchor) return ["centre"];
  return neighbours(state.anchor);
}
function creditArrival(state: MotilityCoverage, destination: GazePositionId, dt: number, point: { x: number; y: number }): MotilityCoverage {
  if (state.seen.includes(destination)) return { ...state, anchor: destination, transition: null, recovery: null,
    current: destination, dwell: 0, spatialGrace: 0, previous: point, notice: "" };
  const dwell = (state.current === destination ? state.dwell : 0) + clamp(dt, 0, 0.1);
  if (dwell < MOTILITY_DWELL_SECONDS) return { ...state, current: destination, dwell, spatialGrace: 0, previous: point, notice: "Hold steady to observe this position." };
  return { ...state, seen: [...state.seen, destination], anchor: destination, transition: null, recovery: null,
    current: destination, dwell: MOTILITY_DWELL_SECONDS, spatialGrace: 0, previous: point, notice: "" };
}
export function observeTarget(state: MotilityCoverage, target: FixationTarget, dt: number, active: boolean, options: MotilityObservationOptions = {}): MotilityCoverage {
  const x = target.x / (target.z * 0.65), y = target.y / (target.z * 0.45);
  const point = { x, y };
  if (!active) return interruptMotility(state);
  const position = gazePositions.find(p => Math.hypot(p.x - x, p.y - y) < MOTILITY_TARGET_RADIUS);
  if (state.recovery) {
    if (position?.id !== state.recovery.returnTo) return { ...state, current: null, dwell: 0, spatialGrace: 0, previous: point,
      notice: recoveryNotice(state.recovery.reason) };
    const dwell = (state.current === position.id ? state.dwell : 0) + clamp(dt, 0, 0.1);
    if (dwell < MOTILITY_RECOVERY_DWELL_SECONDS) return { ...state, current: position.id, dwell, previous: point,
      notice: "Hold steady to restore the route." };
    return { ...state, anchor: position.id, current: position.id, dwell: 0, spatialGrace: 0,
      transition: null, recovery: null, previous: point, notice: "" };
  }
  const anchor = gazePosition(state.anchor);
  if (!anchor) {
    if (position?.id !== "centre") {
      const spatialGrace = state.current === "centre" ? (state.spatialGrace ?? 0) + clamp(dt, 0, 0.1) : 0;
      if (state.current === "centre" && spatialGrace < MOTILITY_SPATIAL_GRACE_SECONDS)
        return { ...state, spatialGrace, previous: point };
      return { ...state, current: null, dwell: 0, spatialGrace: 0, previous: point, notice: "Begin at the starting point." };
    }
    return creditArrival({ ...state, transition: { from: "centre", to: "centre" } }, "centre", dt, point);
  }
  const frameDt = clamp(dt, 0, 0.1);
  const movement = state.previous ? Math.hypot(point.x - state.previous.x, point.y - state.previous.y) : 0;
  if (!options.assisted && state.previous && frameDt > 0 && movement > .035 && movement / frameDt > MOTILITY_MAX_NORMALIZED_SPEED)
    return recoverMotility(state, "speed");
  if (!state.transition && position?.id === anchor.id)
    return { ...state, current: anchor.id, dwell: 0, spatialGrace: 0, previous: point, notice: "" };

  let transition = state.transition;
  if (!transition) {
    const allowed = neighbours(anchor.id);
    if (position && allowed.includes(position.id)) transition = { from: anchor.id, to: position.id };
    else if (position) return recoverMotility(state, "route");
    else {
      const match = allowed.map(id => {
        const destination = gazePosition(id)!;
        return { id, ...pointSegmentDistance(point, anchor, destination) };
      }).filter(candidate => candidate.projection >= 0 && candidate.projection <= 1 && candidate.distance <= MOTILITY_ROUTE_CORRIDOR)
        .sort((a, b) => a.distance - b.distance)[0];
      if (!match) return recoverMotility(state, "route");
      transition = { from: anchor.id, to: match.id };
    }
  }

  const from = gazePosition(transition.from), destination = gazePosition(transition.to);
  if (!from || !destination) return recoverMotility(state, "route");
  if (position?.id === from.id) return { ...state, anchor: from.id, transition: null, current: from.id,
    dwell: 0, spatialGrace: 0, previous: point, notice: "" };
  if (position && position.id !== destination.id) return recoverMotility(state, "route");
  const segment = pointSegmentDistance(point, from, destination);
  if (segment.distance > MOTILITY_ROUTE_CORRIDOR || segment.projection < 0 || segment.projection > 1.05)
    return recoverMotility(state, "route");
  if (position?.id === destination.id) return creditArrival({ ...state, transition }, destination.id, frameDt, point);
  if (state.current === destination.id && state.dwell > 0) {
    const spatialGrace = (state.spatialGrace ?? 0) + frameDt;
    if (spatialGrace < MOTILITY_SPATIAL_GRACE_SECONDS)
      return { ...state, transition, spatialGrace, previous: point };
  }
  return { ...state, transition, current: null, dwell: 0, spatialGrace: 0, previous: point, notice: "" };
}

export const motilityObservations = motilityScenarios.map(scenario => [scenario.id, scenario.label] as const);
export const MOTILITY_PATIENT_REPLY = motilityScenarios[0].patientReply;
export function motilityRecordedObservation(observation: string) {
  return motilityScenarios.find(scenario => scenario.id === observation)?.recordedFinding
    ?? (observation === "limited" ? "Restricted or unequal ocular movement suspected; repeat examination required."
      : observation === "unsure" ? "Ocular motility assessment uncertain; repeat examination required." : "");
}
