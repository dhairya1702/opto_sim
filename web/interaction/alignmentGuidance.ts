import { ALTERNATE_COVER_ATTEMPTS_PER_PRISM, alternateCoverAttemptNumber, type PracticeCoverKind } from "./practiceCover";

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

export const COVER_UNCOVER_GUIDED_STEP_COUNT = 13;
export const ALTERNATE_COVER_GUIDED_STEP_COUNT = 16;
export type CoverGuidedState = {
  kind: PracticeCoverKind;
  occluderHeld: boolean;
  targetHeld?: boolean;
  targetPowered?: boolean;
  targetEndpoint?: "distance" | "near" | null;
  targetReady?: boolean;
  distanceRecorded?: boolean;
  nearRecorded?: boolean;
  fixation: boolean;
  sequenceIndex: number;
  sequenceTotal: number;
  /** Label of the next ordered occluder position, shown so the learner knows what to do. */
  nextPositionLabel?: string;
  /** Interruption/restart feedback from the sequence, if any. */
  sequenceMessage?: string;
  observed: boolean;
  prismHeld: boolean;
  prismAligned: boolean;
  prismConfigured: boolean;
  prismTrialActive?: boolean;
  prismAdjustmentRequired?: boolean;
  prismTeachingCue?: string;
  recommendedPrismBase?: string;
  neutralized: boolean;
  observationComplete: boolean;
  recorded: boolean;
};

