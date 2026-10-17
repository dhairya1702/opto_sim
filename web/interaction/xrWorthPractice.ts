import { interpretWorth, worthReports, type WorthFinding } from "./sensory";
import { worthAtDistance, worthDots, type WorthCase } from "./worth";

export type WorthEndpoint = "near" | "distance";
export type WorthCondition = Readonly<{ distanceCm: number; endpoint: WorthEndpoint | null; facing: boolean }>;
export type XRWorthInput = {
  active: boolean; correction: boolean; glasses: boolean; light: boolean;
  fixationEndpoint?: WorthEndpoint | null;
  condition: WorthCondition;
};
export function xrWorthTechnique(input: XRWorthInput) {
  const setupReady = input.active && input.correction && input.glasses && input.light && input.condition.facing
    && Number.isFinite(input.condition.distanceCm) && input.condition.distanceCm > 0;
  const ready = setupReady && input.condition.endpoint !== null && input.fixationEndpoint === input.condition.endpoint;
  return { ...input.condition, setupReady, ready, endpointReady: ready && input.condition.endpoint !== null };
}

export const WORTH_GUIDED_STEP_COUNT = 12;
export type WorthGuidedState = Readonly<{
  correctionFitted: boolean;
  filtersFitted: boolean;
  targetHandled: boolean;
  targetHeld: boolean;
  powered: boolean;
  condition: WorthCondition;
  fixationEndpoint: WorthEndpoint | null;
  captureEndpoint: WorthEndpoint | null;
  nearRecorded: boolean;
  distanceRecorded: boolean;
}>;
export type WorthGuidedStep = Readonly<{
  id: string;
  index: number;
  title: string;
  lines: readonly string[];
  complete: boolean;
}>;

const guided = (id: string, index: number, title: string, lines: readonly string[], complete = false): WorthGuidedStep =>
  ({ id, index, title, lines, complete });

/** Pure, event/state-driven Worth coach. It never owns findings or interpretation rules. */
export function worthGuidedStep(state: WorthGuidedState): WorthGuidedStep {
  if (state.nearRecorded && state.distanceRecorded)
    return guided("complete", 11, "Worth comparison complete", ["Near and mirrored-distance findings are independently recorded."], true);
  if (!state.correctionFitted)
    return guided("fit-correction", 0, "Fit the patient's correction", ["Pick up the correction frame and fit it at the patient bridge."]);
  if (!state.filtersFitted)
    return guided("fit-filters", 1, "Fit the red-green glasses", ["Fit the filters at the bridge: red over OD and green over OS."]);

  const nearPending = !state.nearRecorded;
  if (nearPending) {
    if (!state.targetHandled && state.condition.endpoint !== "near")
      return guided("pick-up-target", 2, "Pick up the Worth target", ["Find the four-dot target on the instrument tray and use the side grip."]);
    if (state.condition.endpoint !== "near") {
      const correction = !state.condition.facing
        ? "Turn either illuminated face toward Arun."
        : state.condition.distanceCm > 42 ? "Move the target closer to the 40 cm stand."
          : state.condition.distanceCm < 38 ? "Move the target farther from Arun to 40 cm." : "Centre the target on the near stand.";
      return guided("position-near", 3, "Position the near target", [correction, "Release it in the near stand or hold it at the valid endpoint."]);
    }
    if (!state.powered)
      return guided("power-target", 4, "Switch the target on", ["Use your free hand to press the switch on either face, say ‘turn on the target’, or use the board control."]);
    if (state.fixationEndpoint !== "near")
      return guided("fixate-near", 5, "Establish near fixation", ["Ask Arun to look at the illuminated near target."]);
    if (state.captureEndpoint !== "near")
      return guided("elicit-near", 6, "Elicit the near report", ["Ask how many dots he sees, their colours, and their relative positions."]);
    return guided("record-near", 7, "Record the near finding", ["Enter both the dot count and interpretation, then submit the near record."]);
  }

  if (state.condition.endpoint !== "distance") {
    const correction = !state.condition.facing && state.targetHandled
      ? "Seat either illuminated face in the distance dock."
      : "Move the same powered target to the tagged distance dock.";
    return guided("dock-distance", 8, "Place the distance target", [correction, "The mirror provides an illustrative simulated 6 m path."]);
  }
  if (state.fixationEndpoint !== "distance")
    return guided("fixate-distance", 9, "Re-establish distance fixation", ["Ask Arun to look at the target in the mirror."]);
  if (state.captureEndpoint !== "distance")
    return guided("elicit-distance", 10, "Elicit the distance report", ["Ask again for the number, colours, and relative positions."]);
  return guided("record-distance", 11, "Record the distance finding", ["Enter the dot count and interpretation, then submit the distance record."]);
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
