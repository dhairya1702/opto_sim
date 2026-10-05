import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, Group, Mesh, MeshBasicMaterial, Object3D } from "three";
import { PosteriorPole } from "./PosteriorPole";

export type FundusScopeView = { visible: boolean; x: number; y: number };
export type BrucknerScopeView = { visible: boolean; largeSpot: boolean; brighter: "equal" | "od" | "os" };
/** The existing authored schematic is visible only through the scope's rear aperture. */
export function XRScopeOptics({ powered, ophthalmo, view, brucknerView }: { powered: boolean; ophthalmo: boolean; view?: FundusScopeView; brucknerView?: BrucknerScopeView }) {
  const field = useRef<Group>(null);
  const reflexes = useRef<Group>(null);
  const movement = useRef({ x: 0, y: 0, used: true });
  const target = useMemo(() => {
    const target = new Object3D(); target.position.set(0, .17, .7); return target;
  }, []);
  useFrame(() => {
    if (field.current) field.current.visible = Boolean(powered && view?.visible && !brucknerView);
    if (reflexes.current) {
      reflexes.current.visible = Boolean(powered && brucknerView?.visible);
      reflexes.current.children.forEach(child => {
        if (child instanceof Mesh && child.material instanceof MeshBasicMaterial) {
          child.material.color.set(brucknerView?.brighter === child.userData.eye ? "#ffb55d" : "#b82714");
        }
      });
    }
    movement.current.x = view?.x ?? 0; movement.current.y = view?.y ?? 0;
  });
  return <>
    <primitive object={target} />
    <mesh position={[0, .17, .029]}>
      <circleGeometry args={[.017, 24]} />
      <meshBasicMaterial color={powered ? "#fff0a2" : "#5d8589"} side={DoubleSide} />
    </mesh>
    {powered && <spotLight userData={{ instrumentLight: true }} position={[0, .17, .032]} target={target} color="#ffd493" intensity={1.6} distance={1.4} angle={brucknerView ? brucknerView.largeSpot ? .16 : .04 : .08} penumbra={.4} />}
    {ophthalmo && <>
      <mesh position={[0, .17, -.028]} rotation={[0, Math.PI, 0]}>
        <circleGeometry args={[.022, 32]} /><meshBasicMaterial color="#040909" />
      </mesh>
      {brucknerView && <group ref={reflexes} visible={false} position={[0, .17, -.032]} rotation={[0, Math.PI, 0]} userData={{ xrBrucknerField: true }}>
        {(["od", "os"] as const).map((eye, index) => <mesh key={eye} position={[index === 0 ? -.009 : .009, 0, 0]} userData={{ eye }}>
          <circleGeometry args={[.006, 24]} /><meshBasicMaterial args={[{ color: "#b82714" }]} />
        </mesh>)}
      </group>}
      <group ref={field} visible={false} position={[0, .17, -.031]} rotation={[0, Math.PI, 0]} scale={.115} userData={{ xrFundusField: true }}>
        <PosteriorPole x={0} movement={movement} />
      </group>
    </>}
  </>;
}
