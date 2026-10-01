import { useEffect, useRef, useState } from "react";
import { Canvas } from "./PracticeWebGLFallback";
import { EyeSurface } from "../scene/EyeSurface";
import { maddoxAligned, maddoxCanRecord, maddoxRotationCorrect, maddoxTrials } from "../interaction/maddoxPractice";

function MaddoxScene({ pose, angle, power, base, light, near, correction, onRotate }: { pose: { x: number; y: number }; angle: number; power: number; base: string; light: boolean; near: boolean; correction: boolean; onRotate: () => void }) {
  const movement = useRef({ x: 0, y: 0, used: true });
  return <>
    <color attach="background" args={["#09161b"]} /><ambientLight intensity={1.3} /><directionalLight position={[-2, 3, 4]} intensity={2} />
    <mesh scale={[0.64, 0.85, 0.48]}><sphereGeometry args={[1, 40, 28]} /><meshStandardMaterial color="#a97453" /></mesh>
    <group position={[0, 0.2, 0.51]} scale={1.3}><EyeSurface x={-0.17} pupils={false} motility={false} progress={0} movement={movement} /><EyeSurface x={0.17} pupils={false} motility={false} progress={0} movement={movement} /></group>
    {correction && [-0.22, 0.22].map(x => <mesh key={x} position={[x, 0.2, 0.67]}><torusGeometry args={[0.16, 0.015, 12, 32]} /><meshStandardMaterial color="#293d43" /></mesh>)}
    <group position={[pose.x, pose.y, 0.73]} onClick={event => { event.stopPropagation(); if (event.delta <= 4) onRotate(); }}>
      <mesh><torusGeometry args={[0.14, 0.018, 12, 32]} /><meshStandardMaterial color="#8e3944" /></mesh>
      <mesh><circleGeometry args={[0.13, 32]} /><meshPhysicalMaterial color="#df333a" transparent opacity={0.45} /></mesh>
      <group rotation={[0, 0, angle * Math.PI / 180]}>{[-0.09, -0.06, -0.03, 0, 0.03, 0.06, 0.09].map(y => <mesh key={y} position={[0, y, 0.015]}><boxGeometry args={[2 * Math.sqrt(0.12 ** 2 - y ** 2), 0.008, 0.014]} /><meshStandardMaterial color="#f36c65" /></mesh>)}</group>
    </group>
    <group position={[-0.22, -0.27 + power * 0.015, 0.91]}>
      <mesh><boxGeometry args={[0.16, 0.64, 0.04]} /><meshPhysicalMaterial color="#b3ded7" transparent opacity={0.3} /></mesh>
      <mesh rotation={[0, 0, base === "BU" ? Math.PI : Math.PI / 2]}><coneGeometry args={[0.09, 0.15, 3]} /><meshPhysicalMaterial color="#caeee6" transparent opacity={0.6} /></mesh>
      <mesh position={[0.08, -0.45, 0]} scale={[0.1, 0.16, 0.065]}><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color="#a97453" /></mesh>
    </group>
    <group position={[0.53, -0.4, near ? 1.05 : 0.8]}><mesh><cylinderGeometry args={[0.035, 0.035, 0.33, 20]} /><meshStandardMaterial color="#273c43" /></mesh><mesh position={[0, 0.19, 0]}><sphereGeometry args={[0.04, 20, 14]} /><meshBasicMaterial color={light ? "#fff6c3" : "#465455"} /></mesh><mesh position={[0, -0.29, 0]} scale={[0.1, 0.16, 0.065]}><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color="#a97453" /></mesh></group>
  </>;
}

