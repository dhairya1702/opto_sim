import type { ClinicalCase, Session } from "../domain/types";
import { ResultCard } from "./Examinations";
import { disclosedHistory } from "../patient/history";
export function Notebook({ c, session }: { c: ClinicalCase; session: Session }) {
  const history = disclosedHistory(c, session.revealedFactIds);
  return (
    <>
      <p className="muted">Only history and findings obtained during this encounter appear here.</p>
      <h2>
        History <span className="count">{history.length}</span>
      </h2>
      {!history.length && (
        <p className="empty">No history elicited yet. Speak with Arun to begin.</p>
      )}
      <div className="history-notes">
        {history.map(({ fact, answer, answered, total }) => (
            <article key={fact.id}>
              <h3>{fact.domain}{answered < total ? ` · ${answered}/${total}` : ""}</h3>
              <p>{answer}</p>
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
