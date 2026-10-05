import type { XRClinicProcedureConfig } from "../../interaction/xrClinic";

/**
 * Procedure layers declare requirements only. The shared clinic runtime owns
 * locomotion, hands, instruments, spatial poses, and return behavior.
 */
export const HIRSCHBERG_XR_PROCEDURE: XRClinicProcedureConfig = {
  id: "hirschberg",
  label: "Hirschberg test",
  stationId: "patient-chair",
  requiredToolIds: ["penlight"],
  requiredActions: [
    "select-tool",
    "position-at-patient",
    "give-fixation-instruction",
    "establish-distance",
    "align-instrument",
    "align-view",
    "observe",
    "record",
    "return-tool",
  ],
};
