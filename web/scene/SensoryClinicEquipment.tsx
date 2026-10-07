import { CatmullRomCurve3, DoubleSide, Vector2, Vector3 } from "three";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { CLINIC_EYE_MIDPOINT } from "../interaction/clinicPatient";
import type { Group } from "three";
import { Box, Cylinder } from "./Models";
import { XRSign as Sign } from "./XRClinicPanels";
import {
  SENSORY_DISTANCE_TARGET, SENSORY_MIRROR, SENSORY_NEAR_TARGET, SENSORY_SOCKETS, sensoryMirrorPath,
} from "../interaction/xrSensoryEquipment";
import { type ConsultationToolId } from "../interaction/xrConsultationTools";
import type { XRClinicRuntime } from "../interaction/useXRClinicRuntime";

/** Original metre-scale geometry; the physical Worth target always displays the same four dots. */
export function WorthTargetFace({ powered = true, point = false, mirror = false }: { powered?: boolean; point?: boolean; mirror?: boolean }) {
  const faceZ = mirror ? .001 : -.001;
  return <group userData={{ xrWorthFace: mirror ? "mirror" : "physical" }}>
    <mesh><circleGeometry args={[.06, 32]} /><meshBasicMaterial color="#101c20" side={DoubleSide} /></mesh>
    {point && <mesh position={[0, 0, faceZ * 2]} userData={{ xrWorthDot: true }}><circleGeometry args={[.009, 24]} /><meshBasicMaterial color={powered ? "#f4f2dc" : "#394548"} side={DoubleSide} /></mesh>}
    {!point && ([
      [0, .031, "#ee4242"], [-.026, 0, "#36c36f"], [.026, 0, "#36c36f"], [0, -.031, "#f4f2dc"],
    ] as const).map(([x, y, color], index) => <mesh key={index} position={[x, y, faceZ]} userData={{ xrWorthDot: true }}>
      <circleGeometry args={[.009, 20]} /><meshBasicMaterial color={powered ? color : "#394548"} side={DoubleSide} />
    </mesh>)}
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
        <meshPhysicalMaterial color={redGreen ? index === 0 ? "#d83d4b" : "#35b773" : "#9fded7"} roughness={.14}
          transmission={.32} thickness={.01} transparent opacity={redGreen ? .74 : .62} side={DoubleSide} />
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
    {/* Lesson-owned page stacks and selectable circles remain immediately outside this model. */}
  </group>;
}

export function SensoryInstrumentModel({ id, powered, point }: { id: ConsultationToolId; powered: boolean; point?: boolean }) {
  if (id === "worth") return <group>
    <SensoryGrip />
    <Box p={[0, .12, 0]} s={[.135, .135, .024]} c="#24383b" radius={.042} />
    <group position={[0, .12, -.012]}><WorthTargetFace powered={powered} point={point} /></group>
    <mesh position={[.045, .04, -.017]} rotation={[0, 0, Math.PI / 2]}>
      <capsuleGeometry args={[.006, .014, 5, 14]} />
      <meshStandardMaterial color={powered ? "#d39b42" : "#4c5f5e"} roughness={.42} metalness={.42} />
    </mesh>
  </group>;
  if (id === "stereo") return <StereoBooklet />;
  return <SensoryGlasses redGreen={id === "red-green"} />;
}

