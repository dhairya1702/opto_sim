import { XRTeleportRing } from "./XRTeleportRing";
import { CatmullRomCurve3, DoubleSide, Vector2, Vector3 } from "three";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { CLINIC_EYE_MIDPOINT } from "../interaction/clinicPatient";
import type { Group } from "three";
import { Box, Cylinder } from "./Models";
import { XRLabelPill, XRSign as Sign } from "./XRClinicPanels";
import {
  SENSORY_DISTANCE_TARGET, SENSORY_MIRROR, SENSORY_NEAR_TARGET, SENSORY_SOCKETS, sensoryMirrorPath,
} from "../interaction/xrSensoryEquipment";
import { type ConsultationToolId } from "../interaction/xrConsultationTools";
import type { XRClinicRuntime } from "../interaction/useXRClinicRuntime";

/** Original metre-scale geometry; the physical Worth target always displays the same four dots. */
export function WorthTargetFace({ powered = true, point = false, fixationLetter = false, mirror = false, face = mirror ? "mirror" : "front" }: { powered?: boolean; point?: boolean; fixationLetter?: boolean; mirror?: boolean; face?: "front" | "back" | "mirror" }) {
  const faceZ = mirror ? .001 : -.001;
  return <group userData={{ xrWorthFace: face }}>
    <mesh><circleGeometry args={[.06, 32]} /><meshBasicMaterial color="#101c20" side={DoubleSide} /></mesh>
    {fixationLetter && <Sign text={["E"]} p={[0, 0, faceZ * 2]} size={[.072, .072]} bg={powered ? "#f4f2dc" : "#394548"} fg="#162d2c" />}
    {!fixationLetter && point && <mesh position={[0, 0, faceZ * 2]} userData={{ xrWorthDot: true }}><circleGeometry args={[.009, 24]} /><meshBasicMaterial color={powered ? "#f4f2dc" : "#394548"} side={DoubleSide} /></mesh>}
    {!fixationLetter && !point && ([
      [0, .031, "#ee4242"], [-.026, 0, "#36c36f"], [.026, 0, "#36c36f"], [0, -.031, "#f4f2dc"],
    ] as const).map(([x, y, color], index) => <mesh key={index} position={[x, y, faceZ]} userData={{ xrWorthDot: true }}>
      <circleGeometry args={[.009, 20]} /><meshBasicMaterial color={powered ? color : "#394548"} side={DoubleSide} />
    </mesh>)}
  </group>;
}

function WorthPowerSwitch({ powered, face, onPowerChange, highlight = false }: { powered: boolean; face: "front" | "back"; onPowerChange?: (powered: boolean) => void; highlight?: boolean }) {
  const outward = face === "front" ? -1 : 1;
  const interactive = onPowerChange ? {
    xrInstrumentControl: "worth", xrInteractiveSurface: true, xrButton: true, xrWidth: .052, xrHeight: .078,
    xrLabel: powered ? "TARGET POWER ON" : "TARGET POWER OFF", xrWorthSwitchFace: face, xrAction: () => onPowerChange(!powered),
  } : undefined;
  const toggle = onPowerChange ? (event: { stopPropagation: () => void }) => { event.stopPropagation(); onPowerChange(!powered); } : undefined;
  return <group position={[.079, .12, outward * .017]} userData={interactive} onClick={toggle}>
    <mesh>
      <boxGeometry args={[.040, .060, .008]} />
      <meshStandardMaterial color="#f1c35e" emissive="#5b3d08" emissiveIntensity={.18} roughness={.44} metalness={.18} />
    </mesh>
    <XRLabelPill label="POWER" position={[0, .016, outward * .006]} rotation={[0, face === "front" ? Math.PI : 0, 0]}
      width={.035} height={.015} background="#173a3e" foreground="#fff7d8" />
    <mesh position={[0, -.010, outward * .008]} rotation={[Math.PI / 2, 0, 0]}>
      <cylinderGeometry args={[.011, .011, .010, 28]} />
      <meshStandardMaterial color={powered ? "#5ee0a8" : "#df665c"} emissive={powered ? "#176b50" : "#6e211d"} emissiveIntensity={.65} roughness={.32} metalness={.24} />
    </mesh>
    <XRLabelPill label={powered ? "ON" : "OFF"} position={[0, -.025, outward * .006]} rotation={[0, face === "front" ? Math.PI : 0, 0]}
      width={.030} height={.013} background={powered ? "#176b50" : "#762f2b"} foreground="#ffffff" />
    {highlight && <mesh position={[0, 0, outward * .014]} userData={{ xrInstructionalHighlight: true }} renderOrder={1160}>
      <ringGeometry args={[.032, .039, 36]} />
      <meshBasicMaterial color="#fff19a" side={DoubleSide} depthTest={false} depthWrite={false} />
    </mesh>}
  </group>;
}

