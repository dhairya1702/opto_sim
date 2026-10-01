import { useEffect, useRef, useState } from "react";
import { Canvas } from "./PracticeWebGLFallback";
import { EyeSurface } from "../scene/EyeSurface";
import { interpretWorth, worthReports, type WorthFinding } from "../interaction/sensory";
import { worthAtDistance, worthCases, worthDots } from "../interaction/worth";

function WorthScene({ light, glasses, distance, onLight }: { light: boolean; glasses: boolean; distance: number; onLight: () => void }) {
  const movement = useRef({ x: 0, y: 0, used: true });
  const distanceProgress = (distance - 40) / 560;
  const targetScale = 1.08 - distanceProgress * 0.58;
  const targetZ = 0.76 + distanceProgress * 0.34;
  return <>
    <color attach="background" args={["#09161b"]} /><ambientLight intensity={1.1} /><directionalLight position={[-2, 3, 4]} intensity={1.8} />
    <mesh scale={[0.64, 0.85, 0.48]}><sphereGeometry args={[1, 40, 28]} /><meshStandardMaterial color="#a97453" /></mesh>
    <group position={[0, 0.2, 0.51]} scale={1.3}><EyeSurface x={-0.17} pupils={false} motility={false} progress={0} movement={movement} /><EyeSurface x={0.17} pupils={false} motility={false} progress={0} movement={movement} /></group>
    {glasses && <group position={[0, 0.2, 0.68]}>{[-0.22, 0.22].map((x, i) => <group key={x} position={[x, 0, 0]}><mesh><torusGeometry args={[0.15, 0.018, 12, 32]} /><meshStandardMaterial color="#20383c" /></mesh><mesh><circleGeometry args={[0.14, 32]} /><meshPhysicalMaterial color={i === 0 ? "#ef4242" : "#30bc66"} transparent opacity={0.45} /></mesh></group>)}<mesh><boxGeometry args={[0.13, 0.025, 0.03]} /><meshStandardMaterial color="#20383c" /></mesh></group>}
    <group position={[-0.28, -0.42, targetZ]} scale={targetScale} onClick={event => { event.stopPropagation(); if (event.delta <= 4) onLight(); }}>
      <mesh><boxGeometry args={[0.3, 0.38, 0.045]} /><meshStandardMaterial color="#1e323a" /></mesh>
      {worthDots("fusion").map((dot, i) => <mesh key={i} position={[dot.x / 350, -dot.y / 350, 0.028]}><circleGeometry args={[0.027, 24]} /><meshBasicMaterial color={light ? dot.color : "#34424a"} /></mesh>)}
      <mesh position={[0, -0.27, 0]}><boxGeometry args={[0.05, 0.25, 0.04]} /><meshStandardMaterial color="#203239" /></mesh>
      <mesh position={[0.035, -0.39, 0.01]} scale={[0.1, 0.16, 0.065]}><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color="#a97453" /></mesh>
    </group>
    <mesh position={[0.65, -0.57, 0.85]} scale={[0.1, 0.16, 0.065]}><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color="#a97453" /></mesh>
  </>;
}

