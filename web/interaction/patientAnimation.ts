export const PATIENT_BLINK_DURATION_SECONDS = 0.18;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** Smooth closure for one short blink; elapsed time is measured from blink start. */
export function patientBlinkClosure(
  elapsedSeconds: number,
  durationSeconds = PATIENT_BLINK_DURATION_SECONDS,
) {
  if (!Number.isFinite(elapsedSeconds) || !Number.isFinite(durationSeconds) || durationSeconds <= 0
    || elapsedSeconds <= 0 || elapsedSeconds >= durationSeconds) return 0;
  return Math.sin(Math.PI * clamp01(elapsedSeconds / durationSeconds));
}

/** Varies the next blink interval without allowing implausibly rapid or long gaps. */
export function patientBlinkDelay(randomUnit: number) {
  return 2.6 + clamp01(randomUnit) * 3.8;
}

/** Procedural, non-phoneme lip motion used only while patient audio is playing. */
export function patientMouthTarget(elapsedSeconds: number, speaking: boolean, reducedMotion = false) {
  if (!speaking) return 0;
  if (reducedMotion) return 0.38;
  const primary = (Math.sin(elapsedSeconds * 11.3) + 1) * 0.5;
  const secondary = (Math.sin(elapsedSeconds * 17.1 + 1.2) + 1) * 0.5;
  return 0.16 + 0.66 * (primary * 0.68 + secondary * 0.32);
}
