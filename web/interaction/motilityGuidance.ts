export type MotilityGuidedStepId = "tool" | "instruct" | "primary" | "pattern" | "symptoms" | "record";

export type MotilityGuidedState = {
  toolHeld: boolean;
  following: boolean;
  seen: readonly string[];
  symptomsAsked: boolean;
  observationChosen: boolean;
  recorded: boolean;
};

export type MotilityGuidedStep = {
  id: MotilityGuidedStepId;
  index: number;
  title: string;
  lines: readonly string[];
  complete: boolean;
};

export const MOTILITY_GUIDED_STEP_COUNT = 6;

/** Derives the visible coach step from the same physical/procedure state used by the lesson. */
export function motilityGuidedStep(state: MotilityGuidedState): MotilityGuidedStep {
  const seenCount = state.seen.length;
  if (state.recorded) return {
    id: "record", index: 5, title: "Technique complete",
    lines: ["Your observation is recorded.", "Review the feedback or try a new finding."], complete: true,
  };
  if (!state.toolHeld && seenCount < 9) return {
    id: "tool", index: 0, title: "Pick up the penlight",
    lines: ["Find it on the left instrument trolley.", "Squeeze the side grip once beside its handle."], complete: false,
  };
  if (!state.following) return {
    id: "instruct", index: 1, title: "Instruct Arun",
    lines: ["Say: “Follow my light with your eyes.”", "Ask him to keep his head still."], complete: false,
  };
  if (!state.seen.includes("centre")) return {
    id: "primary", index: 2, title: "Establish primary gaze",
    lines: ["Hold the trigger to switch the penlight on.", "Hold at the highlighted starting point 30–40 cm away."], complete: false,
  };
  if (seenCount < 9) return {
    id: "pattern", index: 3, title: "Complete the H-pattern",
    lines: [`${seenCount}/9 gaze positions checked.`, "Follow the highlighted H route; hold at each point."], complete: false,
  };
  if (!state.symptomsAsked) return {
    id: "symptoms", index: 4, title: "Ask about symptoms",
    lines: ["Ask about double vision, pain or discomfort", "before you record the movement observation."], complete: false,
  };
  return {
    id: "record", index: 5, title: "Record your observation",
    lines: state.observationChosen
      ? ["Your observation is selected.", "Press SUBMIT / CHECK on the findings board."]
      : ["Choose the movement you actually observed", "on the findings board, then submit it."],
    complete: false,
  };
}
