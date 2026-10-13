import type { VoiceCommandResult } from "./contracts";

export const PATIENT_VOICE_REPLIES = {
  age: { text: "I'm 24 years old.", status: "answered", factIds: [] },
  "chief-concern": { text: "I came in because things across the room have been blurry for a few months, while reading up close seems okay.", status: "answered", factIds: ["onset", "visual-pattern"] },
  "lecture-context": { text: "I spend time in lectures, and the slides are difficult for me to see clearly.", status: "answered", factIds: ["impact"] },
  "confirm-name": { text: "Yes, I'm Arun.", status: "answered", factIds: [] },
  "can-see": { text: "Yes, I can see you, although distant detail looks blurry.", status: "answered", factIds: ["visual-pattern"] },
  comfortable: { text: "Yes, I'm comfortable, thank you.", status: "answered", factIds: [] },
  "hear-you": { text: "Yes, I can hear you.", status: "answered", factIds: [] },
  understand: { text: "Yes, I understand.", status: "answered", factIds: [] },
  "take-time": { text: "Okay, take your time.", status: "answered", factIds: [] },
  "no-questions": { text: "I don't have any questions at the moment.", status: "answered", factIds: [] },
  continue: { text: "I'm okay to continue.", status: "answered", factIds: [] },
  apology: { text: "That's okay.", status: "answered", factIds: [] },
  explained: { text: "Okay, thank you for explaining.", status: "answered", factIds: [] },
  rephrase: { text: "Sorry, could you ask that another way?", status: "clarification", factIds: [] },
  relevance: { text: "I'm not sure how that relates to my eyes. Could you explain why you're asking?", status: "clarification", factIds: [] },
  unknown: { text: "I'm not sure about that.", status: "unsupported", factIds: [] },
  diagnosis: { text: "I'm not sure what the diagnosis is. I was hoping you could tell me after the examination.", status: "unsupported", factIds: [] },
  results: { text: "I don't know the examination results. You're the one examining me.", status: "unsupported", factIds: [] },
  "personal-details": { text: "I'd rather keep personal contact details out of this consultation.", status: "unsupported", factIds: [] },
} as const;

export type PatientVoiceReplyId = keyof typeof PATIENT_VOICE_REPLIES;

export function patientVoiceReply(replyId: string): VoiceCommandResult & { factIds?: string[]; status?: "answered" | "unsupported" | "clarification" } {
  if (!(replyId in PATIENT_VOICE_REPLIES))
    return { accepted: false, spokenText: "Sorry, could you ask that another way?", errorCode: "PATIENT_REPLY_MISMATCH" };
  const reply = PATIENT_VOICE_REPLIES[replyId as PatientVoiceReplyId];
  return { accepted: true, spokenText: reply.text, cacheKey: `patient:${replyId}`, factIds: [...reply.factIds], status: reply.status };
}
