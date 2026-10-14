import type { PracticeCoverKind } from "./practiceCover";

export type AlignmentGuidedStep = {
  id: string;
  index: number;
  title: string;
  lines: readonly string[];
  complete: boolean;
};

export const KRIMSKY_GUIDED_STEP_COUNT = 7;
export type KrimskyGuidedState = {
  penlightHeld: boolean;
  fixation: boolean;
  examinerEyeSelected: boolean;
  prismHeld: boolean;
  prismAligned: boolean;
  neutral: boolean;
  comparisonCaptured: boolean;
  powerEntered: boolean;
  recorded: boolean;
};

/** Derives Krimsky coaching from the existing physical comparison state. */
export function krimskyGuidedStep(state: KrimskyGuidedState): AlignmentGuidedStep {
  if (state.recorded) return {
    id: "record", index: 6, title: "Technique complete",
    lines: ["Your neutralising prism is recorded.", "Review the feedback or try the next finding."], complete: true,
  };
  if (state.comparisonCaptured) return {
    id: "record", index: 6, title: "Record the prism power",
    lines: state.powerEntered
      ? ["The captured power is entered.", "Press SUBMIT / CHECK on the findings board."]
      : ["Enter the power from the captured prism cell.", "Then submit your independent reading."],
    complete: false,
  };
  if (!state.penlightHeld) return {
    id: "tool", index: 0, title: "Pick up the penlight",
    lines: ["Find it on the left instrument trolley.", "Squeeze the side grip once beside its handle."], complete: false,
  };
  if (!state.fixation) return {
    id: "instruct", index: 1, title: "Instruct Arun",
    lines: ["Ask him to look directly at the light.", "Keep fixation steady throughout the comparison."], complete: false,
  };
  if (!state.examinerEyeSelected) return {
    id: "view", index: 2, title: "Select the examiner-eye view",
    lines: ["Say which eye you are closing or use the control.", "Use one monocular view for the full comparison."], complete: false,
  };
  if (!state.prismHeld) return {
    id: "prism", index: 3, title: "Observe, then pick up the prism bar",
    lines: ["Observe the initial corneal reflex positions with no prism before either eye.", "Then pick up the prism bar with your free hand."], complete: false,
  };
  if (!state.prismAligned) return {
    id: "neutralise", index: 4, title: "Align the selected prism cell",
    lines: ["Move the gold-ringed cell over the required eye.", "The ring turns green and pulses when alignment is accepted."], complete: false,
  };
  if (!state.neutral) return {
    id: "neutralise", index: 4, title: "Set the prism direction and power",
    lines: ["Place the prism before the required eye. Thumbstick left/right selects BI/BO.", "Use thumbstick up/down to change power until the reflex positions match."], complete: false,
  };
  return {
    id: "capture", index: 5, title: "Capture the comparison",
    lines: ["The reflexes now match.", "Press the prism-hand trigger to capture this endpoint."], complete: false,
  };
}

export const COVER_UNCOVER_GUIDED_STEP_COUNT = 5;
export const ALTERNATE_COVER_GUIDED_STEP_COUNT = 7;
export type CoverGuidedState = {
  kind: PracticeCoverKind;
  occluderHeld: boolean;
  fixation: boolean;
  sequenceIndex: number;
  sequenceTotal: number;
  /** Label of the next ordered occluder position, shown so the learner knows what to do. */
  nextPositionLabel?: string;
  /** Interruption/restart feedback from the sequence, if any. */
  sequenceMessage?: string;
  observed: boolean;
  prismAligned: boolean;
  prismConfigured: boolean;
  neutralized: boolean;
  observationComplete: boolean;
  recorded: boolean;
};

/** Derives both cover-test coaches from their shared ordered-sequence state. */
export function coverGuidedStep(state: CoverGuidedState): AlignmentGuidedStep {
  const alternate = state.kind === "alternate-cover";
  const recordIndex = alternate ? 6 : 4;
  if (state.recorded) return {
    id: "record", index: recordIndex, title: "Technique complete",
    lines: ["Your cover-test finding is recorded.", "Review the feedback or try the next finding."], complete: true,
  };
  if (alternate && state.neutralized && state.observationComplete) return {
    id: "record", index: 6, title: "Record the finding",
    lines: ["Movement, deviation, and endpoint are ready.", "Press SUBMIT / CHECK on the findings board."], complete: false,
  };
  if (!alternate && state.observed && state.observationComplete) return {
    id: "record", index: 4, title: "Record the movement timing",
    lines: ["Your movement classification is selected.", "Press SUBMIT / CHECK on the findings board."], complete: false,
  };
  if (alternate && state.neutralized) return {
    id: "interpret", index: 5, title: "Classify the movement",
    lines: ["Choose how OD moved each time it was uncovered.", "Then select the deviation; vertical eyes move oppositely."], complete: false,
  };
  if (!alternate && state.observed) return {
    id: "interpret", index: 3, title: "Classify the timing",
    lines: ["Choose the pattern you actually observed.", "Use cover versus uncover timing to classify it."], complete: false,
  };
  // Once alternate-cover observation is complete, the occluder may be put down
  // to free a hand for the prism. Do not send the learner back to pickup.
  if (alternate && state.observed && (!state.prismAligned || !state.prismConfigured)) return {
    id: "prism", index: 3, title: "Set and align the prism",
    lines: ["Hold the selected prism cell before one eye.", "Apex toward the deviation, e.g. base up before a hypo eye."], complete: false,
  };
  if (alternate && state.observed) return {
    id: "neutralise", index: 4, title: "Repeat to neutralise",
    lines: ["Start REPEAT WITH PRISM.", "Repeat the alternating sequence until movement stops."], complete: false,
  };
  if (!state.occluderHeld) return {
    id: "tool", index: 0, title: "Pick up the occluder",
    lines: ["Find the cover paddle on the trolley.", "Squeeze the side grip once beside its handle."], complete: false,
  };
  if (!state.fixation) return {
    id: "fixation", index: 1, title: "Establish fixation",
    lines: ["Ask Arun to keep looking at the target.", "Use LOOK AT THE TARGET before covering either eye."], complete: false,
  };
  if (!state.observed) {
    const done = Math.min(state.sequenceIndex, state.sequenceTotal);
    const next = state.nextPositionLabel;
    return {
      id: "sequence", index: 2, title: next ? `Move ${done + 1} of ${state.sequenceTotal}: ${next}` : alternate ? "Alternate without uncovering" : "Complete cover–uncover",
      lines: [
        state.sequenceMessage || (alternate
          ? "Paddle before the named eye; shift directly between eyes."
          : "Paddle before the named eye; move it fully aside to uncover."),
        `${done}/${state.sequenceTotal} positions complete · hold each position briefly.`,
      ], complete: false,
    };
  }
  return { id: "sequence", index: 2, title: "Complete the sequence", lines: ["Continue the ordered cover positions."], complete: false };
}
