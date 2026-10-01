import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Canvas } from "./PracticeWebGLFallback";
import type { Group } from "three";
import { EyeSurface } from "../scene/EyeSurface";
import { facilityCanFlip, facilityNext, facilityRemaining, type FacilityEye, type FacilitySide } from "../interaction/accommodativeFacility";

function FacilityScene({ eye, side, flips, occluded, correction, reducedMotion, onFlip }: { eye: FacilityEye; side: FacilitySide; flips: number; occluded: boolean; correction: boolean; reducedMotion: boolean; onFlip: () => void }) {
  const tool = useRef<Group>(null);
  const movement = useRef({ x: 0, y: 0, used: true });
  const od = useRef({ x: 0, y: 0 });
  const os = useRef({ x: 0, y: 0 });
  const positions = eye === "OU" ? [-0.22, 0.22] : [eye === "OD" ? -0.22 : 0.22];
  useFrame((_, delta) => {
    const blend = reducedMotion ? 1 : 1 - Math.exp(-Math.min(delta, 0.1) * 12);
    if (tool.current) tool.current.rotation.x += (flips * Math.PI - tool.current.rotation.x) * blend;
    const gaze = eye === "OU" ? 0.012 : 0;
    od.current.x = gaze; os.current.x = -gaze;
  });
  return <>
    <color attach="background" args={["#09161b"]} /><ambientLight intensity={1.4} /><directionalLight position={[-2, 3, 4]} intensity={2} />
    <mesh scale={[0.64, 0.85, 0.48]}><sphereGeometry args={[1, 40, 28]} /><meshStandardMaterial color="#a97453" /></mesh>
    <group position={[0, 0.2, 0.51]} scale={1.3}><EyeSurface x={-0.17} pupils={false} motility={false} progress={0} movement={movement} gazeOffset={od} reducedMotion={reducedMotion} /><EyeSurface x={0.17} pupils={false} motility={false} progress={0} movement={movement} gazeOffset={os} reducedMotion={reducedMotion} /></group>
    {correction && <group position={[0, 0.2, 0.66]}>{[-0.22, 0.22].map(x => <mesh key={x} position={[x, 0, 0]}><torusGeometry args={[0.16, 0.014, 12, 32]} /><meshStandardMaterial color="#263c42" /></mesh>)}<mesh><boxGeometry args={[0.14, 0.02, 0.03]} /><meshStandardMaterial color="#263c42" /></mesh></group>}
    {occluded && eye !== "OU" && <mesh position={[eye === "OD" ? 0.22 : -0.22, 0.2, 0.69]}><circleGeometry args={[0.15, 32]} /><meshStandardMaterial color="#17262b" /></mesh>}
    <group position={[0, 0.2, 0.83]} onClick={event => { event.stopPropagation(); onFlip(); }}>
      <group ref={tool}>
        {positions.map(x => <group key={x} position={[x, 0, 0]}><mesh><torusGeometry args={[0.145, 0.023, 12, 32]} /><meshStandardMaterial color={side === "plus" ? "#4393af" : "#bd5266"} /></mesh><mesh><circleGeometry args={[0.14, 32]} /><meshPhysicalMaterial color="#cee7e2" transparent opacity={0.2} side={2} /></mesh></group>)}
        <mesh position={[0.25, 0, 0]}><boxGeometry args={[0.9, 0.025, 0.035]} /><meshStandardMaterial color="#293b43" /></mesh>
        <mesh position={[0.68, -0.05, 0]} scale={[0.09, 0.14, 0.065]}><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color="#a97453" /></mesh>
      </group>
    </group>
    <group position={[-0.38, -0.5, 0.95]}><mesh><boxGeometry args={[0.5, 0.28, 0.025]} /><meshStandardMaterial color="#f5f0df" /></mesh>{[-0.12, 0, 0.12].map(x => <group key={x} position={[x, 0, 0.02]}><mesh position={[-0.03, 0, 0]}><boxGeometry args={[0.012, 0.1, 0.004]} /><meshBasicMaterial color="#213938" /></mesh>{[-0.045, 0, 0.045].map(y => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[0.065, 0.012, 0.004]} /><meshBasicMaterial color="#213938" /></mesh>)}</group>)}<mesh position={[0, -0.24, 0]} scale={[0.1, 0.16, 0.065]}><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color="#a97453" /></mesh></group>
  </>;
}

