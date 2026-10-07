import { useMemo } from "react";
import { CatmullRomCurve3, Shape, Vector2, Vector3, type ExtrudeGeometryOptions } from "three";

type V = [number, number, number];

/**
 * Original, manufacturer-neutral retinoscope body used by the shared XR clinic.
 * Its origin and front working end match the existing procedural scope contract.
 */
export function RetinoscopeModel({ p = [0, 0, 0], r = [0, 0, 0] }: { p?: V; r?: V }) {
  const handleProfile = useMemo(() => [
    [0.022, -0.050], [0.025, -0.045], [0.026, -0.030], [0.024, -0.004],
    [0.0225, 0.042], [0.024, 0.080], [0.028, 0.095], [0.030, 0.101],
  ].map(([x, y]) => new Vector2(x, y)), []);
  const neckPath = useMemo(() => new CatmullRomCurve3([
    new Vector3(0, 0.162, 0),
    new Vector3(0.002, 0.184, 0),
    new Vector3(0.012, 0.199, 0),
    new Vector3(0.016, 0.214, 0),
  ]), []);
  const headShape = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(-0.031, -0.047);
    shape.bezierCurveTo(-0.043, -0.035, -0.045, -0.005, -0.040, 0.022);
    shape.bezierCurveTo(-0.036, 0.047, -0.018, 0.058, 0.010, 0.056);
    shape.bezierCurveTo(0.036, 0.054, 0.047, 0.035, 0.045, 0.010);
    shape.bezierCurveTo(0.043, -0.015, 0.036, -0.039, 0.018, -0.049);
    shape.bezierCurveTo(0.002, -0.057, -0.019, -0.055, -0.031, -0.047);
    return shape;
  }, []);
  const headOptions = useMemo<ExtrudeGeometryOptions>(() => ({
    depth: 0.043,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.006,
    bevelThickness: 0.004,
    curveSegments: 18,
  }), []);

  return <group position={p} rotation={r} userData={{ instrumentModel: "retinoscope-shaped" }}>
    <mesh position={[0, .045, 0]} castShadow receiveShadow>
      <latheGeometry args={[handleProfile, 36]} />
      <meshStandardMaterial color="#17383a" roughness={.72} metalness={.02} />
    </mesh>
    {[-.055, -.043, -.031, -.019, -.007, .005].map(y => <mesh key={y} position={[0, y + .045, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <torusGeometry args={[.024, .0012, 6, 28]} />
      <meshStandardMaterial color="#4d5e5d" roughness={.34} metalness={.56} />
    </mesh>)}
    <mesh position={[0, .154, 0]} castShadow>
      <cylinderGeometry args={[.029, .029, .024, 32]} />
      <meshStandardMaterial color="#a8b6b0" roughness={.3} metalness={.72} />
    </mesh>
    <mesh position={[0, -.002, 0]} castShadow>
      <cylinderGeometry args={[.025, .025, .012, 32]} />
      <meshStandardMaterial color="#d39b42" roughness={.42} metalness={.45} />
    </mesh>
    <mesh castShadow receiveShadow>
      <tubeGeometry args={[neckPath, 18, .018, 20, false]} />
      <meshStandardMaterial color="#27373a" roughness={.54} metalness={.12} />
    </mesh>
    <mesh position={[.012, .257, -.0215]} castShadow receiveShadow>
      <extrudeGeometry args={[headShape, headOptions]} />
      <meshStandardMaterial color="#27373a" roughness={.54} metalness={.12} />
    </mesh>
    <mesh position={[.011, .272, .027]} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[.022, .022, .012, 32]} />
      <meshStandardMaterial color="#a8b6b0" roughness={.3} metalness={.72} />
    </mesh>
    <mesh position={[.011, .272, .036]} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[.015, .015, .006, 32]} />
      <meshPhysicalMaterial color="#a9e4dc" roughness={.12} transmission={.38} thickness={.01} transparent opacity={.84} />
    </mesh>
    <mesh position={[.011, .285, -.026]} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[.012, .012, .010, 28]} />
      <meshStandardMaterial color="#4d5e5d" roughness={.34} metalness={.56} />
    </mesh>
    <mesh position={[.011, .285, -.036]} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[.0065, .0065, .012, 28]} />
      <meshStandardMaterial color="#071214" roughness={.46} metalness={.1} />
    </mesh>
    <group position={[.056, .25, 0]} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[.024, .024, .014, 32]} />
        <meshStandardMaterial color="#4d5e5d" roughness={.34} metalness={.56} />
      </mesh>
      {Array.from({ length: 16 }, (_, index) => {
        const angle = index / 16 * Math.PI * 2;
        return <mesh key={index} position={[0, Math.cos(angle) * .022, Math.sin(angle) * .022]} rotation={[angle, 0, 0]} castShadow>
          <boxGeometry args={[.006, .004, .012]} />
          <meshStandardMaterial color="#a8b6b0" roughness={.3} metalness={.72} />
        </mesh>;
      })}
    </group>
    <mesh position={[-.036, .246, .026]} rotation={[0, 0, -.12]} castShadow>
      <capsuleGeometry args={[.005, .017, 4, 10]} />
      <meshStandardMaterial color="#d39b42" roughness={.42} metalness={.45} />
    </mesh>
  </group>;
}
