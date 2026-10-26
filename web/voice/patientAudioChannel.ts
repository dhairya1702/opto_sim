export const PATIENT_AUDIO_START = "opto:patient-audio-start";
export function announcePatientAudio(source: "report" | "voice") {
  window.dispatchEvent(new CustomEvent(PATIENT_AUDIO_START, { detail: source }));
}
