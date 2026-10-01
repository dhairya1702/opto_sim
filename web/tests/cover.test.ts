import { describe, expect, it } from "vitest";
import { advanceCoverStep, coverPositionAt, coverProcedure, coverTargets } from "../interaction/cover";

describe("manual cover-test procedure", () => {
  it("distinguishes each covered eye, a fully removed paddle, and transition spill", () => {
    expect(coverPositionAt(coverTargets.OD)).toBe("OD");
    expect(coverPositionAt(coverTargets.OS)).toBe("OS");
    expect(coverPositionAt({ x: 0, y: -0.72 })).toBe("away");
    expect(coverPositionAt({ x: 0, y: 0 })).toBeNull();
    expect(coverPositionAt({ x: -0.34, y: 0.4 })).toBeNull();
  });

  it("requires the ordered cover-uncover and alternating sequence", () => {
    expect(coverProcedure.map((step) => step.position)).toEqual([
      "OD", "away", "OS", "away", "OD", "OS", "OD", "OS", "away",
    ]);
    let state = { index: 0, dwell: 0 };
    state = advanceCoverStep(state.index, state.dwell, "OS", 1);
    expect(state).toEqual({ index: 0, dwell: 0 });
    for (let i = 0; i < 7; i++)
      state = advanceCoverStep(state.index, state.dwell, "OD", 0.1);
    expect(state.index).toBe(1);
    state = advanceCoverStep(state.index, 0.2, null, 0.1);
    expect(state).toEqual({ index: 1, dwell: 0 });
  });

  it("caps elapsed time so a background pause cannot complete a step", () => {
    expect(advanceCoverStep(0, 0, "OD", 10)).toEqual({ index: 0, dwell: 0.1 });
  });
});
