import type { StationId } from "../domain/types";

/** Floor arrivals for arm's-reach interaction; desktop camera destinations stay unchanged. */
export function consultationXRArrival(id: StationId, desktopPosition: readonly [number, number, number]): [number, number, number] {
  if (id === "trolley" || id === "fundus") return [-1.37, 0, 1.27];
  if (id === "refraction") return [-1.45, 0, -.45];
  return [desktopPosition[0], 0, desktopPosition[2]];
}
