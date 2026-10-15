import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Check, RotateCcw, Target, X } from "lucide-react";
import {
  NEAR_FUSIONAL_CASE, NEAR_FUSIONAL_DIAL_SWEEP_RAD, NEAR_FUSIONAL_MAX_DELTA, NEAR_FUSIONAL_STABILITY_MS,
  cancelNearFusionalRun, configureNearFusionalRun, enterNearFusionalRecord, nearFusionalDisclosure,
  nearFusionalEyeState, nearFusionalGuidedStep, nearFusionalPatientReport, nearFusionalRecordFieldIds,
  newNearFusionalRun, releaseNearFusionalPrism, sampleNearFusionalRun, submitNearFusionalRecord,
  type NearFusionalBase, type NearFusionalRun, type NearFusionalSpatialSample,
} from "../interaction/nearFusionalVergenceProcedure";
import { usePracticeAttempt } from "./PracticeAttemptContext";
import { PracticeVoiceControl } from "../voice/PracticeVoiceControl";
import { RotaryPrismPracticeView } from "./RotaryPrismPracticeView";

const labels: Record<(typeof nearFusionalRecordFieldIds)[number], string> = {
  "bi-blur": "BI blur", "bi-break": "BI break", "bi-recovery": "BI recovery",
  "bo-blur": "BO blur", "bo-break": "BO break", "bo-recovery": "BO recovery",
};

