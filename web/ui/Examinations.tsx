import { useState } from "react";
import { Check, ChevronRight, ClipboardCheck } from "lucide-react";
import { examBlock, resultKey } from "../domain/engine";
import type { ClinicalCase, ExamConfig, ExamResult, Session, StationId } from "../domain/types";
export const eyeLabel = (eye: string) =>
  eye === "OD" ? "OD · right eye" : eye === "OS" ? "OS · left eye" : "OU · both eyes";
export function ResultCard({ result }: { result: ExamResult }) {
  return (
    <article className="result-card">
      <p className="eyebrow">
        <Check size={14} /> Finding recorded
      </p>
      <h3>{result.examName}</h3>
      <p className="result-eye">
        {eyeLabel(result.eye)} · {result.correction}
      </p>
      {result.observationSource === "trainee" && (
        <p className="eyebrow">YOUR RECORDED OBSERVATION</p>
      )}
      <p className="finding">{result.value}</p>
      <dl>
        <dt>Method</dt>
        <dd>{result.method}</dd>
        <dt>Units</dt>
        <dd>{result.units}</dd>
        {result.distance && (
          <>
            <dt>Distance</dt>
            <dd>{result.distance}</dd>
          </>
        )}
      </dl>
      {result.refraction && (
        <p className="small">
          Working-distance correction accounted for. Cylinder explicitly 0.00 D; axis not
          applicable.
        </p>
      )}
    </article>
  );
}
export function Examinations({
  c,
  session,
  station,
  onSelect,
  onPerform,
  initialExam,
  initialConfig,
}: {
  c: ClinicalCase;
  session: Session;
  station: StationId;
  onSelect: (id: string, config: ExamConfig) => void;
  onPerform: (id: string, config: ExamConfig) => void;
  initialExam?: string;
  initialConfig?: ExamConfig;
}) {
  const choices = c.exams.filter((e) => e.equipmentIds.includes(station));
  const [examId, setExamId] = useState(initialExam ?? choices[0].id);
  const exam = choices.find((e) => e.id === examId) ?? choices[0];
  const [eye, setEye] = useState(
    initialConfig && exam.eyes.includes(initialConfig.eye) ? initialConfig.eye : exam.eyes[0],
  );
  const [mode, setMode] = useState(
    initialConfig && exam.modes.some((m) => m.id === initialConfig.mode)
      ? initialConfig.mode
      : exam.modes[0].id,
  );
  const [performed, setPerformed] = useState<string | null>(null);
  const config = { eye, mode };
  const block = examBlock(c, session, exam.id, config);
  const key = resultKey(c, exam.id, config);
  const result = session.results.find((r) => r.id === key);
  const select = (id: string) => {
    const e = choices.find((e) => e.id === id)!;
    setExamId(id);
    setEye(e.eyes[0]);
    setMode(e.modes[0].id);
    setPerformed(null);
    onSelect(id, { eye: e.eyes[0], mode: e.modes[0].id });
  };
  return (
    <>
      <p className="muted">
        Select what you want to assess, configure the procedure, then perform the simulated
        examination.
      </p>
      <div className="exam-choices">
        {choices.map((e) => (
          <button
            key={e.id}
            className={e.id === exam.id ? "selected" : ""}
            onClick={() => select(e.id)}
            aria-pressed={e.id === exam.id}
          >
            <div>
              <strong>{e.name}</strong>
              <span>{e.equipment}</span>
            </div>
            <ChevronRight size={17} />
          </button>
        ))}
      </div>
      <section className="exam-config">
        <p className="eyebrow">Procedure configuration</p>
        <h2>{exam.name}</h2>
        <div className="fields">
          <label>
            Tested eye
            <select
              value={eye}
              onChange={(e) => {
                const value = e.target.value as typeof eye;
                setEye(value);
                setPerformed(null);
                onSelect(exam.id, { eye: value, mode });
              }}
            >
              {exam.eyes.map((e) => (
                <option key={e} value={e}>
                  {eyeLabel(e)}
                </option>
              ))}
            </select>
          </label>
          <label>
            Method / configuration
            <select
              value={mode}
              onChange={(e) => {
                setMode(e.target.value);
                setPerformed(null);
                onSelect(exam.id, { eye, mode: e.target.value });
              }}
            >
              {exam.modes.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <p className="scope">{exam.scope}</p>
        {block && (
          <p className="notice" role="status">
            {block}
          </p>
        )}
        <button
          className="primary full"
          disabled={!!block}
          onClick={() => {
            onPerform(exam.id, config);
            setPerformed(key);
          }}
        >
          <ClipboardCheck size={17} />
          {exam.id === "anterior"
            ? "Use slit-lamp station"
            : result
              ? "Pick up kit & repeat"
              : "Pick up instrument & examine"}
        </button>
        <p className="small muted">Authored findings · no manual instrument technique assessed</p>
      </section>
      {result && (
        <div aria-live="polite">
          <ResultCard result={result} />
          {performed === key && (
            <p className="small muted">
              Saved to your notebook. Repeating this result adds no extra credit.
            </p>
          )}
        </div>
      )}
    </>
  );
}
