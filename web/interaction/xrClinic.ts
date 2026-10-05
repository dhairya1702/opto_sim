/** Pure, renderer-independent state for the shared XR clinic. World units are metres. */
export type XRClinicVector3 = readonly [number, number, number];
export type XRClinicQuaternion = readonly [number, number, number, number];

export type XRClinicStationId =
  | "entrance"
  | "instrument-bay"
  | "patient-chair"
  | "recording-desk";

export type XRClinicHand = "left" | "right";

export type XRClinicToolId =
  | "penlight"
  | "occluder"
  | "prism-bar"
  | "maddox-rod"
  | "near-target"
  | "lens-flipper"
  | "stereo-booklet"
  | "red-green-goggles";

export type XRClinicToolAction =
  | "illuminate"
  | "occlude"
  | "present-prism"
  | "present-filter"
  | "present-target"
  | "flip-lens"
  | "present-stereo-target"
  | "wear-filter";

export type XRClinicProcedureAction =
  | "select-tool"
  | "position-at-patient"
  | "give-fixation-instruction"
  | "establish-distance"
  | "align-instrument"
  | "align-view"
  | "observe"
  | "record"
  | "return-tool";

export type XRClinicStationDefinition = {
  id: XRClinicStationId;
  label: string;
  /** Work centre used for tool sockets and proximity checks. */
  position: XRClinicVector3;
  /** Safe learner origin near the work centre. */
  arrivalPosition: XRClinicVector3;
  /** Direction, in degrees around the vertical axis, that faces the work area. */
  facingDegrees: number;
  workRadiusM: number;
};

export type XRClinicToolDefinition = {
  id: XRClinicToolId;
  label: string;
  homeStationId: XRClinicStationId;
  /** Local offset from the home station, converted to world space by `toolHomePosition`. */
  homeOffset: XRClinicVector3;
  gripOffset: XRClinicVector3;
  actions: readonly XRClinicToolAction[];
};

export type XRClinicProcedureConfig = {
  id: string;
  label: string;
  stationId: XRClinicStationId;
  requiredToolIds: readonly XRClinicToolId[];
  permittedToolIds?: readonly XRClinicToolId[];
  requiredActions: readonly XRClinicProcedureAction[];
  toolReachRadiusM?: number;
};

export type XRClinicToolPlacement =
  | { kind: "socket"; stationId: XRClinicStationId }
  | { kind: "held"; hand: XRClinicHand }
  | { kind: "world"; position: XRClinicVector3; rotation?: XRClinicQuaternion };

export type XRClinicState = {
  stationId: XRClinicStationId;
  tools: Record<XRClinicToolId, XRClinicToolPlacement>;
};

export type XRClinicTransitionReason =
  | "hand-occupied"
  | "tool-already-held"
  | "hand-empty"
  | "wrong-return-station";

export type XRClinicTransition = {
  state: XRClinicState;
  changed: boolean;
  reason?: XRClinicTransitionReason;
};

export type XRClinicProcedureReadiness = {
  ready: boolean;
  atRequiredStation: boolean;
  missingToolIds: XRClinicToolId[];
  missingActions: XRClinicProcedureAction[];
};

export const XR_CLINIC_STATIONS: Readonly<Record<XRClinicStationId, XRClinicStationDefinition>> = {
  entrance: { id: "entrance", label: "Clinic entrance", position: [0, 0, 1.9], arrivalPosition: [0, 0, 1.9], facingDegrees: 180, workRadiusM: .8 },
  "instrument-bay": { id: "instrument-bay", label: "Instrument bay", position: [-1.3, 0, .85], arrivalPosition: [-1, 0, 1.5], facingDegrees: 90, workRadiusM: .85 },
  "patient-chair": { id: "patient-chair", label: "Patient station", position: [0, 0, -.75], arrivalPosition: [0, 0, .2], facingDegrees: 180, workRadiusM: 1.1 },
  "recording-desk": { id: "recording-desk", label: "Recording desk", position: [1.45, 0, .8], arrivalPosition: [.85, 0, 1.35], facingDegrees: -90, workRadiusM: .85 },
};