const sensoryGripProfile = [
  new Vector2(.0105, -.05), new Vector2(.013, -.043), new Vector2(.012, 0),
  new Vector2(.013, .038), new Vector2(.015, .05),
];

function SensoryGrip({ position = [0, 0, 0] }: { position?: [number, number, number] }) {
  return <group position={position}>
    <mesh castShadow receiveShadow>
      <latheGeometry args={[sensoryGripProfile, 28]} />
      <meshStandardMaterial color="#17383a" roughness={.73} metalness={.02} />
    </mesh>
    {[-.024, -.012, 0, .012, .024].map(y => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[.0114, .001, 5, 24]} />
      <meshStandardMaterial color="#4c5f5e" roughness={.36} metalness={.54} />
    </mesh>)}
  </group>;
}

function SensoryGlasses({ redGreen }: { redGreen: boolean }) {
  const bridge = new CatmullRomCurve3([
    new Vector3(-.014, .007, 0), new Vector3(0, .017, .004), new Vector3(.014, .007, 0),
  ]);
  return <group>
    {([-.048, .048] as const).map((x, index) => <group key={x} position={[x, 0, 0]}>
      <mesh castShadow><torusGeometry args={[.038, .006, 10, 36]} /><meshStandardMaterial color="#24383b" roughness={.54} metalness={.11} /></mesh>
      <mesh position={[0, 0, -.006]} castShadow><torusGeometry args={[.032, .002, 8, 32]} /><meshStandardMaterial color="#a8b6b0" roughness={.30} metalness={.72} /></mesh>
      <mesh position={[0, 0, -.004]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[.031, .031, .007, 36]} />
        <meshStandardMaterial color={redGreen ? index === 0 ? "#d83d4b" : "#35b773" : "#9fded7"} roughness={.14} transparent opacity={redGreen ? .74 : .62} side={DoubleSide} />
      </mesh>
      <mesh position={[0, .046, 0]}><capsuleGeometry args={[.006, .006, 4, 12]} /><meshStandardMaterial color="#d39b42" roughness={.42} metalness={.42} /></mesh>
    </group>)}
    <mesh castShadow><tubeGeometry args={[bridge, 16, .004, 10, false]} /><meshStandardMaterial color="#a8b6b0" roughness={.30} metalness={.72} /></mesh>
    {([-1, 1] as const).map(side => <mesh key={side} position={[side * .109, 0, -.075]} rotation={[Math.PI / 2, 0, side * -.10]} castShadow>
      <cylinderGeometry args={[.004, .004, .17, 20]} />
      <meshStandardMaterial color="#4c5f5e" roughness={.36} metalness={.54} />
    </mesh>)}
  </group>;
}

function StereoBooklet() {
  return <group>
    <SensoryGrip position={[0, -.025, 0]} />
    {([-1, 1] as const).map(side => <group key={side}>
      <Box p={[side * .058, .08, 0]} s={[.116, .17, .009]} c="#f3f0df" radius={.010} />
      <Box p={[side * .058, .146, -.005]} s={[.094, .004, .001]} c="#3f827a" radius={.001} />
    </group>)}
    <Cylinder p={[0, .08, -.003]} h={.17} radius={.004} c="#4c5f5e" />
    {/* Lesson-owned page stacks and examiner reference circles remain immediately outside this model. */}
  </group>;
}

