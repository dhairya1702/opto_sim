import { createElement } from "react";
import { act } from "@react-three/fiber";
import { Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clinic } from "./helpers/xrClinicHarness";
import { StereoPracticeController } from "../practice/xr/StereoPracticeController";
import { PracticeAttemptProvider, type PracticeAttemptKind } from "../practice/PracticeAttemptContext";
import type { BatchMirror } from "../practice/xr/PracticeLessonUI";
import { SENSORY_SOCKETS } from "../interaction/xrSensoryEquipment";
import { consultationToolDefinition } from "../interaction/xrConsultationTools";
import { stereoPatientReply } from "../interaction/stereoPractice";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });

async function lesson(attemptKind: PracticeAttemptKind = "guided", preview = false) {
  let mirror: BatchMirror;
  const complete = vi.fn(), exit = vi.fn();
  const sim = await clinic({ renderAdapter: ({ active }) => createElement(PracticeAttemptProvider, {
    value: { settings: { kind: attemptKind, interaction: "vr", voice: "enabled" }, setSettings: vi.fn() },
    children: createElement(StereoPracticeController, { active, preview, onComplete: complete, onExit: exit, onMirror: next => { mirror = next; } }),
  }) });
  dispose = sim.dispose;
  const action = async (label: string) => {
    const found = mirror!.actions.find(item => item.label === label);
    if (!found) throw new Error(`Missing stereo action: ${label}`);
    await act(async () => found.run()); await sim.step(1 / 72, 10);
  };
  const fit = async () => {
    for (const [hand, id, socketId] of [[0, "subjective", "sensory-correction"], [1, "polarised", "sensory-polarised"]] as const) {
      const socket = SENSORY_SOCKETS.find(item => item.id === socketId);
      if (!socket) throw new Error(`Missing socket ${socketId}`);
      await sim.pickup(hand, id); await sim.at(hand, socket.position); await sim.putDown(hand); await sim.step(1 / 72, 12);
    }
  };
  const book = async (placed = true) => {
    const socket = SENSORY_SOCKETS.find(item => item.id === "sensory-stereo-near");
    if (!socket) throw new Error("Missing stereo stand");
    await sim.pickup(0, "stereo"); await sim.at(0, socket.position); await sim.step(1 / 72, 12);
    if (placed) { await sim.putDown(0); await sim.step(1 / 72, 12); }
  };
  const answer = async (page: number) => {
    await action("LOOK AT THE CIRCLES");
    await action("ASK WHICH CIRCLE IS RAISED");
    const authored = stereoPatientReply(page);
    if (!authored) throw new Error("Missing authored response");
    await action(["LEFT", "MIDDLE", "RIGHT"][authored.selected]);
  };
  const run = async () => {
    for (let page = 0; page < 6; page++) {
      await answer(page);
      if (page < 5) await action("TURN PAGE");
    }
  };
  return { ...sim, complete, leave: exit, action, fit, book, answer, run, mirror: () => mirror! };
}

