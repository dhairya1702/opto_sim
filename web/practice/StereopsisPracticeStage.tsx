import { useEffect, useRef, useState } from "react";
import { Canvas } from "./PracticeWebGLFallback";
import { EyeSurface } from "../scene/EyeSurface";
import { stereoDistanceReady, stereoPracticeLevels, stereoTargets } from "../interaction/stereoPractice";
import {
  STEREO_GUIDED_STEP_COUNT, classifyXRStereoResponse, fixateXRStereoPage, initialXRStereoRun,
  interruptXRStereoRun, markXRStereoResponse, nextXRStereoPage, requestXRStereoReply,
  reviseXRStereoSetup, stereoCircleNames, stereoGuidedStep, xrStereoEntryCorrect,
  type StereoCircle, type StereoClassification, type XRStereoRun,
} from "../interaction/xrStereoPractice";
import { PracticeVoiceControl } from "../voice/PracticeVoiceControl";
import { usePracticeAttempt } from "./PracticeAttemptContext";

function BookletScene({ glasses, distance, marked, onCircle }: { glasses: boolean; distance: number; marked: StereoCircle | null; onCircle: (circle: StereoCircle) => void }) {
  const movement = useRef({ x: 0, y: 0, used: true });
  const distanceProgress = (distance - 25) / 35;
  const bookletScale = 1.16 - distanceProgress * 0.38;
  const bookletZ = 0.82 + distanceProgress * 0.58;
  return <>
    <color attach="background" args={["#09161b"]} /><ambientLight intensity={1.4} /><directionalLight position={[-2, 3, 4]} intensity={2} />
    <mesh scale={[0.64, 0.85, 0.48]}><sphereGeometry args={[1, 40, 28]} /><meshStandardMaterial color="#a97453" /></mesh>
    <group position={[0, 0.2, 0.51]} scale={1.3}><EyeSurface x={-0.17} pupils={false} motility={false} progress={0} movement={movement} /><EyeSurface x={0.17} pupils={false} motility={false} progress={0} movement={movement} /></group>
    {glasses && <group position={[0, 0.2, 0.69]}>{[-0.22, 0.22].map(x => <group key={x} position={[x, 0, 0]}><mesh><torusGeometry args={[0.15, 0.017, 12, 32]} /><meshStandardMaterial color="#20363c" /></mesh><mesh><circleGeometry args={[0.14, 32]} /><meshPhysicalMaterial color="#899da0" transparent opacity={0.5} /></mesh></group>)}</group>}
    <group position={[0, -0.42, bookletZ]} scale={bookletScale}>
      <mesh><boxGeometry args={[0.84, 0.39, 0.025]} /><meshStandardMaterial color="#f1eddf" /></mesh>
      <mesh position={[0, 0, 0.018]}><boxGeometry args={[0.008, 0.38, 0.005]} /><meshBasicMaterial color="#c5c3b6" /></mesh>
      {stereoCircleNames.map((circle, index) => <group key={circle} position={[(index - 1) * .26, 0, 0.026]} onClick={event => { event.stopPropagation(); onCircle(circle); }}>
        <mesh><circleGeometry args={[0.1, 32]} /><meshBasicMaterial color={marked === circle ? "#8ec6b3" : "#eee9d9"} /></mesh>
        <mesh position={[0, 0, 0.004]}><ringGeometry args={[0.065, 0.073, 32]} /><meshBasicMaterial color="#2e5350" /></mesh>
      </group>)}
      {[-0.4, 0.4].map(x => <mesh key={x} position={[x, -0.25, 0]} scale={[0.09, 0.15, 0.065]}><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color="#a97453" /></mesh>)}
    </group>
  </>;
}

