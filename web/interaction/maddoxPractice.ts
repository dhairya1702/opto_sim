export type MaddoxAxis = "horizontal" | "vertical";
export const maddoxTrials = [
  { site: "distance", axis: "horizontal", neutral: 6, base: "BI" },
  { site: "distance", axis: "vertical", neutral: 4, base: "BU" },
  { site: "near", axis: "horizontal", neutral: 6, base: "BI" },
  { site: "near", axis: "vertical", neutral: 4, base: "BU" },
] as const;
export function maddoxAligned(x: number, y: number) { return Math.hypot(x + 0.22, y - 0.2) <= 0.075; }
export function maddoxRotationCorrect(axis: MaddoxAxis, degrees: number) {
  return axis === "horizontal" ? degrees === 0 || degrees === 180 : degrees === 90;
}
export function maddoxCanRecord(setup: boolean, started: boolean, power: number, neutral: number) {
  return setup && started && power === neutral;
}
