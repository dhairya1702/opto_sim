import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { StrictMode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Group, MathUtils, Vector3 } from "three";
import { ConsultationInstrumentModel } from "./scene/ConsultationInstruments";
import { XRSign } from "./scene/XRClinicPanels";
import type { ConsultationToolId } from "./interaction/xrConsultationTools";
import "./wall-instrument-mock.css";

type ZoneId = "diagnostic" | "scopes" | "sensory" | "binocular";
type ToolStudy = { id: ConsultationToolId; label: string; shortLabel: string; zone: ZoneId; scale?: number; rotation?: [number, number, number] };

const zones: readonly { id: ZoneId; label: string; color: string }[] = [
  { id: "diagnostic", label: "01 · DIAGNOSTIC", color: "#75bbae" },
  { id: "scopes", label: "02 · SCOPES + REFRACTION", color: "#d6a44d" },
  { id: "sensory", label: "03 · SENSORY", color: "#8babc2" },
  { id: "binocular", label: "04 · BINOCULAR VISION", color: "#b68aa8" },
];

const tools: readonly ToolStudy[] = [
  { id: "distance", label: "Acuity occluder", shortLabel: "ACUITY OCCLUDER", zone: "diagnostic", scale: .92 },
  { id: "pinhole", label: "Pinhole occluder", shortLabel: "PINHOLE", zone: "diagnostic", scale: .92 },
  { id: "cover", label: "Cover occluder", shortLabel: "COVER", zone: "diagnostic", scale: .92 },
  { id: "pupils", label: "Penlight", shortLabel: "PENLIGHT", zone: "diagnostic", scale: 1.08 },
  { id: "motility", label: "Motility target", shortLabel: "MOTILITY TARGET", zone: "diagnostic", scale: 1.02 },

  { id: "objective", label: "Retinoscope", shortLabel: "RETINOSCOPE", zone: "scopes", scale: 1.1 },
  { id: "fundus", label: "Ophthalmoscope", shortLabel: "OPHTHALMOSCOPE", zone: "scopes", scale: 1.1 },
  { id: "near", label: "Near vision card", shortLabel: "NEAR CARD", zone: "scopes", scale: .82, rotation: [0, 0, 0] },
  { id: "subjective", label: "Trial frame", shortLabel: "TRIAL FRAME", zone: "scopes", scale: .94 },
  { id: "prism", label: "Prism bar", shortLabel: "PRISM BAR", zone: "scopes", scale: .84 },

  { id: "worth", label: "Worth four-dot target", shortLabel: "WORTH TARGET", zone: "sensory", scale: .98 },
  { id: "red-green", label: "Red / green glasses", shortLabel: "RED + GREEN", zone: "sensory", scale: .98 },
  { id: "polarised", label: "Polarised glasses", shortLabel: "POLARISED", zone: "sensory", scale: .98 },
  { id: "stereo", label: "Circle stereo booklet", shortLabel: "STEREO BOOKLET", zone: "sensory", scale: .9 },
  { id: "maddox", label: "Maddox rod", shortLabel: "MADDOX ROD", zone: "sensory", scale: 1.05 },

  { id: "thorington", label: "Thorington card", shortLabel: "THORINGTON", zone: "binocular", scale: .82 },
  { id: "trial-lens", label: "Trial lens pair", shortLabel: "TRIAL LENSES", zone: "binocular", scale: .96 },
  { id: "lens-flipper", label: "±2 D lens flipper", shortLabel: "LENS FLIPPER", zone: "binocular", scale: .96 },
  { id: "prism-flipper", label: "12 BO / 3 BI flipper", shortLabel: "PRISM FLIPPER", zone: "binocular", scale: .96 },
  { id: "fixation", label: "Fixation target", shortLabel: "FIXATION TARGET", zone: "binocular", scale: 1.02 },
];

const xPositions = [-1.52, -.76, 0, .76, 1.52] as const;
const yPositions = [1.84, 1.29, .74, .19] as const;

function Box({ position = [0, 0, 0], scale = [1, 1, 1], color, radius = 0 }: { position?: [number, number, number]; scale?: [number, number, number]; color: string; radius?: number }) {
  return <mesh position={position} receiveShadow castShadow={radius > 0}>
    <boxGeometry args={scale} />
    <meshStandardMaterial color={color} roughness={.72} metalness={.04} />
  </mesh>;
}

