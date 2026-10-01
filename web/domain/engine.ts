import type {
  Action,
  AssessmentSubmission,
  ClinicalCase,
  ExamConfig,
  ExamDefinition,
  Feedback,
  Session,
  SessionEvent,
} from "./types";
import { scriptedPatient } from "../patient/scripted";
export const resultKey = (c: ClinicalCase, examId: string, config: ExamConfig) =>
  `${c.version}|${examId}|${config.eye}|${config.mode}`;
export const requiredKeys = (c: ClinicalCase, e: ExamDefinition) =>
  e.eyes.flatMap((eye) => e.modes.map((mode) => resultKey(c, e.id, { eye, mode: mode.id })));
export function newSession(c: ClinicalCase, id: string): Session {
  return {
    id,
    caseId: c.id,
    caseVersion: c.version,
    phase: "briefing",
    revealedFactIds: [],
    results: [],
    transcript: [],
    events: [],
  };
}
export function examBlock(
  c: ClinicalCase,
  s: Session,
  examId: string,
  config: ExamConfig,
): string | undefined {
  const e = c.exams.find((e) => e.id === examId);
  if (
    !e ||
    !e.eyes.includes(config.eye) ||
    !e.modes.some((m) => m.id === config.mode) ||
    !e.findings[`${config.eye}:${config.mode}`]
  )
    return "This examination configuration is not authored in this case.";
  if (
    e.prerequisite &&
    !s.results.some(
      (r) =>
        r.examId === e.prerequisite!.examId && (!e.prerequisite!.sameEye || r.eye === config.eye),
    )
  )
    return `First complete ${c.exams.find((x) => x.id === e.prerequisite!.examId)!.name.toLowerCase()} for ${config.eye}. This dependency is part of the draft workflow.`;
}
export function reduceSession(c: ClinicalCase, s: Session, a: Action): Session {
  const id = `${s.id}:event:${s.events.length + 1}`;
  const event = (
    type: SessionEvent["type"],
    detail: string,
    extra: Partial<SessionEvent> = {},
  ) => ({ id, type, detail, at: a.at, ...extra });
  if (a.type === "start")
    return s.phase === "briefing"
      ? {
          ...s,
          phase: "encounter",
          startedAt: a.at,
          transcript: [{ id: `${id}:opening`, role: "patient", text: c.patient.openingLine }],
          events: [event("start", "Consultation started")],
        }
      : s;
  if (s.phase !== "encounter") return s;
  if (a.type === "askQuestion") {
    const question = a.question.trim().slice(0, 500);
    if (!question) return s;
    const reply = scriptedPatient.answer(question, c, a.factId);
    return {
      ...s,
      revealedFactIds: [...new Set([...s.revealedFactIds, ...reply.factIds])],
      transcript: [
        ...s.transcript,
        { id: `${id}:q`, role: "trainee", text: question },
        {
          id: `${id}:a`,
          role: "patient",
          text: reply.reply,
          status: reply.status,
          factIds: reply.factIds,
        },
      ],
      events: [
        ...s.events,
        event("question", question, { factIds: reply.factIds, status: reply.status }),
      ],
    };
  }
  if (a.type === "selectProcedure")
    return {
      ...s,
      selectedProcedure: { examId: a.examId, config: a.config },
      message: undefined,
      events: [
        ...s.events,
        event("select", `Selected ${a.examId}: ${a.config.eye}, ${a.config.mode}`),
      ],
    };
  if (a.type === "performExam") {
    // Same request ID is ignored; a deliberate repeat is logged but not re-awarded.
    if (s.events.some((e) => e.id === a.requestId)) return s;
    const blocked = examBlock(c, s, a.examId, a.config);
    if (blocked)
      return {
        ...s,
        message: blocked,
        events: [...s.events, event("blocked", blocked, { id: a.requestId })],
      };
    const key = resultKey(c, a.examId, a.config),
      e = c.exams.find((e) => e.id === a.examId)!;
    if (s.results.some((r) => r.id === key))
      return {
        ...s,
        message: "Already recorded. The authored result is unchanged.",
        events: [
          ...s.events,
          event("repeat", `Repeated ${e.name} ${a.config.eye}`, { id: a.requestId, resultId: key }),
        ],
      };
    const authored = e.findings[`${a.config.eye}:${a.config.mode}`];
    const observation = a.observation?.trim().slice(0, 500);
    const result = {
      ...authored,
      ...(observation
        ? {
            value: observation,
            expectedValue: authored.value,
            observationSource: "trainee" as const,
            observationAccurate: observation === authored.value,
          }
        : {}),
      id: key,
      examId: e.id,
      examName: e.name,
      eye: a.config.eye,
      mode: a.config.mode,
      caseVersion: c.version,
      eventId: a.requestId,
    };
    return {
      ...s,
      results: [...s.results, result],
      message: undefined,
      events: [
        ...s.events,
        event(
          "exam",
          `${e.name} · ${a.config.eye} · ${a.config.mode}${observation ? ` · recorded ${observation}` : ""}`,
          {
          id: a.requestId,
          resultId: key,
          },
        ),
      ],
    };
  }
  if (a.type === "submitAssessment") {
    const valid = new Set([
      ...s.results.map((r) => r.id),
      ...s.revealedFactIds.map((id) => `history:${id}`),
    ]);
    const submission: AssessmentSubmission = {
      ...a.submission,
      evidenceIds: [...new Set(a.submission.evidenceIds.filter((id) => valid.has(id)))],
      management: [...new Set(a.submission.management)],
    };
    return {
      ...s,
      phase: "debrief",
      endedAt: a.at,
      submission,
      events: [...s.events, event("submission", `Assessment submitted: ${submission.diagnosis}`)],
    };
  }
  return s;
}
export function assess(c: ClinicalCase, s: Session): Feedback {
  const sub = s.events.some((e) => e.type === "submission") ? s.submission : undefined;
  const answeredFacts = new Set(
    s.events
      .filter((e) => e.type === "question" && e.status === "answered")
      .flatMap((e) => e.factIds ?? []),
  );
  const acquired = new Set(
    s.results
      .filter((r) =>
        s.events.some((e) => e.type === "exam" && e.id === r.eventId && e.resultId === r.id),
      )
      .map((r) => r.id),
  );
  const accurate = new Set(
    s.results.filter((r) => r.observationAccurate !== false).map((r) => r.id),
  );
  const evidence = new Set(sub?.evidenceIds.filter((id) => acquired.has(id)) ?? []);
  const fraction = (examId: string, selected = false, accurateOnly = false) => {
    const e = c.exams.find((e) => e.id === examId)!;
    const keys = requiredKeys(c, e);
    const source = selected ? evidence : acquired;
    return keys.filter((k) => source.has(k) && (!accurateOnly || accurate.has(k))).length / keys.length;
  };
  const criteria = c.rubric.criteria.map((cr) => {
    let ratio = 0,
      events: SessionEvent[] = [];
    const [kind, key] = cr.id.split(":");
    if (kind === "history") {
      ratio = answeredFacts.has(key) ? 1 : 0;
      events = s.events.filter((e) => e.type === "question" && e.factIds?.includes(key));
    }
    if (kind === "exam") {
      ratio = fraction(key);
      events = s.events.filter(
        (e) => e.type === "exam" && s.results.some((r) => r.examId === key && r.eventId === e.id),
      );
    }
    if (kind === "interpretation") {
      const examId =
        key === "baseline" ? "distance" : key === "refraction" ? "subjective" : "pinhole";
      if (key === "diagnosis") ratio = sub?.diagnosis === c.answerKey.diagnosis ? 1 : 0;
      else
        ratio = fraction(
          key === "baseline" ? "distance" : key === "refraction" ? "subjective" : "pinhole",
          true,
          true,
        );
      events = s.events.filter(
        (e) =>
          e.type === "submission" ||
          (key !== "diagnosis" &&
            e.type === "exam" &&
            e.resultId &&
            evidence.has(e.resultId) &&
            s.results.some((r) => r.examId === examId && r.eventId === e.id)),
      );
    }
    if (kind === "management") {
      if (key === "correction" && sub?.management.includes("optical"))
        ratio = fraction("subjective");
      if (key === "followup" && sub?.management.includes("followup"))
        ratio = (fraction("anterior") + fraction("fundus")) / 2;
      if (key === "explain")
        ratio =
          ((sub?.management.includes("explain") ? 1 : 0) +
            (sub?.management.includes("safety") ? 1 : 0)) /
          2;
      const examIds =
        key === "correction" ? ["subjective"] : key === "followup" ? ["anterior", "fundus"] : [];
      events = s.events.filter(
        (e) =>
          e.type === "submission" ||
          (e.type === "exam" &&
            s.results.some((r) => examIds.includes(r.examId) && r.eventId === e.id)),
      );
    }
    return {
      ...cr,
      earned: Math.round(cr.weight * ratio * 100) / 100,
      eventIds: events.map((e) => e.id),
      met: ratio === 1,
    };
  });
  const names = [
    "History",
    "Examination selection",
    "Interpretation",
    "Management / communication",
  ] as const;
  const dimensions = names.map((name) => ({
    name,
    earned:
      Math.round(
        criteria.filter((c) => c.dimension === name).reduce((n, c) => n + c.earned, 0) * 100,
      ) / 100,
    possible: criteria.filter((c) => c.dimension === name).reduce((n, c) => n + c.weight, 0),
  }));
  const critical = c.rubric.criticalOmissions
    .filter((o) =>
      o.kind === "history"
        ? o.requiredIds.some((id) => !answeredFacts.has(id))
        : o.requiredIds.some((id) => fraction(id) < 1),
    )
    .map((o) => o.label);
  return {
    total: Math.round(dimensions.reduce((n, d) => n + d.earned, 0) * 100) / 100,
    dimensions,
    criteria,
    critical,
  };
}
