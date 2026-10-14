import type { ClinicalCase } from "../domain/types";
import { historyReplyForIds, resolveHistoryQuestion } from "./history";
export type PatientReply = {
  reply: string;
  factIds: string[];
  needsClarification: boolean;
  status: "answered" | "unsupported" | "clarification";
};
export interface PatientProvider {
  mode: "scripted";
  answer(question: string, caseData: ClinicalCase, factId?: string, resolvedFactIds?: string[]): PatientReply;
}
export const scriptedPatient: PatientProvider = {
  mode: "scripted",
  answer(question, caseData, factId, resolvedFactIds) {
    if (resolvedFactIds) {
      const response = historyReplyForIds(caseData, resolvedFactIds);
      if (response.factIds.length)
        return {
          ...response,
          needsClarification: false,
          status: "answered",
        };
      return {
        reply: "Could you ask a little more specifically about what you want to know?",
        factIds: [],
        needsClarification: true,
        status: "clarification",
      };
    }
    if (factId) {
      const response = historyReplyForIds(caseData, [factId]);
      if (response.factIds.length)
        return {
          ...response,
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
    const matched = resolveHistoryQuestion(q, caseData);
    const response = historyReplyForIds(caseData, matched);
    // Only disclose authored details when the question clearly asks about them.
    if (response.factIds.length > 0 && response.factIds.length <= 10)
      return {
        ...response,
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
