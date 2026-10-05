import { advanceCoverStep, coverProcedure, type CoverPosition } from "./cover";
import type { XRPoint3, XRPupilEye } from "./xrPupils";

export type XRCoverState = { index: number; dwell: number };

export const initialXRCoverState = (): XRCoverState => ({ index: 0, dwell: 0 });

export function xrCoverFixationMode(
  target: XRPoint3,
  eyes: Record<XRPupilEye, XRPoint3>,
): { distanceCm: number; centred: boolean; mode: "near" | "distance" | null } {
  const midpoint: XRPoint3 = [
    (eyes.OD[0] + eyes.OS[0]) / 2,
    (eyes.OD[1] + eyes.OS[1]) / 2,
    (eyes.OD[2] + eyes.OS[2]) / 2,
  ];
  const dx = target[0] - midpoint[0], dy = target[1] - midpoint[1], dz = target[2] - midpoint[2];
  const distanceCm = Math.hypot(dx, dy, dz) * 100;
  const centred = Math.hypot(dx, dy) <= .2 && dz > .15;
  const mode = centred && distanceCm >= 32 && distanceCm <= 52
    ? "near"
    : centred && distanceCm >= 70
      ? "distance"
      : null;
  return { distanceCm, centred, mode };
}

export function xrCoverPositionAt(
  tool: XRPoint3,
  targets: Record<XRPupilEye, XRPoint3>,
): CoverPosition | null {
  const distanceTo = (eye: XRPupilEye) => Math.hypot(
    tool[0] - targets[eye][0],
    tool[1] - targets[eye][1],
    tool[2] - targets[eye][2],
  );
  const od = distanceTo("OD");
  const os = distanceTo("OS");
  const nearest = Math.min(od, os);
  if (nearest <= .13 && tool[2] >= targets.OD[2] - .03) return od <= os ? "OD" : "OS";
  if (nearest >= .2) return "away";
  return null;
}

export function advanceXRCoverState(state: XRCoverState, position: CoverPosition | null, dt: number) {
  return advanceCoverStep(state.index, state.dwell, position, dt);
}

export function xrCoverComplete(state: XRCoverState) {
  return state.index === coverProcedure.length;
}
