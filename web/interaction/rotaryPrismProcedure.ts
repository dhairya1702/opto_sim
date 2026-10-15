export type RotaryPrismDirection = "increase" | "decrease";
export type RotaryPrismBase = "BI" | "BU" | "BO" | "BD";

export type RotaryPrismTrace = Readonly<{
  samples: readonly Readonly<{ nowMs: number; power: number }>[];
  direction: RotaryPrismDirection | null;
  creditPower: number | null;
  creditAtMs: number | null;
  pauseSinceMs: number | null;
  valid: boolean;
  lastIssue: string;
}>;

export const ROTARY_PRISM_MAX_DELTA = 30;
export const ROTARY_PRISM_STABILITY_MS = 250;
export const ROTARY_PRISM_ENDPOINT_WINDOW = .5;
export const ROTARY_PRISM_MIN_SPEED = .5;
export const ROTARY_PRISM_MAX_SPEED = 5;
export const ROTARY_PRISM_JITTER = .2;
export const ROTARY_PRISM_MAX_PAUSE_MS = 1000;
export const ROTARY_PRISM_REVERSAL = .5;
export const ROTARY_PRISM_JUMP = 2;
export const ROTARY_PRISM_ZERO_WINDOW = .2;
export const ROTARY_PRISM_DIAL_SWEEP_RAD = Math.PI * 1.5;
export const ROTARY_PRISM_ROLL_TOLERANCE_RAD = Math.PI / 6;

export const roundedRotaryPower = (power: number) =>
  Math.round(Math.max(0, Math.min(ROTARY_PRISM_MAX_DELTA, power)) * 10) / 10;
export const rotaryPowerInWindow = (power: number, expected: number) =>
  Math.abs(power - expected) <= ROTARY_PRISM_ENDPOINT_WINDOW + 1e-8;
export const rotaryPowerAtZero = (power: number) => power <= ROTARY_PRISM_ZERO_WINDOW + 1e-8;

export function newRotaryPrismTrace(direction: RotaryPrismTrace["direction"] = null, issue = ""): RotaryPrismTrace {
  return Object.freeze({ samples: Object.freeze([]), direction, creditPower: null, creditAtMs: null,
    pauseSinceMs: null, valid: !issue, lastIssue: issue });
}

export function appendRotaryPrismTrace(trace: RotaryPrismTrace, nowMs: number, power: number, credit = false): RotaryPrismTrace {
  const reading = roundedRotaryPower(power);
  return Object.freeze({ ...trace,
    samples: Object.freeze([...trace.samples, Object.freeze({ nowMs, power: reading })].slice(-240)),
    creditPower: credit || trace.creditPower === null ? reading : trace.creditPower,
    creditAtMs: credit || trace.creditAtMs === null ? nowMs : trace.creditAtMs,
  });
}

export type RotaryMotionResult = Readonly<{
  trace: RotaryPrismTrace;
  endpointStableSinceMs: number | null;
  capture: boolean;
  resetIssue: string;
  atEndpoint: boolean;
  advanced: boolean;
}>;

