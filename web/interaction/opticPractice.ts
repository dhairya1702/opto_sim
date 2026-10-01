export type OpticPracticeMode = "bruckner" | "hirschberg";

export const OPTIC_VIEW_ALIGNMENT_TOLERANCE = .14;

export function opticViewAligned(x: number, y: number) {
  return Math.hypot(x, y) <= OPTIC_VIEW_ALIGNMENT_TOLERANCE;
}

export function hirschbergReflexOffset(position: readonly [number, number]) {
  const dx = position[0] - 50;
  const dy = position[1] - 50;
  const sourceDistance = Math.hypot(dx, dy);
  if (sourceDistance === 0) return { x: 0, y: 0 };
  const largestAxis = Math.max(Math.abs(dx), Math.abs(dy));
  const landmarkRadius = largestAxis <= 13 ? .03 : largestAxis <= 20 ? .048 : .065;
  return {
    x: dx === 0 ? 0 : dx / sourceDistance * landmarkRadius,
    y: dy === 0 ? 0 : -dy / sourceDistance * landmarkRadius,
  };
}

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
