import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Canvas } from "./PracticeWebGLFallback";
import { Check, RotateCcw, Target, X } from "lucide-react";
import { EyeSurface } from "../scene/EyeSurface";

export type VergenceMode = "npc" | "horizontal-distance" | "vertical-distance" | "horizontal-near" | "facility";
import { vergenceFindings as data, npcFindings, vergenceFacilityDelay, npcGaze, prismVergenceGaze, facilityVergenceGaze } from "../interaction/vergencePractice";
type PrismPhase = "blur" | "break" | "recovery";
type NpcPhase = "subjective-break" | "objective-break" | "subjective-recovery" | "objective-recovery";


function Scene({ demand, vertical }: { demand: number; vertical: boolean }) {
  return <>
<color attach="background" args={["#0a171c"]} />
<ambientLight intensity={1.4} />{[-0.22, 0.22].map((x) => <mesh key={x} position={[x, 0, 0]}>
<sphereGeometry args={[0.18, 32, 20]} />
<meshStandardMaterial color="#7d4f2d" />
</mesh>)}<mesh position={[vertical ? 0 : demand / 55, vertical ? demand / 70 : 0, 0.8]}>
<boxGeometry args={[0.12, 0.12, 0.03]} />
<meshBasicMaterial color="#f3e9c8" />
</mesh>
<group position={[0.45, -0.5, 1]}>
<mesh>
<boxGeometry args={[0.2, 0.55, 0.045]} />
<meshPhysicalMaterial color="#9edbd2" transparent opacity={0.45} />
</mesh>
</group>
</>;
}

function NpcScene({ distance, phase }: { distance: number; phase: NpcPhase }) {
  const movement = useRef({ x: 0, y: 0, used: true });
  const od = useRef({ x: 0, y: 0 });
  const os = useRef({ x: 0, y: 0 });
  useFrame((_, delta) => {
    const blend = 1 - Math.exp(-Math.min(delta, 0.1) * 7);
    const gaze = npcGaze(distance, phase);
    od.current.x += (gaze.OD.x - od.current.x) * blend;
    os.current.x += (gaze.OS.x - os.current.x) * blend;
  });
  const targetZ = 1.55 - distance * 0.02;
  const targetScale = 1 + (40 - distance) / 48;
  return <>
    <color attach="background" args={["#0a171c"]} />
<ambientLight intensity={1.35} />
<directionalLight position={[-2, 3, 4]} intensity={2.1} />
    <group position={[0, 0.08, 0]}>
      <mesh scale={[0.65, 0.86, 0.48]}>
<sphereGeometry args={[1, 48, 32]} />
<meshStandardMaterial color="#a97453" roughness={0.88} />
</mesh>
      <mesh position={[0, 0.17, 0.44]} scale={[0.13, 0.25, 0.12]}>
<sphereGeometry args={[1, 24, 16]} />
<meshStandardMaterial color="#9b684a" />
</mesh>
      <group position={[0, 0.12, 0.505]} scale={1.3}>
<EyeSurface x={-0.17} pupils={false} motility={false} progress={0} movement={movement} gazeOffset={od} />
<EyeSurface x={0.17} pupils={false} motility={false} progress={0} movement={movement} gazeOffset={os} />
</group>
      <mesh position={[0, -1.02, -0.05]} scale={[0.82, 0.42, 0.44]}>
<sphereGeometry args={[1, 32, 20]} />
<meshStandardMaterial color="#567685" roughness={0.86} />
</mesh>
    </group>
    <group position={[0, -0.24, targetZ]} scale={targetScale}>
      <mesh>
<cylinderGeometry args={[0.035, 0.045, 0.62, 20]} />
<meshStandardMaterial color="#26363b" metalness={0.4} />
</mesh>
      <mesh position={[0, 0.34, 0]}>
<circleGeometry args={[0.105, 32]} />
<meshStandardMaterial color="#f4f0df" />
</mesh>
      <mesh position={[0, 0.34, 0.006]}>
<ringGeometry args={[0.025, 0.07, 4]} />
<meshBasicMaterial color="#2f756a" />
</mesh>
      <mesh position={[0.08, -0.37, 0.03]} scale={[0.11, 0.17, 0.075]}>
<sphereGeometry args={[1, 20, 14]} />
<meshStandardMaterial color="#a97453" roughness={0.9} />
</mesh>
    </group>
    <group position={[-0.72, -0.3, 1.05]} rotation={[0, 0, -0.25]}>
      <mesh scale={[0.11, 0.17, 0.075]}>
<sphereGeometry args={[1, 20, 14]} />
<meshStandardMaterial color="#a97453" roughness={0.9} />
</mesh>
      <mesh position={[0.18, 0.03, 0]}>
<boxGeometry args={[0.55, 0.055, 0.02]} />
<meshStandardMaterial color="#e8ddbd" />
</mesh>
    </group>
  </>;
}

