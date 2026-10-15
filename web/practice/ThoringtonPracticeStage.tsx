import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  THORINGTON_CASES, THORINGTON_SCALE, armThoringtonReport, cancelThoringtonEntry, enterThorington,
  newThoringtonRun, nextThoringtonCase, sampleThorington, submitThorington, thoringtonCardCoordinate,
  thoringtonGuidedStep, thoringtonStatusDetail, thoringtonTestStatus, type ThoringtonInterpretation, type ThoringtonRecord,
  type ThoringtonReportedSide, type ThoringtonRun, type ThoringtonSpatialSample,
} from "../interaction/thoringtonProcedure";
import { PracticeVoiceControl } from "../voice/PracticeVoiceControl";
import { usePracticeAttempt } from "./PracticeAttemptContext";

type CardPlacement = "down" | "held" | "stand";

export function ThoringtonPracticeStage({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const { settings } = usePracticeAttempt();
  const guided = settings?.kind !== "test";
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<SVGSVGElement>(null);
  const activePointer = useRef<number | null>(null);
  const completionSent = useRef(false);
  const [run, setRunState] = useState<ThoringtonRun>(() => newThoringtonRun());
  const runRef = useRef(run);
  const setRun = useCallback((next: ThoringtonRun) => { runRef.current = next; setRunState(next); }, []);
  const [correction, setCorrection] = useState(false);
  const [correctionRevision, setCorrectionRevision] = useState(0);
  const [rodHeld, setRodHeld] = useState(false);
  const [rodRoll, setRodRoll] = useState<0 | 90>(90);
  const [rodFitted, setRodFitted] = useState<0 | 90 | null>(null);
  const [rodFitRevision, setRodFitRevision] = useState(0);
  const [cardPlacement, setCardPlacement] = useState<CardPlacement>("down");
  const [distance, setDistance] = useState(32);
  const [cardFacingDegrees, setCardFacingDegrees] = useState(0);
  const [cardRollDegrees, setCardRollDegrees] = useState(0);
  const [penlightHeld, setPenlightHeld] = useState(false);
  const [trigger, setTrigger] = useState(false);
  const [penlightExaminerSide, setPenlightExaminerSide] = useState(true);
  const [penlightTowardPatient, setPenlightTowardPatient] = useState(true);
  const [aim, setAim] = useState({ x: .035, y: .025 });
  const [magnitude, setMagnitude] = useState("");
  const [side, setSide] = useState<ThoringtonReportedSide | "">("");
  const [interpretation, setInterpretation] = useState<ThoringtonInterpretation | "">("");
  const [feedback, setFeedback] = useState("");
  const [history, setHistory] = useState<readonly ThoringtonRecord[]>([]);

  const current = THORINGTON_CASES[run.caseIndex].trials[run.trialIndex];
  const sample: ThoringtonSpatialSample = {
    correctionFitted: correction, correctionRevision, rodFitted: rodFitted !== null, grooveDegrees: rodFitted, rodFitRevision,
    cardPresent: cardPlacement !== "down", cardHeldOrSupported: cardPlacement !== "down", cardDistanceCm: distance,
    cardFacing: Math.abs(cardFacingDegrees) <= 30, cardUpright: Math.abs(cardRollDegrees) <= 30,
    penlightHeld, penlightPowered: penlightHeld && trigger, penlightExaminerSide, penlightTowardPatient,
    apertureHit: Math.hypot(aim.x, aim.y) < .01, fixationInstruction: run.reportInstruction, tracking: true,
  };
  const sampleRef = useRef(sample); sampleRef.current = sample;

  const clearEntries = useCallback(() => { setMagnitude(""); setSide(""); setInterpretation(""); setFeedback(""); }, []);
  const releasePointer = useCallback(() => {
    const pointerId = activePointer.current;
    if (pointerId !== null && viewport.current?.hasPointerCapture(pointerId)) viewport.current.releasePointerCapture(pointerId);
    activePointer.current = null;
  }, []);
  const close = useCallback(() => { releasePointer(); setTrigger(false); onClose(); }, [onClose, releasePointer]);
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => { releasePointer(); node?.close(); }; }, [releasePointer]);
  useEffect(() => {
    const timer = window.setInterval(() => {
      const next = sampleThorington(runRef.current, sampleRef.current, performance.now());
      if (next !== runRef.current) setRun(next);
    }, 25);
    return () => window.clearInterval(timer);
  }, [setRun]);
  useEffect(() => { if (!run.capture) clearEntries(); }, [run.capture, clearEntries]);

  const reviseRod = (values: { held: boolean; fitted: 0 | 90 | null; roll?: 0 | 90 }) => {
    setRodHeld(values.held); setRodFitted(values.fitted); if (values.roll !== undefined) setRodRoll(values.roll);
    setRodFitRevision(value => value + 1); clearEntries();
  };
  const moveDistance = (value: number) => setDistance(Math.max(25, Math.min(60, Math.round(value * 10) / 10)));
  const moveAim = (x: number, y: number) => setAim({ x: Math.max(-.06, Math.min(.06, x)), y: Math.max(-.06, Math.min(.06, y)) });
  const pointer = (event: ReactPointerEvent<SVGSVGElement>) => {
    const point = event.currentTarget.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    const matrix = event.currentTarget.getScreenCTM(); if (!matrix) return;
    const local = point.matrixTransform(matrix.inverse()); moveAim(local.x / 4000, -local.y / 4000);
  };
  const ask = () => {
    const next = armThoringtonReport(runRef.current, { ...sampleRef.current, fixationInstruction: true });
    setRun(next); if (!next.reportInstruction) setFeedback(next.feedback);
  };
  const toolsDown = cardPlacement !== "held" && !penlightHeld;
  const record = () => {
    if (!runRef.current.capture || !toolsDown) return;
    const previous = runRef.current.records.length;
    let next = enterThorington(runRef.current, magnitude, side, interpretation); next = submitThorington(next); setRun(next);
    if (next.records.length === previous) { setFeedback(next.feedback); return; }
    const added = next.records[next.records.length - 1]; if (added) setHistory(values => [...values, added]);
    clearEntries(); setFeedback(next.feedback);
    if (next.phase === "complete" && !completionSent.current) { completionSent.current = true; onComplete(); }
  };
  const cancel = () => { setRun(cancelThoringtonEntry(runRef.current)); clearEntries(); releasePointer(); };
  const otherCase = () => {
    setRun(nextThoringtonCase(runRef.current)); setCorrection(false); reviseRod({ held: false, fitted: null, roll: 90 });
    setCardPlacement("down"); setDistance(32); setCardFacingDegrees(0); setCardRollDegrees(0); setPenlightHeld(false); setTrigger(false);
    setPenlightExaminerSide(true); setPenlightTowardPatient(true); setAim({ x: .035, y: .025 }); clearEntries();
  };
  const reset = () => {
    setRun(newThoringtonRun(0, completionSent.current)); setCorrection(false); setCorrectionRevision(0); setRodHeld(false); setRodFitted(null); setRodRoll(90); setRodFitRevision(0);
    setCardPlacement("down"); setDistance(32); setCardFacingDegrees(0); setCardRollDegrees(0); setPenlightHeld(false); setTrigger(false);
    setPenlightExaminerSide(true); setPenlightTowardPatient(true); setAim({ x: .035, y: .025 }); setHistory([]); clearEntries(); releasePointer();
  };
  const guidance = thoringtonGuidedStep(run, sample);
  const status = guided ? thoringtonStatusDetail(run, sample) : thoringtonTestStatus(run, sample);
  const sideChoices: readonly ThoringtonReportedSide[] = current.axis === "horizontal" ? ["right", "left", "through"] : ["above", "below", "through"];
  const interpretationChoices: readonly ThoringtonInterpretation[] = current.axis === "horizontal"
    ? ["orthophoria", "esophoria", "exophoria"] : ["orthophoria", "left-hyperphoria", "right-hyperphoria"];

  return <dialog ref={dialog} className="clinical-practice-dialog" aria-labelledby="thorington-title" onCancel={event => { event.preventDefault(); close(); }}>
    <header className="clinical-stage-header"><div><p className="eyebrow">LIVE PRACTICE · LATENT DEVIATION</p><h1 id="thorington-title">Modified Thorington</h1></div>
      <div className="clinical-stage-distance"><span>Combined card</span><strong>{distance.toFixed(1)} cm · {current.axis}</strong></div><PracticeVoiceControl /><button className="secondary" onClick={close}>Close</button></header>
    <div className="clinical-stage-body"><div className="clinical-viewport-wrap">
      <div className="clinical-viewport thorington-workspace">
        <svg ref={viewport} viewBox="-230 -230 460 460" className="thorington-physical-card" tabIndex={0} role="application"
          aria-label="Combined Modified Thorington card. Drag or use arrow keys to align the held penlight ray with the central aperture. Use the wheel or plus and minus keys to change card distance."
          onPointerDown={event => { if (event.button !== 0 || !penlightHeld) return; event.currentTarget.focus(); activePointer.current = event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); pointer(event); }}
          onPointerMove={event => { if (activePointer.current === event.pointerId && event.currentTarget.hasPointerCapture(event.pointerId)) pointer(event); }}
          onPointerUp={releasePointer} onPointerCancel={releasePointer} onLostPointerCapture={() => { activePointer.current = null; }}
          onWheel={event => { event.preventDefault(); moveDistance(distance + event.deltaY / 100); }}
          onKeyDown={event => { if (event.key.toLowerCase() === "r" && rodHeld) { event.preventDefault(); setRodRoll(value => value === 0 ? 90 : 0); return; }
            if (event.key === "+" || event.key === "=") { event.preventDefault(); moveDistance(distance - 1); return; }
            if (event.key === "-" || event.key === "_") { event.preventDefault(); moveDistance(distance + 1); return; }
            if (!event.key.startsWith("Arrow")) return; event.preventDefault(); moveAim(aim.x + (event.key === "ArrowRight" ? .002 : event.key === "ArrowLeft" ? -.002 : 0), aim.y + (event.key === "ArrowUp" ? .002 : event.key === "ArrowDown" ? -.002 : 0)); }}>
          <rect x="-220" y="-220" width="440" height="440" rx="10" fill="#f0eddd" />
          <text x="0" y="-192" textAnchor="middle" fontSize="14" fill="#294a44">COMBINED CROSS CARD · 4 MM/Δ AT TAUGHT 40 CM</text>
          <line x1="-160" x2="160" y1="0" y2="0" stroke="#55736a" /><line x1="0" x2="0" y1="-160" y2="160" stroke="#55736a" />
          {THORINGTON_SCALE.filter(value => value !== 0).map(value => <g key={`x-${value}`}><line x1={value * 16} x2={value * 16} y1="-7" y2="7" stroke="#294a44" /><text x={value * 16} y="26" textAnchor="middle" fontSize="11" fill="#294a44">{Math.abs(value)}</text></g>)}
          {THORINGTON_SCALE.filter(value => value !== 0).map(value => <g key={`y-${value}`}><line x1="-7" x2="7" y1={-value * 16} y2={-value * 16} stroke="#294a44" /><text x="23" y={-value * 16 + 4} fontSize="11" fill="#294a44">{Math.abs(value)}</text></g>)}
          <circle r="10" fill="#071519" /><circle cx={aim.x * 4000} cy={-aim.y * 4000} r="6" fill={trigger ? "#ffcd64" : "#65706f"} stroke="#ad721f" />
          <text x="0" y="205" textAnchor="middle" fontSize="11" fill="#294a44">Physical scale shown without enlargement · 10 mm central aperture radius</text>
        </svg>
        {run.capture && <div className="thorington-report-illustration" aria-label="Enlarged fictional patient-report illustration">
          <p>FICTIONAL PATIENT-REPORTED VIEW</p><strong data-voice-report>Arun reports {run.capture.report}</strong><span>Enlarged illustration · not a calibrated visual test</span>
        </div>}
        <div className="viewport-controls">Card coordinates: {thoringtonCardCoordinate(1) * 1000} mm/Δ · drag/arrow aim · wheel or +/− distance · R rotates a held rod</div>
      </div>
      {guided && <div className="clinical-coach" role="status"><span>{guidance.index + 1}</span><p><b>{guidance.title}</b>{guidance.lines.join(" ")}</p></div>}
      <p className="sr-only" role="status" data-voice-status>{status}</p>
    </div><aside className="clinical-control-rail">
      <section><h2>Physical setup</h2>
        <button className={`task-button ${correction ? "done" : ""}`} onClick={() => { setCorrection(value => !value); setCorrectionRevision(value => value + 1); }}>{correction ? "Remove usual near correction" : "Fit usual near correction"}</button>
        {!rodHeld && rodFitted === null && <button className="secondary full" onClick={() => reviseRod({ held: true, fitted: null })}>Pick up Maddox rod</button>}
        {!rodHeld && rodFitted !== null && <button className="secondary full" onClick={() => reviseRod({ held: true, fitted: null, roll: rodFitted })}>Remove fitted rod</button>}
        {rodHeld && <><button className="secondary full" onClick={() => setRodRoll(value => value === 0 ? 90 : 0)}>Rotate held rod 90° · R</button><button className="primary full" onClick={() => reviseRod({ held: false, fitted: rodRoll })}>Physically fit before OD · {rodRoll === 0 ? "horizontal" : "vertical"} grooves</button></>}
        <p>Rod state: {rodHeld ? `held · ${rodRoll === 0 ? "horizontal" : "vertical"} grooves` : rodFitted === null ? "on tray" : `fitted · ${rodFitted === 0 ? "horizontal" : "vertical"} grooves`}.</p>
        <label>Card handling<select value={cardPlacement} onChange={event => setCardPlacement(event.target.value as CardPlacement)}><option value="down">On tray</option><option value="held">Held</option><option value="stand">Supported on stand</option></select></label>
        <label className="distance-control">Card distance · {distance.toFixed(1)} cm<input type="range" min="25" max="60" step="0.1" value={distance} onChange={event => moveDistance(+event.target.value)} /></label>
        <label>Numbered surface facing · {cardFacingDegrees}°<input type="range" min="-90" max="90" value={cardFacingDegrees} onChange={event => setCardFacingDegrees(+event.target.value)} /></label>
        <label>Card upright roll · {cardRollDegrees}°<input type="range" min="-90" max="90" value={cardRollDegrees} onChange={event => setCardRollDegrees(+event.target.value)} /></label>
      </section>
      <section><h2>Penlight and report</h2>
        <button className="secondary full" onClick={() => { setPenlightHeld(value => !value); setTrigger(false); }}>{penlightHeld ? "Put penlight down" : "Pick up penlight"}</button>
        <button className="secondary full" disabled={!penlightHeld} onPointerDown={() => setTrigger(true)} onPointerUp={() => setTrigger(false)} onPointerCancel={() => setTrigger(false)} onLostPointerCapture={() => setTrigger(false)}>{trigger ? "Trigger depressed · illuminated" : "Hold trigger to illuminate"}</button>
        <label><input type="checkbox" checked={trigger} disabled={!penlightHeld} onChange={event => setTrigger(event.target.checked)} /> Keyboard trigger hold</label>
        <button className="secondary full" disabled={!penlightHeld} onClick={() => setPenlightExaminerSide(value => !value)}>Penlight side · {penlightExaminerSide ? "examiner" : "patient"}</button>
        <button className="secondary full" disabled={!penlightHeld} onClick={() => setPenlightTowardPatient(value => !value)}>Ray direction · {penlightTowardPatient ? "toward Arun" : "away from Arun"}</button>
        <button className="secondary full" disabled={!penlightHeld} onClick={() => moveAim(0, 0)}>Aim ray through aperture</button>
        <button className="primary full" disabled={Boolean(run.capture)} onClick={ask}>{run.reportInstruction ? "Reporting instruction given ✓" : "Ask Arun to fixate and report number and side"}</button>
        <p>{status}</p>
      </section>
      {run.capture && <section className="clinical-observation"><h2>Independent recording</h2>
        <p>Put the card and penlight down before entry. No answer is preselected.</p>
        <label>Magnitude (Δ)<input type="number" min="0" max="10" value={magnitude} disabled={!toolsDown} onChange={event => setMagnitude(event.target.value)} /></label>
        <label>Raw reported side<select value={side} disabled={!toolsDown} onChange={event => setSide(event.target.value as ThoringtonReportedSide | "")}><option value="">Choose after capture</option>{sideChoices.map(value => <option key={value}>{value}</option>)}</select></label>
        <label>Clinical interpretation<select value={interpretation} disabled={!toolsDown} onChange={event => setInterpretation(event.target.value as ThoringtonInterpretation | "")}><option value="">Choose independently</option>{interpretationChoices.map(value => <option key={value}>{value}</option>)}</select></label>
        <button className="primary full" disabled={!toolsDown || !magnitude || !side || !interpretation} onClick={record}>Record {current.axis} trial</button>
        <button className="secondary full" onClick={cancel}>Cancel recording</button><p role="status">{feedback}</p>
      </section>}
      {history.length > 0 && <section aria-label="Recorded Modified Thorington history"><h2>History</h2>{history.map((record, index) => <p key={`${record.capture.caseId}-${record.capture.axis}-${index}`}>{record.capture.caseId} · {record.capture.axis} · {record.capture.actualCardDistanceCm.toFixed(1)} cm · signed {record.capture.signedCoordinate} · raw {record.capture.rawReportedSide} · entered {record.submittedMagnitude}Δ {record.submittedInterpretation}</p>)}</section>}
      {run.phase === "complete" && <section><p className="neutral-message success">Both axes recorded. Practice completion is awarded once.</p><button className="secondary full" onClick={otherCase}>Try the other authored case</button></section>}
      <button className="reset-technique" onClick={reset}>Reset attempt</button>
    </aside></div>
  </dialog>;
}