/** Derives both cover-test coaches from their shared ordered-sequence state. */
export function coverGuidedStep(state: CoverGuidedState): AlignmentGuidedStep {
  const alternate = state.kind === "alternate-cover";
  if (!alternate) {
    const distanceRecorded = Boolean(state.distanceRecorded);
    const nearRecorded = Boolean(state.nearRecorded);
    const endpoint = distanceRecorded ? "near" : "distance";
    if (state.recorded || nearRecorded) return {
      id: "record-near", index: 12, title: "Technique complete",
      lines: ["Distance and near cover–uncover findings are recorded.", "Review the feedback or try the next finding."], complete: true,
    };
    if (!distanceRecorded && state.targetEndpoint !== "distance") return state.targetHeld ? {
      id: "position-distance", index: 1, title: "Place the distance target",
      lines: ["Carry the target to the dock behind Arun.", "Release it into the highlighted socket for the simulated 6 m mirror path."], complete: false,
    } : {
      id: "target-distance", index: 0, title: "Pick up the target",
      lines: ["Find the target on the extended instrument kit.", "Squeeze the side grip once beside its handle."], complete: false,
    };
    if (distanceRecorded && state.targetEndpoint !== "near") return {
      id: "position-near", index: 8, title: "Move the target to near",
      lines: state.targetHeld
        ? ["Carry the same illuminated target to the near stand.", "Release it into the automatic 40 cm socket."]
        : ["Pick up the same illuminated target from the distance dock.", "Release it on the 40 cm near stand; the socket turns it toward Arun."], complete: false,
    };
    if (!state.targetPowered) return {
      id: distanceRecorded ? "power-near" : "power-distance", index: distanceRecorded ? 9 : 2,
      title: "Turn on the target",
      lines: ["Use your free hand to press the target's POWER switch.", distanceRecorded ? "Confirm the near target is illuminated." : "Confirm the target appears in the simulated 6 m mirror."], complete: false,
    };
    if (!state.targetReady) return {
      id: distanceRecorded ? "position-near" : "position-distance", index: distanceRecorded ? 8 : 2,
      title: distanceRecorded ? "Align the near target" : "Check the distance target",
      lines: [distanceRecorded ? "Seat the target fully in the 40 cm socket." : "Seat the target fully in the distance dock.", "Confirm the illuminated target is presented to Arun."], complete: false,
    };
    if (!state.fixation) return {
      id: distanceRecorded ? "fixation-near" : "fixation-distance", index: distanceRecorded ? 9 : 3,
      title: distanceRecorded ? "Re-establish near fixation" : "Establish distance fixation",
      lines: [distanceRecorded ? "Ask Arun to look at the near target." : "Ask Arun to keep looking at the mirrored distance target.", "Use LOOK AT THE TARGET before covering either eye."], complete: false,
    };
    if (!state.occluderHeld) return {
      id: distanceRecorded ? "tool-near" : "tool-distance", index: distanceRecorded ? 10 : 4,
      title: "Pick up the occluder", lines: ["Find the cover paddle on the trolley.", "Squeeze the side grip once beside its handle."], complete: false,
    };
    if (!state.observed) {
      const done = Math.min(state.sequenceIndex, state.sequenceTotal);
      const next = state.nextPositionLabel;
      return {
        id: distanceRecorded ? "sequence-near" : "sequence-distance", index: distanceRecorded ? 10 : 5,
        title: next ? `Move ${done + 1} of ${state.sequenceTotal}: ${next}` : `Complete ${endpoint} cover–uncover`,
        lines: [state.sequenceMessage || "Paddle before the named eye; move it fully aside to uncover.", `${done}/${state.sequenceTotal} positions complete · hold each position briefly.`], complete: false,
      };
    }
    if (!state.observationComplete) return {
      id: distanceRecorded ? "interpret-near" : "interpret-distance", index: distanceRecorded ? 11 : 6,
      title: `Classify the ${endpoint} timing`, lines: ["Choose the pattern you actually observed.", "Use cover versus uncover timing to classify it."], complete: false,
    };
    return {
      id: distanceRecorded ? "record-near" : "record-distance", index: distanceRecorded ? 12 : 7,
      title: `Record the ${endpoint} finding`,
      lines: distanceRecorded ? ["Press SUBMIT / CHECK to record the near finding and finish."]
        : ["Press SUBMIT / CHECK to freeze the distance finding.", "Then move the same target to the 40 cm stand."], complete: false,
    };
  }
  const distanceRecorded = Boolean(state.distanceRecorded);
  const nearRecorded = Boolean(state.nearRecorded);
  const endpoint = distanceRecorded ? "near" : "distance";
  if (state.recorded || nearRecorded) return {
    id: "record-near", index: 15, title: "Technique complete",
    lines: ["Distance and near prism endpoints are recorded.", "Review the feedback or try the next finding."], complete: true,
  };
  if (!distanceRecorded && state.targetEndpoint !== "distance") return state.targetHeld ? {
    id: "position-distance", index: 1, title: "Place the distance target",
    lines: ["Carry the target to the dock behind Arun.", "Release it into the highlighted socket for the simulated 6 m mirror path."], complete: false,
  } : {
    id: "target-distance", index: 0, title: "Pick up the target",
    lines: ["Find the target on the extended instrument kit.", "Squeeze the side grip once beside its handle."], complete: false,
  };
  if (distanceRecorded && state.targetEndpoint !== "near") return {
    id: "position-near", index: 10, title: "Move the target to near",
    lines: state.targetHeld
      ? ["Carry the same illuminated target to the near stand.", "Release it into the automatic 40 cm socket."]
      : ["Put down an instrument, then pick up the distance target.", "Release it on the 40 cm near stand; the socket turns it toward Arun."], complete: false,
  };
  if (!state.targetPowered) return {
    id: distanceRecorded ? "power-near" : "power-distance", index: distanceRecorded ? 11 : 2,
    title: "Turn on the target",
    lines: ["Use your free hand to press the target's POWER switch.", distanceRecorded ? "Confirm the near target is illuminated." : "Confirm the target appears in the simulated 6 m mirror."], complete: false,
  };
  if (!state.targetReady) return {
    id: distanceRecorded ? "position-near" : "position-distance", index: distanceRecorded ? 10 : 2,
    title: distanceRecorded ? "Align the near target" : "Check the distance target",
    lines: [distanceRecorded ? "Seat the target fully in the 40 cm socket." : "Seat the target fully in the distance dock.", "Confirm the illuminated target is presented to Arun."], complete: false,
  };
  if (!state.fixation) return {
    id: distanceRecorded ? "fixation-near" : "fixation-distance", index: distanceRecorded ? 11 : 3,
    title: distanceRecorded ? "Re-establish near fixation" : "Establish distance fixation",
    lines: [distanceRecorded ? "Ask Arun to look at the near target." : "Ask Arun to keep looking at the mirrored distance target.", "Use LOOK AT THE TARGET before alternating the cover."], complete: false,
  };
  if (!state.occluderHeld) return {
    id: distanceRecorded ? "tool-near" : "tool-distance", index: distanceRecorded ? 12 : 4,
    title: "Pick up the occluder", lines: ["Find the cover paddle on the trolley.", "Keep one hand available for the prism after the first sequence."], complete: false,
  };
  if (!state.observed) {
    const done = Math.min(state.sequenceIndex, state.sequenceTotal);
    const next = state.nextPositionLabel;
    return {
      id: distanceRecorded ? "sequence-near" : "sequence-distance", index: distanceRecorded ? 12 : 5,
      title: next ? `Move ${done + 1} of ${state.sequenceTotal}: ${next}` : `Complete ${endpoint} alternating cover`,
      lines: [state.sequenceMessage || "Shift the paddle directly between eyes so fusion stays broken.", `${done}/${state.sequenceTotal} positions complete · hold each position briefly.`], complete: false,
    };
  }
  if (!state.prismHeld) return {
    id: distanceRecorded ? "prism-near" : "prism-distance", index: distanceRecorded ? 13 : 6, title: "Pick up the prism bar",
    lines: [state.prismTeachingCue || "Keep the occluder in one hand and pick up the prism with the other.", "Keep the paddle in one hand and pick up the prism with the other."], complete: false,
  };
  if (!state.prismAligned) return {
    id: distanceRecorded ? "prism-near" : "prism-distance", index: distanceRecorded ? 13 : 6, title: "Place the prism",
    lines: ["Place the prism's working cell inside either eye placement ring.", "Keep the cover paddle in your other hand."], complete: false,
  };
  if (!state.prismConfigured) return {
    id: distanceRecorded ? "prism-near" : "prism-distance", index: distanceRecorded ? 13 : 6, title: "Choose prism base and power",
    lines: [state.recommendedPrismBase ? `Use ${state.recommendedPrismBase} for this movement.` : "Keep the prism aligned before the selected eye.", "Thumbstick left/right changes base; up/down changes power."], complete: false,
  };
  if (!state.neutralized) return {
    id: distanceRecorded ? "neutralise-near" : "neutralise-distance", index: distanceRecorded ? 13 : 7,
    title: state.prismAdjustmentRequired ? "Stop and adjust the prism"
      : `Attempt ${alternateCoverAttemptNumber(state.sequenceIndex)} of ${ALTERNATE_COVER_ATTEMPTS_PER_PRISM}`,
    lines: state.prismAdjustmentRequired
      ? [state.sequenceMessage || "Refixation remains.", "The paddle guide returns after you change the prism setting."]
      : state.prismTrialActive
        ? [state.nextPositionLabel ? `Move the paddle next: ${state.nextPositionLabel}.` : "Cover OD and OS once for this attempt.", "Complete two attempts at this power; the trial then stops automatically."]
        : [state.sequenceMessage || "Alignment starts the prism repeat automatically.", "Complete two attempts: cover OD and OS once in each attempt."], complete: false,
  };
  if (!state.observationComplete) return {
    id: distanceRecorded ? "interpret-near" : "interpret-distance", index: distanceRecorded ? 14 : 8, title: `Classify the ${endpoint} movement`,
    lines: ["Choose how OD moved each time it was uncovered.", "Then select the deviation; vertical eyes move oppositely."], complete: false,
  };
  return {
    id: distanceRecorded ? "record-near" : "record-distance", index: distanceRecorded ? 15 : 9, title: `Record the ${endpoint} prism endpoint`,
    lines: distanceRecorded ? ["Press SUBMIT / CHECK to freeze the near endpoint and finish."]
      : ["Press SUBMIT / CHECK to freeze the distance endpoint.", "Then move the same target to the 40 cm stand."], complete: false,
  };
}
