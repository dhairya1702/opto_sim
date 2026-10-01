export type OpticPracticeMode = "bruckner" | "hirschberg";

export type OpticTechnique = {
  aimX: number;
  aimY: number;
  distanceCm: number;
  light: boolean;
  fixation: boolean;
  largeSpot: boolean;
  viewAligned: boolean;
};

export function opticTechniqueChecks(mode: OpticPracticeMode, technique: OpticTechnique) {
  const targetDistance = mode === "bruckner" ? 100 : 50;
  const distanceTolerance = mode === "bruckner" ? 10 : 4;
  const distanceReady = Math.abs(technique.distanceCm - targetDistance) <= distanceTolerance;
  const aimReady = Math.hypot(technique.aimX, technique.aimY) <= .2;
  const ready = technique.light
    && technique.fixation
    && technique.largeSpot
    && technique.viewAligned
    && distanceReady
    && aimReady;
  return { targetDistance, distanceTolerance, distanceReady, aimReady, ready };
}
