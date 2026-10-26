import { useEffect, useRef, useState } from "react";
import { createPatientReportSpeaker, patientReportAudioUrl } from "./patientReportSpeech";
import { announcePatientAudio, PATIENT_AUDIO_START } from "./patientAudioChannel";

export function usePatientReportSpeech(active: boolean, key: string, text: string) {
  const speaker = useRef<ReturnType<typeof createPatientReportSpeaker> | null>(null);
  const [audioMessage, setAudioMessage] = useState("");
  useEffect(() => {
    if (typeof Audio === "undefined") {
      setAudioMessage("Patient audio unavailable in this browser. Read Arun's reply here.");
      return;
    }
    const output = createPatientReportSpeaker(patientReportAudioUrl, url => {
      const audio = new Audio(url);
      audio.dataset.optoPatientReport = "true";
      document.body.append(audio);
      return audio;
    }, () => announcePatientAudio("report"));
    speaker.current = output;
    const hide = () => { if (document.visibilityState === "hidden") output.stop(); };
    const otherAudio = (event: Event) => { if ((event as CustomEvent).detail === "voice") output.stop(); };
    document.addEventListener("visibilitychange", hide);
    window.addEventListener(PATIENT_AUDIO_START, otherAudio);
    return () => { output.stop(); speaker.current = null; document.removeEventListener("visibilitychange", hide); window.removeEventListener(PATIENT_AUDIO_START, otherAudio); };
  }, []);
  useEffect(() => {
    if (!speaker.current) return;
    setAudioMessage("");
    void speaker.current.update(active && document.visibilityState !== "hidden" ? key : "", text,
      () => setAudioMessage("Patient audio could not play. Check browser sound permissions; read Arun's reply here."));
  }, [active, key, text]);
  return audioMessage;
}
