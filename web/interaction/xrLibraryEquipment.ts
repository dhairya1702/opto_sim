import { CLINIC_PATIENT_EYES } from "./clinicPatient";
import { PRACTICE_NEAR_SOCKET, xrPracticeEyePlacement } from "./xrPracticeBatch";
import { SENSORY_SURFACES, SENSORY_SOCKETS, SENSORY_DISTANCE_TARGET, SENSORY_NEAR_TARGET, sensoryNearCondition, sensoryMirrorPath, sensoryFittingSignature } from "./xrSensoryEquipment";
import { CONSULTATION_SURFACES, EXERCISE_SURFACE, consultationToolDefinition, type ConsultationToolId, type ConsultationTools, type PlacementSocket, type ToolPoint } from "./xrConsultationTools";
import type { SensoryWorkingPose } from "./xrSensoryEquipment";
export const LIBRARY_SURFACES = [...CONSULTATION_SURFACES, ...SENSORY_SURFACES, EXERCISE_SURFACE];
export type LibraryKind = "maddox" | "thorington" | "npc" | "horizontal-distance" | "vertical-distance" | "horizontal-near" | "facility" | "push-up" | "minus-lens" | "relative" | "accommodative-facility";
export type LibraryEye = "OD" | "OS" | "OU";
export const LIBRARY_TITLES: Record<LibraryKind, string> = {
  maddox: "Maddox rod", thorington: "Modified Thorington", npc: "Near point of convergence", "horizontal-distance": "Horizontal distance vergence", "vertical-distance": "Vertical distance vergence", "horizontal-near": "Horizontal near vergence", facility: "Near vergence facility", "push-up": "Push-up amplitude", "minus-lens": "Minus-lens amplitude", relative: "NRA / PRA", "accommodative-facility": "Accommodative facility",
};
export const libraryTool = (kind: LibraryKind): ConsultationToolId => kind === "maddox" ? "prism" : kind === "thorington" ? "thorington" : kind === "npc" || kind === "push-up" ? "fixation" : kind === "facility" ? "prism-flipper" : kind === "accommodative-facility" ? "lens-flipper" : kind === "minus-lens" || kind === "relative" ? "trial-lens" : "prism";
export function libraryEquipment(kind: LibraryKind): readonly ConsultationToolId[] {
  if (kind === "maddox") return ["subjective", "maddox", "prism", "worth"];
  if (kind === "thorington") return ["subjective", "maddox", "thorington", "pupils"];
  if (kind === "npc" || kind === "push-up") return kind === "npc" ? ["subjective", "fixation"] : ["subjective", "fixation", "cover"];
  if (kind === "horizontal-distance" || kind === "vertical-distance") return ["subjective", "prism"];
  if (kind === "horizontal-near" || kind === "facility") return ["subjective", "near", libraryTool(kind)];
  return ["subjective", "near", libraryTool(kind), ...(kind === "relative" ? [] : ["cover" as const])];
}
const rootPoint = (id: ConsultationToolId, point: ToolPoint): ToolPoint => point.map((v, i) => v - consultationToolDefinition(id).workingPoint[i]) as unknown as ToolPoint;
export const LIBRARY_SOCKETS: readonly PlacementSocket[] = [
  ...SENSORY_SOCKETS, PRACTICE_NEAR_SOCKET,
  { id: "sensory-maddox", tool: "maddox", position: rootPoint("maddox", [-.048, 1.5, -.475]), rotation: [0, 0, 0, 1], radius: .065, orientationToleranceRad: Math.PI / 6, fittingLayer: "filters" },
  ...(["OD", "OS"] as const).map(eye => ({ id: `sensory-occlude-${eye}`, tool: "cover" as const, position: rootPoint("cover", [CLINIC_PATIENT_EYES[eye][0], 1.5, -.46]), rotation: [0, 0, 0, 1] as const, radius: .025, orientationToleranceRad: Math.PI / 6, fittingLayer: "occlusion" as const })),
  { id: "library-thorington-near", tool: "thorington", position: rootPoint("thorington", SENSORY_NEAR_TARGET), rotation: [0, 0, 0, 1], radius: .10, orientationToleranceRad: Math.PI / 6 },
];
export const librarySockets = (kind: LibraryKind) => LIBRARY_SOCKETS.filter(socket => libraryEquipment(kind).includes(socket.tool));
export function libraryOcclusion(tools: ConsultationTools, eye: LibraryEye) {
  const placement = tools.cover.placement;
  if (eye === "OU") return placement.kind !== "held" && !placement.socketId?.startsWith("sensory-occlude-");
  return placement.kind === "socket" && placement.socketId === `sensory-occlude-${eye === "OD" ? "OS" : "OD"}`;
}
export function libraryRodFitted(tools: ConsultationTools) { return tools.maddox.placement.kind === "socket" && tools.maddox.placement.socketId === "sensory-maddox"; }
export const librarySetupKey = (tools: ConsultationTools, kind: LibraryKind) => sensoryFittingSignature(tools, kind === "maddox" || kind === "thorington" ? ["subjective", "maddox"] : ["subjective"]);
export function libraryDistance(pose: SensoryWorkingPose | null, spectaclePlane = false) {
  if (!pose) return { distanceCm: 0, ready: false };
  const point: ToolPoint = [0, 1.5, spectaclePlane ? -.511 : -.573];
  const delta = point.map((v, i) => v - pose.position[i]), length = Math.hypot(...delta);
  const facing = length > 0 && delta.reduce((sum, v, i) => sum + v * pose.forward[i], 0) / length >= Math.cos(Math.PI / 6);
  return { distanceCm: length * 100, ready: facing && pose.position[2] > point[2] && Math.hypot(pose.position[0], pose.position[1] - 1.5) <= .10 };
}
export function libraryOpticPlacement(pose: SensoryWorkingPose | null, eye: LibraryEye, bilateral = false) {
  if (!pose || pose.forward[2] > -Math.cos(Math.PI / 6)) return false;
  if (eye !== "OU" && !bilateral) return xrPracticeEyePlacement(pose.position, pose.forward, true) === eye;
  return Math.abs(pose.position[0]) <= .022 && Math.abs(pose.position[1] - 1.5) <= .025 && pose.position[2] >= -.555 && pose.position[2] <= -.423;
}
export function libraryNear(pose: SensoryWorkingPose | null) { return pose ? sensoryNearCondition(pose).ready : false; }
export function libraryLightThroughCard(card: SensoryWorkingPose | null, light: SensoryWorkingPose | null) {
  if (!card || !light || !libraryNear(card)) return false;
  const d = light.forward, delta = card.position.map((v, i) => v - light.position[i]);
  const t = delta.reduce((sum, v, i) => sum + v * d[i], 0);
  return t > 0 && t <= .30 && Math.hypot(...delta.map((v, i) => v - t * d[i])) <= .012;
}
export const LIBRARY_DISTANCE_PATH = sensoryMirrorPath(SENSORY_DISTANCE_TARGET);
