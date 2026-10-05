import type { FixationTarget } from "./motility";
import type { XRPoint3 } from "./xrPupils";

export function xrMotilityTarget(tool: XRPoint3, eyeMidpoint: XRPoint3): {
  target: FixationTarget;
  distanceCm: number;
  distanceReady: boolean;
} {
  const target = {
    x: tool[0] - eyeMidpoint[0],
    y: tool[1] - eyeMidpoint[1],
    z: tool[2] - eyeMidpoint[2],
  };
  const distanceCm = Math.hypot(target.x, target.y, target.z) * 100;
  return { target, distanceCm, distanceReady: distanceCm >= 28 && distanceCm <= 45 && target.z > 0 };
}
