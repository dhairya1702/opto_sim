import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, Group, Mesh, Object3D, type Material } from "three";
import { Box, Cylinder, NearVisionCard, Paddle, Retinoscope, Ring, Sign } from "./Models";
import { XRScopeOptics, type FundusScopeView, type BrucknerScopeView } from "./XRScopeOptics";
import { XRPrismBar } from "../practice/xr/XRClinicTools";
import { CONSULTATION_TOOLS, type ConsultationToolId, type ConsultationTools } from "../interaction/xrConsultationTools";

/** One canonical model per instrument, shared by resting and held placement. */
export function ConsultationInstrumentModel({ id, powered, fundusView, brucknerView }: { id: ConsultationToolId; powered: boolean; fundusView?: FundusScopeView; brucknerView?: BrucknerScopeView }) {
  const lightTarget = useMemo(() => {
    const target = new Object3D();
    target.position.set(0, .7, 0);
    return target;
  }, []);
  if (id === "prism") return <group><XRPrismBar />
    <mesh position={[0, .143, .025]} userData={{ xrPrismWorkingCell: true }}>
      <ringGeometry args={[.027, .030, 24]} /><meshBasicMaterial color="#e5b55a" side={DoubleSide} />
    </mesh>
  </group>;
  if (id === "distance" || id === "pinhole" || id === "cover") {
    return <group rotation={[Math.PI / 2, 0, 0]}><Paddle p={[0, 0, -.06]} pinhole={id === "pinhole"} /></group>;
  }
  if (id === "objective" || id === "fundus") return <group>
    <Retinoscope p={[0, -.1, 0]} r={[0, 0, 0]} ophthalmo={id === "fundus"} />
    <XRScopeOptics powered={powered} ophthalmo={id === "fundus"} view={fundusView} brucknerView={id === "fundus" ? brucknerView : undefined} />
  </group>;
  if (id === "near") return <NearVisionCard r={[Math.PI / 2, 0, 0]} />;
  if (id === "subjective") return <group>
    <Ring p={[-.078, 0, 0]} c="#922e2e" /><Ring p={[.078, 0, 0]} c="#283948" />
    <Box p={[0, .017, 0]} s={[.035, .012, .02]} c="#b2bab9" />
    <Cylinder p={[-.148, 0, -.08]} h={.16} radius={.006} r={[Math.PI / 2, 0, 0]} />
    <Cylinder p={[.148, 0, -.08]} h={.16} radius={.006} r={[Math.PI / 2, 0, 0]} />
  </group>;
  const target = id === "motility";
  return <group>
    <Cylinder h={.22} radius={target ? .009 : .017} c={target ? "#667b8b" : "#c7d1ce"} />
    <Cylinder p={[0, .12, 0]} h={.025} radius={target ? .016 : .021} c="#283a3d" />
    <mesh position={[0, .137, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[target ? .014 : .012, 20]} />
      <meshBasicMaterial color={powered ? "#fff1a8" : target ? "#d65347" : "#c4c9bd"} side={DoubleSide} />
    </mesh>
    <primitive object={lightTarget} />
    {powered && <>
      <mesh position={[0, .437, 0]} rotation={[Math.PI, 0, 0]}>
        <coneGeometry args={[.08, .6, 16, 1, true]} />
        <meshBasicMaterial color="#ffe69a" transparent opacity={.10} side={DoubleSide} depthWrite={false} />
      </mesh>
      <spotLight userData={{ instrumentLight: true }} position={[0, .137, 0]} target={lightTarget} color="#fff0ad" intensity={1.4} distance={1.2} angle={.14} penumbra={.5} />
    </>}
  </group>;
}

function InstrumentInstance({ id, state, highlighted, returnedAt, register, fundusView, brucknerView }: {
  fundusView?: FundusScopeView; brucknerView?: BrucknerScopeView;
  id: ConsultationToolId;
  state: ConsultationTools;
  highlighted: boolean;
  returnedAt?: number;
  register: (id: ConsultationToolId, object: Group | null) => void;
}) {
  const root = useRef<Group>(null);
  const materials = useRef<{ material: Material; opacity: number }[]>([]);
  const originalOpacity = useRef(new WeakMap<Material, number>());
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const tool = state[id];
  const placement = tool.placement;
  const definition = CONSULTATION_TOOLS.find(candidate => candidate.id === id)!;
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const changed = () => setReducedMotion(preference.matches);
    preference.addEventListener("change", changed);
    return () => preference.removeEventListener("change", changed);
  }, []);
  useEffect(() => {
    const list = new Map<Material, number>();
    root.current?.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const entries = Array.isArray(object.material) ? object.material : [object.material];
      entries.forEach(material => {
        if (!originalOpacity.current.has(material)) originalOpacity.current.set(material, material.opacity);
        list.set(material, originalOpacity.current.get(material) ?? material.opacity);
        material.transparent = true;
      });
    });
    materials.current = [...list].map(([material, opacity]) => ({ material, opacity }));
  }, [tool.powered]);
  useFrame(() => {
    const alpha = returnedAt && !reducedMotion ? Math.min(1, Math.max(0, (performance.now() - returnedAt) / 180)) : 1;
    materials.current.forEach(({ material, opacity }) => { material.opacity = opacity * alpha; });
  });
  return <group ref={object => { root.current = object; register(id, object); }}
    position={placement.kind === "held" ? undefined : [...placement.position]}
    quaternion={placement.kind === "held" ? undefined : [...placement.rotation]}
    userData={{ consultationToolId: id, examId: id === "prism" ? undefined : id, xrIgnoreRay: placement.kind === "held", station: (id === "subjective" || id === "prism") ? "refraction" : id === "fundus" ? "fundus" : "trolley" }}>
    <ConsultationInstrumentModel id={id} powered={tool.powered} fundusView={fundusView} brucknerView={brucknerView} />
    {highlighted && <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <ringGeometry args={[.025, .036, 20]} /><meshBasicMaterial color="#8df5d3" side={DoubleSide} depthTest={false} />
    </mesh>}
    {placement.kind !== "held" && <Sign fit text={[definition.label]} p={[0, -.08, .025]} size={[.13, .025]} bg="#173a3e" fg="#e8fff9" />}
  </group>;
}

export function ConsultationInstruments({ state, highlighted, returnedAt, register, fundusView, brucknerView }: {
  fundusView?: FundusScopeView; brucknerView?: BrucknerScopeView;
  state: ConsultationTools;
  highlighted: readonly ConsultationToolId[];
  returnedAt: Partial<Record<ConsultationToolId, number>>;
  register: (id: ConsultationToolId, object: Group | null) => void;
}) {
  return <>
    {CONSULTATION_TOOLS.map(tool => <InstrumentInstance key={tool.id} id={tool.id} state={state} highlighted={highlighted.includes(tool.id)} returnedAt={returnedAt[tool.id]} register={register} fundusView={fundusView} brucknerView={brucknerView} />)}
    {CONSULTATION_TOOLS.map(tool => <group key={`socket-${tool.id}`} position={[tool.home[0], tool.home[1] - tool.restHeight + .005, tool.home[2]]} userData={{ xrIgnoreRay: true }}>
      <Box s={[tool.footprint[0], .008, tool.footprint[1]]} c="#39565b" radius={.004} />
      <Sign fit text={[tool.label]} p={[0, .006, tool.footprint[1] / 2 + .013]} size={[Math.max(.10, tool.footprint[0]), .023]} rotation={[-Math.PI / 2, 0, 0]} bg="#173a3e" fg="#e8fff9" />
    </group>)}
  </>;
}
