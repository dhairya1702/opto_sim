import { THORINGTON_CARD_APERTURE_RADIUS_M, THORINGTON_CASES, thoringtonDistanceReady } from "./thoringtonProcedure";

/** Compatibility exports now derive from the shared deterministic procedure. */
export const thoringtonLightAligned = (x: number, y: number) => Math.hypot(x, y) < THORINGTON_CARD_APERTURE_RADIUS_M;
export { thoringtonDistanceReady };
export function thoringtonDirection(axis: "horizontal" | "vertical", coordinate: number) {
  if (coordinate === 0) return "orthophoria";
  return axis === "horizontal" ? coordinate > 0 ? "esophoria" : "exophoria" : coordinate > 0 ? "left-hyperphoria" : "right-hyperphoria";
}
export const thoringtonCoordinate = (axis: "horizontal" | "vertical", index: number) => {
  const authored = THORINGTON_CASES[((index % THORINGTON_CASES.length) + THORINGTON_CASES.length) % THORINGTON_CASES.length];
  return authored.trials.find(value => value.axis === axis)?.signedCoordinate ?? 0;
};
