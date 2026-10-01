import { useEffect, useRef, useState } from "react";
import { Check, CircleDot, Eye, Power, RotateCw } from "lucide-react";
import { Canvas } from "./PracticeWebGLFallback";
import { EyeSurface } from "../scene/EyeSurface";
import { krimskyCases, krimskyDistanceReady, krimskyEye, krimskyReady, krimskyResidual, type KrimskyMethod } from "../interaction/krimsky";

function Scene({ reflex, light, fixation, monocular, distance, eye, power, base }: { reflex: number; light: boolean; fixation: boolean; monocular: boolean; distance: number; eye: string; power: number; base: string }) {
  const movement = useRef({ x: 0, y: 0, used: true });
  const distanceProgress = (distance - 30) / 40;
  const instrumentScale = 1.08 - distanceProgress * 0.22;
  const instrumentZ = 0.8 + distanceProgress * 0.42;
  const viewQuality = Math.max(0.28, 1 - Math.abs(distance - 50) / 32) * (fixation ? 1 : 0.68) * (monocular ? 1 : 0.8);
  return <>
    <color attach="background" args={["#09161b"]} /><ambientLight intensity={1.3} /><directionalLight position={[-2, 3, 4]} intensity={2} />
    <mesh scale={[0.64, 0.85, 0.48]}><sphereGeometry args={[1, 40, 28]} /><meshStandardMaterial color="#a97453" /></mesh>
    <group position={[0, 0.2, 0.51]} scale={1.3}><EyeSurface x={-0.17} pupils={false} motility={false} progress={0} movement={movement} reflectionStrength={0} /><EyeSurface x={0.17} pupils={false} motility={false} progress={0} movement={movement} reflectionStrength={0} /></group>
    {light && [-0.22, 0.22 + reflex].map((x, i) => <group key={i} position={[x, 0.2, 0.59]}><mesh scale={1 + (1 - viewQuality) * 1.8}><sphereGeometry args={[0.017, 16, 12]} /><meshBasicMaterial color="#ffe99a" transparent opacity={0.12 + viewQuality * 0.2} /></mesh><mesh><sphereGeometry args={[0.008, 16, 12]} /><meshBasicMaterial color="#fffbd5" transparent opacity={0.42 + viewQuality * 0.58} /></mesh></group>)}
    {eye && <group position={[eye === "OD" ? -0.22 : 0.22, 0.2 + power * 0.005, 0.78]}><mesh><boxGeometry args={[0.16, 0.46, 0.035]} /><meshPhysicalMaterial color="#afdcd5" transparent opacity={0.2} /></mesh><mesh rotation={[0, 0, base === "BI" ? Math.PI / 2 : -Math.PI / 2]}><coneGeometry args={[0.1, 0.14, 3]} /><meshPhysicalMaterial color="#c4e8df" transparent opacity={0.25} /></mesh><mesh position={[0.08, -0.4, 0]} scale={[0.1, 0.16, 0.065]}><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color="#a97453" /></mesh></group>}
    {light && <><pointLight position={[0.55, -0.21, instrumentZ]} color="#fff1a8" intensity={1.8} distance={2.4} /><mesh position={[0.2, 0.05, 0.68]} rotation={[0.7, 0, 0.92]}><coneGeometry args={[0.17 + Math.abs(distance - 50) * 0.004, 0.9, 32, 1, true]} /><meshBasicMaterial color="#ffe8a1" transparent opacity={0.07} side={2} depthWrite={false} /></mesh></>}
    <group position={[0.55, -0.4, instrumentZ]} scale={instrumentScale}><mesh><cylinderGeometry args={[0.035, 0.035, 0.33, 20]} /><meshStandardMaterial color="#253940" /></mesh><mesh position={[0, 0.19, 0]}><sphereGeometry args={[0.04, 20, 14]} /><meshBasicMaterial color={light ? "#fff7bd" : "#425456"} /></mesh><mesh position={[0, -0.29, 0]} scale={[0.1, 0.16, 0.065]}><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color="#a97453" /></mesh></group>
  </>;
}

