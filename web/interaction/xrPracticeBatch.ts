import { opticTechniqueChecks } from "./opticPractice";
import { scopeBeamAngle } from "./xrScopeEquipment";
import { CLINIC_EYE_MIDPOINT, CLINIC_PATIENT_EYES } from "./clinicPatient";
import { advancePracticeCoverStep, practiceCoverProcedures, type PracticeCoverKind, type EyeMovement } from "./practiceCover";
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
export function xrPracticeNearFixation(point: ToolPoint) {
  const dx = point[0] - CLINIC_EYE_MIDPOINT[0], dy = point[1] - CLINIC_EYE_MIDPOINT[1], dz = point[2] - CLINIC_EYE_MIDPOINT[2];
  const distanceCm = Math.hypot(dx, dy, dz) * 100;
  return { distanceCm, ready: Math.abs(distanceCm - 40) <= 2 && Math.hypot(dx, dy) <= .08 && dz > 0 };
}
export type PracticeCoverSequence = { index: number; dwell: number; transit: number };
export const emptyPracticeCoverSequence = (): PracticeCoverSequence => ({ index: 0, dwell: 0, transit: 0 });
export function advanceXRPracticeCover(kind: PracticeCoverKind, state: PracticeCoverSequence, position: CoverPosition | null, dt: number, ready: boolean) {
  if (!ready) return { ...state, dwell: 0, transit: 0 };
  if (state.index >= practiceCoverProcedures[kind].length) return state;
  const transit = kind === "alternate-cover" && state.index > 0 && (position === "away" || position === null)
    ? state.transit + Math.max(0, Math.min(.1, dt)) : 0;
  // A hand must cross the nose. Sustained binocular exposure loses dissociation.
  if (transit > .35) return emptyPracticeCoverSequence();
  return { ...advancePracticeCoverStep(kind, state.index, state.dwell, position, dt), transit };
}
export function coverPracticePulse(kind: PracticeCoverKind, scenario: string, index: number, movement: EyeMovement) {
  const position = practiceCoverProcedures[kind][index]?.position;
  if (kind === "alternate-cover" && position !== "away" && position) return { eye: position === "OD" ? "OS" : "OD", direction: movement } as const;
  if (scenario === "left-esotropia" && (index === 0 || index === 1)) return { eye: "OS", direction: index === 0 ? "out" : "in" } as const;
  if (scenario === "exophoria" && position === "away") return { eye: index === 1 ? "OD" : "OS", direction: "in" } as const;
  return null;
}