export function AccommodativeFacilityStage({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [eye, setEye] = useState<FacilityEye>("OD");
  const [correction, setCorrection] = useState(false);
  const [occluded, setOccluded] = useState(false);
  const [fixation, setFixation] = useState(false);
  const [running, setRunning] = useState(false);
  const [seconds, setSeconds] = useState(60);
  const [clear, setClear] = useState(false);
  const [side, setSide] = useState<FacilitySide>("plus");
  const [cycles, setCycles] = useState(0);
  const [flips, setFlips] = useState(0);
  const [results, setResults] = useState<Partial<Record<FacilityEye, number>>>({});
  const [reducedMotion, setReducedMotion] = useState(false);
  const run = useRef<{ start: number; presented: number; side: FacilitySide; cycles: number } | null>(null);
  const ready = correction && fixation && (eye === "OU" || occluded);
  const done = results.OU !== undefined;
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  useEffect(() => { const query = window.matchMedia("(prefers-reduced-motion: reduce)"); const update = () => setReducedMotion(query.matches); update(); query.addEventListener("change", update); return () => query.removeEventListener("change", update); }, []);
  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const current = run.current;
      if (!current) return;
      const now = performance.now();
      const left = facilityRemaining(current.start, now);
      setSeconds(left);
      setClear(left > 0 && facilityCanFlip(current.start, current.presented, now, current.side));
      if (left === 0) { run.current = null; setRunning(false); }
    };
    const timer = window.setInterval(tick, 50);
    return () => window.clearInterval(timer);
  }, [running]);
  function start() {
    if (!ready || run.current || done || seconds === 0) return;
    const now = performance.now();
    run.current = { start: now, presented: now, side: "plus", cycles: 0 };
    setSeconds(60); setCycles(0); setSide("plus"); setFlips(0); setClear(false); setRunning(true);
  }
  function flip() {
    const current = run.current;
    const now = performance.now();
    if (!current || !facilityCanFlip(current.start, current.presented, now, current.side)) return;
    const next = facilityNext(current.side, current.cycles);
    run.current = { ...current, ...next, presented: now };
    setSide(next.side); setCycles(next.cycles); setClear(false); setFlips(value => value + 1);
  }
  function reset() {
    run.current = null; setRunning(false); setSeconds(60); setCycles(0); setFlips(0); setSide("plus"); setClear(false); setFixation(false); setOccluded(false);
  }
  function record() {
    if (seconds !== 0 || running || done) return;
    setResults(previous => ({ ...previous, [eye]: cycles }));
    if (eye === "OU") onComplete();
    else { setEye(eye === "OD" ? "OS" : "OU"); reset(); }
  }
  return <dialog ref={dialog} className="clinical-practice-dialog" aria-labelledby="facility-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="clinical-stage-header"><div><p className="eyebrow">LIVE PRACTICE · ACCOMMODATION</p><h1 id="facility-title">Accommodative facility</h1></div><div className="clinical-stage-distance"><span>Near target</span><strong>40 cm · {eye}</strong></div><button className="secondary" onClick={onClose}>Close</button></header>
    <div className="clinical-stage-body"><div className="clinical-viewport-wrap">
      <div className="clinical-viewport" tabIndex={0} aria-label="Click the lens flipper or press Space after the patient reports clear vision." onKeyDown={event => { if (event.key !== " " || event.repeat) return; event.preventDefault(); flip(); }}>
        <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 2.5], fov: 40 }}><FacilityScene eye={eye} side={side} flips={flips} correction={correction} occluded={occluded} reducedMotion={reducedMotion} onFlip={flip} /></Canvas>
        <div className={`facility-hud ${clear ? "clear" : ""}`}><span>{side === "plus" ? "+2.00 D" : "−2.00 D"} · {eye}</span><strong>{seconds}s · {cycles} cycles</strong><small>{running ? clear ? "Clear · flip now" : "Patient clearing…" : seconds === 0 ? "Time complete" : "Ready for setup"}</small></div>
        <div className="hand-readout"><span><b>R</b>Rotate ±2.00 D flipper</span><span><b>L</b>Hold near card at 40 cm</span></div>
      </div>
      <div className="clinical-coach" role="status"><p><b>Patient response</b>{done ? "All three runs recorded." : !running ? seconds === 0 ? "Time is up. Record complete cycles only." : "Establish fixation, then start the timed run." : clear ? eye === "OU" ? "Clear and single." : "The letters are clear." : "I am trying to clear the letters…"}</p></div>
    </div><aside className="clinical-control-rail">
      <section><p className="eyebrow">SETUP · {eye}</p><button className={`task-button ${correction ? "done" : ""}`} disabled={running || done} onClick={() => setCorrection(true)}>Fit distance correction</button>{eye !== "OU" && <button className={`task-button ${occluded ? "done" : ""}`} disabled={!correction || running} onClick={() => setOccluded(true)}>Occlude {eye === "OD" ? "OS" : "OD"} in frame</button>}<button className={`task-button ${fixation ? "done" : ""}`} disabled={!correction || running || done || (eye !== "OU" && !occluded)} onClick={() => setFixation(true)}>Fixate near line at 40 cm{eye === "OU" ? " · both eyes open" : ""}</button></section>
      <section><p>Start with +2.00 D. Click the flipper once the patient reports clear vision, then repeat with −2.00 D. Clearing both sides counts as one cycle.</p><button className="primary full" disabled={!ready || running || seconds === 0 || done} onClick={start}>Start 60 seconds · {eye}</button><button className="secondary full" disabled={!running || !clear} onClick={flip}>Patient clear · rotate flipper</button><button className="primary full" disabled={seconds !== 0 || running || done} onClick={record}>Record {eye}: {cycles} cpm</button></section>
      <section aria-live="polite">{(["OD", "OS", "OU"] as const).map(value => <p key={value}>{value}: {results[value] === undefined ? "Not recorded" : `${results[value]} cpm`}</p>)}{done && <p className="neutral-message success">Practice complete · OD, OS, and OU recorded.</p>}<p className="small">The patient’s clearing times are scripted. Cycle counts practise the recording procedure and are not a measure of your own accommodation.</p></section>
      {!done && <button className="reset-technique" onClick={reset}>Reset current run</button>}
    </aside></div>
  </dialog>;
}
