import { interpretWorth, worthReports, type WorthFinding } from "./sensory";
import { worthAtDistance, worthDots, type WorthCase } from "./worth";

export type WorthEndpoint = "near" | "distance";
export type WorthFilter = "red" | "green";
export type WorthCondition = Readonly<{ distanceCm: number; endpoint: WorthEndpoint | null; facing: boolean }>;
export type XRWorthInput = {
  active: boolean; correction: boolean; glasses: boolean; light: boolean;
  verified: Readonly<Record<WorthFilter, boolean>>; filter: WorthFilter | null;
  condition: WorthCondition;
};
export function xrWorthTechnique(input: XRWorthInput) {
  const filterReady = input.active && input.correction && input.glasses && input.light && input.condition.facing
    && Number.isFinite(input.condition.distanceCm) && input.condition.distanceCm > 0;
  const ready = filterReady && input.verified.red && input.verified.green && !input.filter;
  return { ...input.condition, filterReady, ready, endpointReady: ready && input.condition.endpoint !== null };
}
export type WorthCapture = Readonly<{
  attempt: number; revision: number; endpoint: WorthEndpoint | null; nominalDistanceCm: 40 | 600 | null;
  actualDistanceCm: number; finding: WorthFinding; report: string;
}>;
/** Capture the elicited report, never the subsequently moved target's condition. */
export function captureWorthReport(input: XRWorthInput, scenario: WorthCase, attempt: number, revision: number): WorthCapture | null {
  const technique = xrWorthTechnique(input);
  if (!technique.ready) return null;
  const finding = worthAtDistance(scenario, technique.distanceCm);
  return Object.freeze({ attempt, revision, endpoint: technique.endpoint,
    nominalDistanceCm: technique.endpoint === "near" ? 40 : technique.endpoint === "distance" ? 600 : null,
    actualDistanceCm: technique.distanceCm, finding, report: worthReports[finding] });
}
export function worthCaptureSubmission(capture: WorthCapture | null, count: string, interpretation: string, attempt: number, revision: number) {
  if (!capture?.endpoint || capture.attempt !== attempt || capture.revision !== revision || !count.trim() || !interpretation) return null;
  return Number(count) === worthDots(capture.finding).length && interpretation === interpretWorth(capture.finding);
}
export type WorthRecord = Readonly<{ capture: WorthCapture; submittedCount: string; submittedInterpretation: string }>;
export type WorthRecords = Readonly<Partial<Record<WorthEndpoint, WorthRecord>>>;
export function recordWorthEndpoint(records: WorthRecords, capture: WorthCapture | null, count: string, interpretation: string, attempt: number, revision: number): WorthRecords {
  if (!capture?.endpoint || records[capture.endpoint] || worthCaptureSubmission(capture, count, interpretation, attempt, revision) !== true) return records;
  return Object.freeze({ ...records, [capture.endpoint]: Object.freeze({ capture, submittedCount: count, submittedInterpretation: interpretation }) });
}
export function worthComparisonComplete(records: WorthRecords) { return Boolean(records.near && records.distance); }
