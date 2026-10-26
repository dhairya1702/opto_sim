import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { CatmullRomCurve3, DoubleSide, MathUtils, Path, Shape, Vector2, Vector3, type Group } from "three";
import { Box, Cylinder } from "./Models";
import { XRSign } from "./XRClinicPanels";
import { LIBRARY_SOCKETS } from "../interaction/xrLibraryEquipment";
import { CLINIC_PATIENT_EYES } from "../interaction/clinicPatient";
import { THORINGTON_CARD_APERTURE_RADIUS_M, THORINGTON_SCALE, thoringtonCardCoordinate } from "../interaction/thoringtonProcedure";
import { RELATIVE_HOLDER_MIN_D, RELATIVE_HOLDER_MAX_D } from "../interaction/relativeAccommodationProcedure";
import type { ConsultationToolId } from "../interaction/xrConsultationTools";

export type ClinicInstrumentSetting = {
  power?: number; base?: string; angle?: number; side?: string; point?: boolean;
  fixationLetter?: boolean;
  distanceCm?: number;
  isolatedTarget?: boolean;
  highlightCarriage?: boolean;
  highlightStart?: boolean;
  highlightAperture?: boolean;
  highlightDial?: boolean;
  readableTarget?: boolean;
  profile?: "standard" | "maddox";
  anchorPower?: number; aligned?: boolean; reflexOffset?: number; showReflex?: boolean;
  powered?: boolean; onPowerChange?: (powered: boolean) => void;
  highlightPowerSwitch?: boolean;
  onFlip?: () => boolean | void;
};
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
  const width = .11, height = .11, radius = .008, x = width / 2, y = height / 2;
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
  aperture.absarc(0, 0, THORINGTON_CARD_APERTURE_RADIUS_M, 0, Math.PI * 2, true);
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
      <meshStandardMaterial color="#9fded7" roughness={.12} transparent opacity={.68} side={DoubleSide} />
    </mesh> : <mesh position={[0, 0, .005]} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[.032, .032, .007, 36]} />
      <meshStandardMaterial color={material === "red" ? "#d83d4b" : "#9fded7"} roughness={.15} transparent opacity={material === "red" ? .76 : .56} />
    </mesh>}
  </group>;
}

function FlipperModel({ id, setting }: { id: "lens-flipper" | "prism-flipper"; setting: ClinicInstrumentSetting }) {
  const head = useRef<Group>(null);
  const [reducedMotion, setReducedMotion] = useState(() => typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    if (typeof matchMedia !== "function") return;
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => setReducedMotion(preference.matches);
    preference.addEventListener("change", changed);
    return () => preference.removeEventListener("change", changed);
  }, []);
  const label = id === "prism-flipper"
    ? setting.side === "BI" ? "3Δ BI" : "12Δ BO"
    : id === "lens-flipper"
      ? setting.side === "minus" ? "−2.00 D" : "+2.00 D"
      : "+2.00 D";
  const rimAccent = id === "prism-flipper" ? accent : setting.side === "minus" || (setting.power ?? 0) < 0 ? "#b04f61" : "#488da0";
  useFrame((_, dt) => {
    if (!head.current) return;
    const target = setting.side === "BI" || setting.side === "minus" ? Math.PI : 0;
    head.current.rotation.y = reducedMotion ? target : MathUtils.damp(head.current.rotation.y, target, 16, dt);
  });
  return <group>
    <MoldedHandle />
    <group ref={head} userData={{ xrFlipperHead: id }}>
      {[leftBridge, rightBridge].map((path, index) => <mesh key={index} castShadow receiveShadow>
        <tubeGeometry args={[path, 16, .006, 10, false]} />
        <meshStandardMaterial color={shell} roughness={.54} metalness={.11} />
      </mesh>)}
      <Lens x={-.065} material={id === "prism-flipper" ? "prism" : "clear"} />
      <Lens x={.065} material={id === "prism-flipper" ? "prism" : "clear"} />
      {[-.065, .065].map(x => <mesh key={x} position={[x, .10, .010]}>
        <torusGeometry args={[.037, .0015, 6, 32]} />
        <meshStandardMaterial color={rimAccent} roughness={.42} metalness={.34} />
      </mesh>)}
      {id === "lens-flipper" && <>
        <XRSign text={["+2.00 D"]} p={[0, .005, .014]} size={[.058, .017]} bg="#173a3e" fg="#e8fff9" />
        <XRSign text={["−2.00 D"]} p={[0, .005, -.014]} rotation={[0, Math.PI, 0]} size={[.058, .017]} bg="#173a3e" fg="#e8fff9" />
      </>}
    </group>
    {setting.onFlip && <group position={[0, .058, .026]} userData={{
      xrInstrumentControl: id, xrInteractiveSurface: true, xrButton: true, xrWidth: .052, xrHeight: .040,
      xrLabel: id === "prism-flipper" ? "PRISM FLIP TURN" : "LENS FLIP TURN", xrAction: setting.onFlip,
    }}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[.017, .017, .012, 24]} />
        <meshStandardMaterial color="#e2aa4f" roughness={.42} metalness={.28} />
      </mesh>
      <XRSign text={["TURN"]} p={[0, .025, .001]} size={[.052, .017]} bg="#173a3e" fg="#f8d88d" />
    </group>}
    {id === "prism-flipper" && <XRSign text={[label]} p={[0, .005, .014]} size={[.058, .017]} bg="#173a3e" fg="#e8fff9" />}
  </group>;
}

