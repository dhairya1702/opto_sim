import { vergenceFindings, npcFindings, vergenceFacilityDelay } from "./vergencePractice";
import { facilityDuration } from "./accommodativeFacility";
export type PrismVergenceKind = "horizontal-distance" | "vertical-distance" | "horizontal-near";
export type VergencePhase = "blur" | "break" | "recovery";
export const vergenceBases = (kind: PrismVergenceKind) => Object.keys(vergenceFindings[kind]);
export type VergenceRun = { phase: VergencePhase; initialized: boolean; values: Partial<Record<VergencePhase, number>>; complete: boolean };
export const newVergenceRun = (): VergenceRun => ({ phase: "blur", initialized: false, values: {}, complete: false });
export function vergencePhase(kind: PrismVergenceKind, base: string, run: VergenceRun): VergencePhase {
  return run.phase === "blur" && vergenceFindings[kind][base]?.blur === null ? "break" : run.phase;
}
export function vergencePatientReport(kind: PrismVergenceKind, base: string, power: number, run: VergenceRun) {
  const finding = vergenceFindings[kind][base];
  if (!finding) return "Select the required prism base.";
  if (vergencePhase(kind, base, run) === "recovery") return power <= finding.recovery ? "The target is single again." : "The target remains double.";
  return power >= finding.break ? "The target is double." : finding.blur !== null && power >= finding.blur ? "First sustained blur." : "Clear and single.";
}
export function markVergenceEndpoint(kind: PrismVergenceKind, base: string, power: number, run: VergenceRun, ready: boolean): VergenceRun {
  const finding = vergenceFindings[kind][base], phase = vergencePhase(kind, base, run);
  if (!finding || !ready || !run.initialized || run.complete || power !== finding[phase]) return run;
  const values = { ...run.values, [phase]: power };
  return { initialized: true, values, phase: phase === "blur" ? "break" : "recovery", complete: phase === "recovery" };
}
export const npcPhases = Object.keys(npcFindings) as (keyof typeof npcFindings)[];
export type NPCRun = { initialized: boolean; index: number; values: readonly number[] };
export const newNPCRun = (): NPCRun => ({ initialized: false, index: 0, values: [] });
/** Half a centimetre is assisted handling tolerance around authored endpoints, not a clinical cutoff. */
export function markNPCEndpoint(run: NPCRun, distanceCm: number, ready: boolean): NPCRun {
  const phase = npcPhases[run.index];
  if (!ready || !run.initialized || !phase || Math.abs(distanceCm - npcFindings[phase]) > .5) return run;
  const threshold = npcFindings[phase];
  if (phase.includes("break") ? distanceCm > threshold + 1e-8 : distanceCm < threshold - 1e-8) return run;
  return { ...run, index: run.index + 1, values: [...run.values, distanceCm] };
}
export function npcPatientReport(run: NPCRun, distanceCm: number) {
  if (run.index < 2) return distanceCm <= npcFindings["subjective-break"] ? "The target is double; inspect the eye drifting outward." : "Single; both eyes hold fixation.";
  return distanceCm >= npcFindings["subjective-recovery"] ? "Single again; inspect binocular realignment." : "The target remains double.";
}
export type TimedFacility = { start: number; presented: number; side: string; cycles: number };
export const newVergenceFacility = (now: number): TimedFacility => ({ start: now, presented: now, side: "BO", cycles: 0 });
export function flipVergenceFacility(run: TimedFacility, now: number, ready: boolean): TimedFacility {
  if (!ready || now - run.start >= facilityDuration || now - run.presented < vergenceFacilityDelay[run.side as "BI" | "BO"]) return run;
  return { ...run, presented: now, side: run.side === "BO" ? "BI" : "BO", cycles: run.cycles + (run.side === "BI" ? 1 : 0) };
}
export type VergenceCapture = Readonly<{ generation: number; setup: string; label: string; values: Readonly<Record<string, number>>; distanceCm: number; reports: readonly string[] }>;
export function freezeVergenceCapture(generation: number, setup: string, label: string, values: Record<string, number>, distanceCm: number, reports: string[]): VergenceCapture {
  return Object.freeze({ generation, setup, label, values: Object.freeze({ ...values }), distanceCm, reports: Object.freeze([...reports]) });
}
export function numericCaptureSubmission(values: Readonly<Record<string, number>>, entries: Readonly<Record<string, string>>, tolerance = .005): boolean | null {
  if (Object.keys(values).some(key => !entries[key]?.trim() || !Number.isFinite(Number(entries[key])))) return null;
  return Object.entries(values).every(([key, value]) => Math.abs(Number(entries[key]) - value) <= tolerance);
}
