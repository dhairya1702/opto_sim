import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Canvas } from "./PracticeWebGLFallback";
import { EyeSurface } from "../scene/EyeSurface";
import { fourPrismResponse } from "../interaction/sensory";
import { fourPrismGaze, prismEyeAt, prismObservationMs, type PrismCase, type PrismEye } from "../interaction/fourPrism";

function Scene({ pose, active, scenario, started, baseOut }: { pose: { x: number; y: number }; active: PrismEye | null; scenario: PrismCase; started: number | null; baseOut: boolean }) {
  const movement = useRef({ x: 0, y: 0, used: true });
  const od = useRef({ x: 0, y: 0 }); const os = useRef({ x: 0, y: 0 });
  useFrame((_, delta) => {
    const gaze = active && started !== null ? fourPrismGaze(active, scenario, performance.now() - started) : { od: 0, os: 0 };
    const blend = 1 - Math.exp(-Math.min(delta, 0.1) * 10);
    od.current.x += (gaze.od - od.current.x) * blend; os.current.x += (gaze.os - os.current.x) * blend;
  });
  return <>
    <color attach="background" args={["#09161b"]} /><ambientLight intensity={1.4} /><directionalLight position={[-2, 3, 4]} intensity={2} />
    <mesh scale={[0.64, 0.85, 0.48]}><sphereGeometry args={[1, 40, 28]} /><meshStandardMaterial color="#a97453" /></mesh>
    <group position={[0, 0.2, 0.51]} scale={1.3}><EyeSurface x={-0.17} pupils={false} motility={false} progress={0} movement={movement} gazeOffset={od} /><EyeSurface x={0.17} pupils={false} motility={false} progress={0} movement={movement} gazeOffset={os} /></group>
    <group position={[pose.x, pose.y, 0.78]}><mesh rotation={[0, 0, (pose.x < 0 ? -1 : 1) * (baseOut ? Math.PI / 2 : -Math.PI / 2)]}><coneGeometry args={[0.16, 0.25, 3]} /><meshPhysicalMaterial color="#bce4dd" transparent opacity={0.25} /></mesh><mesh position={[0.07, -0.29, 0]} scale={[0.1, 0.16, 0.065]}><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color="#a97453" /></mesh></group>
    <mesh position={[0.63, -0.52, 0.81]} scale={[0.1, 0.16, 0.065]}><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color="#a97453" /></mesh>
  </>;
}

