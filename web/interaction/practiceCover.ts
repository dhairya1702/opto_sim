import type { CoverEye, CoverPosition } from "./cover";
import { alternateCoverNeutralized, deviationFromLabel, type CoverDeviationModel } from "./coverDeviation";

export type PracticeCoverKind = "cover-uncover" | "alternate-cover";
export type EyeMovement = "none" | "in" | "out" | "up" | "down";
export type PrismBase = "base-in" | "base-out" | "base-up" | "base-down";

export const practiceCoverProcedures = {
  "cover-uncover": [
    { position: "OD", label: "Cover OD · watch OS", dwell: .8 },
    { position: "away", label: "Uncover OD · watch OD immediately", dwell: .45 },
    { position: "OS", label: "Cover OS · watch OD", dwell: .8 },
    { position: "away", label: "Uncover OS · watch OS immediately", dwell: .45 },
  ],
  "alternate-cover": [
    { position: "OD", label: "Cover OD · keep fusion broken", dwell: .65 },
    { position: "OS", label: "Shift directly to OS", dwell: .65 },
    { position: "OD", label: "Shift directly to OD", dwell: .65 },
    { position: "OS", label: "Shift directly to OS", dwell: .65 },
  ],
} as const satisfies Record<PracticeCoverKind, readonly { position: CoverPosition; label: string; dwell: number }[]>;

/** One attempt covers OD and OS once; each prism power is checked twice. */
export const ALTERNATE_COVER_ATTEMPTS_PER_PRISM = 2;
export const ALTERNATE_COVER_MOVES_PER_ATTEMPT = 2;
export function alternateCoverAttemptNumber(sequenceIndex: number) {
  return Math.min(ALTERNATE_COVER_ATTEMPTS_PER_PRISM,
    Math.floor(Math.max(0, sequenceIndex) / ALTERNATE_COVER_MOVES_PER_ATTEMPT) + 1);
}

/**
 * Alternating-cover findings. `movement` is the refixation of OD when it is uncovered; horizontal
 * deviations move both eyes alike, vertical deviations move the eyes in opposite directions.
 * The eye assignment of the vertical cases (right hypo / right hyper) is a draft choice pending
 * clinical review (docs/clinical-review.md). Neutralisation is computed from the eye model, so either
 * correct option is accepted (for a right hypo: base up before OD, or base down before OS).
 */
export const alternateCoverScenarios = [
  { id: "exo12", movement: "in", deviation: "exo", amount: 12 },
  { id: "eso18", movement: "out", deviation: "eso", amount: 18 },
  { id: "r-hypo8", movement: "up", deviation: "r-hypo", amount: 8 },
  { id: "r-hyper10", movement: "down", deviation: "r-hyper", amount: 10 },
] as const satisfies readonly { id: string; movement: EyeMovement; deviation: AlternateDeviation; amount: number }[];
export type AlternateDeviation = "exo" | "eso" | "r-hyper" | "r-hypo";
export const alternateDeviationChoices: readonly (readonly [AlternateDeviation, string])[] = [
  ["exo", "Exo"], ["eso", "Eso"], ["r-hyper", "R hyper / L hypo"], ["r-hypo", "R hypo / L hyper"],
];
export const alternateDeviationLabel = (deviation: string) => alternateDeviationChoices.find(([id]) => id === deviation)?.[1] ?? deviation;
export const prismBaseLabel = (base: string) => base.replace("-", " ");

/** Correct neutralising base for the selected eye in an authored alternating-cover scenario. */
export function neutralizingPrismBase(scenario: typeof alternateCoverScenarios[number], eye: CoverEye): PrismBase {
  if (scenario.deviation === "exo") return "base-in";
  if (scenario.deviation === "eso") return "base-out";
  if (scenario.deviation === "r-hypo") return eye === "OD" ? "base-up" : "base-down";
  return eye === "OD" ? "base-down" : "base-up";
}

export type PrismTrialOutcome = "change-base" | "increase" | "reduce" | "neutral";
/** Guided feedback after two complete OD/OS attempts at one prism setting. */
export function prismTrialOutcome(scenario: typeof alternateCoverScenarios[number], base: string, amount: number, eye: CoverEye): PrismTrialOutcome {
  if (base !== neutralizingPrismBase(scenario, eye)) return "change-base";
  if (amount < scenario.amount) return "increase";
  if (amount > scenario.amount) return "reduce";
  return "neutral";
}

/** Interpretation of OD's refixation on uncovering. */
export function deviationForMovement(movement: EyeMovement): AlternateDeviation | "none" {
  return movement === "in" ? "exo" : movement === "out" ? "eso" : movement === "up" ? "r-hypo" : movement === "down" ? "r-hyper" : "none";
}

export function advancePracticeCoverStep(kind: PracticeCoverKind, index: number, dwell: number, position: CoverPosition | null, dt: number) {
  const procedure = practiceCoverProcedures[kind];
  if (index >= procedure.length) return { index, dwell: 0 };
  const step = procedure[index];
  if (position !== step.position) return { index, dwell: 0 };
  const nextDwell = dwell + Math.max(0, Math.min(dt, .1));
  return nextDwell >= step.dwell ? { index: index + 1, dwell: 0 } : { index, dwell: nextDwell };
}

export const alternateCoverModel = (scenario: typeof alternateCoverScenarios[number]): CoverDeviationModel =>
  ({ kind: "phoria", deviation: deviationFromLabel(scenario.deviation, scenario.amount) });
/** True when the prism before `eye` leaves no refixation movement on alternating cover. */
export function prismTrialNeutralizes(scenario: typeof alternateCoverScenarios[number], base: string, amount: number, eye: CoverEye) {
  return Boolean(base) && alternateCoverNeutralized(alternateCoverModel(scenario), { eye, base, power: amount });
}

// Magnitudes for the cover–uncover patterns are illustrative draft values pending clinical review
// (docs/clinical-review.md). They drive the sustained eye positions only; the answer remains the pattern.
export const coverScenarios = [
  { id: "orthophoria", label: "Orthophoria", feedback: "No movement was seen on covering or uncovering either eye.",
    model: { kind: "none" } },
  { id: "left-esotropia", label: "Left unilateral esotropia", feedback: "When OD was covered, OS moved outward to take fixation and returned inward when OD was uncovered.",
    model: { kind: "tropia", deviatingEye: "OS", deviation: { h: -20, v: 0 } } },
  { id: "exophoria", label: "Exophoria", feedback: "The covered eye drifted outward after fusion was broken, then moved inward to refixate immediately on uncovering.",
    model: { kind: "phoria", deviation: { h: 10, v: 0 } } },
] as const satisfies readonly { id: string; label: string; feedback: string; model: CoverDeviationModel }[];
