import type { VoiceCommandResult } from "./contracts";

export const TEST_VOICE_INSTRUCTIONS = ["look-straight", "fixate-target", "follow-target", "report-symptoms", "read-chart"] as const;
export type TestVoiceInstruction = typeof TEST_VOICE_INSTRUCTIONS[number];
export const TEST_VOICE_ENCOUNTER_ACTIONS = ["dim-room", "restore-room"] as const;
export type TestVoiceEncounterAction = typeof TEST_VOICE_ENCOUNTER_ACTIONS[number];

export type TestVoiceInstructionDetail = {
  instructionId: TestVoiceInstruction;
  transcript?: string;
  /** The active scene may replace the generic acknowledgement with a grounded response. */
  result?: VoiceCommandResult;
};

/** Shared only within this browser application; no instruction state leaves the active encounter. */
export const testVoiceInstructionTarget = new EventTarget();

export type TestVoiceEncounterActionDetail = {
  actionId: TestVoiceEncounterAction;
  transcript?: string;
  result?: VoiceCommandResult;
};

export const testVoiceEncounterActionTarget = new EventTarget();

export const TEST_VOICE_INSTRUCTION_CONTROLS: Record<TestVoiceInstruction, readonly string[]> = {
  "look-straight": ["look at a distant target", "look at the distant target"],
  "fixate-target": ["fixate at distance", "fixate at near", "fixate the target"],
  "follow-target": ["follow the target"],
  "report-symptoms": ["ask about double vision", "report double vision"],
  "read-chart": ["read the chart", "read the near card"],
};

const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const visibleEnabledButton = (button: HTMLButtonElement) => !button.disabled && button.getAttribute("aria-disabled") !== "true" && button.offsetParent !== null;

export function invokeTestVoiceInstruction(instructionId: string, transcript?: string): VoiceCommandResult {
  if (!TEST_VOICE_INSTRUCTIONS.includes(instructionId as TestVoiceInstruction))
    return { accepted: false, spokenText: "That patient instruction is not available.", errorCode: "ACTION_NOT_ALLOWED" };
  const instruction = instructionId as TestVoiceInstruction;
  const detail: TestVoiceInstructionDetail = { instructionId: instruction, transcript };
  const event = new CustomEvent<TestVoiceInstructionDetail>("opto:voice-instruction", { detail, cancelable: true });
  const handledInXR = !testVoiceInstructionTarget.dispatchEvent(event);
  if (handledInXR && detail.result) return detail.result;
  if (!handledInXR) {
    const fragments = TEST_VOICE_INSTRUCTION_CONTROLS[instruction];
    const control = [...document.querySelectorAll<HTMLButtonElement>("dialog[open] button")]
      .filter(visibleEnabledButton)
      .find(button => fragments.some(fragment => normalized(button.innerText || button.getAttribute("aria-label") || "").includes(normalized(fragment))));
    if (!control) return {
      accepted: true,
      spokenText: "I'm not sure which part of the examination you want me to do. Could you show me or ask another way?",
      errorCode: "ACTION_NOT_AVAILABLE_HERE",
    };
    control.click();
  }
  const spokenText = instructionId === "read-chart" ? "Okay, I will read what I can."
    : instructionId === "follow-target" ? "Okay, I will follow the target with my eyes."
    : instructionId === "report-symptoms" ? "I will tell you if I notice double vision, pain, or discomfort."
      : "Okay, I am looking where you asked.";
  const cacheKey = instructionId === "read-chart" ? "instruction:read-chart"
    : instructionId === "follow-target" ? "instruction:follow-target"
    : instructionId === "report-symptoms" ? "instruction:report-symptoms"
      : "instruction:fixate-target";
  return { accepted: true, spokenText, cacheKey };
}

export function invokeTestVoiceEncounterAction(actionId: string, transcript?: string): VoiceCommandResult {
  if (!TEST_VOICE_ENCOUNTER_ACTIONS.includes(actionId as TestVoiceEncounterAction))
    return { accepted: false, spokenText: "That room action is not available.", errorCode: "ACTION_NOT_ALLOWED" };
  const action = actionId as TestVoiceEncounterAction;
  const detail: TestVoiceEncounterActionDetail = { actionId: action, transcript };
  const event = new CustomEvent<TestVoiceEncounterActionDetail>("opto:voice-encounter-action", { detail, cancelable: true });
  const handledInXR = !testVoiceEncounterActionTarget.dispatchEvent(event);
  if (handledInXR && detail.result) return detail.result;
  return {
    accepted: true,
    spokenText: "That room control is not available in this examination. Use the visible illumination control instead.",
    errorCode: "ACTION_NOT_AVAILABLE_HERE",
  };
}

/** Explicit requests must not be answered with a different chart's finding. */
export function requestedChart(transcript = ""): "near" | "pinhole" | "distance" | undefined {
  if (/\bpinhole\b|\bpin hole\b/i.test(transcript)) return "pinhole";
  if (/\bnear\b|\breading card\b/i.test(transcript)) return "near";
  if (/\bdistance\b|\bfar\b/i.test(transcript)) return "distance";
  return undefined;
}
