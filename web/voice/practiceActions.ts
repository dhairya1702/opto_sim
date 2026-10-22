import practiceVoice from "../../shared/practiceVoice.json";
import { invokeRegisteredPracticeVoice } from "./practiceRegistry";

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
  acknowledgement: string;
};

export const PRACTICE_VOICE_ACTIONS: Record<PracticeLessonId, readonly PracticeVoiceAction[]> = practiceVoice;

/** The mounted procedure, rather than rendered controls, owns every voice action. */
export const invokePracticeVoiceAction = invokeRegisteredPracticeVoice;
