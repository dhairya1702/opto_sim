import { opticTechniqueChecks } from "./opticPractice";
import { scopeBeamAngle } from "./xrScopeEquipment";
import { CLINIC_EYE_MIDPOINT, CLINIC_PATIENT_EYES } from "./clinicPatient";
import { advancePracticeCoverStep, practiceCoverProcedures, type PracticeCoverKind } from "./practiceCover";
import type { CoverPosition, CoverEye } from "./cover";
import type { ToolPoint, PlacementSocket } from "./xrConsultationTools";

// Mount slightly below eye height so the accommodative card does not hide both eyes.
export const PRACTICE_NEAR_SOCKET: PlacementSocket = {
  id: "practice-near-stand", tool: "near", position: [0, 1.425, CLINIC_EYE_MIDPOINT[2] + .393],
  rotation: [0, 1, 0, 0], radius: .12,
};
export function xrBrucknerTechnique(input: {
  origin: ToolPoint; forward: ToolPoint;
  held: boolean; light: boolean; fixation: boolean; largeSpot: boolean; scopeOpen: boolean;
}) {
  const { origin, forward } = input;
  const distanceCm = Math.hypot(...origin.map((v, i) => v - CLINIC_EYE_MIDPOINT[i])) * 100;
  const t = forward[2] < -.001 ? (CLINIC_EYE_MIDPOINT[2] - origin[2]) / forward[2] : -1;
  const error = t > 0 ? Math.hypot(origin[0] + t * forward[0], origin[1] + t * forward[1] - CLINIC_EYE_MIDPOINT[1]) : 10;
  const viewAligned = input.scopeOpen;
  const checks = opticTechniqueChecks("bruckner", {
    aimX: error / .25, aimY: 0, distanceCm, light: input.held && input.light,
    fixation: input.fixation, largeSpot: input.largeSpot, viewAligned,
  });
  const illuminated = input.held && input.light && t > 0 && distanceCm >= 10 && distanceCm <= 140
    && error + .056 <= t * Math.tan(scopeBeamAngle(input.largeSpot ? "large" : "small"));
  return { ...checks, ready: checks.ready && illuminated, distanceCm, viewAligned, illuminated };
}
export function xrBrucknerPrompt(technique: ReturnType<typeof xrBrucknerTechnique>, setup: { tracked: boolean; held: boolean; light: boolean; fixation: boolean; largeSpot: boolean }) {
  if (!setup.tracked) return "Restore headset/controller tracking.";
  if (!setup.held) return "Pick up the ophthalmoscope using the side grip.";
  if (!setup.fixation) return "Ask the patient to look at the light.";
  if (!setup.light) return "Ophthalmoscope held · hold its trigger to switch on the light.";
  if (!setup.largeSpot) return "Turn the rear aperture wheel to the large gold circle with your free hand.";
  if (!technique.distanceReady) return `Light-to-patient distance: ${Math.round(technique.distanceCm)} cm · move the light to 90–110 cm.`;
  if (!technique.aimReady || !technique.illuminated) return "Aim the light at the midpoint between both pupils so the beam covers both.";
  return !technique.viewAligned ? "Press B/Y on the instrument hand to look through the scope." : "Both reflexes visible · record their relative brightness.";
}
/** Tolerances keep one full-size paddle over one pupil, not the midpoint/both eyes. */
export function xrPracticeEyePlacement(point: ToolPoint, forward: ToolPoint, prism = false): CoverEye | null {
  const length = Math.hypot(...forward);
  if (!length || Math.abs(forward[2]) / length < Math.cos(40 * Math.PI / 180)) return null;
  for (const eye of ["OD", "OS"] as const) {
    const target = CLINIC_PATIENT_EYES[eye];
    const dz = point[2] - target[2];
    if (Math.abs(point[0] - target[0]) <= (prism ? .022 : .025)
      && Math.abs(point[1] - target[1]) <= (prism ? .025 : .03)
      && dz >= .018 && dz <= (prism ? .15 : .12)) return eye;
  }
  return null;
}
export function xrPracticeCoverPosition(point: ToolPoint, forward: ToolPoint): CoverPosition | null {
  const eye = xrPracticeEyePlacement(point, forward);
  if (eye) return eye;
  return Math.min(...Object.values(CLINIC_PATIENT_EYES).map(target => Math.hypot(...point.map((v, i) => v - target[i])))) >= .20 ? "away" : null;
}
/**
 * Visual guide anchors derived from the same tolerances as xrPracticeEyePlacement /
 * xrPracticeCoverPosition, so a paddle centred on a guide is accepted by the sequence.
 */