export function MaddoxPracticeStage({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ x: number; y: number; pose: { x: number; y: number }; power: number } | null>(null);
  const [trialIndex, setTrialIndex] = useState(0);
  const [correction, setCorrection] = useState(false);
  const [fixation, setFixation] = useState(false);
  const [light, setLight] = useState(false);
  const [pose, setPose] = useState({ x: -0.65, y: -0.25 });
  const [angle, setAngle] = useState(90);
  const [base, setBase] = useState("");
  const [power, setPower] = useState(20);
  const [started, setStarted] = useState(false);
  const [tool, setTool] = useState<"rod" | "prism">("rod");
  const [results, setResults] = useState<string[]>([]);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const trial = maddoxTrials[trialIndex];
  const done = results.length === 4;
  const aligned = maddoxAligned(pose.x, pose.y);
  const setup = correction && fixation && light && aligned && maddoxRotationCorrect(trial.axis, angle) && base === trial.base;
  const offset = Math.max(-100, Math.min(100, (power - trial.neutral) * 8));
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  function invalidate() { setStarted(false); setAnswer(""); setFeedback(""); }
  function rotate() { if (done) return; setAngle(value => (value + 90) % 180); invalidate(); }
  function moveRod(x: number, y: number) { if (done) return; setPose({ x: Math.max(-0.8, Math.min(0.8, x)), y: Math.max(-0.5, Math.min(0.6, y)) }); invalidate(); }
  function changePower(value: number) { if (!setup || !started || done) return; setPower(Math.max(0, Math.min(20, Math.round(value)))); setAnswer(""); setFeedback(""); }
  function reset() { setPose({ x: -0.65, y: -0.25 }); setAngle(90); setBase(""); setPower(20); setFixation(false); setTool("rod"); invalidate(); drag.current = null; }
  function record() {
    if (done || !maddoxCanRecord(setup, started, power, trial.neutral)) return;
    if (Number(answer) !== power || answer === "") { setFeedback("Read the neutralising prism power and record it in Δ."); return; }
    const next = [...results, `${trial.site} · ${trial.axis}: ${power}Δ ${base}`];
    setResults(next);
    if (next.length === 4) { setFeedback("All four measurements recorded."); onComplete(); }
    else { setTrialIndex(value => value + 1); reset(); }
  }
  return <dialog ref={dialog} className="clinical-practice-dialog" aria-labelledby="maddox-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="clinical-stage-header"><div><p className="eyebrow">LIVE PRACTICE · LATENT DEVIATION</p><h1 id="maddox-title">Maddox rod · {trial.axis}</h1></div><div className="clinical-stage-distance"><span>{trial.site} target</span><strong>{trial.site === "near" ? "40 cm" : "6 m"} · OD rod</strong></div><button className="secondary" onClick={onClose}>Close</button></header>
    <div className="clinical-stage-body"><div className="clinical-viewport-wrap">
      <div className="clinical-viewport" tabIndex={0} aria-label="Maddox instruments. Select rod or prism. Drag to move, arrow keys for fine adjustment, R to rotate rod." onPointerDown={event => { if (event.button !== 0 || done) return; event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, pose, power }; }} onPointerMove={event => { const start = drag.current; if (!start) return; if (tool === "rod") moveRod(start.pose.x + (event.clientX - start.x) * 0.003, start.pose.y - (event.clientY - start.y) * 0.003); else changePower(start.power - (event.clientY - start.y) / 12); }} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onKeyDown={event => { if (event.key.toLowerCase() === "r") { event.preventDefault(); rotate(); return; } if (!event.key.startsWith("Arrow")) return; event.preventDefault(); if (tool === "prism") changePower(power + (event.key === "ArrowUp" ? 1 : -1)); else moveRod(pose.x + (event.key === "ArrowLeft" ? -0.025 : event.key === "ArrowRight" ? 0.025 : 0), pose.y + (event.key === "ArrowUp" ? 0.025 : event.key === "ArrowDown" ? -0.025 : 0)); }}>
        <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 2.5], fov: 40 }}><MaddoxScene pose={pose} angle={angle} power={power} base={base} light={light} near={trial.site === "near"} correction={correction} onRotate={rotate} /></Canvas>
        <div className="facility-hud"><span>{tool.toUpperCase()} SELECTED</span><strong>{power}Δ {base || "Choose base"}</strong><small>Rod {aligned ? "aligned at OD" : "not aligned"} · {angle}° grooves</small></div><div className="hand-readout"><span><b>R</b>Fit rod into frame, then adjust prism</span><span><b>L</b>{trial.site === "near" ? "Hold penlight at 40 cm" : "Control distance fixation light"}</span></div>
      </div><div className="clinical-coach" role="status"><p><b>Patient response</b>{!setup ? "Align the rod, orient its grooves, fit the correct prism base, and establish fixation." : offset === 0 ? "The streak passes through the light." : `The streak is ${trial.axis === "horizontal" ? offset > 0 ? "right" : "left" : offset > 0 ? "below" : "above"} of the light.`}</p></div>
    </div><aside className="clinical-control-rail">
      <section><button className={`task-button ${correction ? "done" : ""}`} disabled={done} onClick={() => setCorrection(true)}>Fit correction</button><button className="secondary full" disabled={done} onClick={() => { setLight(value => !value); invalidate(); }}>{light ? "Switch light off" : "Switch light on"}</button><button className={`task-button ${fixation ? "done" : ""}`} disabled={!correction || !light || done} onClick={() => setFixation(true)}>Ask patient to fixate {trial.site === "near" ? "40 cm penlight" : "6 m light"}</button></section>
      <section><div className="site-switch"><button disabled={done} className={tool === "rod" ? "selected" : ""} onClick={() => setTool("rod")}>Move rod</button><button disabled={done} className={tool === "prism" ? "selected" : ""} onClick={() => setTool("prism")}>Move prism</button></div><button className="secondary full" disabled={done} onClick={() => moveRod(-0.22, 0.2)}>Seat rod before OD</button><button className="secondary full" disabled={done} onClick={rotate}>Rotate grooves 90° · {angle}°</button><p>{trial.axis === "horizontal" ? "Horizontal grooves produce a vertical streak." : "Vertical grooves produce a horizontal streak."}</p><label>Prism base<select disabled={done} value={base} onChange={event => { setBase(event.target.value); invalidate(); }}><option value="">Choose</option><option value="BI">Base in</option><option value="BU">Base up</option></select></label><button className="primary full" disabled={!setup || started || done} onClick={() => { setPower(20); setStarted(true); setTool("prism"); }}>Introduce 20Δ · begin neutralisation</button><label className="distance-control">Prism · {power}Δ<input type="range" min="0" max="20" disabled={!setup || !started || done} value={power} onChange={event => changePower(+event.target.value)} /></label></section>
      {setup && <section><p className="eyebrow">PATIENT PERCEPT · ILLUSTRATION</p><svg viewBox="-140 -110 280 220" role="img" aria-label={offset === 0 ? "Streak bisects spot" : "Streak displaced from spot"} style={{ width: "100%", background: "#020609", borderRadius: 8 }}><circle r="7" fill="#fff3c4" />{trial.axis === "horizontal" ? <line x1={offset} x2={offset} y1="-95" y2="95" stroke="#ff5757" strokeWidth="4" /> : <line x1="-125" x2="125" y1={offset} y2={offset} stroke="#ff5757" strokeWidth="4" />}</svg><small>Illustrative optics; these authored cases use BI or BU neutralisation.</small></section>}
      <section className="clinical-observation"><label>Neutral prism power (Δ)<input type="number" min="0" max="20" value={answer} disabled={!setup || !started || done} onChange={event => setAnswer(event.target.value)} /></label><button className="primary full" disabled={done || !answer || !maddoxCanRecord(setup, started, power, trial.neutral)} onClick={record}>Record {trial.axis} · {base}</button><p role="status">{feedback}</p>{results.map(row => <p key={row}>{row}</p>)}{done && <p className="neutral-message success">Distance and near · both axes complete.</p>}{!done && <button className="reset-technique" onClick={reset}>Reset current measurement</button>}</section>
    </aside></div>
  </dialog>;
}
