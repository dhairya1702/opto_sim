export const stereoPracticeLevels = [800, 400, 200, 100, 60, 40];
export const stereoTargets = [1, 0, 2, 1, 2, 0];
export type StereoReply = { level: number; selected: number; target: number; correct: boolean };
export function stereoStopped(replies: StereoReply[]) {
  return replies.length >= 2 && replies.slice(-2).every(reply => !reply.correct);
}
export function stereoPatientReply(index: number): StereoReply | null {
  if (index < 0 || index >= stereoPracticeLevels.length) return null;
  const target = stereoTargets[index];
  // Fictional patient resolves through 100 arcsec; finer levels receive wrong selections.
  const selected = index < 4 ? target : (target + 1) % 3;
  return { level: stereoPracticeLevels[index], target, selected, correct: selected === target };
}
export function stereoLastCorrect(replies: StereoReply[]) {
  return [...replies].reverse().find(reply => reply.correct)?.level ?? null;
}
