import { CatmullRomCurve3, DoubleSide, Path, Shape, Vector2, Vector3 } from "three";
import { Box, Cylinder } from "./Models";
import { XRSign } from "./XRClinicPanels";
import { LIBRARY_SOCKETS } from "../interaction/xrLibraryEquipment";
import type { ConsultationToolId } from "../interaction/xrConsultationTools";

export type ClinicInstrumentSetting = { power?: number; base?: string; angle?: number; side?: string; point?: boolean };
export type ClinicInstrumentSettings = Partial<Record<ConsultationToolId, ClinicInstrumentSetting>>;

const shell = "#24383b";
const grip = "#17383a";
const metal = "#a8b6b0";
const darkMetal = "#4c5f5e";
const accent = "#d39b42";
const paper = "#f3f0df";
const teal = "#3f827a";

const handleProfile = [
  [.0105, -.064], [.013, -.058], [.012, 0], [.013, .055], [.015, .070],
].map(([x, y]) => new Vector2(x, y));
const leftBridge = new CatmullRomCurve3([
  new Vector3(0, .057, 0), new Vector3(-.029, .071, 0), new Vector3(-.061, .088, 0),
]);
const rightBridge = new CatmullRomCurve3(leftBridge.points.map(point => new Vector3(-point.x, point.y, point.z)));
const thoringtonShape = (() => {
  const width = .235, height = .17, radius = .012, x = width / 2, y = height / 2;
  const shape = new Shape();
  shape.moveTo(-x + radius, -y);
  shape.lineTo(x - radius, -y);
  shape.quadraticCurveTo(x, -y, x, -y + radius);
  shape.lineTo(x, y - radius);
  shape.quadraticCurveTo(x, y, x - radius, y);
  shape.lineTo(-x + radius, y);
  shape.quadraticCurveTo(-x, y, -x, y - radius);
  shape.lineTo(-x, -y + radius);
  shape.quadraticCurveTo(-x, -y, -x + radius, -y);
  const aperture = new Path();
  aperture.absarc(0, 0, .010, 0, Math.PI * 2, true);
  shape.holes.push(aperture);
  return shape;
})();

function MoldedHandle() {
  return <group>
    <mesh castShadow receiveShadow>
      <latheGeometry args={[handleProfile, 28]} />
      <meshStandardMaterial color={grip} roughness={.73} metalness={.02} />
    </mesh>
    {[-.035, -.018, 0, .018, .035].map(y => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <torusGeometry args={[.012, .0011, 6, 24]} />
      <meshStandardMaterial color={darkMetal} roughness={.36} metalness={.54} />
    </mesh>)}
    <Box p={[0, -.067, 0]} s={[.034, .006, .022]} c={accent} radius={.002} />
  </group>;
}

function Lens({ x, material = "clear" }: { x: number; material?: "clear" | "red" | "prism" }) {
  return <group position={[x, .10, 0]}>
    <mesh castShadow>
      <torusGeometry args={[.040, .006, 10, 36]} />
      <meshStandardMaterial color={shell} roughness={.54} metalness={.11} />
    </mesh>
    <mesh position={[0, 0, .006]} castShadow>
      <torusGeometry args={[.034, .002, 8, 32]} />
      <meshStandardMaterial color={metal} roughness={.30} metalness={.72} />
    </mesh>
    {material === "prism" ? <mesh position={[0, 0, .005]} rotation={[Math.PI / 2, 0, x < 0 ? Math.PI / 2 : -Math.PI / 2]} castShadow>
      <cylinderGeometry args={[.034, .027, .008, 3]} />
      <meshPhysicalMaterial color="#9fded7" roughness={.12} transmission={.38} thickness={.01} transparent opacity={.68} side={DoubleSide} />
    </mesh> : <mesh position={[0, 0, .005]} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[.032, .032, .007, 36]} />
      <meshPhysicalMaterial color={material === "red" ? "#d83d4b" : "#9fded7"} roughness={.15} transmission={.32} thickness={.01} transparent opacity={material === "red" ? .76 : .56} />
    </mesh>}
  </group>;
}