export const XR_CLINIC_TOOLS: Readonly<Record<XRClinicToolId, XRClinicToolDefinition>> = {
  penlight: { id: "penlight", label: "Penlight", homeStationId: "instrument-bay", homeOffset: [-.46, 1.04, -.22], gripOffset: [0, 0, -.07], actions: ["illuminate"] },
  occluder: { id: "occluder", label: "Occluder", homeStationId: "instrument-bay", homeOffset: [0, 1.04, -.22], gripOffset: [0, -.11, 0], actions: ["occlude"] },
  "prism-bar": { id: "prism-bar", label: "Prism bar", homeStationId: "instrument-bay", homeOffset: [.46, 1.04, -.22], gripOffset: [0, -.08, 0], actions: ["present-prism"] },
  "maddox-rod": { id: "maddox-rod", label: "Maddox rod", homeStationId: "instrument-bay", homeOffset: [-.46, 1.04, .22], gripOffset: [0, -.08, 0], actions: ["present-filter"] },
  "near-target": { id: "near-target", label: "Near fixation target", homeStationId: "instrument-bay", homeOffset: [0, 1.04, .22], gripOffset: [0, -.09, 0], actions: ["present-target"] },
  "lens-flipper": { id: "lens-flipper", label: "Lens flipper", homeStationId: "instrument-bay", homeOffset: [.46, 1.04, .22], gripOffset: [0, -.09, 0], actions: ["flip-lens"] },
  "stereo-booklet": { id: "stereo-booklet", label: "Stereo booklet", homeStationId: "instrument-bay", homeOffset: [-.18, 1.08, .3], gripOffset: [0, 0, 0], actions: ["present-stereo-target"] },
  "red-green-goggles": { id: "red-green-goggles", label: "Red-green goggles", homeStationId: "instrument-bay", homeOffset: [.18, 1.08, .3], gripOffset: [0, 0, 0], actions: ["wear-filter"] },
};

function add(a: XRClinicVector3, b: XRClinicVector3): XRClinicVector3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function clinicDistance(a: XRClinicVector3, b: XRClinicVector3) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export function stationWorldPosition(id: XRClinicStationId, clinicOrigin: XRClinicVector3 = [0, 0, 0]) {
  return add(clinicOrigin, XR_CLINIC_STATIONS[id].position);
}

export function stationArrivalPosition(id: XRClinicStationId, clinicOrigin: XRClinicVector3 = [0, 0, 0]) {
  return add(clinicOrigin, XR_CLINIC_STATIONS[id].arrivalPosition);
}

export function worldFromStationOffset(
  stationId: XRClinicStationId,
  offset: XRClinicVector3,
  clinicOrigin: XRClinicVector3 = [0, 0, 0],
) {
  return add(stationWorldPosition(stationId, clinicOrigin), offset);
}

export function toolHomePosition(id: XRClinicToolId, clinicOrigin: XRClinicVector3 = [0, 0, 0]) {
  const tool = XR_CLINIC_TOOLS[id];
  return worldFromStationOffset(tool.homeStationId, tool.homeOffset, clinicOrigin);
}

export function createXRClinicState(stationId: XRClinicStationId = "entrance"): XRClinicState {
  return {
    stationId,
    tools: Object.fromEntries(
      (Object.keys(XR_CLINIC_TOOLS) as XRClinicToolId[]).map((id) => [id, {
        kind: "socket" as const,
        stationId: XR_CLINIC_TOOLS[id].homeStationId,
      }]),
    ) as Record<XRClinicToolId, XRClinicToolPlacement>,
  };
}

export function toolHeldInHand(state: XRClinicState, hand: XRClinicHand) {
  return (Object.keys(state.tools) as XRClinicToolId[]).find((id) => {
    const placement = state.tools[id];
    return placement.kind === "held" && placement.hand === hand;
  }) ?? null;
}

export function pickupTool(state: XRClinicState, toolId: XRClinicToolId, hand: XRClinicHand): XRClinicTransition {
  if (toolHeldInHand(state, hand)) return { state, changed: false, reason: "hand-occupied" };
  if (state.tools[toolId].kind === "held") return { state, changed: false, reason: "tool-already-held" };
  return {
    state: { ...state, tools: { ...state.tools, [toolId]: { kind: "held", hand } } },
    changed: true,
  };
}

