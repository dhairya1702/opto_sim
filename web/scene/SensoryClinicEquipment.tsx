import { DoubleSide } from "three";
import { useFrame } from "@react-three/fiber";
import { useRef } from "react";
import { CLINIC_EYE_MIDPOINT } from "../interaction/clinicPatient";
import type { Group } from "three";
import { Box, Cylinder, Ring } from "./Models";
import { XRSign as Sign } from "./XRClinicPanels";
import {
  SENSORY_DISTANCE_TARGET, SENSORY_MIRROR, SENSORY_NEAR_TARGET, SENSORY_SOCKETS, sensoryMirrorPath,
} from "../interaction/xrSensoryEquipment";
import { type ConsultationToolId } from "../interaction/xrConsultationTools";
import type { XRClinicRuntime } from "../interaction/useXRClinicRuntime";

/** Original metre-scale geometry; the physical Worth target always displays the same four dots. */
export function WorthTargetFace({ powered = true, point = false }: { powered?: boolean; point?: boolean }) {
  return <group>
    <mesh><circleGeometry args={[.06, 32]} /><meshBasicMaterial color="#101c20" side={DoubleSide} /></mesh>
    {point && <mesh position={[0, 0, -.002]}><circleGeometry args={[.009, 24]} /><meshBasicMaterial color={powered ? "#f4f2dc" : "#394548"} side={DoubleSide} /></mesh>}
    {!point && ([
      [0, .031, "#ee4242"], [-.026, 0, "#36c36f"], [.026, 0, "#36c36f"], [0, -.031, "#f4f2dc"],
    ] as const).map(([x, y, color], index) => <mesh key={index} position={[x, y, -.001]}>
      <circleGeometry args={[.009, 20]} /><meshBasicMaterial color={powered ? color : "#394548"} side={DoubleSide} />
    </mesh>)}
  </group>;
}
export function SensoryInstrumentModel({ id, powered, point }: { id: ConsultationToolId; powered: boolean; point?: boolean }) {
  if (id === "worth") return <group>
    <Cylinder h={.11} radius={.012} c="#69817e" />
    <group position={[0, .12, -.012]}><WorthTargetFace powered={powered} point={point} /></group>
    <Sign text={[powered ? "ON" : "OFF"]} p={[0, .04, .018]} size={[.045, .024]} bg="#173a3e" fg="#e8fff9" />
  </group>;
  if (id === "stereo") return <group>
    <Cylinder h={.06} radius={.012} c="#708f8b" />
    <Box p={[0, .08, 0]} s={[.22, .15, .01]} c="#ececdf" radius={.008} />
    {/* Page and ray-selectable circle overlay supplied by the lesson in local XY at z=-.008. */}
    <Box p={[-.106, .08, -.001]} s={[.008, .15, .012]} c="#617b78" />
  </group>;
  const redGreen = id === "red-green";
  return <group>
    {([-.048, .048] as const).map((x, index) => <group key={x} position={[x, 0, 0]}>
      <Ring p={[0, 0, 0]} radius={.036} c="#303f46" />
      <mesh><circleGeometry args={[.033, 24]} /><meshBasicMaterial color={redGreen ? index === 0 ? "#de3333" : "#26a965" : "#729498"} transparent opacity={.35} side={DoubleSide} /></mesh>
    </group>)}
    <Box p={[0, .009, 0]} s={[.035, .009, .012]} c="#607a80" />
    <Cylinder p={[-.102, 0, -.065]} h={.13} radius={.004} r={[Math.PI / 2, 0, 0]} c="#4a656b" />
    <Cylinder p={[.102, 0, -.065]} h={.13} radius={.004} r={[Math.PI / 2, 0, 0]} c="#4a656b" />
  </group>;
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
    image.current.position.set(path.intersection[0], path.intersection[1], SENSORY_MIRROR.center[2] - .006);
    image.current.scale.setScalar(Math.hypot(...SENSORY_MIRROR.center.map((v, i) => v - CLINIC_EYE_MIDPOINT[i])) / (path.distanceCm / 100));
    image.current.rotation.set(0, Math.PI, 0);
  });
  if (letter) return <Sign text={["E", "ILLUSTRATIVE ISOLATED LETTER"]} p={[.31, 1.5, SENSORY_MIRROR.center[2] - .014]} rotation={[0, Math.PI, 0]} size={[.28, .22]} bg="#f7f7e8" fg="#183335" />;
  return <group ref={image} visible={false} userData={{ xrIgnoreRay: true }}><WorthTargetFace point={runtime.equipment.includes("maddox")} /></group>;
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