function RelativeLensHolderModel({ power = 0, highlightAperture = false, highlightDial = false }: { power?: number; highlightAperture?: boolean; highlightDial?: boolean }) {
  const bounded = Math.max(RELATIVE_HOLDER_MIN_D, Math.min(RELATIVE_HOLDER_MAX_D, power));
  const dialIntervals = (RELATIVE_HOLDER_MAX_D - RELATIVE_HOLDER_MIN_D) * 4;
  const dialAngle = (RELATIVE_HOLDER_MAX_D - bounded) / (RELATIVE_HOLDER_MAX_D - RELATIVE_HOLDER_MIN_D) * Math.PI * 1.5;
  return <group>
    <MoldedHandle />
    {[new CatmullRomCurve3([new Vector3(0, .057, 0), new Vector3(-.022, .073, 0), new Vector3(-.048, .088, 0)]),
      new CatmullRomCurve3([new Vector3(0, .057, 0), new Vector3(.022, .073, 0), new Vector3(.048, .088, 0)])].map((path, index) => <mesh key={index} castShadow receiveShadow>
      <tubeGeometry args={[path, 16, .006, 10, false]} /><meshStandardMaterial color={shell} roughness={.54} metalness={.11} />
    </mesh>)}
    {[-.048, .048].map(x => <group key={x} position={[x, .10, 0]} userData={{ xrRelativeAccommodationAperture: x < 0 ? "OD" : "OS" }}>
      <mesh castShadow><torusGeometry args={[.038, .007, 12, 40]} /><meshStandardMaterial color={shell} roughness={.48} metalness={.16} /></mesh>
      <mesh position={[0, 0, .005]} castShadow><circleGeometry args={[.031, 40]} /><meshStandardMaterial color="#b7dbea" transparent opacity={.48} roughness={.12} /></mesh>
      <mesh position={[0, 0, .009]}><torusGeometry args={[.031, .0015, 8, 36]} /><meshStandardMaterial color={bounded < 0 ? "#b04f61" : "#488da0"} roughness={.38} metalness={.36} /></mesh>
      {highlightAperture && <mesh position={[0, 0, .014]} userData={{ xrInstructionalHighlight: true }}><ringGeometry args={[.043, .050, 32]} /><meshBasicMaterial color="#8df5d3" side={DoubleSide} depthTest={false} /></mesh>}
    </group>)}
    <group position={[.075, .035, .006]} userData={{ xrRelativeAccommodationDial: true }}>
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.032, .032, .014, 40]} /><meshStandardMaterial color={darkMetal} roughness={.38} metalness={.48} /></mesh>
      {Array.from({ length: dialIntervals + 1 }, (_, index) => <group key={index} rotation={[0, 0, -index / dialIntervals * Math.PI * 1.5]}>
        <Box p={[0, .027, .010]} s={[index % 4 === 0 ? .003 : .0015, index % 4 === 0 ? .009 : .005, .002]} c={index % 4 === 0 ? accent : paper} />
      </group>)}
      <group rotation={[0, 0, -dialAngle]}><Box p={[0, .019, .018]} s={[.004, .033, .004]} c="#f1c45f" /></group>
      {highlightDial && <mesh position={[0, 0, .018]} userData={{ xrInstructionalHighlight: true }}><ringGeometry args={[.037, .044, 32]} /><meshBasicMaterial color="#8df5d3" side={DoubleSide} depthTest={false} /></mesh>}
    </group>
    <XRSign text={[`${bounded >= 0 ? "+" : ""}${bounded.toFixed(2)} D`, `RANGE ${RELATIVE_HOLDER_MIN_D.toFixed(2)} TO +${RELATIVE_HOLDER_MAX_D.toFixed(2)} D`, "0.25 D STEPS"]} p={[-.050, .027, .014]} size={[.088, .050]} bg="#173a3e" fg="#e8fff9" />
  </group>;
}

