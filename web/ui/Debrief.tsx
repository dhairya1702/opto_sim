import { Download, RotateCcw } from "lucide-react";
import { assess, requiredKeys } from "../domain/engine";
import type { ClinicalCase, Session } from "../domain/types";
import { diagnosisLabels, managementOptions } from "./Submission";
import { Notebook } from "./Notebook";
export function Debrief({
  c,
  session,
  restart,
}: {
  c: ClinicalCase;
  session: Session;
  restart: () => void;
}) {
  const f = assess(c, session);
  const exportReview = () => {
    const blob = new Blob(
      [
        JSON.stringify(
          {
            caseId: c.id,
            caseVersion: c.version,
            reviewStatus: c.reviewStatus,
            rubricVersion: c.rubric.version,
            session,
            feedback: f,
          },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `opto-${session.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <>
      <p className="notice">
        Fictional case · requires clinician review. This encounter assesses clinical
        decision-making, not manual examination technique. There is no pass mark or certification.
      </p>
      <div className="score-hero">
        <div>
          <span className="eyebrow">Draft educational feedback</span>
          <p className="score">
            {f.total}
            <span>/ 100</span>
          </p>
        </div>
        <div>
          <p>Encounter complete</p>
          <span className="small muted">
            Rubric {c.rubric.version}
            <br />
            Time is not scored.
          </span>
        </div>
      </div>
      <div className="score-dimensions">
        {f.dimensions.map((d) => (
          <div key={d.name}>
            <span>{d.name}</span>
            <strong>
              {d.earned} / {d.possible}
            </strong>
            <progress value={d.earned} max={d.possible} aria-label={d.name} />
          </div>
        ))}
      </div>
      {f.critical.length > 0 && (
        <section className="omissions">
          <h2>Priority omissions to review</h2>
          <p className="small">Draft flags for clinical review; no automatic score cap.</p>
          <ul>
            {f.critical.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </section>
      )}
      <h2>Your interpretation</h2>
      <p>
        <strong>
          {diagnosisLabels[session.submission!.diagnosis] ?? session.submission!.diagnosis}
        </strong>
      </p>
      <p>{session.submission!.reasoning || "No written reasoning supplied."}</p>
      <h3>Expected draft interpretation</h3>
      <p>{c.answerKey.interpretation}</p>
      <h3>Management review</h3>
      <p>{c.answerKey.management}</p>
      <ul>
        {session.submission!.management.map((id) => (
          <li key={id}>{managementOptions.find((m) => m.id === id)?.label ?? id}</li>
        ))}
      </ul>
      <p className="small muted">Your management reasoning and patient explanation (unscored)</p>
      <blockquote>
        {session.submission!.managementReasoning || "No management reasoning supplied."}
      </blockquote>
      <blockquote>
        {session.submission!.explanation || "No patient explanation supplied."}
      </blockquote>
      {session.results.some((result) => result.observationSource === "trainee") && (
        <section className="observation-review">
          <h2>Recorded acuity review</h2>
          <p className="small muted">
            Your entries are preserved exactly as recorded and compared with the fictional case script here.
          </p>
          {session.results
            .filter((result) => result.observationSource === "trainee")
            .map((result) => (
              <article key={result.id} className={result.observationAccurate ? "accurate" : "inaccurate"}>
                <div>
                  <strong>{result.examName} · {result.eye}</strong>
                  <span>{result.observationAccurate ? "✓ Matches case" : "○ Revisit measurement"}</span>
                </div>
                <p>Your entry: <b>{result.value}</b></p>
                <p>Case endpoint: <b>{result.expectedValue}</b></p>
              </article>
            ))}
        </section>
      )}
      <h2>Strengths & areas to revisit</h2>
      <div className="criteria">
        {f.criteria.map((cr) => (
          <details key={cr.id}>
            <summary>
              <span className={cr.met ? "met" : "partial"}>{cr.met ? "✓" : "○"}</span>
              <span>{cr.label}</span>
              <strong>
                {cr.earned} / {cr.weight}
              </strong>
            </summary>
            <p>
              {cr.met ? "Completed. " : ""}
              {cr.feedback}
            </p>
            <p className="small">Rule: {cr.rule}</p>
            <p className="small muted">
              Criterion {cr.id} · Evidence: {cr.eventIds.length ? cr.eventIds.join(", ") : "none"}
            </p>
          </details>
        ))}
      </div>
      <details className="review-section">
        <summary>Completed & missed examination areas</summary>
        {c.exams.map((e) => {
          const keys = requiredKeys(c, e),
            done = keys.filter((k) => session.results.some((r) => r.id === k)).length;
          return (
            <article className="review-item" key={e.id}>
              <h3>
                {e.name} · {done}/{keys.length} configurations
              </h3>
              <p>{e.rationale}</p>
              <p className="small muted">{e.scope}</p>
            </article>
          );
        })}
      </details>
      <details className="review-section">
        <summary>History disclosure review</summary>
        {c.historyFacts.map((h) => (
          <p key={h.id}>
            <strong>{h.domain}</strong> ·{" "}
            {session.revealedFactIds.includes(h.id) ? "Asked and answered" : "Not elicited"}
          </p>
        ))}
        <h3>Asked but not answered</h3>
        {session.events
          .filter((e) => e.type === "question" && e.status !== "answered")
          .map((e) => (
            <p key={e.id}>
              {e.detail} — {e.status}
            </p>
          ))}
      </details>
      <details className="review-section">
        <summary>Acquired findings notebook</summary>
        <Notebook c={c} session={session} />
      </details>
      <details className="review-section">
        <summary>Action timeline · {session.events.length} events</summary>
        <ol className="timeline">
          {session.events.map((e) => (
            <li key={e.id}>
              <span className="small muted">
                {Math.max(0, Math.floor((e.at - (session.startedAt ?? e.at)) / 1000))}s · {e.type} ·{" "}
                {e.id}
              </span>
              <p>{e.detail}</p>
              {e.status && (
                <small>
                  {e.status} {e.factIds?.join(", ")}
                </small>
              )}
            </li>
          ))}
        </ol>
      </details>
      <div className="button-row">
        <button className="secondary" onClick={exportReview}>
          <Download size={16} /> Export review
        </button>
        <button className="primary" onClick={restart}>
          <RotateCcw size={16} /> New attempt
        </button>
      </div>
    </>
  );
}
