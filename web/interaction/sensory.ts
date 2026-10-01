export type WorthFinding = "fusion" | "suppress-os" | "suppress-od" | "eso" | "exo" | "left-hyper" | "right-hyper";

export const worthReports: Record<WorthFinding, string> = {
  fusion: "Four dots: one red, two green, and one mixed/white.",
  "suppress-os": "Two red dots, arranged vertically.",
  "suppress-od": "Three green dots.",
  eso: "Five dots; the red dots are to the right of the green dots.",
  exo: "Five dots; the red dots are to the left of the green dots.",
  "left-hyper": "Five dots; the red dots are above the green dots.",
  "right-hyper": "Five dots; the red dots are below the green dots.",
};

export function interpretWorth(finding: WorthFinding) {
  return finding === "fusion" ? "flat-fusion" : finding === "suppress-os" ? "left-suppression" : finding === "suppress-od" ? "right-suppression" : finding;
}

export function stereopsisEndpoint(levels: number[], replies: boolean[]) {
  let lastCorrect: number | null = null;
  let wrong = 0;
  for (let index = 0; index < Math.min(levels.length, replies.length); index++) {
    if (replies[index]) { lastCorrect = levels[index]; wrong = 0; }
    else if (++wrong === 2) break;
  }
  return lastCorrect;
}

export type FourPrismFinding = "normal" | "suppression";
export function fourPrismResponse(finding: FourPrismFinding, prismEye: "OD" | "OS") {
  if (finding === "normal") return "Fellow eye moves outward, then makes an inward refixation movement.";
  return prismEye === "OD"
    ? "Fellow eye moves outward, but no inward refixation follows."
    : "No movement of either eye is elicited.";
}
