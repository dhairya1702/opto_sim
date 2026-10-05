import type { XRClinicHand, XRClinicQuaternion, XRClinicVector3 } from "./xrClinic";

export type ConsultationHand = XRClinicHand;
export type ToolPoint = XRClinicVector3;
export type ToolRotation = XRClinicQuaternion;
export type ConsultationToolId = "distance" | "pinhole" | "cover" | "pupils" | "motility" | "objective" | "near" | "subjective" | "fundus" | "prism";
export type RestingTool = { kind: "socket" | "surface"; position: ToolPoint; rotation: ToolRotation };
export type ConsultationTool = {
  placement: RestingTool | { kind: "held"; hand: ConsultationHand };
  lastRest: RestingTool;
  powered: boolean;
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
export const consultationToolDefinition = (id: ConsultationToolId) => CONSULTATION_TOOLS.find(tool => tool.id === id)!;
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
export type PlacementSocket = { id: string; tool: ConsultationToolId; position: ToolPoint; rotation: ToolRotation; radius: number };
export type PlacementSurface = { id: string; x: number; z: number; y: number; width: number; depth: number };
export const CONSULTATION_SURFACES: readonly PlacementSurface[] = [
  { id: "trolley", x: -1.37, z: .75, y: .8775, width: .84, depth: .55 },
  // The front of the refraction desk is clear of the lens kit and drawers.
  { id: "refraction", x: -1.45, z: -.96, y: .88, width: .85, depth: .28 },
];
const distance = (a: ToolPoint, b: ToolPoint) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export function initialConsultationTools(): ConsultationTools {
  return Object.fromEntries(CONSULTATION_TOOLS.map(tool => {
    const rest: RestingTool = { kind: "socket", position: tool.home, rotation: tool.restRotation };
    return [tool.id, { placement: rest, lastRest: rest, powered: false }];
  })) as ConsultationTools;
}
export function toolInHand(state: ConsultationTools, hand: ConsultationHand): ConsultationToolId | null {
  return CONSULTATION_TOOLS.find(({ id }) => {
    const placement = state[id].placement;
    return placement.kind === "held" && placement.hand === hand;
  })?.id ?? null;
}
/** Synchronous transitions are the ownership boundary, including transfer races. */
export function grabConsultationTool(state: ConsultationTools, id: ConsultationToolId, hand: ConsultationHand): ConsultationTools {
  if (toolInHand(state, hand)) return state;
  return { ...state, [id]: { ...state[id], placement: { kind: "held", hand }, powered: false } };
}
export function powerConsultationTool(state: ConsultationTools, hand: ConsultationHand, powered: boolean): ConsultationTools {
  const id = toolInHand(state, hand);
  if (!id || !consultationToolDefinition(id).illuminates || state[id].powered === powered) return state;
  return { ...state, [id]: { ...state[id], powered } };
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
function overlapsResting(state: ConsultationTools, id: ConsultationToolId, rest: RestingTool, reserveHomes = false) {
  const [width, depth] = footprint(consultationToolDefinition(id), rest.rotation);
  return CONSULTATION_TOOLS.some(tool => {
    if (tool.id === id) return false;
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
): { state: ConsultationTools; returned: boolean; id: ConsultationToolId | null } {
  const id = toolInHand(state, hand);
  if (!id) return { state, returned: false, id: null };
  const definition = consultationToolDefinition(id);
  let rest: RestingTool | null = null;
  if (pose) {
    const socket = sockets.find(candidate => candidate.tool === id && distance(pose.position, candidate.position) <= candidate.radius);
    if (socket) {
      const candidate: RestingTool = { kind: "socket", position: socket.position, rotation: socket.rotation };
      if (!overlapsResting(state, id, candidate)) rest = candidate;
    }
  }
  if (!rest && pose && distance(pose.position, definition.home) <= TOOL_SOCKET_RADIUS) {
    const home: RestingTool = { kind: "socket", position: definition.home, rotation: definition.restRotation };
    if (!overlapsResting(state, id, home)) rest = home;
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
      if (!overlapsResting(state, id, candidate, true)) { rest = candidate; break; }
    }
  }
  const returned = !rest;
  rest ??= state[id].lastRest;
  // Someone may have placed another object at the old resting point while this tool was held.
  if (overlapsResting(state, id, rest)) rest = { kind: "socket", position: definition.home, rotation: definition.restRotation };
  // Reserve home footprints during placement, so a fallback always has a free home.
  return { state: { ...state, [id]: { placement: rest, lastRest: rest, powered: false } }, returned, id };
}
export function returnConsultationHand(state: ConsultationTools, hand: ConsultationHand): ConsultationTools {
  return releaseConsultationTool(state, hand).state;
}
export function resetConsultationHands(state: ConsultationTools): ConsultationTools {
  return returnConsultationHand(returnConsultationHand(state, "left"), "right");
}
export function consultationToolReady(state: ConsultationTools, id: ConsultationToolId, hands: Record<ConsultationHand, { tracked: boolean; panel: boolean }>) {
  const placement = state[id].placement;
  return placement.kind === "held" && hands[placement.hand].tracked && !hands[placement.hand].panel;
}
