// Shared XR runtime announces hidden sessions; ordinary document visibility is
// handled directly by the voice owner. Returning never enables capture.
export const VOICE_SESSION_HIDDEN = "opto-voice-session-hidden";
export function announceHiddenVoiceSession() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(VOICE_SESSION_HIDDEN));
}
