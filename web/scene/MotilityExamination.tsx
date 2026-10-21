import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EyeSurface } from "./EyeSurface";
import { gazePositions, motilityNextGazeIds, newMotilityCoverage, motilityObservations, motilityRecordedObservation, motilityScenario, motilityScenarios, observeTarget, targetFromControls, type MotilityCoverage, type MotilityScenarioId } from "../interaction/motility";
import { TestVoiceControl } from "../voice/TestVoiceControl";
import { PracticeVoiceControl } from "../voice/PracticeVoiceControl";
import type { PracticeAttemptKind } from "../practice/PracticeAttemptContext";

class ViewBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? <p className="notice">The eye view is unavailable. Cancel and try again with 3D rendering enabled.</p> : this.props.children; }
}
function RenderSignal({ onFrame }: { onFrame: () => void }) {
  useFrame(({ camera, size }) => {
    camera.position.z = Math.max(0.78, 0.4 / (Math.tan(43 * Math.PI / 360) * size.width / size.height));
    onFrame();
  });
  return null;
}
function MotilityHands({ x, y, light }: { x: number; y: number; light: boolean }) {
  const toolX = x * .31;
  const toolY = y * .2 - .08;
  const skin = "#a97453";
  return <>
    <group position={[toolX, toolY, .32]} rotation={[0, 0, -.16]}>
      <mesh position={[0, -.13, 0]}><cylinderGeometry args={[.014, .019, .28, 18]} /><meshStandardMaterial color="#718588" metalness={.5} roughness={.3} /></mesh>
      <mesh position={[0, .025, 0]}><cylinderGeometry args={[.021, .017, .045, 18]} /><meshStandardMaterial color="#becac8" metalness={.55} roughness={.22} /></mesh>
      <mesh position={[0, .052, .006]}><sphereGeometry args={[.018, 16, 10]} /><meshStandardMaterial color={light ? "#fff0ae" : "#59696a"} emissive={light ? "#ffd05f" : "#000"} emissiveIntensity={light ? 4 : 0} /></mesh>
      {light && <pointLight position={[0, .06, .02]} color="#ffe29a" intensity={1.3} distance={.65} />}
      <mesh position={[.02, -.21, .02]} scale={[.085, .14, .06]}><sphereGeometry args={[1, 18, 12]} /><meshStandardMaterial color={skin} roughness={.9} /></mesh>
    </group>
    <group position={[-.44, -.34, .28]} rotation={[0, 0, -.4]}>
      <mesh scale={[.075, .12, .05]}><sphereGeometry args={[1, 18, 12]} /><meshStandardMaterial color={skin} roughness={.9} /></mesh>
      {[0, 1, 2, 3].map(i => <mesh key={i} position={[(i - 1.5) * .027, .12, 0]}><capsuleGeometry args={[.012, .085, 4, 8]} /><meshStandardMaterial color={skin} roughness={.9} /></mesh>)}
    </group>
  </>;
}

