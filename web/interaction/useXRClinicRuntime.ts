import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Matrix4, Object3D, Quaternion, Ray, Raycaster, Vector3 } from "three";
import type { StationId } from "../domain/types";
import {
  initialConsultationInput, interruptConsultationInput, pressConsultationGrip,
  pressConsultationTrigger, releaseConsultationGrip, releaseConsultationTrigger,
  toggleConsultationPanel, type ConsultationInputState,
} from "./xrConsultationInput";
import {
  CONSULTATION_EQUIPMENT, CONSULTATION_SURFACES, consultationPickupHint, consultationPickupLabel, consultationToolDefinition, consultationToolReady,
  grabConsultationTool, initialConsultationTools, powerConsultationTool, releaseConsultationTool,
  resetConsultationHands, setConsultationToolPower, toolInHand, type ConsultationPickupHint, type ConsultationToolId, type ConsultationTools, type PlacementSocket, type PlacementSurface,
} from "./xrConsultationTools";
import { SENSORY_SURFACES, type SensoryWorkingPose } from "./xrSensoryEquipment";
import { nextScopeAperture, SCOPE_SELECTOR_REACH_M, type ScopeAperture } from "./xrScopeEquipment";
import { perfCount, perfEvent, perfRender } from "../perf/perfFlag";
import {
  clearDesktopClinicTransient, desktopClinicAdjustmentStep, desktopClinicShortcut,
  desktopAccommodationHeldPose, desktopAssistedSocketId, initialDesktopClinicInput, isEditableClinicTarget, setDesktopClinicActivation,
  switchDesktopClinicHand, type DesktopClinicAim,
} from "./desktopClinicInput";
export type XRClinicHand = "left" | "right";
type Hand = XRClinicHand;
export type ClinicInputMode = "xr" | "desktop";
export type DesktopClinicPose = Readonly<{
  position: readonly [number, number, number];
  rotation: readonly [number, number, number, number];
}>;
export type XRClinicControllerSlot = ConsultationInputState & {
  hand: Hand | null; source: XRInputSource | null; ray: Group; grip: Group;
  tracked: boolean; buttonDown: boolean; scopeButtonDown: boolean; candidate: ConsultationToolId | null;
  thumbstickY: -1 | 0 | 1;
  pendingSelection: { data: XRClinicSelection; point: Vector3 | null } | null;
};
type ControllerSlot = XRClinicControllerSlot;
function ancestorData(object: Object3D | null) {
  let station: StationId | undefined;
  let examId: string | undefined;
  let teleport: [number, number, number] | undefined;
  let action: (() => boolean | void) | undefined;
  let instrumentControl: ConsultationToolId | undefined;
  let consultationToolId: ConsultationToolId | undefined;
  let priorityPanel = false;
  while (object) {
    station ??= object.userData.station as StationId | undefined;
    examId ??= object.userData.examId as string | undefined;
    teleport ??= object.userData.xrTeleport as [number, number, number] | undefined;
    action ??= object.userData.xrAction as (() => void) | undefined;
    instrumentControl ??= object.userData.xrInstrumentControl as ConsultationToolId | undefined;
    consultationToolId ??= object.userData.consultationToolId as ConsultationToolId | undefined;
    priorityPanel ||= Boolean(object.userData.xrPriorityPanel);
    object = object.parent;
  }
  return { station, examId, teleport, action, instrumentControl, consultationToolId, priorityPanel };
}


