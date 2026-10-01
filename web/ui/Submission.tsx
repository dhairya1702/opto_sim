import { useState } from "react";
import { ArrowRight } from "lucide-react";
import type { AssessmentSubmission, ClinicalCase, Session } from "../domain/types";
import { eyeLabel } from "./Examinations";
export const diagnosisLabels: Record<string, string> = {
  myopia: "Bilateral myopia / refractive error",
  hyperopia: "Hyperopic refractive error",
  astigmatism: "Astigmatic refractive error",
  undetermined: "Insufficient evidence to determine a working diagnosis",
  other: "Other working diagnosis (explain below)",
};
export const managementOptions = [
  { id: "optical", label: "Optical correction based on completed refraction" },
  {
    id: "followup",
    label: "Review ocular health and its limitations; arrange appropriate local follow-up",
  },
  { id: "explain", label: "Explain the findings and proposed correction in patient language" },
  {
    id: "safety",
    label: "Advise prompt assessment if sudden vision changes or new warning symptoms occur",
  },
  {
    id: "further",
    label: "Arrange further assessment or referral where the findings or limited view warrant it",
  },
];
export function Submission({
  c,
  session,
  submit,
}: {
  c: ClinicalCase;
  session: Session;
  submit: (s: AssessmentSubmission) => void;
}) {
  const [form, setForm] = useState<AssessmentSubmission>({
    diagnosis: "",
    evidenceIds: [],
    reasoning: "",
    management: [],
    managementReasoning: "",
    explanation: "",
  });
  const toggle = (field: "evidenceIds" | "management", id: string) =>
    setForm({
      ...form,
      [field]: form[field].includes(id)
        ? form[field].filter((x) => x !== id)
        : [...form[field], id],
    });
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit(form);
      }}
    >
      <p className="muted">
        Bring your findings together. Submitting freezes this attempt and opens draft educational
        feedback.
      </p>
      <section className="form-section">
        <p className="eyebrow">01 / Interpretation</p>
        <label>
          Working diagnosis
          <select
            required
            value={form.diagnosis}
            onChange={(e) => setForm({ ...form, diagnosis: e.target.value })}
          >
            <option value="">Select your working diagnosis</option>
            {Object.entries(diagnosisLabels).map(([id, label]) => (
              <option value={id} key={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <fieldset>
          <legend>Supporting acquired evidence</legend>
          <p className="small muted">
            Choose the findings that support your interpretation. Only acquired evidence is
            available.
          </p>
          {session.results.length === 0 && session.revealedFactIds.length === 0 && (
            <p className="empty">
              No acquired evidence is available yet. You can return to the room or submit an
              incomplete assessment.
            </p>
          )}
          {session.results.map((r) => (
            <label className="check-row" key={r.id}>
              <input
                type="checkbox"
                checked={form.evidenceIds.includes(r.id)}
                onChange={() => toggle("evidenceIds", r.id)}
              />
              <span>
                <strong>
                  {r.examName} · {eyeLabel(r.eye)}
                </strong>
                <small>
                  {r.correction} · {r.value}
                </small>
              </span>
            </label>
          ))}
          {c.historyFacts
            .filter((f) => session.revealedFactIds.includes(f.id))
            .map((f) => (
              <label className="check-row" key={f.id}>
                <input
                  type="checkbox"
                  checked={form.evidenceIds.includes(`history:${f.id}`)}
                  onChange={() => toggle("evidenceIds", `history:${f.id}`)}
                />
                <span>
                  History · {f.domain}
                  <small>{f.answer}</small>
                </span>
              </label>
            ))}
        </fieldset>
        <label>
          Clinical reasoning <span className="unscored">Human review · unscored text</span>
          <textarea
            maxLength={2000}
            value={form.reasoning}
            onChange={(e) => setForm({ ...form, reasoning: e.target.value })}
            placeholder="How do the findings support your interpretation? What remains uncertain?"
          />
        </label>
      </section>
      <section className="form-section">
        <p className="eyebrow">02 / Management</p>
        <fieldset>
          <legend>Proposed next steps</legend>
          {managementOptions.map((m) => (
            <label className="check-row" key={m.id}>
              <input
                type="checkbox"
                checked={form.management.includes(m.id)}
                onChange={() => toggle("management", m.id)}
              />
              <span>{m.label}</span>
            </label>
          ))}
        </fieldset>
        <label>
          Management reasoning <span className="unscored">Human review · unscored text</span>
          <textarea
            maxLength={2000}
            value={form.managementReasoning}
            onChange={(e) => setForm({ ...form, managementReasoning: e.target.value })}
            placeholder="Explain your next steps and any further assessment needed."
          />
        </label>
      </section>
      <section className="form-section">
        <p className="eyebrow">03 / Patient explanation</p>
        <label>
          What would you say to Arun? <span className="unscored">Human review · unscored text</span>
          <textarea
            maxLength={2000}
            value={form.explanation}
            onChange={(e) => setForm({ ...form, explanation: e.target.value })}
            placeholder="Explain the findings and next steps in everyday language."
          />
        </label>
        <p className="small muted">
          Structured choices and acquired evidence are scored deterministically. Free text is
          preserved for review and does not change the score.
        </p>
      </section>
      <button className="primary full" type="submit">
        Submit assessment <ArrowRight size={18} />
      </button>
    </form>
  );
}
