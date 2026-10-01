import type { ClinicalCase, Session } from "../domain/types";
import { ResultCard } from "./Examinations";
export function Notebook({ c, session }: { c: ClinicalCase; session: Session }) {
  return (
    <>
      <p className="muted">Only history and findings obtained during this encounter appear here.</p>
      <h2>
        History <span className="count">{session.revealedFactIds.length}</span>
      </h2>
      {!session.revealedFactIds.length && (
        <p className="empty">No history elicited yet. Speak with Arun to begin.</p>
      )}
      <div className="history-notes">
        {c.historyFacts
          .filter((f) => session.revealedFactIds.includes(f.id))
          .map((f) => (
            <article key={f.id}>
              <h3>{f.domain}</h3>
              <p>{f.answer}</p>
            </article>
          ))}
      </div>
      <h2>
        Examination findings <span className="count">{session.results.length}</span>
      </h2>
      {!session.results.length && <p className="empty">No examinations performed yet.</p>}
      {session.results.map((r) => (
        <ResultCard key={r.id} result={r} />
      ))}
    </>
  );
}
