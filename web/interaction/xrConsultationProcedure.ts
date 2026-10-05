import type { XRCoverState } from "./xrCover";
import type { MotilityCoverage } from "./motility";
import type { XRPupilObservationState } from "./xrPupils";

/** Interrupt current sampling, retaining completed observations and ordered steps. */
export function pauseConsultationTechnique(state: {
  pupils: XRPupilObservationState;
  cover: XRCoverState;
  motility: MotilityCoverage;
}) {
  return {
    pupils: { ...state.pupils, eye: null, dwell: 0 },
    cover: { ...state.cover, dwell: 0 },
    motility: { ...state.motility, current: null, dwell: 0 },
  };
}
