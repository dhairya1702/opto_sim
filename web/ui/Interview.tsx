import { useEffect, useRef, useState } from "react";
import { ArrowUp, ChevronDown, MessageCircle } from "lucide-react";
import type { ClinicalCase, Session } from "../domain/types";
export function Interview({
  c,
  session,
  ask,
}: {
  c: ClinicalCase;
  session: Session;
  ask: (question: string, factId?: string) => void;
}) {
  const [question, setQuestion] = useState("");
  const [suggestions, setSuggestions] = useState(false);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    end.current?.scrollIntoView({ block: "nearest" });
  }, [session.transcript.length]);
  return (
    <>
      <div className="patient-summary">
        <div className="avatar">A</div>
        <div>
          <strong>Arun, 24</strong>
          <span>Fictional patient · adult consultation</span>
        </div>
        <span className="badge">
          <i /> Scripted
        </span>
      </div>
      <p className="small muted">
        Ask in your own words. Answers use an authored question bank; unsupported details remain
        unknown. Acquired history is saved automatically to Notes.
      </p>
      <div className="transcript" role="log" aria-label="Patient conversation">
        {session.transcript.map((t) => (
          <div className={`turn ${t.role}`} key={t.id}>
            <span className="turn-label">{t.role === "patient" ? "Arun" : "You"}</span>
            <p>{t.text}</p>
            {t.status && t.status !== "answered" && (
              <small>
                {t.status === "clarification" ? "Clarification requested" : "Detail not available"}{" "}
                · no history credit
              </small>
            )}
          </div>
        ))}
        <div ref={end} />
      </div>
      <form
        className="question-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (question.trim()) {
            ask(question);
            setQuestion("");
          }
        }}
      >
        <label htmlFor="question">Your question</label>
        <div className="question-input">
          <input
            id="question"
            value={question}
            maxLength={500}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="When did you first notice the blur?"
            autoComplete="off"
          />
          <button
            className="primary icon-button"
            aria-label="Send question"
            disabled={!question.trim()}
          >
            <ArrowUp size={20} />
          </button>
        </div>
        <span className="small muted">{question.length}/500 characters</span>
      </form>
      <button
        className="disclosure"
        aria-expanded={suggestions}
        onClick={() => setSuggestions(!suggestions)}
      >
        <MessageCircle size={16} /> Suggested questions <ChevronDown size={16} />
      </button>
      {suggestions && (
        <div className="suggestions">
          {c.historyFacts.map((f) => (
            <button key={f.id} onClick={() => ask(f.question, f.id)}>
              <span>{f.question}</span>
              <small>{session.revealedFactIds.includes(f.id) ? "Asked" : "Ask"}</small>
            </button>
          ))}
        </div>
      )}
    </>
  );
}