export function dropHeldTool(state: XRClinicState, hand: XRClinicHand, position: XRClinicVector3, rotation?: XRClinicQuaternion): XRClinicTransition {
  const toolId = toolHeldInHand(state, hand);
  if (!toolId) return { state, changed: false, reason: "hand-empty" };
  return {
    state: { ...state, tools: { ...state.tools, [toolId]: { kind: "world", position: [...position], ...(rotation ? { rotation: [...rotation] as XRClinicQuaternion } : {}) } } },
    changed: true,
  };
}

export function returnHeldTool(
  state: XRClinicState,
  hand: XRClinicHand,
  stationId: XRClinicStationId,
): XRClinicTransition {
  const toolId = toolHeldInHand(state, hand);
  if (!toolId) return { state, changed: false, reason: "hand-empty" };
  const homeStationId = XR_CLINIC_TOOLS[toolId].homeStationId;
  if (stationId !== homeStationId) return { state, changed: false, reason: "wrong-return-station" };
  return {
    state: { ...state, tools: { ...state.tools, [toolId]: { kind: "socket", stationId: homeStationId } } },
    changed: true,
  };
}

export function moveToStation(state: XRClinicState, stationId: XRClinicStationId): XRClinicState {
  return state.stationId === stationId ? state : { ...state, stationId };
}

export function toolWorldPosition(
  state: XRClinicState,
  toolId: XRClinicToolId,
  clinicOrigin: XRClinicVector3 = [0, 0, 0],
): XRClinicVector3 | null {
  const placement = state.tools[toolId];
  if (placement.kind === "held") return null;
  if (placement.kind === "world") return placement.position;
  return worldFromStationOffset(placement.stationId, XR_CLINIC_TOOLS[toolId].homeOffset, clinicOrigin);
}

/** Returns the closest reachable loose/socketed tool. Equal distances follow registry order. */
export function nearestToolId(
  state: XRClinicState,
  position: XRClinicVector3,
  maxDistanceM: number,
  clinicOrigin: XRClinicVector3 = [0, 0, 0],
): XRClinicToolId | null {
  let nearest: XRClinicToolId | null = null;
  let nearestDistance = Math.max(0, maxDistanceM);
  for (const id of Object.keys(XR_CLINIC_TOOLS) as XRClinicToolId[]) {
    const toolPosition = toolWorldPosition(state, id, clinicOrigin);
    if (!toolPosition) continue;
    const distance = clinicDistance(position, toolPosition);
    if (distance <= nearestDistance) {
      if (distance < nearestDistance || nearest === null) nearest = id;
      nearestDistance = Math.min(nearestDistance, distance);
    }
  }
  return nearest;
}

export function toolCompatibleWithProcedure(toolId: XRClinicToolId, procedure: XRClinicProcedureConfig) {
  const permitted = procedure.permittedToolIds ?? procedure.requiredToolIds;
  return permitted.includes(toolId);
}

function toolAvailableAtProcedureStation(
  state: XRClinicState,
  toolId: XRClinicToolId,
  procedure: XRClinicProcedureConfig,
  clinicOrigin: XRClinicVector3,
) {
  const placement = state.tools[toolId];
  if (placement.kind === "held") return true;
  const position = toolWorldPosition(state, toolId, clinicOrigin);
  if (!position) return false;
  const radius = procedure.toolReachRadiusM ?? XR_CLINIC_STATIONS[procedure.stationId].workRadiusM;
  return clinicDistance(position, stationWorldPosition(procedure.stationId, clinicOrigin)) <= radius;
}

export function clinicProcedureReadiness(
  procedure: XRClinicProcedureConfig,
  state: XRClinicState,
  completedActions: readonly XRClinicProcedureAction[],
  clinicOrigin: XRClinicVector3 = [0, 0, 0],
): XRClinicProcedureReadiness {
  const atRequiredStation = state.stationId === procedure.stationId;
  const missingToolIds = procedure.requiredToolIds.filter(
    (id) => !toolAvailableAtProcedureStation(state, id, procedure, clinicOrigin),
  );
  const missingActions = procedure.requiredActions.filter((action) => !completedActions.includes(action));
  return {
    ready: atRequiredStation && missingToolIds.length === 0 && missingActions.length === 0,
    atRequiredStation,
    missingToolIds,
    missingActions,
  };
}
