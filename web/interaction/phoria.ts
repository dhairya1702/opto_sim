export type PhoriaAxis = "horizontal" | "vertical";

export function maddoxStreakOffset(axis: PhoriaAxis, prism: number, neutral: number) {
  return Math.max(-1, Math.min(1, (prism - neutral) / 12));
}

export function thoringtonFinding(axis: PhoriaAxis, signedNumber: number) {
  if (signedNumber === 0) return "orthophoria";
  if (axis === "horizontal") return signedNumber > 0 ? "esophoria" : "exophoria";
  return signedNumber > 0 ? "left-hyperphoria" : "right-hyperphoria";
}

export function rodOrientationCorrect(axis: PhoriaAxis, grooves: PhoriaAxis) {
  return axis === grooves;
}
