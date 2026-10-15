import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas } from "./PracticeWebGLFallback";
import { EyeSurface } from "../scene/EyeSurface";
import {
  MADDOX_PRISM_CELLS, MADDOX_TRIALS, armMaddoxReport, cancelMaddoxEntry, captureMaddox, enterMaddox,
  interruptMaddox, maddoxGuidedStep, maddoxPatientReport, maddoxSetupIssue, newMaddoxRun,
  sampleMaddox, submitMaddox, type MaddoxBase, type MaddoxPrismPower, type MaddoxRun, type MaddoxSpatialSample,
} from "../interaction/maddoxProcedure";
import { PracticeVoiceControl } from "../voice/PracticeVoiceControl";
import { usePracticeAttempt } from "./PracticeAttemptContext";

const OD = { x: -0.22, y: 0.2 };
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const rodAtOD = (rod: { x: number; y: number }) => Math.hypot(rod.x - OD.x, rod.y - OD.y) <= .075;

function MaddoxScene({ rod, angle, cell, base, targetPowered, near, correction }: {
  rod: { x: number; y: number }; angle: number; cell: MaddoxPrismPower; base: MaddoxBase; targetPowered: boolean; near: boolean; correction: boolean;
}) {
  const movement = useRef({ x: 0, y: 0, used: true });
  return <>
    <color attach="background" args={["#09161b"]} /><ambientLight intensity={1.3} /><directionalLight position={[-2, 3, 4]} intensity={2} />
    <mesh scale={[0.64, 0.85, 0.48]}><sphereGeometry args={[1, 40, 28]} /><meshStandardMaterial color="#a97453" /></mesh>
    <group position={[0, 0.2, 0.51]} scale={1.3}><EyeSurface x={-0.17} pupils={false} motility={false} progress={0} movement={movement} /><EyeSurface x={0.17} pupils={false} motility={false} progress={0} movement={movement} /></group>
    {correction && [-0.22, 0.22].map(x => <mesh key={x} position={[x, 0.2, 0.67]}><torusGeometry args={[0.16, 0.015, 12, 32]} /><meshStandardMaterial color="#293d43" /></mesh>)}
    <group position={[rod.x, rod.y, 0.73]}>
      <mesh><torusGeometry args={[0.14, 0.018, 12, 32]} /><meshStandardMaterial color="#8e3944" /></mesh>
      <mesh><circleGeometry args={[0.13, 32]} /><meshPhysicalMaterial color="#df333a" transparent opacity={0.45} /></mesh>
      <group rotation={[0, 0, angle * Math.PI / 180]}>{[-0.09, -0.06, -0.03, 0, 0.03, 0.06, 0.09].map(y => <mesh key={y} position={[0, y, 0.015]}><boxGeometry args={[2 * Math.sqrt(0.12 ** 2 - y ** 2), 0.008, 0.014]} /><meshStandardMaterial color="#f36c65" /></mesh>)}</group>
    </group>
    <group position={[-0.22, -0.25, 0.91]}>
      <mesh><boxGeometry args={[0.18, 0.72, 0.04]} /><meshPhysicalMaterial color="#b3ded7" transparent opacity={0.3} /></mesh>
      {MADDOX_PRISM_CELLS.map((power, index) => <mesh key={power} position={[0, -.27 + index * .075, .025]}><circleGeometry args={[power === cell ? .038 : .031, 24]} /><meshPhysicalMaterial color={power === cell ? "#fff1a8" : "#caeee6"} transparent opacity={power === cell ? .75 : .45} /></mesh>)}
      <mesh rotation={[0, 0, ({ BI: Math.PI / 2, BO: -Math.PI / 2, BU: Math.PI, BD: 0 } as const)[base]]}><coneGeometry args={[0.09, 0.15, 3]} /><meshPhysicalMaterial color="#caeee6" transparent opacity={0.7} /></mesh>
    </group>
    <group position={[0.53, -0.4, near ? 1.05 : 0.8]}><mesh><cylinderGeometry args={[0.035, 0.035, 0.33, 20]} /><meshStandardMaterial color="#273c43" /></mesh><mesh position={[0, 0.19, 0]}><sphereGeometry args={[0.04, 20, 14]} /><meshBasicMaterial color={targetPowered ? "#fff6c3" : "#465455"} /></mesh></group>
  </>;
}

