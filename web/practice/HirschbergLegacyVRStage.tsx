/** Retained first VR experiment; active Practice now uses the shared consultation clinic. */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Check, Glasses, Power, RotateCcw, X } from "lucide-react";
import {
  CanvasTexture,
  DoubleSide,
  Group,
  LinearFilter,
  Object3D,
  Quaternion,
  Raycaster,
  SRGBColorSpace,
  Vector3,
  WebGLRenderer,
} from "three";
import { EyeSurface } from "../scene/EyeSurface";
import { Box, ConsultingRoomShell, Cylinder, Refraction, Sign, SlitLamp } from "../scene/Models";
import {
  XR_CLINIC_TOOL_IDS,
  XRClinicToolModel,
  XRInstrumentCabinet,
  XRInstrumentKitSurface,
  type XRClinicToolId as XRVisualToolId,
} from "./xr/XRClinicTools";
import {
  XR_CLINIC_STATIONS,
  createXRClinicState,
  dropHeldTool,
  nearestToolId,
  moveToStation,
  pickupTool,
  returnHeldTool,
  stationArrivalPosition,
  toolHeldInHand,
  toolHomePosition,
  toolWorldPosition,
  type XRClinicState,
  type XRClinicStationId,
} from "../interaction/xrClinic";
import { HIRSCHBERG_XR_PROCEDURE } from "./xr/procedures";
import { hirschbergReflexOffset } from "../interaction/opticPractice";
import {
  xrHirschbergPrompt,
  xrHirschbergTechnique,
  type XRHirschbergTechnique,
  type XRVector3,
} from "../interaction/xrPractice";
import { PracticeWebGLFallback } from "./PracticeWebGLFallback";
import type { OpticScenario } from "./ClinicalPracticeStage";

type Finding = {
  direction: string;
  amount: string;
  feedback: string;
};

type DebugPose = { distanceCm: number; aimX: number; aimY: number };
type Handedness = "left" | "right";

const EMPTY_TECHNIQUE: XRHirschbergTechnique = {
  distanceCm: 0,
  aimErrorDeg: 180,
  viewErrorDeg: 180,
  distanceReady: false,
  aimReady: false,
  viewReady: false,
  ready: false,
  quality: 0,
};

const eyeMidpoint = (seated: boolean): XRVector3 => [0, seated ? 1.12 : 1.35, -.8];
const trayPosition = (seated: boolean): [number, number, number] => [.32, seated ? .77 : .98, -.42];

function pulse(inputSource: XRInputSource | undefined, duration = 35, intensity = .45) {
  const gamepad = inputSource?.gamepad as (Gamepad & {
    hapticActuators?: Array<{ pulse: (value: number, duration: number) => Promise<boolean> }>;
    vibrationActuator?: { playEffect: (type: string, parameters: { duration: number; strongMagnitude: number; weakMagnitude: number }) => Promise<string> };
  }) | undefined;
  const actuator = gamepad?.hapticActuators?.[0];
  const vibration = actuator?.pulse(intensity, duration)
    ?? gamepad?.vibrationActuator?.playEffect("dual-rumble", { duration, strongMagnitude: intensity, weakMagnitude: intensity });
  if (vibration) void vibration.catch(() => undefined);
}

