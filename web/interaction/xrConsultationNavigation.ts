import type { StationId } from "../domain/types";
import { INSTRUMENT_KIT } from "./clinicLayout";

/** Floor arrivals keep the learner just outside furniture while placing the kit within reach. */
export function consultationXRArrival(id: StationId, desktopPosition: readonly [number, number, number]): [number, number, number] {
  if (id === "trolley" || id === "fundus") return [...INSTRUMENT_KIT.xrArrival];
  if (id === "refraction") return [-.78, 0, -.45];
  return [desktopPosition[0], 0, desktopPosition[2]];
}
