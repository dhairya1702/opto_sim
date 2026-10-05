import { describe, expect, it } from "vitest";
import { coverProcedure } from "../interaction/cover";
import { advanceXRCoverState, initialXRCoverState, xrCoverComplete, xrCoverFixationMode, xrCoverPositionAt } from "../interaction/xrCover";

const eyes = { OD: [-.05, 1.5, -.57], OS: [.05, 1.5, -.57] } as const;

describe("XR cover test", () => {
  it("maps spatial occluder placement to OD, OS, away, and transition zones", () => {
    expect(xrCoverPositionAt([-.05, 1.5, -.48], eyes)).toBe("OD");
    expect(xrCoverPositionAt([.05, 1.5, -.48], eyes)).toBe("OS");
    expect(xrCoverPositionAt([0, 1.1, -.3], eyes)).toBe("away");
    expect(xrCoverPositionAt([0, 1.5, -.42], eyes)).toBeNull();
  });

  it("derives near and simulated distance fixation from the target hand", () => {
    expect(xrCoverFixationMode([0, 1.5, -.17], eyes).mode).toBe("near");
    expect(xrCoverFixationMode([0, 1.5, .23], eyes).mode).toBe("distance");
    expect(xrCoverFixationMode([.4, 1.5, -.17], eyes).mode).toBeNull();
  });

  it("requires the shared ordered cover-uncover and alternating sequence", () => {
    let state = initialXRCoverState();
    for (const step of coverProcedure) {
      const repeats = Math.ceil(step.dwell / .1);
      for (let index = 0; index < repeats; index += 1) {
        state = advanceXRCoverState(state, step.position, .1);
      }
    }
    expect(xrCoverComplete(state)).toBe(true);
  });
});
