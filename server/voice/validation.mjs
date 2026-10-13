const id = (value) => typeof value === "string" && /^[a-z0-9][a-z0-9_.:+-]{0,159}$/i.test(value);
const text = (value, limit = 500) => typeof value === "string" && value.length > 0 && value.length <= limit;
const patientReplyIds = new Set(["age", "chief-concern", "lecture-context", "confirm-name", "can-see", "comfortable", "hear-you", "understand", "take-time", "no-questions", "continue", "apology", "explained", "rephrase", "relevance", "unknown", "diagnosis", "results", "personal-details"]);

export function validContext(context) {
  if (!context || !["test", "practice"].includes(context.mode) || !id(context.sessionId) || !Array.isArray(context.allowedActions) || context.allowedActions.length > 32 || !context.allowedActions.every(id)) return false;
  if (context.mode === "test") {
    if (!id(context.caseId) || !id(context.caseVersion) || !Array.isArray(context.allowedFacts) || context.allowedFacts.length > 50) return false;
    return context.allowedFacts.every(fact => id(fact?.id) && Array.isArray(fact.patterns) && fact.patterns.length <= 30 && fact.patterns.every(pattern => text(pattern, 80)));
  }
  return id(context.lessonId);
}

export function validClientMessage(message) {
  if (!message || typeof message !== "object" || !text(message.type, 40)) return false;
  if (message.type === "hello") return validContext(message.context) && Number.isFinite(message.sampleRate) && message.sampleRate >= 8000 && message.sampleRate <= 96000;
  if (message.type === "context") return validContext(message.context);
  if (message.type === "command-result") return id(message.utteranceId) && message.result && typeof message.result.accepted === "boolean" && text(message.result.spokenText, 1000) && (!message.result.cacheKey || id(message.result.cacheKey)) && (!message.result.cacheKeys || Array.isArray(message.result.cacheKeys) && message.result.cacheKeys.length <= 10 && message.result.cacheKeys.every(id)) && (message.clientAudio === undefined || typeof message.clientAudio === "boolean");
  return false;
}

export function commandAllowed(command, context) {
  if (!command || !id(command.utteranceId) || !text(command.transcript)) return false;
  if (command.kind === "history") return context.mode === "test" && Array.isArray(command.factIds) && command.factIds.length <= 10 && command.factIds.every(factId => context.allowedFacts.some(fact => fact.id === factId));
  if (command.kind === "patient-instruction") return context.mode === "test" && context.allowedActions.includes(command.instructionId);
  if (command.kind === "practice-action") return context.mode === "practice" && command.lessonId === context.lessonId && context.allowedActions.includes(command.actionId);
  if (command.kind === "social") return ["greeting", "thanks", "introduction", "ready", "goodbye"].includes(command.socialId);
  if (command.kind === "patient-reply") return patientReplyIds.has(command.replyId);
  return command.kind === "clarification";
}