function ToolMount({ tool, position, selected, muted, onSelect }: {
  tool: ToolStudy;
  position: [number, number, number];
  selected: boolean;
  muted: boolean;
  onSelect: (id: ConsultationToolId) => void;
}) {
  const root = useRef<Group>(null);
  const home = useMemo(() => new Vector3(...position), [position]);
  const lifted = useMemo(() => new Vector3(position[0], position[1] + .04, .82), [position]);
  useFrame((state, delta) => {
    if (!root.current) return;
    root.current.position.lerp(selected ? lifted : home, 1 - Math.exp(-delta * 8));
    const targetScale = selected ? 1.42 : 1;
    const nextScale = MathUtils.damp(root.current.scale.x, targetScale, 8, delta);
    root.current.scale.setScalar(nextScale);
    root.current.rotation.y = MathUtils.damp(root.current.rotation.y, selected ? Math.sin(state.clock.elapsedTime * .7) * .16 : 0, 7, delta);
  });
  return <group>
    <group position={[position[0], position[1] - .02, .028]}>
      <mesh position={[-.055, -.015, .03]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.013, .004, 8, 22, Math.PI]} /><meshStandardMaterial color="#a8b6b0" metalness={.72} roughness={.3} /></mesh>
      <mesh position={[.055, -.015, .03]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[.013, .004, 8, 22, Math.PI]} /><meshStandardMaterial color="#a8b6b0" metalness={.72} roughness={.3} /></mesh>
      <Box position={[0, -.12, .005]} scale={[.31, .052, .022]} color={selected ? "#d39b42" : "#28484b"} />
      <XRSign text={[tool.shortLabel]} p={[0, -.12, .018]} size={[.285, .036]} bg={selected ? "#d39b42" : "#28484b"} fg={selected ? "#172f31" : "#e7f3ee"} />
    </group>
    <group ref={root} position={position} rotation={tool.rotation ?? [0, 0, 0]} onClick={event => { event.stopPropagation(); onSelect(tool.id); }}>
      <group scale={tool.scale ?? 1}>
        <ConsultationInstrumentModel id={tool.id} powered={selected && (tool.id === "pupils" || tool.id === "motility" || tool.id === "worth")} />
      </group>
      <mesh position={[0, .08, -.025]} visible={false}><boxGeometry args={[.34, .36, .08]} /><meshBasicMaterial /></mesh>
      {selected && <mesh position={[0, .08, -.045]}><ringGeometry args={[.14, .155, 40]} /><meshBasicMaterial color="#f0c66b" transparent opacity={.72} /></mesh>}
    </group>
    {muted && <mesh position={[position[0], position[1] + .07, .46]} onClick={event => { event.stopPropagation(); onSelect(tool.id); }}>
      <planeGeometry args={[.43, .45]} /><meshBasicMaterial color="#102426" transparent opacity={.72} depthWrite={false} />
    </mesh>}
  </group>;
}

function WallStation({ selected, filter, onSelect }: { selected: ConsultationToolId | null; filter: ZoneId | "all"; onSelect: (id: ConsultationToolId) => void }) {
  return <>
    <color attach="background" args={["#e8ede7"]} />
    <fog attach="fog" args={["#e8ede7", 6.5, 10]} />
    <ambientLight intensity={1.25} />
    <hemisphereLight args={["#fffdf2", "#607370", 1.8]} />
    <directionalLight position={[-2.5, 4.5, 4]} intensity={2.8} castShadow shadow-mapSize={[2048, 2048]} />
    <directionalLight position={[3, 2, 3]} color="#a7d9d1" intensity={1.2} />

    <group position={[0, -.05, 0]}>
      <Box position={[0, 1.12, -.11]} scale={[4.22, 2.52, .12]} color="#d9e1d9" />
      <Box position={[-2.14, 1.12, -.04]} scale={[.065, 2.58, .16]} color="#24474a" />
      <Box position={[2.14, 1.12, -.04]} scale={[.065, 2.58, .16]} color="#24474a" />
      <Box position={[0, 2.43, -.04]} scale={[4.34, .065, .16]} color="#24474a" />
      <Box position={[0, -.19, -.04]} scale={[4.34, .065, .16]} color="#24474a" />
      {yPositions.map((y, index) => <group key={y}>
        <Box position={[0, y - .195, -.015]} scale={[4.08, .022, .052]} color="#8da39f" />
        <Box position={[0, y + .24, -.045]} scale={[4.08, .018, .035]} color={zones[index].color} />
        <XRSign text={[zones[index].label]} p={[-1.56, y + .285, .002]} size={[.96, .06]} bg="#24474a" fg={zones[index].color} />
      </group>)}
      {tools.map(tool => {
        const zoneIndex = zones.findIndex(zone => zone.id === tool.zone);
        const index = tools.filter(candidate => candidate.zone === tool.zone).findIndex(candidate => candidate.id === tool.id);
        return <ToolMount key={tool.id} tool={tool} position={[xPositions[index], yPositions[zoneIndex] - .035, .08]} selected={selected === tool.id}
          muted={filter !== "all" && filter !== tool.zone} onSelect={onSelect} />;
      })}
      <Box position={[0, -1.03, -.22]} scale={[7.8, 1.65, .08]} color="#cdd8d1" />
      <Box position={[0, -1.88, 1.2]} scale={[8, .08, 3.2]} color="#bdc9c2" />
    </group>
    <OrbitControls makeDefault target={[0, 1.05, 0]} enablePan={false} minDistance={4.0} maxDistance={7.2} minPolarAngle={1.12} maxPolarAngle={1.78} minAzimuthAngle={-.30} maxAzimuthAngle={.30} />
  </>;
}

