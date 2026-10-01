export type CoverEye = "OD" | "OS";
export type CoverPosition = CoverEye | "away";
export type CoverToolPose = { x: number; y: number };

export const coverTargets: Record<CoverEye, CoverToolPose> = {
  OD: { x: -0.34, y: 0 },
  OS: { x: 0.34, y: 0 },
};

export function coverFixationTarget(distanceCm: number) {
  return { x: 0, y: 0, z: Math.max(0.25, Math.min(6, distanceCm / 100)) };
}

export const coverProcedure = [
  { position: "OD", phase: "cover-uncover", label: "Cover OD · observe OS", dwell: 0.7 },
  { position: "away", phase: "cover-uncover", label: "Uncover OD · observe OD", dwell: 0.35 },
  { position: "OS", phase: "cover-uncover", label: "Cover OS · observe OD", dwell: 0.7 },
  { position: "away", phase: "cover-uncover", label: "Uncover OS · observe OS", dwell: 0.35 },
  { position: "OD", phase: "alternate", label: "Alternate · OD", dwell: 0.55 },
  { position: "OS", phase: "alternate", label: "Alternate · OS", dwell: 0.55 },
  { position: "OD", phase: "alternate", label: "Alternate · OD", dwell: 0.55 },
  { position: "OS", phase: "alternate", label: "Alternate · OS", dwell: 0.55 },
  { position: "away", phase: "alternate", label: "Remove occluder", dwell: 0.35 },
] as const satisfies readonly { position: CoverPosition; phase: string; label: string; dwell: number }[];

export function coverPositionAt(pose: CoverToolPose): CoverPosition | null {
  if (pose.y < -0.48 || Math.abs(pose.x) > 0.78) return "away";
  if (Math.abs(pose.y) > 0.27) return null;
  const od = Math.abs(pose.x - coverTargets.OD.x);
  const os = Math.abs(pose.x - coverTargets.OS.x);
  if (Math.min(od, os) > 0.2) return null;
  return od <= os ? "OD" : "OS";
}

export function advanceCoverStep(
  index: number,
  dwell: number,
  position: CoverPosition | null,
  dt: number,
) {
  if (index >= coverProcedure.length) return { index, dwell: 0 };
  const step = coverProcedure[index];
  if (position !== step.position) return { index, dwell: 0 };
  const nextDwell = dwell + Math.max(0, Math.min(dt, 0.1));
  return nextDwell >= step.dwell
    ? { index: index + 1, dwell: 0 }
    : { index, dwell: nextDwell };
}
