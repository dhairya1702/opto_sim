import { expect, it } from "vitest";
import { AUXILIARY_INSTRUMENT_KIT, AUXILIARY_INSTRUMENT_KIT_FAR_LEG_ARRIVAL, INSTRUMENT_KIT, INSTRUMENT_KIT_FAR_LEG_ARRIVAL, PATIENT_NEAR_STAND_ARRIVAL } from "../interaction/clinicLayout";
import { SENSORY_NEAR_TARGET } from "../interaction/xrSensoryEquipment";
import { walkable } from "../interaction/navigation";
import { consultationXRArrival } from "../interaction/xrConsultationNavigation";

it("places each table's floor rings by its two aisle-facing legs, outside the furniture", () => {
  for (const [kit, far] of [[INSTRUMENT_KIT, INSTRUMENT_KIT_FAR_LEG_ARRIVAL], [AUXILIARY_INSTRUMENT_KIT, AUXILIARY_INSTRUMENT_KIT_FAR_LEG_ARRIVAL]] as const) {
    for (const [pad, legZ] of [[kit.xrArrival, kit.z + kit.width / 2 - .05], [far, kit.z - kit.width / 2 + .05]] as const) {
      expect(pad[1]).toBe(0);
      expect(walkable(pad[0], pad[2])).toBe(true);
      expect(pad[2]).toBeCloseTo(legZ);
      expect(Math.abs(pad[0] - kit.x) - kit.depth / 2).toBeGreaterThan(.30);
    }
  }
  expect(consultationXRArrival("trolley", [0, 0, 0])).toEqual(INSTRUMENT_KIT.xrArrival);
  expect(consultationXRArrival("refraction", [0, 0, 0])).toEqual(INSTRUMENT_KIT_FAR_LEG_ARRIVAL);
});

it("puts the central XR arrival within reach of the near stand without entering the chair", () => {
  const arrival = consultationXRArrival("patient", [0, 1.6, 1.15]);
  expect(arrival).toEqual(PATIENT_NEAR_STAND_ARRIVAL);
  expect(walkable(arrival[0], arrival[2])).toBe(true);
  expect(Math.hypot(arrival[0] - .26, arrival[2] - SENSORY_NEAR_TARGET[2])).toBeLessThan(.70);
});
