import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { XRClinicRuntime } from "../../interaction/useXRClinicRuntime";
import type { ConsultationToolId } from "../../interaction/xrConsultationTools";
import { Box } from "../../scene/Models";
import { XRHeadPanel, XRPanelButton, XRSign } from "../../scene/XRClinicPanels";
import { XRPracticeFindingsBoard } from "../../scene/XRPracticeFindingsBoard";
import { useXRPracticeResult, XRPracticeResultHUD } from "../../scene/XRPracticeResultHUD";

export type LessonAction = { label: string; run: () => void; active?: boolean; disabled?: boolean };
export type LessonField = { id: string; label: string; choices: readonly (readonly [string, string])[]; number?: { min: number; max: number; unit: string; step?: number } };
export function usePracticeLesson(onComplete: () => void) {
  const { result, showResult, clearResult } = useXRPracticeResult();
  const [mode, setMode] = useState<"none" | "menu" | "help" | "record" | "settings">("none");
  const [entries, setEntries] = useState<Record<string, string>>({});
  const entriesRef = useRef(entries);
  const awarded = useRef(false);
  const [feedback, setFeedback] = useState("");
  const [recorded, setRecorded] = useState(false);
  const choose = (id: string, value: string) => {
    if (awarded.current) return;
    entriesRef.current = { ...entriesRef.current, [id]: value }; setEntries(entriesRef.current); setFeedback("");
  };
  const clearPending = useCallback(() => {
    if (awarded.current) return;
    if (Object.keys(entriesRef.current).length) { entriesRef.current = {}; setEntries({}); }
    setFeedback("");
  }, []);
  const reset = useCallback(() => {
    clearResult();
    awarded.current = false; entriesRef.current = {}; setEntries({}); setFeedback(""); setRecorded(false); setMode("none");
  }, [clearResult]);
  const submit = (valid: boolean, correct: boolean, text: string) => {
    if (awarded.current || !valid) return;
    setFeedback(text);
    showResult(correct ? "correct" : "retry", text);
    if (correct) { awarded.current = true; setRecorded(true); onComplete(); }
  };
  const explain = (text: string) => { setFeedback(text); showResult("incomplete", text); };
  return { mode, setMode, entries, entriesRef, awarded, feedback, recorded, choose, clearPending, reset, submit, explain, result, clearResult };
}
export type PracticeLesson = ReturnType<typeof usePracticeLesson>;
export type BatchMirror = {
  reportLines?: readonly string[]; title: string; findingPosition?: { current: number; total: number }; status: string; ready: boolean; entryReady: boolean; fields: LessonField[];
  actions: LessonAction[]; lesson: PracticeLesson; reset: () => void; record: () => void; next?: () => void; cancel?: () => void;
};
export function BatchLessonMirror({ mirror }: { mirror: BatchMirror }) {
  return <>
    <p className="eyebrow">{mirror.title} · LIVE MIRROR</p><p role="status">{mirror.status}</p>
    {mirror.reportLines && mirror.reportLines.length > 0 && <div aria-label="Acquired observations">{mirror.reportLines.map((line, index) => <p key={index}>{line}</p>)}</div>}
    {mirror.actions.map(action => <button key={action.label} className="secondary full" disabled={action.disabled} onClick={action.run}>{action.label}</button>)}
    <button className="primary full" onClick={() => mirror.lesson.setMode("record")}>Record finding</button>
    {mirror.lesson.mode === "record" && <>
      {mirror.fields.map(field => <label key={field.id}>{field.label}{field.number
        ? <input type="number" min={field.number.min} max={field.number.max} step={field.number.step ?? 1} value={mirror.lesson.entries[field.id] ?? ""} disabled={!mirror.entryReady || mirror.lesson.recorded} onChange={event => mirror.lesson.choose(field.id, event.target.value)} />
        : <select value={mirror.lesson.entries[field.id] ?? ""} disabled={!mirror.entryReady || mirror.lesson.recorded} onChange={event => mirror.lesson.choose(field.id, event.target.value)}>
          <option value="">Choose after inspecting</option>{field.choices.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>}</label>)}
      <button className="primary full" disabled={!mirror.ready || mirror.lesson.recorded || mirror.fields.some(field => !mirror.lesson.entries[field.id])} onClick={mirror.record}>Record observation</button>
      <button className="secondary full" onClick={() => { if (mirror.cancel) mirror.cancel(); else { mirror.lesson.clearPending(); mirror.lesson.setMode("none"); } }}>Cancel recording</button>
    </>}
    {mirror.lesson.feedback && <p role="status">{mirror.lesson.feedback}</p>}
    {mirror.lesson.recorded && mirror.next && <button className="secondary full" onClick={mirror.next}>New patient finding</button>}
    <button className="secondary full" onClick={mirror.reset}>Reset attempt / return tools</button>
  </>;
}
const numericSteps = (field: LessonField) => [...new Set([-(field.number?.step ?? 1), field.number?.step ?? 1, -1, 1, -5, 5])];
const fieldRows = (field: LessonField) => (field.number ? Math.ceil(numericSteps(field).length / 2) + 1 : Math.ceil(field.choices.length / 2)) + .5;
export function PracticeLessonUI({ runtime, active, title, status, help, tools, actions, fields, lesson, entryReady, ready, onRecord, onReset, onNext, onExit, settings, onCancel, directActions }: {
  runtime: XRClinicRuntime; active: boolean; title: string; status: string; help: string[];
  tools: ConsultationToolId[]; actions: LessonAction[]; directActions?: LessonAction[]; fields: LessonField[]; lesson: PracticeLesson;
  entryReady: boolean; ready: boolean; onRecord: () => void; onReset: () => void; onNext?: () => void; onExit: () => void; settings?: ReactNode; onCancel?: () => void;
}) {
  const [entryPage, setEntryPage] = useState(0);
  useEffect(() => { if (lesson.mode !== "record") setEntryPage(0); }, [lesson.mode]);
  if (!active) return null;
  const perPage = fields.some(field => field.number) ? 1 : 2;
  const paginated = fields.some(field => field.number) ? fields.length > 1 : fields.length > 3;
  const pages = Math.ceil(fields.length / perPage);
  const page = Math.min(entryPage, pages - 1);
  const visibleFields = paginated ? fields.slice(page * perPage, page * perPage + perPage) : fields;
  const menuRows = Math.ceil(actions.length / 2);
  const menuBottom = -.195 - menuRows * .085;
  const menuHeight = .40 - menuBottom + .08;
  const recordRows = visibleFields.reduce((sum, field) => sum + fieldRows(field), 0);
  const recordBottom = Math.min(-.315, .16 - recordRows * .08 - (paginated ? .12 : .035));
  const recordHeight = .50 - (recordBottom - .23);
  const cancel = () => { lesson.clearResult(); if (onCancel) onCancel(); else { lesson.clearPending(); lesson.setMode("none"); } };
  const boardActions = directActions ?? actions.slice(0, 2);
  const actionExtension = Math.max(0, boardActions.length - 1) * .10;
  const submit = () => {
    if (!runtime.frameValid.current) { lesson.explain("Restore headset/controller tracking before submitting."); return; }
    if (!ready) { lesson.explain("Before submitting: " + status); return; }
    if (fields.some(field => !lesson.entriesRef.current[field.id])) { lesson.explain("Choose an answer for every observation field, including the other pages."); return; }
    onRecord();
  };
  const findings = <>
      <Box p={[0, (.50 + recordBottom - .23) / 2 + .06 + actionExtension / 2, -.015]} s={[.78, recordHeight + .12 + actionExtension, .018]} c="#102329" radius={.012} />
      {boardActions.map((action, index) => <XRPanelButton key={action.label} label={action.label} position={[0, .565 + index * .10, .02]} width={.70} active={action.active} disabled={action.disabled} onClick={action.run} />)}
      <XRSign text={[title + " · MY OBSERVATIONS", status]} p={[0, .31, 0]} size={[.72, .15]} bg="#102329" fg="#eefbf7" />
      <XRPanelButton label="PROCEDURE CONTROLS" position={[-.105, .46, .02]} width={.55} onClick={() => lesson.setMode("menu")} />
      <XRPanelButton label="EXIT VR" position={[.28, .46, .02]} width={.18} onClick={onExit} />
      {visibleFields.map((field, fieldIndex) => {
        const previousRows = visibleFields.slice(0, fieldIndex).reduce((sum, item) => sum + fieldRows(item), 0);
        const top = .16 - previousRows * .08;
        return <group key={field.id}>
          <XRSign text={[field.number ? `${field.label} · ${lesson.entries[field.id] || "—"}${field.number.unit}` : field.label]} p={[0, top + .049, .012]} size={[.70, .035]} bg="#102329" fg="#eefbf7" />
          {field.number && <>
            {numericSteps(field).map((step, i) => <XRPanelButton key={step} label={`ENTRY ${step > 0 ? "+" : "−"}${Math.abs(step)}${field.number?.unit}`} position={[i % 2 ? .18 : -.18, top - Math.floor(i / 2) * .08, .012]} width={.34}
              disabled={lesson.recorded} onClick={() => {
                const number = field.number;
                if (!number) return;
                const current = Number(lesson.entriesRef.current[field.id] || 0);
                lesson.choose(field.id, String(Number(Math.max(number.min, Math.min(number.max, (Number.isFinite(current) ? current : 0) + step)).toFixed(2))));
              }} />)}
            <XRPanelButton label="CLEAR ENTRY" position={[0, top - Math.ceil(numericSteps(field).length / 2) * .08, .012]} width={.70} disabled={lesson.recorded} onClick={() => lesson.choose(field.id, "")} />
          </>}
          {field.choices.map(([value, label], i) => <XRPanelButton key={value} label={label.toUpperCase()} position={[i % 2 ? .18 : -.18, top - Math.floor(i / 2) * .08, .012]} width={.34}
            active={lesson.entries[field.id] === value} disabled={lesson.recorded} onClick={() => lesson.choose(field.id, value)} />)}
        </group>;
      })}
      {paginated && <><XRPanelButton label="PREVIOUS ENTRIES" position={[-.18, recordBottom + .085, .012]} width={.34} disabled={page === 0} onClick={() => setEntryPage(page - 1)} /><XRPanelButton label="NEXT ENTRIES" position={[.18, recordBottom + .085, .012]} width={.34} disabled={page >= pages - 1} onClick={() => setEntryPage(page + 1)} /></>}
      <XRPanelButton label="CANCEL" position={[-.18, recordBottom, .012]} width={.34} onClick={cancel} />
      <XRPanelButton label="SUBMIT / CHECK" position={[.18, recordBottom, .012]} width={.34} disabled={lesson.recorded} active={ready && fields.every(field => Boolean(lesson.entries[field.id]))} onClick={submit} />
      <XRSign text={[lesson.feedback || (ready ? "Choose your finding, then record." : status)]} p={[0, recordBottom - .09, .012]} size={[.72, .085]} bg="#102329" fg="#eefbf7" />
      {lesson.recorded && onNext && <XRPanelButton label="NEW PATIENT FINDING" position={[0, recordBottom - .185, .012]} width={.70} onClick={onNext} />}
    </>;
  return <>
    <XRPracticeResultHUD active={active} result={lesson.result} />
    <XRPracticeFindingsBoard runtime={runtime} active={active} tools={tools} forceVisible={lesson.mode === "record"} hidden={lesson.mode !== "none" && lesson.mode !== "record"}>{findings}</XRPracticeFindingsBoard>
    {lesson.mode === "menu" && <XRHeadPanel>
      <Box p={[0, (.40 + menuBottom - .08) / 2, 0]} s={[.72, menuHeight, .018]} c="#102329" radius={.012} />
      <XRSign text={[title, status]} p={[0, .29, .012]} size={[.66, .15]} bg="#102329" fg="#eefbf7" />
      {actions.map((action, i) => <XRPanelButton key={action.label} label={action.label} position={[i % 2 ? .17 : -.17, .145 - Math.floor(i / 2) * .085, .025]} width={.32} active={action.active} disabled={action.disabled} onClick={action.run} />)}
      <XRPanelButton label="RECORD FINDING" position={[-.17, -.025 - Math.ceil(actions.length / 2) * .085, .025]} width={.32} onClick={() => lesson.setMode("record")} />
      <XRPanelButton label="HELP" position={[.17, -.025 - Math.ceil(actions.length / 2) * .085, .025]} width={.32} onClick={() => lesson.setMode("help")} />
      <XRPanelButton label="RESET ATTEMPT" position={[-.17, -.11 - Math.ceil(actions.length / 2) * .085, .025]} width={.32} onClick={onReset} />
      <XRPanelButton label="EXIT VR" position={[.17, -.11 - Math.ceil(actions.length / 2) * .085, .025]} width={.32} onClick={onExit} />
      <XRPanelButton label="CLOSE" position={[0, -.195 - Math.ceil(actions.length / 2) * .085, .025]} width={.66} onClick={() => lesson.setMode("none")} />
    </XRHeadPanel>}
    {lesson.mode === "help" && <XRHeadPanel>
      <Box s={[.76, .72, .018]} c="#102329" radius={.012} />
      <XRSign text={[title, ...help, status]} p={[0, .055, .012]} size={[.70, .49]} bg="#102329" fg="#eefbf7" />
      <XRPanelButton label="CLOSE HELP" position={[-.17, -.26, .025]} width={.32} onClick={() => lesson.setMode("none")} />
      <XRPanelButton label="EXIT VR" position={[.17, -.26, .025]} width={.32} onClick={onExit} />
    </XRHeadPanel>}
    {lesson.mode === "settings" && settings}
  </>;
}
