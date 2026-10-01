export function thoringtonLightAligned(x: number, y: number) { return Math.hypot(x, y) <= 0.06; }
export function thoringtonDistanceReady(distance: number) { return Math.abs(distance - 40) <= 2; }
export function thoringtonDirection(axis: "horizontal" | "vertical", coordinate: number) {
  if (coordinate === 0) return "orthophoria";
  // Coordinates are patient-view: positive x is right, positive y is above.
  return axis === "horizontal" ? coordinate > 0 ? "esophoria" : "exophoria" : coordinate > 0 ? "left-hyperphoria" : "right-hyperphoria";
}
