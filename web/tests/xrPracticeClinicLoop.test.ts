import { createElement } from "react";
import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clinic } from "./helpers/xrClinicHarness";
import { HirschbergPracticeController, type HirschbergPracticeMirror } from "../practice/xr/HirschbergPracticeController";
import type { OpticScenario } from "../practice/ClinicalPracticeStage";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });
async function lesson() {
  let scenario: OpticScenario = { id: "normal", od: [50, 50], os: [50, 50] };
  let finding = { direction: "none", amount: "0", feedback: "Corneal reflexes are centred and symmetrical in this example." };
  let mirror: HirschbergPracticeMirror;
  const onMirror = (next: HirschbergPracticeMirror) => { mirror = next; };
  const complete = vi.fn(), next = vi.fn(), exit = vi.fn();
  const sim = await clinic({ renderAdapter: ({ active }) => createElement(HirschbergPracticeController, {
    active, scenario, finding, findingPosition: { current: 1, total: 4 }, onComplete: complete, onNext: next, onExit: exit, onMirror,
  }) });
  dispose = sim.dispose;
  const prepare = async () => {
    await sim.pickup(0, "pupils");
    sim.grips[0].rotation.x = Math.PI / 2;
    sim.rays[0].rotation.set(0, 0, 0);
    await sim.at(0, [0, 1.5, .064]);
    await sim.step(1 / 72, 10);
    await sim.click(1, sim.button("LOOK AT THE LIGHT"));
    await sim.event(0, "selectstart");
    await sim.step(1 / 72, 12);
  };
  const reflexes = () => {
    const result: THREE.Object3D[] = [];
    sim.state.scene.traverse(object => { if (object.userData.xrHirschbergReflex) result.push(object); });
    return result;
  };
  return { ...sim, prepare, complete, next, leave: exit, reflexes, mirror: () => mirror!,
    change: async () => {
      scenario = { id: "hyper45", od: [50, 78], os: [50, 50] };
      finding = { direction: "hypertropia", amount: "45", feedback: "The OD reflex is below the pupil centre." };
      await sim.rerender(); await sim.step(1 / 72, 12);
    },
  };
}
describe("Hirschberg in the shared consultation clinic", () => {
  it("uses shared grip/aim and direct recording, offers feedback only after entry, and never records Test evidence", async () => {
    const sim = await lesson();
    expect(sim.controls()).toHaveLength(0);
    await sim.prepare();
    expect(sim.mirror().technique.distanceCm).toBeCloseTo(50);
    expect(sim.mirror().technique.ready).toBe(true);
    expect(new THREE.Vector3(0, 1, 0).applyQuaternion(sim.tool("pupils").quaternion).distanceTo(new THREE.Vector3(0, 0, -1))).toBeLessThan(1e-8);
    expect(sim.reflexes().every(object => object.visible)).toBe(true);
    expect(sim.labels()).not.toContain("Corneal reflexes are centred and symmetrical in this example.");
    await sim.click(1, sim.directRecord("pupils"));
    expect(sim.mirror().direction).toBe(""); expect(sim.mirror().amount).toBe("");
    await sim.click(1, sim.button("EXOTROPIA"));
    await sim.click(1, sim.button("PUPIL EDGE · ~15°"));
    await sim.click(1, sim.button("RECORD INTERPRETATION"));
    expect(sim.mirror().correct).toBe(false); expect(sim.complete).not.toHaveBeenCalled();
    await sim.click(1, sim.button("NO DEVIATION"));
    await sim.click(1, sim.button("CENTRED · 0°"));
    await sim.click(1, sim.button("RECORD INTERPRETATION"));
    expect(sim.complete).toHaveBeenCalledTimes(1);
    sim.mirror().record(); sim.mirror().record();
    expect(sim.complete).toHaveBeenCalledTimes(1);
    expect(sim.encounter().results).toHaveLength(0); expect(sim.record).not.toHaveBeenCalled();
    await sim.click(1, sim.button("NEW PATIENT FINDING"));
    expect(sim.next).toHaveBeenCalledTimes(1);
  });
  it("changes the actual eye reflexes and clears the previous scenario's technique, entries, and illumination", async () => {
    const sim = await lesson(); await sim.prepare();
    const odBefore = sim.reflexes().find(object => object.userData.xrHirschbergReflex === "OD")!.position.clone();
    await sim.click(1, sim.directRecord("pupils"));
    await sim.click(1, sim.button("NO DEVIATION")); await sim.click(1, sim.button("CENTRED · 0°"));
    await sim.change();
    const odAfter = sim.reflexes().find(object => object.userData.xrHirschbergReflex === "OD")!.position;
    expect(odAfter.y).toBeLessThan(odBefore.y);
    expect(sim.reflexes().every(object => !object.visible)).toBe(true);
    expect(sim.mirror().direction).toBe(""); expect(sim.mirror().fixation).toBe(false);
    expect(sim.mirror().technique.ready).toBe(false); expect(sim.mirror().light).toBe(false);
    await sim.event(0, "selectend"); await sim.event(0, "squeezeend");
    await sim.prepare();
    await sim.click(1, sim.directRecord("pupils"));
    await sim.click(1, sim.button("HYPERTROPIA")); await sim.click(1, sim.button("LIMBUS · ~45°"));
    await sim.click(1, sim.button("RECORD INTERPRETATION"));
    expect(sim.complete).toHaveBeenCalledTimes(1);
  });
  it("invalidates entries when distance/light/tracking changes and cancels without credit", async () => {
    const sim = await lesson(); await sim.prepare();
    await sim.click(1, sim.directRecord("pupils"));
    await sim.click(1, sim.button("NO DEVIATION")); await sim.click(1, sim.button("CENTRED · 0°"));
    await sim.at(0, [0, 1.5, .364]); await sim.step(1 / 72, 12);
    expect(sim.mirror().technique.distanceCm).toBeCloseTo(80);
    expect(sim.mirror().technique.ready).toBe(false); expect(sim.mirror().direction).toBe("");
    expect(sim.controls().some(object => object.userData.xrLabel === "RECORD INTERPRETATION")).toBe(false);
    await sim.at(0, [0, 1.5, .064]); await sim.step(1 / 72, 12);
    await sim.click(1, sim.button("NO DEVIATION"));
    await sim.event(0, "selectend"); await sim.step(1 / 72, 12);
    expect(sim.mirror().direction).toBe(""); expect(sim.reflexes().every(object => !object.visible)).toBe(true);
    await sim.event(0, "selectstart"); await sim.step(1 / 72, 12);
    await sim.click(1, sim.button("NO DEVIATION"));
    sim.tracked[0] = false; await sim.step(1 / 72, 12);
    expect(sim.mirror().direction).toBe(""); expect(sim.mirror().light).toBe(false);
    sim.tracked[0] = true; await sim.step(1 / 72, 12);
    expect(sim.mirror().technique.ready).toBe(false);
    await sim.click(1, sim.button("CANCEL"));
    expect(sim.mirror().recording).toBe(false); expect(sim.complete).not.toHaveBeenCalled();
  });
  it("rejects the wrong instrument and clears late input on exit", async () => {
    const sim = await lesson();
    await sim.pickup(0, "objective");
    await sim.at(0, [0, 1.33, -.041]); await sim.event(0, "selectstart"); await sim.step(1 / 72, 12);
    expect(sim.mirror().technique.ready).toBe(false);
    expect(sim.reflexes().every(object => !object.visible)).toBe(true);
    sim.mirror().record(); expect(sim.complete).not.toHaveBeenCalled();
    await sim.panel(1); await sim.click(1, sim.button("EXIT VR"));
    expect(sim.leave).toHaveBeenCalledTimes(1);
    await sim.exit(); await sim.event(0, "selectend"); await sim.event(0, "selectstart");
    expect(sim.mirror().light).toBe(false); expect(sim.complete).not.toHaveBeenCalled();
  });
});
