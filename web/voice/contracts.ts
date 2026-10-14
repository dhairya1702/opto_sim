export type VoiceMode = "test" | "practice";

export type VoiceCommand =
  | { kind: "history"; factIds: string[]; utteranceId: string; transcript: string }
  | { kind: "patient-instruction"; instructionId: string; utteranceId: string; transcript: string }
  | { kind: "encounter-action"; actionId: string; utteranceId: string; transcript: string }
  | { kind: "practice-action"; lessonId: string; actionId: string; utteranceId: string; transcript: string }
  | { kind: "social"; socialId: string; utteranceId: string; transcript: string }
  | { kind: "patient-reply"; replyId: string; utteranceId: string; transcript: string }
  | { kind: "clarification"; utteranceId: string; transcript: string };

export type VoiceStatus =
  | "locked"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "reconnecting"
  | "muted"
  | "error";

export type VoiceContext = {
  mode: VoiceMode;
  sessionId: string;
  caseId?: string;
  caseVersion?: string;
  lessonId?: string;
  allowedFacts?: { id: string; patterns: string[] }[];
  allowedActions: string[];
};

export type VoiceCommandResult = {
  accepted: boolean;
  spokenText: string;
  /** Environmental actions use visual state feedback instead of Arun's patient voice. */
  suppressAudio?: boolean;
  cacheKey?: string;
  cacheKeys?: string[];
  errorCode?: string;
};

const nonEmpty = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 160;

export function validVoiceCommand(value: unknown): value is VoiceCommand {
  if (!value || typeof value !== "object") return false;
  const command = value as Partial<VoiceCommand>;
  if (!nonEmpty(command.kind) || !nonEmpty(command.utteranceId) || !nonEmpty(command.transcript) || command.transcript.length > 500) return false;
  if (command.kind === "history") return Array.isArray(command.factIds) && command.factIds.length <= 10 && command.factIds.every(nonEmpty);
  if (command.kind === "patient-instruction") return nonEmpty(command.instructionId);
  if (command.kind === "encounter-action") return nonEmpty(command.actionId);
  if (command.kind === "practice-action") return nonEmpty(command.lessonId) && nonEmpty(command.actionId);
  if (command.kind === "social") return nonEmpty(command.socialId);
  if (command.kind === "patient-reply") return nonEmpty(command.replyId);
  return command.kind === "clarification";
}

export const voiceStatusLabel = (status: VoiceStatus) => ({
  locked: "VOICE LOCKED",
  connecting: "CONNECTING",
  listening: "LISTENING",
  thinking: "THINKING",
  speaking: "ARUN SPEAKING",
  reconnecting: "RECONNECTING",
  muted: "MUTED",
  error: "VOICE ERROR",
})[status];
