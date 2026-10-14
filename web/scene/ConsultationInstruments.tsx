import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, Group, Mesh, Object3D, Quaternion, Vector3, type Material } from "three";
import { Box, NearVisionCard, Paddle, Retinoscope, Sign } from "./Models";
import { MotilityTargetModel, PenlightModel, PrismBarModel, TrialFrameModel } from "./ExamInstrumentModels";
import { XRScopeOptics, type FundusScopeView, type BrucknerScopeView } from "./XRScopeOptics";
import { LibraryInstrumentModel, type ClinicInstrumentSettings } from "./LibraryClinicEquipment";
import { SensoryInstrumentModel } from "./SensoryClinicEquipment";
import type { OphthalmoscopeControl } from "../interaction/xrScopeEquipment";
import { XRSign } from "./XRClinicPanels";
import { CONSULTATION_EQUIPMENT, consultationToolDefinition, type ConsultationToolId, type ConsultationTools } from "../interaction/xrConsultationTools";
import { INSTRUMENT_KIT_ROTATION_Y } from "../interaction/clinicLayout";
import { krimskyPrismCellY, krimskyPrismPowerIndex } from "../interaction/xrKrimskyPractice";

/** One canonical model per instrument, shared by resting and held placement. */
export function ConsultationInstrumentModel({ id, powered, fundusView, brucknerView, scopeControl, settings }: { settings?: ClinicInstrumentSettings; scopeControl?: OphthalmoscopeControl; id: ConsultationToolId; powered: boolean; fundusView?: FundusScopeView; brucknerView?: BrucknerScopeView }) {
  const lightTarget = useMemo(() => {
    const target = new Object3D();
    target.position.set(0, .7, 0);
    return target;
  }, []);
  if (["maddox", "thorington", "trial-lens", "lens-flipper", "prism-flipper", "fixation"].includes(id)) return <LibraryInstrumentModel id={id} setting={settings?.[id]} />;
  if (["worth", "red-green", "polarised", "stereo"].includes(id)) return <SensoryInstrumentModel id={id} powered={powered} point={settings?.[id]?.point}
    onPowerChange={settings?.[id]?.onPowerChange} />;
  if (id === "prism") {
    const selectedPower = settings?.prism?.power;
    const anchorPower = settings?.prism?.anchorPower;
    const selectedY = selectedPower === undefined ? .143 : krimskyPrismCellY(selectedPower);
    const apertureY = anchorPower === undefined ? selectedY : krimskyPrismCellY(anchorPower);
    const barOffsetY = apertureY - selectedY;
    const baseLabel = settings?.prism?.base === "BI" ? "← BASE IN · BI" : settings?.prism?.base === "BO" ? "BASE OUT · BO →" : "← BI · BO →";
    return <group><group position={[0, barOffsetY, 0]} userData={{ xrPrismSlidingBar: true }}><PrismBarModel selectedIndex={selectedPower === undefined ? 4 : krimskyPrismPowerIndex(selectedPower)} /></group>{settings?.prism && <XRSign text={[`${selectedPower ?? 0}Δ`, baseLabel]} p={[0, .045, .02]} size={[.14, .045]} bg="#173a3e" fg="#e8fff9"/>}
    <mesh position={[0, apertureY, .026]} renderOrder={1160} userData={{ xrPrismWorkingCell: true, xrPrismPower: selectedPower, xrPrismAligned: settings?.prism?.aligned }}>
      <ringGeometry args={[.027, .030, 32]} /><meshBasicMaterial color={settings?.prism?.aligned ? "#71f5bd" : "#e5b55a"} side={DoubleSide} depthTest={false} depthWrite={false} />
    </mesh>
    {settings?.prism?.aligned && <mesh position={[0, apertureY, .024]} renderOrder={1159}>
      <circleGeometry args={[.0265, 40]} /><meshBasicMaterial color="#c8f7ee" transparent opacity={.07} side={DoubleSide} depthWrite={false} />
    </mesh>}
    {settings?.prism?.aligned && settings.prism.showReflex && <mesh position={[settings.prism.reflexOffset ?? 0, apertureY + .004, .029]} renderOrder={1161} userData={{ xrPrismReflexWindow: true }}>
      <circleGeometry args={[.0032, 24]} /><meshBasicMaterial color="#fff7bd" depthTest={false} depthWrite={false} />
    </mesh>}
  </group>;
  }
  if (id === "distance" || id === "pinhole" || id === "cover") {
    return <group rotation={[Math.PI / 2, 0, 0]}><Paddle p={[0, 0, -.06]} pinhole={id === "pinhole"} cover={id === "cover"} /></group>;
  }
  if (id === "objective" || id === "fundus") return <group>
    <Retinoscope p={[0, -.1, 0]} r={[0, 0, 0]} ophthalmo={id === "fundus"} showApertureSelector={id !== "fundus"} />
    <XRScopeOptics powered={powered} ophthalmo={id === "fundus"} view={fundusView} brucknerView={id === "fundus" ? brucknerView : undefined} scopeControl={id === "fundus" ? scopeControl : undefined} />
  </group>;
  if (id === "near") return <NearVisionCard r={[Math.PI / 2, 0, 0]} />;
  if (id === "subjective") return <TrialFrameModel />;
  const target = id === "motility";
  return <group>
    {target ? <MotilityTargetModel powered={powered} /> : <PenlightModel powered={powered} />}
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

function InstrumentInstance({ id, state, highlighted, returnedAt, register, selectable, castsShadow, fundusView, brucknerView, scopeControl, settings }: {
  settings?: ClinicInstrumentSettings; scopeControl?: OphthalmoscopeControl;
  fundusView?: FundusScopeView; brucknerView?: BrucknerScopeView;
  id: ConsultationToolId;
  state: ConsultationTools;
  highlighted: boolean;
  selectable: boolean;
  castsShadow: boolean;
  returnedAt?: number;
  register: (id: ConsultationToolId, object: Group | null) => void;
}) {
  const root = useRef<Group>(null);
  const materials = useRef<{ material: Material; opacity: number }[]>([]);
  const originalOpacity = useRef(new WeakMap<Material, number>());
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia("(prefers-reduced-motion: reduce)").matches);
  const tool = state[id];
  const placement = tool.placement;
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
      object.castShadow = castsShadow;
      const entries = Array.isArray(object.material) ? object.material : [object.material];
      entries.forEach(material => {
        if (!originalOpacity.current.has(material)) originalOpacity.current.set(material, material.opacity);
        list.set(material, originalOpacity.current.get(material) ?? material.opacity);
        material.transparent = true;
      });
    });
    materials.current = [...list].map(([material, opacity]) => ({ material, opacity }));
  }, [castsShadow, tool.powered]);
  useFrame(() => {
    const alpha = returnedAt && !reducedMotion ? Math.min(1, Math.max(0, (performance.now() - returnedAt) / 180)) : 1;
    materials.current.forEach(({ material, opacity }) => { material.opacity = opacity * alpha; });
  });
  return <group ref={object => { root.current = object; register(id, object); }}
    position={placement.kind === "held" ? undefined : [...placement.position]}
    quaternion={placement.kind === "held" ? undefined : [...placement.rotation]}
    userData={{ consultationToolId: id, examId: selectable ? id : undefined, xrIgnoreRay: placement.kind === "held", station: "trolley" }}>
    <ConsultationInstrumentModel id={id} powered={tool.powered} fundusView={fundusView} brucknerView={brucknerView} scopeControl={scopeControl} settings={settings} />
    {highlighted && <mesh position={[0, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
      <ringGeometry args={[.025, .036, 20]} /><meshBasicMaterial color="#8df5d3" side={DoubleSide} depthTest={false} />
    </mesh>}
  </group>;
}

/** Desktop presentation of the same canonical model used by the XR hands. */
export function DesktopHeldInstrument({ id }: { id: ConsultationToolId }) {
  const root = useRef<Group>(null);
  const age = useRef(0);
  const grip = useMemo(() => new Quaternion(...consultationToolDefinition(id).gripRotation), [id]);
  useFrame(({ camera }, dt) => {
    if (!root.current) return;
    age.current = Math.min(1, age.current + dt * 2);
    const offset = new Vector3(
      .29,
      -.32 + (1 - Math.sin((age.current * Math.PI) / 2)) * .3,
      -.55,
    ).applyQuaternion(camera.quaternion);
    root.current.position.copy(camera.position).add(offset);
    root.current.quaternion.copy(camera.quaternion).multiply(grip);
  });
  return <group ref={root}><ConsultationInstrumentModel id={id} powered={false} /></group>;
}

export function ConsultationInstruments({ state, highlighted, returnedAt, register, equipment = CONSULTATION_EQUIPMENT, selectable = CONSULTATION_EQUIPMENT.filter(id => id !== "prism"), castsShadow = true, fundusView, brucknerView, scopeControl, settings }: {
  settings?: ClinicInstrumentSettings; scopeControl?: OphthalmoscopeControl;
  fundusView?: FundusScopeView; brucknerView?: BrucknerScopeView;
  state: ConsultationTools;
  equipment?: readonly ConsultationToolId[];
  selectable?: readonly ConsultationToolId[];
  castsShadow?: boolean;
  highlighted: readonly ConsultationToolId[];
  returnedAt: Partial<Record<ConsultationToolId, number>>;
  register: (id: ConsultationToolId, object: Group | null) => void;
}) {
  return <>
    {equipment.map(id => consultationToolDefinition(id)).map(tool => <InstrumentInstance key={tool.id} id={tool.id} state={state} highlighted={highlighted.includes(tool.id)} returnedAt={returnedAt[tool.id]} register={register} selectable={selectable.includes(tool.id)} castsShadow={castsShadow} fundusView={fundusView} brucknerView={brucknerView} scopeControl={scopeControl} settings={settings} />)}
    {equipment.map(id => consultationToolDefinition(id)).map(tool => <group key={`socket-${tool.id}`} position={[tool.home[0], tool.home[1] - tool.restHeight + .005, tool.home[2]]} rotation={[0, tool.homeYaw ?? INSTRUMENT_KIT_ROTATION_Y, 0]} userData={{ xrIgnoreRay: true }}>
      <Box s={[tool.footprint[0], .008, tool.footprint[1]]} c="#39565b" radius={.004} />
      {tool.id === "subjective" && <Box p={[0, .018, 0]} s={[.18, .027, .04]} c="#39565b" radius={.004} />}
      <Sign fit text={[tool.label]} p={[0, .006, tool.footprint[1] / 2 + .013]} size={[Math.max(.10, tool.footprint[0]), .023]} rotation={[-Math.PI / 2, 0, 0]} bg="#173a3e" fg="#e8fff9" />
    </group>)}
  </>;
}
