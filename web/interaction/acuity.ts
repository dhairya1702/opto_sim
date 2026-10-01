import type { Eye } from "../domain/types";

export type AcuityToolPose = { x: number; y: number };

// Patient OD appears on the viewer's left; OS appears on the viewer's right.
export function acuityTarget(examId: string, testedEye: Eye): AcuityToolPose {
  const testedX = testedEye === "OD" ? -0.34 : 0.34;
  return {
    x: examId === "pinhole" ? testedX : -testedX,
    y: 0,
  };
}

export function isAcuityToolAligned(
  examId: string,
  testedEye: Eye,
  pose: AcuityToolPose,
) {
  const target = acuityTarget(examId, testedEye);
  const tolerance = examId === "pinhole" ? 0.1 : 0.18;
  return Math.hypot(pose.x - target.x, pose.y - target.y) <= tolerance;
}

export function accumulateAlignedTime(current: number, aligned: boolean, dt: number) {
  if (!aligned) return 0;
  return current + Math.max(0, Math.min(dt, 0.1));
}
