import { useEffect, useRef, useState } from "react";
import { Canvas } from "./PracticeWebGLFallback";
import { LensScene } from "./MinusLensPracticeStage";
import { initialRelativeState, recordRelative, relativeBlur, relativeStep } from "../interaction/relativeAccommodation";

export function RelativeAccommodationStage({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const locked = useRef(false);
  const [state, setState] = useState(initialRelativeState);
  const [correction, setCorrection] = useState(false);
  const [fixation, setFixation] = useState(false);
  const [pending, setPending] = useState(false);
  const ready = correction && fixation;
  const done = state.phase === "done";
  const atBaseline = state.phase === "baseline" && state.power === 0;
  const blur = relativeBlur(state);
  const signed = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)} D`;
  const action = state.phase === "nra" ? "Add +0.25 D to both eyes" : state.phase === "baseline" ? "Remove +0.25 D from both eyes" : "Add −0.25 D to both eyes";
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  useEffect(() => {
    if (!pending) return;
    // Fictional patient response pacing, not a clinical timing standard.
    const timer = window.setTimeout(() => { locked.current = false; setPending(false); }, 1200);
    return () => window.clearTimeout(timer);
  }, [pending, state.power]);
  function step() {
    if (!ready || pending || locked.current || done) return;
    const next = relativeStep(state);
    if (next.power === state.power) return;
    locked.current = true; setPending(true); setState(next);
  }
  function record() {
    if (!ready || pending || locked.current || done) return;
    const next = recordRelative(state, true);
    setState(next);
    if (next.phase === "done") onComplete();
  }
  return <dialog ref={dialog} className="clinical-practice-dialog" aria-labelledby="relative-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="clinical-stage-header"><div><p className="eyebrow">LIVE PRACTICE · ACCOMMODATION</p><h1 id="relative-title">NRA / PRA · binocular</h1></div><div className="clinical-stage-distance"><span>Fixed near target</span><strong>40 cm · OU</strong></div><button className="secondary" onClick={onClose}>Close</button></header>
    <div className="clinical-stage-body"><div className="clinical-viewport-wrap">
      <div className="clinical-viewport" tabIndex={0} aria-label="Binocular trial lenses. Click the lens pair or press Space for the next quarter-diopter step." onKeyDown={event => { if (event.key !== " " || event.repeat) return; event.preventDefault(); step(); }}>
        <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 2.5], fov: 40 }}><LensScene eye="OD" binocular power={state.power} correction={correction} pending={pending} occluded={false} onInsert={step} /></Canvas>
        <div className="facility-hud"><span>{state.phase === "baseline" ? "RETURN TO BASELINE" : state.phase.toUpperCase()}</span><strong>{signed(state.power)} · OU</strong><small>Added over correction</small></div>
        <div className="hand-readout"><span><b>R</b>Change both trial lenses together</span><span><b>L</b>Hold near card at 40 cm · both eyes open</span></div>
      </div>
      <div className="clinical-coach" role="status"><p><b>Patient response</b>{done ? "NRA and PRA recorded." : !ready ? "Fit correction and establish binocular fixation." : pending ? "Let me try to clear the letters…" : blur ? "The letters remain blurred." : "The letters are clear and single."}</p></div>
    </div><aside className="clinical-control-rail">
      <section><p>This fictional non-presbyopic patient wears distance correction. For presbyopic testing, use the appropriate near correction.</p><button className={`task-button ${correction ? "done" : ""}`} disabled={done} onClick={() => setCorrection(true)}>Fit distance correction</button><button className={`task-button ${fixation ? "done" : ""}`} disabled={!correction || done} onClick={() => setFixation(true)}>Fixate near line at 40 cm · both eyes open</button></section>
      <section><p>Click the lens pair to change power. Wait for the patient to respond after each step.</p><button className="primary full" disabled={!ready || pending || blur || atBaseline || done} onClick={step}>{action}</button><button className="primary full" disabled={!ready || pending || done || !(blur || atBaseline)} onClick={record}>{atBaseline ? "Confirm clear at baseline · begin PRA" : `Record ${state.phase.toUpperCase()} ${signed(state.power)}`}</button>{state.phase === "baseline" && <p className="neutral-message">Remove plus lenses in 0.25 D steps. PRA starts only after the original correction is restored and vision is clear.</p>}</section>
      <section aria-live="polite"><p>NRA: {state.nra === null ? "Not recorded" : signed(state.nra)}</p><p>PRA: {state.pra === null ? "Not recorded" : signed(state.pra)}</p>{done && <p className="neutral-message success">Practice complete · both endpoints recorded.</p>}</section>
      <button className="reset-technique" onClick={() => { locked.current = false; setPending(false); setState(initialRelativeState); setFixation(false); }}>Restart NRA/PRA</button>
    </aside></div>
  </dialog>;
}