describe("stereopsis Practice in the real shared XR loop", () => {
  it("shows the nine-step Guided coach immediately and keeps the examiner key off the patient face", async () => {
    const sim = await lesson("guided", true);
    expect(sim.labels()).toContain("GUIDED · STEP 1 OF 9");
    expect(sim.labels()).toContain("CORRECT CIRCLE · MIDDLE");
    let patientKey = false;
    sim.state.scene.traverse(object => {
      if (!object.userData.xrStereoPatientCircle) return;
      object.traverse(descendant => { if (descendant.userData.xrLabel?.includes("CORRECT CIRCLE")) patientKey = true; });
    });
    expect(patientKey).toBe(false);
    expect(sim.labels().join(" ")).not.toContain("last correct is");
  });

  it("fits, fixates, captures, transcribes, automatically classifies and records exactly once", async () => {
    const sim = await lesson();
    await sim.fit(); await sim.book();
    expect(sim.mirror().status).toContain("ask Arun to look");
    await sim.action("LOOK AT THE CIRCLES");
    expect(sim.mirror().status).toContain("ask which circle");
    await sim.action("ASK WHICH CIRCLE IS RAISED");
    expect(sim.mirror().voiceReport).toBe("The middle circle looks raised.");
    expect(sim.mirror().reportLines).toEqual([]);
    await sim.action("LEFT");
    expect(sim.mirror().status).toContain("does not match Arun's spoken response");
    await sim.action("MIDDLE");
    expect(sim.mirror().status).toContain("Patient said middle; correct circle middle. Automatically marked correct.");
    expect(sim.mirror().reportLines?.[0]).toBe("800 arcsec · patient said middle · correct circle middle · correct");
    await sim.action("TURN PAGE");
    expect(sim.labels()).toContain("PAGE 2 OF 6");
    expect(sim.mirror().actions.find(item => item.label === "ASK WHICH CIRCLE IS RAISED")?.disabled).toBe(true);
    for (let page = 1; page < 6; page++) {
      await sim.answer(page);
      if (page < 5) await sim.action("TURN PAGE");
    }
    expect(sim.mirror().entryReady).toBe(true);
    expect(sim.mirror().lesson.entries).toEqual({});
    await sim.pickup(0, "stereo"); await sim.at(0, consultationToolDefinition("stereo").home); await sim.putDown(0); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready).toBe(true);
    await sim.panel(1); await sim.click(1, sim.button("RECORD FINDING"));
    await sim.click(1, sim.button("60 ARCSEC")); await sim.click(1, sim.button("SUBMIT / CHECK")); expect(sim.complete).not.toHaveBeenCalled();
    await sim.click(1, sim.button("100 ARCSEC")); await sim.click(1, sim.button("SUBMIT / CHECK")); expect(sim.complete).toHaveBeenCalledTimes(1);
    await act(async () => sim.mirror().record()); expect(sim.complete).toHaveBeenCalledTimes(1);
    expect(sim.record).not.toHaveBeenCalled(); expect(sim.encounter().results).toHaveLength(0);
  });

  it("uses one physical page-turn transition with free-hand proximity and one haptic", async () => {
    const sim = await lesson(); await sim.fit(); await sim.book(false); await sim.answer(0);
    const control = sim.button("BOOKLET TURN PAGE");
    await sim.click(1, control);
    expect(sim.labels()).toContain("PAGE 1 OF 6");
    const point = control.getWorldPosition(new Vector3()).toArray() as [number, number, number];
    await sim.at(1, point); await sim.click(1, control);
    expect(sim.labels()).toContain("PAGE 2 OF 6");
    expect(sim.haptics[1]).toHaveBeenCalledTimes(1);
    await sim.click(1, control);
    expect(sim.labels()).toContain("PAGE 2 OF 6");
    expect(sim.haptics[1]).toHaveBeenCalledTimes(1);
  });

  it("preserves confirmed pages but clears the unfinished page and fixation after interruption", async () => {
    const sim = await lesson(); await sim.fit(); await sim.book(false); await sim.answer(0); await sim.action("TURN PAGE");
    await sim.action("LOOK AT THE CIRCLES"); await sim.action("ASK WHICH CIRCLE IS RAISED");
    const socket = SENSORY_SOCKETS.find(item => item.id === "sensory-stereo-near");
    if (!socket) throw new Error("Missing stand");
    await sim.at(0, [0, 1.5, .05]); await sim.step(1 / 72, 12);
    await sim.at(0, socket.position); await sim.step(1 / 72, 12);
    expect(sim.mirror().reportLines).toEqual(["800 arcsec · patient said middle · correct circle middle · correct"]);
    expect(sim.mirror().voiceReport).toBeUndefined();
    expect(sim.mirror().status).toContain("Page 2 of 6 · ask Arun to look");
    await sim.action("ASK WHICH CIRCLE IS RAISED");
    expect(sim.mirror().voiceReport).toBeUndefined();
  });

  it("keeps the full procedure in Test while hiding coaching and highlights", async () => {
    const sim = await lesson("test");
    expect(sim.labels().join(" ")).not.toContain("GUIDED · STEP");
    expect(sim.labels()).toContain("CORRECT CIRCLE · MIDDLE");
    await sim.fit(); await sim.book(); await sim.answer(0);
    expect(sim.mirror().reportLines?.[0]).toContain("correct circle middle · correct");
    expect(sim.mirror().actions.map(action => action.label)).toEqual(expect.arrayContaining(["LOOK AT THE CIRCLES", "ASK WHICH CIRCLE IS RAISED", "TURN PAGE"]));
    expect(sim.mirror().actions.map(action => action.label)).not.toContain("CORRECT");
    expect(sim.mirror().actions.map(action => action.label)).not.toContain("INCORRECT");
  });

  it("reset, refitting and exit clear unfinished state and cannot create late evidence", async () => {
    const sim = await lesson(); await sim.fit(); await sim.book();
    await sim.action("LOOK AT THE CIRCLES"); await sim.action("ASK WHICH CIRCLE IS RAISED");
    await act(async () => sim.mirror().reset());
    expect(sim.mirror().voiceReport).toBeUndefined(); expect(sim.mirror().reportLines).toEqual([]);
    await sim.fit(); await sim.book(); await sim.answer(0);
    await sim.pickup(1, "polarised"); await sim.step(1 / 72, 12);
    expect(sim.mirror().reportLines).toEqual([]);
    await sim.exit(); await act(async () => sim.mirror().record());
    expect(sim.complete).not.toHaveBeenCalled();
  });
});
