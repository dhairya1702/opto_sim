import { DoubleSide } from "three";

/** Visible ring plus a raycastable full disc; parent supplies the destination. */
export function XRTeleportRing({ innerRadius = .22, outerRadius = .30, opacity = .72 }: {
  innerRadius?: number; outerRadius?: number; opacity?: number;
}) {
  return <group position={[0, .002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
    <mesh>
      <ringGeometry args={[innerRadius, outerRadius, 48]} />
      <meshBasicMaterial color="#4fae9d" transparent opacity={opacity} side={DoubleSide} />
    </mesh>
    <mesh position={[0, 0, .001]} userData={{ xrTeleportHitArea: true }}>
      <circleGeometry args={[outerRadius, 48]} />
      <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false} side={DoubleSide} />
    </mesh>
  </group>;
}
