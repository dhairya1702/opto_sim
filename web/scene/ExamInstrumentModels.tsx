import { useMemo } from "react";
import { RoundedBox } from "@react-three/drei";
import { CatmullRomCurve3, Shape, Vector2, Vector3, type ExtrudeGeometryOptions } from "three";

type V = [number, number, number];

const colors = {
  shell: "#24383b",
  grip: "#17383a",
  metal: "#a8b6b0",
  darkMetal: "#4c5f5e",
  accent: "#d39b42",
  teal: "#3f827a",
  rubber: "#091719",
  paper: "#f3f0df",
  red: "#a92f3b",
};

function StandardMaterial({ color, metalness = 0.1, roughness = 0.54 }: { color: string; metalness?: number; roughness?: number }) {
  return <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} />;
}

function MoldedHandle({ height, width, p }: { height: number; width: number; p: V }) {
  const profile = useMemo(() => [
    [width * .8, -height / 2], [width, -height * .42], [width * .92, 0],
    [width, height * .38], [width * 1.14, height / 2],
  ].map(([x, y]) => new Vector2(x, y)), [height, width]);
  return <group>
    <mesh position={p} castShadow receiveShadow>
      <latheGeometry args={[profile, 32]} />
      <StandardMaterial color={colors.grip} metalness={.02} roughness={.73} />
    </mesh>
    {[-2, -1, 0, 1, 2].map(index => <mesh key={index} position={[p[0], p[1] + index * height * .12, p[2]]} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <torusGeometry args={[width * .94, .0011, 6, 28]} />
      <StandardMaterial color={colors.darkMetal} metalness={.54} roughness={.36} />
    </mesh>)}
  </group>;
}

function RoundedPlate({ width, height, depth, radius, p = [0, 0, 0], r = [0, 0, 0], color, workingFace = false }: { width: number; height: number; depth: number; radius: number; p?: V; r?: V; color: string; workingFace?: boolean }) {
  const shape = useMemo(() => {
    const result = new Shape(), x = width / 2, y = height / 2, corner = Math.min(radius, x * .7, y * .7);
    result.moveTo(-x + corner, -y); result.lineTo(x - corner, -y); result.quadraticCurveTo(x, -y, x, -y + corner);
    result.lineTo(x, y - corner); result.quadraticCurveTo(x, y, x - corner, y); result.lineTo(-x + corner, y);
    result.quadraticCurveTo(-x, y, -x, y - corner); result.lineTo(-x, -y + corner); result.quadraticCurveTo(-x, -y, -x + corner, -y);
    return result;
  }, [height, radius, width]);
  const options = useMemo<ExtrudeGeometryOptions>(() => ({ depth, bevelEnabled: true, bevelSegments: 3, bevelSize: Math.min(.003, depth * .2), bevelThickness: .002, curveSegments: 12 }), [depth]);
  return <group position={p} rotation={r} userData={workingFace ? { instrumentWorkingFace: true } : undefined}>
    <mesh position={[0, 0, -depth / 2]} castShadow receiveShadow>
      <extrudeGeometry args={[shape, options]} />
      <StandardMaterial color={color} metalness={color === colors.paper ? 0 : .11} roughness={color === colors.paper ? .84 : .54} />
    </mesh>
  </group>;
}

/** Approved molded paddle, fitted around the original grip and head centre. */
export function ExamPaddleModel({ pinhole = false, cover = false, p = [0, 0, 0], r = [0, 0, 0] }: { pinhole?: boolean; cover?: boolean; p?: V; r?: V }) {
  return <group position={p} rotation={r} userData={{ instrumentModel: pinhole ? "pinhole-shaped" : cover ? "cover-occluder-shaped" : "acuity-occluder-shaped" }}>
    <mesh position={[0, -.06, 0]} castShadow receiveShadow>
      <capsuleGeometry args={[.014, .135, 6, 16]} />
      <StandardMaterial color={colors.grip} metalness={.02} roughness={.73} />
    </mesh>
    <RoundedPlate width={.126} height={.141} depth={.012} radius={.052} p={[0, .061, 0]} color={colors.shell} workingFace />
    <mesh position={[0, .061, .011]} castShadow>
      <torusGeometry args={[.052, .006, 10, 36]} />
      <StandardMaterial color={cover ? colors.teal : colors.darkMetal} metalness={cover ? .12 : .54} roughness={cover ? .52 : .36} />
    </mesh>
    {pinhole && <>
      <mesh position={[0, .061, .017]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[.014, .014, .007, 28]} />
        <StandardMaterial color={colors.metal} metalness={.72} roughness={.3} />
      </mesh>
      <mesh position={[0, .061, .022]} rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[.003, .003, .009, 20]} />
        <StandardMaterial color={colors.rubber} metalness={0} roughness={.88} />
      </mesh>
    </>}
    <RoundedBox position={[0, -.142, 0]} args={[.034, .014, .023]} radius={.005} smoothness={3} castShadow>
      <StandardMaterial color={colors.accent} metalness={.42} roughness={.42} />
    </RoundedBox>
  </group>;
}

