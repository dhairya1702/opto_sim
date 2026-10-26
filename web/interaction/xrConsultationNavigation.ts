import type { StationId } from "../domain/types";
import { INSTRUMENT_KIT, INSTRUMENT_KIT_FAR_LEG_ARRIVAL, PATIENT_NEAR_STAND_ARRIVAL } from "./clinicLayout";

/** Floor arrivals keep the learner just outside furniture while placing the kit within reach. */
export function consultationXRArrival(id: StationId, desktopPosition: readonly [number, number, number]): [number, number, number] {
  if (id === "patient") return [...PATIENT_NEAR_STAND_ARRIVAL];
  if (id === "trolley" || id === "fundus") return [...INSTRUMENT_KIT.xrArrival];
  if (id === "refraction") return [...INSTRUMENT_KIT_FAR_LEG_ARRIVAL];
  return [desktopPosition[0], 0, desktopPosition[2]];
}
