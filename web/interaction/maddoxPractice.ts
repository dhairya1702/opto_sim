import { MADDOX_TRIALS, maddoxGrooveCorrect, type MaddoxAxis } from "./maddoxProcedure";
export type { MaddoxAxis } from "./maddoxProcedure";
/** Compatibility name for the existing Thorington/XR adapters. */
export const maddoxTrials = MADDOX_TRIALS;
export function maddoxAligned(x: number, y: number) { return Math.hypot(x + 0.22, y - 0.2) <= 0.075; }
export function maddoxRotationCorrect(axis: MaddoxAxis, degrees: number) {
  return maddoxGrooveCorrect(axis, degrees);
}
export function maddoxCanRecord(setup: boolean, started: boolean, power: number, neutral: number) {
  return setup && started && power === neutral;
}
