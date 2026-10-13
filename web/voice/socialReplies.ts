export const SOCIAL_VOICE_REPLIES = {
  greeting: "Hi. I'm doing okay, thanks. How are you?",
  thanks: "You're welcome.",
  introduction: "Hi, I'm Arun.",
  ready: "Yes, I'm ready.",
  goodbye: "Thank you. Goodbye.",
} as const;

export type SocialVoiceId = keyof typeof SOCIAL_VOICE_REPLIES;

export function socialVoiceReply(socialId: string) {
  if (!(socialId in SOCIAL_VOICE_REPLIES))
    return { accepted: false, spokenText: "I didn't understand that.", errorCode: "SOCIAL_MISMATCH" };
  const id = socialId as SocialVoiceId;
  return { accepted: true, spokenText: SOCIAL_VOICE_REPLIES[id], cacheKey: `social:${id}` };
}
