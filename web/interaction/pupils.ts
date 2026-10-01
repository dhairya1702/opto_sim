export type PupilEye = "OD" | "OS";
export type PupilToolPose = { x: number; y: number };

export const pupilTargets: Record<PupilEye, PupilToolPose> = {
  OD: { x: -0.34, y: 0 },
  OS: { x: 0.34, y: 0 },
};

export function pupilEyeAt(pose: PupilToolPose): PupilEye | null {
  if (Math.abs(pose.y) > 0.28) return null;
  const od = Math.abs(pose.x - pupilTargets.OD.x);
  const os = Math.abs(pose.x - pupilTargets.OS.x);
  const closest = od <= os ? "OD" : "OS";
  return Math.min(od, os) <= 0.2 ? closest : null;
}

export function pupilRadiusTarget(ambient: number, stimulus: number) {
  const room = Math.max(0, Math.min(1, ambient));
  const light = Math.max(0, Math.min(1, stimulus));
  return Math.max(0.013, Math.min(0.032, 0.031 - room * 0.006 - light * 0.013));
}

export const rapdPattern: PupilEye[] = ["OD", "OS", "OD", "OS"];

export function generalResponseLabels(eye: PupilEye) {
  return eye === "OD" ? ["OD direct", "OS consensual"] : ["OS direct", "OD consensual"];
}

export type NearPupilTarget = { x: number; y: number; distanceCm: number };

export const nearPupilProcedure = [
  { id: "distance", label: "Establish distance fixation", dwell: 0.7 },
  { id: "near", label: "Hold target at 40 cm", dwell: 0.8 },
  { id: "close", label: "Move target toward 20 cm", dwell: 0.8 },
  { id: "recovery", label: "Return target beyond 60 cm", dwell: 0.7 },
] as const;

export function nearPupilStageMatches(index: number, target: NearPupilTarget) {
  const centred = Math.hypot(target.x, target.y) <= 0.18;
  if (!centred) return false;
  if (index === 0 || index === 3) return target.distanceCm >= 60;
  if (index === 1) return Math.abs(target.distanceCm - 40) <= 3;
  if (index === 2) return target.distanceCm >= 16 && target.distanceCm <= 23;
  return false;
}

export function advanceNearPupilStep(
  index: number,
  dwell: number,
  target: NearPupilTarget,
  dt: number,
) {
  if (index >= nearPupilProcedure.length) return { index, dwell: 0 };
  if (!nearPupilStageMatches(index, target)) return { index, dwell: 0 };
  const nextDwell = dwell + Math.max(0, Math.min(dt, 0.1));
  return nextDwell >= nearPupilProcedure[index].dwell
    ? { index: index + 1, dwell: 0 }
    : { index, dwell: nextDwell };
}

export function nearResponseStimulus(distanceCm: number) {
  const distance = Math.max(15, Math.min(70, distanceCm));
  return Math.max(0, Math.min(0.75, (60 - distance) / 48));
}
