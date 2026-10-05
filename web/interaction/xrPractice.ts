export type XRVector3 = readonly [number, number, number];

export const XR_HIRSCHBERG_TARGET_DISTANCE_CM = 50;
export const XR_HIRSCHBERG_DISTANCE_TOLERANCE_CM = 4;
export const XR_HIRSCHBERG_AIM_TOLERANCE_DEG = 8;
export const XR_HIRSCHBERG_VIEW_TOLERANCE_DEG = 8;

export type XRHirschbergTechniqueInput = {
  penlightPosition: XRVector3;
  penlightForward: XRVector3;
  viewerPosition: XRVector3;
  viewerForward: XRVector3;
  eyeMidpoint: XRVector3;
  held: boolean;
  light: boolean;
  fixation: boolean;
};

export type XRHirschbergTechnique = {
  distanceCm: number;
  aimErrorDeg: number;
  viewErrorDeg: number;
  distanceReady: boolean;
  aimReady: boolean;
  viewReady: boolean;
  ready: boolean;
  quality: number;
};

function subtract(a: XRVector3, b: XRVector3): XRVector3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function length(vector: XRVector3) {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function angleDegrees(a: XRVector3, b: XRVector3) {
  const denominator = length(a) * length(b);
  if (denominator === 0) return 180;
  const cosine = Math.max(-1, Math.min(1, (a[0] * b[0] + a[1] * b[1] + a[2] * b[2]) / denominator));
  return Math.acos(cosine) * 180 / Math.PI;
}

function quality(error: number, tolerance: number, maximum: number) {
  if (error <= tolerance) return 1;
  return Math.max(.18, 1 - (error - tolerance) / (maximum - tolerance));
}

export function xrHirschbergTechnique(input: XRHirschbergTechniqueInput): XRHirschbergTechnique {
  const penlightToEyes = subtract(input.eyeMidpoint, input.penlightPosition);
  const viewerToEyes = subtract(input.eyeMidpoint, input.viewerPosition);
  const distanceCm = length(penlightToEyes) * 100;
  const aimErrorDeg = angleDegrees(input.penlightForward, penlightToEyes);
  const viewErrorDeg = angleDegrees(input.viewerForward, viewerToEyes);
  const distanceReady = Math.abs(distanceCm - XR_HIRSCHBERG_TARGET_DISTANCE_CM) <= XR_HIRSCHBERG_DISTANCE_TOLERANCE_CM;
  const aimReady = aimErrorDeg <= XR_HIRSCHBERG_AIM_TOLERANCE_DEG;
  const viewReady = viewErrorDeg <= XR_HIRSCHBERG_VIEW_TOLERANCE_DEG;
  const ready = input.held && input.light && input.fixation && distanceReady && aimReady && viewReady;
  const distanceQuality = quality(Math.abs(distanceCm - XR_HIRSCHBERG_TARGET_DISTANCE_CM), XR_HIRSCHBERG_DISTANCE_TOLERANCE_CM, 45);
  const aimQuality = quality(aimErrorDeg, XR_HIRSCHBERG_AIM_TOLERANCE_DEG, 55);
  const viewQuality = quality(viewErrorDeg, XR_HIRSCHBERG_VIEW_TOLERANCE_DEG, 45);
  const setupQuality = (distanceQuality + aimQuality + viewQuality + (input.fixation ? 1 : .4)) / 4;
  return {
    distanceCm,
    aimErrorDeg,
    viewErrorDeg,
    distanceReady,
    aimReady,
    viewReady,
    ready,
    quality: input.light ? setupQuality : 0,
  };
}

export function xrHirschbergPrompt(technique: XRHirschbergTechnique, input: Pick<XRHirschbergTechniqueInput, "held" | "light" | "fixation">) {
  if (!input.held) return "Grip the penlight on the tray.";
  if (!input.fixation) return "Select fixation and ask the patient to look at the light.";
  if (!input.light) return "Hold the trigger to illuminate the penlight.";
  if (!technique.distanceReady) return `Move the light to about 50 cm. Current distance: ${Math.round(technique.distanceCm)} cm.`;
  if (!technique.aimReady) return "Aim the penlight at the midpoint between both eyes.";
  if (!technique.viewReady) return "Move your head and look directly along the visual axis.";
  return "Technique aligned. Inspect both corneal reflexes and record the finding.";
}