function FlipperModel({ id, setting }: { id: "trial-lens" | "lens-flipper" | "prism-flipper"; setting: ClinicInstrumentSetting }) {
  const label = id === "prism-flipper"
    ? setting.side === "BI" ? "3Δ BI" : "12Δ BO"
    : id === "lens-flipper"
      ? setting.side === "minus" ? "−2.00 D" : "+2.00 D"
      : `${(setting.power ?? 0).toFixed(2)} D`;
  const rimAccent = id === "prism-flipper" ? accent : setting.side === "minus" || (setting.power ?? 0) < 0 ? "#b04f61" : "#488da0";
  return <group>
    <MoldedHandle />
    {[leftBridge, rightBridge].map((path, index) => <mesh key={index} castShadow receiveShadow>
      <tubeGeometry args={[path, 16, .006, 10, false]} />
      <meshStandardMaterial color={shell} roughness={.54} metalness={.11} />
    </mesh>)}
    <Lens x={-.065} material={id === "prism-flipper" ? "prism" : id === "trial-lens" ? "red" : "clear"} />
    <Lens x={.065} material={id === "prism-flipper" ? "prism" : "clear"} />
    {[-.065, .065].map(x => <mesh key={x} position={[x, .10, .010]}>
      <torusGeometry args={[.037, .0015, 6, 32]} />
      <meshStandardMaterial color={rimAccent} roughness={.42} metalness={.34} />
    </mesh>)}
    <XRSign text={[label]} p={[0, .005, .014]} size={[.058, .017]} bg="#173a3e" fg="#e8fff9" />
  </group>;
}

function MaddoxModel({ angle = 90 }: { angle?: number }) {
  return <group>
    <MoldedHandle />
    <group position={[0, .10, 0]} rotation={[0, 0, angle * Math.PI / 180]}>
      <mesh castShadow>
        <torusGeometry args={[.030, .005, 10, 36]} />
        <meshStandardMaterial color={shell} roughness={.54} metalness={.11} />
      </mesh>
      <mesh position={[0, 0, .004]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[.026, .026, .006, 36]} />
        <meshPhysicalMaterial color="#d83d4b" roughness={.17} transmission={.30} thickness={.01} transparent opacity={.78} />
      </mesh>
      {[-.018, -.009, 0, .009, .018].map(y => <mesh key={y} position={[0, y, .009]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[.0014, .0014, .047, 10]} />
        <meshStandardMaterial color="#a92f3b" roughness={.43} />
      </mesh>)}
    </group>
  </group>;
}

function ThoringtonModel() {
  return <group>
    <MoldedHandle />
    <mesh position={[0, .10, -.004]} castShadow receiveShadow>
      <extrudeGeometry args={[thoringtonShape, { depth: .008, bevelEnabled: true, bevelSegments: 2, bevelSize: .0015, bevelThickness: .0015, curveSegments: 16 }]} />
      <meshStandardMaterial color={paper} roughness={.84} />
    </mesh>
    <Box p={[0, .050, 0]} s={[.025, .074, .010]} c={paper} radius={.003} />
    <Box p={[0, .150, 0]} s={[.025, .074, .010]} c={paper} radius={.003} />
    <mesh position={[0, .10, .007]}>
      <ringGeometry args={[.010, .013, 28]} />
      <meshStandardMaterial color={darkMetal} roughness={.36} metalness={.54} side={DoubleSide} />
    </mesh>
    {Array.from({ length: 11 }, (_, i) => i - 5).filter(i => i !== 0).map(i => <group key={i}>
      <Box p={[i * .018, .10, .007]} s={[.002, .012, .002]} c={teal} />
      <Box p={[0, .10 + i * .014, .007]} s={[.012, .002, .002]} c={teal} />
      <XRSign text={[String(Math.abs(i))]} p={[i * .018, .116, .008]} size={[.011, .009]} bg={paper} fg="#244b47" />
      <XRSign text={[String(Math.abs(i))]} p={[.016, .10 + i * .014, .008]} size={[.011, .008]} bg={paper} fg="#244b47" />
    </group>)}
    <XRSign text={["THORINGTON · 40 CM"]} p={[0, .158, .008]} size={[.16, .018]} bg={paper} fg="#244b47" />
  </group>;
}