export function FourPrismPracticeStage({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ x: number; y: number; pose: { x: number; y: number } } | null>(null);
  const [pose, setPose] = useState({ x: 0, y: -0.4 });
  const [correction, setCorrection] = useState(false);
  const [fixation, setFixation] = useState(false);
  const [power, setPower] = useState(0);
  const [baseOut, setBaseOut] = useState(false);
  const [scenario, setScenario] = useState<PrismCase>("normal");
  const [observed, setObserved] = useState<PrismEye[]>([]);
  const [started, setStarted] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [done, setDone] = useState(false);
  const ready = correction && fixation && power === 4 && baseOut;
  const placement = prismEyeAt(pose.x, pose.y);
  const active = ready && (placement === "OD" || observed.includes("OD")) ? placement : null;
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  useEffect(() => {
    setProgress(0); setStarted(null);
    if (!active) return;
    const start = performance.now(); setStarted(start);
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - start;
      setProgress(Math.min(1, elapsed / prismObservationMs));
      if (elapsed >= prismObservationMs) { setObserved(previous => previous.includes(active) ? previous : [...previous, active]); window.clearInterval(timer); }
    }, 50);
    return () => window.clearInterval(timer);
  }, [active, scenario]);
  function reset() { setPose({ x: 0, y: -0.4 }); setObserved([]); setStarted(null); setProgress(0); setAnswer(""); setFeedback(""); setDone(false); drag.current = null; }
  function move(x: number, y: number) { setPose({ x: Math.max(-0.8, Math.min(0.8, x)), y: Math.max(-0.5, Math.min(0.6, y)) }); }
  function record() {
    if (!ready || observed.length !== 2 || done) return;
    if (answer !== scenario) { setFeedback("Compare both placements: look for the initial version and the subsequent inward refixation of the fellow eye."); return; }
    setDone(true); setFeedback("Both-eye response correctly recorded."); onComplete();
  }
  return <dialog ref={dialog} className="clinical-practice-dialog" aria-labelledby="four-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="clinical-stage-header"><div><p className="eyebrow">LIVE PRACTICE · SENSORY STATUS</p><h1 id="four-title">4Δ base-out test</h1></div><div className="clinical-stage-distance"><span>Distance fixation</span><strong>OD better · OS fellow</strong></div><button className="secondary" onClick={onClose}>Close</button></header>
    <div className="clinical-stage-body"><div className="clinical-viewport-wrap"><div className="clinical-viewport" tabIndex={0} aria-label="Drag prism to OD then OS. Arrow keys move the prism." onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, pose }; }} onPointerMove={event => { const start = drag.current; if (start) move(start.pose.x + (event.clientX - start.x) * 0.003, start.pose.y - (event.clientY - start.y) * 0.003); }} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onKeyDown={event => { if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return; event.preventDefault(); move(pose.x + (event.key === "ArrowLeft" ? -0.025 : event.key === "ArrowRight" ? 0.025 : 0), pose.y + (event.key === "ArrowUp" ? 0.025 : event.key === "ArrowDown" ? -0.025 : 0)); }}>
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 2.5], fov: 40 }}><Scene pose={pose} active={active} scenario={scenario} started={started} baseOut={baseOut} /></Canvas><div className="facility-hud"><span>{power}Δ · {baseOut ? "BO" : "BI"}</span><strong>{active ? `Hold before ${active}` : "Position prism"}</strong><small>{observed.length}/2 placements observed</small></div><div className="hand-readout"><span><b>R</b>Hold prism steady before each eye</span><span><b>L</b>Stay clear of the distance target</span></div>
    </div><div className="clinical-coach" role="status"><p><b>Observation</b>{!ready ? "Fit correction, establish distance fixation, and select exactly 4Δ base out." : placement === "OS" && !observed.includes("OD") ? "Test the better eye (OD) first." : active && progress >= 1 ? fourPrismResponse(scenario, active) : active ? `Watch ${active === "OD" ? "OS" : "OD"}, the fellow eye. Keep the prism in place for refixation.` : "Move the prism before OD, then before OS."}</p></div></div>
    <aside className="clinical-control-rail"><section><button className={`task-button ${correction ? "done" : ""}`} onClick={() => setCorrection(true)}>Fit best distance correction</button><button className={`task-button ${fixation ? "done" : ""}`} disabled={!correction} onClick={() => setFixation(true)}>Fixate isolated distance letter · keep single</button><label className="distance-control">Prism power · {power}Δ<input type="range" min="0" max="10" value={power} onChange={event => { reset(); setPower(+event.target.value); }} /></label><button className="secondary full" onClick={() => { reset(); setBaseOut(value => !value); }}>Rotate prism · currently {baseOut ? "base out" : "base in"}</button></section>
      <section><p>Hold the prism steadily through both movement phases. Moving away before observation finishes cancels that placement.</p><div className="site-switch"><button disabled={!ready} onClick={() => move(-0.22, 0.2)}>Place OD</button><button disabled={!ready || !observed.includes("OD")} onClick={() => move(0.22, 0.2)}>Place OS</button></div><button className="secondary full" onClick={() => move(0, -0.4)}>Withdraw prism</button><progress aria-label="Observation hold" value={progress} max="1" /><p>OD {observed.includes("OD") ? "✓" : "—"} · OS {observed.includes("OS") ? "✓" : "—"}</p></section>
      <section className="clinical-observation"><label>Interpretation<select disabled={observed.length !== 2 || !ready || done} value={answer} onChange={event => setAnswer(event.target.value)}><option value="">Choose</option><option value="normal">Normal response · no suppression</option><option value="suppression">Central suppression of OS</option></select></label><button className="primary full" disabled={!ready || observed.length !== 2 || !answer || done} onClick={record}>Record interpretation</button><p role="status">{feedback}</p>{done && <p className="neutral-message success">Both placements recorded.</p>}<button className="secondary full" onClick={() => { reset(); setScenario(value => value === "normal" ? "suppression" : "normal"); }}>New patient pattern</button><button className="reset-technique" onClick={reset}>Reset observations</button><p className="small">Movement amplitude and timing are exaggerated for teaching; this is not calibrated ocular physiology.</p></section>
    </aside></div>
  </dialog>;
}