/** Pure motion classifier shared by horizontal and vertical rotary-prism procedures. */
export function sampleRotaryPrismMotion(
  trace: RotaryPrismTrace,
  endpointStableSinceMs: number | null,
  sample: Readonly<{ nowMs: number; power: number }>,
  direction: RotaryPrismDirection,
  target: number,
): RotaryMotionResult {
  const endpoint = rotaryPowerInWindow(sample.power, target);
  const last = trace.samples.at(-1);
  if (!last) return Object.freeze({ trace: appendRotaryPrismTrace(newRotaryPrismTrace(direction), sample.nowMs, sample.power, true),
    endpointStableSinceMs: endpoint ? sample.nowMs : null, capture: false, resetIssue: "", atEndpoint: endpoint, advanced: false });
  const creditPower = trace.creditPower ?? last.power;
  const creditAt = trace.creditAtMs ?? last.nowMs;
  const dt = sample.nowMs - creditAt;
  if (dt <= 0) return Object.freeze({ trace, endpointStableSinceMs, capture: false, resetIssue: "", atEndpoint: endpoint, advanced: false });
  const delta = roundedRotaryPower(sample.power) - creditPower;
  const absolute = Math.abs(delta);
  let stableSince = endpoint ? (endpointStableSinceMs ?? sample.nowMs) : null;
  if (absolute <= ROTARY_PRISM_JITTER) {
    const pauseSinceMs = trace.pauseSinceMs ?? creditAt;
    if (sample.nowMs - pauseSinceMs > ROTARY_PRISM_MAX_PAUSE_MS && !endpoint)
      return Object.freeze({ trace, endpointStableSinceMs: null, capture: false, resetIssue: "The dial paused for more than one second.", atEndpoint: false, advanced: false });
    const nextTrace = Object.freeze({ ...appendRotaryPrismTrace(trace, sample.nowMs, sample.power), pauseSinceMs });
    return Object.freeze({ trace: nextTrace, endpointStableSinceMs: stableSince,
      capture: endpoint && stableSince !== null && sample.nowMs - stableSince >= ROTARY_PRISM_STABILITY_MS,
      resetIssue: "", atEndpoint: endpoint, advanced: false });
  }
  const correct = direction === "increase" ? delta > 0 : delta < 0;
  if (!correct && absolute > ROTARY_PRISM_REVERSAL)
    return Object.freeze({ trace, endpointStableSinceMs: null, capture: false, resetIssue: "The dial reversed before the endpoint was captured.", atEndpoint: endpoint, advanced: false });
  if (!correct) return Object.freeze({ trace: appendRotaryPrismTrace(trace, sample.nowMs, sample.power), endpointStableSinceMs: null,
    capture: false, resetIssue: "", atEndpoint: endpoint, advanced: false });
  if (absolute > ROTARY_PRISM_JUMP)
    return Object.freeze({ trace, endpointStableSinceMs: null, capture: false, resetIssue: "The dial jumped discontinuously.", atEndpoint: endpoint, advanced: false });
  const speed = absolute / (dt / 1000);
  if (speed > ROTARY_PRISM_MAX_SPEED)
    return Object.freeze({ trace, endpointStableSinceMs: null, capture: false, resetIssue: "The dial moved too quickly.", atEndpoint: endpoint, advanced: false });
  if (speed < ROTARY_PRISM_MIN_SPEED && !endpoint)
    return Object.freeze({ trace, endpointStableSinceMs: null, capture: false, resetIssue: "Keep the dial moving continuously; the change was too slow.", atEndpoint: endpoint, advanced: false });
  stableSince = endpoint ? sample.nowMs : null;
  return Object.freeze({ trace: Object.freeze({ ...appendRotaryPrismTrace(trace, sample.nowMs, sample.power, true), pauseSinceMs: null }),
    endpointStableSinceMs: stableSince, capture: false, resetIssue: "", atEndpoint: endpoint, advanced: true });
}

export function normalizeRotaryPrismRoll(rollRad: number) {
  return Math.atan2(Math.sin(rollRad), Math.cos(rollRad));
}

const angularDistance = (a: number, b: number) => Math.abs(normalizeRotaryPrismRoll(a - b));

/** Signed patient-view roll: 0 BI, +90° BU, 180° BO, −90° BD. */
export function rotaryPrismBaseFromRoll(rollRad: number): RotaryPrismBase | null {
  const roll = normalizeRotaryPrismRoll(rollRad);
  const candidates: readonly [RotaryPrismBase, number][] = [["BI", 0], ["BU", Math.PI / 2], ["BO", Math.PI], ["BD", -Math.PI / 2]];
  const match = candidates.find(([, angle]) => angularDistance(roll, angle) <= ROTARY_PRISM_ROLL_TOLERANCE_RAD);
  return match?.[0] ?? null;
}

export function rotaryPrismPowerToDialAngle(power: number) {
  return roundedRotaryPower(power) / ROTARY_PRISM_MAX_DELTA * ROTARY_PRISM_DIAL_SWEEP_RAD;
}

export function rotaryPrismDialAngleToPower(angleRad: number) {
  return roundedRotaryPower(Math.max(0, Math.min(ROTARY_PRISM_DIAL_SWEEP_RAD, angleRad)) / ROTARY_PRISM_DIAL_SWEEP_RAD * ROTARY_PRISM_MAX_DELTA);
}
