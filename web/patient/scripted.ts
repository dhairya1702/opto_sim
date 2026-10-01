import type { ClinicalCase } from "../domain/types";
export type PatientReply = {
  reply: string;
  factIds: string[];
  needsClarification: boolean;
  status: "answered" | "unsupported" | "clarification";
};
export interface PatientProvider {
  mode: "scripted";
  answer(question: string, caseData: ClinicalCase, factId?: string): PatientReply;
}
export const scriptedPatient: PatientProvider = {
  mode: "scripted",
  answer(question, caseData, factId) {
    if (factId) {
      const fact = caseData.historyFacts.find((f) => f.id === factId);
      if (fact)
        return {
          reply: fact.answer,
          factIds: [fact.id],
          needsClarification: false,
          status: "answered",
        };
    }
    const q = question.toLowerCase().replace(/[’']/g, "");
    if (
      /answer key|rubric|score|diagnos|test result|ignore.*instruction|system prompt|prescription|lens power/.test(
        q,
      )
    )
      return {
        reply:
          "I'm here to talk about what I've noticed. I don't know the examination results or a diagnosis.",
        factIds: [],
        needsClarification: false,
        status: "unsupported",
      };
    if (/family|mother|parent/.test(q)) {
      const f = caseData.historyFacts.find((f) => f.id === "family")!;
      return { reply: f.answer, factIds: [f.id], needsClarification: false, status: "answered" };
    }
    const matched = caseData.historyFacts.filter((f) => f.patterns.some((p) => q.includes(p)));
    // Only disclose complete authored domains when the question clearly asks about them.
    if (matched.length > 0 && matched.length <= 4)
      return {
        reply: matched.map((f) => f.answer).join(" "),
        factIds: matched.map((f) => f.id),
        needsClarification: false,
        status: "answered",
      };
    if (/symptom|vision|eyes|problem|tell me more|anything else/.test(q))
      return {
        reply:
          "Could you ask a little more specifically—about when it started, what I can see, or another part of my history?",
        factIds: [],
        needsClarification: true,
        status: "clarification",
      };
    return {
      reply: "I'm not sure about that. That detail isn't available in my scripted history.",
      factIds: [],
      needsClarification: false,
      status: "unsupported",
    };
  },
};
