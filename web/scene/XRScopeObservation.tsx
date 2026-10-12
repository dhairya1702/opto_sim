import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, MeshBasicMaterial } from "three";
import { PosteriorPole } from "./PosteriorPole";
import { EyeSurface } from "./EyeSurface";
import type { BrucknerScopeView, FundusScopeView } from "./XRScopeOptics";

/** The same authored illustration serves the instrument window and button-operated view. */
export function XRScopeObservation({ brucknerView, fundusView, expanded = false }: { brucknerView?: BrucknerScopeView; fundusView?: FundusScopeView; expanded?: boolean }) {
  const reflexes = useRef<Group>(null);
  const movement = useRef({ x: 0, y: 0, used: true });
  useFrame(() => {
    movement.current.x = fundusView?.x ?? 0; movement.current.y = fundusView?.y ?? 0;
    reflexes.current?.traverse(child => {
      if (child.userData.eye && child instanceof Mesh && child.material instanceof MeshBasicMaterial) child.material.color.set(!brucknerView?.visible ? "#080b0b" : brucknerView.brighter === child.userData.eye ? "#ffb55d" : "#b82714");
    });
  });
  if (brucknerView && expanded) return <group ref={reflexes} userData={{ xrCanonicalBrucknerEyes: true }}>
    {(["od", "os"] as const).map((eye, index) => <group key={eye} position={[index === 0 ? -.15 : .15, .01, 0]}>
      <mesh position={[0, 0, -.008]} scale={[1.34, .72, 1]} userData={{ xrScopeOrder: 1151 }}>
        <circleGeometry args={[.14, 64]} /><meshBasicMaterial color="#70483c" />
      </mesh>
      <group scale={.90} userData={{ xrScopeOrder: 1152 }}>
        <EyeSurface x={0} pupils={false} motility={false} progress={0} movement={movement} reflectionStrength={.55} />
      </group>
      <mesh position={[0, 0, .053]} userData={{ eye, xrScopeOrder: 1154 }}>
        <circleGeometry args={[.0205, 48]} /><meshBasicMaterial args={[{ color: "#b82714" }]} />
      </mesh>
      <mesh position={[0, 0, .054]} userData={{ xrScopeOrder: 1153 }}>
        <ringGeometry args={[.0205, .026, 48]} /><meshBasicMaterial color="#6e1a12" transparent opacity={.72} />
      </mesh>
      <mesh position={[-.006, .007, .055]} userData={{ xrScopeOrder: 1155 }}>
        <circleGeometry args={[.0035, 24]} /><meshBasicMaterial color="#ffe7ba" transparent opacity={.82} />
      </mesh>
    </group>)}
  </group>;
  return brucknerView ? <group ref={reflexes}>
    {(["od", "os"] as const).map((eye, index) => <group key={eye} position={[index === 0 ? -.012 : .012, 0, 0]}>
      <mesh scale={[1.4, .85, 1]} position={[0, 0, -.002]} userData={{ xrScopeOrder: 1152 }}><circleGeometry args={[.009, 32]} /><meshBasicMaterial color="#d4c8b7" /></mesh>
      <mesh position={[0, 0, -.001]} userData={{ xrScopeOrder: 1153 }}><circleGeometry args={[.0077, 32]} /><meshBasicMaterial color="#49392b" /></mesh>
      <mesh userData={{ eye, xrScopeOrder: 1154 }}><circleGeometry args={[.005, 32]} /><meshBasicMaterial args={[{ color: "#b82714" }]} /></mesh>
    </group>)}
  </group> : fundusView?.eye && fundusView.appearance === "schematic-within-normal-limits"
    ? <group scale={.115} userData={{ xrScopeObservedEye: fundusView.eye }}><PosteriorPole x={0} movement={movement} eye={fundusView.eye} /></group>
    : null;
}