/** Lightweight illustrative virtual image; one physical target retains all ownership. */
function MirrorDisplay({ runtime, letter }: { runtime: XRClinicRuntime; letter: boolean }) {
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
  return <group ref={image} visible={false} userData={{ xrIgnoreRay: true }}><WorthTargetFace mirror point={runtime.equipment.includes("maddox")} /></group>;
}
export function SensoryClinicStation({ runtime, distanceLetter = false, active = false }: { runtime: XRClinicRuntime; distanceLetter?: boolean; active?: boolean }) {
  const sensory = runtime.equipment.some(id => ["worth", "red-green", "polarised", "stereo"].includes(id));
  if (!sensory && !distanceLetter) return null;
  const near = runtime.equipment.some(id => id === "worth" || id === "stereo");
  return <>
    {sensory && <group userData={{ xrIgnoreRay: true }}>
      <Box p={[1.31, .85, 1.04]} s={[.92, .06, .52]} c="#d9e1d9" radius={.02} />
      <Cylinder p={[1.31, .43, 1.04]} h={.82} radius={.045} c="#9bafaa" />
      <Box p={[1.31, .02, 1.04]} s={[.65, .03, .40]} c="#8ca39f" />
      <Sign text={["SENSORY EQUIPMENT"]} p={[1.31, .73, 1.31]} size={[.62, .065]} bg="#173a3e" fg="#e8fff9" />
    </group>}
    {near && <group userData={{ xrIgnoreRay: true }}>
      <Cylinder p={[.26, .70, SENSORY_NEAR_TARGET[2]]} h={1.37} radius={.012} c="#768e8c" />
      <Box p={[.13, 1.31, SENSORY_NEAR_TARGET[2] + .017]} s={[.28, .018, .065]} c="#78948e" />
      <Box p={[.26, .025, SENSORY_NEAR_TARGET[2]]} s={[.22, .035, .22]} c="#78948e" />
      <Sign text={["NEAR STAND · 40 CM", "ASSISTED PLACEMENT"]} p={[.29, 1.19, SENSORY_NEAR_TARGET[2] + .025]} size={[.24, .08]} bg="#173a3e" fg="#e8fff9" />
    </group>}
    {runtime.equipment.includes("worth") || distanceLetter ? <group>
      <group userData={{ xrIgnoreRay: true }}>
        <Box p={[...SENSORY_MIRROR.center]} s={[SENSORY_MIRROR.width + .05, SENSORY_MIRROR.height + .05, .035]} c="#375f63" />
        <Box p={[SENSORY_MIRROR.center[0], SENSORY_MIRROR.center[1], SENSORY_MIRROR.center[2] - .019]} s={[SENSORY_MIRROR.width, SENSORY_MIRROR.height, .006]} c="#b2ced0" />
        <Sign text={["SIMULATED MIRRORED 6 M PATH", "ILLUSTRATIVE · NOT CALIBRATED OPTICS"]} p={[.32, 1.08, 2.274]} rotation={[0, Math.PI, 0]} size={[.9, .12]} bg="#173a3e" fg="#e8fff9" />
        <MirrorDisplay runtime={runtime} letter={distanceLetter} />
        {runtime.equipment.includes("worth") && <>
          <Cylinder p={[SENSORY_DISTANCE_TARGET[0], .68, SENSORY_DISTANCE_TARGET[2]]} h={1.3} radius={.012} c="#768e8c" />
          <Box p={[SENSORY_DISTANCE_TARGET[0], 1.35, SENSORY_DISTANCE_TARGET[2] - .015]} s={[.16, .02, .10]} c="#456e69" />
          <Sign text={["WORTH DISTANCE DOCK", "FACE TARGET TOWARD MIRROR"]} p={[.68, 1.2, SENSORY_DISTANCE_TARGET[2] + .04]} size={[.29, .08]} bg="#173a3e" fg="#e8fff9" />
        </>}
      </group>
    </group> : null}
    {([[0, .25, "PATIENT FITTING"], [.65, -.16, "DISTANCE DOCK"]] as const).filter(([, , label]) => label !== "DISTANCE DOCK" || runtime.equipment.includes("worth")).map(([x, z, label]) => <group key={label} position={[x, .012, z]} userData={active ? { xrTeleport: [x, 0, z] } : { xrPreviewPad: true }}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.14, .20, 32]} /><meshBasicMaterial color="#4fae9d" transparent opacity={.65} /></mesh>
      <Sign text={[label]} p={[0, .008, 0]} size={[.32, .07]} rotation={[-Math.PI / 2, 0, 0]} bg="#153b3c" fg="#e8fff9" />
    </group>)}
    {/* Fitting cues retain a small bridge/grip target and never reveal the authored finding. */}
    {SENSORY_SOCKETS.filter(socket => socket.fittingLayer && runtime.equipment.includes(socket.tool)).map(socket => <group key={socket.id} position={[...socket.position]} userData={{ xrIgnoreRay: true }}>
      <mesh><ringGeometry args={[.009, .012, 20]} /><meshBasicMaterial color={socket.fittingLayer === "correction" ? "#f1da96" : "#8bcaba"} transparent opacity={.45} side={DoubleSide} /></mesh>
    </group>)}
    {sensory && <group position={[.65, .012, 1.65]} userData={active ? { xrTeleport: [.65, 0, 1.65] } : { xrPreviewPad: true }}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.19, .26, 32]} /><meshBasicMaterial color="#4fae9d" transparent opacity={.65} /></mesh>
      <Sign text={["SENSORY KIT"]} p={[0, .008, 0]} size={[.33, .08]} rotation={[-Math.PI / 2, 0, 0]} bg="#153b3c" fg="#e8fff9" />
    </group>}
  </>;
}
