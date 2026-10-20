import { describe, expect, it } from "vitest";
import {
  givePushUpInstruction, interruptPushUp, newPushUpRun, pushUpEye, pushUpGuidedStep, restartPushUpEye,
  samplePushUp, submitPushUpRecord, type PushUpRun, type PushUpSpatialSample,
} from "../interaction/pushUpProcedure";

const valid = (nowMs: number, distanceCm = 40, overrides: Partial<PushUpSpatialSample> = {}): PushUpSpatialSample => ({
  nowMs, distanceCm, correctionFitted: true, occlusionReady: true, ruleDocked: true, patientFacing: true,
  upright: true, midlineOffsetCm: 0, visible: true, tracking: true, ...overrides,
});

function arm(run = newPushUpRun()) {
  let next = givePushUpInstruction(run);
  next = samplePushUp(next, valid(0));
  return samplePushUp(next, valid(250));
}

function capture(run: PushUpRun, threshold: number) {
  let next = arm(run), now = 300;
  for (let cm = 38; cm > threshold; cm -= 2) next = samplePushUp(next, valid(now += 50, Math.max(threshold, cm)));
  next = samplePushUp(next, valid(now += 50, threshold));
  return samplePushUp(next, valid(now + 500, Math.max(2, threshold - 1)));
}

describe("Push-up amplitude procedure", () => {
  it("keeps frozen-eye recording after ruler removal and restores setup for each new eye", () => {
    const released = valid(3000, 10, { ruleDocked: false, correctionFitted: false, occlusionReady: false });
    let run = newPushUpRun();
    for (const [index, eye] of ["OD", "OS", "OU"].entries()) {
      run = capture(run, 10 + index);
      expect(pushUpGuidedStep(run, released)).toMatchObject({ index: 6, title: `Record ${eye}` });
      if (!run.capture) throw new Error("Expected completed push-up measurement");
      run = submitPushUpRecord(run, String(run.capture.distanceCm), String(run.capture.amplitudeD));
      expect(pushUpGuidedStep(run, released).index).toBe(index === 2 ? 6 : 0);
    }
    expect(pushUpGuidedStep(run, released).title).toBe("Series complete");
  });
  it("requires correction, eye-specific occlusion, docking, instruction and a stable 40 cm start", () => {
    let run = newPushUpRun();
    expect(pushUpGuidedStep(run, valid(0, 40, { correctionFitted: false })).title).toBe("Fit near correction");
    expect(pushUpGuidedStep(run, valid(0, 40, { occlusionReady: false })).title).toBe("Prepare OD");
    expect(pushUpGuidedStep(run, valid(0, 40, { ruleDocked: false })).title).toBe("Dock the ruler");
    run = samplePushUp(run, valid(0)); expect(run.feedback).toContain("report the first blur");
    run = givePushUpInstruction(run); run = samplePushUp(run, valid(0, 30)); expect(run.phase).toBe("start");
    run = samplePushUp(run, valid(10, 40)); expect(run.feedback).toContain("250 ms");
    run = samplePushUp(run, valid(260, 40)); expect(run.phase).toBe("approach");
  });

  it("auto-freezes the first crossing after sustained blur and preserves it through overshoot", () => {
    let run = arm();
    for (let cm = 38, now = 300; cm >= 10; cm -= 2, now += 50) run = samplePushUp(run, valid(now, cm));
    expect(run.phase).toBe("confirming-blur"); expect(run.report).toContain("becoming blurred");
    run = samplePushUp(run, valid(2000, 9));
    expect(run.capture).toEqual({ eye: "OD", distanceCm: 10, amplitudeD: 10 });
    expect(run.report).toContain("remain blurred");
    expect(interruptPushUp(run, "Tracking was lost.")).toBe(run);
  });

  it("cancels transient blur and gives actionable reversal and jump feedback", () => {
    let run = arm();
    for (let cm = 38, now = 300; cm >= 10; cm -= 2, now += 50) run = samplePushUp(run, valid(now, cm));
    run = samplePushUp(run, valid(760, 10.5));
    expect(run.phase).toBe("approach"); expect(run.capture).toBeNull(); expect(run.report).toContain("clear");
    run = samplePushUp(run, valid(800, 11.1)); expect(run.phase).toBe("start"); expect(run.feedback).toContain("reversed outward");
    run = arm(restartPushUpEye(run));
    run = samplePushUp(run, valid(900, 34)); expect(run.phase).toBe("start"); expect(run.feedback).toContain("jumped too far");
  });

  it("records blank independent entries in OD, OS, OU order and rejects wrong calculations", () => {
    let run = capture(newPushUpRun(), 10);
    let rejected = submitPushUpRecord(run, "10", "9.98");
    expect(rejected.records).toHaveLength(0); expect(rejected.feedback).toContain("100 ÷ distance");
    run = submitPushUpRecord(run, "10", "10"); expect(run.records).toHaveLength(1); expect(pushUpEye(run)).toBe("OS");
    run = capture(run, 11); run = submitPushUpRecord(run, "11", "9.09"); expect(pushUpEye(run)).toBe("OU");
    run = capture(run, 12); run = submitPushUpRecord(run, "12", "8.33");
    expect(run.phase).toBe("complete"); expect(run.records.map(record => record.eye)).toEqual(["OD", "OS", "OU"]); expect(run.completionAwarded).toBe(true);
  });

  it("invalidates unfinished work on setup interruption but preserves earlier eye records", () => {
    let run = capture(newPushUpRun(), 10); run = submitPushUpRecord(run, "10", "10");
    run = arm(run); run = samplePushUp(run, valid(300, 38));
    run = interruptPushUp(run, "Tracking was lost.");
    expect(run.phase).toBe("start"); expect(run.records).toHaveLength(1); expect(run.feedback).toContain("Return the card");
    run = samplePushUp(run, valid(400, 40, { correctionFitted: false }));
    expect(run.phase).toBe("setup"); expect(run.records).toHaveLength(1);
  });
});
