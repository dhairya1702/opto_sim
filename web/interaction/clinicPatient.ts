import type { XRPupilEye } from "./xrPupils";

/** Canonical clinic patient anchors in metres; illustrative geometry, not anatomy calibration. */
export const CLINIC_PATIENT_EYES: Record<XRPupilEye, [number, number, number]> = {
  OD: [-.048, 1.5, -.573],
  OS: [.048, 1.5, -.573],
};
export const CLINIC_EYE_MIDPOINT: [number, number, number] = [0, 1.5, -.573];
export const CLINIC_PUPIL_RADIUS = .008;
export const CLINIC_IRIS_RADIUS = .010;
