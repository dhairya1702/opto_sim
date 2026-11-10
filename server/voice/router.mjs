import practiceVoice from "../../shared/practiceVoice.json" with { type: "json" };
import { matchesIntent, needsSemanticRouting, normalize } from "./intents.mjs";
const prohibited = /answer key|rubric|score|diagnos|test result|ignore .*instruction|system prompt|prescription|lens power/;
const instructionPatterns = {
  "look-straight": ["look straight", "look ahead", "look into the distance", "look in the distance", "look over my shoulder", "fixate distance", "far target"],
  "follow-target": ["follow the target", "follow this target", "follow my target", "follow the light", "follow my light", "follow this light", "follow my finger", "track the target", "track my light", "move your eyes with"],
  "fixate-target": ["look at the target", "look at this target", "look at my target", "look at the light", "look at my light", "fixate the target", "fixate this", "keep looking at", "keep your eyes on"],
  "report-symptoms": ["symptom", "double vision", "see double", "see two", "any pain", "does it hurt", "any discomfort"],
  "read-chart": ["read the chart", "read the letters", "read this line", "read that line", "smallest line", "read the near card"],
};
const encounterActionPatterns = {
  "dim-room": ["dim the lights", "dim room", "dim the room", "turn the room lights down", "lower the room lights", "make the room darker", "lights off", "turn off the lights", "switch off the lights", "room lights off"],
  "restore-room": ["restore the lights", "restore room lights", "turn the room lights on", "turn the lights back on", "bring the lights back up", "brighten the room", "lights on", "turn on the lights", "switch on the lights", "room lights on"],
};
// Only standalone social turns consume a turn. A greeting attached to an
// unfamiliar clinical request must leave the full request for semantic routing.
const socialPatterns = [
  ["introduction", /^(?:(?:what is|whats|tell me) your name|who are you)$/],
  ["greeting", /^(?:(?:hello|hi|hey|good morning|good afternoon|good evening)(?: there| arun)?(?: how are you| how is it going| how are things)?|how (?:are you|is it going|are things))$/],
  ["thanks", /^(?:thank you(?: arun| very much)?|thanks(?: arun)?|cheers)$/],
  ["ready", /^(?:are you ready(?: to begin)?|ready to begin|shall we begin|can we start)$/],
  ["goodbye", /^(?:goodbye|bye|see you|take care)$/],
];

export const patientReplyIds = [
  "age", "chief-concern", "lecture-context", "confirm-name", "can-see", "comfortable",
  "hear-you", "understand", "take-time", "no-questions", "continue", "apology",
  "explained", "rephrase", "relevance", "unknown", "diagnosis", "results", "personal-details",
];
const patientReplyPatterns = [
  ["age", /\b(?:how old|your age|age are you|date of birth|birthday)\b/],
  ["chief-concern", /\b(?:what brings you|why are you here|reason for (?:your )?visit|how can i help|main concern|main problem)\b/],
  ["lecture-context", /\b(?:work|job|occupation|student|school|college|university|study|lectures?)\b/],
  ["confirm-name", /\b(?:are you arun|is your name arun|confirm your name)\b/],
  ["can-see", /\b(?:can you see me|see me clearly)\b/],
  ["comfortable", /\b(?:are you comfortable|feeling comfortable)\b/],
  ["hear-you", /\b(?:can you hear me|do you hear me)\b/],
  ["understand", /\b(?:do you understand|does that make sense|understand what i said)\b/],
  ["take-time", /\b(?:take your time|give me a moment|one moment|bear with me)\b/],
  ["no-questions", /\b(?:any questions|questions for me|do you have questions)\b/],
  ["continue", /\b(?:okay to continue|can we continue|need a break|carry on)\b/],
  ["apology", /\b(?:i am sorry|im sorry|my apologies|i apologize)\b/],
  ["explained", /\b(?:i will explain|let me explain|explain the test|explain the exam)\b/],
  ["personal-details", /\b(?:phone number|email address|home address|where do you live|contact details)\b/],
  ["relevance", /\b(?:favorite colou?r|favorite movie|favorite music|favorite food|politics|weather|sports team)\b/],
  ["rephrase", /\b(?:what do you mean|i dont understand you|that didnt make sense)\b/],
];

const socialIntent = value => socialPatterns.find(([, pattern]) => pattern.test(value))?.[0];

export function routeDeterministic(transcript, context, utteranceId) {
  const q = normalize(transcript);
  if (!q || q.length < 3) return null;
  if (/\bdiagnos|what do i have|whats wrong with my eyes/.test(q)) return { kind: "patient-reply", replyId: "diagnosis", utteranceId, transcript };
  if (prohibited.test(q)) return { kind: "patient-reply", replyId: "results", utteranceId, transcript };
  if (needsSemanticRouting(transcript, q, context)) return null;
  if (context.mode === "test") {
    for (const [actionId, patterns] of Object.entries(encounterActionPatterns)) {
      if (context.allowedActions.includes(actionId) && matchesIntent(actionId, q, patterns)) return { kind: "encounter-action", actionId, utteranceId, transcript };
    }
    for (const [instructionId, patterns] of Object.entries(instructionPatterns)) {
      if (context.allowedActions.includes(instructionId) && matchesIntent(instructionId, q, patterns)) return { kind: "patient-instruction", instructionId, utteranceId, transcript };
    }
    const factIds = context.allowedFacts.filter(fact => fact.patterns.some(pattern => q.includes(normalize(pattern)))).map(fact => fact.id);
    if (factIds.length > 0 && factIds.length <= 4) return { kind: "history", factIds, utteranceId, transcript };
    const patientReplyId = patientReplyPatterns.find(([, pattern]) => pattern.test(q))?.[0];
    if (patientReplyId) return { kind: "patient-reply", replyId: patientReplyId, utteranceId, transcript };
    const socialId = socialIntent(q);
    if (socialId) return { kind: "social", socialId, utteranceId, transcript };
    return null;
  }
  const matches = (practiceVoice[context.lessonId] || []).filter(action =>
    context.allowedActions.includes(action.id) && matchesIntent(action.id, q, action.phrases.map(normalize), context.lessonId));
  // "Where does the line look relative to the light?" asks for a report,
  // even though its look/light words also resemble a fixation instruction.
  const action = matches.find(action => action.id === "follow-target" || action.id.startsWith("target-") || action.id.startsWith("examiner-"))
    || matches.find(action => ["request-report", "report-clear", "report-symptoms"].includes(action.id)) || matches[0];
  if (action) return { kind: "practice-action", lessonId: context.lessonId, actionId: action.id, utteranceId, transcript };
  const socialId = socialIntent(q);
  if (socialId) return { kind: "social", socialId, utteranceId, transcript };
  const patientReplyId = patientReplyPatterns.find(([, pattern]) => pattern.test(q))?.[0];
  if (patientReplyId) return { kind: "patient-reply", replyId: patientReplyId, utteranceId, transcript };
  return null;
}

export { normalize };
