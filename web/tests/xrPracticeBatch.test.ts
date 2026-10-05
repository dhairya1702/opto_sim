import { describe, expect, it } from "vitest";
import { advanceXRPracticeCover, emptyPracticeCoverSequence, coverPracticePulse, xrPracticeEyePlacement, xrPracticeCoverPosition, xrPracticeNearFixation, xrBrucknerTechnique, PRACTICE_NEAR_SOCKET } from "../interaction/xrPracticeBatch";
import { initialConsultationTools, grabConsultationTool, releaseConsultationTool } from "../interaction/xrConsultationTools";

describe("Practice batch spatial adapters", () => {
  const bruckner = { origin: [0, 1.5, .427] as const, forward: [0, 0, -1] as const, aperture: [0, 1.5, .491] as const, viewer: [0, 1.5, .56] as const,
    look: [0, 0, -1] as const, held: true, light: true, fixation: true, largeSpot: true };
  it("requires broad binocular illumination, existing 1 m gate, and viewing through the aperture", () => {
    expect(xrBrucknerTechnique(bruckner).ready).toBe(true);
    for (const change of [{ largeSpot: false }, { fixation: false }, { light: false }, { held: false }, { origin: [0, 1.5, .1] as const }, { viewer: [.2, 1.5, .56] as const }, { forward: [0, 0, 1] as const }])
      expect(xrBrucknerTechnique({ ...bruckner, ...change }).ready).toBe(false);
    expect(xrBrucknerTechnique({ ...bruckner, largeSpot: false }).illuminated).toBe(false);
  });
  it("rejects binocular midpoint, tilted and behind-eye occlusion, and recognizes either eye/fully away", () => {
    expect(xrPracticeEyePlacement([-.048, 1.5, -.51], [0, 0, -1])).toBe("OD");
    expect(xrPracticeEyePlacement([.048, 1.5, -.51], [0, 0, -1])).toBe("OS");
    expect(xrPracticeEyePlacement([0, 1.5, -.51], [0, 0, -1])).toBeNull();
    expect(xrPracticeEyePlacement([-.048, 1.5, -.59], [0, 0, -1])).toBeNull();
    expect(xrPracticeEyePlacement([-.048, 1.5, -.51], [1, 0, 0])).toBeNull();
    expect(xrPracticeCoverPosition([0, 1.1, -.3], [0, 0, -1])).toBe("away");
  });
  it("requires a centred near target at about 40 cm and supports hands-free placement", () => {
    expect(xrPracticeNearFixation([0, 1.5, -.173]).ready).toBe(true);
    expect(xrPracticeNearFixation([0, 1.5, .1]).ready).toBe(false);
    expect(xrPracticeNearFixation([.2, 1.5, -.173]).ready).toBe(false);
    const held = grabConsultationTool(initialConsultationTools(), "near", "left");
    const result = releaseConsultationTool(held, "left", { position: [0, 1.52, -.16], rotation: [0, 0, 0, 1] }, undefined, [PRACTICE_NEAR_SOCKET]);
    expect(result.returned).toBe(false);
    expect(result.state.near.placement).toEqual({ kind: "socket", position: PRACTICE_NEAR_SOCKET.position, rotation: PRACTICE_NEAR_SOCKET.rotation });
    expect(result.state.near.powered).toBe(false);
  });
  it("tolerates brief hand transit but restarts alternating cover after prolonged binocular exposure", () => {
    let state = { index: 1, dwell: .3, transit: 0 };
    state = advanceXRPracticeCover("alternate-cover", state, null, .1, true);
    expect(state.index).toBe(1); expect(state.dwell).toBe(0);
    for (let i = 0; i < 3; i++) state = advanceXRPracticeCover("alternate-cover", state, "away", .1, true);
    expect(state).toEqual(emptyPracticeCoverSequence());
    expect(advanceXRPracticeCover("cover-uncover", { index: 1, dwell: 0, transit: 0 }, "away", 1, true).dwell).toBe(.1);
  });
  it("reuses authored eye/timing mappings and refuses dwell while technique is interrupted", () => {
    expect(coverPracticePulse("cover-uncover", "left-esotropia", 0, "none")).toEqual({ eye: "OS", direction: "out" });
    expect(coverPracticePulse("cover-uncover", "left-esotropia", 1, "none")).toEqual({ eye: "OS", direction: "in" });
    expect(coverPracticePulse("cover-uncover", "exophoria", 3, "none")).toEqual({ eye: "OS", direction: "in" });
    expect(coverPracticePulse("alternate-cover", "", 1, "up")).toEqual({ eye: "OD", direction: "up" });
    expect(advanceXRPracticeCover("cover-uncover", { index: 1, dwell: .3, transit: 0 }, "away", .1, false)).toEqual({ index: 1, dwell: 0, transit: 0 });
  });
});
