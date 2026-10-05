import { createElement } from "react";
import { act } from "@react-three/fiber";
import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clinic } from "./helpers/xrClinicHarness";
import { BrucknerPracticeController } from "../practice/xr/BrucknerPracticeController";
import { MotilityPracticeController } from "../practice/xr/MotilityPracticeController";
import { CoverPracticeController } from "../practice/xr/CoverPracticeController";
import type { BatchMirror } from "../practice/xr/PracticeLessonUI";
import type { BrucknerScenario } from "../interaction/brucknerPractice";
import { gazePositions } from "../interaction/motility";
import { consultationToolDefinition } from "../interaction/xrConsultationTools";
import { PRACTICE_NEAR_SOCKET } from "../interaction/xrPracticeBatch";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });
async function lesson(kind: "bruckner" | "motility" | "cover-uncover" | "alternate-cover") {
  let mirror: BatchMirror;
  let scenario: BrucknerScenario = "od";
  const onMirror = (next: BatchMirror) => { mirror = next; };
  const complete = vi.fn(), next = vi.fn(), exit = vi.fn();
  const sim = await clinic({ renderAdapter: ({ active }) => {
    const props = { active, onComplete: complete, onExit: exit, onMirror };
    return kind === "bruckner" ? createElement(BrucknerPracticeController, { ...props, scenario, onNext: next })
      : kind === "motility" ? createElement(MotilityPracticeController, props) : createElement(CoverPracticeController, { ...props, kind });
  } });
  dispose = sim.dispose;
  const action = async (label: string) => {
    const found = mirror!.actions.find(action => action.label === label);
    if (!found) throw new Error(`Mirror action missing: ${label}`);
    await act(async () => found.run()); await sim.step(1 / 72, 10);
  };
  const coverAt = async (position: "OD" | "OS" | "away", count = 65) => {
    await sim.at(1, position === "away" ? [0, 1.1, -.3] : [position === "OD" ? -.048 : .048, 1.379, -.513]);
    await sim.step(1 / 72, count);
  };
  const coverSequence = async () => {
    for (const position of (kind === "alternate-cover" ? ["OD", "OS", "OD", "OS"] : ["OD", "away", "OS", "away"]) as ("OD" | "OS" | "away")[]) await coverAt(position);
  };
  return { ...sim, action, complete, next, leave: exit, coverAt, coverSequence, mirror: () => mirror!,
    change: async () => { scenario = "os"; await sim.rerender(); await sim.step(1 / 72, 12); },
  };
}
describe("new Practice lessons in the shared clinic", () => {
  it("Bruckner requires its own instrument, broad spot, actual distance and rear-aperture view, then records only Practice", async () => {
    const sim = await lesson("bruckner");
    expect(sim.labels()).not.toContain("The reflex from OD appears brighter. Record OD as the brighter reflex and investigate possible causes.");
    await sim.pickup(0, "fundus");
    sim.rays[0].rotation.set(0, 0, 0); sim.viewerCamera.position.set(0, 1.5, .56);
    await sim.at(0, [0, 1.33, .459]);
    await sim.click(1, sim.button("LOOK AT THE LIGHT"));
    await sim.event(0, "selectstart"); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready).toBe(false);
    await sim.click(1, sim.button("SELECT LARGE SPOT"));
    await sim.step(1 / 72, 12); expect(sim.mirror().ready).toBe(true);
    expect((sim.tool("fundus").getObjectByProperty("type", "SpotLight") as THREE.SpotLight).angle).toBeCloseTo(.16);
    let field: THREE.Object3D | undefined;
    sim.state.scene.traverse(object => { if (object.userData.xrBrucknerField) field = object; });
    expect(field?.visible).toBe(true);
    await sim.click(1, sim.directRecord("fundus"));
    await sim.click(1, sim.button("EQUAL REFLEXES")); await sim.click(1, sim.button("RECORD OBSERVATION"));
    expect(sim.complete).not.toHaveBeenCalled();
    await sim.click(1, sim.button("OD BRIGHTER")); await sim.click(1, sim.button("RECORD OBSERVATION"));
    expect(sim.complete).toHaveBeenCalledTimes(1);
    sim.mirror().record(); expect(sim.complete).toHaveBeenCalledTimes(1);
    expect(sim.record).not.toHaveBeenCalled(); expect(sim.encounter().results).toHaveLength(0);
    await sim.click(1, sim.button("NEW PATIENT FINDING")); expect(sim.next).toHaveBeenCalledTimes(1);
    await sim.change(); expect(sim.mirror().ready).toBe(false); expect(sim.mirror().lesson.entries).toEqual({});
    expect(sim.tool("fundus").getObjectByProperty("type", "SpotLight")).toBeUndefined();
  });
  it("Bruckner clears pending entries on lost view, light, tracking and cancellation", async () => {
    const sim = await lesson("bruckner");
    await sim.pickup(0, "fundus"); sim.viewerCamera.position.set(0, 1.5, .56); await sim.at(0, [0, 1.33, .459]);
    await sim.click(1, sim.button("LOOK AT THE LIGHT")); await sim.click(1, sim.button("SELECT LARGE SPOT"));
    await sim.event(0, "selectstart"); await sim.step(1 / 72, 12);
    await sim.click(1, sim.directRecord("fundus")); await sim.click(1, sim.button("OD BRIGHTER"));
    sim.viewerCamera.position.x = .2; await sim.step(1 / 72, 12);
    expect(sim.mirror().ready).toBe(false); expect(sim.mirror().lesson.entries).toEqual({});
    sim.viewerCamera.position.x = 0; await sim.step(1 / 72, 12);
    await sim.click(1, sim.button("OD BRIGHTER")); await sim.event(0, "selectend"); await sim.step(1 / 72, 12);
    expect(sim.mirror().lesson.entries).toEqual({});
    await sim.event(0, "selectstart"); await sim.step(1 / 72, 12);
    await sim.click(1, sim.button("OD BRIGHTER")); sim.tracked[0] = false; await sim.step(1 / 72, 12);
    expect(sim.mirror().ready).toBe(false); expect(sim.mirror().lesson.entries).toEqual({});
    await sim.click(1, sim.button("CANCEL")); expect(sim.mirror().lesson.mode).toBe("none"); expect(sim.complete).not.toHaveBeenCalled();
    await sim.exit(); sim.mirror().record(); expect(sim.complete).not.toHaveBeenCalled();
  });
  it("motility follows the held penlight, requires nine dwells and symptoms, and records an explicit observation", async () => {
    const sim = await lesson("motility");
    await sim.pickup(0, "pupils");
    await sim.click(1, sim.button("FOLLOW LIGHT · HEAD STILL")); await sim.event(0, "selectstart");
    for (const gaze of gazePositions) {
      await sim.at(0, [gaze.x * .35 * .65, 1.5 + gaze.y * .35 * .45, -.086]);
      await sim.step(1 / 72, 60);
    }
    expect(sim.mirror().ready).toBe(false);
    expect(sim.eyes("consultationGaze").every(eye => eye.position.x > 0)).toBe(true);
    await sim.click(1, sim.button("ASK ABOUT SYMPTOMS"));
    expect(sim.mirror().ready).toBe(true);
    await sim.click(1, sim.directRecord("pupils")); await sim.click(1, sim.button("FROM · FULL, SMOOTH AND ACCURATE OU"));
    await sim.click(1, sim.button("RECORD OBSERVATION")); expect(sim.complete).toHaveBeenCalledTimes(1);
    expect(sim.mirror().lesson.feedback).toContain("Full movements");
    expect(sim.record).not.toHaveBeenCalled();
    const eyeObjects = sim.eyes("consultationGaze");
    await sim.exit(); await sim.event(0, "selectend");
    expect(eyeObjects.every(eye => eye.position.length() === 0)).toBe(true);
    expect(sim.mirror().lesson.entries).toEqual({});
  });
  it("motility tracking loss cannot complete an unfinished gaze dwell", async () => {
    const sim = await lesson("motility"); await sim.pickup(0, "pupils");
    await sim.click(1, sim.button("FOLLOW LIGHT · HEAD STILL")); await sim.at(0, [0, 1.5, -.086]);
    await sim.event(0, "selectstart"); await sim.step(1 / 72, 20);
    sim.tracked[0] = false; await sim.step(1 / 72, 30); sim.tracked[0] = true;
    await sim.event(0, "selectend"); await sim.event(0, "selectstart"); await sim.step(1 / 72, 20);
    expect(sim.mirror().status).toContain("0/9"); sim.mirror().record(); expect(sim.complete).not.toHaveBeenCalled();
  });
  it("cover–uncover gates order/entry, shows authored motion on physical uncover, and changes findings", async () => {
    const sim = await lesson("cover-uncover"); await sim.pickup(1, "cover");
    await sim.click(0, sim.button("LOOK AT THE TARGET"));
    await sim.coverAt("OS"); expect(sim.mirror().entryReady).toBe(false);
    await sim.coverSequence(); expect(sim.mirror().ready).toBe(true);
    await sim.click(0, sim.directRecord("cover")); await sim.click(0, sim.button("ORTHOPHORIA")); await sim.click(0, sim.button("RECORD OBSERVATION"));
    expect(sim.complete).toHaveBeenCalledTimes(1); expect(sim.record).not.toHaveBeenCalled();
    await sim.click(0, sim.button("NEW PATIENT FINDING"));
    await sim.event(1, "squeezeend"); await sim.pickup(1, "cover"); await sim.click(0, sim.button("LOOK AT THE TARGET"));
    await sim.coverAt("OD", 1);
    const os = sim.eyes("consultationGaze").find(eye => eye.userData.consultationGaze === "OS")!;
    expect(os.position.x).toBeLessThan(0);
    await sim.step(1 / 72, 65); await sim.coverAt("away", 1);
    expect(os.position.x).toBeGreaterThan(0);
    await sim.step(1 / 72, 65); await sim.coverAt("OS"); await sim.coverAt("away");
    await sim.click(0, sim.directRecord("cover")); await sim.click(0, sim.button("LEFT UNILATERAL ESOTROPIA")); await sim.click(0, sim.button("RECORD OBSERVATION"));
    expect(sim.complete).toHaveBeenCalledTimes(2);
  });
  it("near-card motion invalidates earlier cover work and the stand frees a hand", async () => {
    const sim = await lesson("cover-uncover"); await sim.pickup(1, "cover"); await sim.click(0, sim.button("LOOK AT THE TARGET"));
    await sim.coverSequence(); expect(sim.mirror().ready).toBe(true);
    await sim.pickup(0, "near"); await sim.at(0, [0, 1.5, .1]); await sim.step(1 / 72, 12);
    expect(sim.mirror().entryReady).toBe(false); expect(sim.mirror().status).toContain("67 cm");
    await sim.at(0, PRACTICE_NEAR_SOCKET.position); await sim.event(0, "squeezeend"); await sim.step(1 / 72, 12);
    expect(sim.tool("near").position.toArray()).toEqual(PRACTICE_NEAR_SOCKET.position);
    const viewer = new THREE.Vector3(0, 1.6, .65);
    const eye = new THREE.Vector3(-.048, 1.5, -.572);
    const sight = new THREE.Raycaster(viewer, eye.clone().sub(viewer).normalize(), 0, eye.distanceTo(viewer));
    expect(sight.intersectObject(sim.tool("near"), true)).toHaveLength(0);
    await sim.coverSequence(); expect(sim.mirror().ready).toBe(true);
    await sim.pickup(0, "near"); await sim.at(0, consultationToolDefinition("near").home); await sim.event(0, "squeezeend"); await sim.step(1 / 72, 12);
    expect(sim.mirror().status).toContain("DISTANCE"); expect(sim.mirror().entryReady).toBe(false);
  });
  it("alternating cover requires actual prism alignment, correct neutralisation and two-hand panel recording", async () => {
    const sim = await lesson("alternate-cover"); await sim.pickup(1, "cover"); await sim.click(0, sim.button("LOOK AT THE TARGET"));
    await sim.coverSequence(); expect(sim.mirror().entryReady).toBe(true); expect(sim.mirror().ready).toBe(false);
    await sim.pickup(0, "prism"); await sim.at(0, [.048, 1.357, -.481]);
    await sim.panel(1); await sim.click(1, sim.button("PRISM SETTINGS"));
    await sim.click(1, sim.button("BASE OUT"));
    for (let i = 0; i < 6; i++) await sim.click(1, sim.button("POWER +2Δ"));
    await sim.click(1, sim.button("REPEAT WITH PRISM")); await sim.panel(1); await sim.coverSequence();
    expect(sim.mirror().ready).toBe(false); expect(sim.mirror().status).toContain("Refixation remains");
    await sim.panel(1); await sim.click(1, sim.button("PRISM SETTINGS")); await sim.click(1, sim.button("BASE IN"));
    await sim.click(1, sim.button("REPEAT WITH PRISM")); await sim.panel(1); await sim.coverSequence();
    expect(sim.mirror().ready).toBe(true);
    await sim.panel(1); await sim.click(1, sim.button("RECORD FINDING"));
    expect(sim.mirror().ready).toBe(true);
    await sim.click(1, sim.button("IN")); await sim.click(1, sim.button("EXO")); await sim.click(1, sim.button("RECORD OBSERVATION"));
    expect(sim.complete).toHaveBeenCalledTimes(1); expect(sim.mirror().lesson.feedback).toContain("12Δ base in");
    expect(sim.record).not.toHaveBeenCalled(); sim.mirror().record(); expect(sim.complete).toHaveBeenCalledTimes(1);
  });
  it("mounts the near target and completes all four authored alternate-cover findings without Test credit", async () => {
    const sim = await lesson("alternate-cover");
    const cases = [["BASE IN", 12, "IN", "EXO"], ["BASE OUT", 18, "OUT", "ESO"], ["BASE UP", 8, "UP", "HYPO"], ["BASE DOWN", 10, "DOWN", "HYPER"]] as const;
    for (const [base, power, movement, deviation] of cases) {
      await sim.pickup(0, "near"); await sim.at(0, PRACTICE_NEAR_SOCKET.position); await sim.event(0, "squeezeend");
      await sim.pickup(1, "cover"); await sim.click(0, sim.button("LOOK AT THE TARGET"));
      await sim.coverSequence(); expect(sim.mirror().entryReady).toBe(true);
      await sim.pickup(0, "prism"); await sim.at(0, [.048, 1.357, -.481]);
      await sim.action(base); for (let i = 0; i < power / 2; i++) await sim.action("POWER +2Δ");
      await sim.action("REPEAT WITH PRISM"); await sim.coverSequence(); expect(sim.mirror().ready).toBe(true);
      await sim.panel(1); await sim.click(1, sim.button("RECORD FINDING"));
      await sim.click(1, sim.button(movement)); await sim.click(1, sim.button(deviation));
      await sim.click(1, sim.button("RECORD OBSERVATION"));
      expect(sim.mirror().lesson.feedback).toContain("near:");
      await sim.click(1, sim.button("NEW PATIENT FINDING"));
      await sim.event(0, "squeezeend"); await sim.event(1, "squeezeend");
    }
    expect(sim.complete).toHaveBeenCalledTimes(4); expect(sim.record).not.toHaveBeenCalled();
    expect(sim.encounter().results).toHaveLength(0);
  });
  it("cancels a completed cover observation form without recording, and reset clears the attempt", async () => {
    const sim = await lesson("cover-uncover"); await sim.pickup(1, "cover"); await sim.click(0, sim.button("LOOK AT THE TARGET"));
    await sim.coverSequence(); await sim.click(0, sim.directRecord("cover")); await sim.click(0, sim.button("ORTHOPHORIA"));
    await sim.click(0, sim.button("CANCEL"));
    expect(sim.complete).not.toHaveBeenCalled(); expect(sim.mirror().lesson.entries).toEqual({});
    await act(async () => sim.mirror().reset()); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready).toBe(false); expect(sim.mirror().entryReady).toBe(false);
    expect(sim.tool("cover").position.toArray()).toEqual(consultationToolDefinition("cover").home);
    await sim.exit(); await sim.event(1, "squeezestart"); sim.mirror().record(); expect(sim.complete).not.toHaveBeenCalled();
  });
  it("alternating cover loses dissociation after long exposure and cannot neutralise a prism away from the pupil", async () => {
    const sim = await lesson("alternate-cover"); await sim.pickup(1, "cover"); await sim.click(0, sim.button("LOOK AT THE TARGET"));
    await sim.coverAt("OD"); await sim.coverAt("away");
    expect(sim.mirror().status).toContain("Cover OD"); expect(sim.mirror().entryReady).toBe(false);
    await sim.coverSequence(); await sim.pickup(0, "prism");
    await sim.action("BASE IN"); for (let i = 0; i < 6; i++) await sim.action("POWER +2Δ");
    await sim.action("REPEAT WITH PRISM"); await sim.coverSequence(); expect(sim.mirror().ready).toBe(false);
    await sim.at(0, [.048, 1.357, -.481]); await sim.action("REPEAT WITH PRISM");
    await sim.coverAt("OD"); await sim.at(0, [.3, 1.357, -.481]); await sim.step(1 / 72, 12);
    await sim.at(0, [.048, 1.357, -.481]); await sim.coverAt("OS"); await sim.coverAt("OD"); await sim.coverAt("OS");
    expect(sim.mirror().ready).toBe(false);
    await sim.coverSequence(); expect(sim.mirror().ready).toBe(true);
    await sim.action("POWER +2Δ"); expect(sim.mirror().ready).toBe(false);
    await sim.exit(); sim.mirror().record(); expect(sim.complete).not.toHaveBeenCalled();
  });
});
