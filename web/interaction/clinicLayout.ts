/** Shared metre-scale room coordinates used by desktop, preview, and immersive XR. */
export const INSTRUMENT_KIT = {
  x: -1.47,
  z: .65,
  width: 2,
  depth: .60,
  surfaceY: .8775,
  lowerShelfY: .4175,
  xrArrival: [-.70, 0, .82] as const,
  desktopPosition: [-.48, 1.6, 1.32] as const,
  lookAt: [-1.47, .96, .65] as const,
};

export const INSTRUMENT_KIT_ROTATION_Y = Math.PI / 2;

export const AUXILIARY_INSTRUMENT_KIT = {
  x: 1.47,
  z: .65,
  width: 2,
  depth: .60,
  surfaceY: .8775,
  lowerShelfY: .4175,
  xrArrival: [.70, 0, .82] as const,
  desktopPosition: [.48, 1.6, 1.32] as const,
  lookAt: [1.47, .96, .65] as const,
};

export const AUXILIARY_INSTRUMENT_KIT_ROTATION_Y = -Math.PI / 2;

/** Rotate a kit-local point counterclockwise around the trolley centre. */
export function instrumentKitPoint(x: number, y: number, z: number): [number, number, number] {
  const cosine = Math.cos(INSTRUMENT_KIT_ROTATION_Y);
  const sine = Math.sin(INSTRUMENT_KIT_ROTATION_Y);
  return [
    INSTRUMENT_KIT.x + cosine * x + sine * z,
    y,
    INSTRUMENT_KIT.z - sine * x + cosine * z,
  ];
}

/** Mirror the extended inventory cart onto the patient's learner-right side. */
export function auxiliaryInstrumentKitPoint(x: number, y: number, z: number): [number, number, number] {
  const cosine = Math.cos(AUXILIARY_INSTRUMENT_KIT_ROTATION_Y);
  const sine = Math.sin(AUXILIARY_INSTRUMENT_KIT_ROTATION_Y);
  return [
    AUXILIARY_INSTRUMENT_KIT.x + cosine * x + sine * z,
    y,
    AUXILIARY_INSTRUMENT_KIT.z - sine * x + cosine * z,
  ];
}
