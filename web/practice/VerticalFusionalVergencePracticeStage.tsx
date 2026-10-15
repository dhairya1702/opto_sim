import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Check, RotateCcw, Target, X } from "lucide-react";
import {
  VERTICAL_FUSIONAL_DIAL_SWEEP_RAD, VERTICAL_FUSIONAL_MAX_DELTA, VERTICAL_FUSIONAL_STABILITY_MS,
  cancelVerticalFusionalRun, configureVerticalFusionalRun, enterVerticalFusionalRecord, newVerticalFusionalRun,
  releaseVerticalFusionalPrism, sampleVerticalFusionalRun, submitVerticalFusionalRecord, verticalFusionalDisclosure,
  verticalFusionalEyeState, verticalFusionalGuidedStep, verticalFusionalPatientReport, verticalFusionalRecordFieldIds,
  type VerticalFusionalBase, type VerticalFusionalRun, type VerticalFusionalSpatialSample,
} from "../interaction/verticalFusionalVergenceProcedure";
import { PracticeVoiceControl } from "../voice/PracticeVoiceControl";
import { usePracticeAttempt } from "./PracticeAttemptContext";
import { RotaryPrismPracticeView } from "./RotaryPrismPracticeView";

const labels: Record<(typeof verticalFusionalRecordFieldIds)[number], string> = {
  "bu-break": "BU break", "bu-recovery": "BU recovery", "bd-break": "BD break", "bd-recovery": "BD recovery",
};

