import { CLINIC_IRIS_RADIUS } from "./clinicPatient";
import type { CoverEye, CoverPosition } from "./cover";

/**
 * Cover-test eye positions. Educational approximation pending clinical review: it encodes the
 * textbook timing and binocular-coupling rules, not validated oculomotor physiology.
 *
 * Eye pose (per eye), in prism dioptres (Δ):
 *   h > 0 temporal / h < 0 nasal for that eye;  v > 0 up / v < 0 down (same frame for both eyes).
 */
export type EyeDeviation = { h: number; v: number };
export type CoverDeviationModel =
  | { kind: "none" }
  /**
   * Constant unilateral tropia: the fellow eye habitually fixates and `deviation` is the deviating
   * eye's own pose (h temporal+, v up+). Primary = secondary deviation (simplification).
   */
  | { kind: "tropia"; deviatingEye: CoverEye; deviation: EyeDeviation }
  /**
   * Latent deviation, as the dissociated relation between the eyes:
   *   h = sum of both eyes' temporal rotation (exo > 0, eso < 0) — symmetric, both eyes move alike;
   *   v = OD relative to OS (right hyper > 0, right hypo < 0) — the eyes move in opposite directions.
   */
  | { kind: "phoria"; deviation: EyeDeviation };
export type CoverEyePoses = Record<CoverEye, EyeDeviation>;
export type PrismPlacement = { eye: CoverEye; base: string; power: number } | null;

export const straightPoses = (): CoverEyePoses => ({ OD: { h: 0, v: 0 }, OS: { h: 0, v: 0 } });
const fellow = (eye: CoverEye): CoverEye => eye === "OD" ? "OS" : "OD";

/**
 * Pose an eye must take to fixate the target through a prism before it: the image is displaced toward
 * the apex, so the eye turns toward the apex by the prism power.
 */
export function prismFixationShift(base: string, power: number): EyeDeviation {
  const p = Math.max(0, power);
  return base === "base-in" ? { h: p, v: 0 } : base === "base-out" ? { h: -p, v: 0 }
    : base === "base-up" ? { h: 0, v: -p } : base === "base-down" ? { h: 0, v: p } : { h: 0, v: 0 };
}
const fixationPose = (eye: CoverEye, prism: PrismPlacement): EyeDeviation =>
  prism && prism.eye === eye ? prismFixationShift(prism.base, prism.power) : { h: 0, v: 0 };

/** Hering's law: a dissociated eye keeps the phoria relation to wherever the fixating eye points. */
export function coupledPose(deviation: EyeDeviation, covered: CoverEye, fixating: EyeDeviation): EyeDeviation {
  return { h: deviation.h - fixating.h, v: fixating.v + (covered === "OD" ? deviation.v : -deviation.v) };
}

/** Settled pose of each eye for an occluder position (and optional prism before one eye). */
export function coverEyeTargets(model: CoverDeviationModel, cover: CoverPosition, prism: PrismPlacement = null): CoverEyePoses {
  const poses = straightPoses();
  if (model.kind === "tropia") {
    // Unilateral: whenever the habitual fixing eye is free it fixates; covering it forces the deviating eye to fixate.
    const habitual = fellow(model.deviatingEye);
    const deviated = cover === habitual ? habitual : model.deviatingEye;
    poses[deviated] = { ...model.deviation };
  } else if (model.kind === "phoria") {
    if (cover === "away") {
      // Fusion: each eye fixates, through its prism if present.
      poses.OD = fixationPose("OD", prism); poses.OS = fixationPose("OS", prism);
    } else {
      const fixating = fellow(cover);
      poses[fixating] = fixationPose(fixating, prism);
      poses[cover] = coupledPose(model.deviation, cover, poses[fixating]);
    }
  }
  return poses;
}

/** Approach rates (1/s) for the exponential settle toward a target pose. */
export const COVER_EYE_RATES = Object.freeze({
  /** Refixation saccade (and the covered eye's yoked movement): ~90% complete in about 50 ms. */
  saccade: 45,
  /** Fusional recovery after uncovering: ~90% in about 0.25 s. */
  fusion: 9,
  /** First dissociation behind the occluder from binocular viewing: ~90% in about 0.75 s. */
  drift: 3,
});
/** A fixating eye further than this from its target is still refixating (Δ). */
const REFIXATING_THRESHOLD = .25;

