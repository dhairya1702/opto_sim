import { CLINIC_EYE_MIDPOINT } from "./clinicPatient";
import {
  consultationToolDefinition, socketOrientationMatches,
  type ConsultationToolId, type ConsultationTools, type PlacementSocket, type PlacementSurface, type ToolPoint,
} from "./xrConsultationTools";

export type SensoryWorkingPose = { position: ToolPoint; forward: ToolPoint };
export type SensoryKind = "worth" | "stereo" | "four-prism";
const identity = [0, 0, 0, 1] as const;
const reverse = [0, 1, 0, 0] as const;
const nearZ = CLINIC_EYE_MIDPOINT[2] + Math.sqrt(.4 ** 2 - .075 ** 2);
const mirrorZ = 2.3;
const dockX = .65;
const dockTargetZ = 2 * mirrorZ - CLINIC_EYE_MIDPOINT[2] - Math.sqrt(6 ** 2 - dockX ** 2);
/** One planar illustrative mirror; reflection/intersection calculations determine the optical path. */
export const SENSORY_MIRROR = { center: [.32, 1.5, mirrorZ] as ToolPoint, width: .95, height: .64 };
export const SENSORY_DISTANCE_TARGET: ToolPoint = [dockX, 1.5, dockTargetZ];
export const SENSORY_NEAR_TARGET: ToolPoint = [0, 1.425, nearZ];
const rootAtWorkingPoint = (id: ConsultationToolId, position: ToolPoint, reversed = false): ToolPoint => {
  const [x, y, z] = consultationToolDefinition(id).workingPoint;
  return [position[0] - (reversed ? -x : x), position[1] - y, position[2] - (reversed ? -z : z)];
};
export const SENSORY_SURFACES: readonly PlacementSurface[] = [{ id: "sensory-tray", x: 1.31, z: 1.04, y: .88, width: .92, depth: .52 }];
export const SENSORY_SOCKETS: readonly PlacementSocket[] = [
  { id: "sensory-correction", tool: "subjective", position: [0, 1.5, -.511], rotation: identity, radius: .085, orientationToleranceRad: Math.PI / 6, fittingLayer: "correction" },
  { id: "sensory-red-green", tool: "red-green", position: [0, 1.5, -.482], rotation: identity, radius: .085, orientationToleranceRad: Math.PI / 6, fittingLayer: "filters" },
  { id: "sensory-polarised", tool: "polarised", position: [0, 1.5, -.482], rotation: identity, radius: .085, orientationToleranceRad: Math.PI / 6, fittingLayer: "filters" },
  { id: "sensory-worth-near", tool: "worth", position: rootAtWorkingPoint("worth", SENSORY_NEAR_TARGET), rotation: identity, radius: .11, orientationToleranceRad: Math.PI / 6 },
  { id: "sensory-stereo-near", tool: "stereo", position: rootAtWorkingPoint("stereo", SENSORY_NEAR_TARGET), rotation: identity, radius: .11, orientationToleranceRad: Math.PI / 6 },
  { id: "sensory-worth-distance", tool: "worth", position: rootAtWorkingPoint("worth", SENSORY_DISTANCE_TARGET, true), rotation: reverse, radius: .11, orientationToleranceRad: Math.PI / 6 },
];
export function sensoryEquipment(kind: SensoryKind): readonly ConsultationToolId[] {
  if (kind === "worth") return ["subjective", "red-green", "worth"];
  if (kind === "stereo") return ["subjective", "polarised", "stereo"];
  return ["subjective", "prism"];
}
export function sensorySockets(kind: SensoryKind) {
  const equipment = sensoryEquipment(kind);
  return SENSORY_SOCKETS.filter(socket => equipment.includes(socket.tool));
}
const gap = (a: ToolPoint, b: ToolPoint) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
/** A spatially close table/home release cannot impersonate a tagged patient fitting. */
export function isPatientFitted(tools: ConsultationTools, id: ConsultationToolId) {
  const socket = SENSORY_SOCKETS.find(candidate => candidate.tool === id && candidate.fittingLayer);
  const placement = tools[id].placement;
  return Boolean(socket && placement.kind === "socket" && placement.socketId === socket.id
    && placement.fittingLayer === socket.fittingLayer && gap(placement.position, socket.position) < 1e-6
    && socketOrientationMatches(placement.rotation, socket));
}
/** Refit/removal is a setup change even if a later refit returns to the same authored pose. */
export function sensoryFittingSignature(tools: ConsultationTools, ids: readonly ConsultationToolId[]) {
  return ids.map(id => {
    const placement = tools[id].placement;
    return `${id}:${tools[id].revision ?? 0}:${placement.kind}:${placement.kind === "held" ? placement.hand : `${placement.socketId ?? ""}:${placement.position.join(",")}:${placement.rotation.join(",")}`}`;
  }).join("|");
}
function facingPoint(pose: SensoryWorkingPose, point: ToolPoint) {
  const vector: ToolPoint = [point[0] - pose.position[0], point[1] - pose.position[1], point[2] - pose.position[2]];
  const length = Math.hypot(...pose.forward) * Math.hypot(...vector);
  return length > 0 && pose.forward.reduce((sum, value, i) => sum + value * vector[i], 0) / length >= Math.cos(Math.PI / 6);
}
/** Existing stereo distance range, plus spatial/facing checks; epsilon keeps exact boundary samples valid. */
export function sensoryNearCondition(pose: SensoryWorkingPose) {
  const distanceCm = gap(pose.position, CLINIC_EYE_MIDPOINT) * 100;
  const facing = facingPoint(pose, CLINIC_EYE_MIDPOINT);
  const aligned = pose.position[2] > CLINIC_EYE_MIDPOINT[2] && Math.hypot(pose.position[0], pose.position[1] - CLINIC_EYE_MIDPOINT[1]) <= .10;
  return { distanceCm, facing, ready: facing && aligned && distanceCm >= 38 - 1e-8 && distanceCm <= 42 + 1e-8 };
}
export function sensoryMirrorPath(target: ToolPoint, mirror = SENSORY_MIRROR) {
  const virtualTarget: ToolPoint = [target[0], target[1], 2 * mirror.center[2] - target[2]];
  const denominator = virtualTarget[2] - CLINIC_EYE_MIDPOINT[2];
  const t = denominator ? (mirror.center[2] - CLINIC_EYE_MIDPOINT[2]) / denominator : -1;
  const intersection: ToolPoint = CLINIC_EYE_MIDPOINT.map((value, i) => value + t * (virtualTarget[i] - value)) as unknown as ToolPoint;
  const valid = t > 0 && t < 1 && target[2] < mirror.center[2]
    && Math.abs(intersection[0] - mirror.center[0]) <= mirror.width / 2
    && Math.abs(intersection[1] - mirror.center[1]) <= mirror.height / 2;
  return { valid, distanceCm: gap(virtualTarget, CLINIC_EYE_MIDPOINT) * 100, intersection, virtualTarget };
}
/** Worth's ±2 cm near handling tolerance is an interaction tolerance, not a clinical cutoff. */
export function sensoryTargetCondition(pose: SensoryWorkingPose, tools: ConsultationTools): { distanceCm: number; endpoint: "near" | "distance" | null; facing: boolean } {
  const placement = tools.worth.placement;
  const dock = SENSORY_SOCKETS.find(socket => socket.id === "sensory-worth-distance");
  const docked = dock && placement.kind === "socket" && placement.socketId === dock.id
    && gap(placement.position, dock.position) < 1e-6 && socketOrientationMatches(placement.rotation, dock)
    && gap(pose.position, SENSORY_DISTANCE_TARGET) < .002;
  if (docked) {
    const path = sensoryMirrorPath(pose.position);
    const facing = path.valid && facingPoint(pose, path.intersection);
    return { distanceCm: path.distanceCm, endpoint: facing && Math.abs(path.distanceCm - 600) < .2 ? "distance" : null, facing };
  }
  const near = sensoryNearCondition(pose);
  return { distanceCm: near.distanceCm, endpoint: near.ready ? "near" : null, facing: near.facing };
}
