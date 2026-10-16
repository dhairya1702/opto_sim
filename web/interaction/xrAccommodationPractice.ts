import { pushUpBlurCm, pushUpAmplitude } from "./accommodationPractice";
import { facilityCanFlip, facilityNext, type FacilitySide } from "./accommodativeFacility";
import type { LibraryEye } from "./xrLibraryEquipment";
export type AccommodationKind = "accommodative-facility";
export const accommodationEyes = (_kind: AccommodationKind): readonly LibraryEye[] => ["OD", "OS", "OU"];
export function pushUpEndpoint(eye: LibraryEye, distance: number, initialized: boolean, ready: boolean) {
  if (!ready || !initialized || distance > pushUpBlurCm[eye] + 1e-8 || distance < pushUpBlurCm[eye] - .5) return null;
  const cm = Math.round(distance * 10) / 10;
  return { distance: cm, amplitude: Math.round(pushUpAmplitude(cm) * 100) / 100 };
}
export type AccommodationTimedRun = { start: number; presented: number; side: FacilitySide; cycles: number };
export const newAccommodationFacility = (now: number): AccommodationTimedRun => ({ start: now, presented: now, side: "plus", cycles: 0 });
export function flipAccommodationFacility(run: AccommodationTimedRun, now: number, ready: boolean): AccommodationTimedRun {
  if (!ready || !facilityCanFlip(run.start, run.presented, now, run.side)) return run;
  return { ...run, ...facilityNext(run.side, run.cycles), presented: now };
}
