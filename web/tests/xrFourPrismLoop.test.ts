import { createElement } from "react";
import { act } from "@react-three/fiber";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clinic } from "./helpers/xrClinicHarness";
import { FourPrismPracticeController } from "../practice/xr/FourPrismPracticeController";
import type { BatchMirror } from "../practice/xr/PracticeLessonUI";
import { SENSORY_SOCKETS } from "../interaction/xrSensoryEquipment";
let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });
async function lesson(preview = false) {
  let mirror: BatchMirror;
  const complete = vi.fn(), leave = vi.fn();
  const sim = await clinic({ renderAdapter: ({ active }) => createElement(FourPrismPracticeController, { active, preview, onComplete: complete, onExit: leave, onMirror: next => { mirror = next; } }) });
  dispose = sim.dispose;
  const action = async (label: string) => {
    const item = mirror!.actions.find(candidate => candidate.label === label);
    if (!item) throw new Error(`Missing action ${label}`);
    await act(async () => item.run()); await sim.step(1 / 72, 12);
  };
  const fit = async () => {
    const socket = SENSORY_SOCKETS.find(socket => socket.id === "sensory-correction")!;
    await sim.pickup(0, "subjective"); await sim.at(0, socket.position); await sim.event(0, "squeezeend"); await sim.step(1 / 72, 12);
  };
  const prism = async (eye: "OD" | "OS") => { await sim.at(1, [eye === "OD" ? -.048 : .048, 1.357, -.481]); };
  const prepare = async () => {
    await fit(); await action("FIXATE ISOLATED LETTER · SINGLE"); await action("BASE OUT · BO");
    for (let i = 0; i < 4; i++) await action("PRISM +1Δ");
    sim.viewerCamera.position.set(0, 1.5, .65); await sim.pickup(1, "prism");
  };
  const bilateral = async () => {
    await prism("OD"); await sim.step(1 / 72, 175);
    await sim.at(1, [.4, 1.357, -.481]); await prism("OS"); await sim.step(1 / 72, 175);
  };
  return { ...sim, mirror: () => mirror!, complete, leave, action, fit, prism, prepare, bilateral };
}
describe("mounted shared-clinic 4Δ base-out Practice", () => {
  it("observes physical eye motion OD then OS and records after releasing the prism exactly once", async () => {
    const sim = await lesson(); await sim.prepare();
    await sim.prism("OS"); await sim.step(1 / 72, 175); expect(sim.mirror().ready).toBe(false);
    await sim.prism("OD"); await sim.step(1 / 72, 45);
    expect(sim.eyes("consultationGaze").map(eye => eye.position.x)).toEqual([.012, .012]);
    await sim.step(1 / 72, 60);
    expect(sim.eyes("consultationGaze").map(eye => eye.position.x)).toEqual([.012, 0]);
    await sim.step(1 / 72, 70); expect(sim.mirror().status).toContain("1/2 placements");
    await sim.prism("OS"); await sim.step(1 / 72, 175); expect(sim.mirror().ready).toBe(false);
    await sim.at(1, [.4, 1.357, -.481]); await sim.prism("OS"); await sim.step(1 / 72, 175);
    expect(sim.mirror().ready).toBe(true); expect(sim.complete).not.toHaveBeenCalled();
    await sim.event(1, "squeezeend"); await sim.step(1 / 72, 12); expect(sim.mirror().ready).toBe(true);
    await act(async () => {
      sim.session.visibilityState = "hidden"; sim.session.dispatchEvent(new Event("visibilitychange"));
      sim.mirror().lesson.choose("interpretation", "normal"); sim.mirror().record();
    });
    expect(sim.complete).not.toHaveBeenCalled();
    await act(async () => { sim.session.visibilityState = "visible"; sim.session.dispatchEvent(new Event("visibilitychange")); sim.mirror().lesson.choose("interpretation", ""); });
    await sim.step(1 / 72, 12);
    await sim.panel(1); await sim.click(1, sim.button("RECORD FINDING"));
    expect(sim.mirror().lesson.entries.interpretation || "").toBe("");
    await sim.click(1, sim.button("CENTRAL SUPPRESSION OF OS")); await sim.click(1, sim.button("RECORD OBSERVATION")); expect(sim.complete).not.toHaveBeenCalled();
    await sim.click(1, sim.button("NORMAL RESPONSE · NO SUPPRESSION")); await sim.click(1, sim.button("RECORD OBSERVATION"));
    expect(sim.complete).toHaveBeenCalledTimes(1); sim.mirror().record(); expect(sim.complete).toHaveBeenCalledTimes(1);
    expect(sim.record).not.toHaveBeenCalled(); expect(sim.encounter().results).toHaveLength(0);
  });
  it("resets interrupted dwell, rejects backwards/tilted prism and invalidates settings or fitting changes", async () => {
    const sim = await lesson(); await sim.prepare(); await sim.prism("OD"); await sim.step(1 / 72, 90);
    sim.tracked[1] = false; await sim.step(); sim.tracked[1] = true; await sim.step(1 / 72, 90);
    expect(sim.mirror().status).toContain("0/2 placements");
    sim.grips[1].rotation.y = Math.PI; await sim.step(1 / 72, 180); expect(sim.mirror().ready).toBe(false);
    sim.grips[1].rotation.y = Math.PI / 2; await sim.step(1 / 72, 180); expect(sim.mirror().ready).toBe(false);
    sim.grips[1].rotation.y = 0; await sim.bilateral(); expect(sim.mirror().ready).toBe(true);
    await sim.action("PRISM −1Δ"); expect(sim.mirror().ready).toBe(false); expect(sim.mirror().lesson.entries).toEqual({});
    await sim.action("PRISM +1Δ"); await sim.bilateral(); expect(sim.mirror().ready).toBe(true);
    await sim.pickup(0, "subjective"); await sim.step(1 / 72, 12); expect(sim.mirror().ready).toBe(false);
  });
  it("cycles the suppression timeline, cancels unrecorded capture and ignores late exit input", async () => {
    const sim = await lesson(); await sim.prepare(); await sim.bilateral();
    await act(async () => sim.mirror().cancel?.()); await sim.step(1 / 72, 12); expect(sim.mirror().ready).toBe(false);
    await sim.bilateral(); await act(async () => sim.mirror().next?.()); await sim.step(1 / 72, 12);
    await sim.event(0, "squeezeend"); await sim.event(1, "squeezeend");
    await sim.prepare(); await sim.prism("OD"); await sim.step(1 / 72, 100);
    expect(sim.eyes("consultationGaze").map(eye => eye.position.x)).toEqual([.012, .012]);
    await sim.step(1 / 72, 80); await sim.at(1, [.4, 1.357, -.481]); await sim.prism("OS"); await sim.step(1 / 72, 100);
    expect(sim.eyes("consultationGaze").map(eye => eye.position.x)).toEqual([0, 0]);
    await sim.step(1 / 72, 80); expect(sim.mirror().ready).toBe(true);
    const eyes = sim.eyes("consultationGaze");
    await sim.exit(); await sim.event(1, "selectstart"); await act(async () => sim.mirror().record());
    expect(sim.complete).not.toHaveBeenCalled(); expect(eyes.map(eye => eye.position.x)).toEqual([0, 0]);
  });
  it("keeps preview inspection separate from tracked observations and completion", async () => {
    const sim = await lesson(true);
    await sim.pickup(1, "prism"); await sim.action("BASE OUT · BO");
    await sim.step(1 / 72, 180); await act(async () => sim.mirror().record());
    expect(sim.mirror().ready).toBe(false); expect(sim.controls()).toHaveLength(0);
    expect(sim.complete).not.toHaveBeenCalled(); expect(sim.record).not.toHaveBeenCalled();
  });

});
