import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, MeshBasicMaterial } from "three";
import { PosteriorPole } from "./PosteriorPole";
import type { BrucknerScopeView, FundusScopeView } from "./XRScopeOptics";

/** The same authored illustration serves the instrument window and button-operated view. */
export function XRScopeObservation({ brucknerView, fundusView }: { brucknerView?: BrucknerScopeView; fundusView?: FundusScopeView }) {
  const reflexes = useRef<Group>(null);
  const movement = useRef({ x: 0, y: 0, used: true });
  useFrame(() => {
    movement.current.x = fundusView?.x ?? 0; movement.current.y = fundusView?.y ?? 0;
    reflexes.current?.traverse(child => {
      if (child.userData.eye && child instanceof Mesh && child.material instanceof MeshBasicMaterial) child.material.color.set(!brucknerView?.visible ? "#080b0b" : brucknerView.brighter === child.userData.eye ? "#ffb55d" : "#b82714");
    });
  });
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
