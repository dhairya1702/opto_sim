import { createElement } from "react";
import { act } from "@react-three/fiber";
import { Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clinic } from "./helpers/xrClinicHarness";
import { KrimskyPracticeController } from "../practice/xr/KrimskyPracticeController";
import type { BatchMirror } from "../practice/xr/PracticeLessonUI";
import { consultationToolDefinition } from "../interaction/xrConsultationTools";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });
async function lesson() {
  let mirror: BatchMirror;
  const onMirror = (next: BatchMirror) => { mirror = next; };
  const complete = vi.fn(), leave = vi.fn();
  const sim = await clinic({ renderAdapter: ({ active }) => createElement(KrimskyPracticeController, { active, onComplete: complete, onExit: leave, onMirror }) });
  dispose = sim.dispose;
  const action = async (label: string) => {
    const item = mirror!.actions.find(candidate => candidate.label === label);
    if (!item) throw new Error(`Missing mirror action: ${label}`);
    await act(async () => item.run()); await sim.step(1 / 72, 12);
  };
  const reflex = (eye: "OD" | "OS") => {
    let found: { position: Vector3; visible: boolean } | undefined;
    sim.state.scene.traverse(object => { if (object.userData.xrKrimskyReflex === eye) found = object; });
    if (!found) throw new Error(`Missing reflex ${eye}`);
    return found;
  };
  const light = async () => {
    await sim.pickup(0, "pupils"); sim.viewerCamera.position.set(0, 1.5, .65); sim.rays[0].rotation.set(0, 0, 0);
    await sim.at(0, [0, 1.5, .064]); await sim.event(0, "selectstart"); await sim.step(1 / 72, 12);
    await sim.click(1, sim.button("LOOK AT THE LIGHT"));
    await sim.panel(1); await sim.click(1, sim.button("CONFIRM MONOCULAR VIEW")); await sim.step(1 / 72, 12);
    await sim.click(1, sim.button("INSPECT BASELINE")); await sim.panel(1);
  };
  const prismAt = async (eye: "OD" | "OS") => { await sim.at(1, [eye === "OD" ? -.048 : .048, 1.357, -.481]); await sim.step(1 / 72, 12); };
  const setPrism = async (base: "BI" | "BO", power: number) => {
    await sim.panel(1); await sim.click(1, sim.button("PRISM / METHOD SETTINGS"));
    await sim.click(1, sim.button(base === "BI" ? "BASE IN · BI" : "BASE OUT · BO"));
    for (let i = 0; i < Math.floor(power / 5); i++) await sim.click(1, sim.button("PRISM +5Δ"));
    for (let i = 0; i < power % 5; i++) await sim.click(1, sim.button("PRISM +1Δ"));
    await sim.click(1, sim.button("CLOSE SETTINGS")); await sim.panel(1);
  };
  const compare = async () => { await sim.event(1, "selectstart"); await sim.event(1, "selectend"); await sim.step(1 / 72, 12); };
  const enterPower = async (power: number, controller = 1) => {
    for (let i = 0; i < Math.floor(power / 5); i++) await sim.click(controller, sim.button("ENTRY +5Δ"));
    for (let i = 0; i < power % 5; i++) await sim.click(controller, sim.button("ENTRY +1Δ"));
  };
  return { ...sim, mirror: () => mirror!, action, reflex, light, prismAt, setPrism, compare, enterPower, complete, leave };
}
describe("mounted Krimsky Practice in the shared clinic", () => {
  it("standard Krimsky moves visible reflexes, captures with the prism trigger and permits independent recording after release", async () => {
    const sim = await lesson(); await sim.light();
    const baseline = sim.reflex("OS").position.x;
    expect(baseline).toBeLessThan(.048); expect(sim.mirror().ready).toBe(false);
    await sim.pickup(1, "prism"); await sim.prismAt("OS"); await sim.setPrism("BI", 10);
    const under = sim.reflex("OS").position.x;
    expect(under).toBeGreaterThan(baseline); expect(under).toBeLessThan(.048);
    await sim.compare(); expect(sim.mirror().ready).toBe(false);
    await sim.setPrism("BO", 20); expect(sim.reflex("OS").position.x).toBeLessThan(baseline);
    await sim.compare(); expect(sim.mirror().ready).toBe(false);
    await sim.setPrism("BI", 25); expect(sim.reflex("OS").position.x).toBeGreaterThan(.048);
    await sim.setPrism("BI", 20); expect(sim.reflex("OS").position.x).toBeCloseTo(.048, 5);
    expect(sim.mirror().ready).toBe(false); // Matching alone records/captures nothing.
    await sim.compare(); expect(sim.mirror().ready).toBe(true); expect(sim.complete).not.toHaveBeenCalled();
    await sim.event(0, "selectend"); await sim.at(1, [.3, 1.2, .1]); await sim.event(1, "squeezeend"); await sim.event(0, "squeezeend"); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready).toBe(true);
    await sim.panel(1); await sim.click(1, sim.button("RECORD FINDING")); expect(sim.mirror().lesson.entries.power).toBeUndefined();
    expect(sim.controls().some(button => button.userData.xrLabel === "RECORD OBSERVATION")).toBe(false);
    await sim.enterPower(15); await sim.click(1, sim.button("RECORD OBSERVATION"));
    expect(sim.complete).not.toHaveBeenCalled(); expect(sim.mirror().lesson.feedback).toContain("Read the captured");
    await sim.click(1, sim.button("ENTRY +5Δ")); await sim.click(1, sim.button("RECORD OBSERVATION"));
    expect(sim.complete).toHaveBeenCalledTimes(1); expect(sim.mirror().lesson.feedback).toContain("20Δ BI, prism before OS");
    sim.mirror().record(); expect(sim.complete).toHaveBeenCalledTimes(1);
    expect(sim.record).not.toHaveBeenCalled(); expect(sim.encounter().results).toHaveLength(0);
  });
  it("modified Krimsky requires the fixating eye and completes both authored endpoints with 1Δ controls", async () => {
    const sim = await lesson();
    for (const [base, power] of [["BI", 20], ["BO", 15]] as const) {
      await sim.action("MODIFIED · OD"); await sim.light();
      await sim.pickup(1, "prism"); await sim.prismAt("OS"); await sim.setPrism(base, power);
      expect(sim.reflex("OS").position.x).not.toBeCloseTo(.048, 5);
      await sim.compare(); expect(sim.mirror().ready).toBe(false);
      await sim.prismAt("OD"); expect(sim.reflex("OS").position.x).toBeCloseTo(.048, 5);
      if (power === 15) { await sim.action("PRISM −1Δ"); expect(sim.reflex("OS").position.x).not.toBe(.048); await sim.action("PRISM +1Δ"); }
      await sim.compare(); expect(sim.mirror().ready).toBe(true);
      await sim.panel(1); await sim.click(1, sim.button("RECORD FINDING")); await sim.enterPower(power);
      await sim.click(1, sim.button("RECORD OBSERVATION")); expect(sim.mirror().lesson.feedback).toContain(`Modified Krimsky: ${power}Δ ${base}, prism before OD`);
      await sim.click(1, sim.button("NEW PATIENT FINDING"));
      expect(sim.mirror().ready).toBe(false); expect(sim.mirror().lesson.entries).toEqual({});
      await sim.event(0, "selectend"); await sim.event(0, "squeezeend"); await sim.event(1, "squeezeend");
    }
    expect(sim.complete).toHaveBeenCalledTimes(2); expect(sim.record).not.toHaveBeenCalled();
  });
  it("cannot skip baseline, substitute a different instrument, or neutralise a tilted/wrong-eye prism", async () => {
    const sim = await lesson(); await sim.pickup(0, "objective"); await sim.at(0, [0, 1.33, -.041]); await sim.event(0, "selectstart");
    await sim.action("LOOK AT THE LIGHT"); await sim.action("CONFIRM MONOCULAR VIEW"); await sim.action("INSPECT BASELINE");
    expect(sim.mirror().ready).toBe(false); expect(sim.mirror().actions.find(action => action.label === "INSPECT BASELINE")?.disabled).toBe(true);
    await sim.event(0, "selectend"); await sim.at(0, consultationToolDefinition("objective").home); await sim.event(0, "squeezeend");
    await sim.pickup(0, "pupils"); sim.viewerCamera.position.set(0, 1.5, .65); await sim.at(0, [0, 1.5, .064]); await sim.event(0, "selectstart"); await sim.step(1 / 72, 12);
    await sim.pickup(1, "prism"); await sim.prismAt("OS"); await sim.action("INSPECT BASELINE");
    expect(sim.mirror().actions.find(action => action.label === "INSPECT BASELINE")?.disabled).toBe(true);
    await sim.at(1, [.35, 1.357, -.481]); await sim.action("INSPECT BASELINE"); await sim.prismAt("OS"); await sim.setPrism("BI", 20);
    sim.grips[1].rotation.y = Math.PI / 2; await sim.step(1 / 72, 12); await sim.compare(); expect(sim.mirror().ready).toBe(false);
    sim.grips[1].rotation.y = 0; await sim.prismAt("OD"); await sim.compare(); expect(sim.mirror().ready).toBe(false);
    await sim.prismAt("OS"); await sim.compare(); expect(sim.mirror().ready).toBe(true);
  });
  it("invalidates unfinished viewing on distance, illumination and tracking loss and clears capture on parameter changes", async () => {
    const sim = await lesson(); await sim.light(); await sim.pickup(1, "prism"); await sim.prismAt("OS"); await sim.setPrism("BI", 20);
    await sim.at(0, [0, 1.5, .264]); await sim.step(1 / 72, 12); await sim.compare(); expect(sim.mirror().ready).toBe(false);
    await sim.at(0, [0, 1.5, .064]); await sim.step(1 / 72, 12); expect(sim.mirror().actions.some(action => action.label === "INSPECT BASELINE")).toBe(true);
    await sim.at(1, [.35, 1.357, -.481]); await sim.action("INSPECT BASELINE"); await sim.prismAt("OS");
    await sim.event(0, "selectend"); await sim.step(1 / 72, 12); await sim.event(0, "selectstart"); await sim.step(1 / 72, 12);
    await sim.compare(); expect(sim.mirror().ready).toBe(false);
    await sim.at(1, [.35, 1.357, -.481]); await sim.action("INSPECT BASELINE"); await sim.prismAt("OS");
    sim.tracked[0] = false; await sim.step(1 / 72, 12); sim.tracked[0] = true; await sim.step(1 / 72, 12);
    await sim.event(0, "selectend"); await sim.event(0, "selectstart"); await sim.step(1 / 72, 12);
    await sim.compare(); expect(sim.mirror().ready).toBe(false);
    await sim.at(1, [.35, 1.357, -.481]); await sim.action("INSPECT BASELINE"); await sim.prismAt("OS"); await sim.compare();
    expect(sim.mirror().ready).toBe(true); await sim.action("PRISM +1Δ"); expect(sim.mirror().ready).toBe(false); expect(sim.mirror().lesson.entries).toEqual({});
    await sim.action("PRISM −1Δ"); await sim.compare(); expect(sim.mirror().ready).toBe(true);
    await sim.action("MODIFIED · OD"); expect(sim.mirror().ready).toBe(false); expect(sim.mirror().lesson.entries).toEqual({});
    expect(sim.complete).not.toHaveBeenCalled();
  });
  it("cancel discards comparison without completion, reset recalls tools and exit ignores late actions", async () => {
    const sim = await lesson(); await sim.light(); await sim.pickup(1, "prism"); await sim.prismAt("OS"); await sim.setPrism("BI", 20); await sim.compare();
    await sim.panel(1); await sim.click(1, sim.button("RECORD FINDING")); await sim.enterPower(20); await sim.click(1, sim.button("CANCEL"));
    expect(sim.mirror().ready).toBe(false); expect(sim.mirror().lesson.entries).toEqual({}); expect(sim.complete).not.toHaveBeenCalled();
    await act(async () => sim.mirror().reset()); await sim.step(1 / 72, 12);
    expect(sim.tool("prism").position.toArray()).toEqual(consultationToolDefinition("prism").home);
    expect(sim.tool("pupils").getObjectByProperty("type", "SpotLight")).toBeUndefined();
    await sim.panel(1); await sim.click(1, sim.button("EXIT VR")); expect(sim.leave).toHaveBeenCalledTimes(1);
    await sim.exit(); await sim.event(1, "selectstart"); sim.mirror().record(); expect(sim.complete).not.toHaveBeenCalled();
  });
  it("rejects a saved recording callback during visibility loss and after a session ends, even before the parent exits", async () => {
    const sim = await lesson(); await sim.light(); await sim.pickup(1, "prism"); await sim.prismAt("OS"); await sim.setPrism("BI", 20); await sim.compare();
    await act(async () => sim.mirror().lesson.choose("power", "20"));
    const savedRecord = sim.mirror().record;
    sim.session.visibilityState = "hidden";
    await act(async () => { sim.session.dispatchEvent(new Event("visibilitychange")); savedRecord(); });
    expect(sim.complete).not.toHaveBeenCalled();
    sim.session.visibilityState = "visible"; await sim.step();
    await act(async () => sim.session.dispatchEvent(new Event("end")));
    await sim.rerender(); await sim.step(1 / 72, 12);
    await act(async () => savedRecord()); expect(sim.complete).not.toHaveBeenCalled();
  });
});
