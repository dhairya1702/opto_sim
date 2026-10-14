export type BrucknerScenario = "equal" | "od" | "os";
export type BrucknerEye = "od" | "os";
export type BrucknerReflexLevel = "dim" | "equal" | "bright";

/**
 * Keep every Bruckner reflex in one red-orange family. The authored finding is
 * communicated by luminance and glow only, never by assigning a different hue
 * to one eye.
 */
export const BRUCKNER_REFLEX_VISUALS = {
  dim: { color: "#9a3213", halo: "#85290f", glow: "#a83a17", opacity: .78, glowIntensity: .55 },
  equal: { color: "#c84219", halo: "#a63713", glow: "#cd451d", opacity: .9, glowIntensity: .9 },
  bright: { color: "#e76a40", halo: "#ca4e27", glow: "#df5b31", opacity: 1, glowIntensity: 1.5 },
} as const satisfies Record<BrucknerReflexLevel, {
  color: string;
  halo: string;
  glow: string;
  opacity: number;
  glowIntensity: number;
}>;

export function brucknerReflexVisual(scenario: BrucknerScenario, eye: BrucknerEye) {
  const level: BrucknerReflexLevel = scenario === "equal" ? "equal" : scenario === eye ? "bright" : "dim";
  return { level, ...BRUCKNER_REFLEX_VISUALS[level] };
}

export const brucknerScenarios: Record<BrucknerScenario, { label: string; answer: string }> = {
  equal: { label: "Equal reflexes", answer: "Reflexes appear equally bright; binocular fixation is supported by this screening observation." },
  od: { label: "OD brighter", answer: "The reflex from OD appears brighter. Record OD as the brighter reflex and investigate possible causes." },
  os: { label: "OS brighter", answer: "The reflex from OS appears brighter. Record OS as the brighter reflex and investigate possible causes." },
};