/** Fixed-power teaching prism. Local +X is the physical base axis used by the procedure engine. */
function FourDioptrePrism({ base = "right" }: { base?: string }) {
  const left = base === "left";
  return <group userData={{ xrFourPrism: true, xrPrismPower: 4, xrPrismBaseAxis: [left ? -1 : 1, 0, 0] }}>
    <SensoryGrip position={[0, -.005, 0]} />
    <group position={[0, .10, 0]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.044, .044, .018, 40]} /><meshStandardMaterial color="#b9e8e1" transparent opacity={.62} roughness={.12} /></mesh>
      <mesh position={[0, 0, -.011]}><torusGeometry args={[.035, .004, 10, 40]} /><meshStandardMaterial color="#d8a94f" metalness={.35} roughness={.35} /></mesh>
      <mesh position={[left ? -.052 : .052, 0, 0]} rotation={[0, 0, left ? Math.PI / 2 : -Math.PI / 2]}><coneGeometry args={[.012, .035, 3]} /><meshStandardMaterial color="#f1c35e" /></mesh>
      <XRLabelPill label={left ? "← BASE · 4Δ" : "4Δ · BASE →"} position={[0, -.058, .013]} width={.10} height={.026} />
    </group>
  </group>;
}

export function SensoryInstrumentModel({ id, powered, point, fixationLetter, base, onPowerChange, highlightPowerSwitch = false }: { id: ConsultationToolId; powered: boolean; point?: boolean; fixationLetter?: boolean; base?: string; onPowerChange?: (powered: boolean) => void; highlightPowerSwitch?: boolean }) {
  if (id === "worth") return <group>
    <SensoryGrip />
    <Box p={[0, .12, 0]} s={[.135, .135, .024]} c="#24383b" radius={.042} />
    <group position={[0, .12, -.012]}><WorthTargetFace powered={powered} point={point} fixationLetter={fixationLetter} face="front" /></group>
    <group position={[0, .12, .012]} rotation={[0, Math.PI, 0]}><WorthTargetFace powered={powered} point={point} fixationLetter={fixationLetter} face="back" /></group>
    <WorthPowerSwitch powered={powered} face="front" onPowerChange={onPowerChange} highlight={highlightPowerSwitch} />
    <WorthPowerSwitch powered={powered} face="back" onPowerChange={onPowerChange} highlight={highlightPowerSwitch} />
  </group>;
  if (id === "stereo") return <StereoBooklet />;
  if (id === "four-prism") return <FourDioptrePrism base={base} />;
  return <SensoryGlasses redGreen={id === "red-green"} />;
}

