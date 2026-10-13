export const TEST_VOICE_INSTRUCTIONS = ["look-straight", "fixate-target", "follow-target", "report-symptoms", "read-chart"] as const;
export type TestVoiceInstruction = typeof TEST_VOICE_INSTRUCTIONS[number];

export const TEST_VOICE_INSTRUCTION_CONTROLS: Record<TestVoiceInstruction, readonly string[]> = {
  "look-straight": ["look at a distant target", "look at the distant target"],
  "fixate-target": ["fixate at distance", "fixate at near", "fixate the target"],
  "follow-target": ["follow the target"],
  "report-symptoms": ["ask about double vision", "report double vision"],
  "read-chart": ["read the chart", "read the near card"],
};

const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const visibleEnabledButton = (button: HTMLButtonElement) => !button.disabled && button.getAttribute("aria-disabled") !== "true" && button.offsetParent !== null;

export function invokeTestVoiceInstruction(instructionId: string) {
  if (!TEST_VOICE_INSTRUCTIONS.includes(instructionId as TestVoiceInstruction))
    return { accepted: false, spokenText: "That patient instruction is not available.", errorCode: "ACTION_NOT_ALLOWED" };
  const instruction = instructionId as TestVoiceInstruction;
  const event = new CustomEvent("opto:voice-instruction", { detail: { instructionId }, cancelable: true });
  const handledInXR = !window.dispatchEvent(event);
  if (!handledInXR) {
    const fragments = TEST_VOICE_INSTRUCTION_CONTROLS[instruction];
    const control = [...document.querySelectorAll<HTMLButtonElement>("dialog[open] button")]
      .filter(visibleEnabledButton)
      .find(button => fragments.some(fragment => normalized(button.innerText || button.getAttribute("aria-label") || "").includes(normalized(fragment))));
    control?.click();
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