function FixationModel() {
  return <group>
    <MoldedHandle />
    <Cylinder p={[0, .080, 0]} h={.045} radius={.007} c={metal} />
    <group position={[0, .10, 0]} rotation={[0, .12, 0]}>
      <Box s={[.075, .075, .016]} c={paper} radius={.014} />
      {[-1, 1].map(face => <group key={face} position={[0, 0, face * .010]} rotation={[0, face < 0 ? Math.PI : 0, 0]}>
        {[.010, .020, .030].map(radius => <mesh key={radius}>
          <torusGeometry args={[radius, .0025, 8, 32]} />
          <meshStandardMaterial color={radius === .020 ? accent : shell} roughness={.45} metalness={.12} />
        </mesh>)}
      </group>)}
    </group>
  </group>;
}

export function LibraryInstrumentModel({ id, setting = {} }: { id: ConsultationToolId; setting?: ClinicInstrumentSetting }) {
  if (id === "maddox") return <MaddoxModel angle={setting.angle} />;
  if (id === "thorington") return <ThoringtonModel />;
  if (id === "fixation") return <FixationModel />;
  if (id === "trial-lens" || id === "lens-flipper" || id === "prism-flipper") return <FlipperModel id={id} setting={setting} />;
  return null;
}

export function LibraryEquipmentTray({ active = false, equipment = [] }: { active?: boolean; equipment?: readonly ConsultationToolId[] }) {
  return <>
    {([[.65, 1.75, "LENSES / FLIPPERS"], [0, .25, "PATIENT FITTING"]] as const).map(([x, z, label]) => <group key={label} position={[x, .012, z]} userData={active ? { xrTeleport: [x, 0, z] } : { xrPreviewPad: true }}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.19, .26, 32]} /><meshBasicMaterial color="#4fae9d" transparent opacity={.65}/></mesh>
      <XRSign text={[label]} p={[0, .008, 0]} size={[.33, .08]} rotation={[-Math.PI / 2, 0, 0]} bg="#153b3c" fg="#e8fff9"/>
    </group>)}
    {LIBRARY_SOCKETS.filter(socket => socket.fittingLayer && equipment.includes(socket.tool)).map(socket => <group key={socket.id} position={[...socket.position]} userData={{ xrIgnoreRay: true }}><mesh><ringGeometry args={[.009, .012, 20]}/><meshBasicMaterial color="#f1da96" transparent opacity={.5} side={DoubleSide}/></mesh></group>)}
    <group userData={{ xrIgnoreRay: true }}>
      <Box p={[1.31, .85, 1.75]} s={[.92, .06, .76]} c="#d9e1d9" radius={.02} />
      <Cylinder p={[1.31, .43, 1.75]} h={.82} radius={.045} c="#9bafaa" />
      <Box p={[1.31, .02, 1.75]} s={[.65, .03, .40]} c="#8ca39f" />
      <XRSign text={["RODS · LENSES · FLIPPERS"]} p={[1.31, .72, 2.14]} size={[.68, .06]} bg="#173a3e" fg="#e8fff9" />
    </group>
  </>;
}

export function LibraryNearStand({ card = "near" }: { card?: "near" | "thorington" }) {
  // Support the reading card's lower edge or the numbered card's handle base.
  const ledgeY = card === "thorington" ? 1.247 : 1.337;
  return <group userData={{ xrIgnoreRay: true }}>
    <Cylinder p={[.26, .68, -.18]} h={1.34} radius={.01} c="#78948e" />
    <Box p={[.13, ledgeY, -.18]} s={[.28, .016, .05]} c="#78948e" />
    <Box p={[.26, .025, -.18]} s={[.22, .025, .22]} c="#78948e" />
    <XRSign text={["NEAR TARGET · RELEASE AT 40 CM"]} p={[.30, 1.20, -.16]} size={[.28, .06]} bg="#173a3e" fg="#e8fff9" />
  </group>;
}
