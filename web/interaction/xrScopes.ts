import type { ClinicalCase } from "../domain/types";
import type { XRPoint3, XRPupilEye } from "./xrPupils";
import { reflexMotion, reflexQuality, type ReflexMotion, type SweepZone } from "./retinoscopy";

export type ScopeAim = { eye: XRPupilEye; distanceCm: number; x: number; y: number };
/** Patient-plane intersection, in metres. No camera/Three dependencies. */
export function xrScopeAim(origin: XRPoint3, forward: XRPoint3, eyes: Record<XRPupilEye, XRPoint3>): ScopeAim | null {
  if (forward[2] >= -.001) return null;
  const t = (eyes.OD[2] - origin[2]) / forward[2];
  if (t <= 0) return null;
  const hit = [origin[0] + t * forward[0], origin[1] + t * forward[1]];
  let best: ScopeAim | null = null;
  for (const eye of ["OD", "OS"] as const) {
    const target = eyes[eye];
    const x = hit[0] - target[0], y = hit[1] - target[1];
    const distanceCm = Math.hypot(target[0] - origin[0], target[1] - origin[1], target[2] - origin[2]) * 100;
    if (distanceCm < 3 || distanceCm > 120 || Math.hypot(x, y) > .025) continue;
    if (!best || Math.hypot(x, y) < Math.hypot(best.x, best.y)) best = { eye, distanceCm, x, y };
  }
  return best;
}
export function scopeCaseSphere(caseData: ClinicalCase, eye: XRPupilEye): number | null {
  const value = caseData.exams.find(exam => exam.id === "objective")?.findings[`${eye}:default`]?.refraction?.find(refraction => refraction.eye === eye)?.sphere;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
export function scopeCaseFundus(caseData: ClinicalCase, eye: XRPupilEye) {
  const appearance = caseData.exams.find(exam => exam.id === "fundus")?.findings[`${eye}:default`]?.posteriorPole;
  return appearance === "schematic-within-normal-limits" ? appearance : null;
}
export function scopeReflex(aim: ScopeAim, caseData: ClinicalCase, lens: number) {
  const sphere = scopeCaseSphere(caseData, aim.eye);
  if (sphere === null) return null;
  const motion = reflexMotion(aim.eye, aim.distanceCm, lens, sphere);
  const quality = reflexQuality(aim.eye, aim.distanceCm, lens, sphere);
  return { motion, ...quality, offset: motion === "neutral" ? 0 : Math.max(-.006, Math.min(.006, aim.x * (motion === "with" ? 1 : -1))) };
}
export type ScopeSweep = { observed: string[]; key: string | null; lens: number | null; last: "left" | "right" | null; crossings: number };
export const initialScopeSweep = (): ScopeSweep => ({ observed: [], key: null, lens: null, last: null, crossings: 0 });
export const pauseScopeSweep = (state: ScopeSweep): ScopeSweep => ({ ...initialScopeSweep(), observed: state.observed });
export function advanceScopeSweep(state: ScopeSweep, input: { aim: ScopeAim | null; motion: ReflexMotion | null; lens: number; axis: 90 | 180; ready: boolean }): ScopeSweep {
  if (!input.ready || !input.aim || !input.motion) return pauseScopeSweep(state);
  const key = `${input.motion}:${input.motion === "neutral" ? input.axis : "any"}`;
  const current = state.key === key && state.lens === input.lens ? state : { ...pauseScopeSweep(state), key, lens: input.lens };
  const zone: SweepZone = input.aim.x < -.004 ? "left" : input.aim.x > .004 ? "right" : "centre";
  if (zone === "centre") return current;
  const crossings = current.last && current.last !== zone ? Math.min(2, current.crossings + 1) : current.crossings;
  return { ...current, last: zone, crossings, observed: crossings === 2 && !current.observed.includes(key) ? [...current.observed, key] : current.observed };
}
export const scopeSweepComplete = (state: ScopeSweep) => ["with:any", "against:any", "neutral:90", "neutral:180"].every(key => state.observed.includes(key));
export type ScopeViewerPose = { viewer: XRPoint3; look: XRPoint3 };
export type ScopeInspection = { dwell: number; seen: boolean };
export const initialScopeInspection = (): ScopeInspection => ({ dwell: 0, seen: false });
export function advanceScopeInspection(state: ScopeInspection, valid: boolean, dt: number): ScopeInspection {
  const dwell = valid ? state.dwell + Math.max(0, Math.min(.1, dt)) : 0;
  return { dwell, seen: state.seen || dwell >= 1.2 };
}
