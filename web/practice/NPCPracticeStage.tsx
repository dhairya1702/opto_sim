import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";
import { Check, RotateCcw, X } from "lucide-react";
import {
  NPC_CASES, NPC_RULE_MAX_CM, NPC_RULE_MIN_CM, NPC_STABILITY_MS, cancelNPCRun, configureNPCRun, enterNPCRecord,
  markNPCObjectiveEndpoint, newNPCRun, npcCaseOrder, npcDisclosure, npcEyeState, npcGuidedStep, npcPatientReport,
  npcRecordFieldIds, releaseNPCRule, restartNPCTrial, sampleNPC, submitNPCRecord, type NPCRun, type NPCSpatialSample,
} from "../interaction/npcProcedure";
import { usePracticeAttempt } from "./PracticeAttemptContext";
import { PracticeVoiceControl } from "../voice/PracticeVoiceControl";

const scaleMarks = Array.from({ length: 41 }, (_, index) => index + 2);

function RuleGraphic({ distance, run, highlightCarriage = false, highlightDock = false }: { distance: number; run: NPCRun; highlightCarriage?: boolean; highlightDock?: boolean }) {
  const eyes = npcEyeState(run, distance);
  return <div className="npc-room" aria-hidden="true">
    <div className="npc-patient">
      <div className="npc-eye-row" style={{ "--npc-convergence": eyes.converging } as CSSProperties}>
        <span className="npc-eye"><i /></span><span className={`npc-eye os ${eyes.osDrifted ? "drifted" : ""}`}><i /></span>
      </div>
      <span>ARUN · ILLUSTRATIVE EYE MOVEMENT</span>
    </div>
    <div className={`npc-rule-visual ${highlightDock ? "highlight-dock" : ""}`}>
      <span className="npc-spectacle-stop">SPECTACLE PLANE · 0</span>
      <div className="npc-rail">
        {scaleMarks.map(mark => <i key={mark} className={mark % 5 === 0 ? "major" : ""} style={{ left: `${(mark - 2) / 40 * 100}%` }}><b>{mark % 5 === 0 ? mark : ""}</b></i>)}
        <div className={`npc-carriage ${highlightCarriage ? "highlighted" : ""}`} style={{ left: `${(distance - 2) / 40 * 100}%` }}><span>◎</span><small>ACCOMMODATIVE TARGET</small></div>
      </div>
      <span className="npc-examiner-end">EXAMINER END · 42 CM</span>
    </div>
  </div>;
}