export function MotilityExamination({ onComplete, onCancel, practiceAttempt, scenarioId = "full", findingPosition, onNext }: {
  onComplete: (observation?: string) => void; onCancel: () => void; practiceAttempt?: PracticeAttemptKind;
  scenarioId?: MotilityScenarioId; findingPosition?: { current: number; total: number }; onNext?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const pose = useRef(targetFromControls(0, 0, 0.35));
  const movement = useRef({ x: 0, y: 0, used: true });
  const [control, setControl] = useState({ x: 0, y: 0, z: 0.35 });
  const [following, setFollowing] = useState(false);
  const [light, setLight] = useState(false);
  const [grabbed, setGrabbed] = useState(false);
  const [optionalGuides, setGuides] = useState(practiceAttempt !== "test");
  const guides = practiceAttempt === "guided" || optionalGuides;
  const [asked, setAsked] = useState(false);
  const [observation, setObservation] = useState("");
  const [checked, setChecked] = useState(false);
  const [failed, setFailed] = useState(false);
  const renderedAt = useRef(0);
  const assistedInput = useRef(false);
  const [coverage, setCoverage] = useState<MotilityCoverage>(newMotilityCoverage);
  const reduced = useRef(matchMedia("(prefers-reduced-motion: reduce)").matches);
  const done = useRef(false);
  const scenario = motilityScenario(scenarioId);
  const update = (x: number, y: number, z = control.z) => {
    const next = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)), z };
    pose.current = targetFromControls(next.x, next.y, next.z);
    setControl(next);
  };
  useEffect(() => {
    const el = dialog.current!;
    el.showModal();
    return () => el.close();
  }, []);
  useEffect(() => {
    let previousFrame = 0;
    const timer = setInterval(() => {
      const frame = renderedAt.current;
      if (!following || !light || failed || document.hidden) {
        setCoverage(s => observeTarget(s, pose.current, 0, false));
        previousFrame = frame;
        return;
      }
      if (frame === previousFrame) return;
      const dt = previousFrame ? (frame - previousFrame) / 1000 : 0;
      previousFrame = frame;
      setCoverage(s => observeTarget(s, pose.current, dt, true, { assisted: assistedInput.current }));
    }, 50);
    return () => clearInterval(timer);
  }, [following, light, failed]);
  const previousScenario = useRef(scenario.id);
  useEffect(() => {
    if (previousScenario.current === scenario.id) return;
    previousScenario.current = scenario.id;
    pose.current = targetFromControls(0, 0, control.z);
    setControl(current => ({ ...current, x: 0, y: 0 }));
    setFollowing(false); setAsked(false); setObservation(""); setChecked(false);
    setCoverage(newMotilityCoverage()); done.current = false;
  }, [scenario.id, control.z]);
  const ready = light && coverage.seen.length === gazePositions.length && asked && !!observation && !failed;
  const correct = observation === scenario.id;
  const recordedObservation = motilityRecordedObservation(observation);
  const movePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    update(((e.clientX - r.left) / r.width - 0.5) / 0.4, (0.5 - (e.clientY - r.top) / r.height) / 0.4);
  };
  return (
    <dialog ref={dialog} className="examination-stage motility-stage" aria-labelledby="motility-title" onCancel={e => { e.preventDefault(); onCancel(); }}>
      <header><div><p className="eyebrow">MANUAL EXAMINATION · BOTH EYES</p><h1 id="motility-title">Extraocular motilities</h1></div>{findingPosition && <div className="clinical-stage-distance"><span>Finding</span><strong>{findingPosition.current}/{findingPosition.total}</strong></div>}{practiceAttempt ? <PracticeVoiceControl /> : <TestVoiceControl />}<button className="secondary" onClick={onCancel}>Cancel</button></header>
      {practiceAttempt === "guided" && <div className="motility-guided-step" role="status"><b>Next step</b>{!following ? "Ask the patient to follow the target while keeping the head still." : !light ? "Switch the penlight on." : coverage.seen.length < gazePositions.length ? coverage.notice || `Follow the highlighted H route and hold each point · ${coverage.seen.length} of ${gazePositions.length} observed.` : !asked ? "Ask about double vision, pain, or discomfort." : !observation ? "Choose the observation that matches what you saw." : "Record the finding."}</div>}
      <div className="motility-instructions">
        <p>Hold the target at 30–40 cm. Keep Arun’s head still, establish primary position, then move through all eight cardinal directions. Watch both eyes and hold each marked position.</p>
        <button className="primary" disabled={following} onClick={() => setFollowing(true)}>{following ? "Arun is following the target" : "Ask Arun to follow the target, head still"}</button>
        <p className="small" aria-live="polite">{following ? 'Arun: “Okay, I’ll follow it with my eyes.”' : "Explain the examination before moving the target."}</p>
      </div>
      <div ref={viewport} className={`eye-viewport motility-viewport ${grabbed ? "is-grabbed" : ""}`} tabIndex={0} role="application" aria-label="Manual fixation target. Drag to move, arrow keys to adjust, Page Up and Page Down to change distance."
        onPointerDown={e => { if (e.button !== 0) return; assistedInput.current = false; e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId); setGrabbed(true); movePointer(e); }}
        onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) movePointer(e); }}
        onPointerUp={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); setGrabbed(false); }}
        onPointerCancel={() => setGrabbed(false)} onLostPointerCapture={() => setGrabbed(false)}
        onKeyDown={e => {
          if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown"].includes(e.key)) return;
          e.preventDefault(); e.stopPropagation();
          assistedInput.current = true;
          update(control.x + (e.key === "ArrowLeft" ? -0.1 : e.key === "ArrowRight" ? 0.1 : 0), control.y + (e.key === "ArrowUp" ? 0.1 : e.key === "ArrowDown" ? -0.1 : 0), Math.max(0.3, Math.min(0.4, control.z + (e.key === "PageUp" ? -0.05 : e.key === "PageDown" ? 0.05 : 0))));
        }}>
        <ViewBoundary onFailure={() => setFailed(true)}>
          <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 1.2], fov: 43 }} fallback={<p className="notice">3D eye view unavailable. This manual examination needs WebGL.</p>}>
            <color attach="background" args={["#16262b"]} />
            <ambientLight intensity={1.6} /><directionalLight position={[-1, 2, 3]} intensity={2} />
            <RenderSignal onFrame={() => { renderedAt.current = performance.now(); }} />
            {[-0.2, 0.2].map(x => <EyeSurface key={x} x={x} pupils={false} motility progress={0} movement={movement} fixation={pose} tracking={following} reducedMotion={reduced.current} motilityScenarioId={practiceAttempt ? scenario.id : undefined} />)}
            <MotilityHands x={control.x} y={control.y} light={light} />
          </Canvas>
        </ViewBoundary>
        <div className="gaze-overlay" aria-hidden="true">
          {guides && <svg className="gaze-path" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M18 22 V78 M18 50 H82 M82 22 V78 M50 22 V78" /></svg>}
          {guides && gazePositions.map(p => <span key={p.id} className={`gaze-stop ${coverage.seen.includes(p.id) ? "seen" : ""} ${coverage.current === p.id ? "observing" : ""} ${motilityNextGazeIds(coverage).includes(p.id) ? "next" : ""}`} style={{ left: `${50 + p.x * 40}%`, top: `${50 - p.y * 40}%` }}>{coverage.seen.includes(p.id) ? "✓" : "·"}</span>)}
        </div>
        <div className="hand-readout motility-hand-readout" aria-hidden="true"><span><b>R</b>Hold + move penlight</span><span><b>L</b>Gesture “head still” · no patient contact</span></div>
        <span className="visual-label">Drag to move your penlight · arrow keys for fine movement · enlarged eye view</span>
      </div>
      <footer>
        <div className="motility-controls">
          <label>Target distance: {Math.round(control.z * 100)} cm<input aria-label="Target distance" type="range" min="30" max="40" step="5" value={Math.round(control.z * 100)} onChange={e => update(control.x, control.y, Number(e.target.value) / 100)} /></label>
          <button className={light ? "primary" : "secondary"} onClick={() => setLight(value => !value)}>{light ? "Penlight on" : "Switch penlight on"}</button>
          {practiceAttempt !== "test" && practiceAttempt !== "guided" && <label className="check-row"><input type="checkbox" checked={guides} onChange={e => setGuides(e.target.checked)} />Show H-pattern guides</label>}
          <button className="secondary" onClick={() => update(0, 0)}>Return target to start</button>
        </div>
        <ul className="gaze-checklist sr-only" aria-label="Observed gaze positions">{gazePositions.map(p => <li key={p.id}>{coverage.seen.includes(p.id) ? "✓" : "○"} {p.label}</li>)}</ul>
        <p role="status">{coverage.seen.length} / {gazePositions.length} positions observed{coverage.notice ? ` · ${coverage.notice}` : coverage.current && !coverage.seen.includes(coverage.current) ? " · hold steady…" : ""}</p>
        <div className="motility-review">
          <button className="secondary" disabled={!following || coverage.seen.length < gazePositions.length} onClick={() => setAsked(true)}>Ask about double vision, pain, or discomfort</button>
          {asked && <p>Arun: “<span data-voice-report>{scenario.patientReply}</span>”</p>}
          <label>What did you observe?<select value={observation} disabled={checked && correct} onChange={e => { setObservation(e.target.value); setChecked(false); }}><option value="">Choose after observing</option>{motilityObservations.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          {checked && <div className={correct ? "trainer-feedback correct" : "trainer-feedback incorrect"}><b>{correct ? "Correct" : "Look again"}</b><p>{correct ? scenario.teachingFeedback : "Compare OD and OS through every gaze direction, then use the patient's symptom localization."}</p>{correct && onNext && <button className="secondary" onClick={onNext}>New patient finding</button>}</div>}
        </div>
        <button className="primary full" disabled={!ready || (checked && correct)} onClick={() => {
          if (!ready) return;
          if (!practiceAttempt) { if (done.current) return; done.current = true; onComplete(recordedObservation); return; }
          setChecked(true); if (correct) onComplete(recordedObservation);
        }}>{practiceAttempt ? "Submit finding" : "Record finding & return to room →"}</button>
        <p className="small muted">Simplified draft movement examples. Position coverage is a practice aid, not a clinical technique score or diagnosis. {practiceAttempt ? `${motilityScenarios.length} authored findings are shared by Guided Practice and Test.` : "Your selected observation is preserved for debrief comparison."}</p>
      </footer>
    </dialog>
  );
}
