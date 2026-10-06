import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Object3D, Quaternion, Raycaster, Vector3 } from "three";
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
export type XRClinicHand = "left" | "right";
type Hand = XRClinicHand;
export type XRClinicControllerSlot = ConsultationInputState & {
  hand: Hand | null; source: XRInputSource | null; ray: Group; grip: Group;
  tracked: boolean; buttonDown: boolean; candidate: ConsultationToolId | null;
};
type ControllerSlot = XRClinicControllerSlot;
function ancestorData(object: Object3D | null) {
  let station: StationId | undefined;
  let examId: string | undefined;
  let teleport: [number, number, number] | undefined;
  let action: (() => void) | undefined;
  let instrumentControl: ConsultationToolId | undefined;
  while (object) {
    station ??= object.userData.station as StationId | undefined;
    examId ??= object.userData.examId as string | undefined;
    teleport ??= object.userData.xrTeleport as [number, number, number] | undefined;
    action ??= object.userData.xrAction as (() => void) | undefined;
    instrumentControl ??= object.userData.xrInstrumentControl as ConsultationToolId | undefined;
    object = object.parent;
  }
  return { station, examId, teleport, action, instrumentControl };
}


export type XRClinicSelection = ReturnType<typeof ancestorData>;
export type XRClinicInterruption = "procedure" | "configuration" | "panel" | "tracking" | "visibility" | "pickup" | "transfer" | "release" | "reset" | "exit";
type Options = {
  active: boolean;
  editorOpen?: boolean;
  equipment?: readonly ConsultationToolId[];
  placementSurfaces?: readonly PlacementSurface[];
  placementSockets?: readonly PlacementSocket[];
  onInterrupt?: (reason: XRClinicInterruption) => void;
  onToolUsed?: (id: ConsultationToolId, action: "pickup" | "activate") => void;
  onMenu?: (open: boolean) => void;
  onSelection?: (selection: XRClinicSelection) => void;
};
/** Shared physical clinic loop. It knows no case findings, lesson answers, or scoring. */
export function useXRClinicRuntime(options: Options) {
  const { active, editorOpen = false, equipment = CONSULTATION_EQUIPMENT } = options;
  const { gl, scene } = useThree();
  const optionsRef = useRef(options); optionsRef.current = options;
  const toolControls = useRef(new Map<ConsultationToolId, Group>());
  const findingsPanels = useRef(new Set<Group>());
  const slots = useMemo<ControllerSlot[]>(() => [0, 1].map(index => ({
    ...initialConsultationInput(), hand: null, source: null, tracked: false,
    ray: gl.xr.getController(index),
    grip: gl.xr.getControllerGrip(index),
    buttonDown: false, candidate: null,
  })), [gl]);
  const [, refresh] = useState(0);
  const [tools, setTools] = useState(initialConsultationTools);
  const toolsRef = useRef(tools);
  const objects = useRef(new Map<ConsultationToolId, Group>());
  const registerTool = useCallback((id: ConsultationToolId, object: Group | null) => {
    if (object) objects.current.set(id, object); else objects.current.delete(id);
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
  const activeRef = useRef(active); activeRef.current = active && !(endedSession.current && (!gl.xr.getSession() || endedSession.current === gl.xr.getSession()));
  const pauseTechnique = useCallback((reason: XRClinicInterruption = "procedure") => optionsRef.current.onInterrupt?.(reason), []);
  const frameValid = useRef(false);
  const [scopeAperture, setScopeAperture] = useState<ScopeAperture>("small");
  const scopeApertureRef = useRef(scopeAperture);
  const cycleScopeAperture = useCallback(() => {
    if (!activeRef.current || !frameValid.current) return;
    scopeApertureRef.current = nextScopeAperture(scopeApertureRef.current);
    setScopeAperture(scopeApertureRef.current);
    pauseTechnique("configuration");
  }, [pauseTechnique]);
  const visualTime = useRef(0);
  const hoverMarker = useRef<Group>(null);
  const workingOrigin = useMemo(() => new Vector3(), []);
  const baseSpace = useRef<XRReferenceSpace | null>(null);
  const physicalViewer = useRef<[number, number] | null>(null);
  const initialArrival = useRef(true);
  const raycaster = useMemo(() => new Raycaster(), []);
  const origin = useMemo(() => new Vector3(), []);
  const direction = useMemo(() => new Vector3(0, 0, -1), []);
  const quaternion = useMemo(() => new Quaternion(), []);
  const samplePoint = useMemo(() => new Vector3(), []);
  const sampleForward = useMemo(() => new Vector3(), []);
  const sampleRotation = useMemo(() => new Quaternion(), []);
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
    slots.forEach(slot => { slot.triggerRoute = null; });
    updateTools(next);
  }, [slots, updateTools]);
  const resetClinic = useCallback(() => {
    scopeApertureRef.current = "small"; setScopeAperture("small");
    // Keep button edges latched: reset must not turn a held grip/trigger into a new action.
    slots.forEach(slot => { slot.triggerRoute = null; slot.panel = false; slot.candidate = null; });
    updateTools(initialConsultationTools());
    setHighlighted([]); setHandlingMessage("");
    pauseTechnique("reset");
  }, [pauseTechnique, slots, updateTools]);
  const closePanels = useCallback(() => {
    // Returning to a lesson keeps physical ownership and held-button edges.
    slots.forEach(slot => {
      slot.panel = false;
      if (slot.triggerRoute === "panel") slot.triggerRoute = null;
    });
    optionsRef.current.onMenu?.(false);
    refresh(value => value + 1);
  }, [slots]);
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
  useFrame(({ camera }, dt, frame) => {
    if (!activeRef.current) { frameValid.current = false; return; }
    const reference = gl.xr.getReferenceSpace();
    const visible = gl.xr.getSession()?.visibilityState === "visible";
    frameValid.current = Boolean(frame && reference && visible && dt <= .1);
    if (frameValid.current && frame && reference) {
      const pose = frame.getViewerPose(baseSpace.current ?? reference);
      physicalViewer.current = pose ? [pose.transform.position.x, pose.transform.position.z] : null;
      frameValid.current = Boolean(pose);
      if (pose && initialArrival.current) { initialArrival.current = false; teleport([0, 0, 1.9]); }
    }
    for (const slot of slots) {
      const wasTracked = slot.tracked;
      // A valid grip alone does not establish a current aim pose. Three.js retains
      // the last target-ray transform when that pose is unavailable.
      slot.tracked = Boolean(frameValid.current && frame && reference && slot.source?.gripSpace
        && frame.getPose(slot.source.gripSpace, reference) && frame.getPose(slot.source.targetRaySpace, reference));
      if (wasTracked !== slot.tracked) refresh(value => value + 1);
      if (wasTracked && !slot.tracked) {
        if (slot.hand) updateTools(powerConsultationTool(toolsRef.current, slot.hand, false));
        Object.assign(slot, interruptConsultationInput(slot));
        slot.candidate = null;
        pauseTechnique("tracking");
      }
      const buttonPressed = Boolean(slot.source?.gamepad?.buttons[4]?.pressed);
      if (buttonPressed && !slot.buttonDown && slot.tracked && slot.hand) {
        Object.assign(slot, toggleConsultationPanel(slot));
        updateTools(powerConsultationTool(toolsRef.current, slot.hand, false));
        const open = slots.some(candidate => candidate.panel);
        optionsRef.current.onMenu?.(open);
        pauseTechnique("panel");
        refresh(value => value + 1);
      }
      slot.buttonDown = buttonPressed;
      slot.grip.visible = slot.tracked;
      slot.ray.visible = slot.tracked && (editorOpen || findingsPanels.current.size > 0 || slot.panel || !slot.hand || !toolInHand(toolsRef.current, slot.hand));
    }
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
        slot.grip.getWorldPosition(object.position);
        // WebXR grip pose describes the hand; target-ray pose describes where it points.
        // Axial light tools must follow the aim pose, not the Quest grip-axis tilt.
        (definition.illuminates && definition.powerMode !== "persistent" ? slot.ray : slot.grip).getWorldQuaternion(object.quaternion);
        object.quaternion.multiply(quaternion.set(...definition.gripRotation));
      } else {
        object.visible = true;
        object.position.set(...placement.position);
        object.quaternion.set(...placement.rotation);
      }
      object.updateMatrixWorld(true);
    }
    const viewer = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    viewer.getWorldQuaternion(quaternion);
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
    // Readouts and candidate feedback need not cause React renders at headset frequency.
    visualTime.current += dt;
    if (visualTime.current >= .1) {
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
        hoverMarker.current.scale.set((Number(button.userData.xrWidth ?? .27) + .012) * workingOrigin.x, Number(button.userData.xrHeight ?? .077) * workingOrigin.y, .028 * workingOrigin.z);
      }
    }
  });

  function rayHit(slot: ControllerSlot) {
    slot.ray.getWorldPosition(origin);
    slot.ray.getWorldQuaternion(quaternion);
    direction.set(0, 0, -1).applyQuaternion(quaternion).normalize();
    raycaster.set(origin, direction);
    const intersections = raycaster.intersectObject(scene, true).filter(intersection => {
      let object: Object3D | null = intersection.object;
      let interactive = false;
      while (object) {
        interactive ||= Boolean(object.userData.xrToolControls || object.userData.xrInteractiveSurface);
        if (!object.visible || (object.userData.xrIgnoreRay && !interactive)) return false;
        object = object.parent;
      }
      return true;
    });
    // Nearby physical selectors take precedence over the distant UI overlays.
    let nearest: Object3D | null = intersections[0]?.object ?? null;
    while (nearest) {
      if (nearest.userData.xrInstrumentControl) return intersections[0];
      nearest = nearest.parent;
    }
    if (editorOpen) {
      const editorHit = intersections.find(hit => {
        let object: Object3D | null = hit.object;
        while (object) { if (object.userData.xrObservationEditor) return true; object = object.parent; }
        return false;
      });
      if (editorHit) return editorHit;
    }
    // Tool-side controls are visible overlays, just like the explicitly opened editor.
    const toolControl = intersections.find(hit => {
      let object: Object3D | null = hit.object;
      while (object) { if (object.userData.xrToolControls) return true; object = object.parent; }
      return false;
    });
    return toolControl ?? intersections[0];
  }

  const teleport = useCallback((destination: [number, number, number]) => {
    if (!activeRef.current) return;
    const reference = baseSpace.current ?? gl.xr.getReferenceSpace(), viewer = physicalViewer.current;
    if (!reference || !viewer) return;
    baseSpace.current ??= reference;
    // The floor pad names the viewer's position, including any physical room-scale
    // displacement from the reference origin. Keep physical height unchanged.
    const [x, z] = viewer;
    gl.xr.setReferenceSpace(reference.getOffsetReferenceSpace(new XRRigidTransform({
      x: x - destination[0], y: 0, z: z - destination[2],
    })));
  }, [gl]);

  const rayHitRef = useRef(rayHit);
  rayHitRef.current = rayHit;
  useEffect(() => {
    if (!active) {
      scopeApertureRef.current = "small"; setScopeAperture("small");
      baseSpace.current = null;
      physicalViewer.current = null; initialArrival.current = true;
      frameValid.current = false;
      updateTools(resetConsultationHands(toolsRef.current));
      extinguishAll();
      slots.forEach(slot => {
        slot.panel = false; slot.triggerRoute = null; slot.triggerDown = false;
        slot.gripDown = false; slot.candidate = null; slot.tracked = false;
      });
      setHighlighted([]);
      setHandlingMessage("");
      pauseTechnique("exit");
      return;
    }
  }, [active, extinguishAll, pauseTechnique, slots, updateTools]);

  useEffect(() => {
    if (!handlingMessage) return;
    const timer = setTimeout(() => setHandlingMessage(""), 4000);
    return () => clearTimeout(timer);
  }, [handlingMessage]);

  useEffect(() => {
    const session = active ? gl.xr.getSession() : null;
    if (!session) return;
    const interrupt = () => {
      frameValid.current = false;
      stopLights();
      pauseTechnique("visibility");
      slots.forEach(slot => {
        Object.assign(slot, interruptConsultationInput(slot));
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
      slots.forEach(slot => Object.assign(slot, initialConsultationInput()));
    };
    session.addEventListener("visibilitychange", visibility);
    session.addEventListener("end", end);
    return () => {
      session.removeEventListener("visibilitychange", visibility);
      session.removeEventListener("end", end);
    };
  }, [active, extinguishAll, gl, pauseTechnique, slots, stopLights, updateTools]);

  useEffect(() => {
    const cleanups = slots.map(slot => {
      const connected = (event: unknown) => {
        const source = (event as { data: XRInputSource }).data;
        slot.source = source;
        slot.hand = source.handedness === "left" || source.handedness === "right" ? source.handedness : null;
        slot.triggerRoute = null; slot.triggerDown = false; slot.gripDown = false; slot.panel = false;
        refresh(value => value + 1);
      };
      const disconnected = () => {
        if (slot.hand) {
          const release = releaseConsultationTool(toolsRef.current, slot.hand);
          updateTools(release.state);
          const returnedId = release.id;
          if (returnedId) setReturnedAt(previous => ({ ...previous, [returnedId]: performance.now() }));
        }
        slot.source = null; slot.hand = null; slot.tracked = false;
        slot.triggerRoute = null; slot.triggerDown = false; slot.gripDown = false; slot.panel = false;
        pauseTechnique("tracking");
        refresh(value => value + 1);
      };
      const squeezeStart = () => {
        if (!activeRef.current || !slot.hand || !slot.tracked) return;
        const pressed = pressConsultationGrip(slot);
        if (pressed === slot) return;
        Object.assign(slot, pressed);
        if (toolInHand(toolsRef.current, slot.hand)) {
          setHandlingMessage("This hand already holds an instrument.");
          return;
        }
        // Recheck geometry at the input boundary; frame feedback is only advisory.
        const hint = pickupHintRef.current(slot);
        const id = hint?.reachable ? hint.id : null;
        if (!id) {
          setHandlingMessage(hint ? `Move your hand beside the ${consultationToolDefinition(hint.id).label.toLowerCase()}, then release and squeeze the side grip.` : "Bring your hand beside an instrument, then squeeze the side grip.");
          return;
        }
        const oldPlacement = toolsRef.current[id].placement;
        if (oldPlacement.kind === "held") {
          const oldSlot = slots.find(candidate => candidate.hand === oldPlacement.hand);
          if (oldSlot) Object.assign(oldSlot, interruptConsultationInput(oldSlot));
        }
        slot.triggerRoute = null;
        updateTools(grabConsultationTool(toolsRef.current, id, slot.hand));
        optionsRef.current.onToolUsed?.(id, "pickup");
        pauseTechnique(oldPlacement.kind === "held" ? "transfer" : "pickup");
        setHandlingMessage(`${consultationToolDefinition(id).label} · ${slot.hand} hand`);
      };
      const squeezeEnd = () => {
        Object.assign(slot, releaseConsultationGrip(slot));
        if (!activeRef.current || !slot.hand) return;
        const id = toolInHand(toolsRef.current, slot.hand);
        if (!id) return; // Includes releasing the old hand after an atomic transfer.
        const object = objects.current.get(id);
        object?.getWorldPosition(origin);
        object?.getWorldQuaternion(quaternion);
        const result = releaseConsultationTool(toolsRef.current, slot.hand, object && slot.tracked ? {
          position: origin.toArray() as [number, number, number],
          rotation: quaternion.toArray() as [number, number, number, number],
        } : undefined, optionsRef.current.placementSurfaces ?? ((optionsRef.current.equipment ?? CONSULTATION_EQUIPMENT).some(tool => ["worth", "red-green", "polarised", "stereo"].includes(tool))
          ? [...CONSULTATION_SURFACES, ...SENSORY_SURFACES] : CONSULTATION_SURFACES), optionsRef.current.placementSockets,
          optionsRef.current.equipment ?? CONSULTATION_EQUIPMENT);
        slot.triggerRoute = null;
        updateTools(result.state);
        pauseTechnique("release");
        if (result.returned) {
          setReturnedAt(previous => ({ ...previous, [id]: performance.now() }));
          setHandlingMessage("No clear supported surface · returned to its resting place.");
        }
      };
      const selectStart = () => {
        if (!activeRef.current || !slot.hand || !slot.tracked) return;
        const id = toolInHand(toolsRef.current, slot.hand);
        // Aiming directly at the standing findings board selects its controls
        // even in the instrument hand; aiming at the patient still uses the tool.
        const hit = rayHitRef.current(slot);
        let target: Object3D | null = hit?.object ?? null, pointsAtPanel = false;
        while (target) { pointsAtPanel ||= Boolean(target.userData.xrPanel || target.userData.xrInstrumentControl); target = target.parent; }
        const pressed = pressConsultationTrigger(slot, Boolean(id) && !pointsAtPanel);
        if (pressed === slot) return;
        Object.assign(slot, pressed);
        if (slot.triggerRoute === "tool") {
          if (id) optionsRef.current.onToolUsed?.(id, "activate");
          updateTools(powerConsultationTool(toolsRef.current, slot.hand, true));
        }
      };
      const selectEnd = () => {
        const route = slot.triggerRoute;
        Object.assign(slot, releaseConsultationTrigger(slot));
        if (slot.hand) updateTools(powerConsultationTool(toolsRef.current, slot.hand, false));
        if (route !== "panel" || !activeRef.current || !slot.tracked) return;
        const hit = rayHitRef.current(slot);
        const data = ancestorData(hit?.object ?? null);
        if (data.instrumentControl) {
          if (!slot.hand) return;
          const placement = toolsRef.current[data.instrumentControl].placement;
          if (toolInHand(toolsRef.current, slot.hand) || (placement.kind === "held" && placement.hand === slot.hand)) {
            setHandlingMessage("Use your free hand to adjust the instrument selector."); return;
          }
          slot.grip.getWorldPosition(workingOrigin);
          if (!hit || workingOrigin.distanceTo(hit.point) > SCOPE_SELECTOR_REACH_M) {
            setHandlingMessage("Bring your free hand beside the aperture wheel, then point and press/release its trigger."); return;
          }
        }
        if (data.action) data.action();
        else if (data.teleport) { pauseTechnique(); teleport(data.teleport); }
        else optionsRef.current.onSelection?.(data);
      };
      const ray = slot.ray as Object3D & { addEventListener: (type: string, listener: (event: unknown) => void) => void; removeEventListener: (type: string, listener: (event: unknown) => void) => void };
      const events = { connected, disconnected, squeezestart: squeezeStart, squeezeend: squeezeEnd, selectstart: selectStart, selectend: selectEnd };
      Object.entries(events).forEach(([name, listener]) => ray.addEventListener(name, listener));
      return () => Object.entries(events).forEach(([name, listener]) => ray.removeEventListener(name, listener));
    });
    return () => cleanups.forEach(cleanup => cleanup());
  }, [direction, origin, pauseTechnique, quaternion, slots, teleport, updateTools, workingOrigin]);

  return {
    tools, toolsRef, slots, objects, toolControls, findingsPanels, frameValid, scopeAperture, scopeApertureRef, cycleScopeAperture, highlighted, pickupHints, returnedAt,
    handlingMessage, setHandlingMessage, hoverMarker, registerTool, updateTools, stopLights, resetClinic, closePanels,
    origin, direction, quaternion, workingPose, supportedWorkingPose, handStatus, teleport, equipment, setToolPower,
  };
}
export type XRClinicRuntime = ReturnType<typeof useXRClinicRuntime>;