/** Approved tapered pocket-light shell. The lens remains at local y=.137. */
export function PenlightModel({ powered = false, p = [0, 0, 0], r = [0, 0, 0] }: { powered?: boolean; p?: V; r?: V }) {
  const profile = useMemo(() => [
    [.014, -.10], [.017, -.092], [.016, .065], [.020, .082], [.021, .098],
  ].map(([x, y]) => new Vector2(x, y)), []);
  return <group position={p} rotation={r} userData={{ instrumentModel: "penlight-shaped" }}>
    <mesh position={[0, .01, 0]} castShadow receiveShadow><latheGeometry args={[profile, 32]} /><StandardMaterial color={colors.grip} metalness={.02} roughness={.73} /></mesh>
    <mesh position={[0, .12, 0]} castShadow><cylinderGeometry args={[.023, .023, .023, 32]} /><StandardMaterial color={colors.metal} metalness={.72} roughness={.3} /></mesh>
    <mesh position={[0, .137, 0]} castShadow><cylinderGeometry args={[.018, .018, .008, 32]} /><meshPhysicalMaterial color={powered ? "#ffdda1" : "#a9e4dc"} emissive={powered ? "#a45d12" : "#000000"} emissiveIntensity={powered ? .35 : 0} roughness={.12} transmission={.32} thickness={.01} transparent opacity={.84} /></mesh>
    <mesh position={[.018, .035, 0]} rotation={[0, 0, Math.PI / 2]} castShadow><capsuleGeometry args={[.005, .022, 4, 12]} /><StandardMaterial color={colors.accent} metalness={.42} roughness={.42} /></mesh>
    <mesh position={[-.019, -.005, 0]} castShadow><boxGeometry args={[.007, .07, .005]} /><StandardMaterial color={colors.darkMetal} metalness={.54} roughness={.36} /></mesh>
  </group>;
}

/** Approved dedicated red fixation wand. Its target remains at local y=.137. */
export function MotilityTargetModel({ powered = false, p = [0, 0, 0], r = [0, 0, 0] }: { powered?: boolean; p?: V; r?: V }) {
  return <group position={p} rotation={r} userData={{ instrumentModel: "motility-target-shaped" }}>
    <group position={[0, -.118, 0]}>
      <MoldedHandle height={.17} width={.01} p={[0, .083, 0]} />
      <mesh position={[0, .20, 0]} castShadow><cylinderGeometry args={[.009, .009, .09, 28]} /><StandardMaterial color={colors.metal} metalness={.72} roughness={.3} /></mesh>
      <mesh position={[0, .255, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.023, .023, .009, 32]} /><StandardMaterial color={colors.shell} /></mesh>
      <mesh position={[0, .255, .008]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.014, .014, .011, 32]} /><meshStandardMaterial color={powered ? "#fff1a8" : colors.red} emissive={powered ? "#a45d12" : "#000000"} emissiveIntensity={powered ? .35 : 0} roughness={.43} /></mesh>
      <mesh position={[0, .255, .014]} castShadow><torusGeometry args={[.018, .003, 10, 36]} /><StandardMaterial color={colors.accent} metalness={.42} roughness={.42} /></mesh>
    </group>
  </group>;
}

/** Approved stepped prism cells around the existing selected-cell coordinate. */
export function PrismBarModel() {
  return <group userData={{ instrumentModel: "prism-bar-shaped" }}>
    <MoldedHandle height={.16} width={.017} p={[0, .03, 0]} />
    <RoundedPlate width={.096} height={.281} depth={.008} radius={.018} p={[0, .225, 0]} color={colors.darkMetal} />
    {Array.from({ length: 8 }, (_, index) => {
      const radius = .019 + index * .0015;
      return <group key={index}>
        <mesh position={[0, .118 + index * .032, .012]} rotation={[Math.PI / 2, 0, (index % 2 ? 1 : -1) * Math.PI / 2]} scale={[1.2, 1, 1]} castShadow>
          <cylinderGeometry args={[radius * .82, radius, .014, 3]} />
          <meshPhysicalMaterial color="#9fded7" roughness={.12} transmission={.38} thickness={.01} transparent opacity={.68} />
        </mesh>
        <mesh position={[.04, .118 + index * .032, .023]} castShadow><boxGeometry args={[.012, .005, .004]} /><StandardMaterial color={index === 4 ? colors.accent : colors.metal} metalness={.6} roughness={.34} /></mesh>
      </group>;
    })}
  </group>;
}

