import { describe, expect, it } from "vitest";
import {
  XR_CLINIC_STATIONS,
  clinicProcedureReadiness,
  createXRClinicState,
  dropHeldTool,
  moveToStation,
  nearestToolId,
  pickupTool,
  returnHeldTool,
  stationWorldPosition,
  stationArrivalPosition,
  toolCompatibleWithProcedure,
  toolHeldInHand,
  toolHomePosition,
  worldFromStationOffset,
} from "../interaction/xrClinic";
import { HIRSCHBERG_XR_PROCEDURE as hirschberg } from "../practice/xr/procedures";


describe("XR clinic spatial foundation", () => {
  it("converts stable station-local offsets into metre-scale world positions", () => {
    expect(stationWorldPosition("patient-chair", [10, 0, -2])).toEqual([10, 0, -2.75]);
    expect(worldFromStationOffset("instrument-bay", [.2, 1, .1])).toEqual([
      expect.closeTo(-1.1),
      expect.closeTo(1),
      expect.closeTo(.95),
    ]);
    expect(toolHomePosition("penlight")).toEqual([
      expect.closeTo(-1.76),
      expect.closeTo(1.04),
      expect.closeTo(.63),
    ]);
    expect(XR_CLINIC_STATIONS["patient-chair"].workRadiusM).toBeGreaterThan(0);
    expect(stationArrivalPosition("patient-chair")).toEqual([0, 0, .2]);
  });

  it("selects only the nearest reachable unheld tool", () => {
    let state = createXRClinicState("instrument-bay");
    const penlightPosition = toolHomePosition("penlight");
    expect(nearestToolId(state, penlightPosition, .1)).toBe("penlight");
    expect(nearestToolId(state, [8, 8, 8], .2)).toBeNull();

    state = pickupTool(state, "penlight", "right").state;
    expect(nearestToolId(state, penlightPosition, .1)).toBeNull();
  });
});

describe("XR clinic tool transitions", () => {
  it("picks up one tool per hand without mutating the prior state", () => {
    const initial = createXRClinicState();
    const pickup = pickupTool(initial, "penlight", "right");
    expect(pickup.changed).toBe(true);
    expect(toolHeldInHand(pickup.state, "right")).toBe("penlight");
    expect(initial.tools.penlight.kind).toBe("socket");

    const occupied = pickupTool(pickup.state, "occluder", "right");
    expect(occupied).toEqual({ state: pickup.state, changed: false, reason: "hand-occupied" });
    const alreadyHeld = pickupTool(pickup.state, "penlight", "left");
    expect(alreadyHeld.reason).toBe("tool-already-held");
  });

  it("persists a dropped tool in the world so it can be found and picked up again", () => {
    let state = pickupTool(createXRClinicState(), "occluder", "left").state;
    const drop = dropHeldTool(state, "left", [1, .8, -1]);
    expect(drop.state.tools.occluder).toEqual({ kind: "world", position: [1, .8, -1] });
    expect(nearestToolId(drop.state, [1.05, .8, -1], .1)).toBe("occluder");
    state = pickupTool(drop.state, "occluder", "right").state;
    expect(toolHeldInHand(state, "right")).toBe("occluder");
  });

  it("preserves a dropped instrument's world orientation", () => {
    const held = pickupTool(createXRClinicState(), "penlight", "right").state;
    const dropped = dropHeldTool(held, "right", [.4, .9, -.2], [0, .707, 0, .707]).state;
    expect(dropped.tools.penlight).toEqual({
      kind: "world",
      position: [.4, .9, -.2],
      rotation: [0, .707, 0, .707],
    });
  });

  it("returns a held tool only to its defined home station", () => {
    const held = pickupTool(createXRClinicState(), "prism-bar", "left").state;
    const wrong = returnHeldTool(held, "left", "recording-desk");
    expect(wrong.reason).toBe("wrong-return-station");
    expect(wrong.state).toBe(held);

    const returned = returnHeldTool(held, "left", "instrument-bay");
    expect(returned.changed).toBe(true);
    expect(returned.state.tools["prism-bar"]).toEqual({ kind: "socket", stationId: "instrument-bay" });
    expect(returnHeldTool(returned.state, "left", "instrument-bay").reason).toBe("hand-empty");
  });
});

describe("XR clinic procedure configuration", () => {
  it("identifies compatible tools without preventing learners from picking a wrong one", () => {
    expect(toolCompatibleWithProcedure("penlight", hirschberg)).toBe(true);
    expect(toolCompatibleWithProcedure("occluder", hirschberg)).toBe(false);
    expect(pickupTool(createXRClinicState(), "occluder", "right").changed).toBe(true);
  });

  it("requires the configured station, available instruments, and completed actions", () => {
    const initial = createXRClinicState();
    const initialReadiness = clinicProcedureReadiness(hirschberg, initial, []);
    expect(initialReadiness.ready).toBe(false);
    expect(initialReadiness.atRequiredStation).toBe(false);
    expect(initialReadiness.missingToolIds).toEqual(["penlight"]);

    let state = pickupTool(initial, "penlight", "right").state;
    state = moveToStation(state, "patient-chair");
    const incomplete = clinicProcedureReadiness(hirschberg, state, ["give-fixation-instruction"]);
    expect(incomplete.missingToolIds).toEqual([]);
    expect(incomplete.missingActions).toContain("establish-distance");
    expect(incomplete.missingActions).toContain("align-instrument");
    expect(incomplete.missingActions).toContain("align-view");

    const ready = clinicProcedureReadiness(hirschberg, state, hirschberg.requiredActions);
    expect(ready).toEqual({ ready: true, atRequiredStation: true, missingToolIds: [], missingActions: [] });
  });

  it("accepts a required tool dropped within the configured patient work area", () => {
    let state = pickupTool(createXRClinicState(), "penlight", "right").state;
    state = dropHeldTool(state, "right", [0, .75, -.7]).state;
    state = moveToStation(state, "patient-chair");
    expect(clinicProcedureReadiness(hirschberg, state, hirschberg.requiredActions).ready).toBe(true);
  });
});