export function KrimskyPracticeStage({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ y: number; power: number; pointerId: number; element: HTMLDivElement } | null>(null);
  function clearDrag() {
    const current = drag.current;
    drag.current = null;
    if (current?.element.hasPointerCapture(current.pointerId)) current.element.releasePointerCapture(current.pointerId);
  }
  const completed = useRef(false);
  const [method, setMethod] = useState<KrimskyMethod>("standard");
  const [index, setIndex] = useState(0);
  const [light, setLight] = useState(false);
  const [fixation, setFixation] = useState(false);
  const [monocular, setMonocular] = useState(false);
  const [distance, setDistance] = useState(40);
  const [baseline, setBaseline] = useState(false);
  const [eye, setEye] = useState("");
  const [base, setBase] = useState("");
  const [power, setPower] = useState(0);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [done, setDone] = useState(false);
  const scenario = krimskyCases[index];
  const viewing = light && fixation && krimskyDistanceReady(distance) && monocular;
  const ready = baseline && !!base && krimskyReady(method, eye, light, fixation, distance, monocular);
  const residual = krimskyResidual(scenario.power, ready ? power : 0, base === scenario.base);
  const reflex = Math.max(-0.09, Math.min(0.09, residual * scenario.sign * 0.003));
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => { clearDrag(); node?.close(); }; }, []);
  function invalidate() { clearDrag(); completed.current = false; setAnswer(""); setFeedback(""); setDone(false); }
  function reset() { setEye(""); setBase(""); setPower(0); setBaseline(false); invalidate(); }
  function placePrism(nextEye: string) {
    if (!baseline || done || nextEye === eye) return;
    setEye(nextEye); setPower(0); invalidate();
  }
  function rotateBase() {
    if (!baseline || done) return;
    setBase(value => value === "BI" ? "BO" : "BI"); setPower(0); invalidate();
  }
  function changePower(value: number) { if (!ready || done) return; setPower(Math.max(0, Math.min(40, Math.round(value)))); setAnswer(""); setFeedback(""); }
  function record() {
    if (!ready || residual !== 0 || completed.current) return;
    if (answer === "" || Number(answer) !== power) { setFeedback("Read the neutralising prism and record its power in Δ."); return; }
    completed.current = true; setDone(true); setFeedback(`${method === "modified" ? "Modified Krimsky" : "Krimsky"}: ${power}Δ ${base}, prism before ${eye}, at 50 cm.`); onComplete();
  }
  return <dialog ref={dialog} className="clinical-practice-dialog" aria-labelledby="krimsky-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="clinical-stage-header"><div><p className="eyebrow">LIVE PRACTICE · MOTOR ALIGNMENT</p><h1 id="krimsky-title">{method === "modified" ? "Modified Krimsky" : "Krimsky"}</h1></div><div className="clinical-stage-distance"><span>Penlight</span><strong>{distance} cm</strong></div><button className="secondary" onClick={onClose}>Close</button></header>
    <div className="clinical-stage-body"><div className="clinical-viewport-wrap"><div className="clinical-viewport" tabIndex={0} aria-label="Krimsky prism bar. Click or use left and right arrows to place the prism before an eye. Drag upward or downward, or use up and down arrows, to adjust power. Press B to rotate the prism base." onPointerDown={event => { if (event.button !== 0 || !baseline || done) return; event.currentTarget.focus(); const bounds = event.currentTarget.getBoundingClientRect(); const nextEye = event.clientX < bounds.left + bounds.width / 2 ? "OD" : "OS"; if (nextEye !== eye) { placePrism(nextEye); return; } if (!ready) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { y: event.clientY, power, pointerId: event.pointerId, element: event.currentTarget }; }} onPointerMove={event => { if (drag.current) changePower(drag.current.power - (event.clientY - drag.current.y) / 10); }} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }} onKeyDown={event => { if (event.key.toLowerCase() === "b") { event.preventDefault(); rotateBase(); return; } if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return; event.preventDefault(); if (event.key === "ArrowLeft" || event.key === "ArrowRight") placePrism(event.key === "ArrowLeft" ? "OD" : "OS"); else changePower(power + (event.key === "ArrowUp" ? 1 : -1)); }}>
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 2.5], fov: 40 }}><Scene reflex={reflex} light={light} fixation={fixation} monocular={monocular} distance={distance} eye={eye} power={power} base={base} /></Canvas><div className="facility-hud"><span>OD FIXATING · OS DEVIATING</span><strong>{power}Δ {base}</strong><small>{eye ? `Prism before ${eye}` : baseline ? "Place the prism before an eye" : "Observe baseline first"}</small></div><div className="viewport-controls">Distance moves the penlight and changes reflex clarity</div><div className="hand-readout"><span><b>R</b>Place + move prism bar · B rotates base</span><span><b>L</b>Hold fixation light steady</span></div>
    </div><div className="clinical-coach" role="status"><p><b>Corneal reflex observation</b>{!light ? "Switch on the penlight to illuminate the eyes." : !fixation ? "The reflex is visible; instruct fixation to steady the comparison." : !krimskyDistanceReady(distance) ? `The reflex is visible but soft at ${distance} cm. Move into the 46–54 cm teaching range.` : !monocular ? "The reflex is visible; use one examiner eye to reduce parallax." : !baseline ? "Compare both corneal reflex positions before adding prism." : !ready ? `Place prism before ${krimskyEye(method)} and select its base.` : residual === 0 ? "The reflexes occupy matching relative positions." : "The reflexes remain asymmetric. Adjust prism and compare again."}</p></div></div>
    <aside className="clinical-control-rail krimsky-control-rail"><section><p className="eyebrow">1 · SET UP VIEW</p><label>Method<select value={method} onChange={event => { setMethod(event.target.value as KrimskyMethod); reset(); }}><option value="standard">Krimsky · deviating eye</option><option value="modified">Modified · fixating eye</option></select></label><p className="krimsky-step-help">{method === "modified" ? "Prism before fixating OD. This teaching example retains visible reflexes; it does not simulate a scarred cornea." : "Prism before deviating OS. Observe baseline displacement first."}</p>
      <button className={`task-button ${light ? "active" : ""}`} onClick={() => { setLight(value => !value); reset(); }}><Power size={18} /><span><b>{light ? "Penlight on" : "Switch on penlight"}</b><small>{light ? "Click to switch the light off" : "Illuminate both corneal reflexes"}</small></span>{light && <Check size={16} />}</button>
      <button className={`task-button ${fixation ? "done" : ""}`} onClick={() => setFixation(true)}><Eye size={18} /><span><b>{fixation ? "Fixation instructed" : "Give fixation instruction"}</b><small>Ask the patient to look directly at the penlight</small></span>{fixation && <Check size={16} />}</button>
      <button className={`task-button ${monocular ? "done" : ""}`} onClick={() => setMonocular(true)}><Eye size={18} /><span><b>{monocular ? "Monocular view established" : "Use one examiner eye"}</b><small>View monocularly to reduce parallax</small></span>{monocular && <Check size={16} />}</button>
      <label className="distance-control">Working distance · {distance} cm<input type="range" min="30" max="70" value={distance} onChange={event => { setDistance(+event.target.value); reset(); }} /></label>
      <button className={`task-button ${baseline ? "done" : ""}`} disabled={!viewing || baseline} onClick={() => setBaseline(true)}><CircleDot size={18} /><span><b>{baseline ? "Baseline inspected" : "Inspect baseline reflexes"}</b><small>{baseline ? "Initial asymmetry recorded for comparison" : "Compare both reflex positions before adding prism"}</small></span>{baseline && <Check size={16} />}</button>
    </section>
      <section className="krimsky-prism-step"><p className="eyebrow">2 · PLACE + NEUTRALISE</p><p className="krimsky-step-help">Choose the prism eye and base, then increase power while watching the reflexes.</p><div className="site-switch">{["OD", "OS"].map(value => <button key={value} disabled={!baseline || done} className={eye === value ? "selected" : ""} onClick={() => placePrism(value)}>Prism before {value}</button>)}</div><label>Prism base<select value={base} disabled={!baseline || done} onChange={event => { setBase(event.target.value); setPower(0); invalidate(); }}><option value="">Choose base</option><option value="BI">Base in</option><option value="BO">Base out</option></select></label><button className="krimsky-flip-base" disabled={!baseline || done} onClick={rotateBase}><RotateCw size={16} /> Flip base {base ? `· currently ${base}` : "· BI / BO"}</button><label className="distance-control">Prism power · <b>{power}Δ</b><input type="range" min="0" max="40" disabled={!ready || done} value={power} onChange={event => changePower(+event.target.value)} /></label></section>
      <section className="clinical-observation krimsky-record-step"><p className="eyebrow">3 · RECORD</p><label>Neutralising power (Δ)<input className="krimsky-number-input" type="number" min="0" max="40" value={answer} disabled={!ready || done} onChange={event => setAnswer(event.target.value)} /></label><button className={`primary full ${done ? "done" : ""}`} disabled={!ready || residual !== 0 || !answer || done} onClick={record}>{done ? "Neutralisation recorded" : "Record neutralisation"}</button>{feedback && <p className={done ? "neutral-message success" : "neutral-message"} role="status">{feedback}</p>}{done && <button className="secondary full" onClick={() => { setIndex(value => (value + 1) % krimskyCases.length); reset(); }}>New deviation</button>}<button className="reset-technique" onClick={reset}>Reset current attempt</button><p className="small">Illustrative neutralisation model; the optics are not calibrated and require clinician review.</p></section>
    </aside></div>
  </dialog>;
}
