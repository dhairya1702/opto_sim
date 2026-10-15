import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame, type RootState } from "@react-three/fiber";
import { Canvas } from "./PracticeWebGLFallback";
import { EyeSurface } from "../scene/EyeSurface";
import { fourPrismGaze, prismEyeAt, type PrismCase, type PrismEye } from "../interaction/fourPrism";
import {
  FOUR_PRISM_GUIDED_STEP_COUNT, advanceFourPrismSample, cancelFourPrismRun, confirmFourPrismWithdrawal,
  establishFourPrismFixation, exitFourPrismRun, finalizeFourPrismRun, fourPrismBaseAlignmentError,
  fourPrismGuidedStep, fourPrismObservationLabel, fourPrismScenarioAt, handleFourPrismTool, initialFourPrismRun,
  interruptFourPrismEye, markFourPrismObservation, repeatFourPrismComparison, resetFourPrismRun, clearFourPrismFixation,
  reviseFourPrismFitting, seededFourPrismDeck, submitFourPrismInterpretation,
  type FourPrismObservation, type FourPrismRunState,
} from "../interaction/xrFourPrismPractice";
import { PracticeVoiceControl } from "../voice/PracticeVoiceControl";
import { usePracticeAttempt } from "./PracticeAttemptContext";

const choices: readonly [FourPrismObservation, string][] = [
  ["version-with-refixation", "Version with refixation"], ["version-without-refixation", "Version without refixation"], ["no-movement", "No movement"],
];
const newSeed = () => globalThis.crypto?.getRandomValues ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 0x100000000);

function Scene({ pose, rotation, run, onFrame }: { pose: { x: number; y: number }; rotation: number; run: FourPrismRunState; onFrame: (delta: number, state: RootState) => void }) {
  const movement = useRef({ x: 0, y: 0, used: true });
  const od = useRef({ x: 0, y: 0 }); const os = useRef({ x: 0, y: 0 });
  useFrame((state, delta) => {
    onFrame(delta, state);
    const gaze = run.currentEye ? fourPrismGaze(run.currentEye, run.scenario, run.dwellMs) : { od: 0, os: 0 };
    const blend = matchMedia("(prefers-reduced-motion: reduce)").matches ? 1 : 1 - Math.exp(-Math.min(delta, .1) * 10);
    od.current.x += (gaze.od - od.current.x) * blend; os.current.x += (gaze.os - os.current.x) * blend;
  });
  return <>
    <color attach="background" args={["#09161b"]} /><ambientLight intensity={1.4} /><directionalLight position={[-2, 3, 4]} intensity={2} />
    <mesh scale={[.64, .85, .48]}><sphereGeometry args={[1, 40, 28]} /><meshStandardMaterial color="#a97453" /></mesh>
    <group position={[0, .2, .51]} scale={1.3}><EyeSurface x={-.17} pupils={false} motility={false} progress={0} movement={movement} gazeOffset={od} /><EyeSurface x={.17} pupils={false} motility={false} progress={0} movement={movement} gazeOffset={os} /></group>
    <group position={[pose.x, pose.y, .78]} rotation={[0, 0, rotation * Math.PI / 180]} userData={{ dedicatedFourPrism: true }}>
      <mesh rotation={[Math.PI / 2, 0, 0]}><cylinderGeometry args={[.14, .14, .045, 40]} /><meshPhysicalMaterial color="#bce4dd" transmission={.45} transparent opacity={.5} /></mesh>
      <mesh position={[.17, 0, 0]} rotation={[0, 0, -Math.PI / 2]}><coneGeometry args={[.035, .10, 3]} /><meshStandardMaterial color="#f1c35e" /></mesh>
      <mesh position={[0, -.22, 0]} scale={[.09, .16, .065]}><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color="#a97453" /></mesh>
    </group>
  </>;
}

