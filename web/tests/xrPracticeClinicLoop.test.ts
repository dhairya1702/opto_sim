import { createElement } from "react";
import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clinic } from "./helpers/xrClinicHarness";
import { HirschbergPracticeController, type HirschbergPracticeMirror } from "../practice/xr/HirschbergPracticeController";
import type { OpticScenario } from "../practice/ClinicalPracticeStage";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });
async function lesson(advanceOnNext = false) {
  let scenario: OpticScenario = { id: "normal", od: [50, 50], os: [50, 50] };
  let finding = { direction: "none", amount: "0", feedback: "Corneal reflexes are centred and symmetrical in this example." };
  let mirror: HirschbergPracticeMirror;
  const onMirror = (next: HirschbergPracticeMirror) => { mirror = next; };
  const advance = () => {
    scenario = { id: "hyper45", od: [50, 78], os: [50, 50] };
    finding = { direction: "hypertropia", amount: "45", feedback: "The OD reflex is below the pupil centre." };
  };
  const complete = vi.fn(), next = vi.fn(() => { if (advanceOnNext) advance(); }), exit = vi.fn();
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
      advance();
      await sim.rerender(); await sim.step(1 / 72, 12);
    },
  };
}
describe("Hirschberg in the shared consultation clinic", () => {
  it("keeps held equipment and trigger state when advancing, but requires a new inspection before the next answer", async () => {
    const sim = await lesson(true); await sim.prepare();
    await sim.click(1, sim.button("NO DEVIATION")); await sim.click(1, sim.button("CENTRED · 0°"));
    await sim.click(1, sim.button("SUBMIT / CHECK")); expect(sim.complete).toHaveBeenCalledTimes(1);
    const toolPose = sim.tool("pupils").getWorldPosition(new THREE.Vector3());
    await sim.click(1, sim.button("NEW PATIENT FINDING")); await sim.rerender(); await sim.step(1 / 72, 12);
    expect(sim.mirror().held).toBe(true); expect(sim.mirror().light).toBe(true);
    expect(sim.tool("pupils").getWorldPosition(new THREE.Vector3()).distanceTo(toolPose)).toBeLessThan(1e-8);
    expect(sim.mirror().direction).toBe(""); expect(sim.mirror().amount).toBe(""); expect(sim.mirror().fixation).toBe(false);
    await sim.click(1, sim.button("HYPERTROPIA")); await sim.click(1, sim.button("LIMBUS · ~45°"));
    await sim.click(1, sim.button("SUBMIT / CHECK")); expect(sim.complete).toHaveBeenCalledTimes(1);
    await sim.click(1, sim.button("LOOK AT THE LIGHT")); await sim.step(1 / 72, 12);
    expect(sim.mirror().technique.ready).toBe(true);
    await sim.click(1, sim.button("SUBMIT / CHECK")); expect(sim.complete).toHaveBeenCalledTimes(2);
    expect(sim.labels()).toContain("CORRECT"); expect(sim.encounter().results).toHaveLength(0);
  });
  it("puts one findings form on the rear wall, keeps hands clean and explains an incomplete submission", async () => {
    const sim = await lesson(); await sim.pickup(1, "pupils");
    let board: THREE.Object3D | undefined;
    sim.state.scene.traverse(object => { if (object.userData.xrPersistentFindings) board = object; });
    expect(board).toBeDefined();
    expect(board!.position.toArray()).toEqual([1.2, 1.5, -2.46]);
    expect(board!.scale.x).toBe(1.35);
    const anchored = board!.position.clone();
    sim.viewerCamera.rotation.y = .35; sim.viewerCamera.position.x += .15;
    await sim.step(1 / 72, 12); expect(board!.position.equals(anchored)).toBe(true);
    expect(sim.controls().some(object => object.parent?.userData.xrToolControls)).toBe(false);
    expect(sim.labels().filter(label => label === "Penlight")).toHaveLength(1);
    await sim.click(1, sim.button("NO DEVIATION"));
    await sim.click(1, sim.button("CENTRED · 0°"));
    await sim.click(1, sim.button("SUBMIT / CHECK"));
    expect(sim.mirror().light).toBe(false); expect(sim.complete).not.toHaveBeenCalled();
    expect(sim.labels().some(label => label.includes("First inspect both reflexes"))).toBe(true);
    expect(sim.mirror().direction).toBe("none"); expect(sim.mirror().amount).toBe("0");
    await sim.click(1, sim.button("HELP"));
    expect(sim.rays[1].visible).toBe(true);
    await sim.click(1, sim.button("CLOSE HELP")); expect(sim.mirror().help).toBe(false);
    await sim.click(1, sim.button("LOOK AT THE LIGHT")); expect(sim.mirror().fixation).toBe(true);
    await sim.event(1, "squeezeend"); await sim.step();
    const restored: THREE.Object3D[] = [];
    sim.state.scene.traverse(object => { if (object.userData.xrPersistentFindings) restored.push(object); });
    expect(restored).toHaveLength(1); expect(restored[0].position.toArray()).toEqual([1.2, 1.5, -2.46]);
  });
  it("retains an inspected finding for submission after looking at the wall and putting the light down", async () => {
    const sim = await lesson(); await sim.prepare();
    expect(sim.mirror().technique.ready).toBe(true);
    sim.viewerCamera.rotation.y = -.45; await sim.event(0, "selectend");
    await sim.event(0, "squeezeend"); await sim.step(1 / 72, 12);
    expect(sim.mirror().technique.ready).toBe(false);
    await sim.click(1, sim.button("EXOTROPIA")); await sim.click(1, sim.button("PUPIL EDGE · ~15°"));
    await sim.click(1, sim.button("SUBMIT / CHECK"));
    expect(sim.mirror().checked).toBe(true); expect(sim.mirror().correct).toBe(false);
    expect(sim.labels()).toContain("TRY AGAIN");
    expect(sim.complete).not.toHaveBeenCalled();
    await sim.click(1, sim.button("NO DEVIATION")); await sim.click(1, sim.button("CENTRED · 0°"));
    await sim.click(1, sim.button("SUBMIT / CHECK"));
    expect(sim.mirror().correct).toBe(true); expect(sim.complete).toHaveBeenCalledTimes(1);
    expect(sim.labels()).toContain("CORRECT");
    expect(sim.encounter().results).toHaveLength(0);
  });
  it("shows hover above the headset menu, stops the pointer at its button and selects with the menu hand", async () => {
    const sim = await lesson(); await sim.pickup(1, "pupils"); await sim.panel(1);
    const button = sim.button("LOOK AT THE LIGHT");
    // Turn/move the headset and aim at the button's new pose before one frame.
    // This differs from click(), which reads already-updated scene geometry.
    sim.viewerCamera.position.set(.18, 1.62, .48); sim.viewerCamera.rotation.y = .35;
    const q = sim.viewerCamera.getWorldQuaternion(new THREE.Quaternion());
    const target = new THREE.Vector3(0, .02, -.825).applyQuaternion(q).add(sim.viewerCamera.position);
    sim.rays[1].position.copy(target).add(new THREE.Vector3(0, 0, .45).applyQuaternion(q));
    sim.rays[1].quaternion.copy(q);
    await sim.step();
    expect(button.getWorldPosition(new THREE.Vector3()).distanceTo(target)).toBeLessThan(1e-8);
    const beam = sim.rays[1].getObjectByName("clinic-pointer-beam")!;
    const dot = sim.rays[1].getObjectByName("clinic-pointer-dot")!;
    expect(beam.scale.y).toBeCloseTo(.439, 3); expect(dot.visible).toBe(true);
    let marker: THREE.Object3D | undefined;
    sim.state.scene.traverse(object => {
      if (object instanceof THREE.Mesh && object.material instanceof THREE.MeshBasicMaterial && object.material.wireframe) marker = object;
    });
    expect(marker?.parent?.visible).toBe(true);
    expect(marker!.renderOrder).toBeGreaterThan(1000);
    await sim.event(1, "selectstart"); await sim.event(1, "selectend"); await sim.step();
    expect(sim.mirror().fixation).toBe(true);
    expect(sim.controls().some(object => object.parent?.userData.xrObservationEditor)).toBe(false);
  });
  it("uses shared grip/aim and direct recording, offers feedback only after entry, and never records Test evidence", async () => {
    const sim = await lesson();
    expect(sim.controls().filter(control => !control.userData.xrInstrumentControl)).toHaveLength(0);
    await sim.prepare();
    expect(sim.mirror().technique.distanceCm).toBeCloseTo(50);
    expect(sim.mirror().technique.ready).toBe(true);
    expect(new THREE.Vector3(0, 1, 0).applyQuaternion(sim.tool("pupils").quaternion).distanceTo(new THREE.Vector3(0, 0, -1))).toBeLessThan(1e-8);
    expect(sim.reflexes().every(object => object.visible)).toBe(true);
    expect(sim.labels()).not.toContain("Corneal reflexes are centred and symmetrical in this example.");

    expect(sim.mirror().direction).toBe(""); expect(sim.mirror().amount).toBe("");
    await sim.click(1, sim.button("EXOTROPIA"));
    await sim.click(1, sim.button("PUPIL EDGE · ~15°"));
    await sim.click(1, sim.button("SUBMIT / CHECK"));
    expect(sim.mirror().correct).toBe(false); expect(sim.complete).not.toHaveBeenCalled();
    await sim.click(1, sim.button("NO DEVIATION"));
    await sim.click(1, sim.button("CENTRED · 0°"));
    await sim.click(1, sim.button("SUBMIT / CHECK"));
    expect(sim.complete).toHaveBeenCalledTimes(1);
    sim.mirror().record(); sim.mirror().record();
    expect(sim.complete).toHaveBeenCalledTimes(1);
    expect(sim.encounter().results).toHaveLength(0); expect(sim.record).not.toHaveBeenCalled();
    await sim.click(1, sim.button("NEW PATIENT FINDING"));
    expect(sim.next).toHaveBeenCalledTimes(1);
  });
  it("changes the actual eye reflexes and clears previous technique/entries while preserving physical tool use", async () => {
    const sim = await lesson(); await sim.prepare();
    const odBefore = sim.reflexes().find(object => object.userData.xrHirschbergReflex === "OD")!.position.clone();

    await sim.click(1, sim.button("NO DEVIATION")); await sim.click(1, sim.button("CENTRED · 0°"));
    await sim.change();
    const odAfter = sim.reflexes().find(object => object.userData.xrHirschbergReflex === "OD")!.position;
    expect(odAfter.y).toBeLessThan(odBefore.y);
    expect(sim.reflexes().every(object => object.visible)).toBe(true); // Existing light still reveals the changed reflexes.
    expect(sim.mirror().direction).toBe(""); expect(sim.mirror().fixation).toBe(false);
    expect(sim.mirror().technique.ready).toBe(false); expect(sim.mirror().light).toBe(true); expect(sim.mirror().held).toBe(true);
    await sim.event(0, "selectend"); await sim.event(0, "squeezeend");
    await sim.prepare();

    await sim.click(1, sim.button("HYPERTROPIA")); await sim.click(1, sim.button("LIMBUS · ~45°"));
    await sim.click(1, sim.button("SUBMIT / CHECK"));
    expect(sim.complete).toHaveBeenCalledTimes(1);
  });
  it("clears retained observation and drafts on cancellation or session exit", async () => {
    const sim = await lesson(); await sim.prepare();
    await sim.click(1, sim.button("NO DEVIATION")); await sim.click(1, sim.button("CENTRED · 0°"));
    await sim.click(1, sim.button("CANCEL"));
    expect(sim.mirror().direction).toBe(""); expect(sim.mirror().amount).toBe("");
    await sim.event(0, "selectend"); await sim.step(1 / 72, 12);
    await sim.click(1, sim.button("NO DEVIATION")); await sim.click(1, sim.button("CENTRED · 0°"));
    await sim.click(1, sim.button("SUBMIT / CHECK")); expect(sim.complete).not.toHaveBeenCalled();
    await sim.exit(); sim.mirror().record(); expect(sim.complete).not.toHaveBeenCalled();
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
