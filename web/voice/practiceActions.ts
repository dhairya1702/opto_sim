import { MOTILITY_PATIENT_REPLY } from "../interaction/motility";

export const PRACTICE_LESSON_IDS = [
  "motility", "bruckner", "hirschberg", "krimsky", "cover-uncover", "alternate-cover",
  "worth", "stereopsis", "four-prism", "maddox", "thorington", "npc",
  "horizontal-distance", "vertical-distance", "horizontal-near", "facility",
  "push-up", "minus-lens", "relative", "accommodative-facility",
] as const;

export type PracticeLessonId = typeof PRACTICE_LESSON_IDS[number];

export type PracticeVoiceAction = {
  id: string;
  phrases: string[];
  /** Accessible button fragments. Clicking the existing control preserves its gate. */
  controls: string[];
  acknowledgement: string;
};

const action = (id: string, phrases: string[], controls: string[], acknowledgement: string): PracticeVoiceAction =>
  ({ id, phrases, controls, acknowledgement });
const fixateLight = action("fixate-light", ["look at the light", "fixate the light"], ["look at the light", "fixation"], "Okay, I am looking at the light.");
const fixateTarget = action("fixate-target", ["look at the target", "fixate the target"], ["give fixation", "look at this target", "look at the target", "establish fixation", "fixate isolated", "fixation"], "Okay, I am looking at the target.");
const followTarget = action("follow-target", ["follow the target", "follow the light"], ["following instruction", "follow this target", "follow light", "start following"], "Okay, I will follow it with my eyes.");
const reportSymptoms = action("report-symptoms", ["any symptoms", "any double vision", "any pain", "any discomfort"], ["ask diplopia", "ask symptoms", "symptoms"], "I will tell you if I notice double vision, pain, or discomfort.");
const reportPercept = action("request-report", ["what do you see", "tell me what you see", "report now"], ["ask count", "present page", "ask number", "patient report", "mark patient endpoint", "mark sustained blur", "capture coincidence"], "I can report what I see now that the examination setup is ready.");
const reportClear = action("report-clear", ["is it clear", "can you clear it"], ["clear / flip", "clear + single", "confirm clear baseline"], "It is clear and single now.");
const closeRightEye = action("examiner-close-right-eye", ["close my right eye", "use my left eye", "left examiner eye"], ["close right eye · left view"], "Left examiner-eye view active.");
const closeLeftEye = action("examiner-close-left-eye", ["close my left eye", "use my right eye", "right examiner eye"], ["close left eye · right view"], "Right examiner-eye view active.");
const openBothEyes = action("examiner-open-both-eyes", ["open both eyes", "opening both eyes", "use both eyes", "binocular view"], ["open both eyes"], "Binocular examiner view restored.");

export const PRACTICE_VOICE_ACTIONS: Record<PracticeLessonId, readonly PracticeVoiceAction[]> = {
  motility: [followTarget, reportSymptoms],
  bruckner: [fixateLight],
  hirschberg: [fixateLight],
  krimsky: [fixateLight, closeRightEye, closeLeftEye, openBothEyes],
  "cover-uncover": [fixateTarget],
  "alternate-cover": [fixateTarget],
  worth: [fixateTarget, reportPercept],
  stereopsis: [fixateTarget, reportPercept],
  "four-prism": [fixateTarget],
  maddox: [fixateTarget, reportPercept],
  thorington: [fixateTarget, reportPercept],
  npc: [fixateTarget, reportPercept],
  "horizontal-distance": [fixateTarget, reportPercept],
  "vertical-distance": [fixateTarget, reportPercept],
  "horizontal-near": [fixateTarget, reportPercept],
  facility: [fixateTarget, reportClear],
  "push-up": [fixateTarget, reportPercept],
  "minus-lens": [fixateTarget, reportPercept],
  relative: [fixateTarget, reportPercept],
  "accommodative-facility": [fixateTarget, reportClear],
};

const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const usableButton = (button: HTMLButtonElement) => !button.disabled && button.getAttribute("aria-disabled") !== "true" && button.offsetParent !== null;

export function enabledPracticeVoiceActions(lessonId: PracticeLessonId, root: ParentNode = document): string[] {
  const buttons = [...root.querySelectorAll<HTMLButtonElement>("button")].filter(usableButton);
  return PRACTICE_VOICE_ACTIONS[lessonId]
    .filter((candidate) => candidate.controls.some((fragment) => buttons.some((button) => normalized(button.innerText || button.getAttribute("aria-label") || "").includes(normalized(fragment)))))
    .map((candidate) => candidate.id);
}

export async function invokePracticeVoiceAction(lessonId: PracticeLessonId, actionId: string, root: ParentNode = document) {
  const candidate = PRACTICE_VOICE_ACTIONS[lessonId].find((item) => item.id === actionId);
  if (!candidate) return { accepted: false, spokenText: "That instruction is not available in this lesson.", errorCode: "ACTION_NOT_ALLOWED" };
  const buttons = [...root.querySelectorAll<HTMLButtonElement>("button")].filter(usableButton);
  const control = buttons.find((button) => candidate.controls.some((fragment) => normalized(button.innerText || button.getAttribute("aria-label") || "").includes(normalized(fragment))));
  if (!control) return { accepted: false, spokenText: "Please complete the current setup before asking for that response.", errorCode: "TECHNIQUE_GATE" };
  control.click();
  if (lessonId === "motility" && actionId === "report-symptoms") {
    return { accepted: true, spokenText: MOTILITY_PATIENT_REPLY, cacheKey: "practice:motility:report-symptoms" };
  }
  if (actionId === "request-report" || actionId === "report-clear" || actionId === "report-symptoms") {
    await new Promise<void>(resolve => typeof requestAnimationFrame === "function" ? requestAnimationFrame(() => requestAnimationFrame(() => resolve())) : setTimeout(resolve, 0));
    const report = root.querySelector<HTMLElement>("[data-voice-report]")?.innerText.trim()
      || root.querySelector<HTMLElement>("[data-voice-status]")?.innerText.trim();
    if (report) return { accepted: true, spokenText: report.slice(0, 1000) };
  }
  return { accepted: true, spokenText: candidate.acknowledgement, cacheKey: `practice:ack:${actionId}` };
}