function DirectPrismScene({
  power,
  base,
  near,
  vertical,
  broken,
  disabled,
  onPowerChange,
  onGrabChange,
}: {
  power: number;
  base: string;
  near: boolean;
  vertical: boolean;
  broken: boolean;
  disabled: boolean;
  onPowerChange: (value: number) => void;
  onGrabChange: (value: boolean) => void;
}) {
  const movement = useRef({ x: 0, y: 0, used: true });
  const od = useRef({ x: 0, y: 0 });
  const os = useRef({ x: 0, y: 0 });
  const drag = useRef({ active: false, y: 0, power: 0 });
  useFrame((_, delta) => {
    const blend = 1 - Math.exp(-Math.min(delta, 0.1) * 7);
    const gaze = prismVergenceGaze(power, base, near, vertical, broken);
    od.current.x += (gaze.OD.x - od.current.x) * blend;
    os.current.x += (gaze.OS.x - os.current.x) * blend;
    od.current.y += (gaze.OD.y - od.current.y) * blend;
    os.current.y += (gaze.OS.y - os.current.y) * blend;
  });
  const setFromPointer = (pointerY: number) => onPowerChange(Math.max(0, Math.min(30, Math.round(drag.current.power + (pointerY - drag.current.y) * 18))));
  return <>
    <color attach="background" args={["#09161b"]} /><ambientLight intensity={1.3} /><directionalLight position={[-2, 3, 4]} intensity={2.1} />
    <group position={[0, 0.08, 0]}>
      <mesh scale={[0.65, 0.86, 0.48]}><sphereGeometry args={[1, 48, 32]} /><meshStandardMaterial color="#a97453" roughness={0.88} /></mesh>
      <mesh position={[0, 0.17, 0.44]} scale={[0.13, 0.25, 0.12]}><sphereGeometry args={[1, 24, 16]} /><meshStandardMaterial color="#9b684a" /></mesh>
      <group position={[0, 0.12, 0.505]} scale={1.3}><EyeSurface x={-0.17} pupils={false} motility={false} progress={0} movement={movement} gazeOffset={od} /><EyeSurface x={0.17} pupils={false} motility={false} progress={0} movement={movement} gazeOffset={os} /></group>
      <mesh position={[0, -1.02, -0.05]} scale={[0.82, 0.42, 0.44]}><sphereGeometry args={[1, 32, 20]} /><meshStandardMaterial color="#567685" roughness={0.86} /></mesh>
    </group>
    <group position={[-0.22, -0.08 - power * 0.012, 0.92]}>
      <mesh><boxGeometry args={[0.2, 1.25, 0.055]} /><meshPhysicalMaterial color="#9edbd2" transparent opacity={0.38} roughness={0.12} /></mesh>
      {Array.from({ length: 11 }, (_, index) => <group key={index} position={[0, 0.5 - index * 0.1, 0.035]}><mesh><circleGeometry args={[0.065, 20]} /><meshPhysicalMaterial color={Math.round(power / 3) === index ? "#d9fff6" : "#73aaa2"} transparent opacity={Math.round(power / 3) === index ? 0.8 : 0.28} /></mesh></group>)}
      <mesh position={[vertical ? 0 : base === "BO" ? -0.08 : 0.08, 0.5 - Math.min(10, Math.round(power / 3)) * 0.1 + (vertical ? base === "BU" ? -0.06 : 0.06 : 0), 0.08]} rotation={[0, 0, vertical ? base === "BU" ? Math.PI : 0 : base === "BO" ? -Math.PI / 2 : Math.PI / 2]}><coneGeometry args={[0.085, 0.16, 3]} /><meshPhysicalMaterial color="#b9eee4" transparent opacity={0.58} /></mesh>
      <mesh position={[0.11, -0.73, 0.02]} scale={[0.12, 0.18, 0.08]}><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color="#a97453" roughness={0.9} /></mesh>
    </group>
    <group position={[0.68, -0.62, near ? 1.12 : 0.82]} rotation={[near ? -0.12 : 0, 0, 0.35]}><mesh scale={[0.11, 0.17, 0.075]}><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color="#a97453" roughness={0.9} /></mesh>{near ? <group position={[-0.08, 0.31, 0]}><mesh><boxGeometry args={[0.42, 0.28, 0.035]} /><meshStandardMaterial color="#f3f0df" roughness={0.72} /></mesh>{[-0.1, 0, 0.1].map((y, index) => <mesh key={y} position={[0, y, 0.021]}><boxGeometry args={[0.27 - index * 0.04, 0.018, 0.006]} /><meshBasicMaterial color="#244843" /></mesh>)}</group> : <mesh position={[-0.04, 0.23, 0]}><boxGeometry args={[0.16, 0.36, 0.035]} /><meshStandardMaterial color="#26363b" /></mesh>}</group>
    <mesh position={[0, 0, 1.35]} onPointerDown={(event) => { if (disabled || event.button !== 0) return; event.stopPropagation(); (event.target as Element).setPointerCapture(event.pointerId); drag.current = { active: true, y: event.pointer.y, power }; onGrabChange(true); }} onPointerMove={(event) => { if (!drag.current.active) return; event.stopPropagation(); setFromPointer(event.pointer.y); }} onPointerUp={(event) => { if (!drag.current.active) return; event.stopPropagation(); drag.current.active = false; (event.target as Element).releasePointerCapture(event.pointerId); onGrabChange(false); }} onPointerCancel={() => { drag.current.active = false; onGrabChange(false); }} onWheel={(event) => { if (disabled) return; event.stopPropagation(); onPowerChange(Math.max(0, Math.min(30, Math.round(power - event.deltaY * 0.025)))); }}><planeGeometry args={[3.2, 2.5]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
  </>;
}

function FacilityScene({ side, clear, running, onFlip }: { side: "BO" | "BI"; clear: boolean; running: boolean; onFlip: () => void }) {
  const movement = useRef({ x: 0, y: 0, used: true });
  const od = useRef({ x: 0, y: 0 });
  const os = useRef({ x: 0, y: 0 });
  useFrame((_, delta) => {
    const blend = 1 - Math.exp(-Math.min(delta, 0.1) * 7);
    const gaze = facilityVergenceGaze(side);
    od.current.x += (gaze.OD.x - od.current.x) * blend;
    os.current.x += (gaze.OS.x - os.current.x) * blend;
  });
  return <>
    <color attach="background" args={["#09161b"]} /><ambientLight intensity={1.3} /><directionalLight position={[-2, 3, 4]} intensity={2.1} />
    <group position={[0, 0.08, 0]}>
      <mesh scale={[0.65, 0.86, 0.48]}><sphereGeometry args={[1, 48, 32]} /><meshStandardMaterial color="#a97453" roughness={0.88} /></mesh>
      <mesh position={[0, 0.17, 0.44]} scale={[0.13, 0.25, 0.12]}><sphereGeometry args={[1, 24, 16]} /><meshStandardMaterial color="#9b684a" /></mesh>
      <group position={[0, 0.12, 0.505]} scale={1.3}><EyeSurface x={-0.17} pupils={false} motility={false} progress={0} movement={movement} gazeOffset={od} /><EyeSurface x={0.17} pupils={false} motility={false} progress={0} movement={movement} gazeOffset={os} /></group>
      <mesh position={[0, -1.02, -0.05]} scale={[0.82, 0.42, 0.44]}><sphereGeometry args={[1, 32, 20]} /><meshStandardMaterial color="#567685" roughness={0.86} /></mesh>
    </group>
    <group position={[-0.26, -0.12, 1]} rotation={[0, side === "BO" ? 0 : Math.PI, side === "BO" ? -0.08 : 0.08]}>
      <mesh><boxGeometry args={[0.54, 0.2, 0.055]} /><meshStandardMaterial color="#294c4b" metalness={0.25} /></mesh>
      <mesh position={[-0.17, 0, 0.04]}><cylinderGeometry args={[0.085, 0.085, 0.035, 24]} /><meshPhysicalMaterial color="#aee6dc" transparent opacity={0.52} /></mesh>
      <mesh position={[0.17, 0, 0.04]}><cylinderGeometry args={[0.085, 0.085, 0.035, 24]} /><meshPhysicalMaterial color="#aee6dc" transparent opacity={0.52} /></mesh>
      <mesh position={[side === "BO" ? -0.17 : 0.17, 0, 0.075]} rotation={[0, 0, side === "BO" ? -Math.PI / 2 : Math.PI / 2]}><coneGeometry args={[0.065, 0.12, 3]} /><meshPhysicalMaterial color="#d4fff6" transparent opacity={0.68} /></mesh>
      <mesh position={[0.38, -0.03, 0]}><boxGeometry args={[0.3, 0.07, 0.05]} /><meshStandardMaterial color="#24373b" /></mesh>
      <mesh position={[0.57, -0.05, 0.02]} scale={[0.12, 0.18, 0.08]}><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color="#a97453" roughness={0.9} /></mesh>
    </group>
    <group position={[0.64, -0.5, 1.18]} rotation={[-0.12, 0, 0.28]}>
      <mesh scale={[0.11, 0.17, 0.075]}><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color="#a97453" roughness={0.9} /></mesh>
      <group position={[-0.08, 0.3, 0]}><mesh><boxGeometry args={[0.42, 0.28, 0.035]} /><meshStandardMaterial color="#f3f0df" /></mesh>{[-0.07, 0, 0.07].map((y) => <mesh key={y} position={[clear ? 0 : -0.018, y, 0.022]}><boxGeometry args={[0.25, 0.018, 0.006]} /><meshBasicMaterial color={clear ? "#244843" : "#617873"} /></mesh>)}</group>
    </group>
    <mesh position={[0, 0, 1.4]} onPointerDown={(event) => { if (!running || !clear || event.button !== 0) return; event.stopPropagation(); onFlip(); }}><planeGeometry args={[3.2, 2.5]} /><meshBasicMaterial transparent opacity={0} depthWrite={false} /></mesh>
  </>;
}

export function VergencePracticeStage({ mode, onClose, onComplete }: { mode: VergenceMode; onClose: () => void; onComplete: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null); const lastFlipAt = useRef(0);
  const [correction, setCorrection] = useState(false); const [fixation, setFixation] = useState(false);
  const [base, setBase] = useState(mode === "vertical-distance" ? "BU" : "BI"); const [power, setPower] = useState(0);
  const [prismPhase, setPrismPhase] = useState<PrismPhase>("blur"); const [npcPhase, setNpcPhase] = useState<NpcPhase>("subjective-break");
  const [distance, setDistance] = useState(40); const [completed, setCompleted] = useState<Record<string, string>>({});
  const [seconds, setSeconds] = useState(60); const [running, setRunning] = useState(false); const [cycles, setCycles] = useState(0); const [side, setSide] = useState<"BO" | "BI">("BO");
  const [facilityClear, setFacilityClear] = useState(false);
  const [done, setDone] = useState(false);
  const [grabbed, setGrabbed] = useState(false); const dragStart = useRef({ y: 0, distance: 40 });
  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  useEffect(() => { if (!running) return; const timer = window.setInterval(() => setSeconds((value) => { if (value <= 1) { window.clearInterval(timer); setRunning(false); return 0; } return value - 1; }), 1000); return () => window.clearInterval(timer); }, [running]);
  useEffect(() => {
    setFacilityClear(false);
    if (!running) return;
    const timer = window.setTimeout(() => setFacilityClear(true), vergenceFacilityDelay[side]);
    return () => window.clearTimeout(timer);
  }, [running, side]);

  const npc = mode === "npc", directPrism = mode === "horizontal-distance" || mode === "horizontal-near" || mode === "vertical-distance", facility = mode === "facility", near = mode === "horizontal-near" || facility || npc, vertical = mode === "vertical-distance";
  const order = npc || facility ? [] : Object.keys(data[mode]); const expected = npc || facility ? null : data[mode][base];
  const effectivePrismPhase: PrismPhase = expected?.blur === null && prismPhase === "blur" ? "break" : prismPhase; const ready = correction && fixation && !done;
  const npcThresholds: Record<NpcPhase, boolean> = { "subjective-break": distance <= npcFindings["subjective-break"], "objective-break": distance <= npcFindings["objective-break"], "subjective-recovery": distance >= npcFindings["subjective-recovery"], "objective-recovery": distance >= npcFindings["objective-recovery"] };
  const reached = npc ? npcThresholds[npcPhase] : expected ? effectivePrismPhase === "blur" ? power >= (expected.blur ?? expected.break) : effectivePrismPhase === "break" ? power >= expected.break : power <= expected.recovery : false;
  const patient = done ? "Guided measurement complete. Review the recorded endpoints or close this view." : npc ? npcPhase.includes("break") ? distance <= 6 ? "Patient reports diplopia; watch for the first eye drifting out." : "Target remains single and both eyes hold fixation." : distance >= 8 ? "Patient reports single vision; watch for binocular realignment." : "Target remains double." : facility ? !running ? "Start the timed run when fixation is stable." : facilityClear ? "Patient reports the line is clear and single. Flip now." : `Patient is clearing the ${side === "BO" ? "12Δ base-out" : "3Δ base-in"} demand…` : effectivePrismPhase === "recovery" ? power <= (expected?.recovery ?? -1) ? "Patient reports single vision again." : "Target remains double." : power >= (expected?.break ?? 99) ? "Patient reports sustained diplopia." : expected?.blur !== null && power >= (expected?.blur ?? 99) ? "Patient reports sustained blur; continue increasing toward break." : "Target remains clear and single.";
  const resetCurrentRun = () => { if (done) return; setPower(0); setDistance(40); setPrismPhase("blur"); setNpcPhase("subjective-break"); setSeconds(60); setRunning(false); setCycles(0); setSide("BO"); setFacilityClear(false); lastFlipAt.current = 0; };
  const finish = () => { if (done) return; setDone(true); setRunning(false); onComplete(); };
  const recordNpc = () => { if (!ready || !reached) return; if (npcPhase === "subjective-break") setNpcPhase("objective-break"); else if (npcPhase === "objective-break") setNpcPhase("subjective-recovery"); else if (npcPhase === "subjective-recovery") setNpcPhase("objective-recovery"); else finish(); };
  const recordPrism = () => {
    if (!ready || !reached || !expected) return;
    if (effectivePrismPhase === "blur") { setPrismPhase("break"); return; }
    if (effectivePrismPhase === "break") { setPrismPhase("recovery"); return; }
    const result = `${expected.blur === null ? "X" : `${expected.blur}Δ`}/${expected.break}Δ/${expected.recovery}Δ`; const next = { ...completed, [base]: result }; setCompleted(next);
    const nextBase = order.find((candidate) => !next[candidate]); if (!nextBase) { finish(); return; } setBase(nextBase); setPower(0); setPrismPhase("blur");
  };
  const startFacility = () => { setSeconds(60); setCycles(0); setSide("BO"); setFacilityClear(false); lastFlipAt.current = performance.now(); setRunning(true); };
  const flipFacility = () => { const now = performance.now(); if (!running || !facilityClear || now - lastFlipAt.current < 400) return; lastFlipAt.current = now; setFacilityClear(false); if (side === "BI") setCycles((value) => value + 1); setSide((value) => value === "BO" ? "BI" : "BO"); };
  const recordLabel = npc ? npcPhase === "subjective-break" ? "Record subjective break" : npcPhase === "objective-break" ? "Record objective break" : npcPhase === "subjective-recovery" ? "Record subjective recovery" : "Record objective recovery" : effectivePrismPhase === "blur" ? "Record first sustained blur" : effectivePrismPhase === "break" ? "Record break" : "Record recovery";
  const setNpcDistance = (value: number) => { if (!done) setDistance(Math.max(2, Math.min(40, Math.round(value)))); };
  const setPrismPower = (value: number) => { if (!done) setPower(Math.max(0, Math.min(30, Math.round(value)))); };
  const prismBroken = Boolean(expected && effectivePrismPhase === "recovery" && power > expected.recovery);

  return <dialog ref={dialog} className="clinical-practice-dialog" onCancel={(event) => { event.preventDefault(); onClose(); }}>
<header className="clinical-stage-header">
<div>
<p className="eyebrow">LIVE PRACTICE · VERGENCE</p>
<h1>{npc ? "Near point of convergence" : facility ? "Fusional vergence facility at near" : vertical ? "Vertical fusional vergence at distance" : near ? "Horizontal fusional vergence at near" : "Horizontal fusional vergence at distance"}</h1>
</div>
<button className="secondary" onClick={onClose}>
<X size={16} />Close</button>
</header>
<div className="clinical-stage-body">
<div className="clinical-viewport-wrap">
<div className={`clinical-viewport ${npc ? "npc-practice-viewport" : ""} ${directPrism ? "prism-practice-viewport" : ""} ${facility ? "facility-practice-viewport" : ""} ${grabbed ? "is-grabbed" : ""}`} tabIndex={npc || directPrism || facility ? 0 : undefined} role={npc || directPrism || facility ? "application" : undefined} aria-label={npc ? "Near point of convergence target. Drag vertically, use the mouse wheel, or press the up and down arrow keys to change its distance." : directPrism ? `${vertical ? "Vertical distance" : `Horizontal ${near ? "near" : "distance"}`} vergence prism bar. Drag the bar vertically, use the mouse wheel, or press the up and down arrow keys to change prism power.` : facility ? "Near vergence facility flipper. When the target becomes clear and single, click the flipper or press Space to rotate it." : undefined} onPointerDown={npc ? (event) => { if (event.button !== 0) return; event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); dragStart.current = { y: event.clientY, distance }; setGrabbed(true); } : undefined} onPointerMove={npc ? (event) => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; setNpcDistance(dragStart.current.distance + (event.clientY - dragStart.current.y) * 0.12); } : undefined} onPointerUp={npc ? (event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); setGrabbed(false); } : undefined} onPointerCancel={npc ? () => setGrabbed(false) : undefined} onLostPointerCapture={npc ? () => setGrabbed(false) : undefined} onWheel={npc ? (event) => { event.preventDefault(); setNpcDistance(distance + event.deltaY * 0.025); } : undefined} onKeyDown={npc || directPrism || facility ? (event) => { if (facility && event.key === " ") { event.preventDefault(); flipFacility(); return; } if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return; event.preventDefault(); if (npc) setNpcDistance(distance + (event.key === "ArrowUp" ? -1 : 1)); else if (directPrism) setPrismPower(power + (event.key === "ArrowUp" ? 1 : -1)); } : undefined}>
<Canvas camera={{ position: [0, 0, 2.5], fov: 40 }}>{npc ? <NpcScene distance={distance} phase={npcPhase} /> : directPrism ? <DirectPrismScene power={power} base={base} near={mode === "horizontal-near"} vertical={vertical} broken={prismBroken} disabled={!ready} onPowerChange={setPrismPower} onGrabChange={setGrabbed} /> : facility ? <FacilityScene side={side} clear={facilityClear} running={running} onFlip={flipFacility} /> : <Scene demand={power} vertical={vertical} />}</Canvas>{npc && <>
<div className="npc-distance-hud">
<span>SPECTACLE PLANE</span>
<strong>{distance} cm</strong>
<i style={{ height: `${Math.max(8, (40 - distance) / 38 * 100)}%` }} />
</div>
<div className="viewport-controls">Drag ↑ toward patient · drag ↓ to recover · wheel/arrows</div>
</>}{directPrism && <><div className="prism-power-hud"><span>{base}</span><strong>{power}Δ</strong><i style={{ height: `${Math.max(3, power / 30 * 100)}%` }} /></div><div className="viewport-controls">Grip prism bar · drag ↑ increase · drag ↓ decrease · arrows</div></>}{facility && <><div className={`facility-hud ${facilityClear ? "clear" : ""}`}><span>{side === "BO" ? "12Δ BO" : "3Δ BI"}</span><strong>{facilityClear ? "CLEAR + SINGLE" : running ? "CLEARING…" : "READY"}</strong><small>{seconds}s · {cycles} cycles</small></div><div className="viewport-controls">Click flipper or press Space when clear + single</div></>}<div className="hand-readout">
<span>
<b>R</b>{npc ? "Grip accommodative target" : directPrism ? `Hold ${base} prism bar before OD` : facility ? `Hold ${side === "BO" ? "12Δ BO" : "3Δ BI"} flipper` : "Adjust prism"}</span>
<span>
<b>L</b>{npc ? "Measure from spectacle plane" : directPrism ? near ? "Hold near card at 40 cm" : "Monitor eyes + patient response" : facility ? "Hold near card at 40 cm" : "Maintain alignment"}</span>
</div>
</div>
<div className={`clinical-coach ${reached ? "ready" : ""}`}>
<span>
<Target />
</span>
<p>
<b>Patient response</b>{patient}</p>
</div>
</div>
<aside className="clinical-control-rail">
<section>
<button className={correction ? "task-button done" : "task-button"} disabled={done} onClick={() => setCorrection(true)}>
<Check />
<span>
<b>{near ? "Near" : "Distance"} correction</b>
<small>Correction in place</small>
</span>
</button>
<button className={fixation ? "task-button done" : "task-button"} disabled={done} onClick={() => setFixation(true)}>
<Target />
<span>
<b>Fixation established</b>
<small>Isolated appropriate target</small>
</span>
</button>
</section>{npc ? <section>
<p className="eyebrow">DIRECT HAND CONTROL</p>
<p className="neutral-message">Grip the target in the patient view. Move inward for both break endpoints, then reverse and move outward for both recovery endpoints.</p>
<label className="distance-control">Accessible distance control · {distance} cm<input type="range" min="2" max="40" value={distance} onChange={(event) => setNpcDistance(+event.target.value)} />
</label>
<button className="primary full" disabled={!ready || !reached} onClick={recordNpc}>{recordLabel}</button>
</section> : facility ? <section>
<p className="eyebrow">DIRECT FLIPPER CONTROL</p>
<p className="neutral-message">Hold the near card steady. When the line becomes clear and single, rotate the flipper in the patient view. One 12Δ BO + 3Δ BI pair counts as one cycle.</p>
<p>{seconds}s · {cycles} cycles · {side === "BO" ? "12Δ BO" : "3Δ BI"}</p>
<button className="primary full" disabled={!ready || running || seconds === 0} onClick={startFacility}>Start 60-second test</button>
<button className="secondary full" disabled={!running || !facilityClear} onClick={flipFacility}>{facilityClear ? "Clear + single · flip" : "Wait for target to clear"}</button>
<button className="primary full" disabled={seconds !== 0 || done} onClick={finish}>Record {cycles} cpm</button>
</section> : <section>
<div className="site-switch">{order.map((value, index) => { const priorComplete = index === 0 || Boolean(completed[order[index - 1]]); return <button key={value} className={base === value ? "selected" : ""} disabled={Boolean(completed[value]) || !priorComplete} onClick={() => { setBase(value); setPower(0); setPrismPhase("blur"); }}>{completed[value] ? `✓ ${value}` : value}</button>; })}</div>
{directPrism && <><p className="eyebrow">DIRECT PRISM-BAR CONTROL</p><p className="neutral-message">{near ? "Keep the accommodative card at 40 cm with the free hand. " : ""}Grip the {vertical ? "base-up/base-down" : "base-in/base-out"} prism bar in the patient view. Slide upward to increase demand; after break, reverse and slide down to recovery.</p></>}<label>{directPrism ? "Accessible prism control" : "Prism"} · {power}Δ<input type="range" min="0" max="30" value={power} onChange={(event) => setPrismPower(+event.target.value)} />
</label>
<p className="neutral-message">{effectivePrismPhase === "recovery" ? "Now reduce prism until single." : expected?.blur === null ? "No blur endpoint expected (X). Increase to break." : "Increase prism: record blur before break."}</p>
<button className="primary full" disabled={!ready || !reached} onClick={recordPrism}>{recordLabel}</button>
</section>}{done && <p className="neutral-message success">Guided practice complete.</p>}<button className="reset-technique" disabled={done} onClick={resetCurrentRun}>
<RotateCcw />Reset current run</button>
</aside>
</div>
</dialog>;
}