export function MaddoxPracticeStage({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const { settings } = usePracticeAttempt();
  const guided = settings?.kind !== "test";
  const dialog = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ x: number; y: number; rod: { x: number; y: number }; cellIndex: number; nearDistance: number } | null>(null);
  const [run, setRun] = useState<MaddoxRun>(() => newMaddoxRun());
  const [correction, setCorrection] = useState(false);
  const [rod, setRod] = useState({ x: -0.65, y: -0.25 });
  const [angle, setAngle] = useState(90);
  const [targetPowered, setTargetPowered] = useState(false);
  const [nearDistance, setNearDistance] = useState(40);
  const [fixationInstruction, setFixationInstruction] = useState(false);
  const [prismHeld, setPrismHeld] = useState(false);
  const [cellIndex, setCellIndex] = useState(MADDOX_PRISM_CELLS.length - 1);
  const [base, setBase] = useState<MaddoxBase>("BI");
  const [tool, setTool] = useState<"rod" | "prism" | "penlight">("rod");
  const trial = MADDOX_TRIALS[run.trialIndex];
  const cell = MADDOX_PRISM_CELLS[cellIndex];
  const rodFitted = rodAtOD(rod);
  const sample = useMemo<MaddoxSpatialSample>(() => ({ correctionFitted: correction, rodFitted, grooveDegrees: rodFitted ? angle : null,
    targetReady: trial.site === "distance" || nearDistance >= 38 && nearDistance <= 42, targetPowered, targetSite: trial.site,
    distanceCm: trial.site === "distance" ? 600 : nearDistance, fixationInstruction, prismHeld, prismForward: true,
    prismAligned: prismHeld, cell: prismHeld ? cell : null, base: prismHeld ? base : null, tracking: true,
  }), [angle, base, cell, correction, fixationInstruction, nearDistance, prismHeld, rodFitted, targetPowered, trial.site]);
  const issue = maddoxSetupIssue(sample, trial);
  const guide = maddoxGuidedStep(run, sample);
  const done = run.phase === "complete";
  const entryReady = Boolean(run.capture) && !prismHeld && (trial.site === "distance" || !targetPowered);

  useEffect(() => { const node = dialog.current; const previous = document.activeElement as HTMLElement | null; node?.showModal(); return () => { node?.close(); previous?.focus(); }; }, []);
  useEffect(() => {
    if (!run.reportInstruction || run.capture || done) return;
    const sampled = sampleMaddox(run, sample, performance.now());
    setRun(sampled);
    if (sampled.stableCell === null) return;
    const timer = window.setTimeout(() => setRun(current => sampleMaddox(current, sample, performance.now())), 260);
    return () => window.clearTimeout(timer);
  // Physical changes resample immediately; the timer supplies the 250 ms stable report dwell.
  }, [angle, base, cell, correction, done, fixationInstruction, nearDistance, prismHeld, rod.x, rod.y, run.capture, run.reportInstruction, targetPowered]);

  const invalidate = (message: string) => setRun(current => interruptMaddox(current, message));
  const rotate = () => { if (done || run.capture) return; setAngle(value => (value + 90) % 180); invalidate("Rod orientation changed."); };
  const moveRod = (x: number, y: number) => { if (done || run.capture) return; setRod({ x: clamp(x, -.8, .8), y: clamp(y, -.5, .6) }); invalidate("Rod fitting changed."); };
  const changeCell = (index: number) => { if (!prismHeld || done || run.capture) return; setCellIndex(clamp(Math.round(index), 0, MADDOX_PRISM_CELLS.length - 1)); };
  const resetControls = () => { setRod({ x: -0.65, y: -0.25 }); setAngle(90); setTargetPowered(false); setNearDistance(40); setFixationInstruction(false); setPrismHeld(false); setCellIndex(MADDOX_PRISM_CELLS.length - 1); setBase("BI"); setTool("rod"); drag.current = null; };
  const record = () => { const next = submitMaddox(run); setRun(next); if (next.records.length > run.records.length && next.phase !== "complete") resetControls(); if (next.phase === "complete" && run.phase !== "complete") onComplete(); };
  const report = run.report || (run.reportInstruction && prismHeld ? maddoxPatientReport(trial, cell, base) : "No report yet.");

  return <dialog ref={dialog} className="clinical-practice-dialog" aria-labelledby="maddox-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="clinical-stage-header"><div><p className="eyebrow">{guided ? "GUIDED PRACTICE" : "INDEPENDENT TEST"} · LATENT DEVIATION</p><h1 id="maddox-title">Maddox rod · {trial.axis}</h1></div><div className="clinical-stage-distance"><span>{trial.site} target</span><strong>{trial.site === "near" ? `${nearDistance} cm` : "mirrored 6 m"} · OD rod</strong></div><PracticeVoiceControl /><button className="secondary" onClick={onClose}>Close</button></header>
    <div className="clinical-stage-body"><div className="clinical-viewport-wrap">
      <div className="clinical-viewport" tabIndex={0} aria-label="Maddox equipment. Drag the selected rod, stepped prism bar or near penlight. Use arrows for movement and R to roll the rod."
        onPointerDown={event => { if (event.button !== 0 || done || run.capture) return; event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, rod, cellIndex, nearDistance }; }}
        onPointerMove={event => { const start = drag.current; if (!start) return; if (tool === "rod") moveRod(start.rod.x + (event.clientX - start.x) * .003, start.rod.y - (event.clientY - start.y) * .003); else if (tool === "prism") changeCell(start.cellIndex - (event.clientY - start.y) / 28); else { setNearDistance(clamp(Math.round(start.nearDistance + (event.clientY - start.y) / 8), 25, 60)); invalidate("Near penlight distance changed."); } }}
        onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); drag.current = null; }} onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}
        onKeyDown={event => { if (event.key.toLowerCase() === "r") { event.preventDefault(); rotate(); return; } if (!event.key.startsWith("Arrow")) return; event.preventDefault(); if (tool === "prism") changeCell(cellIndex + (event.key === "ArrowUp" ? 1 : -1)); else if (tool === "penlight") { setNearDistance(value => clamp(value + (event.key === "ArrowUp" ? 1 : -1), 25, 60)); invalidate("Near penlight distance changed."); } else moveRod(rod.x + (event.key === "ArrowLeft" ? -.025 : event.key === "ArrowRight" ? .025 : 0), rod.y + (event.key === "ArrowUp" ? .025 : event.key === "ArrowDown" ? -.025 : 0)); }}>
        <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 2.5], fov: 40 }}><MaddoxScene rod={rod} angle={angle} cell={cell} base={base} targetPowered={targetPowered} near={trial.site === "near"} correction={correction} /></Canvas>
        <div className="facility-hud"><span>{tool.toUpperCase()} SELECTED</span><strong>{cell}Δ {base}</strong><small>Rod {rodFitted ? `fitted · ${angle}° grooves` : "not fitted"}</small></div>
      </div>
      {guided && <div className="clinical-coach maddox-guided" role="status" data-guided-step={guide.id}><p className="eyebrow">GUIDED · STEP {guide.index + 1} OF 10</p><p><b>{guide.title}</b>{guide.lines.join(" ")}</p></div>}
    </div><aside className="clinical-control-rail">
      <section><p className="eyebrow">TRIAL {run.trialIndex + 1} OF 4 · {trial.site.toUpperCase()} {trial.axis.toUpperCase()}</p>
        <button className={`task-button ${correction ? "done" : ""}`} disabled={done || Boolean(run.capture)} onClick={() => setCorrection(true)}>Fit habitual correction</button>
        <div className="site-switch"><button className={tool === "rod" ? "selected" : ""} onClick={() => setTool("rod")}>Rod</button><button className={tool === "prism" ? "selected" : ""} onClick={() => setTool("prism")}>Prism bar</button>{trial.site === "near" && <button className={tool === "penlight" ? "selected" : ""} onClick={() => setTool("penlight")}>Penlight</button>}</div>
        <button className="secondary full" disabled={done || Boolean(run.capture)} onClick={() => moveRod(OD.x, OD.y)}>Fit rod before OD</button>
        <button className="secondary full" disabled={done || Boolean(run.capture)} onClick={rotate}>Remove, roll and refit rod · {angle}°</button>
      </section>
      <section><button className="secondary full" disabled={done || Boolean(run.capture) && trial.site === "distance"} onClick={() => { setTargetPowered(value => !value); invalidate("Target light changed."); }}>{targetPowered ? `Release ${trial.site === "near" ? "penlight trigger" : "target switch"}` : `Press ${trial.site === "near" ? "penlight trigger" : "target switch"}`}</button>
        {trial.site === "near" && <label className="distance-control">Held penlight · {nearDistance} cm<input type="range" min="25" max="60" value={nearDistance} disabled={Boolean(run.capture)} onChange={event => { setNearDistance(Number(event.target.value)); invalidate("Near penlight distance changed."); }} /></label>}
        <button className={`task-button ${fixationInstruction ? "done" : ""}`} disabled={done || Boolean(run.capture)} onClick={() => { setFixationInstruction(true); setRun(current => armMaddoxReport(current, { ...sample, fixationInstruction: true })); }}>Tell me where the streak is and when it passes through the light</button>
        <button className={`task-button ${prismHeld ? "done" : ""}`} disabled={done || Boolean(run.capture) && !prismHeld} onClick={() => setPrismHeld(value => !value)}>{prismHeld ? "Put prism bar down" : "Pick up prism bar"}</button>
        <label>Physical base arrow<select value={base} disabled={!prismHeld || done || Boolean(run.capture)} onChange={event => setBase(event.target.value as MaddoxBase)}>{(["BI", "BO", "BU", "BD"] as const).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <label className="distance-control">Cell over OD · {cell}Δ<input type="range" min="0" max={MADDOX_PRISM_CELLS.length - 1} step="1" value={cellIndex} disabled={!prismHeld || done || Boolean(run.capture)} onChange={event => changeCell(Number(event.target.value))} /></label>
        <button className="primary full" disabled={done || Boolean(run.capture) || !run.reportInstruction} onClick={() => setRun(current => captureMaddox(current, sample))}>Prism-hand trigger · capture coincidence</button>
        <p role="status">{run.feedback || issue || "Complete the physical setup."}</p>
      </section>
      {(run.reportInstruction || run.capture) && <section className="maddox-patient-view"><p className="eyebrow">FICTIONAL PATIENT-REPORTED VIEW · ENLARGED ILLUSTRATION · NOT A CALIBRATED VISUAL TEST</p><svg viewBox="-140 -110 280 220" role="img" aria-label={report}><circle r="7" fill="#fff3c4" />{trial.axis === "horizontal" ? <line x1={run.report.includes("right") ? 65 : run.report.includes("left") ? -65 : 0} x2={run.report.includes("right") ? 65 : run.report.includes("left") ? -65 : 0} y1="-95" y2="95" stroke="#ff5757" strokeWidth="4" /> : <line x1="-125" x2="125" y1={run.report.includes("below") ? 65 : run.report.includes("above") ? -65 : 0} y2={run.report.includes("below") ? 65 : run.report.includes("above") ? -65 : 0} stroke="#ff5757" strokeWidth="4" />}</svg><p data-voice-report>{run.report || "Hold one cell steady for Arun's report."}</p></section>}
      <section className="clinical-observation"><label>Captured prism power (Δ)<input type="number" min="0" max="20" value={run.entryPower} disabled={!entryReady || done} onChange={event => setRun(current => enterMaddox(current, event.target.value, current.entryBase))} /></label>
        <label>Captured prism base<select value={run.entryBase} disabled={!entryReady || done} onChange={event => setRun(current => enterMaddox(current, current.entryPower, event.target.value as MaddoxBase))}><option value="">Choose independently</option>{(["BI", "BO", "BU", "BD"] as const).map(value => <option key={value} value={value}>{value}</option>)}</select></label>
        <button className="primary full" disabled={!entryReady || !run.entryPower || !run.entryBase || done} onClick={record}>Record captured trial</button>
        {run.capture && !done && <button className="secondary full" onClick={() => setRun(current => cancelMaddoxEntry(current))}>Cancel recording</button>}
        <div aria-label="Recorded Maddox trials">{run.records.map(row => <p key={row.capture.trialId}>{row.capture.site} · {row.capture.axis}: {row.submittedPower}Δ {row.submittedBase} · {Math.round(row.capture.distanceCm)} cm</p>)}</div>
        {done ? <><p className="neutral-message success">Distance and near · both axes complete.</p><button className="secondary full" onClick={() => { setRun(newMaddoxRun()); setCorrection(false); resetControls(); }}>Repeat same case</button></> : <button className="reset-technique" onClick={() => { setRun(current => interruptMaddox(current, "Current trial reset.")); resetControls(); }}>Reset current trial</button>}
      </section>
    </aside></div>
  </dialog>;
}