export const COVER_GUIDE_HALF_SIZE: readonly [number, number] = [.025, .03];
export function xrCoverGuideAnchors() {
  const depth = .06; // middle of the accepted 1.8–12 cm in-front band
  const cover = (eye: CoverEye): ToolPoint => [CLINIC_PATIENT_EYES[eye][0], CLINIC_PATIENT_EYES[eye][1], CLINIC_PATIENT_EYES[eye][2] + depth];
  // Uncover by moving the paddle temporally (towards the learner's side of that eye), clear of both eyes.
  const away = (eye: CoverEye): ToolPoint => {
    const side = Math.sign(CLINIC_PATIENT_EYES[eye][0]) || 1;
    return [CLINIC_PATIENT_EYES[eye][0] + side * .24, CLINIC_PATIENT_EYES[eye][1], CLINIC_PATIENT_EYES[eye][2] + depth];
  };
  return { cover: { OD: cover("OD"), OS: cover("OS") }, away: { OD: away("OD"), OS: away("OS") } } as const;
}
/** The eye a guide should point to for each step: the eye being covered, or the eye just uncovered. */
export function xrCoverGuideTarget(kind: PracticeCoverKind, index: number): { position: CoverPosition; eye: CoverEye } | null {
  const procedure = practiceCoverProcedures[kind];
  const step = procedure[index];
  if (!step) return null;
  if (step.position !== "away") return { position: step.position, eye: step.position };
  const previous = procedure[index - 1]?.position;
  return { position: "away", eye: previous === "OS" ? "OS" : "OD" };
}
export function xrPracticeNearFixation(point: ToolPoint) {
  const dx = point[0] - CLINIC_EYE_MIDPOINT[0], dy = point[1] - CLINIC_EYE_MIDPOINT[1], dz = point[2] - CLINIC_EYE_MIDPOINT[2];
  const distanceCm = Math.hypot(dx, dy, dz) * 100;
  return { distanceCm, ready: Math.abs(distanceCm - 40) <= 2 && Math.hypot(dx, dy) <= .08 && dz > 0 };
}
export type PracticeCoverSequence = { index: number; dwell: number; transit: number };
// Forgiving controller-transfer tolerance for learners, not a clinical cutoff.
export const ALTERNATE_COVER_EXPOSURE_ALLOWANCE_SECONDS = 1;
export const emptyPracticeCoverSequence = (): PracticeCoverSequence => ({ index: 0, dwell: 0, transit: 0 });
export function advanceXRPracticeCover(kind: PracticeCoverKind, state: PracticeCoverSequence, position: CoverPosition | null, dt: number, ready: boolean) {
  if (state.index >= practiceCoverProcedures[kind].length) return state;
  if (!ready) return kind === "alternate-cover" ? emptyPracticeCoverSequence() : { ...state, dwell: 0, transit: 0 };
  const transit = kind === "alternate-cover" && state.index > 0 && (position === "away" || position === null)
    ? state.transit + Math.max(0, Math.min(.1, dt)) : 0;
  // A hand must cross the nose. Sustained binocular exposure loses dissociation.
  if (transit > ALTERNATE_COVER_EXPOSURE_ALLOWANCE_SECONDS) return emptyPracticeCoverSequence();
  return { ...advancePracticeCoverStep(kind, state.index, state.dwell, position, dt), transit };
}