export function NearFusionalVergencePracticeStage({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ pointerId: number; angle: number; power: number } | null>(null);
  const settleTimer = useRef<number | null>(null);
  const completionSent = useRef(false);
  const { settings } = usePracticeAttempt();
  const attemptKind = settings?.kind ?? "guided";
  const disclosure = nearFusionalDisclosure(attemptKind);
  const [run, setRun] = useState(newNearFusionalRun);
  const [power, setPower] = useState(0);
  const [orientation, setOrientation] = useState<NearFusionalBase>("BI");
  const [grabbed, setGrabbed] = useState(false);

  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  useEffect(() => () => { if (settleTimer.current !== null) window.clearTimeout(settleTimer.current); drag.current = null; }, []);

  const spatial = (current: NearFusionalRun, value = power, base = orientation, nowMs = performance.now()): NearFusionalSpatialSample => ({
    nowMs, power: value, base, correctionFitted: current.correctionFitted, targetEstablished: current.targetEstablished,
    targetDistanceCm: 40, prismHeld: current.prismHeld, alignedOD: true, patientFacing: true, tiltValid: true,
    visible: true, tracking: true,
  });
  const settle = (value: number, base = orientation) => {
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => setRun(current => sampleNearFusionalRun(current, spatial(current, value, base))), NEAR_FUSIONAL_STABILITY_MS);
  };
  const changePower = (value: number) => {
    const next = Math.round(Math.max(0, Math.min(NEAR_FUSIONAL_MAX_DELTA, value)) * 10) / 10;
    setPower(next);
    setRun(current => sampleNearFusionalRun(current, spatial(current, next)));
    settle(next);
  };
  const action = (name: Parameters<typeof configureNearFusionalRun>[1]) => setRun(current => {
    const next = configureNearFusionalRun(current, name);
    return sampleNearFusionalRun(next, spatial(next));
  });
  const clearDrag = (element?: Element, pointerId?: number) => {
    if (element && pointerId !== undefined && element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
    drag.current = null; setGrabbed(false);
  };
  const orient = (base: NearFusionalBase) => {
    clearDrag(); setOrientation(base); setPower(0);
    setRun(current => sampleNearFusionalRun(current, spatial(current, 0, base)));
    settle(0, base);
  };
  const pointerAngle = (event: ReactPointerEvent<HTMLDivElement>) => {
    const control = event.currentTarget.querySelector<HTMLElement>(".rotary-prism-dial");
    const rect = control?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
    return Math.atan2(event.clientX - rect.left - rect.width / 2, -(event.clientY - rect.top - rect.height / 2));
  };
  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !run.prismHeld || run.released) return;
    const control = event.currentTarget.querySelector<HTMLElement>(".rotary-prism-dial");
    if (control) {
      const rect = control.getBoundingClientRect();
      if (Math.hypot(event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2) > Math.max(rect.width, rect.height) * .7) return;
    }
    event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, angle: pointerAngle(event), power }; setGrabbed(true);
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    let delta = pointerAngle(event) - drag.current.angle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    changePower(drag.current.power + delta / NEAR_FUSIONAL_DIAL_SWEEP_RAD * NEAR_FUSIONAL_MAX_DELTA);
  };
  const restart = () => {
    clearDrag(); if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    setPower(0); setOrientation("BI"); setRun(current => newNearFusionalRun(current.completionAwarded));
  };
  const cancel = () => { clearDrag(); setPower(0); setOrientation("BI"); setRun(current => cancelNearFusionalRun(current)); };
  const submit = () => setRun(current => {
    const next = submitNearFusionalRecord(current);
    if (next.record && !completionSent.current) { completionSent.current = true; queueMicrotask(onComplete); }
    return next;
  });
  const close = () => { clearDrag(); if (settleTimer.current !== null) window.clearTimeout(settleTimer.current); onClose(); };
  const sample = spatial(run);
  const coach = nearFusionalGuidedStep(run, sample);
  const report = nearFusionalPatientReport(run, power);
  const entryReady = run.released && Boolean(run.captures.BI && run.captures.BO);
  const phase = disclosure.answerBearingPhaseLabels ? run.phase.replaceAll("-", " ") : "procedure in progress";

  return <dialog ref={dialog} className="clinical-practice-dialog fusional-dedicated-dialog" onCancel={event => { event.preventDefault(); close(); }}>
    <header className="clinical-stage-header">
      <div><p className="eyebrow">LIVE PRACTICE · HORIZONTAL NEAR VERGENCE</p><h1>Continuous rotary-prism procedure</h1></div>
      <PracticeVoiceControl /><button className="secondary" onClick={close}><X size={16} />Close</button>
    </header>
    <div className="clinical-stage-body fusional-stage-body">
      <div className="clinical-viewport-wrap">
        <div className={`clinical-viewport fusional-prism-viewport ${grabbed ? "is-grabbed" : ""}`} role="application" tabIndex={0}
          aria-label="Horizontal near rotary prism. Rotate the dial with pointer movement, mouse wheel, arrow keys, or the labeled decimal control."
          onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={event => clearDrag(event.currentTarget, event.pointerId)}
          onPointerCancel={event => clearDrag(event.currentTarget, event.pointerId)} onLostPointerCapture={() => clearDrag()}
          onWheel={event => { event.preventDefault(); changePower(power + (event.deltaY < 0 ? .1 : -.1)); }}
          onKeyDown={event => { if (!["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].includes(event.key)) return; event.preventDefault(); changePower(power + (event.key === "ArrowUp" || event.key === "ArrowRight" ? .1 : -.1)); }}>
          <RotaryPrismPracticeView power={power} orientation={orientation}
            eyeState={(() => { const value = nearFusionalEyeState(run, power); return { broken: value.broken, OD: { x: value.OD, y: 0 }, OS: { x: value.OS, y: 0 } }; })()}
            highlightAperture={disclosure.showHighlights && coach.index === 4} highlightDial={disclosure.showHighlights && coach.index >= 5 && coach.index <= 8}
            targetKind="near" targetLabel="PREPARED ISOLATED NEAR TARGET · 40 CM" />
          <div className="viewport-controls">Free-hand dial · wheel · arrow keys · read the modeled 0–30Δ scale</div>
        </div>
        <div className="clinical-coach ready"><span><Target /></span><p><b>Arun says</b><span data-voice-report>{report}</span></p></div>
      </div>
      <aside className="clinical-control-rail fusional-control-rail">
        <p className="eyebrow">{run.captures.BI ? "BO RUN" : "BI RUN"} · {phase}</p>
        {disclosure.showCoach && <section className="npc-coach" aria-label="Guided procedure coach"><p className="eyebrow">STEP {coach.index + 1} OF 10</p><h3>{coach.title}</h3>{coach.lines.map(line => <p key={line}>{line}</p>)}</section>}
        <section>
          <button className={run.correctionFitted ? "task-button done" : "task-button"} onClick={() => action("fit-correction")}><Check /><span><b>Fit near correction</b><small>Required before measurement</small></span></button>
          <button className={run.targetEstablished ? "task-button done" : "task-button"} onClick={() => action("establish-target")} disabled={!run.correctionFitted}><Target /><span><b>Support prepared near target</b><small>Patient-facing stand · modeled 40 cm</small></span></button>
          <button className={run.instructionArmed ? "task-button done" : "task-button"} onClick={() => { action("give-instruction"); settle(power); }} disabled={!run.targetEstablished}><Check /><span><b>Report first sustained blur, double, and single again</b><small>Arms the same report action used by voice</small></span></button>
          <button className={run.prismHeld ? "task-button done" : "task-button"} onClick={() => action("pickup-prism")} disabled={!run.instructionArmed || run.released}><Check /><span><b>Pick up and align rotary prism before OD</b><small>Patient-facing aperture · zero BI</small></span></button>
        </section>
        <div className="site-switch" aria-label="Physical prism orientation">
          <button className={orientation === "BI" ? "selected" : ""} disabled={Boolean(run.captures.BI) || run.released} onClick={() => orient("BI")}>Rotate to BI</button>
          <button className={orientation === "BO" ? "selected" : ""} disabled={!run.captures.BI || run.phase !== "bo-orient" || run.released} onClick={() => orient("BO")}>Rotate to BO</button>
        </div>
        <label className="distance-control">Accessible rotary-prism reading · {power.toFixed(1)}Δ
          <input aria-label="Near rotary prism demand in prism dioptres" type="number" min="0" max="30" step="0.1" value={power} disabled={!run.prismHeld || run.released} onChange={event => changePower(Number(event.target.value))} />
        </label>
        <button className="secondary full" onClick={() => undefined}>Patient report · what do you see?</button>
        {run.phase === "captured" && !run.released && <button className="primary full" onClick={() => setRun(current => releaseNearFusionalPrism(current))}>Release rotary prism</button>}
        <p role="status" data-voice-status className="neutral-message">{run.feedback}</p>
        {(run.captures.BI || run.captures.BO) && <section aria-label="Acquired endpoint history"><p className="eyebrow">ACQUIRED HISTORY</p>
          {(["BI", "BO"] as const).map(base => run.captures[base] ? <p key={base}>{base}: {run.captures[base]!.blur.actualDelta} / {run.captures[base]!.break.actualDelta} / {run.captures[base]!.recovery.actualDelta}Δ · {run.captures[base]!.targetDistanceCm.toFixed(1)} cm</p> : null)}
        </section>}
        {entryReady && !run.record && <section className="npc-entry"><p className="eyebrow">INDEPENDENT DOCUMENTATION</p>
          {nearFusionalRecordFieldIds.map(id => {
            const xField = id.endsWith("blur") && NEAR_FUSIONAL_CASE.endpoints[id.startsWith("bi") ? "BI" : "BO"].blur === null;
            return <label key={id}>{labels[id]} {xField ? "(X)" : "(Δ)"}<input type={xField ? "text" : "number"} min={xField ? undefined : "0"} max={xField ? undefined : "30"} step={xField ? undefined : "0.1"} value={run.entries[id] ?? ""} onChange={event => setRun(current => enterNearFusionalRecord(current, id, event.target.value))} /></label>;
          })}
          <button className="primary full" disabled={nearFusionalRecordFieldIds.some(id => !run.entries[id])} onClick={submit}>Record six-field finding</button>
          <button className="secondary full" onClick={cancel}>Cancel recording</button>
        </section>}
        {run.record && <div className="trainer-feedback correct"><b>Horizontal near finding recorded</b><p>Captured readings and submitted entries are retained separately. No normative classification or diagnosis was assigned.</p></div>}
        {!run.record && <button className="reset-technique" onClick={restart}><RotateCcw />Reset attempt</button>}
      </aside>
    </div>
  </dialog>;
}
