import type { CoverPosition } from "./cover";

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

export const alternateCoverScenarios = [
  { id: "exo12", movement: "in", deviation: "exo", base: "base-in", amount: 12 },
  { id: "eso18", movement: "out", deviation: "eso", base: "base-out", amount: 18 },
  { id: "hypo8", movement: "up", deviation: "hypo", base: "base-up", amount: 8 },
  { id: "hyper10", movement: "down", deviation: "hyper", base: "base-down", amount: 10 },
] as const satisfies readonly { id: string; movement: EyeMovement; deviation: string; base: PrismBase; amount: number }[];

export function deviationForMovement(movement: EyeMovement) {
  return movement === "in" ? "exo" : movement === "out" ? "eso" : movement === "up" ? "hypo" : movement === "down" ? "hyper" : "none";
}

export function prismBaseForDeviation(deviation: string): PrismBase | null {
  return deviation === "exo" ? "base-in" : deviation === "eso" ? "base-out" : deviation === "hypo" ? "base-up" : deviation === "hyper" ? "base-down" : null;
}

export function advancePracticeCoverStep(kind: PracticeCoverKind, index: number, dwell: number, position: CoverPosition | null, dt: number) {
  const procedure = practiceCoverProcedures[kind];
  if (index >= procedure.length) return { index, dwell: 0 };
  const step = procedure[index];
  if (position !== step.position) return { index, dwell: 0 };
  const nextDwell = dwell + Math.max(0, Math.min(dt, .1));
  return nextDwell >= step.dwell ? { index: index + 1, dwell: 0 } : { index, dwell: nextDwell };
}

export function prismTrialNeutralizes(scenario: typeof alternateCoverScenarios[number], base: string, amount: number) {
  return base === scenario.base && amount === scenario.amount;
}
