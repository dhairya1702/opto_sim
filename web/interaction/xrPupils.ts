export type XRPupilEye = "OD" | "OS";
export type XRPoint3 = readonly [number, number, number];

export type XRPupilObservationState = {
  seen: XRPupilEye[];
  eye: XRPupilEye | null;
  dwell: number;
  off: number;
  armed: boolean;
};

export const initialXRPupilObservation = (): XRPupilObservationState => ({
  seen: [], eye: null, dwell: 0, off: .4, armed: true,
});

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

export function xrPupilEyeFromRay(
  origin: XRPoint3,
  forward: XRPoint3,
  targets: Record<XRPupilEye, XRPoint3>,
  maximumAngleDeg = 12,
  distanceRange: readonly [number, number] = [.2, .8],
): XRPupilEye | null {
  let best: { eye: XRPupilEye; angle: number; distance: number } | null = null;
  for (const eye of ["OD", "OS"] as const) {
    const target = targets[eye];
    const x = target[0] - origin[0], y = target[1] - origin[1], z = target[2] - origin[2];
    const distance = Math.hypot(x, y, z);
    if (!distance) continue;
    const forwardLength = Math.hypot(...forward);
    if (!forwardLength) return null;
    const dot = (forward[0] * x + forward[1] * y + forward[2] * z) / (forwardLength * distance);
    const angle = Math.acos(clamp(dot)) * 180 / Math.PI;
    if (!best || angle < best.angle) best = { eye, angle, distance };
  }
  return best && best.angle <= maximumAngleDeg && best.distance >= distanceRange[0] && best.distance <= distanceRange[1]
    ? best.eye
    : null;
}

export function advanceXRPupilObservation(
  state: XRPupilObservationState,
  input: { setupReady: boolean; light: boolean; aimedEye: XRPupilEye | null; dt: number },
): XRPupilObservationState {
  const dt = Math.max(0, Math.min(input.dt, .1));
  if (!input.setupReady || !input.light || !input.aimedEye) {
    const off = !input.light || !input.aimedEye ? state.off + dt : 0;
    return { ...state, eye: null, dwell: 0, off, armed: state.armed || off >= .35 };
  }
  if (!state.armed || state.seen.includes(input.aimedEye)) return { ...state, off: 0 };
  const dwell = state.eye === input.aimedEye ? state.dwell + dt : dt;
  if (dwell < .8 - 1e-9) return { ...state, eye: input.aimedEye, dwell, off: 0 };
  return {
    seen: [...state.seen, input.aimedEye],
    eye: null,
    dwell: 0,
    off: 0,
    armed: false,
  };
}