function MinusLensHolderModel({ power = 0, highlightAperture = false, highlightDial = false }: { power?: number; highlightAperture?: boolean; highlightDial?: boolean }) {
  const dialAngle = Math.abs(Math.max(-4, Math.min(0, power))) / 4 * Math.PI * 1.5;
  return <group>
    <MoldedHandle />
    <group position={[0, .10, 0]} userData={{ xrMinusLensAperture: true }}>
      <mesh castShadow><torusGeometry args={[.040, .007, 12, 40]} /><meshStandardMaterial color={shell} roughness={.48} metalness={.16} /></mesh>
      <mesh position={[0, 0, .005]} castShadow><circleGeometry args={[.033, 40]} /><meshStandardMaterial color="#b7dbea" transparent opacity={.48} roughness={.12} /></mesh>
      <mesh position={[0, 0, .009]}><torusGeometry args={[.033, .0015, 8, 36]} /><meshStandardMaterial color="#b04f61" roughness={.38} metalness={.36} /></mesh>
      {highlightAperture && <mesh position={[0, 0, .014]} userData={{ xrInstructionalHighlight: true }}><ringGeometry args={[.045, .052, 32]} /><meshBasicMaterial color="#8df5d3" side={DoubleSide} depthTest={false} /></mesh>}
    </group>
    <group position={[.065, .045, .006]} userData={{ xrMinusLensDial: true }}>
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.031, .031, .014, 40]} /><meshStandardMaterial color={darkMetal} roughness={.38} metalness={.48} /></mesh>
      {Array.from({ length: 17 }, (_, index) => <group key={index} rotation={[0, 0, -index / 16 * Math.PI * 1.5]}>
        <Box p={[0, .026, .010]} s={[index % 4 === 0 ? .003 : .0015, index % 4 === 0 ? .009 : .005, .002]} c={index % 4 === 0 ? accent : paper} />
      </group>)}
      <group rotation={[0, 0, -dialAngle]}><Box p={[0, .018, .018]} s={[.004, .032, .004]} c="#f1c45f" /></group>
      {highlightDial && <mesh position={[0, 0, .018]} userData={{ xrInstructionalHighlight: true }}><ringGeometry args={[.036, .043, 32]} /><meshBasicMaterial color="#8df5d3" side={DoubleSide} depthTest={false} /></mesh>}
    </group>
    <XRSign text={[`${power.toFixed(2)} D`, "0.00 → −4.00", "0.25 D STEPS"]} p={[-.052, .030, .014]} size={[.080, .050]} bg="#173a3e" fg="#e8fff9" />
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
        <meshStandardMaterial color="#d83d4b" roughness={.17} transparent opacity={.78} />
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
    <Box p={[0, .025, 0]} s={[.022, .050, .010]} c={paper} radius={.003} />
    <mesh position={[0, .10, -.006]} rotation={[0, Math.PI, 0]}>
      <ringGeometry args={[THORINGTON_CARD_APERTURE_RADIUS_M, .013, 28]} />
      <meshStandardMaterial color={darkMetal} roughness={.36} metalness={.54} side={DoubleSide} />
    </mesh>
    {THORINGTON_SCALE.filter(i => i !== 0).map(i => <group key={i}>
      {Math.abs(thoringtonCardCoordinate(i)) > THORINGTON_CARD_APERTURE_RADIUS_M + .003 && <>
        <Box p={[thoringtonCardCoordinate(i), .10, -.006]} s={[.001, .007, .002]} c={teal} />
        <Box p={[0, .10 + thoringtonCardCoordinate(i), -.006]} s={[.007, .001, .002]} c={teal} />
      </>}
      <XRSign text={[String(Math.abs(i))]} p={[thoringtonCardCoordinate(i), .118, -.007]} size={[.007, .005]} rotation={[0, Math.PI, 0]} bg={paper} fg="#244b47" />
      <XRSign text={[String(Math.abs(i))]} p={[.018, .10 + thoringtonCardCoordinate(i), -.007]} size={[.007, .005]} rotation={[0, Math.PI, 0]} bg={paper} fg="#244b47" />
    </group>)}
    <XRSign text={["PATIENT-FACING · 4 MM/Δ"]} p={[0, .150, -.007]} size={[.09, .010]} rotation={[0, Math.PI, 0]} bg={paper} fg="#244b47" />
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