function useTextTexture(text: string, background: string, foreground = "#f5fbf9") {
  const canvas = useMemo(() => document.createElement("canvas"), []);
  const texture = useMemo(() => {
    canvas.width = 1024;
    canvas.height = 256;
    const next = new CanvasTexture(canvas);
    next.colorSpace = SRGBColorSpace;
    next.minFilter = LinearFilter;
    return next;
  }, [canvas]);
  useEffect(() => {
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#5c8079";
    context.lineWidth = 8;
    context.strokeRect(4, 4, canvas.width - 8, canvas.height - 8);
    context.fillStyle = foreground;
    context.font = "600 54px system-ui, sans-serif";
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 70);
    texture.needsUpdate = true;
  }, [background, canvas, foreground, text, texture]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function useStatusTexture(lines: string[]) {
  const canvas = useMemo(() => document.createElement("canvas"), []);
  const texture = useMemo(() => {
    canvas.width = 1024;
    canvas.height = 640;
    const next = new CanvasTexture(canvas);
    next.colorSpace = SRGBColorSpace;
    next.minFilter = LinearFilter;
    return next;
  }, [canvas]);
  const content = lines.join("\n");
  useEffect(() => {
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#102329";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.strokeStyle = "#6da99d";
    context.lineWidth = 10;
    context.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
    context.textAlign = "left";
    context.textBaseline = "top";
    lines.forEach((line, index) => {
      context.font = index === 0 ? "700 58px system-ui, sans-serif" : index === lines.length - 1 ? "500 38px system-ui, sans-serif" : "600 44px system-ui, sans-serif";
      context.fillStyle = index === 0 ? "#99e6d6" : index === lines.length - 1 ? "#d9e8e4" : "#ffffff";
      const words = line.split(" ");
      let row = "";
      let y = 40 + index * 104;
      for (const word of words) {
        const candidate = row ? `${row} ${word}` : word;
        if (context.measureText(candidate).width > 900 && row) {
          context.fillText(row, 55, y);
          row = word;
          y += 45;
        } else row = candidate;
      }
      context.fillText(row, 55, y);
    });
    texture.needsUpdate = true;
  }, [canvas, content, lines, texture]);
  useEffect(() => () => texture.dispose(), [texture]);
  return texture;
}

function VRButton({ label, position, width = .34, active = false, disabled = false, onClick }: {
  label: string;
  position: [number, number, number];
  width?: number;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const texture = useTextTexture(label, disabled ? "#27363a" : active ? "#176b5e" : "#214149", disabled ? "#778c89" : "#f7fffc");
  const [hovered, setHovered] = useState(false);
  return <mesh
    position={position}
    scale={hovered && !disabled ? 1.035 : 1}
    userData={{ xrAction: disabled ? undefined : onClick }}
    onPointerEnter={() => setHovered(true)}
    onPointerLeave={() => setHovered(false)}
    onClick={event => { event.stopPropagation(); if (!disabled) onClick(); }}
  >
    <planeGeometry args={[width, width / 4]} />
    <meshBasicMaterial map={texture} color={hovered && !disabled ? "#c9fff3" : "#ffffff"} side={DoubleSide} />
  </mesh>;
}

function VRControlPanel({ technique, held, light, fixation, direction, amount, checked, correct, seated, prompt, onFixation, onDirection, onAmount, onRecord, onNext, onReset, onSeated, onExit }: {
  technique: XRHirschbergTechnique;
  held: boolean;
  light: boolean;
  fixation: boolean;
  direction: string;
  amount: string;
  checked: boolean;
  correct: boolean;
  seated: boolean;
  prompt: string;
  onFixation: () => void;
  onDirection: () => void;
  onAmount: () => void;
  onRecord: () => void;
  onNext: () => void;
  onReset: () => void;
  onSeated: () => void;
  onExit: () => void;
}) {
  const status = useStatusTexture([
    "HIRSCHBERG · VR PRACTICE",
    `${held ? "✓" : "○"} Penlight  ${light ? "✓ Light" : "○ Trigger"}`,
    `${fixation ? "✓" : "○"} Fixation  ${Math.round(technique.distanceCm)} cm`,
    `${technique.aimReady ? "✓" : "○"} Aim  ${technique.viewReady ? "✓" : "○"} Examiner view`,
    checked ? correct ? "Recorded correctly." : "Recheck reflex position." : prompt,
  ]);
  const directions = ["none", "exotropia", "esotropia", "hypertropia", "hypotropia"];
  const amounts = ["0", "15", "30", "45"];
  const directionLabel = direction || "choose";
  const amountLabel = amount ? `${amount}°` : "choose";
  return <group position={[.72, seated ? 1.2 : 1.43, -1.02]} rotation={[0, -.42, 0]}>
    <mesh position={[0, .15, 0]} userData={{ xrPanel: true }}>
      <planeGeometry args={[.42, .27]} />
      <meshBasicMaterial map={status} side={DoubleSide} />
    </mesh>
    <VRButton label={fixation ? "FIXATION ✓" : "GIVE FIXATION"} position={[0, -.03, .002]} width={.4} active={fixation} onClick={onFixation} />
    <VRButton label={`DIRECTION · ${directionLabel.toUpperCase()}`} position={[0, -.125, .002]} width={.4} disabled={!technique.ready || correct} onClick={() => { const current = directions.indexOf(direction); onDirection(); void current; }} />
    <VRButton label={`LANDMARK · ${amountLabel}`} position={[0, -.22, .002]} width={.4} disabled={!technique.ready || correct} onClick={onAmount} />
    <VRButton label={checked && correct ? "RECORDED ✓" : "RECORD"} position={[-.105, -.315, .002]} width={.19} active={checked && correct} disabled={!technique.ready || !direction || !amount || correct} onClick={onRecord} />
    <VRButton label={correct ? "NEXT FINDING" : seated ? "STANDING SETUP" : "SEATED SETUP"} position={[.105, -.315, .002]} width={.19} onClick={correct ? onNext : onSeated} />
    <VRButton label="RESET" position={[-.105, -.39, .002]} width={.19} onClick={onReset} />
    <VRButton label="EXIT VR" position={[.105, -.39, .002]} width={.19} onClick={onExit} />
  </group>;
}

function ClinicStationTravel({ station, onStation }: { station: XRClinicStationId; onStation: (station: XRClinicStationId) => void }) {
  if (station === "patient-chair") return <group position={[-.72, 1.18, -.95]} rotation={[0, .38, 0]}>
    <VRButton label="INSTRUMENT BAY" position={[0, 0, 0]} width={.34} onClick={() => onStation("instrument-bay")} />
  </group>;
  const atKit = station === "instrument-bay";
  return <group position={atKit ? [-1.02, 1.35, .42] : [0, 1.35, 1.2]} rotation={atKit ? [0, Math.PI / 2, 0] : [0, 0, 0]}>
    <VRButton label={atKit ? "GO TO PATIENT" : "GO TO INSTRUMENTS"} position={[0, 0, 0]} width={.42} onClick={() => onStation(atKit ? "patient-chair" : "instrument-bay")} />
  </group>;
}

function XRStationNavigator({ station, sessionActive, seated }: { station: XRClinicStationId; sessionActive: boolean; seated: boolean }) {
  const { camera, gl } = useThree();
  const baseReferenceSpace = useRef<XRReferenceSpace | null>(null);
  useEffect(() => {
    if (!sessionActive) {
      baseReferenceSpace.current = null;
      const position = stationArrivalPosition(station);
      camera.position.set(position[0], seated ? 1.34 : 1.6, position[2]);
      const look = station === "instrument-bay" ? [-1.58, 1, .77] : station === "entrance" ? [0, 1.25, -.8] : eyeMidpoint(seated);
      camera.lookAt(...look as [number, number, number]);
      return;
    }
    const current = gl.xr.getReferenceSpace();
    if (!current) return;
    if (!baseReferenceSpace.current) baseReferenceSpace.current = current;
    const destination = stationArrivalPosition(station);
    const offset = new XRRigidTransform({ x: -destination[0], y: 0, z: -destination[2] });
    gl.xr.setReferenceSpace(baseReferenceSpace.current.getOffsetReferenceSpace(offset));
  }, [camera, gl, seated, sessionActive, station]);
  return null;
}

function VRPatient({ scenario, quality, light, seated }: { scenario: OpticScenario; quality: number; light: boolean; seated: boolean }) {
  const movement = useRef({ x: 0, y: 0, used: true });
  const centreY = seated ? 1.12 : 1.35;
  return <group position={[0, centreY, -.8]}>
    <group name="examination-chair">
      <Box p={[0, -.49, -.13]} s={[.42, .06, .34]} c="#315b61" radius={.035} />
      <Box p={[0, -.28, -.28]} s={[.4, .48, .07]} c="#315b61" r={[-.08, 0, 0]} radius={.03} />
      <mesh position={[0, (-centreY - .49) / 2, -.13]} castShadow>
        <cylinderGeometry args={[.035, .045, centreY - .49, 18]} />
        <meshStandardMaterial color="#7e9190" metalness={.45} roughness={.38} />
      </mesh>
      <mesh position={[0, -centreY + .07, -.13]} castShadow>
        <cylinderGeometry args={[.23, .23, .035, 24]} />
        <meshStandardMaterial color="#879998" metalness={.35} roughness={.4} />
      </mesh>
    </group>
    <group name="patient">
      <mesh position={[0, -.135, -.025]} castShadow>
        <capsuleGeometry args={[.038, .055, 8, 16]} />
        <meshStandardMaterial color="#9f6a4d" roughness={.72} />
      </mesh>
      <mesh position={[0, -.2, -.055]} rotation={[0, 0, Math.PI / 2]} scale={[1, 1, .72]} castShadow>
        <capsuleGeometry args={[.105, .25, 8, 18]} />
        <meshStandardMaterial color="#527486" roughness={.82} />
      </mesh>
      <mesh position={[0, -.39, -.055]} scale={[1.35, 1, .72]} castShadow>
        <capsuleGeometry args={[.115, .22, 8, 18]} />
        <meshStandardMaterial color="#527486" roughness={.86} />
      </mesh>
      {[-1, 1].map(side => <group key={`arm-${side}`}>
        <mesh position={[side * .19, -.38, -.035]} rotation={[0, 0, side * -.13]} castShadow>
          <capsuleGeometry args={[.043, .27, 7, 14]} />
          <meshStandardMaterial color="#527486" roughness={.86} />
        </mesh>
        <mesh position={[side * .2, -.57, .005]} scale={[.042, .065, .035]} castShadow>
          <sphereGeometry args={[1, 20, 14]} />
          <meshStandardMaterial color="#a97453" roughness={.78} />
        </mesh>
      </group>)}
      {[-1, 1].map(side => <group key={`leg-${side}`}>
        <mesh position={[side * .085, -.72, -.02]} castShadow>
          <capsuleGeometry args={[.052, .32, 7, 14]} />
          <meshStandardMaterial color="#334759" roughness={.88} />
        </mesh>
        <mesh position={[side * .085, -.93, .025]} rotation={[Math.PI / 2, 0, 0]} scale={[.065, .11, .05]} castShadow>
          <sphereGeometry args={[1, 20, 14]} />
          <meshStandardMaterial color="#252c31" roughness={.72} />
        </mesh>
      </group>)}
    </group>
    <group name="head">
      <mesh scale={[.105, .136, .088]} castShadow>
        <sphereGeometry args={[1, 48, 32]} />
        <meshStandardMaterial color="#a97453" roughness={.72} />
      </mesh>
      <mesh position={[0, .012, -.004]} scale={[.108, .14, .091]} castShadow>
        <sphereGeometry args={[1, 40, 24, 0, Math.PI * 2, 0, 1.05]} />
        <meshStandardMaterial color="#292729" roughness={.88} />
      </mesh>
      {[-1, 1].map(side => <mesh key={`ear-${side}`} position={[side * .105, -.005, 0]} scale={[.018, .029, .012]} castShadow>
        <sphereGeometry args={[1, 20, 14]} />
        <meshStandardMaterial color="#9d674b" roughness={.78} />
      </mesh>)}
      <mesh position={[0, -.002, .083]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <coneGeometry args={[.017, .035, 20]} />
        <meshStandardMaterial color="#986044" roughness={.76} />
      </mesh>
      <mesh position={[0, -.066, .077]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[.0035, .035, 5, 12]} />
        <meshStandardMaterial color="#704336" roughness={.74} />
      </mesh>
      {[-1, 1].map(side => <mesh key={`brow-${side}`} position={[side * .035, .052, .079]} rotation={[0, 0, Math.PI / 2 + side * .08]}>
        <capsuleGeometry args={[.0032, .027, 5, 10]} />
        <meshStandardMaterial color="#3a2925" roughness={.9} />
      </mesh>)}
    </group>
    <group position={[0, .025, .081]} scale={.19}>
      <EyeSurface x={-.17} pupils={false} motility={false} progress={0} movement={movement} reflectionStrength={0} />
      <EyeSurface x={.17} pupils={false} motility={false} progress={0} movement={movement} reflectionStrength={0} />
    </group>
    {light && (["od", "os"] as const).map(eye => {
      const baseX = eye === "od" ? -.0323 : .0323;
      const offset = hirschbergReflexOffset(scenario[eye]);
      return <group key={eye} position={[baseX + offset.x * .19, .025 + offset.y * .19, .091]}>
        <mesh renderOrder={5}>
          <circleGeometry args={[.0024, 24]} />
          <meshBasicMaterial color="#fff9d8" transparent opacity={.38 + quality * .62} depthTest={false} />
        </mesh>
        <mesh position={[0, 0, -.001]} renderOrder={4}>
          <ringGeometry args={[.0028, .0055 + (1 - quality) * .004, 24]} />
          <meshBasicMaterial color="#ffd77e" transparent opacity={.1 + quality * .34} depthTest={false} />
        </mesh>
      </group>;
    })}
  </group>;
}

function VRInstrumentTray({ seated }: { seated: boolean }) {
  const height = seated ? .72 : .93;
  return <group>
    <Box p={[.32, height, -.42]} s={[.36, .045, .28]} c="#d9e1de" radius={.018} />
    <Box p={[.32, .12, -.42]} s={[.3, .035, .22]} c="#aebdbc" radius={.014} />
    <Cylinder p={[.32, (height + .12) / 2, -.42]} h={height - .12} radius={.024} c="#718786" />
    {[-.11, .11].flatMap(x => [-.07, .07].map(z => <mesh key={`${x}:${z}`} position={[.32 + x, .06, -.42 + z]} rotation={[0, 0, Math.PI / 2]}>
      <cylinderGeometry args={[.027, .027, .035, 14]} />
      <meshStandardMaterial color="#35464a" roughness={.55} />
    </mesh>))}
  </group>;
}

function PenlightModel({ active }: { active: boolean }) {
  return <group rotation={[Math.PI / 2, 0, 0]}>
    <mesh>
      <cylinderGeometry args={[.017, .02, .14, 24]} />
      <meshStandardMaterial color="#26373c" metalness={.45} roughness={.32} />
    </mesh>
    <mesh position={[0, -.078, 0]}>
      <cylinderGeometry args={[.024, .019, .026, 24]} />
      <meshStandardMaterial color="#aab9b8" metalness={.55} roughness={.23} />
    </mesh>
    <mesh position={[0, -.093, 0]}>
      <circleGeometry args={[.016, 24]} />
      <meshBasicMaterial color={active ? "#fff2ac" : "#4b6063"} />
    </mesh>
  </group>;
}

function Beam({ penlight, active }: { penlight: React.RefObject<Group | null>; active: boolean }) {
  const cone = useRef<Group>(null);
  const source = useMemo(() => new Vector3(), []);
  const target = useMemo(() => new Vector3(), []);
  const direction = useMemo(() => new Vector3(), []);
  const penlightQuaternion = useMemo(() => new Quaternion(), []);
  const quaternion = useMemo(() => new Quaternion(), []);
  const up = useMemo(() => new Vector3(0, 1, 0), []);
  useFrame(() => {
    if (!cone.current || !penlight.current) return;
    penlight.current.getWorldPosition(source);
    penlight.current.getWorldQuaternion(penlightQuaternion);
    direction.set(0, 0, -1).applyQuaternion(penlightQuaternion).normalize();
    source.addScaledVector(direction, .125);
    target.copy(source).addScaledVector(direction, .72);
    const length = source.distanceTo(target);
    quaternion.setFromUnitVectors(up, direction);
    cone.current.position.copy(source).add(target).multiplyScalar(.5);
    cone.current.quaternion.copy(quaternion);
    cone.current.scale.set(1, length, 1);
  });
  if (!active) return null;
  return <group ref={cone} userData={{ xrIgnoreRay: true }}>
    <mesh>
      <coneGeometry args={[.06, 1, 24, 1, true]} />
      <meshBasicMaterial color="#ffe49a" transparent opacity={.09} side={DoubleSide} depthWrite={false} />
    </mesh>
    <pointLight position={[0, -.5, 0]} color="#fff0a5" intensity={1.2} distance={1.1} />
  </group>;
}

type NativeControllerSlot = {
  hand: Handedness | null;
  inputSource?: XRInputSource;
  ray: Group;
  grip: Group;
  toolTriggerActive: boolean;
};

function controllerAction(raycaster: Raycaster, ray: Object3D, scene: Object3D) {
  const origin = new Vector3();
  const direction = new Vector3(0, 0, -1);
  const quaternion = new Quaternion();
  ray.getWorldPosition(origin);
  ray.getWorldQuaternion(quaternion);
  direction.applyQuaternion(quaternion).normalize();
  raycaster.set(origin, direction);
  const hit = raycaster.intersectObject(scene, true).find(intersection => {
    let object: Object3D | null = intersection.object;
    while (object) {
      if (object.userData.xrIgnoreRay) return false;
      object = object.parent;
    }
    return true;
  });
  let object: Object3D | null = hit?.object ?? null;
  while (object) {
    const action = object.userData.xrAction as (() => void) | undefined;
    if (action) { action(); return; }
    object = object.parent;
  }
}

function SpatialPenlight({ debug, sessionActive, resetToken, seated, fixation, light, onHeld, onLight, onTechnique }: {
  debug: DebugPose | null;
  sessionActive: boolean;
  resetToken: number;
  seated: boolean;
  fixation: boolean;
  light: boolean;
  onHeld: (hand: Handedness | null) => void;
  onLight: (light: boolean) => void;
  onTechnique: (technique: XRHirschbergTechnique) => void;
}) {
  const debugActive = Boolean(debug);
  const group = useRef<Group>(null);
  const heldRef = useRef<Handedness | null>(debugActive ? "right" : null);
  const [held, setHeld] = useState<Handedness | null>(debugActive ? "right" : null);
  const { camera, gl, scene } = useThree();
  const slots = useMemo<NativeControllerSlot[]>(() => [0, 1].map(index => ({
    hand: null,
    ray: gl.xr.getController(index),
    grip: gl.xr.getControllerGrip(index),
    toolTriggerActive: false,
  })), [gl]);
  const [, refreshControllers] = useState(0);
  const raycaster = useMemo(() => new Raycaster(), []);
  const position = useMemo(() => new Vector3(), []);
  const controllerPosition = useMemo(() => new Vector3(), []);
  const viewerPosition = useMemo(() => new Vector3(), []);
  const forward = useMemo(() => new Vector3(0, 0, -1), []);
  const viewerForward = useMemo(() => new Vector3(), []);
  const quaternion = useMemo(() => new Quaternion(), []);
  const last = useRef("");
  const lastReady = useRef(false);
  const target = eyeMidpoint(seated);
  heldRef.current = held;

  const setHeldHand = useCallback((hand: Handedness | null) => {
    heldRef.current = hand;
    setHeld(hand);
    onHeld(hand);
  }, [onHeld]);

  const tryGrab = useCallback((slot: NativeControllerSlot) => {
    if (debug || heldRef.current || !group.current || !slot.hand) return;
    slot.grip.getWorldPosition(controllerPosition);
    group.current.getWorldPosition(position);
    if (controllerPosition.distanceTo(position) > .18) return;
    setHeldHand(slot.hand);
    pulse(slot.inputSource, 55, .55);
  }, [controllerPosition, debug, position, setHeldHand]);

  const release = useCallback((hand: Handedness) => {
    if (heldRef.current !== hand || debug) return;
    setHeldHand(null);
    onLight(false);
  }, [debug, onLight, setHeldHand]);

  useEffect(() => {
    const cleanups = slots.map(slot => {
      const connected = (event: unknown) => {
        const inputSource = (event as { data: XRInputSource }).data;
        slot.inputSource = inputSource;
        slot.hand = inputSource.handedness === "left" || inputSource.handedness === "right" ? inputSource.handedness : null;
        refreshControllers(value => value + 1);
      };
      const disconnected = () => {
        if (heldRef.current === slot.hand) release(slot.hand ?? "right");
        slot.toolTriggerActive = false;
        slot.hand = null;
        slot.inputSource = undefined;
        refreshControllers(value => value + 1);
      };
      const squeezeStart = () => tryGrab(slot);
      const squeezeEnd = () => { if (slot.hand) release(slot.hand); };
      const selectStart = () => {
        slot.toolTriggerActive = heldRef.current === slot.hand;
        if (slot.toolTriggerActive) onLight(true);
      };
      const selectEnd = () => {
        if (slot.toolTriggerActive) {
          slot.toolTriggerActive = false;
          onLight(false);
          return;
        }
        controllerAction(raycaster, slot.ray, scene);
      };
      const ray = slot.ray as Object3D & { addEventListener: (type: string, listener: (event: unknown) => void) => void; removeEventListener: (type: string, listener: (event: unknown) => void) => void };
      ray.addEventListener("connected", connected);
      ray.addEventListener("disconnected", disconnected);
      ray.addEventListener("squeezestart", squeezeStart);
      ray.addEventListener("squeezeend", squeezeEnd);
      ray.addEventListener("selectstart", selectStart);
      ray.addEventListener("selectend", selectEnd);
      return () => {
        ray.removeEventListener("connected", connected);
        ray.removeEventListener("disconnected", disconnected);
        ray.removeEventListener("squeezestart", squeezeStart);
        ray.removeEventListener("squeezeend", squeezeEnd);
        ray.removeEventListener("selectstart", selectStart);
        ray.removeEventListener("selectend", selectEnd);
      };
    });
    return () => cleanups.forEach(cleanup => cleanup());
  }, [onLight, raycaster, release, scene, slots, tryGrab]);

  useEffect(() => {
    setHeldHand(debugActive ? "right" : null);
    if (!debugActive) onLight(false);
  }, [debugActive, onLight, resetToken, setHeldHand]);

  useEffect(() => {
    if (!sessionActive && !debug) {
      setHeldHand(null);
      onLight(false);
    }
  }, [debug, onLight, sessionActive, setHeldHand]);

  useFrame(() => {
    if (!group.current) return;
    const input = slots.find(slot => slot.hand === held);
    if (debug) {
      const targetPosition = target;
      group.current.position.set(targetPosition[0], targetPosition[1], targetPosition[2] + debug.distanceCm / 100);
      forward.set(debug.aimX * .42, debug.aimY * .32, -1).normalize();
      quaternion.setFromUnitVectors(new Vector3(0, 0, -1), forward);
      group.current.quaternion.copy(quaternion);
    } else if (input) {
      input.grip.getWorldPosition(position);
      input.grip.getWorldQuaternion(quaternion);
      forward.set(0, 0, -1).applyQuaternion(quaternion).normalize();
      position.addScaledVector(forward, .09);
      group.current.position.copy(position);
      group.current.quaternion.copy(quaternion);
    } else {
      const tray = trayPosition(seated);
      group.current.position.set(...tray);
      group.current.rotation.set(-.25, 0, -.2);
      forward.set(0, 0, -1).applyQuaternion(group.current.quaternion).normalize();
    }
    group.current.updateMatrixWorld();
    group.current.getWorldPosition(position);
    const activeCamera = sessionActive ? gl.xr.getCamera() : camera;
    activeCamera.getWorldPosition(viewerPosition);
    activeCamera.getWorldDirection(viewerForward);
    const technique = xrHirschbergTechnique({
      penlightPosition: position.toArray() as [number, number, number],
      penlightForward: forward.toArray() as [number, number, number],
      viewerPosition: viewerPosition.toArray() as [number, number, number],
      viewerForward: viewerForward.toArray() as [number, number, number],
      eyeMidpoint: target,
      held: Boolean(held),
      light,
      fixation,
    });
    const signature = [Math.round(technique.distanceCm), Math.round(technique.aimErrorDeg), Math.round(technique.viewErrorDeg), technique.ready, Math.round(technique.quality * 20)].join(":");
    if (signature !== last.current) {
      last.current = signature;
      onTechnique(technique);
    }
    if (technique.ready && !lastReady.current) {
      pulse(input?.inputSource, 75, .7);
    }
    lastReady.current = technique.ready;
  });

  return <>
    {sessionActive && slots.map((slot, index) => <group key={index} userData={{ xrIgnoreRay: true }}>
      <primitive object={slot.grip}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <capsuleGeometry args={[.024, .075, 5, 10]} />
          <meshStandardMaterial color={slot.hand === "left" ? "#6a8fa0" : "#7bb7aa"} roughness={.45} />
        </mesh>
      </primitive>
      <primitive object={slot.ray}>
        <mesh position={[0, 0, -.7]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[.0015, .0015, 1.4, 8]} />
          <meshBasicMaterial color="#8fe0d1" transparent opacity={.48} />
        </mesh>
      </primitive>
    </group>)}
    <group ref={group}><PenlightModel active={light} /></group>
    <Beam penlight={group} active={light} />
  </>;
}

const FOUNDATION_TOOL_IDS = XR_CLINIC_TOOL_IDS as readonly XRVisualToolId[];

function SpatialClinicTools({ debug, debugTool, sessionActive, resetToken, station, seated, fixation, light, onHeld, onHeldTool, onLight, onTechnique }: {
  debug: DebugPose | null;
  debugTool: XRVisualToolId | null;
  sessionActive: boolean;
  resetToken: number;
  station: XRClinicStationId;
  seated: boolean;
  fixation: boolean;
  light: boolean;
  onHeld: (hand: Handedness | null) => void;
  onHeldTool: (tool: XRVisualToolId | null) => void;
  onLight: (light: boolean) => void;
  onTechnique: (technique: XRHirschbergTechnique) => void;
}) {
  const { camera, gl, scene } = useThree();
  const [clinic, setClinic] = useState<XRClinicState>(() => createXRClinicState("entrance"));
  const clinicRef = useRef(clinic);
  clinicRef.current = clinic;
  const toolRefs = useRef<Partial<Record<XRVisualToolId, Group | null>>>({});
  const slots = useMemo<NativeControllerSlot[]>(() => [0, 1].map(index => ({
    hand: null,
    ray: gl.xr.getController(index),
    grip: gl.xr.getControllerGrip(index),
    toolTriggerActive: false,
  })), [gl]);
  const raycaster = useMemo(() => new Raycaster(), []);
  const position = useMemo(() => new Vector3(), []);
  const viewerPosition = useMemo(() => new Vector3(), []);
  const viewerForward = useMemo(() => new Vector3(), []);
  const forward = useMemo(() => new Vector3(0, 0, -1), []);
  const quaternion = useMemo(() => new Quaternion(), []);
  const last = useRef("");
  const lastReady = useRef(false);
  const target = eyeMidpoint(seated);

  const publishHeld = useCallback((state: XRClinicState) => {
    const penlightHand = (["left", "right"] as const).find(hand => toolHeldInHand(state, hand) === "penlight") ?? null;
    const heldTool = (["left", "right"] as const).map(hand => toolHeldInHand(state, hand)).find(Boolean) as XRVisualToolId | undefined;
    onHeld(penlightHand);
    onHeldTool(heldTool ?? null);
    if (!penlightHand) onLight(false);
  }, [onHeld, onHeldTool, onLight]);

  const updateClinic = useCallback((next: XRClinicState) => {
    clinicRef.current = next;
    setClinic(next);
    publishHeld(next);
  }, [publishHeld]);

  useEffect(() => {
    const next = createXRClinicState("entrance");
    updateClinic(next);
  }, [resetToken, updateClinic]);

  useEffect(() => {
    if (!debug) return;
    let next = createXRClinicState("patient-chair");
    if (debugTool) next = pickupTool(next, debugTool, "right").state;
    updateClinic(next);
  }, [debug, debugTool, updateClinic]);

  useEffect(() => {
    if (!sessionActive && !debug) updateClinic(createXRClinicState("entrance"));
  }, [debug, sessionActive, updateClinic]);

  useEffect(() => {
    const next = moveToStation(clinicRef.current, station);
    if (next !== clinicRef.current) updateClinic(next);
  }, [station, updateClinic]);

  useEffect(() => {
    const cleanups = slots.map(slot => {
      const connected = (event: unknown) => {
        const inputSource = (event as { data: XRInputSource }).data;
        slot.inputSource = inputSource;
        slot.hand = inputSource.handedness === "left" || inputSource.handedness === "right" ? inputSource.handedness : null;
      };
      const disconnected = () => {
        const hand = slot.hand;
        if (hand && toolHeldInHand(clinicRef.current, hand)) {
          slot.grip.getWorldPosition(position);
          slot.grip.getWorldQuaternion(quaternion);
          updateClinic(dropHeldTool(clinicRef.current, hand, position.toArray() as [number, number, number], quaternion.toArray() as [number, number, number, number]).state);
        }
        slot.toolTriggerActive = false;
        slot.hand = null;
        slot.inputSource = undefined;
      };
      const squeezeStart = () => {
        if (!sessionActive || !slot.hand || toolHeldInHand(clinicRef.current, slot.hand)) return;
        slot.grip.getWorldPosition(position);
        slot.grip.getWorldQuaternion(quaternion);
        const tool = nearestToolId(clinicRef.current, position.toArray() as [number, number, number], .13);
        if (!tool || !FOUNDATION_TOOL_IDS.includes(tool as XRVisualToolId)) return;
        const transition = pickupTool(clinicRef.current, tool, slot.hand);
        if (transition.changed) {
          updateClinic(transition.state);
          pulse(slot.inputSource, 55, .55);
        }
      };
      const squeezeEnd = () => {
        if (!sessionActive || !slot.hand) return;
        const heldTool = toolHeldInHand(clinicRef.current, slot.hand);
        if (!heldTool) return;
        slot.grip.getWorldPosition(position);
        const home = new Vector3(...toolHomePosition(heldTool));
        const transition = position.distanceTo(home) <= .18
          ? returnHeldTool(clinicRef.current, slot.hand, "instrument-bay")
          : dropHeldTool(clinicRef.current, slot.hand, position.toArray() as [number, number, number], quaternion.toArray() as [number, number, number, number]);
        if (transition.changed) updateClinic(transition.state);
      };
      const selectStart = () => {
        slot.toolTriggerActive = Boolean(slot.hand && toolHeldInHand(clinicRef.current, slot.hand) === "penlight");
        if (slot.toolTriggerActive) onLight(true);
      };
      const selectEnd = () => {
        if (slot.toolTriggerActive) {
          slot.toolTriggerActive = false;
          onLight(false);
        } else controllerAction(raycaster, slot.ray, scene);
      };
      const ray = slot.ray as Object3D & { addEventListener: (type: string, listener: (event: unknown) => void) => void; removeEventListener: (type: string, listener: (event: unknown) => void) => void };
      ray.addEventListener("connected", connected);
      ray.addEventListener("disconnected", disconnected);
      ray.addEventListener("squeezestart", squeezeStart);
      ray.addEventListener("squeezeend", squeezeEnd);
      ray.addEventListener("selectstart", selectStart);
      ray.addEventListener("selectend", selectEnd);
      return () => {
        ray.removeEventListener("connected", connected);
        ray.removeEventListener("disconnected", disconnected);
        ray.removeEventListener("squeezestart", squeezeStart);
        ray.removeEventListener("squeezeend", squeezeEnd);
        ray.removeEventListener("selectstart", selectStart);
        ray.removeEventListener("selectend", selectEnd);
      };
    });
    return () => cleanups.forEach(cleanup => cleanup());
  }, [onLight, position, raycaster, scene, sessionActive, slots, updateClinic]);

  useFrame(() => {
    for (const tool of FOUNDATION_TOOL_IDS) {
      const object = toolRefs.current[tool];
      if (!object) continue;
      const placement = clinicRef.current.tools[tool];
      if (placement.kind === "held") {
        const slot = slots.find(candidate => candidate.hand === placement.hand);
        if (debug && placement.hand === "right") {
          object.position.set(target[0], target[1], target[2] + debug.distanceCm / 100 + .125);
          forward.set(debug.aimX * .42, debug.aimY * .32, -1).normalize();
          quaternion.setFromUnitVectors(new Vector3(0, 0, -1), forward);
          object.quaternion.copy(quaternion);
        } else if (slot) {
          slot.grip.getWorldPosition(position);
          slot.grip.getWorldQuaternion(quaternion);
          object.position.copy(position);
          object.quaternion.copy(quaternion);
        }
      }
      object.updateMatrixWorld();
    }
    const penlight = toolRefs.current.penlight;
    if (!penlight) return;
    penlight.getWorldPosition(position);
    penlight.getWorldQuaternion(quaternion);
    forward.set(0, 0, -1).applyQuaternion(quaternion).normalize();
    position.addScaledVector(forward, .125);
    const activeCamera = sessionActive ? gl.xr.getCamera() : camera;
    activeCamera.getWorldPosition(viewerPosition);
    activeCamera.getWorldDirection(viewerForward);
    const penlightHeld = clinicRef.current.tools.penlight.kind === "held";
    const technique = xrHirschbergTechnique({
      penlightPosition: position.toArray() as [number, number, number],
      penlightForward: forward.toArray() as [number, number, number],
      viewerPosition: viewerPosition.toArray() as [number, number, number],
      viewerForward: viewerForward.toArray() as [number, number, number],
      eyeMidpoint: target,
      held: penlightHeld,
      light,
      fixation,
    });
    const signature = [Math.round(technique.distanceCm), Math.round(technique.aimErrorDeg), Math.round(technique.viewErrorDeg), technique.ready, Math.round(technique.quality * 20)].join(":");
    if (signature !== last.current) {
      last.current = signature;
      onTechnique(technique);
    }
    const penlightPlacement = clinicRef.current.tools.penlight;
    const penlightSlot = penlightPlacement.kind === "held" ? slots.find(slot => slot.hand === penlightPlacement.hand) : undefined;
    if (technique.ready && !lastReady.current) pulse(penlightSlot?.inputSource, 75, .7);
    lastReady.current = technique.ready;
  });

  return <>
    {sessionActive && slots.map((slot, index) => <group key={index} userData={{ xrIgnoreRay: true }}>
      <primitive object={slot.grip}><mesh rotation={[Math.PI / 2, 0, 0]}><capsuleGeometry args={[.024, .075, 5, 10]} /><meshStandardMaterial color={slot.hand === "left" ? "#6a8fa0" : "#7bb7aa"} roughness={.45} /></mesh></primitive>
      <primitive object={slot.ray}><mesh position={[0, 0, -.7]} rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.0015, .0015, 1.4, 8]} /><meshBasicMaterial color="#8fe0d1" transparent opacity={.48} /></mesh></primitive>
    </group>)}
    {FOUNDATION_TOOL_IDS.map(tool => {
      const placement = clinic.tools[tool];
      const staticPosition = placement.kind === "held" ? [0, 0, 0] : toolWorldPosition(clinic, tool) ?? toolHomePosition(tool);
      const socketRotation: [number, number, number] = tool === "penlight" ? [0, 0, 0] : [-Math.PI / 2, 0, 0];
      return <group key={tool} ref={node => { toolRefs.current[tool] = node; }} position={staticPosition as [number, number, number]} rotation={placement.kind === "socket" ? socketRotation : [0, 0, 0]} quaternion={placement.kind === "world" && placement.rotation ? placement.rotation : undefined}>
        <XRClinicToolModel tool={tool} powered={tool === "penlight" && light} />
      </group>;
    })}
    <Beam penlight={{ current: toolRefs.current.penlight ?? null }} active={light && clinic.tools.penlight.kind === "held"} />
  </>;
}

function XRWorld({ scenario, finding, debug, debugTool, sessionActive, resetToken, station, seated, fixation, light, direction, amount, checked, correct, onHeld, onHeldTool, onLight, onTechnique, onStation, onFixation, onDirection, onAmount, onRecord, onNext, onReset, onSeated, onExit }: {
  scenario: OpticScenario;
  finding: Finding;
  debug: DebugPose | null;
  debugTool: XRVisualToolId | null;
  sessionActive: boolean;
  resetToken: number;
  station: XRClinicStationId;
  seated: boolean;
  fixation: boolean;
  light: boolean;
  direction: string;
  amount: string;
  checked: boolean;
  correct: boolean;
  onHeld: (hand: Handedness | null) => void;
  onHeldTool: (tool: XRVisualToolId | null) => void;
  onLight: (light: boolean) => void;
  onTechnique: (technique: XRHirschbergTechnique) => void;
  onStation: (station: XRClinicStationId) => void;
  onFixation: () => void;
  onDirection: () => void;
  onAmount: () => void;
  onRecord: () => void;
  onNext: () => void;
  onReset: () => void;
  onSeated: () => void;
  onExit: () => void;
}) {
  const [technique, setTechnique] = useState<XRHirschbergTechnique>(EMPTY_TECHNIQUE);
  const [held, setHeld] = useState(false);
  const updateTechnique = useCallback((next: XRHirschbergTechnique) => {
    setTechnique(next);
    onTechnique(next);
  }, [onTechnique]);
  const updateHeld = useCallback((hand: Handedness | null) => {
    setHeld(Boolean(hand));
    onHeld(hand);
  }, [onHeld]);
  useEffect(() => {
    setTechnique(EMPTY_TECHNIQUE);
    onTechnique(EMPTY_TECHNIQUE);
  }, [onTechnique, resetToken]);
  const prompt = xrHirschbergPrompt(technique, { held, light, fixation });
  return <>
    <XRStationNavigator station={station} sessionActive={sessionActive} seated={seated} />
    <ConsultingRoomShell />
    <group position={[0, 0, -.8]}>
      <Refraction />
      <SlitLamp />
    </group>
    <XRInstrumentCabinet position={[-1.3, 0, .85]} />
    <XRInstrumentKitSurface position={[-1.3, .96, .85]} />
    <Sign text={["BINOCULAR VISION", "PRACTICE ROOM"]} p={[1.27, 2.18, -2.485]} size={[.9, .34]} />
    <VRPatient scenario={scenario} quality={technique.quality} light={light} seated={seated} />
    <SpatialClinicTools debug={debug} debugTool={debugTool} sessionActive={sessionActive} resetToken={resetToken} station={station} seated={seated} fixation={fixation} light={light} onHeld={updateHeld} onHeldTool={onHeldTool} onLight={onLight} onTechnique={updateTechnique} />
    <ClinicStationTravel station={station} onStation={onStation} />
    <VRControlPanel technique={technique} held={held} light={light} fixation={fixation} direction={direction} amount={amount} checked={checked} correct={correct} seated={seated} prompt={checked && !correct ? "Recheck the reflex direction and landmark." : prompt} onFixation={onFixation} onDirection={onDirection} onAmount={onAmount} onRecord={onRecord} onNext={onNext} onReset={onReset} onSeated={onSeated} onExit={onExit} />
  </>;
}

export function HirschbergLegacyVRStage({ scenario, finding, findingPosition, onClose, onComplete, onNext }: {
  scenario: OpticScenario;
  finding: Finding;
  findingPosition: { current: number; total: number };
  onClose: () => void;
  onComplete: () => void;
  onNext: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const renderer = useRef<WebGLRenderer | null>(null);
  const session = useRef<XRSession | null>(null);
  const completeRef = useRef(false);
  const mounted = useRef(true);
  const startingRef = useRef(false);
  const [support, setSupport] = useState<"checking" | "supported" | "unavailable">("checking");
  const [starting, setStarting] = useState(false);
  const [sessionActive, setSessionActive] = useState(false);
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState("");
  const [seated, setSeated] = useState(false);
  const [fixation, setFixation] = useState(false);
  const [light, setLight] = useState(false);
  const [held, setHeld] = useState<Handedness | null>(null);
  const [heldTool, setHeldTool] = useState<XRVisualToolId | null>(null);
  const [debugTool, setDebugTool] = useState<XRVisualToolId | null>(null);
  const [clinicStation, setClinicStation] = useState<XRClinicStationId>("entrance");
  const [technique, setTechnique] = useState<XRHirschbergTechnique>(EMPTY_TECHNIQUE);
  const [direction, setDirection] = useState("");
  const [amount, setAmount] = useState("");
  const [checked, setChecked] = useState(false);
  const [resetToken, setResetToken] = useState(0);
  const [debugPose, setDebugPose] = useState<DebugPose>({ distanceCm: 40, aimX: .28, aimY: -.18 });
  const correct = direction === finding.direction && amount === finding.amount;
  const live = sessionActive || preview;
  const prompt = xrHirschbergPrompt(technique, { held: Boolean(held), light, fixation });
  const workflowPrompt = heldTool && !HIRSCHBERG_XR_PROCEDURE.requiredToolIds.includes(heldTool)
    ? `${heldTool.replace("-", " ")} is not used for Hirschberg. Return it and identify the penlight.`
    : prompt;
  const directions = ["none", "exotropia", "esotropia", "hypertropia", "hypotropia"];
  const amounts = ["0", "15", "30", "45"];

  useEffect(() => {
    mounted.current = true;
    const node = dialog.current;
    node?.showModal();
    return () => {
      mounted.current = false;
      const activeSession = session.current;
      session.current = null;
      void activeSession?.end();
      node?.close();
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const available = await navigator.xr?.isSessionSupported("immersive-vr");
        if (!cancelled) setSupport(available ? "supported" : "unavailable");
      } catch {
        if (!cancelled) setSupport("unavailable");
      }
    };
    const timer = window.setTimeout(check, 0);
    return () => { cancelled = true; window.clearTimeout(timer); };
  }, []);
  useEffect(() => {
    setFixation(false);
    setLight(false);
    setHeld(null);
    setHeldTool(null);
    setDebugTool(null);
    setClinicStation("entrance");
    setDirection("");
    setAmount("");
    setChecked(false);
    setDebugPose({ distanceCm: 40, aimX: .28, aimY: -.18 });
    setResetToken(value => value + 1);
    completeRef.current = false;
  }, [scenario.id]);

  const reset = useCallback(() => {
    setFixation(false);
    setLight(false);
    setHeld(null);
    setHeldTool(null);
    setDebugTool(null);
    setDirection("");
    setAmount("");
    setChecked(false);
    setDebugPose({ distanceCm: 40, aimX: .28, aimY: -.18 });
    setResetToken(value => value + 1);
  }, []);
  const endAndClose = useCallback(async () => {
    try { await session.current?.end(); } finally { session.current = null; setSessionActive(false); onClose(); }
  }, [onClose]);
  const enterVR = async () => {
    if (startingRef.current || session.current) return;
    startingRef.current = true;
    setStarting(true);
    setError("");
    setPreview(false);
    setClinicStation("entrance");
    reset();
    let next: XRSession | null = null;
    try {
      if (!navigator.xr || !renderer.current) throw new Error("WebXR is not available in this browser.");
      next = await navigator.xr.requestSession("immersive-vr", { requiredFeatures: ["local-floor"] });
      if (!mounted.current) {
        await next.end();
        return;
      }
      session.current = next;
      next.addEventListener("end", () => {
        if (!mounted.current || session.current !== next) return;
        session.current = null;
        setSessionActive(false);
        setLight(false);
        setHeld(null);
        setHeldTool(null);
      }, { once: true });
      renderer.current.xr.setReferenceSpaceType("local-floor");
      await renderer.current.xr.setSession(next);
      renderer.current.xr.setFoveation(.6);
      setSessionActive(true);
    } catch (reason) {
      if (next) {
        if (session.current === next) session.current = null;
        await next.end().catch(() => undefined);
      }
      if (mounted.current) setError(reason instanceof Error ? reason.message : "The VR session could not start.");
    } finally {
      startingRef.current = false;
      if (mounted.current) setStarting(false);
    }
  };
  const cycle = (current: string, values: string[], setter: (value: string) => void) => {
    setter(values[(values.indexOf(current) + 1) % values.length]);
    setChecked(false);
  };
  const record = () => {
    if (!technique.ready || !direction || !amount || (checked && correct)) return;
    setChecked(true);
    if (direction === finding.direction && amount === finding.amount && !completeRef.current) {
      completeRef.current = true;
      onComplete();
    }
  };
  return <dialog ref={dialog} className="clinical-practice-dialog xr-practice-dialog" aria-labelledby="xr-hirschberg-title" onCancel={event => { event.preventDefault(); void endAndClose(); }}>
    <header className="clinical-stage-header">
      <div><p className="eyebrow">EXPERIMENTAL WEBXR · CONTROLLER PRACTICE</p><h1 id="xr-hirschberg-title">Hirschberg test · VR</h1></div>
      <div className="clinical-stage-distance"><span>Finding</span><strong>{findingPosition.current}/{findingPosition.total}</strong></div>
      <button className="secondary" onClick={() => void endAndClose()}><X size={16} /> Close</button>
    </header>
    <div className="xr-practice-body">
      <div
        className="xr-canvas-wrap"
        tabIndex={preview ? 0 : undefined}
        onPointerMove={preview ? event => {
          if (!(event.buttons & 1)) return;
          const rect = event.currentTarget.getBoundingClientRect();
          setDebugPose(value => ({ ...value, aimX: ((event.clientX - rect.left) / rect.width - .5) * 1.2, aimY: (.5 - (event.clientY - rect.top) / rect.height) * .9 }));
        } : undefined}
        onWheel={preview ? event => { event.preventDefault(); setDebugPose(value => ({ ...value, distanceCm: Math.max(30, Math.min(70, value.distanceCm + Math.sign(event.deltaY) * 2)) })); } : undefined}
        onKeyDown={preview ? event => {
          if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", " "].includes(event.key)) event.preventDefault();
          if (event.key === "ArrowLeft") setDebugPose(value => ({ ...value, aimX: value.aimX - .04 }));
          if (event.key === "ArrowRight") setDebugPose(value => ({ ...value, aimX: value.aimX + .04 }));
          if (event.key === "ArrowUp") setDebugPose(value => ({ ...value, aimY: value.aimY + .04 }));
          if (event.key === "ArrowDown") setDebugPose(value => ({ ...value, aimY: value.aimY - .04 }));
          if (event.key === "PageUp") setDebugPose(value => ({ ...value, distanceCm: Math.max(30, value.distanceCm - 2) }));
          if (event.key === "PageDown") setDebugPose(value => ({ ...value, distanceCm: Math.min(70, value.distanceCm + 2) }));
          if (event.key === " " && !event.repeat) setLight(true);
        } : undefined}
        onKeyUp={preview ? event => { if (event.key === " ") { event.preventDefault(); setLight(false); } } : undefined}
        onBlur={preview ? () => setLight(false) : undefined}
      >
        <Canvas shadows dpr={[1, 1.35]} camera={{ position: [0, 1.6, .2], fov: 58 }} gl={{ antialias: true }} onCreated={({ gl }) => { gl.xr.enabled = true; gl.toneMappingExposure = 1.02; renderer.current = gl; }} fallback={<PracticeWebGLFallback />}>
          <XRWorld scenario={scenario} finding={finding} debug={preview ? debugPose : null} debugTool={debugTool} sessionActive={sessionActive} resetToken={resetToken} station={clinicStation} seated={seated} fixation={fixation} light={light} direction={direction} amount={amount} checked={checked} correct={checked && correct} onHeld={setHeld} onHeldTool={setHeldTool} onLight={setLight} onTechnique={setTechnique} onStation={setClinicStation} onFixation={() => setFixation(true)} onDirection={() => cycle(direction, directions, setDirection)} onAmount={() => cycle(amount, amounts, setAmount)} onRecord={record} onNext={onNext} onReset={reset} onSeated={() => { setSeated(value => !value); reset(); }} onExit={() => void endAndClose()} />
        </Canvas>
        {!live && <div className="xr-preflight">
          <Glasses size={34} />
          <div><p className="eyebrow">QUEST / WEBXR VERTICAL SLICE</p><h2>Controller-based Hirschberg practice</h2><p>Use both tracked controllers in Quest Browser. Grip the penlight, hold the trigger for illumination, move physically to the working distance, and record from the floating panel.</p></div>
          <div className="xr-preflight-actions">
            <button className="primary" disabled={support !== "supported" || starting} onClick={() => void enterVR()}>{starting ? "Starting VR…" : support === "checking" ? "Checking headset…" : support === "supported" ? "Enter VR" : "VR headset unavailable"} <Glasses size={17} /></button>
            <button className="secondary" onClick={() => { setClinicStation("entrance"); reset(); setPreview(true); }}>Preview clinic foundation</button>
          </div>
          <p className="small">Quest Browser requires HTTPS for deployed use. The local preview emulates controller logic; it cannot validate comfort, scale, tracking, or haptics.</p>
          {error && <p className="notice" role="alert">{error}</p>}
        </div>}
        {preview && <p className="viewport-controls">Drag to aim · wheel/Page Up/Page Down changes controller distance · Space holds trigger</p>}
      </div>
      {live && <aside className="xr-mirror-panel" aria-label="VR practice controls">
        <p className="eyebrow">LIVE TECHNIQUE MIRROR</p>
        <div className="xr-station-controls"><span>{XR_CLINIC_STATIONS[clinicStation].label}</span><button onClick={() => setClinicStation("instrument-bay")}>Instrument bay</button><button onClick={() => setClinicStation("patient-chair")}>Patient</button></div>
        <div className="xr-technique-grid"><span className={held ? "ready" : ""}>{heldTool ? `${heldTool.replace("-", " ")} held` : "No tool held"}</span><span className={light ? "ready" : ""}>Light {light ? "on" : "off"}</span><span className={fixation ? "ready" : ""}>Fixation {fixation ? "given" : "needed"}</span><span className={technique.distanceReady ? "ready" : ""}>{Math.round(technique.distanceCm)} cm</span><span className={technique.aimReady ? "ready" : ""}>Aim {technique.aimReady ? "aligned" : "adjust"}</span><span className={technique.viewReady ? "ready" : ""}>View {technique.viewReady ? "aligned" : "adjust"}</span></div>
        {preview && <div className="xr-debug-tools" aria-label="Instrument kit preview"><p className="small">Choose an instrument from the kit:</p>{FOUNDATION_TOOL_IDS.map(tool => <button key={tool} className={debugTool === tool ? "selected" : ""} onClick={() => { setDebugTool(tool); setLight(false); }}>{tool.replace("-", " ")}</button>)}<button onClick={() => { setDebugTool(null); setLight(false); }}>Return tool</button></div>}
        <p role="status">{checked ? correct ? finding.feedback : "Recheck the reflex position, direction rule, and landmark." : workflowPrompt}</p>
        <button className={`task-button ${fixation ? "done" : ""}`} onClick={() => setFixation(true)}><Check size={17} /> Give fixation instruction</button>
        <label>Interpretation<select disabled={!technique.ready || (checked && correct)} value={direction} onChange={event => { setDirection(event.target.value); setChecked(false); }}><option value="">Choose</option>{directions.map(value => <option key={value} value={value}>{value === "none" ? "No manifest deviation" : value}</option>)}</select></label>
        <label>Landmark<select disabled={!technique.ready || (checked && correct)} value={amount} onChange={event => { setAmount(event.target.value); setChecked(false); }}><option value="">Choose</option>{amounts.map(value => <option key={value} value={value}>{value === "0" ? "Centred · 0°" : `${value}° landmark`}</option>)}</select></label>
        <button className="primary full" disabled={!technique.ready || !direction || !amount || (checked && correct)} onClick={record}>Record interpretation</button>
        {checked && <p className={correct ? "neutral-message success" : "neutral-message"}>{correct ? finding.feedback : "Recheck the reflex position."}</p>}
        {checked && correct && <button className="secondary full" onClick={onNext}>New patient finding</button>}
        <div className="xr-secondary-actions"><button onClick={() => { setSeated(value => !value); reset(); }}>{seated ? "Standing setup" : "Seated setup"}</button><button onClick={reset}><RotateCcw size={15} /> Reset</button></div>
        <p className="small"><Power size={13} /> Trigger operates the light. Grip picks up and releasing returns the penlight to its tray.</p>
      </aside>}
    </div>
  </dialog>;
}
