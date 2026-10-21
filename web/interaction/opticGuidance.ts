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
    id: "record", index: 5, title: "Complete",
    lines: [], complete: true,
  };
  if (state.captured) return {
    id: "record", index: 5, title: "Record the comparison",
    lines: state.observationChosen
      ? ["Press SUBMIT"]
      : ["Choose your observation"],
    complete: false,
  };
  if (!state.toolHeld) return {
    id: "tool", index: 0, title: "Pick up the ophthalmoscope",
    lines: ["Squeeze the side grip once beside its handle."], complete: false,
  };
  if (!state.fixation) return {
    id: "instruct", index: 1, title: "Instruct Arun",
    lines: ["Ask him to look directly at the light."], complete: false,
  };
  if (!state.largeSpot) return {
    id: "aperture", index: 2, title: "Select the large aperture",
    lines: ["Use your free hand to increase aperture"], complete: false,
  };
  if (!state.light || !state.distanceReady || !state.aimReady || !state.illuminated) return {
    id: "illuminate", index: 3, title: "Illuminate both pupils",
    lines: [
      state.light ? "Keep the trigger held to maintain the beam." : "Hold the trigger to switch on the light.",
      !state.distanceReady ? "Keep the light between 90–110 cm."
        : !state.aimReady ? "Aim between both pupils."
          : !state.illuminated ? "Keep both pupils inside the light beam."
            : "Keep the light steady.",
    ], complete: false,
  };
  return {
    id: "inspect", index: 4, title: "Inspect both red reflexes",
    lines: ["Press B/Y on the instrument hand.", "Compare the reflexes"], complete: false,
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
    id: "record", index: 5, title: "Complete",
    lines: [], complete: true,
  };
  if (state.captured) {
    if (!state.directionChosen || !state.landmarkChosen) return {
      id: "interpret", index: 4, title: "Interpret the reflexes",
      lines: state.directionChosen ? ["Direction selected"]
        : state.landmarkChosen ? ["Landmark selected"]
          : ["Choose the deviation direction and the approximate displacement landmark."], complete: false,
    };
    return {
      id: "record", index: 5, title: "Record the interpretation",
      lines: ["Press SUBMIT"], complete: false,
    };
  }
  if (!state.toolHeld) return {
    id: "tool", index: 0, title: "Pick up the penlight",
    lines: ["Squeeze the side grip once beside its handle."], complete: false,
  };
  if (!state.fixation) return {
    id: "instruct", index: 1, title: "Instruct Arun",
    lines: ["Ask him to look directly at the light."], complete: false,
  };
  if (!state.light || !state.distanceReady) return {
    id: "position", index: 2, title: "Set the penlight position",
    lines: [
      "Hold the trigger to switch the penlight on.",
      "Position the light at about 50 cm.",
    ], complete: false,
  };
  return {
    id: "inspect", index: 3, title: "Align and inspect",
    lines: [!state.aimReady ? "Aim midway between both eyes."
      : state.viewReady ? "Hold steady to capture both reflexes." : "Face the patient and look toward both eyes."], complete: false,
  };
}