function App() {
  const [selected, setSelected] = useState<ConsultationToolId | null>(null);
  const [filter, setFilter] = useState<ZoneId | "all">("all");
  const selectedTool = tools.find(tool => tool.id === selected);

  const select = (id: ConsultationToolId) => setSelected(current => current === id ? null : id);
  const clear = useCallback(() => setSelected(null), []);
  return <Canvas camera={{ position: [0, 1.12, 5.25], fov: 38, near: .01, far: 30 }} shadows dpr={[1, 2]} onPointerMissed={() => setSelected(null)}>
    <WallStation selected={selected} filter={filter} onSelect={select} />
    <UIBridge selectedTool={selectedTool} filter={filter} setFilter={setFilter} clear={clear} />
  </Canvas>;
}

function UIBridge({ selectedTool, filter, setFilter, clear }: {
  selectedTool?: ToolStudy;
  filter: ZoneId | "all";
  setFilter: (value: ZoneId | "all") => void;
  clear: () => void;
}) {
  useEffect(() => {
    const title = document.querySelector<HTMLElement>("#selected-name");
    const note = document.querySelector<HTMLElement>("#selected-note");
    const returnButton = document.querySelector<HTMLButtonElement>("#return-tool");
    if (title) title.textContent = selectedTool ? `${selectedTool.label} is in hand` : "All 20 tools are on the wall";
    if (note) note.textContent = selectedTool
      ? `Selected from ${zones.find(zone => zone.id === selectedTool.zone)?.label.slice(5).toLowerCase()}. Click the tool again or use Return to rack.`
      : "Choose any instrument to pull it forward. Its clinical behavior and controls stay connected when this rack is integrated.";
    if (returnButton) returnButton.disabled = !selectedTool;
  }, [selectedTool]);
  useEffect(() => {
    document.querySelectorAll<HTMLButtonElement>("[data-filter]").forEach(button => {
      button.setAttribute("aria-pressed", String(button.dataset.filter === filter));
    });
  }, [filter]);
  useEffect(() => {
    const clickFilter = (event: Event) => setFilter(((event.currentTarget as HTMLButtonElement).dataset.filter ?? "all") as ZoneId | "all");
    const filterButtons = [...document.querySelectorAll<HTMLButtonElement>("[data-filter]")];
    const returnButton = document.querySelector<HTMLButtonElement>("#return-tool");
    filterButtons.forEach(button => button.addEventListener("click", clickFilter));
    returnButton?.addEventListener("click", clear);
    return () => {
      filterButtons.forEach(button => button.removeEventListener("click", clickFilter));
      returnButton?.removeEventListener("click", clear);
    };
  }, [clear, setFilter]);
  return null;
}

window.addEventListener("error", event => {
  const output = document.querySelector<HTMLElement>("#wall-error");
  if (!output) return;
  output.hidden = false;
  output.textContent = `Wall station preview error: ${event.message}`;
});

const rootElement = document.querySelector<HTMLElement>("#wall-root");
if (!rootElement) throw new Error("Wall station root unavailable.");
createRoot(rootElement).render(<StrictMode><App /></StrictMode>);
