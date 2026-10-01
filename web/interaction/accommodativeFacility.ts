export type FacilityEye = "OD" | "OS" | "OU";
export type FacilitySide = "plus" | "minus";
export const facilityDuration = 60_000;
// Fictional response pacing; these are not clinical norms.
export const facilityClearDelay: Record<FacilitySide, number> = { plus: 1500, minus: 1800 };
export function facilityRemaining(start: number, now: number) {
  return Math.max(0, Math.ceil((facilityDuration - (now - start)) / 1000));
}
export function facilityCanFlip(start: number, presented: number, now: number, side: FacilitySide) {
  return now - start < facilityDuration && now - presented >= facilityClearDelay[side];
}
export function facilityNext(side: FacilitySide, cycles: number) {
  return { side: side === "plus" ? "minus" as const : "plus" as const, cycles: cycles + (side === "minus" ? 1 : 0) };
}
