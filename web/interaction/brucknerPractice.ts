export type BrucknerScenario = "equal" | "od" | "os";
export const brucknerScenarios: Record<BrucknerScenario, { label: string; answer: string }> = {
  equal: { label: "Equal reflexes", answer: "Reflexes appear equally bright; binocular fixation is supported by this screening observation." },
  od: { label: "OD brighter", answer: "The reflex from OD appears brighter. Record OD as the brighter reflex and investigate possible causes." },
  os: { label: "OS brighter", answer: "The reflex from OS appears brighter. Record OS as the brighter reflex and investigate possible causes." },
};