export function WorthPracticeStage({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ y: number; distance: number } | null>(null);
  const [correction, setCorrection] = useState(false);
  const [glasses, setGlasses] = useState(false);
  const [filter, setFilter] = useState<"red" | "green" | null>(null);
  const [verified, setVerified] = useState<string[]>([]);
  const [light, setLight] = useState(false);
  const [distance, setDistance] = useState(40);
  const [index, setIndex] = useState(0);
  const [asked, setAsked] = useState(false);
  const [answer, setAnswer] = useState("");
  const [count, setCount] = useState("");
  const [feedback, setFeedback] = useState("");
  const [records, setRecords] = useState<{ distance: number; finding: WorthFinding }[]>([]);
  const [grabbed, setGrabbed] = useState(false);
  const finding = worthAtDistance(worthCases[index], distance);
  const ready = correction && glasses && verified.length === 2 && light;
  const complete = records.some(row => row.distance === 40) && records.some(row => row.distance === 600);
  const dots = filter ? worthDots(filter === "red" ? "suppress-os" : "suppress-od") : worthDots(finding);
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => { drag.current = null; node?.close(); }; }, []);
  function invalidate() { setAsked(false); setAnswer(""); setCount(""); setFeedback(""); setFilter(null); }
  function move(value: number) { setDistance(Math.max(40, Math.min(600, Math.round(value / 20) * 20))); invalidate(); }
  function toggleLight() { setLight(value => !value); invalidate(); }
  function record() {
    if (!ready || !asked || filter || !answer) return;
    if (Number(count) !== worthDots(finding).length || answer !== interpretWorth(finding)) { setFeedback("Recheck the dot count, colours, and relative positions."); return; }
    const next = [...records.filter(row => row.distance !== distance), { distance, finding }];
    setRecords(next); setFeedback("Recorded. Compare the response at 40 cm and 6 m.");
    if (!complete && next.some(row => row.distance === 40) && next.some(row => row.distance === 600)) onComplete();
  }
  return <dialog ref={dialog} className="clinical-practice-dialog" aria-labelledby="worth-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="clinical-stage-header"><div><p className="eyebrow">LIVE PRACTICE · SENSORY STATUS</p><h1 id="worth-title">Worth four dot</h1></div><div className="clinical-stage-distance"><span>Target distance</span><strong>{distance} cm</strong></div><button className="secondary" onClick={onClose}>Close</button></header>
    <div className="clinical-stage-body"><div className="clinical-viewport-wrap">
      <div className={`clinical-viewport ${grabbed ? "is-grabbed" : ""}`} tabIndex={0} role="application" aria-label="Worth target. Drag upward to bring the target nearer, downward to move it farther away, use the mouse wheel, or press the up and down arrow keys." onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { y: event.clientY, distance }; setGrabbed(true); }} onPointerMove={event => { if (drag.current && event.currentTarget.hasPointerCapture(event.pointerId)) move(drag.current.distance + (event.clientY - drag.current.y) * 3); }} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); drag.current = null; setGrabbed(false); }} onPointerCancel={() => { drag.current = null; setGrabbed(false); }} onLostPointerCapture={() => { drag.current = null; setGrabbed(false); }} onWheel={event => { event.preventDefault(); move(distance + event.deltaY); }} onKeyDown={event => { if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return; event.preventDefault(); move(distance + (event.key === "ArrowUp" ? -20 : 20)); }}><Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 2.5], fov: 40 }}><WorthScene light={light} glasses={glasses} distance={distance} onLight={toggleLight} /></Canvas><div className="viewport-controls">Grip target · drag ↑ nearer · drag ↓ farther · wheel/arrows</div><div className="hand-readout"><span><b>R</b>Hold and position illuminated Worth target</span><span><b>L</b>Fit filters, then stay clear</span></div></div>
      <div className="clinical-coach" role="status"><p><b>Patient response</b>{asked && ready && !filter ? worthReports[finding] : "Check the filters, illuminate the target, and ask what the patient sees."}</p></div>
    </div><aside className="clinical-control-rail">
      <section><button className={`task-button ${correction ? "done" : ""}`} onClick={() => setCorrection(true)}>Fit habitual correction</button><button className={`task-button ${glasses ? "done" : ""}`} disabled={!correction} onClick={() => setGlasses(true)}>Fit red OD · green OS</button><button className="secondary full" onClick={toggleLight}>{light ? "Switch target off" : "Switch target on"}</button><p>Check each filter against the lit target.</p><div className="site-switch">{(["red", "green"] as const).map(value => <button key={value} disabled={!glasses || !light} onClick={() => { invalidate(); setFilter(value); }}>{value} filter {verified.includes(value) ? "✓" : ""}</button>)}</div></section>
      {(filter && light || asked && ready) && <section><p className="eyebrow">{filter ? `${filter.toUpperCase()} FILTER CHECK` : "PATIENT-REPORTED VIEW"}</p><svg viewBox="-160 -160 320 320" role="img" aria-label={filter ? `${filter === "red" ? "Two red" : "Three green"} dots through the isolated filter` : worthReports[finding]} style={{ width: "100%", background: "#020609", borderRadius: 8 }}><g transform={`scale(${filter ? 1 : Math.max(0.4, Math.min(1, 90 / distance))})`}>{dots.map((dot, i) => <circle key={i} cx={dot.x} cy={dot.y} r="9" fill={dot.color} />)}</g></svg>{filter && <button className="secondary full" onClick={() => { setVerified(values => [...new Set([...values, filter])]); setFilter(null); }}>Confirm {filter === "red" ? "green blocked · two red visible" : "red blocked · three green visible"}</button>}<small>Illustrated percept, enlarged for readability; not a calibrated visual test.</small></section>}
      <section><p>Move the target directly in the patient view. The range control and endpoint buttons provide keyboard-accessible alternatives.</p><label className="distance-control">Move target · {distance} cm<input type="range" min="40" max="600" step="20" value={distance} onChange={event => move(+event.target.value)} /></label><div className="site-switch"><button onClick={() => move(40)}>Near · 40 cm</button><button onClick={() => move(600)}>Distance · 6 m</button></div><button className="primary full" disabled={!ready} onClick={() => { setFilter(null); setAsked(true); }}>Ask count, colours, and positions</button></section>
      <section className="clinical-observation"><label>Number of dots<select value={count} disabled={!asked || !ready || !!filter} onChange={event => { setCount(event.target.value); setFeedback(""); }}><option value="">Choose</option>{[2, 3, 4, 5].map(n => <option key={n}>{n}</option>)}</select></label><label>Interpretation<select value={answer} disabled={!asked || !ready || !!filter} onChange={event => { setAnswer(event.target.value); setFeedback(""); }}><option value="">Choose</option>{(["fusion", "suppress-os", "suppress-od", "eso", "exo", "left-hyper", "right-hyper"] as WorthFinding[]).map(value => <option key={value} value={interpretWorth(value)}>{({ fusion: "Flat fusion", "suppress-os": "Left-eye suppression", "suppress-od": "Right-eye suppression", eso: "Eso · uncrossed", exo: "Exo · crossed", "left-hyper": "Left hyper", "right-hyper": "Right hyper" })[value]}</option>)}</select></label><button className="primary full" disabled={!ready || !asked || !!filter || !count || !answer} onClick={record}>Record at {distance} cm</button><p role="status">{feedback}</p>{records.map(row => <p key={row.distance}>{row.distance} cm: {worthReports[row.finding]}</p>)}{complete && <p className="neutral-message success">Near and distance recorded.{worthCases[index] === "central-os" && " This fictional patient fuses the larger near pattern but suppresses OS for the smaller distance pattern. The transition is illustrative, not a clinical cutoff."}</p>}<button className="secondary full" onClick={() => { setIndex(value => (value + 1) % worthCases.length); setRecords([]); move(40); }}>New patient pattern</button></section>
    </aside></div>
  </dialog>;
}
