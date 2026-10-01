export type MinusEye = "OD" | "OS";
export const minusLensBlurPower = -4;
// Authored response delay for this fictional patient, not a clinical timing norm.
export const minusLensResponseMs = 1200;
export function nextMinusLens(power: number, direction: "add" | "remove") {
  return Math.max(minusLensBlurPower, Math.min(0, Math.round((power + (direction === "add" ? -0.25 : 0.25)) * 4) / 4));
}
export function minusLensAmplitude(power: number) {
  return Math.abs(power) + 2.5;
}
export function canRecordMinusLens(power: number, settled: boolean, ready: boolean) {
  return ready && settled && power === minusLensBlurPower;
}
