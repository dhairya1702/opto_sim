import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, Group, Mesh, MeshBasicMaterial, Object3D } from "three";
import { scopeBeamAngle, type OphthalmoscopeControl } from "../interaction/xrScopeEquipment";
import { PosteriorPole } from "./PosteriorPole";

export type FundusScopeView = { visible: boolean; x: number; y: number };
export type BrucknerScopeView = { visible: boolean; brighter: "equal" | "od" | "os" };
/** The existing authored schematic is visible only through the scope's rear aperture. */
export function XRScopeOptics({ powered, ophthalmo, view, brucknerView, scopeControl }: { powered: boolean; ophthalmo: boolean; view?: FundusScopeView; brucknerView?: BrucknerScopeView; scopeControl?: OphthalmoscopeControl }) {
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
    {powered && <spotLight userData={{ instrumentLight: true }} position={[0, .17, .032]} target={target} color="#ffd493" intensity={1.6} distance={1.4} angle={scopeControl ? scopeBeamAngle(scopeControl.aperture) : .08} penumbra={.4} />}
    {ophthalmo && scopeControl && <group position={[0, .10, -.023]} rotation={[0, Math.PI, 0]}
      onClick={event => { event.stopPropagation(); scopeControl.cycle(); }}
      userData={{ xrInstrumentControl: "fundus", xrInteractiveSurface: true, xrButton: true, xrWidth: .052, xrHeight: .056, xrLabel: "APERTURE WHEEL", xrAction: scopeControl.cycle, scopeAperture: scopeControl.aperture }}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.027, .027, .010, 24]} /><meshStandardMaterial color="#76908d" roughness={.65} /></mesh>
      <mesh position={[0, 0, .007]}><circleGeometry args={[.025, 32]} /><meshBasicMaterial color="#203b3c" /></mesh>
      <group rotation={[0, 0, scopeControl.aperture === "large" ? -2 * Math.PI / 3 : 2 * Math.PI / 3]}>
        <mesh position={[0, .019, .009]}><boxGeometry args={[.004, .010, .003]} /><meshBasicMaterial color="#f9d178" /></mesh>
      </group>
      <mesh position={[-.012, -.008, .008]}><circleGeometry args={[.003, 16]} /><meshBasicMaterial color={scopeControl.aperture === "small" ? "#f9d178" : "#a3b6b1"} /></mesh>
      <mesh position={[.012, -.008, .008]}><circleGeometry args={[.007, 20]} /><meshBasicMaterial color={scopeControl.aperture === "large" ? "#f9d178" : "#a3b6b1"} /></mesh>
    </group>}
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
