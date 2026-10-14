import { describe, expect, it } from "vitest";
import {
  PATIENT_BLINK_DURATION_SECONDS,
  patientBlinkClosure,
  patientBlinkDelay,
  patientMouthTarget,
} from "../interaction/patientAnimation";

describe("shared patient face animation", () => {
  it("opens and closes one blink without leaving the lids over the clinical eye geometry", () => {
    expect(patientBlinkClosure(0)).toBe(0);
    expect(patientBlinkClosure(PATIENT_BLINK_DURATION_SECONDS / 2)).toBeCloseTo(1);
    expect(patientBlinkClosure(PATIENT_BLINK_DURATION_SECONDS)).toBe(0);
    expect(patientBlinkClosure(PATIENT_BLINK_DURATION_SECONDS + 1)).toBe(0);
  });

  it("keeps randomized blink gaps within a natural bounded interval", () => {
    expect(patientBlinkDelay(-1)).toBe(2.6);
    expect(patientBlinkDelay(0.5)).toBeCloseTo(4.5);
    expect(patientBlinkDelay(2)).toBeCloseTo(6.4);
  });

  it("moves the mouth only during patient playback and limits reduced motion to a steady pose", () => {
    expect(patientMouthTarget(1, false)).toBe(0);
    expect(patientMouthTarget(1, true)).toBeGreaterThan(0);
    expect(patientMouthTarget(1, true)).not.toBe(patientMouthTarget(1.2, true));
    expect(patientMouthTarget(1, true, true)).toBe(0.38);
    expect(patientMouthTarget(3, true, true)).toBe(0.38);
  });
});
