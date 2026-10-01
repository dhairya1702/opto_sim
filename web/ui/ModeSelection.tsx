import { ArrowRight, BookOpenCheck, GraduationCap, Stethoscope } from "lucide-react";

export type ExperienceMode = "practice" | "test";

export function ModeSelection({ onSelect }: { onSelect: (mode: ExperienceMode) => void }) {
  return (
    <main className="mode-selection">
      <header className="mode-brand">
        <span className="mode-mark"><Stethoscope size={24} /></span>
        <span>opto<span className="wordmark-dot">.</span></span>
        <small>Clinical skills simulator</small>
      </header>
      <section className="mode-intro" aria-labelledby="mode-title">
        <p className="eyebrow">CHOOSE YOUR LEARNING MODE</p>
        <h1 id="mode-title">How do you want to train?</h1>
        <p>Learn one clinical skill with guidance, or apply your knowledge in a complete patient encounter.</p>
      </section>
      <section className="mode-grid" aria-label="Training modes">
        <button className="mode-card practice" onClick={() => onSelect("practice")}>
          <span className="mode-card-icon"><GraduationCap size={30} /></span>
          <span className="mode-card-copy">
            <span className="eyebrow">LEARN & REPEAT</span>
            <strong>Practice clinical skills</strong>
            <span>Work through individual tests with procedure guidance, interactive technique practice, interpretation, and immediate feedback.</span>
          </span>
          <span className="mode-card-action">Open practice library <ArrowRight size={18} /></span>
        </button>
        <button className="mode-card test" onClick={() => onSelect("test")}>
          <span className="mode-card-icon"><BookOpenCheck size={29} /></span>
          <span className="mode-card-copy">
            <span className="eyebrow">APPLY & DIAGNOSE</span>
            <strong>Test yourself with a patient</strong>
            <span>Take a history, choose examinations, record findings, form a diagnosis, and review your decisions after submission.</span>
          </span>
          <span className="mode-card-action">Start patient encounter <ArrowRight size={18} /></span>
        </button>
      </section>
      <p className="mode-disclaimer">Fictional educational simulation · clinical content remains subject to qualified review</p>
    </main>
  );
}