function NPCRuleModel({ distanceCm = 40, highlightCarriage = false }: { distanceCm?: number; highlightCarriage?: boolean }) {
  const carriageZ = Math.max(.02, Math.min(.42, distanceCm / 100));
  return <group>
    <Box p={[0, 0, .22]} s={[.024, .018, .44]} c={metal} radius={.003} />
    <Box p={[0, -.012, 0]} s={[.09, .035, .045]} c={shell} radius={.006} />
    <XRSign text={["SPECTACLE PLANE"]} p={[0, .027, .015]} size={[.10, .022]} rotation={[-Math.PI / 2, 0, 0]} bg="#173a3e" fg="#e8fff9" />
    {Array.from({ length: 41 }, (_, index) => index + 2).map(cm => <group key={cm} position={[0, .012, cm / 100]}>
      <Box p={[cm % 5 === 0 ? .016 : .009, 0, 0]} s={[cm % 5 === 0 ? .025 : .012, .003, .0015]} c={cm % 5 === 0 ? accent : darkMetal} />
      {cm % 5 === 0 && <XRSign text={[String(cm)]} p={[-.025, .005, 0]} size={[.022, .012]} rotation={[-Math.PI / 2, 0, 0]} bg={paper} fg="#244b47" />}
    </group>)}
    <group position={[0, .045, carriageZ]} userData={{ xrNpcCarriage: true }}>
      <Box s={[.07, .075, .028]} c={shell} radius={.008} />
      {highlightCarriage && <mesh position={[0, 0, .017]}><ringGeometry args={[.043, .050, 28]} /><meshBasicMaterial color="#8df5d3" side={DoubleSide} depthTest={false} /></mesh>}
      <Box p={[0, .045, 0]} s={[.055, .055, .010]} c={paper} radius={.006} />
      {[.009, .018].map(radius => <mesh key={radius} position={[0, .045, .006]} rotation={[0, 0, 0]}><torusGeometry args={[radius, .0025, 8, 28]} /><meshStandardMaterial color={radius === .018 ? accent : teal} /></mesh>)}
    </group>
  </group>;
}

function PushUpRuleModel({ distanceCm = 40, highlightCarriage = false, highlightStart = false }: { distanceCm?: number; highlightCarriage?: boolean; highlightStart?: boolean }) {
  const carriageZ = Math.max(.02, Math.min(.42, distanceCm / 100));
  return <group>
    <Box p={[0, 0, .22]} s={[.028, .018, .44]} c={metal} radius={.003} />
    <Box p={[0, -.012, 0]} s={[.10, .035, .045]} c={shell} radius={.006} />
    <XRSign text={["SPECTACLE PLANE"]} p={[0, .027, .015]} size={[.11, .022]} rotation={[-Math.PI / 2, 0, 0]} bg="#173a3e" fg="#e8fff9" />
    {Array.from({ length: 41 }, (_, index) => index + 2).map(cm => <group key={cm} position={[0, .012, cm / 100]}>
      <Box p={[cm % 5 === 0 ? .016 : .009, 0, 0]} s={[cm % 5 === 0 ? .025 : .012, .003, .0015]} c={cm === 40 ? "#f1c45f" : cm % 5 === 0 ? accent : darkMetal} />
      {cm % 5 === 0 && <XRSign text={[String(cm)]} p={[-.025, .005, 0]} size={[.022, .012]} rotation={[-Math.PI / 2, 0, 0]} bg={paper} fg={cm === 40 ? "#9a5c00" : "#244b47"} />}
    </group>)}
    {highlightStart && <group position={[0, .014, .40]} userData={{ xrInstructionalHighlight: true }}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}><ringGeometry args={[.032, .044, 28]} /><meshBasicMaterial color="#8df5d3" side={DoubleSide} depthTest={false} /></mesh>
      <XRSign text={["START · 40 CM"]} p={[.075, .012, 0]} size={[.10, .020]} rotation={[-Math.PI / 2, 0, 0]} bg="#153b3c" fg="#e8fff9" />
    </group>}
    <group position={[0, .045, carriageZ]} userData={{ xrPushUpCarriage: true }}>
      <Box s={[.082, .075, .028]} c={shell} radius={.008} />
      {highlightCarriage && <mesh position={[0, 0, .017]}><ringGeometry args={[.047, .054, 28]} /><meshBasicMaterial color="#8df5d3" side={DoubleSide} depthTest={false} /></mesh>}
      <Box p={[0, .052, 0]} s={[.105, .070, .010]} c={paper} radius={.006} />
      <XRSign text={["C D H N O", "R S V Z"]} p={[0, .052, -.006]} size={[.092, .046]} rotation={[0, Math.PI, 0]} bg={paper} fg="#162d2c" />
      <XRSign text={["READ THIS LINE"]} p={[0, .013, -.006]} size={[.072, .012]} rotation={[0, Math.PI, 0]} bg={paper} fg="#3f827a" />
    </group>
  </group>;
}

