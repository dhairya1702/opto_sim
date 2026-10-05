import type { XRClinicHand, XRClinicQuaternion, XRClinicVector3 } from "./xrClinic";

export type ConsultationHand = XRClinicHand;
export type ToolPoint = XRClinicVector3;
export type ToolRotation = XRClinicQuaternion;
export type ConsultationToolId = "distance" | "pinhole" | "cover" | "pupils" | "motility" | "objective" | "near" | "subjective" | "fundus" | "prism" | "worth" | "red-green" | "polarised" | "stereo" | "maddox" | "thorington" | "trial-lens" | "lens-flipper" | "prism-flipper" | "fixation";
export type RestingTool = { kind: "socket" | "surface"; position: ToolPoint; rotation: ToolRotation; socketId?: string; fittingLayer?: "correction" | "filters" | "occlusion" };
export type ConsultationTool = {
  placement: RestingTool | { kind: "held"; hand: ConsultationHand };
  lastRest: RestingTool;
  powered: boolean;
  revision?: number;
};
export type ConsultationTools = Record<ConsultationToolId, ConsultationTool>;
export type ConsultationToolDefinition = {
  id: ConsultationToolId;
  label: string;
  home: ToolPoint;
  /** Canonical model origin is the handle/grip, not the supporting stand. */
  workingPoint: ToolPoint;
  forward: ToolPoint;
  gripRotation: ToolRotation;
  restRotation: ToolRotation;
  restHeight: number;
  footprint: readonly [number, number];
  illuminates: boolean;
  powerMode?: "momentary" | "persistent";
};
const upright: ToolRotation = [0, 0, 0, 1];
const flatCard: ToolRotation = [-Math.SQRT1_2, 0, 0, Math.SQRT1_2];
const forwardGrip: ToolRotation = [-Math.SQRT1_2, 0, 0, Math.SQRT1_2];
const reverseGrip: ToolRotation = [0, 1, 0, 0];
const paddle = { workingPoint: [0, .121, 0] as ToolPoint, forward: [0, 0, -1] as ToolPoint, gripRotation: upright, restRotation: upright, restHeight: .10, footprint: [.13, .065] as const, illuminates: false };
// These positions belong to the existing consultation room, not the Practice layout.
export const CONSULTATION_TOOLS: readonly ConsultationToolDefinition[] = [
  { ...paddle, id: "distance", label: "Acuity occluder", home: [-1.65, .9775, .59] },
  { ...paddle, id: "pinhole", label: "Pinhole", home: [-1.48, .9775, .59] },
  { ...paddle, id: "cover", label: "Cover occluder", home: [-1.31, .9775, .59] },
  { id: "pupils", label: "Penlight", home: [-1.34, .9925, .77], workingPoint: [0, .137, 0], forward: [0, 1, 0], gripRotation: forwardGrip, restRotation: upright, restHeight: .115, footprint: [.06, .06], illuminates: true },
  { id: "motility", label: "Motility target", home: [-1.13, .9975, .77], workingPoint: [0, .137, 0], forward: [0, 1, 0], gripRotation: forwardGrip, restRotation: upright, restHeight: .12, footprint: [.055, .055], illuminates: true },
  { id: "objective", label: "Retinoscope", home: [-1.1, .99, .59], workingPoint: [0, .17, .032], forward: [0, 0, 1], gripRotation: reverseGrip, restRotation: upright, restHeight: .1125, footprint: [.12, .065], illuminates: true },
  { id: "near", label: "Near card", home: [-1.57, .8945, .92], workingPoint: [0, 0, .005], forward: [0, 0, 1], gripRotation: reverseGrip, restRotation: flatCard, restHeight: .017, footprint: [.25, .18], illuminates: false },
  { id: "subjective", label: "Trial frame", home: [-1.45, .9625, -1.08], workingPoint: [0, 0, 0], forward: [0, 0, -1], gripRotation: upright, restRotation: upright, restHeight: .0825, footprint: [.34, .20], illuminates: false },
  { id: "prism", label: "Prism bar", home: [-1.73, 1.0325, -.95], workingPoint: [0, .143, .012], forward: [0, 0, -1], gripRotation: upright, restRotation: upright, restHeight: .1525, footprint: [.10, .065], illuminates: false },
  { id: "fundus", label: "Ophthalmoscope", home: [-1.12, .99, .94], workingPoint: [0, .17, .032], forward: [0, 0, 1], gripRotation: reverseGrip, restRotation: upright, restHeight: .1125, footprint: [.11, .065], illuminates: true },
];
export const SENSORY_TOOLS: readonly ConsultationToolDefinition[] = [
  { id: "worth", label: "Worth four-dot target", home: [1.04, .935, .88], workingPoint: [0, .12, -.012], forward: [0, 0, -1], gripRotation: upright, restRotation: upright, restHeight: .055, footprint: [.15, .09], illuminates: true, powerMode: "persistent" },
  { id: "red-green", label: "Red OD / green OS glasses", home: [1.04, .93, 1.18], workingPoint: [0, 0, 0], forward: [0, 0, -1], gripRotation: upright, restRotation: upright, restHeight: .05, footprint: [.25, .18], illuminates: false },
  { id: "polarised", label: "Polarised glasses", home: [1.48, .93, 1.18], workingPoint: [0, 0, 0], forward: [0, 0, -1], gripRotation: upright, restRotation: upright, restHeight: .05, footprint: [.25, .18], illuminates: false },
  { id: "stereo", label: "Circle stereo booklet", home: [1.52, .91, .88], workingPoint: [0, .08, -.006], forward: [0, 0, -1], gripRotation: upright, restRotation: upright, restHeight: .03, footprint: [.24, .09], illuminates: false },
];
const exerciseTool = { workingPoint: [0, .10, 0] as ToolPoint, forward: [0, 0, -1] as ToolPoint, gripRotation: upright, restRotation: upright, restHeight: .07, footprint: [.16, .10] as const, illuminates: false };
export const EXERCISE_TOOLS: readonly ConsultationToolDefinition[] = [
  { ...exerciseTool, id: "maddox", label: "Maddox rod", home: [1.04, .95, 1.48] },
  { ...exerciseTool, id: "thorington", label: "Thorington card", home: [1.52, .95, 1.48], footprint: [.25, .10] },
  { ...exerciseTool, id: "trial-lens", label: "Trial lens pair", home: [1.04, .95, 1.76], footprint: [.24, .10] },
  { ...exerciseTool, id: "lens-flipper", label: "±2 D lens flipper", home: [1.52, .95, 1.76], footprint: [.24, .10] },
  { ...exerciseTool, id: "prism-flipper", label: "12 BO / 3 BI flipper", home: [1.04, .95, 2.04], footprint: [.24, .10] },
  { ...exerciseTool, id: "fixation", label: "Accommodative fixation target", home: [1.52, .95, 2.04], footprint: [.12, .10] },
];
export const ALL_CLINIC_TOOLS = [...CONSULTATION_TOOLS, ...SENSORY_TOOLS, ...EXERCISE_TOOLS];
export const CONSULTATION_EQUIPMENT: readonly ConsultationToolId[] = CONSULTATION_TOOLS.map(tool => tool.id);
export const consultationToolDefinition = (id: ConsultationToolId) => {
  const definition = ALL_CLINIC_TOOLS.find(tool => tool.id === id);
  if (!definition) throw new Error(`Unknown clinic instrument: ${id}`);
  return definition;
};
export const TOOL_PICKUP_RADIUS = .12;
export const TOOL_SOCKET_RADIUS = .10;
export type ConsultationPickupHint = { id: ConsultationToolId; distance: number; reachable: boolean };
/** Pickup and its visible feedback use the same handle distance and eligibility. */
export function consultationPickupHint(
  handPosition: ToolPoint,
  handles: readonly { id: ConsultationToolId; position: ToolPoint; visible: boolean }[],
): ConsultationPickupHint | null {
  let nearest: ConsultationPickupHint | null = null;
  for (const handle of handles) {
    if (!handle.visible) continue;
    const gap = distance(handPosition, handle.position);
    if (!nearest || gap < nearest.distance) nearest = { id: handle.id, distance: gap, reachable: gap <= TOOL_PICKUP_RADIUS };
  }
  return nearest;
}
export function consultationPickupLabel(hint: ConsultationPickupHint | null) {
  if (!hint) return "BRING HAND TO A TOOL";
  const label = consultationToolDefinition(hint.id).label;
  return hint.reachable ? `GRIP · ${label}` : `${label} · ${Math.ceil(hint.distance * 100)} CM · MOVE CLOSER`;
}
export type PlacementSocket = { id: string; tool: ConsultationToolId; position: ToolPoint; rotation: ToolRotation; radius: number;
  /** Optional full-pose tolerance; authored generic sockets retain their existing positional snap. */
  orientationToleranceRad?: number;
  fittingLayer?: "correction" | "filters" | "occlusion";
};
export type PlacementSurface = { id: string; x: number; z: number; y: number; width: number; depth: number };
export const EXERCISE_SURFACE: PlacementSurface = { id: "library-tray", x: 1.31, z: 1.75, y: .88, width: .92, depth: .76 };
export const CONSULTATION_SURFACES: readonly PlacementSurface[] = [
  { id: "trolley", x: -1.37, z: .75, y: .8775, width: .84, depth: .55 },
  // The front of the refraction desk is clear of the lens kit and drawers.
  { id: "refraction", x: -1.45, z: -.96, y: .88, width: .85, depth: .28 },
];
const distance = (a: ToolPoint, b: ToolPoint) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export function initialConsultationTools(): ConsultationTools {
  return Object.fromEntries(ALL_CLINIC_TOOLS.map(tool => {
    const rest: RestingTool = { kind: "socket", position: tool.home, rotation: tool.restRotation };
    return [tool.id, { placement: rest, lastRest: rest, powered: false, revision: 0 }];
  })) as ConsultationTools;
}
export function toolInHand(state: ConsultationTools, hand: ConsultationHand): ConsultationToolId | null {
  return ALL_CLINIC_TOOLS.find(({ id }) => {
    const placement = state[id].placement;
    return placement.kind === "held" && placement.hand === hand;
  })?.id ?? null;
}
/** Synchronous transitions are the ownership boundary, including transfer races. */
export function grabConsultationTool(state: ConsultationTools, id: ConsultationToolId, hand: ConsultationHand): ConsultationTools {
  if (toolInHand(state, hand)) return state;
  return { ...state, [id]: { ...state[id], placement: { kind: "held", hand }, revision: (state[id].revision ?? 0) + 1, powered: consultationToolDefinition(id).powerMode === "persistent" ? state[id].powered : false } };
}
export function powerConsultationTool(state: ConsultationTools, hand: ConsultationHand, powered: boolean): ConsultationTools {
  const id = toolInHand(state, hand);
  if (!id || (!consultationToolDefinition(id).illuminates || consultationToolDefinition(id).powerMode === "persistent") || state[id].powered === powered) return state;
  return { ...state, [id]: { ...state[id], powered } };
}
/** Explicit equipment switch; unlike trigger power it can remain on while placed. */
export function setConsultationToolPower(state: ConsultationTools, id: ConsultationToolId, powered: boolean): ConsultationTools {
  if (!consultationToolDefinition(id).illuminates || state[id].powered === powered) return state;
  return { ...state, [id]: { ...state[id], powered } };
}
export function socketOrientationMatches(rotation: ToolRotation, socket: PlacementSocket) {
  if (socket.orientationToleranceRad === undefined) return true;
  const aLength = Math.hypot(...rotation), bLength = Math.hypot(...socket.rotation);
  if (!aLength || !bLength) return false;
  const dot = Math.abs(rotation.reduce((sum, value, i) => sum + value * socket.rotation[i], 0) / (aLength * bLength));
  return 2 * Math.acos(Math.min(1, dot)) <= socket.orientationToleranceRad;
}
function footprint(tool: ConsultationToolDefinition, rotation: ToolRotation): readonly [number, number] {
  // Resting rotation is only yaw * canonical resting pose. Extract yaw relative to that pose.
  const [x, y, z, w] = rotation;
  const [rx, ry, rz, rw] = tool.restRotation;
  const relativeY = -w * ry + y * rw - z * rx + x * rz;
  const relativeW = w * rw + x * rx + y * ry + z * rz;
  const yaw = 2 * Math.atan2(relativeY, relativeW);
  const c = Math.abs(Math.cos(yaw)), s = Math.abs(Math.sin(yaw));
  return [tool.footprint[0] * c + tool.footprint[1] * s, tool.footprint[0] * s + tool.footprint[1] * c];
}
function overlapsResting(state: ConsultationTools, id: ConsultationToolId, rest: RestingTool, reserveHomes = false, equipment: readonly ConsultationToolId[] = ALL_CLINIC_TOOLS.map(tool => tool.id)) {
  const [width, depth] = footprint(consultationToolDefinition(id), rest.rotation);
  return ALL_CLINIC_TOOLS.some(tool => {
    if (tool.id === id || !equipment.includes(tool.id)) return false;
    // Only authored patient correction/filter layers may coexist at the face.
    const otherRest = state[tool.id].placement;
    if (rest.fittingLayer && otherRest.kind === "socket" && otherRest.fittingLayer && rest.fittingLayer !== otherRest.fittingLayer) return false;
    const other = state[tool.id].placement;
    const candidates: RestingTool[] = other.kind === "held" ? [] : [other];
    if (reserveHomes) candidates.push({ kind: "socket", position: tool.home, rotation: tool.restRotation });
    return candidates.some(other => {
      if (Math.abs(other.position[1] - rest.position[1]) > .3) return false;
      const [ow, od] = footprint(tool, other.rotation);
      return Math.abs(other.position[0] - rest.position[0]) < (width + ow) / 2 + .01
        && Math.abs(other.position[2] - rest.position[2]) < (depth + od) / 2 + .01;
    });
  });
}
export function releaseConsultationTool(
  state: ConsultationTools, hand: ConsultationHand, pose?: { position: ToolPoint; rotation: ToolRotation },
  surfaces: readonly PlacementSurface[] = CONSULTATION_SURFACES,
  sockets: readonly PlacementSocket[] = [],
  equipment: readonly ConsultationToolId[] = ALL_CLINIC_TOOLS.map(tool => tool.id),
): { state: ConsultationTools; returned: boolean; id: ConsultationToolId | null } {
  const id = toolInHand(state, hand);
  if (!id) return { state, returned: false, id: null };
  const definition = consultationToolDefinition(id);
  let rest: RestingTool | null = null;
  if (pose) {
    const socket = sockets.find(candidate => candidate.tool === id && distance(pose.position, candidate.position) <= candidate.radius && socketOrientationMatches(pose.rotation, candidate));
    if (socket) {
      const candidate: RestingTool = { kind: "socket", position: socket.position, rotation: socket.rotation, socketId: socket.id, ...(socket.fittingLayer ? { fittingLayer: socket.fittingLayer } : {}) };
      if (!overlapsResting(state, id, candidate, false, equipment)) rest = candidate;
    }
  }
  if (!rest && pose && distance(pose.position, definition.home) <= TOOL_SOCKET_RADIUS) {
    const home: RestingTool = { kind: "socket", position: definition.home, rotation: definition.restRotation };
    if (!overlapsResting(state, id, home, false, equipment)) rest = home;
  }
  if (!rest && pose) {
    const [x, y, z, w] = pose.rotation;
    // Heading from the controller's forward direction, independent of grip pitch.
    const yaw = Math.atan2(-2 * (x * z - w * y), 1 - 2 * (y * y + z * z));
    const s = Math.sin(yaw / 2), c = Math.cos(yaw / 2);
    const [rx, ry, rz, rw] = definition.restRotation;
    const rotation: ToolRotation = [c * rx + s * rz, c * ry + s * rw, c * rz - s * rx, c * rw - s * ry];
    const [width, depth] = footprint(definition, rotation);
    for (const surface of surfaces) {
      const [px, py, pz] = pose.position;
      if (py < surface.y || py > surface.y + definition.restHeight + .18) continue;
      if (Math.abs(px - surface.x) + width / 2 > surface.width / 2 - .01 || Math.abs(pz - surface.z) + depth / 2 > surface.depth / 2 - .01) continue;
      const candidate: RestingTool = { kind: "surface", position: [px, surface.y + definition.restHeight, pz], rotation };
      if (!overlapsResting(state, id, candidate, true, equipment)) { rest = candidate; break; }
    }
  }
  const returned = !rest;
  // Invalid fitting/dock release must not earn readiness by silently returning to that lesson socket.
  rest ??= state[id].lastRest.socketId
    ? { kind: "socket", position: definition.home, rotation: definition.restRotation }
    : state[id].lastRest;
  // Someone may have placed another object at the old resting point while this tool was held.
  if (overlapsResting(state, id, rest, false, equipment)) rest = { kind: "socket", position: definition.home, rotation: definition.restRotation };
  // Reserve home footprints during placement, so a fallback always has a free home.
  return { state: { ...state, [id]: { placement: rest, lastRest: rest, revision: (state[id].revision ?? 0) + 1, powered: definition.powerMode === "persistent" ? state[id].powered : false } }, returned, id };
}
export function returnConsultationHand(state: ConsultationTools, hand: ConsultationHand): ConsultationTools {
  return releaseConsultationTool(state, hand).state;
}
export function resetConsultationHands(state: ConsultationTools): ConsultationTools {
  const returned = returnConsultationHand(returnConsultationHand(state, "left"), "right");
  return Object.fromEntries(ALL_CLINIC_TOOLS.map(({ id }) => [id, { ...returned[id], powered: false }])) as ConsultationTools;
}
export function consultationToolReady(state: ConsultationTools, id: ConsultationToolId, hands: Record<ConsultationHand, { tracked: boolean; panel: boolean }>) {
  const placement = state[id].placement;
  return placement.kind === "held" && hands[placement.hand].tracked && !hands[placement.hand].panel;
}
