import { createElement } from "react";
import { act } from "@react-three/fiber";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clinic } from "./helpers/xrClinicHarness";
import { WorthPracticeController } from "../practice/xr/WorthPracticeController";
import type { BatchMirror } from "../practice/xr/PracticeLessonUI";
import { SENSORY_SOCKETS, SENSORY_NEAR_TARGET } from "../interaction/xrSensoryEquipment";
import { consultationToolDefinition, type ConsultationToolId } from "../interaction/xrConsultationTools";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });
async function lesson(preview = false) {
  let mirror: BatchMirror;
  const complete = vi.fn(), leave = vi.fn();
  const sim = await clinic({ renderAdapter: ({ active }) => createElement(WorthPracticeController,
    { active, preview, onComplete: complete, onExit: leave, onMirror: next => { mirror = next; } }) });
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
    await sim.panel(1); await sim.click(1, sim.button("CHECK RED FILTER"));
    expect(sim.labels().join(" ")).toContain("ISOLATED FILTER CHECK");
    await sim.click(1, sim.button("CONFIRM ISOLATED FILTER VIEW"));
    await sim.panel(1); await sim.panel(1); await sim.click(1, sim.button("CHECK GREEN FILTER"));
    await sim.click(1, sim.button("CONFIRM ISOLATED FILTER VIEW"));
    await sim.panel(1);
  };
  const enter = async (count: number, interpretation: string) => {
    await act(async () => mirror!.lesson.setMode("record")); await sim.step();
    await sim.click(1, sim.button(`${count} DOTS`)); await sim.click(1, sim.button(interpretation));
    await sim.click(1, sim.button("SUBMIT / CHECK")); await sim.step(1 / 72, 12);
  };
  return { ...sim, action, seat, near, setup, enter, complete, leave, mirror: () => mirror! };
}

describe("mounted Worth Practice with the shared clinic runtime", () => {
  it("fits physical correction and filters, verifies both, captures near then mirrored distance, and records independently after release", async () => {
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
    await sim.action("ASK COUNT, COLOURS AND POSITIONS"); expect(sim.mirror().ready).toBe(false);
    expect(sim.mirror().status).toContain("intermediate");
    await sim.near(true); await sim.action("ASK COUNT, COLOURS AND POSITIONS"); expect(sim.mirror().ready).toBe(true);
    await act(async () => sim.mirror().cancel?.()); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready).toBe(false); expect(sim.mirror().lesson.entries).toEqual({});
    await sim.action("ASK COUNT, COLOURS AND POSITIONS");
    await sim.pickup(1, "red-green"); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready).toBe(false); expect(sim.mirror().status).toContain("Fit red OD");
    await sim.seat("red-green", "sensory-red-green", 1, true); expect(sim.mirror().status).toContain("each isolated filter");
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
    sim.grips[0].rotation.y = 0; sim.rays[0].rotation.y = 0; await sim.step(1 / 72, 12);
    sim.tracked[0] = false; await sim.step(1 / 72, 12); await sim.action("ASK COUNT, COLOURS AND POSITIONS");
    expect(sim.mirror().ready).toBe(false); sim.tracked[0] = true; await sim.step(1 / 72, 12);
    await sim.action("ASK COUNT, COLOURS AND POSITIONS"); expect(sim.mirror().ready).toBe(true);
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