function RotaryVergencePrismModel({ power = 0, base = "BI", highlightAperture = false, highlightDial = false }: { power?: number; base?: string; highlightAperture?: boolean; highlightDial?: boolean }) {
  const dialAngle = Math.max(0, Math.min(30, power)) / 30 * Math.PI * 1.5;
  return <group>
    <MoldedHandle />
    <group position={[0, .10, 0]}>
      <mesh castShadow><torusGeometry args={[.042, .008, 12, 40]} /><meshStandardMaterial color={shell} roughness={.48} metalness={.16} /></mesh>
      <mesh position={[0, 0, .004]} castShadow><circleGeometry args={[.033, 40]} /><meshStandardMaterial color="#a7e3dc" transparent opacity={.48} roughness={.12} /></mesh>
      <mesh position={[0, 0, .010]} rotation={[Math.PI / 2, 0, Math.PI / 2]}><cylinderGeometry args={[.030, .025, .006, 3]} /><meshPhysicalMaterial color="#c5f0e7" transparent opacity={.58} /></mesh>
      {highlightAperture && <mesh position={[0, 0, .014]}><ringGeometry args={[.045, .051, 32]} /><meshBasicMaterial color="#8df5d3" side={DoubleSide} depthTest={false} /></mesh>}
      <XRSign text={[base && ["BI", "BU", "BO", "BD"].includes(base) ? base : "BI"]} p={[0, .052, .012]} size={[.040, .018]} bg="#173a3e" fg="#f1c45f" />
      <XRSign text={["BI"]} p={[-.052, 0, .012]} size={[.030, .014]} bg="#173a3e" fg="#e8fff9" />
      <XRSign text={["BU"]} p={[0, .071, .012]} size={[.030, .014]} bg="#173a3e" fg="#e8fff9" />
      <XRSign text={["BO"]} p={[-.052, .10, .012]} size={[.030, .014]} bg="#173a3e" fg="#e8fff9" />
      <XRSign text={["BD"]} p={[0, .029, .012]} size={[.030, .014]} bg="#173a3e" fg="#e8fff9" />
    </group>
    <group position={[.065, .055, .006]} userData={{ xrVergenceDial: true }}>
      <mesh castShadow rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.035, .035, .014, 40]} /><meshStandardMaterial color={darkMetal} roughness={.38} metalness={.48} /></mesh>
      {Array.from({ length: 31 }, (_, value) => <group key={value} rotation={[0, 0, -value / 30 * Math.PI * 1.5]}>
        <Box p={[0, .029, .010]} s={[value % 5 === 0 ? .003 : .0015, value % 5 === 0 ? .010 : .006, .002]} c={value % 5 === 0 ? accent : paper} />
        <XRSign text={[String(value)]} p={[0, value % 5 === 0 ? .043 : .039, .011]} size={value % 5 === 0 ? [.014, .008] : [.010, .006]} bg="#173a3e" fg={value % 5 === 0 ? "#f1c45f" : "#e8fff9"} />
      </group>)}
      <group rotation={[0, 0, -dialAngle]}><Box p={[0, .020, .018]} s={[.004, .037, .004]} c="#f1c45f" /></group>
      {highlightDial && <mesh position={[0, 0, .018]}><ringGeometry args={[.040, .047, 32]} /><meshBasicMaterial color="#8df5d3" side={DoubleSide} depthTest={false} /></mesh>}
    </group>
    <XRSign text={[`${power.toFixed(1)}Δ`, "0–30 ROTARY", "BI · BU · BO · BD"]} p={[-.055, .025, .012]} size={[.082, .044]} bg="#173a3e" fg="#e8fff9" />
  </group>;
}

