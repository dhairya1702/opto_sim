import { createElement } from "react";
import { act } from "@react-three/fiber";
import { Vector3, type Object3D } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clinic } from "./helpers/xrClinicHarness";
import { WorthPracticeController } from "../practice/xr/WorthPracticeController";
import type { BatchMirror } from "../practice/xr/PracticeLessonUI";
import { SENSORY_SOCKETS, SENSORY_NEAR_TARGET } from "../interaction/xrSensoryEquipment";
import { consultationToolDefinition, type ConsultationToolId } from "../interaction/xrConsultationTools";
import { PracticeAttemptProvider, type PracticeAttemptKind } from "../practice/PracticeAttemptContext";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });
async function lesson(preview = false, attemptKind?: PracticeAttemptKind) {
  let mirror: BatchMirror;
  const complete = vi.fn(), leave = vi.fn();
  const sim = await clinic({ renderAdapter: ({ active }) => {
    const controller = createElement(WorthPracticeController, { active, preview, onComplete: complete, onExit: leave, onMirror: next => { mirror = next; } });
    return attemptKind ? createElement(PracticeAttemptProvider, { value: { settings: { kind: attemptKind, interaction: "vr", voice: "enabled" }, setSettings: vi.fn() }, children: controller }) : controller;
  } });
  dispose = sim.dispose;
  const action = async (label: string) => {
    const action = mirror!.actions.find(item => item.label === label);
    if (!action) throw new Error(`Missing action ${label}`);
    await act(async () => action.run()); await sim.step(1 / 72, 12);
  };
  const seat = async (id: ConsultationToolId, socketId: string, hand = 1, alreadyHeld = false) => {
    const socket = SENSORY_SOCKETS.find(item => item.id === socketId)!;
    if (!alreadyHeld) await sim.pickup(hand, id);
    sim.grips[hand].quaternion.set(...socket.rotation); sim.rays[hand].quaternion.set(...socket.rotation);
    await sim.at(hand, socket.position); await sim.putDown(hand); await sim.step(1 / 72, 12);
  };
  const near = async (alreadyHeld = false) => {
    if (!alreadyHeld) await sim.pickup(0, "worth");
    sim.rays[0].rotation.set(0, 0, 0); sim.grips[0].rotation.set(0, 0, 0);
    const point = consultationToolDefinition("worth").workingPoint;
    await sim.at(0, SENSORY_NEAR_TARGET.map((value, i) => value - point[i]) as [number, number, number]); await sim.step(1 / 72, 12);
  };
  const setup = async () => {
    await seat("subjective", "sensory-correction"); await seat("red-green", "sensory-red-green"); await near();
    await sim.click(1, sim.button("SWITCH TARGET ON")); await sim.step(1 / 72, 12);
    await action("LOOK AT THE TARGET");
  };
  const enter = async (count: number, interpretation: string) => {
    await act(async () => mirror!.lesson.setMode("record")); await sim.step();
    await sim.click(1, sim.button(`${count} DOTS`)); await sim.click(1, sim.button(interpretation));
    await sim.click(1, sim.button("SUBMIT / CHECK")); await sim.step(1 / 72, 12);
  };
  const targetSwitch = () => {
    let control: Object3D | undefined;
    sim.tool("worth").traverse(object => { if (object.userData.xrInstrumentControl === "worth") control = object; });
    if (!control) throw new Error("Missing physical Worth target switch");
    return control;
  };
  const physicalSwitch = async (hand = 1) => {
    const control = targetSwitch();
    const point = control.getWorldPosition(new Vector3());
    await sim.at(hand, [point.x, point.y, point.z + .025]);
    await sim.click(hand, control);
  };
  return { ...sim, action, seat, near, setup, enter, targetSwitch, physicalSwitch, complete, leave, mirror: () => mirror! };
}