/** Approved handled reading card, authored in the original x/z card plane. */
export function NearCardModel() {
  return <group userData={{ instrumentModel: "near-card-shaped" }}>
    <RoundedPlate width={.236} height={.166} depth={.005} radius={.014} r={[Math.PI / 2, 0, 0]} color={colors.paper} />
    <RoundedPlate width={.012} height={.15} depth={.008} radius={.004} p={[-.108, -.008, 0]} r={[Math.PI / 2, 0, 0]} color={colors.teal} />
    {[0, 1, 2, 3, 4].map(index => <mesh key={index} position={[.015, -.008, .045 - index * .022]} rotation={[Math.PI / 2, 0, 0]}>
      <boxGeometry args={[.12 - index * .014, .004, .002]} /><StandardMaterial color={index === 0 ? colors.red : colors.darkMetal} metalness={index === 0 ? 0 : .54} roughness={.43} />
    </mesh>)}
    <mesh position={[0, -.004, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow><capsuleGeometry args={[.012, .12, 6, 16]} /><StandardMaterial color={colors.grip} metalness={.02} roughness={.73} /></mesh>
  </group>;
}

/** Approved layered trial frame centred on the original spectacle fitting origin. */
export function TrialFrameModel() {
  const bridge = useMemo(() => new CatmullRomCurve3([
    new Vector3(-.014, .007, 0), new Vector3(0, .017, .004), new Vector3(.014, .007, 0),
  ]), []);
  return <group userData={{ instrumentModel: "trial-frame-shaped" }}>
    {[-.052, .052].map(x => <group key={x}>
      <mesh position={[x, 0, 0]} castShadow><torusGeometry args={[.038, .006, 10, 36]} /><StandardMaterial color={colors.shell} /></mesh>
      <mesh position={[x, 0, .006]} castShadow><torusGeometry args={[.032, .002, 8, 36]} /><StandardMaterial color={colors.metal} metalness={.72} roughness={.3} /></mesh>
      <mesh position={[x, .046, 0]} castShadow><cylinderGeometry args={[.006, .006, .018, 24]} /><StandardMaterial color={colors.accent} metalness={.42} roughness={.42} /></mesh>
    </group>)}
    <mesh castShadow><tubeGeometry args={[bridge, 16, .004, 10, false]} /><StandardMaterial color={colors.metal} metalness={.72} roughness={.3} /></mesh>
    <mesh position={[-.113, 0, -.075]} rotation={[Math.PI / 2, 0, .10]} castShadow><cylinderGeometry args={[.004, .004, .17, 20]} /><StandardMaterial color={colors.darkMetal} metalness={.54} roughness={.36} /></mesh>
    <mesh position={[.113, 0, -.075]} rotation={[Math.PI / 2, 0, -.10]} castShadow><cylinderGeometry args={[.004, .004, .17, 20]} /><StandardMaterial color={colors.darkMetal} metalness={.54} roughness={.36} /></mesh>
    {[-.014, .014].map(x => <RoundedBox key={x} position={[x, -.038, .01]} args={[.018, .038, .012]} radius={.004} smoothness={3} castShadow><StandardMaterial color={colors.metal} metalness={.72} roughness={.3} /></RoundedBox>)}
  </group>;
}

/** Approved rounded direct ophthalmoscope body aligned to the legacy scope optics. */
export function OphthalmoscopeModel({ p = [0, 0, 0], r = [0, 0, 0], showApertureSelector = true }: { p?: V; r?: V; showApertureSelector?: boolean }) {
  const handleProfile = useMemo(() => [
    [.023, -.052], [.026, -.047], [.027, -.030], [.025, -.004],
    [.0235, .043], [.025, .082], [.029, .099], [.031, .106],
  ].map(([x, y]) => new Vector2(x, y)), []);
  const neckPath = useMemo(() => new CatmullRomCurve3([
    new Vector3(0, .176, 0), new Vector3(0, .194, 0), new Vector3(0, .207, 0), new Vector3(0, .218, 0),
  ]), []);
  const headShape = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(-.043, -.061); shape.bezierCurveTo(-.061, -.047, -.067, -.018, -.064, .018);
    shape.bezierCurveTo(-.062, .054, -.038, .071, 0, .074); shape.bezierCurveTo(.038, .071, .062, .054, .064, .018);
    shape.bezierCurveTo(.067, -.018, .061, -.047, .043, -.061); shape.bezierCurveTo(.022, -.073, -.022, -.073, -.043, -.061);
    return shape;
  }, []);
  const headOptions = useMemo<ExtrudeGeometryOptions>(() => ({ depth: .046, bevelEnabled: true, bevelSegments: 4, steps: 1, bevelSize: .006, bevelThickness: .004, curveSegments: 18 }), []);
  return <group position={p} rotation={r} userData={{ instrumentModel: "ophthalmoscope-shaped" }}>
    <mesh position={[0, .047, 0]} castShadow receiveShadow><latheGeometry args={[handleProfile, 36]} /><StandardMaterial color={colors.grip} metalness={.02} roughness={.72} /></mesh>
    {[-.01, .003, .016, .029, .042, .055].map(y => <mesh key={y} position={[0, y, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow><torusGeometry args={[.025, .0012, 6, 28]} /><StandardMaterial color={colors.darkMetal} metalness={.56} roughness={.34} /></mesh>)}
    <mesh position={[0, .164, 0]} castShadow><cylinderGeometry args={[.030, .030, .025, 32]} /><StandardMaterial color={colors.metal} metalness={.72} roughness={.3} /></mesh>
    <mesh position={[0, -.003, 0]} castShadow><cylinderGeometry args={[.026, .026, .012, 32]} /><StandardMaterial color={colors.accent} metalness={.45} roughness={.42} /></mesh>
    <mesh castShadow receiveShadow><tubeGeometry args={[neckPath, 16, .019, 20, false]} /><StandardMaterial color={colors.shell} metalness={.12} roughness={.52} /></mesh>
    <mesh position={[0, .254, -.023]} scale={[.65, 1, 1]} castShadow receiveShadow><extrudeGeometry args={[headShape, headOptions]} /><StandardMaterial color={colors.shell} metalness={.12} roughness={.52} /></mesh>
    <mesh position={[0, .27, .020]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.024, .024, .010, 32]} /><StandardMaterial color={colors.metal} metalness={.72} roughness={.3} /></mesh>
    <mesh position={[0, .27, .026]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.016, .016, .006, 32]} /><meshPhysicalMaterial color="#ffdda1" emissive="#a45d12" emissiveIntensity={.18} roughness={.15} transmission={.2} thickness={.01} /></mesh>
    <mesh position={[0, .27, .027]} castShadow><torusGeometry args={[.025, .003, 10, 36]} /><StandardMaterial color={colors.rubber} metalness={0} roughness={.86} /></mesh>
    <mesh position={[0, .27, -.019]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.026, .026, .012, 32]} /><StandardMaterial color={colors.rubber} metalness={0} roughness={.86} /></mesh>
    <mesh position={[0, .27, -.025]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.012, .012, .008, 32]} /><StandardMaterial color={colors.darkMetal} metalness={.56} roughness={.34} /></mesh>
    <mesh position={[0, .27, -.029]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.0055, .0055, .004, 32]} /><StandardMaterial color={colors.rubber} metalness={0} roughness={.86} /></mesh>
    <mesh position={[0, .248, -.026]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.044, .044, .009, 40]} /><StandardMaterial color={colors.darkMetal} metalness={.56} roughness={.34} /></mesh>
    <mesh position={[0, .248, -.031]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.036, .036, .004, 40]} /><StandardMaterial color={colors.shell} metalness={.12} roughness={.52} /></mesh>
    {Array.from({ length: 12 }, (_, index) => {
      const angle = index / 12 * Math.PI * 2;
      return <mesh key={index} position={[Math.sin(angle) * .029, .248 + Math.cos(angle) * .029, -.032]} rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.0032, .0032, .0025, 14]} /><StandardMaterial color={index === 2 ? colors.accent : colors.metal} metalness={.6} roughness={.34} /></mesh>;
    })}
    {showApertureSelector && <group position={[0, .20, -.027]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow><cylinderGeometry args={[.021, .021, .010, 28]} /><StandardMaterial color={colors.darkMetal} metalness={.56} roughness={.34} /></mesh>
      <mesh position={[0, .014, -.007]} rotation={[0, 0, .15]} castShadow><boxGeometry args={[.005, .012, .004]} /><StandardMaterial color={colors.accent} metalness={.45} roughness={.42} /></mesh>
    </group>}
    <group position={[.038, .247, 0]} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow><cylinderGeometry args={[.024, .024, .014, 32]} /><StandardMaterial color={colors.darkMetal} metalness={.56} roughness={.34} /></mesh>
      {Array.from({ length: 16 }, (_, index) => { const angle = index / 16 * Math.PI * 2; return <mesh key={index} position={[0, Math.cos(angle) * .022, Math.sin(angle) * .022]} rotation={[angle, 0, 0]} castShadow><boxGeometry args={[.006, .004, .012]} /><StandardMaterial color={colors.metal} metalness={.72} roughness={.3} /></mesh>; })}
    </group>
  </group>;
}
