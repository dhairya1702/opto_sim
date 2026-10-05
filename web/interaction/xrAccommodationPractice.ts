import { pushUpBlurCm, pushUpAmplitude } from "./accommodationPractice";
import { facilityCanFlip, facilityNext, type FacilitySide } from "./accommodativeFacility";
import { minusLensAmplitude, canRecordMinusLens } from "./minusLens";
import type { LibraryEye } from "./xrLibraryEquipment";
export type AccommodationKind = "push-up" | "minus-lens" | "relative" | "accommodative-facility";
export const accommodationEyes = (kind: AccommodationKind): readonly LibraryEye[] => kind === "relative" ? ["OU"] : kind === "minus-lens" ? ["OD", "OS"] : ["OD", "OS", "OU"];
export function pushUpEndpoint(eye: LibraryEye, distance: number, initialized: boolean, ready: boolean) {
  if (!ready || !initialized || distance > pushUpBlurCm[eye] + 1e-8 || distance < pushUpBlurCm[eye] - .5) return null;
  const cm = Math.round(distance * 10) / 10;
  return { distance: cm, amplitude: Math.round(pushUpAmplitude(cm) * 100) / 100 };
}
export function minusLensEndpoint(power: number, settled: boolean, ready: boolean) {
  return canRecordMinusLens(power, settled, ready) ? { amplitude: minusLensAmplitude(power) } : null;
}
export type AccommodationTimedRun = { start: number; presented: number; side: FacilitySide; cycles: number };
export const newAccommodationFacility = (now: number): AccommodationTimedRun => ({ start: now, presented: now, side: "plus", cycles: 0 });
export function flipAccommodationFacility(run: AccommodationTimedRun, now: number, ready: boolean): AccommodationTimedRun {
  if (!ready || !facilityCanFlip(run.start, run.presented, now, run.side)) return run;
  return { ...run, ...facilityNext(run.side, run.cycles), presented: now };
}
