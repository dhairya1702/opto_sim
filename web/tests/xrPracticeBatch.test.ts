import { describe, expect, it } from "vitest";
import { advanceXRPracticeCover, emptyPracticeCoverSequence, xrPracticeEyePlacement, xrPracticeCoverPosition, xrPracticeNearFixation, xrCoverGuideAnchors, xrCoverGuideTarget, xrBrucknerTechnique, xrBrucknerPrompt, PRACTICE_NEAR_SOCKET } from "../interaction/xrPracticeBatch";
import { initialConsultationTools, grabConsultationTool, releaseConsultationTool } from "../interaction/xrConsultationTools";

describe("Practice batch spatial adapters", () => {
  const bruckner = { origin: [0, 1.5, .427] as const, forward: [0, 0, -1] as const,
    held: true, light: true, fixation: true, largeSpot: true, scopeOpen: true };
  it("requires broad binocular illumination, the existing 1 m gate and explicit scope mode", () => {
    expect(xrBrucknerTechnique(bruckner).ready).toBe(true);
    for (const change of [{ largeSpot: false }, { fixation: false }, { light: false }, { held: false }, { scopeOpen: false }, { origin: [0, 1.5, .1] as const }, { forward: [0, 0, 1] as const }])
      expect(xrBrucknerTechnique({ ...bruckner, ...change }).ready).toBe(false);
    expect(xrBrucknerTechnique({ ...bruckner, scopeOpen: false }).illuminated).toBe(true);
    expect(xrBrucknerTechnique({ ...bruckner, largeSpot: false }).illuminated).toBe(false);
  });
  it("explains the actual setup blocker without requiring headset-to-peephole alignment", () => {
    const setup = { tracked: true, held: true, light: true, fixation: true, largeSpot: true };
    const ready = xrBrucknerTechnique(bruckner);
    expect(xrBrucknerPrompt(ready, { ...setup, held: false })).toContain("Pick up");
    expect(xrBrucknerPrompt(ready, { ...setup, light: false })).toContain("Ophthalmoscope held");
    expect(xrBrucknerPrompt(ready, { ...setup, fixation: false })).toContain("Ask the patient");
    expect(xrBrucknerPrompt(ready, { ...setup, largeSpot: false })).toContain("wheel");
    expect(xrBrucknerPrompt(ready, { ...setup, tracked: false })).toContain("tracking");
    expect(xrBrucknerPrompt(xrBrucknerTechnique({ ...bruckner, origin: [0, 1.5, .927] }), setup)).toContain("150 cm");
    expect(xrBrucknerPrompt(xrBrucknerTechnique({ ...bruckner, forward: [.15, 0, -1] }), setup)).toContain("Aim the light");
    expect(xrBrucknerPrompt(xrBrucknerTechnique({ ...bruckner, scopeOpen: false }), setup)).toContain("Press B/Y");
  });
  it("rejects binocular midpoint, tilted and behind-eye occlusion, and recognizes either eye/fully away", () => {
    expect(xrPracticeEyePlacement([-.048, 1.5, -.51], [0, 0, -1])).toBe("OD");
    expect(xrPracticeEyePlacement([.048, 1.5, -.51], [0, 0, -1])).toBe("OS");
    expect(xrPracticeEyePlacement([0, 1.5, -.51], [0, 0, -1])).toBeNull();
    expect(xrPracticeEyePlacement([-.048, 1.5, -.59], [0, 0, -1])).toBeNull();
    expect(xrPracticeEyePlacement([-.048, 1.5, -.51], [1, 0, 0])).toBeNull();
    expect(xrPracticeCoverPosition([0, 1.1, -.3], [0, 0, -1])).toBe("away");
  });
  it("places cover guides where the shared sequence geometry accepts the paddle", () => {
    const anchors = xrCoverGuideAnchors();
    for (const eye of ["OD", "OS"] as const) {
      expect(xrPracticeCoverPosition(anchors.cover[eye], [0, 0, -1])).toBe(eye);
      expect(xrPracticeCoverPosition(anchors.away[eye], [0, 0, -1])).toBe("away");
    }
    expect(xrCoverGuideTarget("cover-uncover", 0)).toEqual({ position: "OD", eye: "OD" });
    expect(xrCoverGuideTarget("cover-uncover", 1)).toEqual({ position: "away", eye: "OD" });
    expect(xrCoverGuideTarget("cover-uncover", 3)).toEqual({ position: "away", eye: "OS" });
    expect(xrCoverGuideTarget("alternate-cover", 1)).toEqual({ position: "OS", eye: "OS" });
    expect(xrCoverGuideTarget("cover-uncover", 4)).toBeNull();
  });
  it("requires a centred near target at about 40 cm and supports hands-free placement", () => {
    expect(xrPracticeNearFixation([0, 1.5, -.173]).ready).toBe(true);
    expect(xrPracticeNearFixation([0, 1.5, .1]).ready).toBe(false);
    expect(xrPracticeNearFixation([.2, 1.5, -.173]).ready).toBe(false);
    const held = grabConsultationTool(initialConsultationTools(), "near", "left");
    const result = releaseConsultationTool(held, "left", { position: [0, 1.52, -.16], rotation: [0, 0, 0, 1] }, undefined, [PRACTICE_NEAR_SOCKET]);
    expect(result.returned).toBe(false);
    expect(result.state.near.placement).toEqual({ kind: "socket", socketId: PRACTICE_NEAR_SOCKET.id, position: PRACTICE_NEAR_SOCKET.position, rotation: PRACTICE_NEAR_SOCKET.rotation });
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
  it("refuses dwell while technique is interrupted", () => {
    expect(advanceXRPracticeCover("cover-uncover", { index: 1, dwell: .3, transit: 0 }, "away", .1, false)).toEqual({ index: 1, dwell: 0, transit: 0 });
  });
});