export function FourPrismPracticeStage({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const { settings } = usePracticeAttempt();
  const guided = settings?.kind !== "test";
  const dialog = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ x: number; y: number; pose: { x: number; y: number } } | null>(null);
  const deck = useRef(seededFourPrismDeck(newSeed())); const deckIndex = useRef(0);
  const initialScenario: PrismCase = guided ? "normal" : fourPrismScenarioAt(deck.current, 0);
  const runRef = useRef(initialFourPrismRun(initialScenario));
  const [run, setRun] = useState(runRef.current);
  const [pose, setPose] = useState({ x: 0, y: -.4 });
  const [rotation, setRotation] = useState(0);
  const [held, setHeld] = useState(false);
  const [renderAvailable, setRenderAvailable] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [interpretation, setInterpretation] = useState<PrismCase | "">("");
  const completed = useRef(false);
  const publish = useCallback((next: FourPrismRunState) => { if (next !== runRef.current) { runRef.current = next; setRun(next); } }, []);
  const baseAxis = (): [number, number, number] => { const radians = rotation * Math.PI / 180; return [Math.cos(radians), Math.sin(radians), 0]; };
  const move = (x: number, y: number) => setPose({ x: Math.max(-.8, Math.min(.8, x)), y: Math.max(-.5, Math.min(.6, y)) });
  const currentEye = prismEyeAt(pose.x, pose.y);

  useEffect(() => { const node = dialog.current; node?.showModal(); return () => { drag.current = null; node?.close(); }; }, []);
  useEffect(() => {
    const visibility = () => { if (document.hidden) publish(interruptFourPrismEye(runRef.current, true, "Rendering was interrupted. Completed eye evidence was preserved; establish fixation again.")); };
    document.addEventListener("visibilitychange", visibility); return () => document.removeEventListener("visibilitychange", visibility);
  }, [publish]);

  const sample = useCallback((delta: number) => {
    let next = handleFourPrismTool(runRef.current, held, 1);
    if (next.phase === "withdraw") next = confirmFourPrismWithdrawal(next, held ? [pose.x, pose.y + 1.3, -.48] : null, [0, 0, -1]);
    next = advanceFourPrismSample(next, { trackingValid: renderAvailable && !document.hidden, examinerViewValid: renderAvailable,
      correctionRevision: next.correctionRevision, fixationRevision: next.fixationRevision, prismToolRevision: 1, prismHeld: held,
      position: held ? [pose.x, pose.y + 1.3, -.48] : null, forward: [0, 0, -1], baseAxis: baseAxis(), detectedEye: currentEye,
      boAlignmentErrorRad: fourPrismBaseAlignmentError(baseAxis(), next.expectedEye), sampledDurationMs: delta * 1000 });
    publish(next);
  }, [currentEye, held, pose.x, pose.y, publish, renderAvailable, rotation]);

  function fit() {
    const next = reviseFourPrismFitting(runRef.current, !runRef.current.fitted, runRef.current.correctionRevision + 1);
    publish(next); setFeedback(next.notice); setInterpretation("");
  }
  function fixate() { const next = establishFourPrismFixation(runRef.current); publish(next); setFeedback(next.notice); }
  function pickup() { setHeld(true); publish(handleFourPrismTool(runRef.current, true, 1)); }
  function withdraw() { move(0, -.4); const next = confirmFourPrismWithdrawal(runRef.current, [.4, 1.5, -.48], [0, 0, -1]); publish(next); }
  function chooseObservation(eye: PrismEye, observation: FourPrismObservation) {
    let next = markFourPrismObservation(runRef.current, eye, observation); next = finalizeFourPrismRun(next);
    publish(next); setFeedback(next.notice);
  }
  function recordInterpretation() {
    if (!interpretation) return;
    const next = submitFourPrismInterpretation(runRef.current, interpretation); publish(next); setFeedback(next.notice);
    if (next.recorded && !completed.current) { completed.current = true; onComplete(); }
  }
  function repeat() { const next = repeatFourPrismComparison(runRef.current); publish(next); setInterpretation(""); setFeedback(next.notice); move(0, -.4); }
  function reset() {
    publish(resetFourPrismRun(runRef.current)); setPose({ x: 0, y: -.4 }); setRotation(0); setHeld(false); setFeedback(""); setInterpretation(""); completed.current = false; drag.current = null;
  }
  function nextPatient() {
    if (!runRef.current.recorded) return; deckIndex.current += 1;
    publish(initialFourPrismRun(fourPrismScenarioAt(deck.current, deckIndex.current), runRef.current.attempt + 1, runRef.current.generation + 1));
    setPose({ x: 0, y: -.4 }); setRotation(0); setHeld(false); setFeedback(""); setInterpretation(""); completed.current = false;
  }
  function close() { publish(exitFourPrismRun(runRef.current)); onClose(); }
  const guidance = fourPrismGuidedStep(run);
  const status = !renderAvailable ? "The rendered observation view is unavailable. Restore WebGL before attempting an eye observation."
    : !run.fitted ? "Fit best distance correction." : run.fixationSetupRevision !== run.setupRevision ? "Ask Arun to look at the isolated letter."
      : !run.prismHandled ? "Pick up the dedicated 4Δ prism." : run.phase === "withdraw" ? "OD captured · withdraw completely before OS."
        : run.phase === "record" ? "Record OD and OS observations separately." : run.phase === "interpret" ? "Choose the final interpretation."
          : run.phase === "complete" ? "Comparison recorded." : `Observe ${run.expectedEye} · ${Math.round(run.dwellMs)} / 2400 ms`;

  return <dialog ref={dialog} className="clinical-practice-dialog" aria-labelledby="four-title" onCancel={event => { event.preventDefault(); close(); }}>
    <header className="clinical-stage-header"><div><p className="eyebrow">{guided ? "GUIDED PRACTICE" : "INDEPENDENT TEST"} · SENSORY STATUS</p><h1 id="four-title">4Δ base-out test</h1></div><div className="clinical-stage-distance"><span>Distance fixation</span><strong>Dedicated fixed 4Δ prism</strong></div><PracticeVoiceControl /><button className="secondary" onClick={close}>Close</button></header>
    <div className="clinical-stage-body"><div className="clinical-viewport-wrap"><div className="clinical-viewport" tabIndex={0}
      aria-label="Move and rotate the dedicated 4 prism-dioptre prism. Arrow keys move; R and Shift+R rotate."
      onWheel={event => { event.preventDefault(); setRotation(value => (value + Math.sign(event.deltaY) * 5 + 360) % 360); }}
      onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, pose }; setHeld(true); publish(handleFourPrismTool(runRef.current, true, 1)); }}
      onPointerMove={event => { const start = drag.current; if (start) move(start.pose.x + (event.clientX - start.x) * .003, start.pose.y - (event.clientY - start.y) * .003); }}
      onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); drag.current = null; }}
      onPointerCancel={() => { drag.current = null; publish(interruptFourPrismEye(runRef.current, false)); }} onLostPointerCapture={() => { drag.current = null; publish(interruptFourPrismEye(runRef.current, false)); }}
      onKeyDown={event => { if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "r", "R"].includes(event.key)) return; event.preventDefault();
        if (event.key.toLowerCase() === "r") setRotation(value => (value + (event.shiftKey ? -5 : 5) + 360) % 360);
        else move(pose.x + (event.key === "ArrowLeft" ? -.025 : event.key === "ArrowRight" ? .025 : 0), pose.y + (event.key === "ArrowUp" ? .025 : event.key === "ArrowDown" ? -.025 : 0)); }}>
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 2.5], fov: 40 }} onCreated={({ gl }) => {
        setRenderAvailable(true); const lost = (event: Event) => { event.preventDefault(); setRenderAvailable(false); publish(interruptFourPrismEye(runRef.current, true, "The rendered view was lost. No unfinished observation was retained.")); };
        gl.domElement.addEventListener("webglcontextlost", lost, { once: true });
      }}><Scene pose={pose} rotation={rotation} run={run} onFrame={sample} /></Canvas>
      <div className="facility-hud"><span>FIXED 4Δ · BASE {Math.round(rotation)}°</span><strong>{currentEye ? `Before ${currentEye}` : "Position prism"}</strong><small>OD {run.eyeCaptures.OD ? "✓" : "—"} · OS {run.eyeCaptures.OS ? "✓" : "—"}</small></div>
      <div className="hand-readout"><span><b>R</b>Rotate base marking</span><span><b>↑↓←→</b>Move prism</span></div>
    </div>{guided && <div className="clinical-coach" role="status"><p><b>GUIDED · STEP {guidance.index + 1} OF {FOUR_PRISM_GUIDED_STEP_COUNT}</b>{guidance.title}. {guidance.lines.join(" ")}</p></div>}</div>
    <aside className="clinical-control-rail"><section><button className={`task-button ${run.fitted ? "done" : ""}`} onClick={fit}>{run.fitted ? "Remove / refit best distance correction" : "Fit best distance correction"}</button>
      <button className={`task-button ${run.fixationSetupRevision === run.setupRevision ? "done" : ""}`} disabled={!run.fitted} onClick={fixate}>Look at the isolated letter</button>
      <button className={`secondary full ${held ? "done" : ""}`} onClick={pickup}>Pick up dedicated 4Δ prism</button>
      <button className="secondary full" disabled={!held} onClick={() => { setHeld(false); publish(handleFourPrismTool(runRef.current, false, 2)); }}>Put down prism</button>
      <button className="secondary full" disabled={run.fixationSetupRevision === null} onClick={() => { const next = clearFourPrismFixation(runRef.current); publish(next); setFeedback(next.notice); }}>Clear fixation</button>
      <label className="distance-control">Physical base orientation · {rotation}°<input aria-label="Physical prism base orientation" type="range" min="0" max="355" step="5" value={rotation} onChange={event => setRotation(+event.target.value)} /></label></section>
      <section><p role="status" data-voice-status>{status}</p><div className="site-switch"><button disabled={!held || !renderAvailable || run.expectedEye !== "OD"} onClick={() => move(-.22, .2)}>Place OD</button><button disabled={!held || !renderAvailable || !run.withdrawalConfirmed} onClick={() => move(.22, .2)}>Place OS</button></div>
        <button className="secondary full" disabled={run.phase !== "withdraw"} onClick={withdraw}>Withdraw prism</button><progress aria-label="Observation hold" value={run.dwellMs} max="2400" /></section>
      {run.phase === "record" && <section className="clinical-observation"><h3>Record both observations</h3>{(["OD", "OS"] as const).map(eye => <label key={eye}>{eye}<select value={run.markings[eye] ?? ""} onChange={event => chooseObservation(eye, event.target.value as FourPrismObservation)}><option value="">Choose after observing</option>{choices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>)}</section>}
      {run.completedRun && <section className="clinical-observation"><p aria-label="Confirmed observations">{run.completedRun.records.map(record => `${record.capture.eye} · ${fourPrismObservationLabel(record.learnerObservation)}`).join("; ")}</p>
        <label>Final interpretation<select disabled={run.recorded} value={interpretation} onChange={event => setInterpretation(event.target.value as PrismCase | "")}><option value="">Choose</option><option value="normal">Normal response</option><option value="suppression">Central suppression of OS</option></select></label>
        <button className="primary full" disabled={!interpretation || run.recorded} onClick={recordInterpretation}>Interpret and record</button></section>}
      <section><p role="status">{feedback}</p>{run.eyeCaptures.OD && !run.recorded && <button className="secondary full" onClick={repeat}>Repeat comparison</button>}
        {run.recorded && <button className="secondary full" onClick={nextPatient}>New patient</button>}<button className="reset-technique" onClick={reset}>Full reset</button>
        <p className="small">Eye movement and prism handling are illustrative educational approximations, not calibrated physiology or optics.</p></section>
    </aside></div>
  </dialog>;
}
