import { maddoxTrials, maddoxRotationCorrect } from "./maddoxPractice";
import { thoringtonCoordinate, thoringtonDirection } from "./thorington";
export type PhoriaCapture = Readonly<{ generation: number; setup: string; trial: number; distanceCm: number; power: number; direction: string; report: string }>;
export function xrMaddoxReport(trial: number, power: number) {
  const authored = maddoxTrials[trial];
  if (!authored) return "Measurement complete.";
  const offset = (power - authored.neutral) * 8;
  return offset === 0 ? "The streak passes through the light." : `The streak is ${authored.axis === "horizontal" ? offset > 0 ? "right" : "left" : offset > 0 ? "below" : "above"} of the light.`;
}
export function capturePhoria(input: { kind: "maddox" | "thorington"; trial: number; pattern: number; ready: boolean; started: boolean; power: number; base: string; angle: number; distanceCm: number; generation: number; setup: string }): PhoriaCapture | null {
  if (!input.ready) return null;
  if (input.kind === "maddox") {
    const finding = maddoxTrials[input.trial];
    if (!finding || !input.started || input.power !== finding.neutral || input.base !== finding.base || !maddoxRotationCorrect(finding.axis, input.angle)) return null;
    return Object.freeze({ generation: input.generation, setup: input.setup, trial: input.trial, distanceCm: input.distanceCm, power: input.power, direction: input.base, report: xrMaddoxReport(input.trial, input.power) });
  }
  const axis = input.trial === 0 ? "horizontal" : "vertical";
  if (!maddoxRotationCorrect(axis, input.angle)) return null;
  const coordinate = thoringtonCoordinate(axis, input.pattern);
  const direction = axis === "horizontal" ? coordinate > 0 ? "right" : "left" : coordinate > 0 ? "above" : "below";
  return Object.freeze({ generation: input.generation, setup: input.setup, trial: input.trial, distanceCm: input.distanceCm, power: Math.abs(coordinate), direction: thoringtonDirection(axis, coordinate), report: `The streak crosses ${Math.abs(coordinate)}, ${direction} of the light.` });
}
export function phoriaSubmission(capture: PhoriaCapture | null, power: string, direction: string | undefined, kind: "maddox" | "thorington") {
  if (!capture || power.trim() === "" || !Number.isFinite(Number(power)) || kind === "thorington" && !direction) return null;
  return Number(power) === capture.power && (kind === "maddox" || direction === capture.direction);
}
