const normalize = (value) => value.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const prohibited = /answer key|rubric|score|diagnos|test result|ignore .*instruction|system prompt|prescription|lens power/;
const instructionPatterns = {
  "look-straight": ["look straight", "look ahead", "fixate distance"],
  "fixate-target": ["look at the target", "fixate the target", "keep looking at"],
  "follow-target": ["follow the target", "follow the light", "follow this"],
  "report-symptoms": ["double vision", "any pain", "any discomfort", "tell me if"],
  "read-chart": ["read the chart", "read the letters", "read this line", "read the near card"],
};
const practicePatterns = {
  "fixate-light": ["look at the light", "fixate the light"],
  "fixate-target": ["look at the target", "fixate the target"],
  "follow-target": ["follow the target", "follow the light"],
  "report-symptoms": ["double vision", "any pain", "any discomfort"],
  "request-report": ["what do you see", "tell me what you see", "report now"],
  "report-clear": ["is it clear", "can you clear", "clear now"],
};
const socialPatterns = [
  ["introduction", /\b(?:what is|whats|tell me) your name\b|\bwho are you\b/],
  ["greeting", /\b(?:hello|hi|hey|good morning|good afternoon|good evening)\b|\bhow (?:are you|is it going|are things)\b/],
  ["thanks", /\b(?:thank you|thanks|cheers)\b/],
  ["ready", /\b(?:are you ready|ready to begin|shall we begin|can we start)\b/],
  ["goodbye", /\b(?:goodbye|bye|see you|take care)\b/],
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
  if (context.mode === "test") {
    for (const [instructionId, patterns] of Object.entries(instructionPatterns)) {
      if (context.allowedActions.includes(instructionId) && patterns.some(pattern => q.includes(pattern))) return { kind: "patient-instruction", instructionId, utteranceId, transcript };
    }
    const factIds = context.allowedFacts.filter(fact => fact.patterns.some(pattern => q.includes(normalize(pattern)))).map(fact => fact.id);
    if (factIds.length > 0 && factIds.length <= 4) return { kind: "history", factIds, utteranceId, transcript };
    const patientReplyId = patientReplyPatterns.find(([, pattern]) => pattern.test(q))?.[0];
    if (patientReplyId) return { kind: "patient-reply", replyId: patientReplyId, utteranceId, transcript };
    if (/symptom|vision|eyes|problem|tell me more|anything else/.test(q)) return { kind: "patient-reply", replyId: "rephrase", utteranceId, transcript };
    const socialId = socialIntent(q);
    if (socialId) return { kind: "social", socialId, utteranceId, transcript };
    return null;
  }
  for (const [actionId, patterns] of Object.entries(practicePatterns)) {
    if (context.allowedActions.includes(actionId) && patterns.some(pattern => q.includes(pattern))) return { kind: "practice-action", lessonId: context.lessonId, actionId, utteranceId, transcript };
  }
  const socialId = socialIntent(q);
  if (socialId) return { kind: "social", socialId, utteranceId, transcript };
  const patientReplyId = patientReplyPatterns.find(([, pattern]) => pattern.test(q))?.[0];
  if (patientReplyId) return { kind: "patient-reply", replyId: patientReplyId, utteranceId, transcript };
  return null;
}

export { normalize };