const approach = (from: EyeDeviation, to: EyeDeviation, rate: number, dt: number): EyeDeviation => {
  const blend = 1 - Math.exp(-rate * dt);
  return { h: from.h + (to.h - from.h) * blend, v: from.v + (to.v - from.v) * blend };
};
const distance = (a: EyeDeviation, b: EyeDeviation) => Math.hypot(a.h - b.h, a.v - b.v);

export function settleCoverEyes(model: CoverDeviationModel, cover: CoverPosition, poses: CoverEyePoses, dt: number, prism: PrismPlacement = null): CoverEyePoses {
  const step = Math.max(0, Math.min(dt, .1));
  const targets = coverEyeTargets(model, cover, prism);
  if (model.kind !== "phoria") return { OD: approach(poses.OD, targets.OD, COVER_EYE_RATES.saccade, step), OS: approach(poses.OS, targets.OS, COVER_EYE_RATES.saccade, step) };
  if (cover === "away") return { OD: approach(poses.OD, targets.OD, COVER_EYE_RATES.fusion, step), OS: approach(poses.OS, targets.OS, COVER_EYE_RATES.fusion, step) };
  const fixating = fellow(cover);
  // No fusion while one eye is covered: the free eye refixates with a saccade.
  const refixating = distance(poses[fixating], targets[fixating]) > REFIXATING_THRESHOLD;
  const next = straightPoses();
  next[fixating] = approach(poses[fixating], targets[fixating], COVER_EYE_RATES.saccade, step);
  // The covered eye is yoked to that saccade; only from steady binocular fixation does it slowly drift.
  next[cover] = approach(poses[cover], coupledPose(model.deviation, cover, next[fixating]),
    refixating ? COVER_EYE_RATES.saccade : COVER_EYE_RATES.drift, step);
  return next;
}

/** Movement each eye makes when it is uncovered during alternating cover (fixating pose − covered pose). */
export function alternateCoverMovements(model: CoverDeviationModel, prism: PrismPlacement = null): CoverEyePoses {
  const result = straightPoses();
  for (const eye of ["OD", "OS"] as const) {
    const fixating = coverEyeTargets(model, fellow(eye), prism)[eye];
    const covered = coverEyeTargets(model, eye, prism)[eye];
    result[eye] = { h: fixating.h - covered.h, v: fixating.v - covered.v };
  }
  return result;
}
/** Neutralised when neither eye moves on alternating cover (within 0.5Δ). */
export function alternateCoverNeutralized(model: CoverDeviationModel, prism: PrismPlacement) {
  const movement = alternateCoverMovements(model, prism);
  return [movement.OD, movement.OS].every(m => Math.abs(m.h) < .5 && Math.abs(m.v) < .5);
}

/** Phoria relation from a recorded label (see `CoverDeviationModel`). */
export function deviationFromLabel(deviation: string, amount: number): EyeDeviation {
  return deviation === "exo" ? { h: amount, v: 0 } : deviation === "eso" ? { h: -amount, v: 0 }
    : deviation === "r-hyper" ? { h: 0, v: amount } : deviation === "r-hypo" ? { h: 0, v: -amount } : { h: 0, v: 0 };
}

/**
 * The clinic face is drawn larger than life, so iris shift is scaled to the rendered iris:
 * a real eye's iris plane sits ~11 mm in front of its centre of rotation and the iris radius is ~5.9 mm.
 * A given Δ therefore moves the iris by the same fraction of its radius as on a real eye.
 */
export const HUMAN_IRIS_RADIUS_MM = 5.9;
export const HUMAN_IRIS_ROTATION_ARM_MM = 11;
export const CLINIC_COVER_ROTATION_ARM = CLINIC_IRIS_RADIUS * HUMAN_IRIS_ROTATION_ARM_MM / HUMAN_IRIS_RADIUS_MM;
export const prismDioptresToRadians = (prism: number) => Math.atan(prism / 100);

/**
 * Iris offset for a patient facing the examiner (OD on the examiner's left, -x), in the units of
 * the supplied rendered iris radius. Defaults to the canonical XR clinic iris (metres).
 */
export function coverIrisOffset(eye: CoverEye, pose: EyeDeviation, irisRadius = CLINIC_IRIS_RADIUS): [number, number] {
  const temporal = eye === "OD" ? -1 : 1;
  const arm = irisRadius * HUMAN_IRIS_ROTATION_ARM_MM / HUMAN_IRIS_RADIUS_MM;
  return [
    temporal * Math.sin(prismDioptresToRadians(pose.h)) * arm,
    Math.sin(prismDioptresToRadians(pose.v)) * arm,
  ];
}
