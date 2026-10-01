import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Canvas } from "./PracticeWebGLFallback";
import { Check, Eye, RotateCcw, Ruler, X } from "lucide-react";
import { EyeSurface } from "../scene/EyeSurface";
import { MinusLensPracticeStage } from "./MinusLensPracticeStage";
import { RelativeAccommodationStage } from "./RelativeAccommodationStage";
import { AccommodativeFacilityStage } from "./AccommodativeFacilityStage";

export type AccommodationMode = "push-up" | "minus-lens" | "relative" | "accommodative-facility";
type TestEye = "OD" | "OS" | "OU";

const blurAt: Record<TestEye, number> = { OD: 10, OS: 11, OU: 12 };

function PushUpScene({ distance, eye, blurred }: { distance: number; eye: TestEye; blurred: boolean }) {
  const movement = useRef({ x: 0, y: 0, used: true });
  const od = useRef({ x: 0, y: 0 });
  const os = useRef({ x: 0, y: 0 });
  useFrame((_, delta) => {
    const blend = 1 - Math.exp(-Math.min(delta, 0.1) * 7);
    const convergence = eye === "OU" ? Math.min(0.028, Math.max(0, 40 - distance) * 0.0008) : 0;
    od.current.x += (convergence - od.current.x) * blend;
    os.current.x += (-convergence - os.current.x) * blend;
  });
  const targetZ = 1.55 - distance * 0.02;
  const targetScale = 1 + (40 - distance) / 48;
  return <>
    <color attach="background" args={["#09161b"]} /><ambientLight intensity={1.35} /><directionalLight position={[-2, 3, 4]} intensity={2.1} />
    <group position={[0, 0.08, 0]}>
      <mesh scale={[0.65, 0.86, 0.48]}><sphereGeometry args={[1, 48, 32]} /><meshStandardMaterial color="#a97453" roughness={0.88} /></mesh>
      <mesh position={[0, 0.17, 0.44]} scale={[0.13, 0.25, 0.12]}><sphereGeometry args={[1, 24, 16]} /><meshStandardMaterial color="#9b684a" /></mesh>
      <group position={[0, 0.12, 0.505]} scale={1.3}><EyeSurface x={-0.17} pupils={false} motility={false} progress={0} movement={movement} gazeOffset={od} /><EyeSurface x={0.17} pupils={false} motility={false} progress={0} movement={movement} gazeOffset={os} /></group>
      {eye !== "OU" && <group position={[eye === "OD" ? 0.22 : -0.22, 0.12, 0.69]}><mesh><circleGeometry args={[0.16, 32]} /><meshStandardMaterial color="#1d2c31" roughness={0.4} /></mesh><mesh position={[0, -0.28, 0]}><boxGeometry args={[0.035, 0.36, 0.025]} /><meshStandardMaterial color="#26383c" /></mesh></group>}
      <mesh position={[0, -1.02, -0.05]} scale={[0.82, 0.42, 0.44]}><sphereGeometry args={[1, 32, 20]} /><meshStandardMaterial color="#567685" roughness={0.86} /></mesh>
    </group>
    <group position={[0, -0.18, targetZ]} scale={targetScale}>
      <mesh><boxGeometry args={[0.58, 0.35, 0.035]} /><meshStandardMaterial color="#f3f0df" roughness={0.72} /></mesh>
      {[-0.09, -0.03, 0.03, 0.09].map((y, index) => <group key={y}><mesh position={[blurred ? -0.018 : 0, y, 0.022]}><boxGeometry args={[0.38 - index * 0.045, 0.02, 0.006]} /><meshBasicMaterial color={blurred ? "#70827d" : "#21443f"} transparent opacity={blurred ? 0.58 : 1} /></mesh>{blurred && <mesh position={[0.018, y, 0.021]}><boxGeometry args={[0.38 - index * 0.045, 0.02, 0.006]} /><meshBasicMaterial color="#70827d" transparent opacity={0.35} /></mesh>}</group>)}
      <mesh position={[0.1, -0.33, 0.03]} scale={[0.12, 0.18, 0.08]}><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color="#a97453" roughness={0.9} /></mesh>
    </group>
    <group position={[-0.72, -0.3, 1.05]} rotation={[0, 0, -0.25]}><mesh scale={[0.11, 0.17, 0.075]}><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color="#a97453" roughness={0.9} /></mesh><mesh position={[0.18, 0.03, 0]}><boxGeometry args={[0.55, 0.055, 0.02]} /><meshStandardMaterial color="#e8ddbd" /></mesh>{Array.from({ length: 10 }, (_, index) => <mesh key={index} position={[-0.04 + index * 0.05, 0.03, 0.012]}><boxGeometry args={[0.006, index % 2 ? 0.025 : 0.04, 0.004]} /><meshBasicMaterial color="#735d3e" /></mesh>)}</group>
  </>;
}