export function LibraryInstrumentModel({ id, setting = {} }: { id: ConsultationToolId; setting?: ClinicInstrumentSetting }) {
  if (id === "maddox") return <MaddoxModel angle={setting.angle} />;
  if (id === "thorington") return <ThoringtonModel />;
  if (id === "fixation") return <FixationModel />;
  if (id === "npc-rule") return <NPCRuleModel distanceCm={setting.distanceCm} highlightCarriage={setting.highlightCarriage} />;
  if (id === "push-up-rule") return <PushUpRuleModel distanceCm={setting.distanceCm} highlightCarriage={setting.highlightCarriage} highlightStart={setting.highlightStart} />;
  if (id === "trial-lens") return <RelativeLensHolderModel power={setting.power} highlightAperture={setting.highlightAperture} highlightDial={setting.highlightDial} />;
  if (id === "minus-lens-holder") return <MinusLensHolderModel power={setting.power} highlightAperture={setting.highlightAperture} highlightDial={setting.highlightDial} />;
  if (id === "vergence-prism") return <RotaryVergencePrismModel power={setting.power} base={setting.base} highlightAperture={setting.highlightAperture} highlightDial={setting.highlightDial} />;
  if (id === "lens-flipper" || id === "prism-flipper") return <FlipperModel id={id} setting={setting} />;
  return null;
}

export function LibraryEquipmentTray({ equipment = [], showFittingGuides = true, fittingGuideSocketIds }: {
  active?: boolean;
  equipment?: readonly ConsultationToolId[];
  showFittingGuides?: boolean;
  fittingGuideSocketIds?: readonly string[];
}) {
  const fittingGuides = LIBRARY_SOCKETS.filter(socket => socket.fittingLayer
    && equipment.includes(socket.tool)
    && socket.id !== "sensory-maddox-vertical-reverse"
    && (!fittingGuideSocketIds || fittingGuideSocketIds.includes(socket.id)));
  return <>
    {showFittingGuides && fittingGuides.map(socket => {
      const maddox = socket.id === "sensory-maddox-horizontal" || socket.id === "sensory-maddox-vertical";
      const position = maddox ? [CLINIC_PATIENT_EYES.OD[0], CLINIC_PATIENT_EYES.OD[1], -.46] as const : socket.position;
      const vertical = socket.id === "sensory-maddox-vertical";
      return <group key={socket.id} position={[...position]} userData={{ xrIgnoreRay: true, xrInstructionalHighlight: true, xrFittingGuideSocket: socket.id }}>
        <mesh><ringGeometry args={maddox ? [.034, .040, 32] : [.009, .012, 20]}/><meshBasicMaterial color="#f1da96" transparent opacity={.58} side={DoubleSide} depthTest={false}/></mesh>
        {maddox && <Box p={[0, 0, .001]} s={vertical ? [.003, .068, .002] : [.068, .003, .002]} c="#f1da96" />}
      </group>;
    })}
  </>;
}

export function LibraryNearStand({ card = "near" }: { card?: "near" | "thorington" }) {
  // Support the reading card's lower edge or the numbered card's handle base.
  const ledgeY = card === "thorington" ? 1.247 : 1.337;
  return <group userData={{ xrIgnoreRay: true }}>
    <Cylinder p={[.26, .68, -.18]} h={1.34} radius={.01} c="#78948e" />
    <Box p={[.13, ledgeY, -.18]} s={[.28, .016, .05]} c="#78948e" />
    <Box p={[.26, .025, -.18]} s={[.22, .025, .22]} c="#78948e" />
    <XRSign transparentBackground text={["NEAR STAND"]} p={[.30, 1.20, -.16]} size={[.24, .0375]} fg="#e8fff9" />
  </group>;
}
