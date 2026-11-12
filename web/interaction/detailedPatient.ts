import { CLINIC_PATIENT_EYES } from "./clinicPatient";

export const DETAILED_EYE_RADIUS = .025;
const smooth = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

/** Fit the approved visual study to the existing clinic, not vice versa. */
export function detailedPatientPoint(x: number, y: number, z: number): [number, number, number] {
  const blend = smooth((y - 1.23) / .17);
  const eyeY = CLINIC_PATIENT_EYES.OS[1];
  const eyeZ = CLINIC_PATIENT_EYES.OS[2] + .7 - DETAILED_EYE_RADIUS;
  const torso = smooth((y - .67) / .27) * (1 - smooth((y - 1.25) / .15));
  const lowerFace = smooth((y - 1.25) / .09) * (1 - smooth((y - 1.36) / .065));
  return [x * (1 + .6 * blend + .20 * torso),
    y + (eyeY + (y - 1.4356) * 1.5 - y) * blend + .016 * lowerFace,
    z + (eyeZ + (z - .130435) * 1.6 - z) * blend + (z - .025) * .12 * torso];
}

