export type RelativePhase = "nra" | "baseline" | "pra" | "done";
export type RelativeState = { phase: RelativePhase; power: number; nra: number | null; pra: number | null };
export const initialRelativeState: RelativeState = { phase: "nra", power: 0, nra: null, pra: null };
export function relativeStep(state: RelativeState): RelativeState {
  if (state.phase === "nra") return { ...state, power: Math.min(2, state.power + 0.25) };
  if (state.phase === "baseline") return { ...state, power: Math.max(0, state.power - 0.25) };
  if (state.phase === "pra") return { ...state, power: Math.max(-2.25, state.power - 0.25) };
  return state;
}
export function relativeBlur(state: RelativeState) {
  return state.phase === "nra" && state.power === 2 || state.phase === "pra" && state.power === -2.25;
}
export function recordRelative(state: RelativeState, settled: boolean): RelativeState {
  if (!settled) return state;
  if (state.phase === "baseline" && state.power === 0) return { ...state, phase: "pra" };
  if (!relativeBlur(state)) return state;
  return state.phase === "nra" ? { ...state, nra: state.power, phase: "baseline" } : { ...state, pra: state.power, phase: "done" };
}