/** Lightweight illustrative virtual image; one physical target retains all ownership. */
function MirrorDisplay({ runtime, letter, fixationLetter = false }: { runtime: XRClinicRuntime; letter: boolean; fixationLetter?: boolean }) {
  const image = useRef<Group>(null);

  useFrame(() => {
    if (!image.current || letter) return;
    const pose = runtime.supportedWorkingPose("worth", true);
    const placement = runtime.toolsRef.current.worth.placement;
    const path = pose ? sensoryMirrorPath(pose.position) : null;
    const docked = placement.kind === "socket" && placement.socketId === "sensory-worth-distance";
    image.current.visible = Boolean(pose && path?.valid && docked && runtime.toolsRef.current.worth.powered);
    if (!pose || !path?.valid) return;
    // Project the virtual target onto the mirror plane along the patient's reflected sightline.
    image.current.position.set(path.intersection[0], path.intersection[1], SENSORY_MIRROR.center[2] - .027);
    image.current.scale.setScalar(Math.hypot(...SENSORY_MIRROR.center.map((v, i) => v - CLINIC_EYE_MIDPOINT[i])) / (path.distanceCm / 100));
    image.current.rotation.set(0, Math.PI, 0);
  });
  if (letter) return <Sign text={["E", "ILLUSTRATIVE ISOLATED LETTER"]} p={[.31, 1.5, SENSORY_MIRROR.center[2] - .027]} rotation={[0, Math.PI, 0]} size={[.28, .22]} bg="#f7f7e8" fg="#183335" />;
  return <group ref={image} visible={false} userData={{ xrIgnoreRay: true }}><WorthTargetFace mirror point={runtime.equipment.includes("maddox")} fixationLetter={fixationLetter} /></group>;
}
export function SensoryClinicStation({ runtime, distanceLetter = false, fixationLetter = false, active = false, showFittingGuides = true }: { runtime: XRClinicRuntime; distanceLetter?: boolean; fixationLetter?: boolean; active?: boolean; showFittingGuides?: boolean }) {
  const sensory = runtime.equipment.some(id => ["worth", "red-green", "polarised", "stereo", "four-prism"].includes(id));
  if (!sensory && !distanceLetter) return null;
  const near = runtime.equipment.some(id => id === "worth" || id === "stereo");
  return <>
    {near && <group userData={{ xrIgnoreRay: true }}>
      <Cylinder p={[.26, .70, SENSORY_NEAR_TARGET[2]]} h={1.37} radius={.012} c="#768e8c" />
      <Box p={[.13, 1.31, SENSORY_NEAR_TARGET[2] + .017]} s={[.28, .018, .065]} c="#78948e" />
      <Box p={[.26, .025, SENSORY_NEAR_TARGET[2]]} s={[.22, .035, .22]} c="#78948e" />
      <Sign transparentBackground text={["NEAR STAND"]} p={[.29, 1.19, SENSORY_NEAR_TARGET[2] + .025]} size={[.24, .0375]} fg="#e8fff9" />
    </group>}
    {runtime.equipment.includes("worth") || distanceLetter ? <group>
      <group userData={{ xrIgnoreRay: true }}>
        <Box p={[...SENSORY_MIRROR.center]} s={[SENSORY_MIRROR.width + .05, SENSORY_MIRROR.height + .05, .035]} c="#375f63" />
        <Box p={[SENSORY_MIRROR.center[0], SENSORY_MIRROR.center[1], SENSORY_MIRROR.center[2] - .019]} s={[SENSORY_MIRROR.width, SENSORY_MIRROR.height, .006]} c="#b2ced0" />
        <Sign text={["SIMULATED MIRRORED 6 M PATH", "ILLUSTRATIVE · NOT CALIBRATED OPTICS"]} p={[.32, 1.08, 2.274]} rotation={[0, Math.PI, 0]} size={[.9, .12]} bg="#173a3e" fg="#e8fff9" />
        <MirrorDisplay runtime={runtime} letter={distanceLetter} fixationLetter={fixationLetter} />
        {runtime.equipment.includes("worth") && <>
          <Cylinder p={[SENSORY_DISTANCE_TARGET[0], .68, SENSORY_DISTANCE_TARGET[2]]} h={1.3} radius={.012} c="#768e8c" />
          <Box p={[SENSORY_DISTANCE_TARGET[0], 1.35, SENSORY_DISTANCE_TARGET[2] - .015]} s={[.16, .02, .10]} c="#456e69" />
          <Sign transparentBackground text={["DISTANCE TARGET DOCK"]} p={[.68, 1.2, SENSORY_DISTANCE_TARGET[2] + .04]} size={[.345, .045]} fg="#e8fff9" />
        </>}
      </group>
    </group> : null}
    {([[0, .25, "PATIENT FITTING"], [.65, -.16, "DISTANCE TARGET DOCK"]] as const).filter(([, , label]) => label !== "DISTANCE TARGET DOCK" || runtime.equipment.includes("worth")).map(([x, z, label]) => <group key={label} position={[x, .012, z]} userData={active ? { xrTeleport: [x, 0, z] } : { xrPreviewPad: true }}>
      <XRTeleportRing innerRadius={.14} outerRadius={.20} opacity={.65} />
    </group>)}
    {/* Fitting cues retain a small bridge/grip target and never reveal the authored finding. */}
    {showFittingGuides && SENSORY_SOCKETS.filter(socket => socket.fittingLayer && runtime.equipment.includes(socket.tool)).map(socket => <group key={socket.id} position={[...socket.position]} userData={{ xrIgnoreRay: true, xrInstructionalHighlight: true }}>
      <mesh><ringGeometry args={[.009, .012, 20]} /><meshBasicMaterial color={socket.fittingLayer === "correction" ? "#f1da96" : "#8bcaba"} transparent opacity={.45} side={DoubleSide} /></mesh>
    </group>)}
  </>;
}
