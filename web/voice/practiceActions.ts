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
const fixateTarget = action("fixate-target", ["look at the target", "fixate the target", "keep looking at the dots"], ["give fixation", "look at this target", "look at the target", "establish fixation", "fixate isolated", "fixation"], "Okay, I am looking at the target.");
const fixateStereo = action("fixate-target", ["look at the circles", "keep looking at the booklet", "fixate the circles", "keep looking at the circles"], ["look at the circles", "looking at the circles"], "Okay, I’m looking at the circles.");
const fixateFourPrism = action("fixate-target", ["look at the isolated letter", "keep looking at the letter", "keep the letter single", "look at the letter", "fixate the letter"], ["look at the isolated letter"], "Okay, I’m looking at the letter and keeping it single.");
const followTarget = action("follow-target", ["follow the target", "follow the light"], ["following instruction", "follow this target", "follow light", "start following"], "Okay, I will follow it with my eyes.");
const reportSymptoms = action("report-symptoms", ["any symptoms", "any double vision", "any pain", "any discomfort"], ["ask diplopia", "ask symptoms", "symptoms"], "I will tell you if I notice double vision, pain, or discomfort.");
const reportPercept = action("request-report", ["what do you see", "tell me what you see", "how many dots", "what colours do you see", "tell me where the dots are", "report now"], ["ask count", "present page", "ask number", "patient report", "mark patient endpoint", "mark sustained blur", "capture coincidence"], "I can report what I see now that the examination setup is ready.");
const npcInstruction = action("fixate-target", ["look at the target", "fixate the target", "keep this clear and single tell me when it becomes double", "tell me when it becomes double", "keep the target clear and single"], ["keep this clear and single"], "Okay, I am looking at the target.");
const reportStereo = action("request-report", ["which circle appears raised", "which circle is raised", "which circle is closer", "does one circle stand out", "what do you see", "tell me what you see"], ["ask which circle is raised"], "I can report what I see now that the examination setup is ready.");
const targetOn = action("target-on", ["turn on the target", "switch the worth lights on", "switch the worth target on"], ["switch target on"], "Worth target switched on.");
const targetOff = action("target-off", ["turn off the target", "switch the worth lights off", "switch the worth target off"], ["switch target off"], "Worth target switched off.");
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
  worth: [targetOn, targetOff, fixateTarget, reportPercept],
  stereopsis: [fixateStereo, reportStereo],
  "four-prism": [fixateFourPrism],
  maddox: [fixateTarget, reportPercept],
  thorington: [fixateTarget, reportPercept],
  npc: [npcInstruction, reportPercept],
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
  const existingReport = root.querySelector?.<HTMLElement>("[data-voice-report]")?.innerText.trim();
  // A repeat question reads the immutable engine-owned capture. It must not
  // click the reporting control and start another procedure.
  if ((lessonId === "thorington" || lessonId === "npc") && actionId === "request-report" && existingReport)
    return { accepted: true, spokenText: existingReport.slice(0, 1000) };
  const buttons = [...root.querySelectorAll<HTMLButtonElement>("button")].filter(usableButton);
  const control = buttons.find((button) => candidate.controls.some((fragment) => normalized(button.innerText || button.getAttribute("aria-label") || "").includes(normalized(fragment))));
  if (!control) {
    const status = root.querySelector?.<HTMLElement>("[data-voice-status]")?.innerText.trim();
    return { accepted: false, spokenText: lessonId === "four-prism" && actionId === "fixate-target" && status
      ? `Before fixation: ${status}`
      : lessonId === "stereopsis" && actionId === "request-report" && status
      ? `Before asking: ${status}`
      : "Please complete the current setup before asking for that response.", errorCode: "TECHNIQUE_GATE" };
  }
  control.click();
  if (actionId === "target-on" || actionId === "target-off")
    return { accepted: true, spokenText: candidate.acknowledgement, suppressAudio: true };
  if (actionId === "request-report" || actionId === "report-clear" || actionId === "report-symptoms") {
    if (lessonId === "thorington" && actionId === "request-report") {
      // The 400 ms bound only waits for the procedure engine's 250 ms stable
      // capture. This router never manufactures or mutates report evidence.
      const deadline = Date.now() + 400;
      while (!root.querySelector?.<HTMLElement>("[data-voice-report]")?.innerText.trim() && Date.now() < deadline)
        await new Promise<void>(resolve => setTimeout(resolve, 20));
    } else {
      await new Promise<void>(resolve => typeof requestAnimationFrame === "function" ? requestAnimationFrame(() => requestAnimationFrame(() => resolve())) : setTimeout(resolve, 0));
    }
    const report = root.querySelector<HTMLElement>("[data-voice-report]")?.innerText.trim()
      || (actionId === "request-report" ? "" : root.querySelector<HTMLElement>("[data-voice-status]")?.innerText.trim());
    if (report) return {
      accepted: true,
      spokenText: report.slice(0, 1000),
      ...(lessonId === "motility" && actionId === "report-symptoms" && report === MOTILITY_PATIENT_REPLY
        ? { cacheKey: "practice:motility:report-symptoms" } : {}),
    };
    if (lessonId === "motility" && actionId === "report-symptoms") {
      return { accepted: true, spokenText: MOTILITY_PATIENT_REPLY, cacheKey: "practice:motility:report-symptoms" };
    }
    if (actionId === "request-report") {
      const status = root.querySelector<HTMLElement>("[data-voice-status]")?.innerText.trim();
      return { accepted: false, spokenText: lessonId === "stereopsis" && status
        ? `Before asking: ${status}`
        : "Complete the fitting, target, filter checks, and fixation before asking for the report.", errorCode: "TECHNIQUE_GATE" };
    }
  }
  if (actionId === "examiner-close-right-eye" || actionId === "examiner-close-left-eye" || actionId === "examiner-open-both-eyes") {
    return { accepted: true, spokenText: candidate.acknowledgement, suppressAudio: true };
  }
  return lessonId === "stereopsis" || lessonId === "four-prism"
    ? { accepted: true, spokenText: candidate.acknowledgement }
    : { accepted: true, spokenText: candidate.acknowledgement, cacheKey: `practice:ack:${actionId}` };
}
