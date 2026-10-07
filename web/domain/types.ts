export type Eye = "OD" | "OS" | "OU";
export type StationId = "patient" | "trolley" | "refraction" | "slit" | "fundus" | "acuity";
export type ExamConfig = { eye: Eye; mode: string };
export type HistoryFact = {
  id: string;
  domain: string;
  question: string;
  answer: string;
  patterns: string[];
  weight: number;
};
export type Refraction = {
  eye: "OD" | "OS";
  sphere: number;
  cylinder: number;
  axis: number | null;
  units: "D";
  workingDistanceAccounted: boolean;
};
export type Finding = {
  /** Explicit authored visual; unsupported/missing appearances must not default to normal. */
  posteriorPole?: "schematic-within-normal-limits";
  value: string;
  method: string;
  units: string;
  correction: string;
  distance?: string;
  refraction?: Refraction[];
};
export type ExamDefinition = {
  id: string;
  name: string;
  equipmentIds: StationId[];
  equipment: string;
  eyes: Eye[];
  modes: { id: string; label: string }[];
  scope: string;
  rationale: string;
  findings: Record<string, Finding>;
  prerequisite?: { examId: string; sameEye: boolean };
  weight: number;
};
export type Criterion = {
  id: string;
  dimension: "History" | "Examination selection" | "Interpretation" | "Management / communication";
  weight: number;
  label: string;
  rule: string;
  alternatives: string[];
  feedback: string;
};
export type ClinicalCase = {
  id: string;
  version: string;
  reviewStatus: "draft" | "approved";
  briefing: string;
  patient: { name: string; age: number; openingLine: string };
  historyFacts: HistoryFact[];
  exams: ExamDefinition[];
  rubric: {
    version: string;
    criteria: Criterion[];
    criticalOmissions: {
      id: string;
      label: string;
      kind: "history" | "exam";
      requiredIds: string[];
    }[];
  };
  answerKey: { diagnosis: string; interpretation: string; management: string };
};
export type ExamResult = Finding & {
  id: string;
  examId: string;
  examName: string;
  eye: Eye;
  mode: string;
  caseVersion: string;
  eventId: string;
  expectedValue?: string;
  observationSource?: "trainee";
  observationAccurate?: boolean;
};
export type Turn = {
  id: string;
  role: "patient" | "trainee";
  text: string;
  status?: "answered" | "unsupported" | "clarification";
  factIds?: string[];
};
export type SessionEvent = {
  id: string;
  type: "start" | "question" | "select" | "exam" | "repeat" | "blocked" | "submission";
  at: number;
  detail: string;
  factIds?: string[];
  resultId?: string;
  status?: Turn["status"];
};
export type AssessmentSubmission = {
  diagnosis: string;
  evidenceIds: string[];
  reasoning: string;
  management: string[];
  managementReasoning: string;
  explanation: string;
};
export type Session = {
  id: string;
  caseId: string;
  caseVersion: string;
  phase: "briefing" | "encounter" | "debrief";
  startedAt?: number;
  endedAt?: number;
  revealedFactIds: string[];
  results: ExamResult[];
  transcript: Turn[];
  events: SessionEvent[];
  submission?: AssessmentSubmission;
  selectedProcedure?: { examId: string; config: ExamConfig };
  message?: string;
};
export type Action =
  | { type: "start"; at: number }
  | { type: "askQuestion"; question: string; factId?: string; at: number }
  | { type: "selectProcedure"; examId: string; config: ExamConfig; at: number }
  | {
      type: "performExam";
      examId: string;
      config: ExamConfig;
      at: number;
      requestId: string;
      observation?: string;
    }
  | { type: "submitAssessment"; submission: AssessmentSubmission; at: number };
export type ScoreCriterion = Criterion & { earned: number; eventIds: string[]; met: boolean };
export type Feedback = {
  total: number;
  dimensions: { name: Criterion["dimension"]; earned: number; possible: number }[];
  criteria: ScoreCriterion[];
  critical: string[];
};
