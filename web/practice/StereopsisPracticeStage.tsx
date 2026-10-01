import { useEffect, useRef, useState } from "react";
import { Canvas } from "./PracticeWebGLFallback";
import { EyeSurface } from "../scene/EyeSurface";
import { stereoLastCorrect, stereoPatientReply, stereoPracticeLevels, stereoStopped, type StereoReply } from "../interaction/stereoPractice";

function BookletScene({ glasses, distance, selection, onCircle }: { glasses: boolean; distance: number; selection: number | null; onCircle: (index: number) => void }) {
  const movement = useRef({ x: 0, y: 0, used: true });
  return <>
    <color attach="background" args={["#09161b"]} /><ambientLight intensity={1.4} /><directionalLight position={[-2, 3, 4]} intensity={2} />
    <mesh scale={[0.64, 0.85, 0.48]}><sphereGeometry args={[1, 40, 28]} /><meshStandardMaterial color="#a97453" /></mesh>
    <group position={[0, 0.2, 0.51]} scale={1.3}><EyeSurface x={-0.17} pupils={false} motility={false} progress={0} movement={movement} /><EyeSurface x={0.17} pupils={false} motility={false} progress={0} movement={movement} /></group>
    {glasses && <group position={[0, 0.2, 0.69]}>{[-0.22, 0.22].map(x => <group key={x} position={[x, 0, 0]}><mesh><torusGeometry args={[0.15, 0.017, 12, 32]} /><meshStandardMaterial color="#20363c" /></mesh><mesh><circleGeometry args={[0.14, 32]} /><meshPhysicalMaterial color="#899da0" transparent opacity={0.5} /></mesh></group>)}</group>}
    <group position={[0, -0.42, 0.55 + distance / 80]}>
      <mesh><boxGeometry args={[0.84, 0.39, 0.025]} /><meshStandardMaterial color="#f1eddf" /></mesh>
      <mesh position={[0, 0, 0.018]}><boxGeometry args={[0.008, 0.38, 0.005]} /><meshBasicMaterial color="#c5c3b6" /></mesh>
      {[-0.26, 0, 0.26].map((x, index) => <group key={index} position={[x, 0, 0.026]} onClick={event => { event.stopPropagation(); onCircle(index); }}><mesh><circleGeometry args={[0.1, 32]} /><meshBasicMaterial color={selection === index ? "#8ec6b3" : "#eee9d9"} /></mesh><mesh position={[0, 0, 0.004]}><ringGeometry args={[0.065, 0.073, 32]} /><meshBasicMaterial color="#2e5350" /></mesh></group>)}
      {[-0.4, 0.4].map(x => <mesh key={x} position={[x, -0.25, 0]} scale={[0.09, 0.15, 0.065]}><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color="#a97453" /></mesh>)}
    </group>
  </>;
}

