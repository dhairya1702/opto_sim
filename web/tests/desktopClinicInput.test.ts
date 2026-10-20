import { describe, expect, it } from "vitest";
import {
  clearDesktopClinicTransient, desktopAccommodationHeldPose, desktopAssistedSocketId, desktopBrucknerPose, desktopClinicAdjustmentStep, desktopClinicShortcut,
  desktopPatientFacingPose, desktopPenlightPose,
  initialDesktopClinicInput, setDesktopClinicActivation, switchDesktopClinicHand,
} from "../interaction/desktopClinicInput";
import { grabConsultationTool, initialConsultationTools, releaseConsultationTool, toolInHand } from "../interaction/xrConsultationTools";

describe("desktop clinic input", () => {
  it("switches virtual hands without changing other transient state", () => {
    const active = setDesktopClinicActivation(initialDesktopClinicInput(), true);
    expect(switchDesktopClinicHand(active)).toEqual({ activeHand: "left", activating: true });
    expect(switchDesktopClinicHand(switchDesktopClinicHand(active)).activeHand).toBe("right");
  });

  it("clears activation on interruption", () => {
    expect(clearDesktopClinicTransient({ activeHand: "left", activating: true })).toEqual({ activeHand: "left", activating: false });
  });

  it("protects shortcuts from key repeat and editable controls", () => {
    expect(desktopClinicShortcut({ key: "e", repeat: false }, false)).toBe("pickup-place");
    expect(desktopClinicShortcut({ key: "e", repeat: true }, false)).toBeNull();
    expect(desktopClinicShortcut({ key: "q", repeat: false }, true)).toBeNull();
    expect(desktopClinicShortcut({ key: "Tab", repeat: false }, false)).toBeNull();
    expect(desktopClinicShortcut({ key: "ArrowUp", repeat: false }, false)).toBe("adjust-vertical-positive");
    expect(desktopClinicShortcut({ key: "ArrowLeft", repeat: false }, false)).toBe("adjust-horizontal-negative");
  });

  it("maps wheel direction to one controller-compatible adjustment step", () => {
    expect(desktopClinicAdjustmentStep(-100)).toBe(1);
    expect(desktopClinicAdjustmentStep(100)).toBe(-1);
    expect(desktopClinicAdjustmentStep(0)).toBe(0);
  });

  it("provides the shared spectacle-plane, 40 cm, OD, OS, and OU assisted poses", () => {
    expect(desktopAssistedSocketId("push-up-rule")).toBe("library-push-up-spectacle");
    expect(desktopAssistedSocketId("npc-rule")).toBe("library-npc-spectacle");
    expect(desktopAssistedSocketId("near")).toBe("practice-near-stand");
    expect(desktopAssistedSocketId("thorington")).toBe("library-thorington-near");
    expect(desktopAssistedSocketId("stereo")).toBe("sensory-stereo-near");
    expect(desktopAccommodationHeldPose("minus-lens-holder", "sensory-occlude-OS")?.position[0]).toBeLessThan(0);
    expect(desktopAccommodationHeldPose("minus-lens-holder", "sensory-occlude-OD")?.position[0]).toBeGreaterThan(0);
    expect(desktopAccommodationHeldPose("trial-lens")?.position[0]).toBe(0);
    expect(desktopAccommodationHeldPose("lens-flipper")?.position[0]).toBe(0);
    expect(desktopAccommodationHeldPose("prism")?.position[0]).toBeLessThan(0);
    expect(desktopAccommodationHeldPose("prism-flipper")?.position[0]).toBe(0);
  });

  it("rolls the assisted rotary prism through the shared BI, BU, BO, and BD orientations", () => {
    const roll = (turns: number) => desktopAccommodationHeldPose("vergence-prism", undefined, turns)!.rotation;
    expect(roll(0)).toEqual([0, 0, 0, 1]);
    expect(roll(1)[2]).toBeCloseTo(Math.SQRT1_2);
    expect(roll(2)[2]).toBeCloseTo(1);
    expect(roll(-1)[2]).toBeCloseTo(-Math.SQRT1_2);
  });

  it("provides exact patient-facing, penlight, and one-metre Bruckner poses", () => {
    const penlight = desktopPenlightPose([0, 1.5, -.073]);
    expect(penlight.position[2]).toBeCloseTo(.064);
    const cover = desktopPatientFacingPose("cover", [-.032, 1.5, -.513]);
    expect(cover.position).toEqual([-.032, 1.379, -.513]);
    expect(desktopBrucknerPose()).toEqual({ position: [0, 1.33, .459], rotation: [0, 1, 0, 0] });
  });

  it("uses the shared ownership commands for pickup, transfer, placement, and return", () => {
    let tools = grabConsultationTool(initialConsultationTools(), "lens-flipper", "right");
    expect(toolInHand(tools, "right")).toBe("lens-flipper");
    tools = grabConsultationTool(tools, "lens-flipper", "left");
    expect(toolInHand(tools, "right")).toBeNull();
    expect(toolInHand(tools, "left")).toBe("lens-flipper");
    const placed = releaseConsultationTool(tools, "left");
    expect(placed.id).toBe("lens-flipper");
    expect(placed.state["lens-flipper"].placement.kind).toBe("socket");
  });
});
