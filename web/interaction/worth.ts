import type { WorthFinding } from "./sensory";
export type WorthCase = WorthFinding | "central-os";
export const worthCases: WorthCase[] = ["central-os", "fusion", "suppress-os", "suppress-od", "eso", "exo", "left-hyper", "right-hyper"];
// Fictional fixed-size-target scenario, not a scotoma measurement or clinical cutoff.
export function worthAtDistance(scenario: WorthCase, distance: number): WorthFinding {
  return scenario === "central-os" ? distance >= 200 ? "suppress-os" : "fusion" : scenario;
}
export type WorthDot = { x: number; y: number; color: string };
export function worthDots(finding: WorthFinding): WorthDot[] {
  if (finding === "fusion") return [{ x: 0, y: -35, color: "#ff5757" }, { x: -35, y: 0, color: "#48e88c" }, { x: 35, y: 0, color: "#48e88c" }, { x: 0, y: 35, color: "#fff2cf" }];
  const red = [{ x: 0, y: -35, color: "#ff5757" }, { x: 0, y: 35, color: "#ff5757" }];
  const green = [{ x: -35, y: 0, color: "#48e88c" }, { x: 35, y: 0, color: "#48e88c" }, { x: 0, y: 35, color: "#48e88c" }];
  if (finding === "suppress-os") return red;
  if (finding === "suppress-od") return green;
  const dx = finding === "eso" ? 60 : finding === "exo" ? -60 : 0;
  const dy = finding === "left-hyper" ? -75 : finding === "right-hyper" ? 75 : 0;
  return [...red.map(dot => ({ ...dot, x: dot.x + dx, y: dot.y + dy })), ...green.map(dot => ({ ...dot, x: dot.x - dx, y: dot.y - dy }))];
}