export function StereopsisPracticeStage({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [correction, setCorrection] = useState(false);
  const [glasses, setGlasses] = useState(false);
  const [distance, setDistance] = useState(32);
  const [replies, setReplies] = useState<StereoReply[]>([]);
  const [pending, setPending] = useState(false);
  const [selection, setSelection] = useState<number | null>(null);
  const [confirmed, setConfirmed] = useState(true);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [complete, setComplete] = useState(false);
  const locked = useRef(false);
  const ready = correction && glasses && distance === 40;
  const stopped = stereoStopped(replies);
  const latest = replies.at(-1);
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => {
      setReplies(previous => { const reply = stereoPatientReply(previous.length); return reply ? [...previous, reply] : previous; });
      setPending(false); locked.current = false;
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [pending]);
  function reset() { locked.current = false; setPending(false); setReplies([]); setSelection(null); setConfirmed(true); setAnswer(""); setFeedback(""); setComplete(false); }
  function present() {
    if (!ready || locked.current || pending || stopped || !confirmed || complete || replies.length >= stereoPracticeLevels.length) return;
    locked.current = true; setPending(true); setSelection(null); setConfirmed(false); setFeedback("");
  }
  function confirmCircle(index: number) {
    if (!ready || pending || !latest || confirmed || complete) return;
    setSelection(index);
    if (index !== latest.selected) { setFeedback("Mark the circle the patient named, even if their response is incorrect."); return; }
    setConfirmed(true); setFeedback(latest.correct ? "Response entered: correct identification." : "Response entered: incorrect identification.");
  }
  function record() {
    if (!ready || !stopped || !confirmed || complete) return;
    if (Number(answer) !== stereoLastCorrect(replies)) { setFeedback("Record the last correct level before the two consecutive incorrect responses."); return; }
    setComplete(true); setFeedback("Threshold recorded in seconds of arc."); onComplete();
  }
  return <dialog ref={dialog} className="clinical-practice-dialog" aria-labelledby="stereo-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="clinical-stage-header"><div><p className="eyebrow">LIVE PRACTICE · SENSORY STATUS</p><h1 id="stereo-title">Stereopsis · circle booklet</h1></div><div className="clinical-stage-distance"><span>Booklet distance</span><strong>{distance} cm</strong></div><button className="secondary" onClick={onClose}>Close</button></header>
    <div className="clinical-stage-body"><div className="clinical-viewport-wrap"><div className="clinical-viewport"><Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 2.5], fov: 40 }}><BookletScene glasses={glasses} distance={distance} selection={selection} onCircle={confirmCircle} /></Canvas><div className="hand-readout"><span><b>R</b>Point to the circle the patient reports</span><span><b>L</b>Support booklet at 40 cm</span></div></div><div className="clinical-coach" role="status"><p><b>Patient response</b>{pending ? "Let me look at the circles…" : latest ? `“The ${["left", "middle", "right"][latest.selected]} circle appears raised.”` : "Fit viewing glasses, set the booklet at 40 cm, and present the first set."}</p></div></div>
    <aside className="clinical-control-rail"><section><button className={`task-button ${correction ? "done" : ""}`} onClick={() => setCorrection(true)}>Fit near correction</button><button className={`task-button ${glasses ? "done" : ""}`} disabled={!correction} onClick={() => setGlasses(true)}>Fit polarised viewing glasses</button><label className="distance-control">Booklet distance · {distance} cm<input type="range" min="25" max="60" value={distance} onChange={event => { setDistance(+event.target.value); reset(); }} /></label><button className="secondary full" onClick={() => { setDistance(40); reset(); }}>Position booklet at 40 cm</button></section>
      <section><p className="eyebrow">PRESENT → ASK → RECORD RESPONSE</p><button className="primary full" disabled={!ready || pending || stopped || !confirmed || complete} onClick={present}>{replies.length ? "Turn page · present" : "Present"} {stereoPracticeLevels[replies.length] ?? "—"} arcsec set</button><p>Click the circle in the booklet that the patient named, or use these matching controls.</p><div className="site-switch">{["Left", "Middle", "Right"].map((label, index) => <button key={label} disabled={!ready || pending || !latest || confirmed || complete} onClick={() => confirmCircle(index)}>{label}</button>)}</div><p>Responses: {replies.map(reply => `${reply.level}: ${reply.correct ? "✓" : "×"}`).join(" · ") || "None yet"}</p></section>
      {latest && confirmed && <section><p className="eyebrow">ILLUSTRATED PATIENT PERCEPT</p><svg viewBox="0 0 300 120" role="img" aria-label={`Patient reports the ${["left", "middle", "right"][latest.selected]} circle as raised.`} style={{ width: "100%", background: "#eee9da", borderRadius: 8 }}>{[0, 1, 2].map(index => <g key={index}><ellipse cx={60 + index * 90} cy="82" rx="25" ry="8" fill="#bbc0b3" /><circle cx={60 + index * 90} cy={index === latest.selected ? 45 : 65} r="25" fill="#f8f5e9" stroke="#355954" strokeWidth="3" /></g>)}</svg><small>Exaggerated illustration of the reported depth; this screen does not deliver calibrated stereoscopic disparity.</small></section>}
      <section className="clinical-observation"><label>Last correct threshold<select value={answer} disabled={!stopped || !confirmed || complete} onChange={event => setAnswer(event.target.value)}><option value="">Choose seconds of arc</option>{stereoPracticeLevels.map(level => <option key={level} value={level}>{level} arcsec</option>)}</select></label><button className="primary full" disabled={!ready || !stopped || !confirmed || !answer || complete} onClick={record}>Record stereopsis</button><p role="status">{feedback}</p>{complete && <p className="neutral-message success">Stereopsis: {answer} seconds of arc.</p>}<button className="reset-technique" onClick={reset}>Restart threshold run</button></section>
    </aside></div>
  </dialog>;
}
