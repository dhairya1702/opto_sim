export type GuidedCoachStep = {
  id: string;
  index: number;
  title: string;
  lines: readonly string[];
  complete: boolean;
};

export const BRUCKNER_GUIDED_STEP_COUNT = 6;
export type BrucknerGuidedState = {
  toolHeld: boolean;
  fixation: boolean;
  largeSpot: boolean;
  light: boolean;
  distanceReady: boolean;
  aimReady: boolean;
  illuminated: boolean;
  captured: boolean;
  observationChosen: boolean;
  recorded: boolean;
};

/** Uses the same physical and recording state as the Bruckner lesson. */
export function brucknerGuidedStep(state: BrucknerGuidedState): GuidedCoachStep {
  if (state.recorded) return {
    id: "record", index: 5, title: "Technique complete",
    lines: ["Your comparison is recorded.", "Review the feedback or try the next finding."], complete: true,
  };
  if (state.captured) return {
    id: "record", index: 5, title: "Record the comparison",
    lines: state.observationChosen
      ? ["Your reflex comparison is selected.", "Press SUBMIT / CHECK on the findings board."]
      : ["Choose equal, OD brighter, or OS brighter", "from what you saw through the scope."],
    complete: false,
  };
  if (!state.toolHeld) return {
    id: "tool", index: 0, title: "Pick up the ophthalmoscope",
    lines: ["Find it on the left instrument trolley.", "Squeeze the side grip once beside its handle."], complete: false,
  };
  if (!state.fixation) return {
    id: "instruct", index: 1, title: "Instruct Arun",
    lines: ["Ask him to look directly at the light.", "Use the LOOK AT THE LIGHT control or say it."], complete: false,
  };
  if (!state.largeSpot) return {
    id: "aperture", index: 2, title: "Select the large aperture",
    lines: ["Use your free hand on the rear selector.", "Choose the large gold circle for both pupils."], complete: false,
  };
  if (!state.light || !state.distanceReady || !state.aimReady || !state.illuminated) return {
    id: "illuminate", index: 3, title: "Illuminate both pupils",
    lines: [
      state.light ? "Keep the trigger held to maintain the beam." : "Hold the instrument trigger to switch on the light.",
      state.distanceReady ? "Aim midway between both pupils." : "Move to the taught 90–110 cm working zone.",
    ], complete: false,
  };
  return {
    id: "inspect", index: 4, title: "Inspect both red reflexes",
    lines: ["Press B/Y on the instrument hand.", "Compare both pupils together, then close the view."], complete: false,
  };
}

export const HIRSCHBERG_GUIDED_STEP_COUNT = 6;
export type HirschbergGuidedState = {
  toolHeld: boolean;
  fixation: boolean;
  light: boolean;
  distanceReady: boolean;
  aimReady: boolean;
  viewReady: boolean;
  captured: boolean;
  directionChosen: boolean;
  landmarkChosen: boolean;
  recorded: boolean;
};

/** Uses the same physical capture and explicit entry state as the Hirschberg lesson. */
export function hirschbergGuidedStep(state: HirschbergGuidedState): GuidedCoachStep {
  if (state.recorded) return {
    id: "record", index: 5, title: "Technique complete",
    lines: ["Your interpretation is recorded.", "Review the feedback or try the next finding."], complete: true,
  };
  if (state.captured) {
    if (!state.directionChosen || !state.landmarkChosen) return {
      id: "interpret", index: 4, title: "Interpret the reflexes",
      lines: [
        state.directionChosen ? "Direction selected; now choose the landmark." : "Choose the deviation direction you observed.",
        state.landmarkChosen ? "Landmark selected; check the direction too." : "Then choose the approximate displacement landmark.",
      ], complete: false,
    };
    return {
      id: "record", index: 5, title: "Record the interpretation",
      lines: ["Direction and landmark are selected.", "Press SUBMIT / CHECK on the findings board."], complete: false,
    };
  }
  if (!state.toolHeld) return {
    id: "tool", index: 0, title: "Pick up the penlight",
    lines: ["Find it on the left instrument trolley.", "Squeeze the side grip once beside its handle."], complete: false,
  };
  if (!state.fixation) return {
    id: "instruct", index: 1, title: "Instruct Arun",
    lines: ["Ask him to look directly at the light.", "Use the LOOK AT THE LIGHT control or say it."], complete: false,
  };
  if (!state.light || !state.distanceReady) return {
    id: "position", index: 2, title: "Set the penlight position",
    lines: [
      state.light ? "Keep the trigger held to maintain the light." : "Hold the trigger to switch the penlight on.",
      state.distanceReady ? "The 50 cm working distance is set." : "Position the light at about 50 cm.",
    ], complete: false,
  };
  return {
    id: "inspect", index: 3, title: "Align and inspect",
    lines: [
      state.aimReady ? "Penlight aim is centred between both eyes." : "Aim midway between both eyes.",
      state.viewReady ? "Hold steady to capture both reflexes." : "Move your head to view directly along the axis.",
    ], complete: false,
  };
}