export function NPCPracticeStage({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const drag = useRef<{ pointerId: number; x: number; distance: number } | null>(null);
  const holdTimer = useRef<number | null>(null);
  const completionSent = useRef(false);
  const { settings } = usePracticeAttempt();
  const kind = settings?.kind ?? "guided";
  const disclosure = npcDisclosure(kind);
  const order = useMemo(() => npcCaseOrder(kind), [kind]);
  const [caseIndex, setCaseIndex] = useState(0);
  const [run, setRun] = useState(() => newNPCRun(order[0]));
  const [distance, setDistance] = useState(40);
  const [grabbed, setGrabbed] = useState(false);

  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  useEffect(() => () => { if (holdTimer.current !== null) window.clearTimeout(holdTimer.current); drag.current = null; }, []);

  const spatial = (current: NPCRun, value = distance, nowMs = performance.now()): NPCSpatialSample => ({
    nowMs, distanceCm: value, correctionFitted: current.correctionFitted, ruleHeld: current.ruleHeld, ruleDocked: current.ruleDocked,
    patientFacing: true, upright: true, midlineOffsetCm: 0, visible: true, tracking: true,
  });
  const settle = (value: number) => {
    if (holdTimer.current !== null) window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => {
      setRun(current => sampleNPC(current, spatial(current, value)));
    }, NPC_STABILITY_MS);
  };
  const move = (value: number) => {
    const next = Math.round(Math.max(NPC_RULE_MIN_CM, Math.min(NPC_RULE_MAX_CM, value)) * 10) / 10;
    setDistance(next);
    setRun(current => sampleNPC(current, spatial(current, next)));
    settle(next);
  };
  const action = (name: Parameters<typeof configureNPCRun>[1]) => setRun(current => {
    const next = configureNPCRun(current, name);
    return sampleNPC(next, spatial(next, distance));
  });
  const resetDrag = (element?: Element, pointerId?: number) => {
    if (element && pointerId !== undefined && element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
    drag.current = null; setGrabbed(false);
  };
  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !run.ruleDocked || run.released) return;
    event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, x: event.clientX, distance }; setGrabbed(true);
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    move(drag.current.distance + (event.clientX - drag.current.x) * .08);
  };
  const markObjective = () => {
    setRun(current => {
      const sample = spatial(current, distance);
      return markNPCObjectiveEndpoint(sampleNPC(current, sample), sample);
    });
  };
  const restart = () => { resetDrag(); if (holdTimer.current !== null) window.clearTimeout(holdTimer.current); setDistance(40); setRun(current => restartNPCTrial(current)); };
  const cancel = () => { resetDrag(); setDistance(40); setRun(current => cancelNPCRun(current)); };
  const submit = () => setRun(current => {
    const next = submitNPCRecord(current);
    if (next.record && !completionSent.current) { completionSent.current = true; queueMicrotask(onComplete); }
    return next;
  });
  const nextCase = () => {
    const nextIndex = (caseIndex + 1) % order.length;
    setCaseIndex(nextIndex); setDistance(40); resetDrag();
    setRun(newNPCRun(order[nextIndex], completionSent.current));
  };

  const sample = spatial(run);
  const coach = npcGuidedStep(run, sample);
  const report = npcPatientReport(run, distance);
  const entryReady = run.released && run.captures.length === 3;
  const phaseLabel = kind === "guided" ? run.phase.replaceAll("-", " ") : "procedure in progress";
  const close = () => { resetDrag(); if (holdTimer.current !== null) window.clearTimeout(holdTimer.current); onClose(); };

  return <dialog ref={dialog} className="clinical-practice-dialog npc-dedicated-dialog" onCancel={event => { event.preventDefault(); close(); }}>
    <header className="clinical-stage-header">
      <div><p className="eyebrow">LIVE PRACTICE · NEAR POINT OF CONVERGENCE</p><h1>RAF-style rule procedure</h1></div>
      <PracticeVoiceControl /><button className="secondary" onClick={close}><X size={16} />Close</button>
    </header>
    <div className="clinical-stage-body npc-stage-body">
      <div className="clinical-viewport-wrap">
        <div ref={viewport} className={`clinical-viewport npc-rule-viewport ${grabbed ? "is-grabbed" : ""}`} role="application" tabIndex={0}
          aria-label="RAF-style near point of convergence rule. Drag horizontally, use the mouse wheel, arrow keys, or the labeled numeric control to move the target carriage."
          onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={event => resetDrag(event.currentTarget, event.pointerId)}
          onPointerCancel={event => resetDrag(event.currentTarget, event.pointerId)} onLostPointerCapture={() => resetDrag()}
          onWheel={event => { event.preventDefault(); move(distance + event.deltaY * .01); }}
          onKeyDown={event => { if (event.key !== "ArrowLeft" && event.key !== "ArrowRight" && event.key !== "ArrowUp" && event.key !== "ArrowDown") return; event.preventDefault(); move(distance + (event.key === "ArrowLeft" || event.key === "ArrowUp" ? -.1 : .1)); }}>
          <RuleGraphic distance={distance} run={run} highlightDock={disclosure.showHighlights && coach.index === 2} highlightCarriage={disclosure.showHighlights && coach.index >= 3 && coach.index <= 8} />
          <div className="viewport-controls">Drag toward/away · wheel · arrow keys · read the physical centimetre scale</div>
        </div>
        <div className="clinical-coach ready"><span><Check /></span><p><b>Arun says</b><span data-voice-report>{report}</span></p></div>
      </div>
      <aside className="clinical-control-rail npc-control-rail">
        <p className="eyebrow">TRIAL {run.trialNumber} OF 3 · {phaseLabel}</p>
        {disclosure.revealCaseIdentity && <p className="neutral-message">Practice pattern: {run.caseId === "subjective" ? "patient-reported endpoint" : "objective eye-movement endpoint"}. Distances remain concealed until observed.</p>}
        {disclosure.showCoach && <section className="npc-coach" aria-label="Guided procedure coach"><p className="eyebrow">STEP {coach.index + 1} OF 10</p><h3>{coach.title}</h3>{coach.lines.map(line => <p key={line}>{line}</p>)}</section>}
        <section>
          <button className={`${run.correctionFitted ? "task-button done" : "task-button"} ${disclosure.showHighlights && coach.index === 0 ? "npc-step-highlight" : ""}`} onClick={() => action("fit-correction")} disabled={run.phase === "complete"}><Check /><span><b>Fit appropriate near correction</b><small>Required before measurement</small></span></button>
          <button className={run.ruleHeld || run.ruleDocked ? "task-button done" : "task-button"} onClick={() => action("pickup-rule")} disabled={!run.correctionFitted || run.phase === "complete"}><Check /><span><b>Pick up RAF-style rule</b><small>Dedicated NPC instrument</small></span></button>
          <button className={run.ruleDocked ? "task-button done" : "task-button"} onClick={() => action("dock-rule")} disabled={!run.ruleHeld || run.phase === "complete"}><Check /><span><b>Dock and align at spectacle plane</b><small>Patient-facing · upright · midline</small></span></button>
          <button className={run.instructionArmed ? "task-button done" : "task-button"} onClick={() => { action("give-instruction"); settle(distance); }} disabled={!run.ruleDocked || run.phase === "complete"}><Check /><span><b>Keep this clear and single; tell me when it becomes double</b><small>Arms the reporting instruction</small></span></button>
        </section>
        <label className="distance-control">Accessible carriage distance · {distance.toFixed(1)} cm
          <input aria-label="Target distance from spectacle plane in centimetres" type="number" min={NPC_RULE_MIN_CM} max={NPC_RULE_MAX_CM} step="0.1" value={distance} disabled={!run.ruleDocked || run.released} onChange={event => move(Number(event.target.value))} />
        </label>
        {!run.released && <button className="primary full" onClick={markObjective} disabled={run.phase !== "approach" && run.phase !== "recovery"}>Mark observed endpoint</button>}
        <button className="secondary full" onClick={() => undefined}>Patient report · what do you see?</button>
        {run.captures.length === 3 && !run.released && <button className="primary full" onClick={() => setRun(current => releaseNPCRule(current))}>Remove / release rule</button>}
        <p role="status" data-voice-status className="neutral-message">{run.feedback}</p>
        {run.captures.length > 0 && <section aria-label="Acquired trial history"><p className="eyebrow">ACQUIRED TRIALS</p>{run.captures.map(capture => <p key={capture.trialNumber}>Trial {capture.trialNumber}: {capture.break.actualCm.toFixed(1)} / {capture.recovery.actualCm.toFixed(1)} cm · {capture.break.method} · {capture.break.breakingEye}</p>)}</section>}
        {entryReady && !run.record && <section className="npc-entry"><p className="eyebrow">INDEPENDENT DOCUMENTATION</p>
          {npcRecordFieldIds.slice(0, 6).map((id, index) => <label key={id}>Trial {Math.floor(index / 2) + 1} {index % 2 ? "recovery" : "break"} (cm)<input type="number" min="2" max="42" step="0.1" value={run.entries[id] ?? ""} onChange={event => setRun(current => enterNPCRecord(current, id, event.target.value))} /></label>)}
          <label>Detection method<select value={run.entries["detection-method"] ?? ""} onChange={event => setRun(current => enterNPCRecord(current, "detection-method", event.target.value))}><option value="">Choose after observing</option><option value="patient-report">Patient report</option><option value="objective-observation">Objective observation</option></select></label>
          <label>Breaking eye<select value={run.entries["breaking-eye"] ?? ""} onChange={event => setRun(current => enterNPCRecord(current, "breaking-eye", event.target.value))}><option value="">Choose after observing</option><option value="OD">OD</option><option value="OS">OS</option></select></label>
          <button className="primary full" disabled={npcRecordFieldIds.some(id => !run.entries[id])} onClick={submit}>Record three-trial finding</button>
          <button className="secondary full" onClick={cancel}>Cancel recording</button>
        </section>}
        {run.record && <div className="trainer-feedback correct"><b>NPC pattern recorded</b><p>Captured and submitted values are retained separately. This draft does not assign a diagnosis.</p><button className="secondary full" onClick={nextCase}>Try the other patient pattern</button></div>}
        {!run.record && <button className="reset-technique" onClick={restart}><RotateCcw />Restart current trial</button>}
      </aside>
    </div>
  </dialog>;
}
