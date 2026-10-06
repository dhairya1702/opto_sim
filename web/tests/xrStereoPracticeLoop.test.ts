import { createElement } from "react";
import { act } from "@react-three/fiber";
import { Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clinic } from "./helpers/xrClinicHarness";
import { StereoPracticeController } from "../practice/xr/StereoPracticeController";
import type { BatchMirror } from "../practice/xr/PracticeLessonUI";
import { SENSORY_SOCKETS } from "../interaction/xrSensoryEquipment";
import { consultationToolDefinition } from "../interaction/xrConsultationTools";
import { stereoPatientReply } from "../interaction/stereoPractice";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });
async function lesson(preview = false) {
  let mirror: BatchMirror;
  const complete = vi.fn(), exit = vi.fn();
  const sim = await clinic({ renderAdapter: ({ active }) => createElement(StereoPracticeController, {
    active, preview, onComplete: complete, onExit: exit, onMirror: next => { mirror = next; },
  }) });
  dispose = sim.dispose;
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  const action = async (label: string) => {
    const found = mirror!.actions.find(action => action.label === label);
    if (!found) throw new Error(`Missing stereo action: ${label}`);
    await act(async () => found.run()); await sim.step(1 / 72, 10);
  };
  const fit = async () => {
    for (const [hand, id, socketId] of [[0, "subjective", "sensory-correction"], [1, "polarised", "sensory-polarised"]] as const) {
      const socket = SENSORY_SOCKETS.find(item => item.id === socketId);
      if (!socket) throw new Error(`Missing socket ${socketId}`);
      await sim.pickup(hand, id); await sim.at(hand, socket.position); await sim.event(hand, "squeezeend"); await sim.step(1 / 72, 12);
    }
  };
  const book = async (placed = true) => {
    const socket = SENSORY_SOCKETS.find(item => item.id === "sensory-stereo-near");
    if (!socket) throw new Error("Missing stereo stand");
    await sim.pickup(0, "stereo"); await sim.at(0, socket.position); await sim.step(1 / 72, 12);
    if (placed) { await sim.event(0, "squeezeend"); await sim.step(1 / 72, 12); }
  };
  const reply = async () => { await act(async () => vi.advanceTimersByTime(1000)); await sim.step(1 / 72, 12); };
  const run = async () => {
    for (let page = 0; page < 6; page++) {
      await action("PRESENT PAGE / ASK"); await reply();
      const authored = stereoPatientReply(page);
      if (!authored) throw new Error("Missing authored reply");
      await action(`${["LEFT", "MIDDLE", "RIGHT"][authored.selected]} CIRCLE`);
      if (page < 5) await action("NEXT PAGE");
    }
  };
  return { ...sim, complete, leave: exit, action, fit, book, reply, run, mirror: () => mirror! };
}

