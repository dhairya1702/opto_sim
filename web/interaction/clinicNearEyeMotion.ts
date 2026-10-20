import type { XRPupilEye } from "./xrPupils";

/** Deliberately exaggerated teaching motion in metres, bounded for the canonical
 * patient's sclera silhouette (.025 × .011 radii) and .010-radius iris.
 * This is a visual range, not a calibrated ocular rotation. */
export const CLINIC_NEAR_EYE_TRAVEL = .008;

export function clinicNearEyeOffset(eye: XRPupilEye, convergence: number, osDrifted = false): number {
  const inward = Math.max(0, Math.min(1, convergence)) * CLINIC_NEAR_EYE_TRAVEL;
  const target = (eye === "OD" ? inward : -inward)
    + (eye === "OS" && osDrifted ? 2 * CLINIC_NEAR_EYE_TRAVEL : 0);
  // OS is on the patient's positive-X side: outward drift must increase X.
  return Math.max(-CLINIC_NEAR_EYE_TRAVEL, Math.min(CLINIC_NEAR_EYE_TRAVEL, target));
}
