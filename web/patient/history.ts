import type { ClinicalCase, HistoryDetail, HistoryFact } from "../domain/types";

const normalize = (value: string) => value.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const matches = (question: string, patterns: string[]) => patterns.some((pattern) => question.includes(normalize(pattern)));

export const historyDetailId = (fact: HistoryFact, detail: HistoryDetail) => `${fact.id}:${detail.id}`;

export function authoredHistoryResponseIds(caseData: ClinicalCase) {
  return caseData.historyFacts.flatMap((fact) => [fact.id, ...(fact.details?.map((detail) => historyDetailId(fact, detail)) ?? [])]);
}

export function voiceHistoryFacts(caseData: ClinicalCase) {
  return caseData.historyFacts.flatMap((fact) => [
    { id: fact.id, patterns: fact.details ? (fact.broadPatterns ?? []) : fact.patterns },
    ...(fact.details?.map((detail) => ({ id: historyDetailId(fact, detail), patterns: detail.patterns })) ?? []),
  ]).filter((candidate) => candidate.patterns.length > 0);
}

export function resolveHistoryQuestion(question: string, caseData: ClinicalCase) {
  const q = normalize(question);
  const ids: string[] = [];
  for (const fact of caseData.historyFacts) {
    if (!fact.details) {
      if (matches(q, fact.patterns)) ids.push(fact.id);
      continue;
    }
    const detailIds = fact.details.filter((detail) => matches(q, detail.patterns)).map((detail) => historyDetailId(fact, detail));
    if (detailIds.length === fact.details.length || (!detailIds.length && matches(q, fact.broadPatterns ?? []))) ids.push(fact.id);
    else ids.push(...detailIds);
  }
  return ids;
}

export function historyReplyForIds(caseData: ClinicalCase, requestedIds: string[]) {
  const requested = new Set(requestedIds);
  const replies: string[] = [];
  const disclosedIds: string[] = [];
  for (const fact of caseData.historyFacts) {
    if (requested.has(fact.id)) {
      replies.push(fact.answer);
      disclosedIds.push(fact.id);
      continue;
    }
    const details = fact.details?.filter((detail) => requested.has(historyDetailId(fact, detail))) ?? [];
    if (!details.length) continue;
    if (details.length === fact.details?.length) {
      replies.push(fact.answer);
      disclosedIds.push(fact.id);
    } else {
      replies.push(...details.map((detail) => detail.answer));
      disclosedIds.push(...details.map((detail) => historyDetailId(fact, detail)));
    }
  }
  return { reply: replies.join(" "), factIds: disclosedIds };
}

export function historyFactProgress(fact: HistoryFact, revealedIds: Iterable<string>) {
  const revealed = revealedIds instanceof Set ? revealedIds : new Set(revealedIds);
  if (revealed.has(fact.id)) return { answered: fact.details?.length ?? 1, total: fact.details?.length ?? 1, ratio: 1, answer: fact.answer };
  if (!fact.details) return { answered: 0, total: 1, ratio: 0, answer: "" };
  const disclosed = fact.details.filter((detail) => revealed.has(historyDetailId(fact, detail)));
  return {
    answered: disclosed.length,
    total: fact.details.length,
    ratio: disclosed.length / fact.details.length,
    answer: disclosed.map((detail) => detail.answer).join(" "),
  };
}

export function disclosedHistory(caseData: ClinicalCase, revealedIds: Iterable<string>) {
  return caseData.historyFacts.map((fact) => ({ fact, ...historyFactProgress(fact, revealedIds) })).filter((item) => item.answered > 0);
}
