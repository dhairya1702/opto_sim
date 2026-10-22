import practiceVoice from "../../shared/practiceVoice.json";
import type { VoiceCommandResult } from "./contracts";

export type PracticeVoiceControl = { voiceIds?: string[]; disabled?: boolean; run: () => void };
export type PracticeVoiceSnapshot = { actions: readonly PracticeVoiceControl[]; voiceReport?: string };
type Registration = { lessonId: string; snapshot: PracticeVoiceSnapshot; listeners: Set<() => void> };
let current: Registration | undefined;
const unavailable = (): VoiceCommandResult => ({ accepted: false, spokenText: "Please complete the current setup before asking for that response.", errorCode: "TECHNIQUE_GATE" });

/** A mounted procedure owns this registration, independently of its visible panels. */
export function registerPracticeVoice(lessonId: string, snapshot: PracticeVoiceSnapshot) {
  const registration: Registration = { lessonId, snapshot, listeners: new Set() };
  const previous = current;
  current = registration;
  previous?.listeners.forEach(notify => notify());
  return {
    update(next: PracticeVoiceSnapshot) { registration.snapshot = next; registration.listeners.forEach(notify => notify()); },
    dispose() { if (current === registration) current = undefined; registration.listeners.forEach(notify => notify()); },
  };
}

export async function invokeRegisteredPracticeVoice(lessonId: string, actionId: string): Promise<VoiceCommandResult> {
  const definition = (practiceVoice as Record<string, { id: string; acknowledgement: string }[]>)[lessonId]?.find(action => action.id === actionId);
  const registration = current;
  if (!definition || !registration || registration.lessonId !== lessonId) return unavailable();
  const reportRequest = ["request-report", "report-clear", "report-symptoms"].includes(actionId);
  // Reports are reads. Repeating a question cannot flip lenses, restart a run or capture twice.
  if (reportRequest && registration.snapshot.voiceReport)
    return { accepted: true, spokenText: registration.snapshot.voiceReport.slice(0, 1000) };
  if (actionId === "report-clear") return unavailable();
  const control = registration.snapshot.actions.find(action => action.voiceIds?.includes(actionId));
  if (!control && (actionId === "target-on" || actionId === "target-off")) {
    const opposite = actionId === "target-on" ? "target-off" : "target-on";
    if (registration.snapshot.actions.some(action => action.voiceIds?.includes(opposite) && !action.disabled))
      return { accepted: true, spokenText: definition.acknowledgement, suppressAudio: true };
  }
  if (!control || control.disabled) return unavailable();
  if (!reportRequest) {
    control.run();
    return { accepted: true, spokenText: definition.acknowledgement, cacheKey: `practice:ack:${actionId}`,
      suppressAudio: actionId.startsWith("examiner-") || actionId.startsWith("target-") };
  }
  // Observe engine publications, including sustained-capture completion. No DOM polling.
  return new Promise(resolve => {
    const finish = (result: VoiceCommandResult) => { clearTimeout(timer); registration.listeners.delete(check); resolve(result); };
    const check = () => {
      if (current !== registration) finish(unavailable());
      else if (registration.snapshot.voiceReport) finish({ accepted: true, spokenText: registration.snapshot.voiceReport.slice(0, 1000) });
    };
    const timer = setTimeout(() => finish(unavailable()), 1000);
    registration.listeners.add(check);
    try { control.run(); check(); } catch { finish(unavailable()); }
  });
}
