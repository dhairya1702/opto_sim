import { describe, expect, it } from "vitest";
import { captureWorthReport, recordWorthEndpoint, worthCaptureSubmission, worthComparisonComplete, xrWorthTechnique, type XRWorthInput } from "../interaction/xrWorthPractice";
import { worthAtDistance, worthCases, worthDots } from "../interaction/worth";
import { interpretWorth, worthReports } from "../interaction/sensory";

const input = (distanceCm = 40, endpoint: "near" | "distance" | null = "near"): XRWorthInput => ({ active: true, correction: true, glasses: true, light: true,
  verified: { red: true, green: true }, filter: null, condition: { distanceCm, endpoint, facing: true } });
describe("Worth XR report snapshots and independent endpoint recording", () => {
  it("preserves all eight authored patterns at both conditions without changing the physical target", () => {
    for (const scenario of worthCases) for (const [distance, endpoint] of [[40, "near"], [600, "distance"]] as const) {
      const capture = captureWorthReport(input(distance, endpoint), scenario, 3, 7)!;
      const finding = worthAtDistance(scenario, distance);
      expect(capture.finding).toBe(finding); expect(capture.report).toBe(worthReports[finding]);
      expect(capture.nominalDistanceCm).toBe(distance); expect(Object.isFrozen(capture)).toBe(true);
      expect(worthCaptureSubmission(capture, String(worthDots(finding).length), interpretWorth(finding), 3, 7)).toBe(true);
    }
  });
  it("requires correction, fitted filters, lit/facing target and independent explicit confirmation of both filters", () => {
    for (const patch of [{ active: false }, { correction: false }, { glasses: false }, { light: false }, { verified: { red: false, green: true } },
      { verified: { red: true, green: false } }, { filter: "red" as const }, { condition: { distanceCm: 40, endpoint: "near" as const, facing: false } }]) {
      const sample = { ...input(), ...patch };
      expect(xrWorthTechnique(sample).ready).toBe(false); expect(captureWorthReport(sample, "fusion", 1, 1)).toBeNull();
    }
    expect(xrWorthTechnique({ ...input(), verified: { red: false, green: false } }).filterReady).toBe(true);
  });
  it("allows illustrative intermediate reports but cannot award an endpoint there", () => {
    const capture = captureWorthReport(input(150, null), "central-os", 1, 1)!;
    expect(capture.report).toBe(worthReports.fusion); expect(capture.nominalDistanceCm).toBeNull();
    expect(worthCaptureSubmission(capture, "4", "flat-fusion", 1, 1)).toBeNull();
    expect(recordWorthEndpoint({}, capture, "4", "flat-fusion", 1, 1)).toEqual({});
  });
  it("retains sampled distance, distinguishes entries, guards duplicates and completes only two independent endpoints", () => {
    const near = captureWorthReport(input(39, "near"), "central-os", 4, 2)!;
    const distance = captureWorthReport(input(600, "distance"), "central-os", 4, 2)!;
    let records = recordWorthEndpoint({}, near, "4", "flat-fusion", 4, 2);
    expect(records.near?.capture.actualDistanceCm).toBe(39); expect(records.near?.submittedCount).toBe("4");
    expect(worthComparisonComplete(records)).toBe(false);
    expect(recordWorthEndpoint(records, near, "4", "flat-fusion", 4, 2)).toBe(records);
    records = recordWorthEndpoint(records, distance, "2", "left-suppression", 4, 2);
    expect(worthComparisonComplete(records)).toBe(true);
    expect(records.distance?.capture.nominalDistanceCm).toBe(600);
  });
  it("rejects blank/wrong entries and captures from a prior setup/scenario/attempt", () => {
    const capture = captureWorthReport(input(), "central-os", 1, 4)!;
    expect(worthCaptureSubmission(capture, "", "flat-fusion", 1, 4)).toBeNull();
    expect(worthCaptureSubmission(capture, "4", "", 1, 4)).toBeNull();
    expect(worthCaptureSubmission(capture, "5", "flat-fusion", 1, 4)).toBe(false);
    expect(worthCaptureSubmission(capture, "4", "left-suppression", 1, 4)).toBe(false);
    expect(worthCaptureSubmission(capture, "4", "flat-fusion", 2, 4)).toBeNull();
    expect(worthCaptureSubmission(capture, "4", "flat-fusion", 1, 5)).toBeNull();
  });
});