export function StereopsisPracticeStage({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const { settings } = usePracticeAttempt();
  const guided = settings?.kind === "guided";
  const dialog = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ y: number; distance: number } | null>(null);
  const previousReady = useRef(false);
  const [correction, setCorrection] = useState(false);
  const [glasses, setGlasses] = useState(false);
  const [distance, setDistance] = useState(32);
  const [run, setRun] = useState<XRStereoRun>(() => initialXRStereoRun());
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [complete, setComplete] = useState(false);
  const [grabbed, setGrabbed] = useState(false);
  const ready = correction && glasses && stereoDistanceReady(distance);
  const key = stereoCircleNames[stereoTargets[run.page]];
  const voiceReport = run.reply ? `The ${stereoCircleNames[run.reply.selected]} circle looks raised.` : "";
  const guidance = stereoGuidedStep({ correctionFitted: correction, filtersFitted: glasses, bookletHandled: true,
    bookletSupported: false, geometryReady: ready, distanceCm: distance, facing: true, tracking: true, run, recorded: complete });
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => { drag.current = null; node?.close(); }; }, []);
  useEffect(() => { previousReady.current = ready; }, [ready]);

  function publish(next: XRStereoRun) { if (next !== run) setRun(next); }
  function fit(kind: "correction" | "glasses") {
    const nextCorrection = kind === "correction" ? true : correction;
    const nextGlasses = kind === "glasses" ? true : glasses;
    if (kind === "correction") setCorrection(true); else setGlasses(true);
    if (nextCorrection !== correction || nextGlasses !== glasses) {
      setRun(current => reviseXRStereoSetup(current));
      setAnswer(""); setFeedback(""); setComplete(false);
    }
  }
  function reset() {
    setCorrection(false); setGlasses(false); setDistance(32); setRun(current => initialXRStereoRun(current.attempt + 1, current.generation + 1, current.setupRevision));
    setAnswer(""); setFeedback(""); setComplete(false); setGrabbed(false); drag.current = null;
  }
  function move(value: number) {
    const nextDistance = Math.max(25, Math.min(60, Math.round(value)));
    const nextReady = correction && glasses && stereoDistanceReady(nextDistance);
    setDistance(nextDistance);
    if (previousReady.current && !nextReady) {
      setRun(current => interruptXRStereoRun(current));
      setFeedback("Booklet position changed. Confirmed pages were kept; restore 38–42 cm and establish fixation again.");
    }
    previousReady.current = nextReady;
  }
  function fixate() {
    const next = fixateXRStereoPage(run, ready);
    if (next !== run) { publish(next); setFeedback("Arun: Okay, I'm looking at the circles."); }
  }
  function ask() {
    const next = requestXRStereoReply(run, ready);
    if (next !== run) { publish(next); setFeedback(""); }
  }
  function mark(circle: StereoCircle) {
    const next = markXRStereoResponse(run, circle, ready);
    if (next === run) { if (run.reply) setFeedback("That does not match Arun's spoken response. Listen again and transcribe the named circle."); return; }
    publish(next); setFeedback("Response transcribed. Compare it with the examiner-only page key.");
  }
  function classify(value: StereoClassification) {
    const next = classifyXRStereoResponse(run, value, ready, distance);
    if (next === run) { setFeedback("Recheck the marked response against the examiner-only page key."); return; }
    publish(next); setFeedback(next.capture ? "Two consecutive errors reached. Record the threshold independently." : "Classification recorded. Turn one page to continue.");
  }
  function turnPage() {
    const next = nextXRStereoPage(run, ready);
    if (next !== run) { publish(next); setFeedback("Page turned. Ask Arun to look at the circles again."); }
  }
  function record() {
    if (!ready || !run.capture || complete || !answer) { setFeedback("Complete the comparison and choose a threshold before submitting."); return; }
    if (!xrStereoEntryCorrect(run.capture, answer)) { setFeedback("Recheck the confirmed page record and choose the last correctly identified level."); return; }
    setComplete(true); setFeedback("Threshold recorded in seconds of arc."); onComplete();
  }
  const history = run.records.map(record => `${record.level} arcsec · patient ${record.reportedCircle} · classified ${record.classification}`);
  return <dialog ref={dialog} className="clinical-practice-dialog" aria-labelledby="stereo-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="clinical-stage-header"><div><p className="eyebrow">{guided ? "GUIDED PRACTICE" : "INDEPENDENT TEST"} · SENSORY STATUS</p><h1 id="stereo-title">Stereopsis · circle booklet</h1></div><div className="clinical-stage-distance"><span>Booklet distance</span><strong>{distance} cm</strong></div><PracticeVoiceControl /><button className="secondary" onClick={onClose}>Close</button></header>
    <div className="clinical-stage-body"><div className="clinical-viewport-wrap"><div className={`clinical-viewport ${grabbed ? "is-grabbed" : ""}`} tabIndex={0} role="application" aria-label="Stereo booklet. Drag upward to bring it nearer, downward to move it farther away, use the mouse wheel, or press the up and down arrow keys."
      onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); drag.current = { y: event.clientY, distance }; setGrabbed(true); }}
      onPointerMove={event => { if (drag.current && event.currentTarget.hasPointerCapture(event.pointerId)) move(drag.current.distance + (event.clientY - drag.current.y) / 5); }}
      onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); drag.current = null; setGrabbed(false); }}
      onPointerCancel={() => { drag.current = null; setGrabbed(false); }} onLostPointerCapture={() => { drag.current = null; setGrabbed(false); }}
      onWheel={event => { event.preventDefault(); move(distance + event.deltaY / 25); }}
      onKeyDown={event => { if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return; event.preventDefault(); move(distance + (event.key === "ArrowUp" ? -1 : 1)); }}>
      <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 2.5], fov: 40 }}><BookletScene glasses={glasses} distance={distance} marked={run.markedCircle} onCircle={mark} /></Canvas>
      <div className="viewport-controls">Grip booklet · drag ↑ nearer · drag ↓ farther · wheel/arrows</div><div className="hand-readout"><span><b>R</b>Mark the spoken response</span><span><b>L</b>Support booklet at 40 cm</span></div></div>
      {guided && <div className={`clinical-coach ${complete ? "ready" : ""}`} role="status"><span>{complete ? "✓" : guidance.index + 1}</span><p><b>{complete ? "Guided · complete" : `Guided · step ${guidance.index + 1} of ${STEREO_GUIDED_STEP_COUNT}`}</b>{guidance.title}. {guidance.lines.join(" ")}</p></div>}
      {run.reply && <section className="stereo-patient-view"><p className="eyebrow">FICTIONAL PATIENT-REPORTED VIEW · ENLARGED ILLUSTRATION · NOT CALIBRATED STEREOSCOPIC OPTICS</p><svg viewBox="0 0 300 120" role="img" aria-label={voiceReport}>{[0, 1, 2].map(index => <g key={index}><ellipse cx={60 + index * 90} cy="82" rx="25" ry="8" fill="#bbc0b3" /><circle cx={60 + index * 90} cy={index === run.reply?.selected ? 45 : 65} r="25" fill="#f8f5e9" stroke="#355954" strokeWidth="3" /></g>)}</svg><p data-voice-report>{voiceReport}</p></section>}
    </div>
    <aside className="clinical-control-rail">
      <section><button className={`task-button ${correction ? "done" : ""}`} onClick={() => fit("correction")}>Fit near correction</button><button className={`task-button ${glasses ? "done" : ""}`} disabled={!correction} onClick={() => fit("glasses")}>Fit polarised viewing glasses</button><label className="distance-control">Booklet distance · {distance} cm<input type="range" min="25" max="60" value={distance} onChange={event => move(+event.target.value)} /></label><button className="secondary full" onClick={() => move(40)}>Position booklet at 40 cm</button></section>
      <section><p className="eyebrow">PAGE {run.page + 1} OF 6 · {stereoPracticeLevels[run.page]} ARCSEC</p><p className="stereo-page-key">Examiner-only page key · <b>{key}</b></p>
        <button className="primary full" disabled={!ready || Boolean(run.fixation) || Boolean(run.capture) || complete} onClick={fixate}>LOOK AT THE CIRCLES</button>
        <button className="primary full" disabled={!ready || !run.fixation || Boolean(run.capture) || complete} onClick={ask}>ASK WHICH CIRCLE IS RAISED</button>
        <div className="site-switch">{stereoCircleNames.map(circle => <button key={circle} disabled={!ready || !run.reply || run.confirmed || complete} aria-pressed={run.markedCircle === circle} onClick={() => mark(circle)}>{circle}</button>)}</div>
        <div className="site-switch">{(["correct", "incorrect"] as const).map(value => <button key={value} disabled={!ready || !run.markedCircle || run.confirmed || complete} onClick={() => classify(value)}>{value}</button>)}</div>
        <button className="secondary full" disabled={!ready || !run.confirmed || Boolean(run.capture) || complete} onClick={turnPage}>TURN PAGE</button>
        <div aria-label="Confirmed page records">{history.length ? history.map(line => <p key={line}>{line}</p>) : <p>No confirmed pages yet.</p>}</div>
      </section>
      <section className="clinical-observation"><label>Last correct threshold<select value={answer} disabled={!run.capture || complete} onChange={event => setAnswer(event.target.value)}><option value="">Choose seconds of arc</option>{stereoPracticeLevels.map(level => <option key={level} value={level}>{level} arcsec</option>)}</select></label><button className="primary full" disabled={!run.capture || !answer || complete} onClick={record}>Record stereopsis</button><p role="status" data-voice-status>{feedback}</p>{complete && <p className="neutral-message success">Stereopsis: {answer} seconds of arc.</p>}<button className="reset-technique" onClick={reset}>Reset attempt and return tools</button></section>
    </aside></div>
  </dialog>;
}