export function VerticalFusionalVergencePracticeStage({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const drag = useRef<{ pointerId: number; angle: number; power: number } | null>(null);
  const settleTimer = useRef<number | null>(null);
  const completionSent = useRef(false);
  const { settings } = usePracticeAttempt();
  const attemptKind = settings?.kind ?? "guided";
  const disclosure = verticalFusionalDisclosure(attemptKind);
  const [run, setRun] = useState(newVerticalFusionalRun);
  const [power, setPower] = useState(0);
  const [orientation, setOrientation] = useState<VerticalFusionalBase>("BU");
  const [grabbed, setGrabbed] = useState(false);

  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  useEffect(() => () => { if (settleTimer.current !== null) window.clearTimeout(settleTimer.current); drag.current = null; }, []);
  const clearTimer = () => { if (settleTimer.current !== null) window.clearTimeout(settleTimer.current); settleTimer.current = null; };
  const clearDrag = (element?: Element, pointerId?: number) => {
    if (element && pointerId !== undefined && element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
    drag.current = null; setGrabbed(false);
  };
  const spatial = (current: VerticalFusionalRun, value = power, base = orientation, nowMs = performance.now()): VerticalFusionalSpatialSample => ({
    nowMs, power: value, base, correctionFitted: current.correctionFitted, targetEstablished: current.targetEstablished,
    prismHeld: current.prismHeld, alignedOD: true, patientFacing: true, tiltValid: true, visible: true, tracking: true,
  });
  const settle = (value: number, base = orientation, nonce = run.eventNonce) => {
    clearTimer();
    settleTimer.current = window.setTimeout(() => setRun(current => current.eventNonce === nonce
      ? sampleVerticalFusionalRun(current, spatial(current, value, base)) : current), VERTICAL_FUSIONAL_STABILITY_MS);
  };
  const changePower = (value: number) => {
    const next = Math.round(Math.max(0, Math.min(VERTICAL_FUSIONAL_MAX_DELTA, value)) * 10) / 10;
    setPower(next);
    setRun(current => { const sampled = sampleVerticalFusionalRun(current, spatial(current, next)); settle(next, orientation, sampled.eventNonce); return sampled; });
  };
  const action = (name: Parameters<typeof configureVerticalFusionalRun>[1]) => setRun(current => {
    const next = configureVerticalFusionalRun(current, name);
    return sampleVerticalFusionalRun(next, spatial(next));
  });
  const orient = (base: VerticalFusionalBase) => {
    clearTimer(); clearDrag(); setOrientation(base); setPower(0);
    setRun(current => { const next = sampleVerticalFusionalRun(current, spatial(current, 0, base)); settle(0, base, next.eventNonce); return next; });
  };
  const pointerAngle = (event: ReactPointerEvent<HTMLDivElement>) => {
    const control = event.currentTarget.querySelector<HTMLElement>(".rotary-prism-dial");
    const rect = control?.getBoundingClientRect() ?? event.currentTarget.getBoundingClientRect();
    return Math.atan2(event.clientX - rect.left - rect.width / 2, -(event.clientY - rect.top - rect.height / 2));
  };
  const pointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || !run.prismHeld || run.released) return;
    const control = event.currentTarget.querySelector<HTMLElement>(".rotary-prism-dial");
    if (control) { const rect = control.getBoundingClientRect();
      if (Math.hypot(event.clientX - rect.left - rect.width / 2, event.clientY - rect.top - rect.height / 2) > Math.max(rect.width, rect.height) * .7) return; }
    event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, angle: pointerAngle(event), power }; setGrabbed(true);
  };
  const pointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    let delta = pointerAngle(event) - drag.current.angle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    changePower(drag.current.power + delta / VERTICAL_FUSIONAL_DIAL_SWEEP_RAD * VERTICAL_FUSIONAL_MAX_DELTA);
  };
  const restart = () => { clearTimer(); clearDrag(); setPower(0); setOrientation("BU"); setRun(current => newVerticalFusionalRun(current.completionAwarded)); };
  const cancel = () => { clearTimer(); clearDrag(); setPower(0); setOrientation("BU"); setRun(current => cancelVerticalFusionalRun(current)); };
  const submit = () => setRun(current => {
    const next = submitVerticalFusionalRecord(current);
    if (next.record && !completionSent.current) { completionSent.current = true; queueMicrotask(onComplete); }
    return next;
  });
  const close = () => { clearTimer(); clearDrag(); onClose(); };
  const sample = spatial(run), coach = verticalFusionalGuidedStep(run, sample), report = verticalFusionalPatientReport(run, power);
  const entryReady = run.released && Boolean(run.captures.BU && run.captures.BD);
  const phase = disclosure.answerBearingPhaseLabels ? run.phase.replaceAll("-", " ") : "procedure in progress";

  return <dialog ref={dialog} className="clinical-practice-dialog fusional-dedicated-dialog" onCancel={event => { event.preventDefault(); close(); }}>
    <header className="clinical-stage-header"><div><p className="eyebrow">LIVE PRACTICE · VERTICAL DISTANCE VERGENCE</p><h1>BU then BD rotary-prism procedure</h1></div>
      <PracticeVoiceControl /><button className="secondary" onClick={close}><X size={16} />Close</button></header>
    <div className="clinical-stage-body fusional-stage-body">
      <div className="clinical-viewport-wrap">
        <div className={`clinical-viewport fusional-prism-viewport ${grabbed ? "is-grabbed" : ""}`} role="application" tabIndex={0}
          aria-label="Vertical distance rotary prism. Physically rotate BU or BD, then operate the dial with pointer movement, mouse wheel, arrow keys, or the labeled decimal control."
          onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={event => clearDrag(event.currentTarget, event.pointerId)}
          onPointerCancel={event => clearDrag(event.currentTarget, event.pointerId)} onLostPointerCapture={() => clearDrag()}
          onWheel={event => { event.preventDefault(); changePower(power + (event.deltaY < 0 ? .1 : -.1)); }}
          onKeyDown={event => { if (!["ArrowUp", "ArrowRight", "ArrowDown", "ArrowLeft"].includes(event.key)) return; event.preventDefault();
            changePower(power + (event.key === "ArrowUp" || event.key === "ArrowRight" ? .1 : -.1)); }}>
          <RotaryPrismPracticeView power={power} orientation={orientation} eyeState={verticalFusionalEyeState(run, power)}
            highlightAperture={disclosure.showHighlights && coach.index === 4} highlightDial={disclosure.showHighlights && coach.index >= 5 && coach.index <= 8}
            targetLabel="PREPARED MIRRORED ISOLATED TARGET · ONE LINE LARGER THAN POORER-EYE BEST-CORRECTED ACUITY" />
          <div className="viewport-controls">Physical BU/BD roll · free-hand dial · wheel · arrow keys · modeled 0–30Δ scale</div>
        </div>
        <div className="clinical-coach ready"><span><Target /></span><p><b>Arun says</b><span data-voice-report>{report}</span></p></div>
      </div>
      <aside className="clinical-control-rail fusional-control-rail">
        <p className="eyebrow">{run.captures.BU ? "BD RUN" : "BU RUN"} · {phase}</p>
        {disclosure.showCoach && <section className="npc-coach" aria-label="Guided procedure coach"><p className="eyebrow">STEP {coach.index + 1} OF 10</p><h3>{coach.title}</h3>{coach.lines.map(line => <p key={line}>{line}</p>)}</section>}
        <section>
          <button className={run.correctionFitted ? "task-button done" : "task-button"} onClick={() => action("fit-correction")}><Check /><span><b>Fit distance correction</b><small>Required before measurement</small></span></button>
          <button className={run.targetEstablished ? "task-button done" : "task-button"} onClick={() => action("establish-target")} disabled={!run.correctionFitted}><Target /><span><b>Establish prepared mirrored target</b><small>One line larger than poorer-eye best-corrected acuity</small></span></button>
          <button className={run.instructionArmed ? "task-button done" : "task-button"} onClick={() => { action("give-instruction"); settle(power); }} disabled={!run.targetEstablished}><Check /><span><b>Report sustained double, then single again</b><small>No blur response is requested</small></span></button>
          <button className={run.prismHeld ? "task-button done" : "task-button"} onClick={() => action("pickup-prism")} disabled={!run.instructionArmed || run.released}><Check /><span><b>Pick up and align rotary prism before OD</b><small>Patient-facing aperture · zero BU</small></span></button>
        </section>
        <div className="site-switch" aria-label="Physical prism roll direction">
          <button className={orientation === "BU" ? "selected" : ""} disabled={Boolean(run.captures.BU) || run.released} onClick={() => orient("BU")}>Physically roll to BU</button>
          <button className={orientation === "BD" ? "selected" : ""} disabled={!run.captures.BU || run.phase !== "bd-orient" || run.released} onClick={() => orient("BD")}>Physically roll to BD</button>
        </div>
        <label className="distance-control">Accessible rotary-prism reading · {power.toFixed(1)}Δ
          <input aria-label="Vertical rotary prism demand in prism dioptres" type="number" min="0" max="30" step="0.1" value={power}
            disabled={!run.prismHeld || run.released} onChange={event => changePower(Number(event.target.value))} />
        </label>
        <button className="secondary full" onClick={() => undefined}>Patient report · what do you see?</button>
        {run.phase === "captured" && !run.released && <button className="primary full" onClick={() => { clearDrag(); setRun(current => releaseVerticalFusionalPrism(current)); }}>Release rotary prism</button>}
        <p role="status" data-voice-status className="neutral-message">{run.feedback}</p>
        {(run.captures.BU || run.captures.BD) && <section aria-label="Acquired endpoint history"><p className="eyebrow">ACQUIRED HISTORY</p>
          {(["BU", "BD"] as const).map(base => run.captures[base] ? <p key={base}>{base}: {run.captures[base]!.break.actualDelta} / {run.captures[base]!.recovery.actualDelta}Δ</p> : null)}
        </section>}
        {entryReady && !run.record && <section className="npc-entry"><p className="eyebrow">INDEPENDENT DOCUMENTATION</p>
          {verticalFusionalRecordFieldIds.map(id => <label key={id}>{labels[id]} (Δ)<input type="number" min="0" max="30" step="0.1"
            value={run.entries[id] ?? ""} onChange={event => setRun(current => enterVerticalFusionalRecord(current, id, event.target.value))} /></label>)}
          <button className="primary full" disabled={verticalFusionalRecordFieldIds.some(id => !run.entries[id])} onClick={submit}>Record four-field finding</button>
          <button className="secondary full" onClick={cancel}>Cancel recording</button>
        </section>}
        {run.record && <div className="trainer-feedback correct"><b>Vertical distance finding recorded</b><p>Captured readings and submitted entries are retained separately. No normative classification or diagnosis was assigned.</p></div>}
        {!run.record && <button className="reset-technique" onClick={restart}><RotateCcw />Reset attempt</button>}
      </aside>
    </div>
  </dialog>;
}
