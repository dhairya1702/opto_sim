import { consultationToolDefinition, type ConsultationHand, type ConsultationToolId, type ToolPoint } from "./xrConsultationTools";
import { CLINIC_PATIENT_EYES } from "./clinicPatient";
import type { DesktopClinicPose } from "./useXRClinicRuntime";

export type DesktopClinicInputState = Readonly<{
  activeHand: ConsultationHand;
  activating: boolean;
}>;

export const initialDesktopClinicInput = (): DesktopClinicInputState => ({ activeHand: "right", activating: false });

export function switchDesktopClinicHand(state: DesktopClinicInputState): DesktopClinicInputState {
  return { ...state, activeHand: state.activeHand === "right" ? "left" : "right" };
}

export function setDesktopClinicActivation(state: DesktopClinicInputState, activating: boolean): DesktopClinicInputState {
  return state.activating === activating ? state : { ...state, activating };
}

export function clearDesktopClinicTransient(state: DesktopClinicInputState): DesktopClinicInputState {
  return setDesktopClinicActivation(state, false);
}

/** Wheel-up / ArrowUp is the positive controller-axis step; down is negative. */
export function desktopClinicAdjustmentStep(delta: number): -1 | 0 | 1 {
  return delta < 0 ? 1 : delta > 0 ? -1 : 0;
}

export function isEditableClinicTarget(target: EventTarget | null) {
  return target instanceof HTMLElement && Boolean(target.closest("input,textarea,select,button,[contenteditable=true]"));
}

export function desktopClinicShortcut(event: Pick<KeyboardEvent, "key" | "repeat">, editable: boolean) {
  if (editable || event.repeat) return null;
  const key = event.key.toLowerCase();
  if (key === "q") return "switch-hand" as const;
  if (key === "e") return "pickup-place" as const;
  if (key === "arrowup") return "adjust-vertical-positive" as const;
  if (key === "arrowdown") return "adjust-vertical-negative" as const;
  if (key === "arrowright") return "adjust-horizontal-positive" as const;
  if (key === "arrowleft") return "adjust-horizontal-negative" as const;
  return null;
}

export type DesktopClinicAim = Readonly<{
  tool: ConsultationToolId | null;
  action: string;
}>;

export function desktopAssistedSocketId(id: ConsultationToolId) {
  if (id === "push-up-rule") return "library-push-up-spectacle";
  if (id === "npc-rule") return "library-npc-spectacle";
  if (id === "near") return "practice-near-stand";
  if (id === "thorington") return "library-thorington-near";
  if (id === "stereo") return "sensory-stereo-near";
  if (id === "subjective") return "sensory-correction";
  return null;
}

/** Aim a penlight's authored working point straight toward the patient. */
export function desktopPenlightPose(workingPosition: ToolPoint): DesktopClinicPose {
  return { position: [workingPosition[0], workingPosition[1], workingPosition[2] + .137],
    rotation: [-Math.SQRT1_2, 0, 0, Math.SQRT1_2] };
}

/** Place a patient-facing tool's authored working point at an exact clinical anchor. */
export function desktopPatientFacingPose(id: ConsultationToolId, workingPosition: ToolPoint, rollQuarterTurns = 0): DesktopClinicPose {
  const point = consultationToolDefinition(id).workingPoint;
  const angle = rollQuarterTurns * Math.PI / 2, cosine = Math.cos(angle), sine = Math.sin(angle);
  const rotatedX = point[0] * cosine - point[1] * sine;
  const rotatedY = point[0] * sine + point[1] * cosine;
  return { position: [workingPosition[0] - rotatedX, workingPosition[1] - rotatedY, workingPosition[2] - point[2]],
    rotation: [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)] };
}

/** One-metre binocular ophthalmoscope pose; local +Z is turned toward the patient. */
export function desktopBrucknerPose(): DesktopClinicPose {
  return { position: [0, 1.33, .459], rotation: [0, 1, 0, 0] };
}

/** Root pose whose modeled working point is accepted by the shared eye-placement checks. */
export function desktopAccommodationHeldPose(id: ConsultationToolId, coverSocketId?: string, rollQuarterTurns = 0): {
  position: readonly [number, number, number]; rotation: readonly [number, number, number, number];
} | null {
  if (id === "prism") return { position: [CLINIC_PATIENT_EYES.OD[0], 1.357, -.492] as const, rotation: [0, 0, 0, 1] as const };
  if (id === "fundus") return desktopBrucknerPose();
  if (id === "vergence-prism") {
    const angle = rollQuarterTurns * Math.PI / 2;
    return { position: [CLINIC_PATIENT_EYES.OD[0] + .1 * Math.sin(angle), 1.5 - .1 * Math.cos(angle), -.492] as const,
      rotation: [0, 0, Math.sin(angle / 2), Math.cos(angle / 2)] as const };
  }
  if (id === "prism-flipper") return { position: [0, 1.4, -.492] as const, rotation: [0, 0, 0, 1] as const };
  if (!["minus-lens-holder", "trial-lens", "lens-flipper"].includes(id)) return null;
  const x = id === "minus-lens-holder"
    ? coverSocketId === "sensory-occlude-OS" ? CLINIC_PATIENT_EYES.OD[0]
      : coverSocketId === "sensory-occlude-OD" ? CLINIC_PATIENT_EYES.OS[0] : 0
    : 0;
  return { position: [x, 1.4, -.48] as const, rotation: [0, 0, 0, 1] as const };
}