export function AccommodationPracticeStage({ mode, onClose, onComplete }: { mode: AccommodationMode; onClose: () => void; onComplete: () => void }) {
  if (mode === "minus-lens") return <MinusLensPracticeStage onClose={onClose} onComplete={onComplete} />;
  if (mode === "relative") return <RelativeAccommodationStage onClose={onClose} onComplete={onComplete} />;
  if (mode === "accommodative-facility") return <AccommodativeFacilityStage onClose={onClose} onComplete={onComplete} />;
  return <OtherAccommodationStage mode={mode} onClose={onClose} onComplete={onComplete} />;
}

function OtherAccommodationStage({ mode, onClose, onComplete }: { mode: AccommodationMode; onClose: () => void; onComplete: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const lastFlipAt = useRef(0);
  const [correction, setCorrection] = useState(false);
  const [fixation, setFixation] = useState(false);
  const [eye, setEye] = useState<TestEye>("OD");
  const [distance, setDistance] = useState(40);
  const [lens, setLens] = useState(0);
  const [phase, setPhase] = useState<"plus" | "minus">("plus");
  const [nra, setNra] = useState<number | null>(null);
  const [seconds, setSeconds] = useState(60);
  const [running, setRunning] = useState(false);
  const [cycles, setCycles] = useState(0);
  const [completed, setCompleted] = useState<Partial<Record<TestEye, string>>>({});
  const [grabbed, setGrabbed] = useState(false);
  const dragStart = useRef({ y: 0, distance: 40 });

  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setSeconds((value) => {
      if (value <= 1) { window.clearInterval(timer); setRunning(false); return 0; }
      return value - 1;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  const facility = mode === "accommodative-facility";
  const push = mode === "push-up";
  const minus = mode === "minus-lens";
  const requiredEyes: TestEye[] = push || facility ? ["OD", "OS", "OU"] : minus ? ["OD", "OS"] : ["OU"];
  const done = requiredEyes.every((value) => completed[value] !== undefined);
  const threshold = push ? distance <= blurAt[eye] : minus ? lens <= -4 : mode === "relative" ? phase === "plus" ? lens >= 2 : lens <= -2.25 : false;
  const result = push ? (100 / distance).toFixed(2) : minus ? (Math.abs(lens) + 2.5).toFixed(2) : Math.abs(lens).toFixed(2);
  const setupReady = correction && fixation && !done;
  const setCardDistance = (value: number) => { if (!done) setDistance(Math.max(5, Math.min(40, Math.round(value)))); };

  const resetRun = () => {
    setDistance(40); setLens(0); setPhase("plus"); setNra(null); setSeconds(60); setRunning(false); setCycles(0); setGrabbed(false); lastFlipAt.current = 0;
  };
  const moveToNextEyeOrComplete = (value: string) => {
    if (done) return;
    const next = { ...completed, [eye]: value };
    setCompleted(next);
    const nextEye = requiredEyes.find((candidate) => !next[candidate]);
    if (!nextEye) { onComplete(); return; }
    setEye(nextEye); resetRun();
  };
  const recordEndpoint = () => {
    if (!setupReady || !threshold) return;
    if (mode === "relative" && phase === "plus") { setNra(lens); setPhase("minus"); setLens(0); return; }
    if (mode === "relative") { onComplete(); return; }
    moveToNextEyeOrComplete(push ? `${distance} cm / ${result} D` : `${result} D`);
  };
  const startFacility = () => { setSeconds(60); setCycles(0); setPhase("plus"); lastFlipAt.current = performance.now(); setRunning(true); };
  const flipFacility = () => {
    const now = performance.now();
    if (!running || now - lastFlipAt.current < 400) return;
    lastFlipAt.current = now;
    if (phase === "minus") setCycles((value) => value + 1);
    setPhase((value) => value === "plus" ? "minus" : "plus");
  };

  return <dialog ref={dialog} className="clinical-practice-dialog" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <header className="clinical-stage-header"><div><p className="eyebrow">LIVE PRACTICE · ACCOMMODATION</p><h1>{push ? "Amplitude · push-up" : minus ? "Amplitude · minus lens" : mode === "relative" ? "NRA / PRA" : "Accommodative facility"}</h1></div><button className="secondary" onClick={onClose}><X />Close</button></header>
    <div className="clinical-stage-body">
      <div className="clinical-viewport-wrap">
        <div className={`clinical-viewport ${push ? "push-up-practice-viewport" : ""} ${grabbed ? "is-grabbed" : ""}`} tabIndex={push && !done ? 0 : undefined} role={push && !done ? "application" : undefined} aria-disabled={push ? done : undefined} aria-label={push ? done ? "Push-up practice complete. All required eye measurements are recorded." : "Push-up near card. Drag vertically, use the mouse wheel, or press the up and down arrow keys to move the card toward or away from the spectacle plane." : undefined} onPointerDown={push && !done ? (event) => { if (event.button !== 0) return; event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); dragStart.current = { y: event.clientY, distance }; setGrabbed(true); } : undefined} onPointerMove={push && !done ? (event) => { if (!event.currentTarget.hasPointerCapture(event.pointerId)) return; setCardDistance(dragStart.current.distance + (event.clientY - dragStart.current.y) * 0.12); } : undefined} onPointerUp={push && !done ? (event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); setGrabbed(false); } : undefined} onPointerCancel={push && !done ? () => setGrabbed(false) : undefined} onLostPointerCapture={push && !done ? () => setGrabbed(false) : undefined} onWheel={push && !done ? (event) => { event.preventDefault(); setCardDistance(distance + event.deltaY * 0.025); } : undefined} onKeyDown={push && !done ? (event) => { if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return; event.preventDefault(); setCardDistance(distance + (event.key === "ArrowUp" ? -1 : 1)); } : undefined}><Canvas camera={{ position: [0, 0, 2.5] }}>{push ? <PushUpScene distance={distance} eye={eye} blurred={threshold} /> : <><color attach="background" args={["#0a171c"]} /><ambientLight intensity={1.5} /><mesh position={[0, 0, 0.5]}><boxGeometry args={[0.55, 0.32, 0.03]} /><meshStandardMaterial color="#eee9d8" /></mesh><mesh position={[0.55, -0.45, 1]}><boxGeometry args={[0.25, 0.55, 0.05]} /><meshPhysicalMaterial color="#9edbd2" transparent opacity={0.5} /></mesh></>}</Canvas>{push && <><div className="accommodation-distance-hud"><span>SPECTACLE PLANE</span><strong>{distance} cm</strong><small>{result} D</small><i style={{ height: `${Math.max(8, (40 - distance) / 35 * 100)}%` }} /></div><div className="viewport-controls">{done ? "Push-up series complete" : "Grip card · drag ↑ closer · drag ↓ farther · wheel/arrows"}</div></>}<div className="hand-readout"><span><b>R</b>{done ? "Measurements recorded" : facility ? "Flip lenses" : push ? "Grip + move near card" : "Change lenses"}</span><span><b>L</b>{done ? "Technique complete" : eye === "OU" ? push ? "Measure from spectacle plane" : "Steady target" : `Occlude ${eye === "OD" ? "OS" : "OD"}`}</span></div></div>
        <div className={`clinical-coach ${threshold || done ? "ready" : ""}`} role="status"><span>{done ? <Check /> : <Eye />}</span><p><b>{done ? "Practice complete" : "Patient response"}</b>{done ? "OD, OS, and OU push-up endpoints are recorded." : facility ? `${phase === "plus" ? "+2.00" : "−2.00"} D side ${running ? "active" : "waiting"}.` : threshold ? "Patient reports first sustained blur." : "Patient reports the line is clear."}</p></div>
      </div>
      <aside className="clinical-control-rail">
        <section><button className={correction ? "task-button done" : "task-button"} disabled={done} onClick={() => setCorrection(true)}><Check /><span><b>Required correction</b><small>Correction in place</small></span></button><button className={fixation ? "task-button done" : "task-button"} disabled={done} onClick={() => setFixation(true)}><Check /><span><b>Near line fixated</b><small>One line larger than best near acuity</small></span></button>{mode !== "relative" && <div className="site-switch">{requiredEyes.map((value) => <button key={value} className={eye === value ? "selected" : ""} disabled={done || running || Boolean(completed[value])} onClick={() => { setEye(value); resetRun(); }}>{completed[value] ? `✓ ${value}` : value}</button>)}</div>}{Object.keys(completed).length > 0 && <p className="neutral-message">{requiredEyes.filter((value) => completed[value]).map((value) => `${value}: ${completed[value]}`).join(" · ")}</p>}</section>
        {push ? <section><p className="eyebrow">DIRECT PUSH-UP CONTROL</p><p className={done ? "neutral-message success" : "neutral-message"}>{done ? "Push-up practice complete. Review the recorded OD, OS, and OU endpoints above or close this view." : "Grip the near card in the patient view and move it slowly toward the spectacle plane. Stop at the first sustained blur; use the free hand to occlude the fellow eye or measure for OU."}</p><label className="distance-control"><Ruler /> Accessible card distance · {distance} cm<input disabled={done} type="range" min="5" max="40" value={distance} onChange={(event) => setCardDistance(+event.target.value)} /></label><button className="primary full" disabled={done || !setupReady || !threshold} onClick={recordEndpoint}>{done ? "All push-up endpoints recorded" : `Record ${eye}: NPA ${distance} cm · ${result} D`}</button></section>
          : facility ? <section><p>{seconds}s · {cycles} cycles · {phase === "plus" ? "+2.00 D" : "−2.00 D"}</p><button className="primary full" disabled={!setupReady || running || seconds === 0} onClick={startFacility}>Start 60-second test · {eye}</button><button className="secondary full" disabled={!running} onClick={flipFacility}>Target clear · flip</button><button className="primary full" disabled={seconds !== 0} onClick={() => moveToNextEyeOrComplete(`${cycles} cpm`)}>Record {cycles} cpm · {eye}</button></section>
            : <section>{nra !== null && <p className="neutral-message">NRA recorded: +{nra.toFixed(2)} D · baseline restored</p>}<label>Lens power · {lens.toFixed(2)} D<input type="range" min={mode === "relative" && phase === "plus" ? 0 : -10} max={mode === "relative" && phase === "plus" ? 4 : 0} step="0.25" value={lens} onChange={(event) => setLens(+event.target.value)} /></label><button className="primary full" disabled={!setupReady || !threshold} onClick={recordEndpoint}>{mode === "relative" && phase === "plus" ? `Record NRA +${result} D · return to baseline` : `Record ${mode === "relative" ? "PRA" : `${eye} amplitude`} ${result} D`}</button></section>}
        <button className="reset-technique" disabled={done} onClick={resetRun}><RotateCcw />{done ? "Practice complete" : "Reset current run"}</button>
      </aside>
    </div>
  </dialog>;
}
