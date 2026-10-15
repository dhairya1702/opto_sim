import { vergenceFindings, vergenceFacilityDelay } from "./vergencePractice";
import { facilityDuration } from "./accommodativeFacility";
export type PrismVergenceKind = "horizontal-near";
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