describe("mounted Worth Practice with the shared clinic runtime", () => {
  it("runs all twelve Guided steps from physical setup through both endpoint records", async () => {
    const sim = await lesson(false, "guided");
    expect(sim.labels()).toContain("GUIDED · STEP 1 OF 12");
    await sim.seat("subjective", "sensory-correction"); expect(sim.labels()).toContain("GUIDED · STEP 2 OF 12");
    await sim.seat("red-green", "sensory-red-green"); expect(sim.labels()).toContain("GUIDED · STEP 3 OF 12");
    await sim.pickup(0, "worth"); await sim.step(1 / 72, 12); expect(sim.labels()).toContain("GUIDED · STEP 4 OF 12");
    await sim.near(true); expect(sim.labels()).toContain("GUIDED · STEP 5 OF 12");
    const haptics = sim.haptics[1].mock.calls.length;
    await sim.click(0, sim.targetSwitch()); // The target-holding hand cannot operate its side switch.
    expect(sim.mirror().actions.some(action => action.label === "SWITCH TARGET ON")).toBe(true);
    await sim.at(1, [0, 1.6, 1.8]); await sim.click(1, sim.targetSwitch()); // Free hand remains outside control reach.
    expect(sim.mirror().actions.some(action => action.label === "SWITCH TARGET ON")).toBe(true);
    await sim.physicalSwitch(); expect(sim.mirror().actions.some(action => action.label === "SWITCH TARGET OFF")).toBe(true);
    expect(sim.haptics[1]).toHaveBeenCalledTimes(haptics + 1); expect(sim.labels()).toContain("GUIDED · STEP 6 OF 12");
    expect(sim.mirror().actions.some(action => action.label.includes("FILTER CHECK"))).toBe(false);
    await sim.action("LOOK AT THE TARGET"); expect(sim.labels()).toContain("GUIDED · STEP 7 OF 12");
    await sim.action("ASK COUNT, COLOURS AND POSITIONS"); expect(sim.labels()).toContain("GUIDED · STEP 8 OF 12");
    expect(sim.mirror().voiceReport).toContain("I see four dots");
    await sim.enter(4, "FLAT FUSION"); expect(sim.labels()).toContain("PROGRESS SAVED"); expect(sim.labels()).not.toContain("TRY AGAIN");
    expect(sim.labels()).toContain("GUIDED · STEP 9 OF 12");
    await act(async () => sim.mirror().lesson.setMode("none"));
    await sim.seat("worth", "sensory-worth-distance", 0, true);
    expect(sim.mirror().actions.some(action => action.label === "SWITCH TARGET OFF")).toBe(true);
    expect(sim.labels()).toContain("GUIDED · STEP 10 OF 12");
    await sim.action("LOOK AT THE TARGET"); expect(sim.labels()).toContain("GUIDED · STEP 11 OF 12");
    await sim.action("ASK COUNT, COLOURS AND POSITIONS"); expect(sim.labels()).toContain("GUIDED · STEP 12 OF 12");
    await sim.enter(2, "LEFT-EYE SUPPRESSION"); expect(sim.labels()).toContain("GUIDED · COMPLETE"); expect(sim.complete).toHaveBeenCalledTimes(1);
    await act(async () => sim.mirror().reset()); await sim.step(1 / 72, 12);
    expect(sim.labels()).toContain("GUIDED · STEP 1 OF 12"); expect(sim.mirror().voiceReport).toBeUndefined();
    expect(sim.mirror().status).toContain("Near pending"); expect(sim.mirror().actions.some(action => action.label === "SWITCH TARGET ON")).toBe(true);
  });

  it("keeps the same Worth capability in independent Test without rendering the Guided coach", async () => {
    const sim = await lesson(false, "test");
    expect(sim.labels().join(" ")).not.toContain("GUIDED · STEP");
    let highlights = 0; sim.state.scene.traverse(object => { if (object.userData.xrInstructionalHighlight) highlights++; });
    expect(highlights).toBe(0);
    const turnOn = sim.mirror().actions.find(action => action.label === "SWITCH TARGET ON")!;
    await act(async () => { turnOn.run(); turnOn.run(); }); await sim.step();
    expect(sim.mirror().actions.some(action => action.label === "SWITCH TARGET OFF")).toBe(true);
    const turnOff = sim.mirror().actions.find(action => action.label === "SWITCH TARGET OFF")!;
    await act(async () => { turnOff.run(); turnOff.run(); }); await sim.step();
    expect(sim.mirror().actions.some(action => action.label === "SWITCH TARGET ON")).toBe(true);
    await sim.pickup(0, "worth"); await sim.physicalSwitch();
    expect(sim.mirror().actions.some(action => action.label === "SWITCH TARGET OFF")).toBe(true);
  });

  it("fits physical correction and filters, captures near then mirrored distance, and records independently after release", async () => {
    const sim = await lesson();
    expect(sim.labels().join(" ")).not.toMatch(/central-os|suppress-os/);
    await sim.action("ASK COUNT, COLOURS AND POSITIONS"); expect(sim.mirror().ready).toBe(false);
    await sim.setup(); await sim.event(0, "selectstart"); await sim.event(0, "selectend"); await sim.step(1 / 72, 12);
    expect(sim.mirror().status).toContain("Four dots"); expect(sim.mirror().ready).toBe(true);
    expect(sim.mirror().lesson.entries).toEqual({}); expect(sim.complete).not.toHaveBeenCalled();
    await sim.at(0, [1.04, 1.055, .88]); await sim.putDown(0); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready).toBe(true);
    await sim.enter(5, "FLAT FUSION"); expect(sim.complete).not.toHaveBeenCalled(); expect(sim.mirror().lesson.feedback).toContain("Recheck");
    await sim.enter(4, "FLAT FUSION"); expect(sim.complete).not.toHaveBeenCalled(); expect(sim.mirror().status).toContain("Near recorded");
    await act(async () => sim.mirror().lesson.setMode("none"));
    await sim.seat("worth", "sensory-worth-distance", 0);
    await sim.action("LOOK AT THE TARGET");
    await sim.panel(1); await sim.click(1, sim.button("ASK COUNT, COLOURS AND POSITIONS")); await sim.step(1 / 72, 12);
    expect(sim.mirror().status).toContain("Two red dots"); expect(sim.mirror().ready).toBe(true);
    await sim.click(1, sim.button("RECORD FINDING"));
    expect(sim.mirror().lesson.entries).toEqual({});
    await sim.enter(2, "LEFT-EYE SUPPRESSION"); expect(sim.complete).toHaveBeenCalledTimes(1);
    await act(async () => sim.mirror().record()); expect(sim.complete).toHaveBeenCalledTimes(1);
    expect(sim.record).not.toHaveBeenCalled(); expect(sim.encounter().results).toEqual([]);
  });
  it("requires fresh reports after moving, denies intermediate endpoint credit, and handles cancel, refitting, reset and exit", async () => {
    const sim = await lesson(); await sim.setup(); await sim.action("ASK COUNT, COLOURS AND POSITIONS");
    await sim.at(0, [0, 1.305, .5]); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready).toBe(true); // Released/moved capture remains recordable.
    await sim.action("ASK COUNT, COLOURS AND POSITIONS"); expect(sim.mirror().ready).toBe(true);
    expect(sim.mirror().status).not.toContain("intermediate"); // An invalid fresh question cannot replace the immutable near snapshot.
    await sim.near(true); await sim.action("ASK COUNT, COLOURS AND POSITIONS"); expect(sim.mirror().ready).toBe(true);
    await act(async () => sim.mirror().cancel?.()); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready).toBe(false); expect(sim.mirror().lesson.entries).toEqual({});
    await sim.action("ASK COUNT, COLOURS AND POSITIONS");
    await sim.pickup(1, "red-green"); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready).toBe(false); expect(sim.mirror().status).toContain("Fit red OD");
    await sim.seat("red-green", "sensory-red-green", 1, true);
    expect(sim.mirror().actions.some(action => action.label.includes("FILTER CHECK"))).toBe(false);
    await sim.action("NEW PATIENT PATTERN"); expect(sim.mirror().ready).toBe(false);
    await act(async () => sim.mirror().reset()); await sim.step(1 / 72, 12);
    expect(sim.tool("worth").position.toArray()).toEqual(consultationToolDefinition("worth").home);
    await sim.exit(); await sim.event(0, "selectstart"); await sim.action("ASK COUNT, COLOURS AND POSITIONS");
    await act(async () => sim.mirror().record()); expect(sim.complete).not.toHaveBeenCalled();
  });
  it("preview cannot elicit a report or complete", async () => {
    const sim = await lesson(true); await sim.seat("subjective", "sensory-correction"); await sim.seat("red-green", "sensory-red-green");
    await sim.near(); await sim.action("SWITCH TARGET ON"); await sim.action("ASK COUNT, COLOURS AND POSITIONS");
    expect(sim.mirror().ready).toBe(false); expect(sim.complete).not.toHaveBeenCalled();
  });
  it("blocks unlit, reversed and untracked target reports; transfer preserves power and captured reports survive tracking loss", async () => {
    const sim = await lesson(); await sim.setup();
    await sim.action("SWITCH TARGET OFF"); await sim.action("ASK COUNT, COLOURS AND POSITIONS"); expect(sim.mirror().ready).toBe(false);
    await sim.action("SWITCH TARGET ON"); sim.grips[0].rotation.y = Math.PI; sim.rays[0].rotation.y = Math.PI; await sim.step(1 / 72, 12);
    await sim.action("ASK COUNT, COLOURS AND POSITIONS"); expect(sim.mirror().ready).toBe(false);
    sim.grips[0].rotation.y = 0; sim.rays[0].rotation.y = 0; await sim.step(1 / 72, 12); await sim.action("LOOK AT THE TARGET");
    sim.tracked[0] = false; await sim.step(1 / 72, 12); await sim.action("ASK COUNT, COLOURS AND POSITIONS");
    expect(sim.mirror().ready).toBe(false); sim.tracked[0] = true; await sim.step(1 / 72, 12);
    await sim.action("LOOK AT THE TARGET"); await sim.action("ASK COUNT, COLOURS AND POSITIONS"); expect(sim.mirror().ready).toBe(true);
    sim.tracked[0] = false; await sim.step(1 / 72, 12); expect(sim.mirror().ready).toBe(true);
    sim.tracked[0] = true; await sim.step(1 / 72, 12);
    // Transfer a powered physical target; the receiving grip atomically owns its sole model.
    await sim.pickup(1, "worth"); await sim.event(0, "squeezeend"); await sim.step(1 / 72, 12);
    expect(sim.mirror().actions.some(action => action.label === "SWITCH TARGET OFF")).toBe(true);
    expect(sim.mirror().ready).toBe(true); await sim.putDown(1);
    await sim.enter(4, "FLAT FUSION"); expect(sim.mirror().status).toContain("Near recorded");
    await sim.action("NEW PATIENT PATTERN"); expect(sim.mirror().status).toContain("Near pending");
    expect(sim.mirror().lesson.entries).toEqual({}); expect(sim.complete).not.toHaveBeenCalled();
  });
});