describe("stereo Practice in the real shared XR loop", () => {
  it("fits correction/filter layers, physically docks pages, confirms named circles, and records once after release without Test evidence", async () => {
    const sim = await lesson();
    expect(sim.labels().join(" ")).not.toContain("100 seconds");
    await sim.action("PRESENT PAGE / ASK"); await sim.reply(); expect(sim.mirror().status).not.toContain("middle circle appears");
    await sim.fit(); await sim.book();
    // Patient-relative names refer to the same physical circle on both faces.
    sim.state.scene.traverse(object => {
      const name = object.userData.xrStereoPatientCircle as string | undefined;
      if (!name) return;
      let control: typeof object | undefined;
      sim.state.scene.traverse(candidate => { if (candidate.userData.xrLabel === `BOOKLET ${name.toUpperCase()} CIRCLE`) control = candidate; });
      expect(control).toBeDefined();
      const patient = object.getWorldPosition(new Vector3()), examiner = control!.getWorldPosition(new Vector3());
      expect(examiner.x).toBeCloseTo(patient.x, 8); expect(examiner.y).toBeCloseTo(patient.y, 2);
    });
    expect(sim.tool("stereo").position.toArray()).toEqual(SENSORY_SOCKETS.find(socket => socket.id === "sensory-stereo-near")?.position);
    await sim.panel(1); await sim.click(1, sim.button("PRESENT PAGE / ASK"));
    expect(sim.mirror().status).toContain("let me look");
    await sim.action("PRESENT PAGE / ASK");
    await act(async () => vi.advanceTimersByTime(999)); await sim.step(1 / 72, 12);
    expect(sim.mirror().status).toContain("let me look");
    await act(async () => vi.advanceTimersByTime(1)); await sim.step(1 / 72, 12);
    expect(sim.mirror().status).toContain("middle circle appears raised");
    await sim.panel(1);
    await sim.click(1, sim.button("BOOKLET LEFT CIRCLE"));
    expect(sim.mirror().status).toContain("Mark the circle the patient named");
    await sim.click(1, sim.button("BOOKLET MIDDLE CIRCLE"));
    expect(sim.mirror().status).toContain("correct patient identification");
    await sim.action("NEXT PAGE");
    expect(sim.labels()).toContain("PAGE 2 · 400 arcsec");
    await sim.panel(1);
    for (let page = 1; page < 6; page++) {
      await sim.click(1, sim.button("PRESENT PAGE / ASK")); await sim.reply();
      const authored = stereoPatientReply(page);
      if (!authored) throw new Error("Missing reply");
      if (page === 4) { await sim.action("RIGHT CIRCLE"); expect(sim.mirror().status).toContain("Mark the circle the patient named"); }
      await sim.click(1, sim.button(`${["LEFT", "MIDDLE", "RIGHT"][authored.selected]} CIRCLE`));
      if (page < 5) await sim.click(1, sim.button("NEXT PAGE"));
    }
    expect(sim.mirror().entryReady).toBe(true); expect(sim.mirror().lesson.entries).toEqual({});
    await sim.pickup(0, "stereo"); await sim.at(0, consultationToolDefinition("stereo").home); await sim.event(0, "squeezeend"); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready).toBe(true);
    await sim.click(1, sim.button("RECORD FINDING"));
    await sim.click(1, sim.button("60 ARCSEC")); await sim.click(1, sim.button("SUBMIT / CHECK")); expect(sim.complete).not.toHaveBeenCalled();
    await sim.click(1, sim.button("100 ARCSEC")); await sim.click(1, sim.button("SUBMIT / CHECK")); expect(sim.complete).toHaveBeenCalledTimes(1);
    await act(async () => sim.mirror().record()); expect(sim.complete).toHaveBeenCalledTimes(1);
    expect(sim.record).not.toHaveBeenCalled(); expect(sim.encounter().results).toHaveLength(0);
  });
  it("keeps in-range tremor, invalidates out-of-range/facing/tracking changes, and ignores delayed replies after reset or exit", async () => {
    const sim = await lesson(); await sim.fit(); await sim.book(false);
    await sim.action("PRESENT PAGE / ASK");
    const socket = SENSORY_SOCKETS.find(item => item.id === "sensory-stereo-near");
    if (!socket) throw new Error("Missing stand");
    await sim.at(0, [socket.position[0] + .004, socket.position[1], socket.position[2] + .004]); await sim.reply();
    expect(sim.mirror().status).toContain("middle circle appears raised");
    await sim.action("MIDDLE CIRCLE"); await sim.action("NEXT PAGE");
    await sim.at(0, [0, 1.5, .05]); await sim.step(1 / 72, 12);
    await sim.at(0, socket.position); await sim.step(1 / 72, 12);
    expect(sim.mirror().status).toContain("800 arcsec"); expect(sim.mirror().entryReady).toBe(false);
    await sim.action("PRESENT PAGE / ASK"); sim.grips[0].rotation.set(0, Math.PI, 0); await sim.step(1 / 72, 12); await sim.reply();
    expect(sim.mirror().status).not.toContain("middle circle appears raised");
    sim.grips[0].rotation.set(0, 0, 0); await sim.step(1 / 72, 12); await sim.action("PRESENT PAGE / ASK");
    sim.tracked[0] = false; await sim.step(1 / 72, 12); await sim.reply(); expect(sim.mirror().status).not.toContain("middle circle appears raised");
    sim.tracked[0] = true; await sim.step(1 / 72, 12); await sim.action("PRESENT PAGE / ASK");
    await act(async () => sim.mirror().reset()); await sim.reply(); expect(sim.mirror().entryReady).toBe(false);
    await sim.fit(); await sim.book(false); await sim.action("PRESENT PAGE / ASK");
    await sim.exit(); await sim.reply(); await act(async () => sim.mirror().record()); expect(sim.complete).not.toHaveBeenCalled();
  });
  it("cancels a pending menu question without a stale reply, and a docked booklet does not depend on either releasing hand", async () => {
    const sim = await lesson(); await sim.fit(); await sim.book();
    await sim.action("PRESENT PAGE / ASK"); await sim.panel(1); await sim.reply();
    expect(sim.mirror().status).not.toContain("middle circle appears raised");
    await sim.click(1, sim.button("PRESENT PAGE / ASK")); await sim.reply();
    await sim.click(1, sim.button("MIDDLE CIRCLE")); await sim.click(1, sim.button("NEXT PAGE"));
    sim.tracked[0] = false; await sim.step(1 / 72, 12);
    expect(sim.mirror().status).toContain("400 arcsec");
    await sim.click(1, sim.button("PRESENT PAGE / ASK")); await sim.reply();
    expect(sim.mirror().status).toContain("left circle appears raised");
    sim.session.visibilityState = "hidden";
    await act(async () => sim.session.dispatchEvent(new Event("visibilitychange"))); await sim.step(1 / 72, 12);
    sim.session.visibilityState = "visible"; sim.tracked[0] = true; await sim.step(1 / 72, 12);
    expect(sim.mirror().status).toContain("800 arcsec"); expect(sim.mirror().entryReady).toBe(false);
  });
  it("cancels completed evidence, requires a new run, and invalidates capture on removal of fitted glasses", async () => {
    const sim = await lesson(); await sim.fit(); await sim.book(); await sim.run(); expect(sim.mirror().ready).toBe(true);
    await act(async () => sim.mirror().lesson.setMode("record")); await sim.step(1 / 72, 12);
    await sim.click(1, sim.button("100 ARCSEC")); await sim.click(1, sim.button("CANCEL"));
    expect(sim.mirror().entryReady).toBe(false); expect(sim.mirror().lesson.entries).toEqual({}); expect(sim.complete).not.toHaveBeenCalled();
    await sim.run(); expect(sim.mirror().ready).toBe(true);
    await sim.pickup(1, "polarised"); await sim.step(1 / 72, 12); expect(sim.mirror().entryReady).toBe(false);
    await sim.event(1, "squeezeend"); await sim.step(1 / 72, 12);
    expect(sim.mirror().entryReady).toBe(false);
  });
  it("preview equipment can be inspected but cannot obtain responses or award completion", async () => {
    const sim = await lesson(true); await sim.action("PRESENT PAGE / ASK"); await sim.reply();
    expect(sim.mirror().entryReady).toBe(false); expect(sim.mirror().ready).toBe(false);
    await act(async () => sim.mirror().record()); expect(sim.complete).not.toHaveBeenCalled(); expect(sim.record).not.toHaveBeenCalled();
  });
});