export type XRClinicSelection = ReturnType<typeof ancestorData>;
export type XRClinicInterruption = "procedure" | "configuration" | "panel" | "scope-view" | "tracking" | "visibility" | "pickup" | "transfer" | "release" | "reset" | "exit";
type Options = {
  active: boolean;
  inputMode?: ClinicInputMode;
  editorOpen?: boolean;
  panelModeEnabled?: boolean;
  scopeViewEnabled?: boolean;
  equipment?: readonly ConsultationToolId[];
  equipmentLabels?: Partial<Record<ConsultationToolId, string>>;
  placementSurfaces?: readonly PlacementSurface[];
  placementSockets?: readonly PlacementSocket[];
  onInterrupt?: (reason: XRClinicInterruption) => void;
  onToolUsed?: (id: ConsultationToolId, action: "pickup" | "activate") => void;
  onThumbstickStep?: (id: ConsultationToolId, step: -1 | 1, hand: XRClinicHand, axis: "horizontal" | "vertical") => boolean | void;
  onMenu?: (open: boolean) => void;
  onSelection?: (selection: XRClinicSelection) => void;
  desktopHeldPose?: (id: ConsultationToolId) => DesktopClinicPose | null;
};
/** Shared physical clinic loop. It knows no case findings, lesson answers, or scoring. */
export function useXRClinicRuntime(options: Options) {
  // Counts renders of whichever lesson/consultation controller hosts the runtime.
  perfRender("XRRuntimeHost");
  const { active, inputMode = "xr", editorOpen = false, equipment = CONSULTATION_EQUIPMENT } = options;
  const { gl, scene } = useThree();
  const optionsRef = useRef(options); optionsRef.current = options;
  const toolLabel = useCallback((id: ConsultationToolId) => optionsRef.current.equipmentLabels?.[id] ?? consultationToolDefinition(id).label, []);
  const toolControls = useRef(new Map<ConsultationToolId, Group>());
  const findingsPanels = useRef(new Set<Group>());
  const slots = useMemo<ControllerSlot[]>(() => [0, 1].map(index => ({
    ...initialConsultationInput(), hand: null, source: null, tracked: false,
    ray: inputMode === "xr" ? gl.xr.getController(index) : new Group(),
    grip: inputMode === "xr" ? gl.xr.getControllerGrip(index) : new Group(),
    buttonDown: false, scopeButtonDown: false, thumbstickY: 0, candidate: null, pendingSelection: null,
  })), [gl, inputMode]);
  if (inputMode === "desktop") {
    slots[0].hand = "left"; slots[1].hand = "right";
  }
  const [, refresh] = useState(0);
  const [tools, setTools] = useState(initialConsultationTools);
  const toolsRef = useRef(tools);
  const pulseHand = useCallback((hand: Hand, intensity = .25, duration = 35) => {
    const gamepad = slots.find(slot => slot.hand === hand)?.source?.gamepad as (Gamepad & {
      hapticActuators?: { pulse: (strength: number, milliseconds: number) => Promise<boolean> }[];
      vibrationActuator?: { playEffect: (type: "dual-rumble", parameters: { duration: number; strongMagnitude: number; weakMagnitude: number }) => Promise<string> };
    }) | undefined;
    if (gamepad?.hapticActuators?.[0]) { void gamepad.hapticActuators[0].pulse(intensity, duration); return true; }
    if (gamepad?.vibrationActuator) { void gamepad.vibrationActuator.playEffect("dual-rumble", { duration, strongMagnitude: intensity, weakMagnitude: intensity }); return true; }
    return false;
  }, [slots]);
  const objects = useRef(new Map<ConsultationToolId, Group>());
  const raycastTargets = useRef(new Set<Object3D>());
  const discoveredRaycastTargets = useRef(new Set<Object3D>());
  const priorityRaycastTargets = useRef(new Set<Object3D>());
  const registerRaycastTarget = useCallback((object: Object3D, priority = false) => {
    raycastTargets.current.add(object);
    if (priority) priorityRaycastTargets.current.add(object);
    return () => { raycastTargets.current.delete(object); priorityRaycastTargets.current.delete(object); };
  }, []);
  const placementMarkers = useRef(new Map<Hand, Group>());
  const hidePlacementMarkers = useCallback(() => {
    placementMarkers.current.forEach(marker => { marker.visible = false; });
  }, []);
  const registerTool = useCallback((id: ConsultationToolId, object: Group | null) => {
    const previous = objects.current.get(id);
    if (previous && previous !== object) raycastTargets.current.delete(previous);
    if (object) { objects.current.set(id, object); raycastTargets.current.add(object); }
    else objects.current.delete(id);
  }, []);
  const updateTools = useCallback((next: ConsultationTools) => {
    if (next === toolsRef.current) return;
    toolsRef.current = next;
    setTools(next);
  }, []);
  const [highlighted, setHighlighted] = useState<ConsultationToolId[]>([]);
  const [pickupHints, setPickupHints] = useState<Record<Hand, ConsultationPickupHint | null>>({ left: null, right: null });
  const [returnedAt, setReturnedAt] = useState<Partial<Record<ConsultationToolId, number>>>({});
  const [handlingMessage, setHandlingMessage] = useState("");
  const endedSession = useRef<XRSession | null>(null);
  const activeRef = useRef(active); activeRef.current = active && (inputMode === "desktop" || !(endedSession.current && (!gl.xr.getSession() || endedSession.current === gl.xr.getSession())));
  const pauseTechnique = useCallback((reason: XRClinicInterruption = "procedure") => optionsRef.current.onInterrupt?.(reason), []);
  const frameValid = useRef(false);
  const [scopeViewHand, setScopeViewHand] = useState<Hand | null>(null);
  const scopeViewHandRef = useRef<Hand | null>(null);
  const [utilityOpen, setUtilityOpen] = useState(false);
  const utilityOpenRef = useRef(false);
  const closeUtilityPanel = useCallback(() => {
    if (!utilityOpenRef.current) return;
    utilityOpenRef.current = false;
    setUtilityOpen(false);
  }, []);
  const closeScopeView = useCallback(() => {
    if (scopeViewHandRef.current === null) return;
    scopeViewHandRef.current = null; setScopeViewHand(null);
    pauseTechnique("scope-view");
  }, [pauseTechnique]);
  const toggleScopeView = useCallback((hand: Hand) => {
    const slot = slots.find(candidate => candidate.hand === hand);
    if (!activeRef.current || !frameValid.current || !optionsRef.current.scopeViewEnabled
      || optionsRef.current.editorOpen || !slot?.tracked || slots.some(candidate => candidate.panel)
      || toolInHand(toolsRef.current, hand) !== "fundus") return;
    if (scopeViewHandRef.current === hand) { closeScopeView(); return; }
    scopeViewHandRef.current = hand; setScopeViewHand(hand);
    pauseTechnique("scope-view");
  }, [closeScopeView, pauseTechnique, slots]);
  const [scopeAperture, setScopeAperture] = useState<ScopeAperture>("small");
  const scopeApertureRef = useRef(scopeAperture);
  const cycleScopeAperture = useCallback(() => {
    if (!activeRef.current || !frameValid.current) return;
    scopeApertureRef.current = nextScopeAperture(scopeApertureRef.current);
    setScopeAperture(scopeApertureRef.current);
    pauseTechnique("configuration");
  }, [pauseTechnique]);
  const visualTime = useRef(0);
  const desktopInput = useRef(initialDesktopClinicInput());
  const desktopToolRoll = useRef(0);
  const desktopPoseOverrides = useRef(new Map<ConsultationToolId, DesktopClinicPose>());
  const [desktopActiveHand, setDesktopActiveHand] = useState<Hand>(desktopInput.current.activeHand);
  const desktopAimRef = useRef<DesktopClinicAim>({ tool: null, action: "Aim at an instrument" });
  const [desktopAim, setDesktopAim] = useState<DesktopClinicAim>(desktopAimRef.current);
  const hoverMarker = useRef<Group>(null);
  const workingOrigin = useMemo(() => new Vector3(), []);
  const baseSpace = useRef<XRReferenceSpace | null>(null);
  const physicalViewer = useRef<{ x: number; z: number; yaw: number } | null>(null);
  const clinicYaw = useRef(0);
  const initialArrival = useRef(true);
  const raycaster = useMemo(() => new Raycaster(), []);
  const rayFrame = useRef(0);
  const rayHitCache = useRef(new Map<ControllerSlot, { frame: number; hit: RaycastHit | null }>());
  const origin = useMemo(() => new Vector3(), []);
  const direction = useMemo(() => new Vector3(0, 0, -1), []);
  const quaternion = useMemo(() => new Quaternion(), []);
  const samplePoint = useMemo(() => new Vector3(), []);
  const sampleForward = useMemo(() => new Vector3(), []);
  const sampleRotation = useMemo(() => new Quaternion(), []);
  // Both the guide and deliberate placement resolve the same current world pose.
  const resolvePlacement = useCallback((slot: ControllerSlot) => {
    const id = slot.hand ? toolInHand(toolsRef.current, slot.hand) : null;
    if (!slot.hand || !id) return null;
    const object = objects.current.get(id);
    object?.getWorldPosition(samplePoint);
    object?.getWorldQuaternion(sampleRotation);
    const equipment = optionsRef.current.equipment ?? CONSULTATION_EQUIPMENT;
    return releaseConsultationTool(toolsRef.current, slot.hand, object && slot.tracked ? {
      position: samplePoint.toArray() as [number, number, number],
      rotation: sampleRotation.toArray() as [number, number, number, number],
    } : undefined, optionsRef.current.placementSurfaces ?? (equipment.some(tool => ["worth", "red-green", "polarised", "stereo"].includes(tool))
      ? [...CONSULTATION_SURFACES, ...SENSORY_SURFACES] : CONSULTATION_SURFACES), optionsRef.current.placementSockets, equipment);
  }, [samplePoint, sampleRotation]);
  const setToolPower = useCallback((id: ConsultationToolId, powered: boolean) => {
    if (!activeRef.current || !(optionsRef.current.equipment ?? CONSULTATION_EQUIPMENT).includes(id)) return;
    updateTools(setConsultationToolPower(toolsRef.current, id, powered));
  }, [updateTools]);
  const extinguishAll = useCallback(() => {
    let next = toolsRef.current;
    for (const id of optionsRef.current.equipment ?? CONSULTATION_EQUIPMENT) next = setConsultationToolPower(next, id, false);
    updateTools(next);
  }, [updateTools]);
  const stopLights = useCallback(() => {
    let next = toolsRef.current;
    for (const hand of ["left", "right"] as const) next = powerConsultationTool(next, hand, false);
    slots.forEach(slot => { slot.triggerRoute = null; slot.pendingSelection = null; });
    updateTools(next);
  }, [slots, updateTools]);
  const resetClinic = useCallback(() => {
    closeUtilityPanel();
    closeScopeView();
    hidePlacementMarkers();
    scopeApertureRef.current = "small"; setScopeAperture("small");
    // Keep button edges latched: reset must not turn a held grip/trigger into a new action.
    slots.forEach(slot => { slot.triggerRoute = null; slot.panel = false; slot.thumbstickY = 0; slot.candidate = null; slot.pendingSelection = null; });
    updateTools(initialConsultationTools());
    desktopInput.current = initialDesktopClinicInput();
    desktopToolRoll.current = 0;
    desktopPoseOverrides.current.clear();
    setDesktopActiveHand(desktopInput.current.activeHand);
    desktopAimRef.current = { tool: null, action: "Aim at an instrument" };
    setDesktopAim(desktopAimRef.current);
    setHighlighted([]); setHandlingMessage("");
    pauseTechnique("reset");
  }, [closeScopeView, closeUtilityPanel, hidePlacementMarkers, pauseTechnique, slots, updateTools]);
  const closePanels = useCallback(() => {
    // Returning to a lesson keeps physical ownership and held-button edges.
    slots.forEach(slot => {
      slot.panel = false;
      if (slot.triggerRoute === "panel") { slot.triggerRoute = null; slot.pendingSelection = null; }
    });
    optionsRef.current.onMenu?.(false);
    refresh(value => value + 1);
  }, [slots]);
  const toggleUtilityPanel = useCallback((hand: Hand) => {
    const slot = slots.find(candidate => candidate.hand === hand);
    if (!activeRef.current || !frameValid.current || !slot?.tracked
      || toolInHand(toolsRef.current, hand)) return;
    if (utilityOpenRef.current) { closeUtilityPanel(); return; }
    closeScopeView();
    closePanels();
    utilityOpenRef.current = true;
    setUtilityOpen(true);
    pauseTechnique("panel");
  }, [closePanels, closeScopeView, closeUtilityPanel, pauseTechnique, slots]);
  const handStatus = () => Object.fromEntries((["left", "right"] as const).map(hand => {
    const slot = slots.find(candidate => candidate.hand === hand);
    return [hand, { tracked: frameValid.current && Boolean(slot?.tracked), panel: Boolean(slot?.panel) }];
  })) as Record<Hand, { tracked: boolean; panel: boolean }>;
  const workingPose = (id: ConsultationToolId, allowPanel = false) => {
    const object = objects.current.get(id);
    const hands = handStatus();
    if (allowPanel) { hands.left.panel = false; hands.right.panel = false; }
    if (!object || !consultationToolReady(toolsRef.current, id, hands)) return false;
    const definition = consultationToolDefinition(id);
    origin.set(...definition.workingPoint);
    object.localToWorld(origin);
    object.getWorldQuaternion(quaternion);
    direction.set(...definition.forward).applyQuaternion(quaternion).normalize();
    return true;
  };
  /** Resting poses use the real rendered transform and remain independent of releasing-hand tracking. */
  const supportedWorkingPose = (id: ConsultationToolId, allowPanel = false): SensoryWorkingPose | null => {
    if (!(optionsRef.current.equipment ?? CONSULTATION_EQUIPMENT).includes(id)) return null;
    const object = objects.current.get(id);
    if (!object?.visible) return null;
    if (toolsRef.current[id].placement.kind === "held") {
      const hands = handStatus();
      if (allowPanel) { hands.left.panel = false; hands.right.panel = false; }
      if (!consultationToolReady(toolsRef.current, id, hands)) return null;
    }
    object.updateMatrixWorld(true);
    const definition = consultationToolDefinition(id);
    samplePoint.set(...definition.workingPoint);
    object.localToWorld(samplePoint);
    sampleForward.set(...definition.forward).applyQuaternion(object.getWorldQuaternion(sampleRotation)).normalize();
    return { position: samplePoint.toArray() as [number, number, number], forward: sampleForward.toArray() as [number, number, number] };
  };
  const pickupHint = (slot: ControllerSlot) => {
    slot.grip.getWorldPosition(origin);
    return consultationPickupHint(origin.toArray() as [number, number, number], (optionsRef.current.equipment ?? CONSULTATION_EQUIPMENT).map(id => {
      const object = objects.current.get(id);
      object?.getWorldPosition(workingOrigin);
      return { id, position: workingOrigin.toArray() as [number, number, number], visible: Boolean(object?.visible) };
    }));
  };
  const pickupHintRef = useRef(pickupHint);
  pickupHintRef.current = pickupHint;
  useEffect(() => {
    const discovered = new Set<Object3D>();
    const priority = new Set<Object3D>();
    scene.traverse(object => {
      const data = object.userData;
      const interactive = Boolean(data.station || data.xrTeleport || data.xrPanel || data.xrToolControls
        || data.xrInteractiveSurface || data.consultationToolId || data.xrAction || data.xrInstrumentControl);
      if (!interactive) return;
      let ancestor = object.parent;
      while (ancestor && ancestor !== scene) {
        if (discovered.has(ancestor) || raycastTargets.current.has(ancestor)) return;
        ancestor = ancestor.parent;
      }
      discovered.add(object);
      if (data.xrPriorityPanel) priority.add(object);
    });
    discoveredRaycastTargets.current = discovered;
    priorityRaycastTargets.current = priority;
    perfCount("ray target audit");
    perfCount("registered ray targets", raycastTargets.current.size + discovered.size);
  });

  useFrame(({ camera }, dt, frame) => {
    rayFrame.current += 1;
    if (!activeRef.current) { frameValid.current = false; return; }
    const reference = gl.xr.getReferenceSpace();
    const visible = inputMode === "desktop" ? document.visibilityState !== "hidden" : gl.xr.getSession()?.visibilityState === "visible";
    // A slow rendered frame is not tracking loss. Quest can occasionally exceed
    // 100 ms while compiling shaders or recovering performance; only current XR
    // poses/session visibility determine whether physical input is valid.
    frameValid.current = inputMode === "desktop" ? Boolean(visible) : Boolean(frame && reference && visible);
    if (inputMode === "desktop") {
      const cameraPosition = camera.getWorldPosition(samplePoint);
      const cameraRotation = camera.getWorldQuaternion(sampleRotation);
      for (const slot of slots) {
        slot.tracked = true;
        slot.ray.position.copy(cameraPosition); slot.ray.quaternion.copy(cameraRotation);
        slot.grip.position.copy(cameraPosition);
        workingOrigin.set(slot.hand === "left" ? -.18 : .18, -.18, -.42).applyQuaternion(cameraRotation);
        slot.grip.position.add(workingOrigin); slot.grip.quaternion.copy(cameraRotation);
        slot.grip.visible = true; slot.ray.visible = slot.hand === desktopInput.current.activeHand;
      }
    } else if (frameValid.current && frame && reference) {
      const pose = frame.getViewerPose(baseSpace.current ?? reference);
      const orientation = pose?.transform.orientation;
      if (pose) {
        sampleRotation.set(orientation?.x ?? 0, orientation?.y ?? 0, orientation?.z ?? 0, orientation?.w ?? 1);
        sampleForward.set(0, 0, -1).applyQuaternion(sampleRotation);
        physicalViewer.current = {
          x: pose.transform.position.x,
          z: pose.transform.position.z,
          yaw: Math.atan2(-sampleForward.x, -sampleForward.z),
        };
      } else physicalViewer.current = null;
      frameValid.current = Boolean(pose);
      if (pose && initialArrival.current) { initialArrival.current = false; recenterClinic(false); }
    }
    for (const slot of slots) {
      if (inputMode === "desktop") continue;
      const wasTracked = slot.tracked;
      // A valid grip alone does not establish a current aim pose. Three.js retains
      // the last target-ray transform when that pose is unavailable.
      slot.tracked = Boolean(frameValid.current && frame && reference && slot.source?.gripSpace
        && frame.getPose(slot.source.gripSpace, reference) && frame.getPose(slot.source.targetRaySpace, reference));
      if (wasTracked !== slot.tracked) refresh(value => value + 1);
      if (wasTracked && !slot.tracked) {
        closeUtilityPanel();
        closeScopeView();
        if (slot.hand) updateTools(powerConsultationTool(toolsRef.current, slot.hand, false));
        Object.assign(slot, interruptConsultationInput(slot));
        slot.candidate = null; slot.pendingSelection = null; slot.thumbstickY = 0;
        pauseTechnique("tracking");
      }
      const buttonPressed = Boolean(slot.source?.gamepad?.buttons[4]?.pressed);
      if (buttonPressed && !slot.buttonDown && slot.tracked && slot.hand) {
        if (optionsRef.current.panelModeEnabled !== false) {
          closeUtilityPanel();
          closeScopeView();
          Object.assign(slot, toggleConsultationPanel(slot));
          updateTools(powerConsultationTool(toolsRef.current, slot.hand, false));
          const open = slots.some(candidate => candidate.panel);
          optionsRef.current.onMenu?.(open);
          pauseTechnique("panel");
          refresh(value => value + 1);
        }
      }
      slot.buttonDown = buttonPressed;
      // Quest B/Y is the second face button in the xr-standard mapping.
      const scopePressed = Boolean(slot.source?.gamepad?.buttons[5]?.pressed);
      if (scopePressed && !slot.scopeButtonDown && slot.hand && slot.tracked) {
        const held = toolInHand(toolsRef.current, slot.hand);
        if (held === "fundus") {
          closeUtilityPanel();
          toggleScopeView(slot.hand);
        } else if (!held) toggleUtilityPanel(slot.hand);
      }
      // Latch even while unavailable: recovery must not synthesize a fresh press.
      slot.scopeButtonDown = scopePressed;
      const gamepad = slot.source?.gamepad;
      const axes = gamepad?.axes ?? [];
      const horizontal = axes.length >= 4 ? axes[2] : axes[0] ?? 0;
      const vertical = axes.length >= 4 ? axes[3] : axes[1] ?? 0;
      let thumbstickStep: -1 | 0 | 1 = 0;
      let thumbstickAxis: "horizontal" | "vertical" = "vertical";
      if (Math.abs(horizontal) >= Math.abs(vertical) && Math.abs(horizontal) >= .65) {
        thumbstickStep = horizontal < 0 ? -1 : 1;
        thumbstickAxis = "horizontal";
      } else if (Math.abs(vertical) >= .65) {
        thumbstickStep = vertical < 0 ? 1 : -1;
      }
      if (Math.abs(horizontal) <= .25 && Math.abs(vertical) <= .25) slot.thumbstickY = 0;
      if (thumbstickStep && !slot.thumbstickY && slot.hand && slot.tracked && !editorOpen && !slot.panel) {
        const id = toolInHand(toolsRef.current, slot.hand);
        if (id && optionsRef.current.onThumbstickStep?.(id, thumbstickStep, slot.hand, thumbstickAxis)) {
          pulseHand(slot.hand);
        }
        slot.thumbstickY = thumbstickStep;
      }
      slot.grip.visible = slot.tracked;
      slot.ray.visible = slot.tracked && (utilityOpenRef.current || editorOpen || findingsPanels.current.size > 0 || slot.panel || !slot.hand || !toolInHand(toolsRef.current, slot.hand));
    }
    if (scopeViewHandRef.current && (editorOpen || !optionsRef.current.scopeViewEnabled
      || toolInHand(toolsRef.current, scopeViewHandRef.current) !== "fundus"
      || slots.some(slot => slot.panel))) closeScopeView();
    // One world-space model per instrument; poses are updated before procedure sampling.
    for (const id of optionsRef.current.equipment ?? CONSULTATION_EQUIPMENT) {
      const definition = consultationToolDefinition(id);
      const object = objects.current.get(definition.id);
      if (!object) continue;
      const placement = toolsRef.current[definition.id].placement;
      object.userData.xrIgnoreRay = placement.kind === "held";
      if (placement.kind === "held") {
        const slot = slots.find(candidate => candidate.hand === placement.hand);
        object.visible = Boolean(slot?.tracked);
        if (!slot?.tracked) continue;
        const assistedPose = inputMode === "desktop" ? desktopPoseOverrides.current.get(id)
          ?? optionsRef.current.desktopHeldPose?.(id)
          ?? desktopAccommodationHeldPose(id,
            toolsRef.current.cover.placement.kind === "socket" ? toolsRef.current.cover.placement.socketId : undefined,
            desktopToolRoll.current) : null;
        if (assistedPose) {
          object.position.set(...assistedPose.position);
          object.quaternion.set(...assistedPose.rotation);
        } else {
          slot.grip.getWorldPosition(object.position);
          // WebXR grip pose describes the hand; target-ray pose describes where it points.
          // Axial light tools must follow the aim pose, not the Quest grip-axis tilt.
          const heldPose = definition.heldPose ?? (definition.illuminates && definition.powerMode !== "persistent" ? "ray" : "grip");
          (heldPose === "ray" ? slot.ray : slot.grip).getWorldQuaternion(object.quaternion);
          object.quaternion.multiply(quaternion.set(...definition.gripRotation));
        }
      } else {
        object.visible = true;
        object.position.set(...placement.position);
        object.quaternion.set(...placement.rotation);
      }
      object.updateMatrixWorld(true);
    }
    const viewer = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    viewer.getWorldQuaternion(quaternion);
    for (const [hand, marker] of placementMarkers.current) {
      const slot = slots.find(candidate => candidate.hand === hand);
      marker.visible = Boolean(slot?.tracked && toolInHand(toolsRef.current, hand));
      if (!marker.visible || !slot) continue;
      const result = resolvePlacement(slot);
      if (!result?.id) { marker.visible = false; continue; }
      const rest = result.state[result.id].placement;
      if (rest.kind === "held") { marker.visible = false; continue; }
      marker.position.set(...rest.position);
      const definition = consultationToolDefinition(result.id);
      for (const kind of ["place", "return"] as const) {
        const guide = marker.getObjectByName(kind);
        if (!guide) continue;
        guide.visible = (kind === "return") === result.returned;
        const outline = guide.getObjectByName("outline");
        if (outline) {
          // The outline represents the horizontal footprint, even for a card
          // whose canonical resting model is pitched flat onto the surface.
          sampleRotation.set(...definition.restRotation).invert();
          outline.quaternion.set(...rest.rotation).multiply(sampleRotation);
          outline.scale.set(definition.footprint[0], .035, definition.footprint[1]);
        }
        const label = guide.getObjectByName("label");
        label?.quaternion.copy(quaternion);
      }
      marker.updateMatrixWorld(true);
    }
    for (const [id, controls] of toolControls.current) {
      const placement = toolsRef.current[id].placement;
      const slot = placement.kind === "held" ? slots.find(candidate => candidate.hand === placement.hand) : undefined;
      controls.visible = Boolean(slot?.tracked) && !editorOpen;
      if (!slot?.tracked) continue;
      slot.grip.getWorldPosition(controls.position);
      workingOrigin.set(slot.hand === "left" ? -.20 : .20, .12, .04).applyQuaternion(quaternion);
      controls.position.add(workingOrigin); controls.quaternion.copy(quaternion);
      controls.updateMatrixWorld(true);
    }
    const candidates: ConsultationToolId[] = [];
    const hints: Record<Hand, ConsultationPickupHint | null> = { left: null, right: null };
    for (const slot of slots) {
      slot.candidate = null;
      if (!slot.hand || !slot.tracked || toolInHand(toolsRef.current, slot.hand)) continue;
      const hint = pickupHint(slot);
      hints[slot.hand] = hint;
      slot.candidate = hint?.reachable ? hint.id : null;
      if (slot.candidate) candidates.push(slot.candidate);
    }
    if (inputMode === "desktop") {
      const slot = slots.find(candidate => candidate.hand === desktopInput.current.activeHand);
      const held = slot?.hand ? toolInHand(toolsRef.current, slot.hand) : null;
      const hit = slot ? rayHit(slot) : null;
      const aimed = ancestorData(hit?.object ?? null).consultationToolId ?? null;
      const nextAim: DesktopClinicAim = held
        ? { tool: held, action: `E · place ${toolLabel(held)}` }
        : aimed ? { tool: aimed, action: `E · pick up ${toolLabel(aimed)}` }
          : { tool: null, action: "Aim at an instrument" };
      desktopAimRef.current = nextAim;
      visualTime.current += dt;
      if (visualTime.current >= .1) {
        visualTime.current = 0;
        setDesktopAim(previous => previous.tool === nextAim.tool && previous.action === nextAim.action ? previous : nextAim);
        setHighlighted(aimed ? [aimed] : []);
      }
    }
    // Readouts and candidate feedback need not cause React renders at headset frequency.
    if (inputMode === "xr") visualTime.current += dt;
    if (inputMode === "xr" && visualTime.current >= .1) {
      visualTime.current = 0;
      const unique = [...new Set(candidates)];
      setHighlighted(previous => previous.join() === unique.join() ? previous : unique);
      setPickupHints(previous => (["left", "right"] as const).every(hand => consultationPickupLabel(previous[hand]) === consultationPickupLabel(hints[hand])) ? previous : hints);
    }
    let button: Object3D | null = null;
    for (const slot of slots) {
      if (!slot.ray.visible) continue;
      const hit = rayHit(slot);
      const beam = slot.ray.getObjectByName("clinic-pointer-beam"), dot = slot.ray.getObjectByName("clinic-pointer-dot");
      const pointerReach = findingsPanels.current.size > 0 ? 5 : 3;
      const length = hit ? Math.min(pointerReach, Math.max(.01, hit.distance)) : pointerReach;
      if (beam) { beam.position.z = -length / 2; beam.scale.y = length; }
      let object: Object3D | null = hit?.object ?? null;
      let hovered: Object3D | null = null;
      while (object) {
        if (object.userData.xrButton) { hovered = object; button ??= object; break; }
        object = object.parent;
      }
      if (dot) {
        dot.visible = Boolean(hovered && hit && hit.distance <= pointerReach);
        dot.position.set(0, 0, -length + .002);
      }
    }
    if (hoverMarker.current) {
      hoverMarker.current.visible = Boolean(button);
      if (button) {
        button.getWorldPosition(hoverMarker.current.position);
        button.getWorldQuaternion(hoverMarker.current.quaternion);
        button.getWorldScale(workingOrigin);
        hoverMarker.current.scale.set((Number(button.userData.xrWidth ?? .27) + .012) * workingOrigin.x, Number(button.userData.xrHeight ?? .077) * workingOrigin.y, workingOrigin.z);
      }
    }
  });

  const priorityHitScratch = useMemo(() => ({ inverse: new Matrix4(), ray: new Ray(), point: new Vector3() }), []);
  type RaycastHit = { object: Object3D; point: Vector3; distance: number };
  function rayHit(slot: ControllerSlot, fresh = false): RaycastHit | null {
    const cached = rayHitCache.current.get(slot);
    if (!fresh && cached?.frame === rayFrame.current) return cached.hit;
    slot.ray.getWorldPosition(origin);
    slot.ray.getWorldQuaternion(quaternion);
    direction.set(0, 0, -1).applyQuaternion(quaternion).normalize();
    raycaster.set(origin, direction);
    raycaster.far = findingsPanels.current.size > 0 ? 5 : 3;
    // Head-following result actions need a geometric hit area independent of
    // decorative meshes, material sides and the wall editor behind them.
    let priorityHit: { object: Object3D; point: Vector3; distance: number } | null = null;
    priorityRaycastTargets.current.forEach(object => {
      if (!object.visible) return;
      if (!object.userData.xrButton || !object.userData.xrAction || !ancestorData(object).priorityPanel) return;
      object.updateWorldMatrix(true, false);
      const scratch = priorityHitScratch;
      scratch.inverse.copy(object.matrixWorld).invert();
      scratch.ray.copy(raycaster.ray).applyMatrix4(scratch.inverse);
      if (Math.abs(scratch.ray.direction.z) < .00001) return;
      const t = (.012 - scratch.ray.origin.z) / scratch.ray.direction.z;
      if (t < 0) return;
      scratch.ray.at(t, scratch.point);
      if (Math.abs(scratch.point.x) > Number(object.userData.xrWidth ?? .5) / 2
        || Math.abs(scratch.point.y) > Number(object.userData.xrHeight ?? .077) / 2) return;
      scratch.point.applyMatrix4(object.matrixWorld);
      const distance = raycaster.ray.origin.distanceTo(scratch.point);
      if (!priorityHit || distance < priorityHit.distance) priorityHit = { object, point: scratch.point.clone(), distance };
    });
    if (priorityHit) { rayHitCache.current.set(slot, { frame: rayFrame.current, hit: priorityHit }); return priorityHit; }
    const candidates = [...raycastTargets.current, ...discoveredRaycastTargets.current].filter((object, index, all) => all.indexOf(object) === index);
    perfCount("raycast candidate roots", candidates.length);
    const intersections = raycaster.intersectObjects(candidates, true).filter(intersection => {
      let object: Object3D | null = intersection.object;
      let interactive = false;
      while (object) {
        interactive ||= Boolean(object.userData.xrToolControls || object.userData.xrInteractiveSurface);
        if (!object.visible || (object.userData.xrIgnoreRay && !interactive)) return false;
        object = object.parent;
      }
      return true;
    });
    // Temporary result actions sit in front of an open findings board. Resolve
    // that nearer modal overlay before the board-specific editor preference.
    const priorityActionHit = intersections.find(hit => {
      const data = ancestorData(hit.object);
      return data.priorityPanel && data.action;
    });
    if (priorityActionHit) { rayHitCache.current.set(slot, { frame: rayFrame.current, hit: priorityActionHit }); return priorityActionHit; }
    // A deliberately aimed nearby physical selector takes precedence over
    // intervening placement previews or equipment; selectEnd still enforces
    // free-hand ownership and physical reach before invoking it.
    const findingsAction = intersections.find(hit => {
      if (!ancestorData(hit.object).action) return false;
      let object: Object3D | null = hit.object;
      while (object) { if (object.userData.xrPersistentFindings) return true; object = object.parent; }
      return false;
    });
    const instrumentControl = intersections.find(hit => ancestorData(hit.object).instrumentControl);
    if (instrumentControl) {
      slot.grip.getWorldPosition(workingOrigin);
      // A nearby physical selector remains usable. A distant target/dock must
      // not steal a deliberate press on the findings board behind it.
      if (!findingsAction || workingOrigin.distanceTo(instrumentControl.point) <= SCOPE_SELECTOR_REACH_M) {
        rayHitCache.current.set(slot, { frame: rayFrame.current, hit: instrumentControl }); return instrumentControl;
      }
    }
    if (findingsAction) { rayHitCache.current.set(slot, { frame: rayFrame.current, hit: findingsAction }); return findingsAction; }
    if (editorOpen) {
      const editorHit = intersections.find(hit => {
        let object: Object3D | null = hit.object;
        while (object) { if (object.userData.xrObservationEditor) return true; object = object.parent; }
        return false;
      });
      if (editorHit) { rayHitCache.current.set(slot, { frame: rayFrame.current, hit: editorHit }); return editorHit; }
    }
    // Tool-side controls are visible overlays, just like the explicitly opened editor.
    const toolControl = intersections.find(hit => {
      let object: Object3D | null = hit.object;
      while (object) { if (object.userData.xrToolControls) return true; object = object.parent; }
      return false;
    });
    const hit = toolControl ?? intersections[0] ?? null;
    rayHitCache.current.set(slot, { frame: rayFrame.current, hit });
    return hit;
  }

  const desktopAdjustment = useCallback((step: -1 | 1, axis: "horizontal" | "vertical" = "vertical") => {
    if (inputMode !== "desktop" || !activeRef.current || editorOpen) return false;
    const hand = desktopInput.current.activeHand;
    let id = toolInHand(toolsRef.current, hand);
    if (!id) {
      const pushUp = toolsRef.current["push-up-rule"].placement;
      const npc = toolsRef.current["npc-rule"].placement;
      if (pushUp.kind === "socket" && pushUp.socketId === "library-push-up-spectacle") id = "push-up-rule";
      else if (npc.kind === "socket" && npc.socketId === "library-npc-spectacle") id = "npc-rule";
    }
    if (!id) return false;
    if (axis === "horizontal" && id === "vergence-prism") {
      desktopToolRoll.current += step;
      return true;
    }
    return Boolean(optionsRef.current.onThumbstickStep?.(id, step, hand, axis));
  }, [editorOpen, inputMode]);

  const desktopReleasePose = useCallback((id: ConsultationToolId) => {
    const sockets = optionsRef.current.placementSockets ?? [];
    const preferred = desktopAssistedSocketId(id);
    const socket = sockets.find(candidate => candidate.tool === id && candidate.id === preferred);
    return socket ? { position: socket.position, rotation: socket.rotation } : undefined;
  }, []);

  const setDesktopHeldPose = useCallback((id: ConsultationToolId, pose: DesktopClinicPose | null) => {
    if (pose) desktopPoseOverrides.current.set(id, pose);
    else desktopPoseOverrides.current.delete(id);
  }, []);

  const desktopTogglePickup = useCallback(() => {
    if (inputMode !== "desktop" || !activeRef.current || editorOpen) return;
    const hand = desktopInput.current.activeHand;
    const held = toolInHand(toolsRef.current, hand);
    if (held) {
      const result = releaseConsultationTool(toolsRef.current, hand, desktopReleasePose(held),
        optionsRef.current.placementSurfaces ?? CONSULTATION_SURFACES,
        optionsRef.current.placementSockets, optionsRef.current.equipment ?? CONSULTATION_EQUIPMENT);
      updateTools(result.state);
      desktopPoseOverrides.current.delete(held);
      pauseTechnique("release");
      if (result.returned) setReturnedAt(previous => ({ ...previous, [held]: performance.now() }));
      setHandlingMessage(result.returned ? "Returned to its resting place." : "Instrument placed at the supported clinical anchor.");
      return;
    }
    const id = desktopAimRef.current.tool;
    if (!id || !(optionsRef.current.equipment ?? CONSULTATION_EQUIPMENT).includes(id)) {
      setHandlingMessage("Aim the centre reticle at an available instrument, then press E.");
      return;
    }
    const oldPlacement = toolsRef.current[id].placement;
    desktopPoseOverrides.current.delete(id);
    updateTools(grabConsultationTool(toolsRef.current, id, hand));
    optionsRef.current.onToolUsed?.(id, "pickup");
    pauseTechnique(oldPlacement.kind === "held" ? "transfer" : "pickup");
    setHandlingMessage(`${toolLabel(id)} · ${hand} virtual hand`);
  }, [desktopReleasePose, editorOpen, inputMode, pauseTechnique, updateTools]);

  const desktopActivation = useCallback((pressed: boolean) => {
    if (inputMode !== "desktop" || !activeRef.current) return;
    const hand = desktopInput.current.activeHand;
    const id = toolInHand(toolsRef.current, hand);
    desktopInput.current = setDesktopClinicActivation(desktopInput.current, pressed && Boolean(id));
    const slot = slots.find(candidate => candidate.hand === hand);
    if (slot) slot.triggerDown = pressed && Boolean(id);
    if (!id) return;
    if (pressed) optionsRef.current.onToolUsed?.(id, "activate");
    updateTools(powerConsultationTool(toolsRef.current, hand, pressed));
  }, [inputMode, slots, updateTools]);

  useEffect(() => {
    if (inputMode !== "desktop" || !active) return;
    const canvas = gl.domElement;
    const keydown = (event: KeyboardEvent) => {
      const shortcut = desktopClinicShortcut(event, isEditableClinicTarget(event.target));
      if (!shortcut) return;
      event.preventDefault();
      if (shortcut === "switch-hand") {
        desktopActivation(false);
        desktopInput.current = switchDesktopClinicHand(desktopInput.current);
        setDesktopActiveHand(desktopInput.current.activeHand);
      } else if (shortcut === "pickup-place") desktopTogglePickup();
      else {
        const positive = shortcut.endsWith("positive");
        const axis = shortcut.includes("horizontal") ? "horizontal" : "vertical";
        desktopAdjustment(positive ? 1 : -1, axis);
      }
    };
    const wheel = (event: WheelEvent) => {
      if (isEditableClinicTarget(event.target) || editorOpen) return;
      const step = desktopClinicAdjustmentStep(event.deltaY);
      if (step && desktopAdjustment(step)) event.preventDefault();
    };
    const pointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || document.pointerLockElement !== canvas || editorOpen) return;
      desktopActivation(true);
    };
    const pointerUp = (event: PointerEvent) => { if (event.button === 0) desktopActivation(false); };
    const clear = () => {
      desktopActivation(false);
      desktopInput.current = clearDesktopClinicTransient(desktopInput.current);
    };
    const visibility = () => { clear(); if (document.visibilityState === "hidden") pauseTechnique("visibility"); };
    window.addEventListener("keydown", keydown);
    canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.addEventListener("pointerdown", pointerDown);
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("pointerlockchange", clear);
    return () => {
      window.removeEventListener("keydown", keydown);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("pointerdown", pointerDown);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("pointerlockchange", clear);
      clear();
    };
  }, [active, desktopActivation, desktopAdjustment, desktopTogglePickup, editorOpen, gl, inputMode, pauseTechnique]);

  useEffect(() => { if (inputMode === "desktop" && editorOpen) desktopActivation(false); }, [desktopActivation, editorOpen, inputMode]);

  const teleport = useCallback((destination: [number, number, number]) => {
    if (!activeRef.current) return;
    const reference = baseSpace.current ?? gl.xr.getReferenceSpace(), viewer = physicalViewer.current;
    if (!reference || !viewer) return;
    baseSpace.current ??= reference;
    // The floor pad names the viewer's position, including any physical room-scale
    // displacement from the reference origin. Keep physical height unchanged.
    const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), clinicYaw.current);
    const target = new Vector3(destination[0], 0, destination[2]).applyQuaternion(rotation);
    gl.xr.setReferenceSpace(reference.getOffsetReferenceSpace(new XRRigidTransform({
      x: viewer.x - target.x, y: 0, z: viewer.z - target.z,
    }, { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w })));
  }, [gl]);

  const recenterClinic = useCallback((announce = true) => {
    if (!activeRef.current) return;
    const reference = baseSpace.current ?? gl.xr.getReferenceSpace(), viewer = physicalViewer.current;
    if (!reference || !viewer) return;
    baseSpace.current ??= reference;
    clinicYaw.current = viewer.yaw;
    const destination = new Vector3(0, 0, 1.9);
    const rotation = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), viewer.yaw);
    destination.applyQuaternion(rotation);
    gl.xr.setReferenceSpace(reference.getOffsetReferenceSpace(new XRRigidTransform({
      x: viewer.x - destination.x, y: 0, z: viewer.z - destination.z,
    }, { x: rotation.x, y: rotation.y, z: rotation.z, w: rotation.w })));
    if (announce) {
      closeUtilityPanel();
      closeScopeView();
      pauseTechnique("procedure");
      setHandlingMessage("Clinic recentered in front of you.");
    }
  }, [closeScopeView, closeUtilityPanel, gl, pauseTechnique]);

  const rayHitRef = useRef(rayHit);
  rayHitRef.current = rayHit;
  useEffect(() => {
    if (!active) {
      closeUtilityPanel();
      closeScopeView();
      hidePlacementMarkers();
      scopeApertureRef.current = "small"; setScopeAperture("small");
      baseSpace.current = null;
      clinicYaw.current = 0;
      physicalViewer.current = null; initialArrival.current = true;
      frameValid.current = false;
      updateTools(resetConsultationHands(toolsRef.current));
      extinguishAll();
      slots.forEach(slot => {
        slot.panel = false; slot.triggerRoute = null; slot.triggerDown = false;
        slot.gripDown = false; slot.scopeButtonDown = false; slot.thumbstickY = 0; slot.candidate = null; slot.tracked = false;
        slot.pendingSelection = null;
      });
      setHighlighted([]);
      setHandlingMessage("");
      pauseTechnique("exit");
      return;
    }
  }, [active, closeScopeView, closeUtilityPanel, extinguishAll, hidePlacementMarkers, pauseTechnique, slots, updateTools]);

  useEffect(() => {
    if (!handlingMessage) return;
    const timer = setTimeout(() => setHandlingMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [handlingMessage]);

  useEffect(() => {
    const session = active ? gl.xr.getSession() : null;
    if (!session) return;
    const interrupt = () => {
      closeUtilityPanel();
      closeScopeView();
      hidePlacementMarkers();
      frameValid.current = false;
      stopLights();
      pauseTechnique("visibility");
      slots.forEach(slot => {
        Object.assign(slot, interruptConsultationInput(slot));
        slot.thumbstickY = 0;
        slot.pendingSelection = null;
        slot.tracked = false;
        slot.grip.visible = false;
        slot.ray.visible = false;
      });
      for (const [id, object] of objects.current) {
        if (toolsRef.current[id].placement.kind === "held") object.visible = false;
      }
    };
    const visibility = () => { if (session.visibilityState !== "visible") interrupt(); };
    const end = () => {
      endedSession.current = session;
      activeRef.current = false;
      interrupt();
      updateTools(resetConsultationHands(toolsRef.current));
      extinguishAll();
      slots.forEach(slot => { Object.assign(slot, initialConsultationInput()); slot.pendingSelection = null; slot.thumbstickY = 0; });
    };
    session.addEventListener("visibilitychange", visibility);
    session.addEventListener("end", end);
    return () => {
      session.removeEventListener("visibilitychange", visibility);
      session.removeEventListener("end", end);
    };
  }, [active, closeScopeView, closeUtilityPanel, extinguishAll, gl, hidePlacementMarkers, pauseTechnique, slots, stopLights, updateTools]);

  useEffect(() => {
    const cleanups = slots.map(slot => {
      const connected = (event: unknown) => {
        const source = (event as { data: XRInputSource }).data;
        slot.source = source;
        slot.hand = source.handedness === "left" || source.handedness === "right" ? source.handedness : null;
        slot.triggerRoute = null; slot.triggerDown = false; slot.gripDown = false; slot.panel = false; slot.pendingSelection = null; slot.thumbstickY = 0;
        slot.scopeButtonDown = Boolean(source.gamepad?.buttons[5]?.pressed);
        refresh(value => value + 1);
      };
      const disconnected = () => {
        closeUtilityPanel();
        closeScopeView();
        if (slot.hand) { const marker = placementMarkers.current.get(slot.hand); if (marker) marker.visible = false; }
        if (slot.hand) {
          const release = releaseConsultationTool(toolsRef.current, slot.hand);
          updateTools(release.state);
          const returnedId = release.id;
          if (returnedId) setReturnedAt(previous => ({ ...previous, [returnedId]: performance.now() }));
        }
        slot.source = null; slot.hand = null; slot.tracked = false;
        slot.triggerRoute = null; slot.triggerDown = false; slot.gripDown = false; slot.panel = false; slot.pendingSelection = null; slot.thumbstickY = 0;
        pauseTechnique("tracking");
        refresh(value => value + 1);
      };
      const squeezeStart = () => {
        if (!activeRef.current || !slot.hand || !slot.tracked) return;
        const pressed = pressConsultationGrip(slot);
        if (pressed === slot) return;
        Object.assign(slot, pressed);
        const owned = toolInHand(toolsRef.current, slot.hand);
        if (owned) {
          const result = resolvePlacement(slot);
          if (!result) return;
          if (owned === "fundus") closeScopeView();
          hidePlacementMarkers();
          updateTools(result.state);
          perfEvent(`place ${owned}`);
          pauseTechnique("release");
          if (result.returned) setReturnedAt(previous => ({ ...previous, [owned]: performance.now() }));
          setHandlingMessage(result.returned ? "Returned to its resting place." : "Instrument placed.");
          return;
        }
        // Recheck geometry at the input boundary; frame feedback is only advisory.
        const hint = pickupHintRef.current(slot);
        const id = hint?.reachable ? hint.id : null;
        if (!id) {
          setHandlingMessage(hint ? `Move your hand beside the ${toolLabel(hint.id).toLowerCase()}, then release and squeeze the side grip.` : "Bring your hand beside an instrument, then squeeze the side grip.");
          return;
        }
        const oldPlacement = toolsRef.current[id].placement;
        if (id === "fundus") closeScopeView();
        if (oldPlacement.kind === "held") {
          const oldSlot = slots.find(candidate => candidate.hand === oldPlacement.hand);
          if (oldSlot) Object.assign(oldSlot, interruptConsultationInput(oldSlot));
        }
        slot.triggerRoute = null;
        hidePlacementMarkers();
        updateTools(grabConsultationTool(toolsRef.current, id, slot.hand));
        optionsRef.current.onToolUsed?.(id, "pickup");
        perfEvent(`pickup ${id}`);
        pauseTechnique(oldPlacement.kind === "held" ? "transfer" : "pickup");
        setHandlingMessage(`${toolLabel(id)} · ${slot.hand} hand`);
      };
      const squeezeEnd = () => {
        // Relaxing the hand never releases ownership or interrupts technique.
        Object.assign(slot, releaseConsultationGrip(slot));
      };
      const selectStart = () => {
        if (!activeRef.current || !slot.hand || !slot.tracked) return;
        const id = toolInHand(toolsRef.current, slot.hand);
        // A held instrument owns that hand's trigger. Wall/menu controls require
        // the free hand so a board behind the patient cannot steal illumination.
        const hit = rayHitRef.current(slot, true);
        // A deliberately aimed physical selector is resolved as a control first;
        // selectEnd then enforces free-hand ownership and proximity.
        const hitData = ancestorData(hit?.object ?? null);
        const controlHit = Boolean(hitData.instrumentControl);
        const pressed = pressConsultationTrigger(slot, Boolean(id) && !controlHit && !hitData.priorityPanel);
        if (pressed === slot) return;
        Object.assign(slot, pressed);
        slot.pendingSelection = slot.triggerRoute === "panel"
          ? { data: hitData, point: hit?.point.clone() ?? null }
          : null;
        if (slot.triggerRoute === "tool") {
          if (id) { optionsRef.current.onToolUsed?.(id, "activate"); perfEvent(`trigger on ${id}`); }
          updateTools(powerConsultationTool(toolsRef.current, slot.hand, true));
        }
      };
      const selectEnd = () => {
        const route = slot.triggerRoute;
        const pending = slot.pendingSelection;
        slot.pendingSelection = null;
        Object.assign(slot, releaseConsultationTrigger(slot));
        if (slot.hand) updateTools(powerConsultationTool(toolsRef.current, slot.hand, false));
        if (route === "tool") perfEvent("trigger off");
        if (route !== "panel" || !activeRef.current || !slot.tracked) return;
        perfEvent("panel press");
        const data = pending?.data ?? ancestorData(null);
        if (data.instrumentControl) {
          if (!slot.hand) return;
          const placement = toolsRef.current[data.instrumentControl].placement;
          if (toolInHand(toolsRef.current, slot.hand) || (placement.kind === "held" && placement.hand === slot.hand)) {
            setHandlingMessage("Use your free hand to adjust the instrument selector."); return;
          }
          slot.grip.getWorldPosition(workingOrigin);
          if (!pending?.point || workingOrigin.distanceTo(pending.point) > SCOPE_SELECTOR_REACH_M) {
            setHandlingMessage(data.instrumentControl === "worth"
              ? "Bring your free hand beside the target switch, then point and press/release its trigger."
              : "Bring your free hand beside the instrument control, then point and press/release its trigger."); return;
          }
        }
        if (data.action) {
          const accepted = data.action();
          if (accepted !== false && data.instrumentControl && slot.hand) pulseHand(slot.hand, .35, 40);
        }
        else if (data.teleport) { pauseTechnique(); teleport(data.teleport); }
        // The patient is scenery, not a menu button. Free-hand trigger presses
        // must not open lesson/consultation panels; A/X owns menu opening.
        else if (data.station !== "patient") optionsRef.current.onSelection?.(data);
      };
      const ray = slot.ray as Object3D & { addEventListener: (type: string, listener: (event: unknown) => void) => void; removeEventListener: (type: string, listener: (event: unknown) => void) => void };
      const events = { connected, disconnected, squeezestart: squeezeStart, squeezeend: squeezeEnd, selectstart: selectStart, selectend: selectEnd };
      Object.entries(events).forEach(([name, listener]) => ray.addEventListener(name, listener));
      return () => Object.entries(events).forEach(([name, listener]) => ray.removeEventListener(name, listener));
    });
    return () => cleanups.forEach(cleanup => cleanup());
  }, [closeScopeView, closeUtilityPanel, direction, hidePlacementMarkers, origin, pauseTechnique, pulseHand, quaternion, resolvePlacement, slots, teleport, updateTools, workingOrigin]);

  return {
    tools, toolsRef, slots, objects, toolControls, findingsPanels, raycastTargets, registerRaycastTarget, frameValid, scopeAperture, scopeApertureRef, cycleScopeAperture, scopeViewHand, scopeViewHandRef, closeScopeView, toggleScopeView, utilityOpen, closeUtilityPanel, toggleUtilityPanel, highlighted, pickupHints, returnedAt,
    handlingMessage, setHandlingMessage, hoverMarker, placementMarkers, registerTool, updateTools, stopLights, resetClinic, closePanels,
    origin, direction, quaternion, workingPose, supportedWorkingPose, handStatus, pulseHand, teleport, recenterClinic, equipment, toolLabel, setToolPower,
    inputMode, desktopActiveHand, desktopAim, desktopTogglePickup, desktopAdjustment, setDesktopHeldPose,
  };
}
export type ClinicRuntime = ReturnType<typeof useXRClinicRuntime>;
/** Compatibility alias retained for existing XR-only lesson adapters. */
export type XRClinicRuntime = ClinicRuntime;
