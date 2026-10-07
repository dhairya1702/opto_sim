import { createElement } from "react";
import { act } from "@react-three/fiber";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Object3D, ShaderMaterial, Mesh, MeshBasicMaterial } from "three";
import { clinic } from "./helpers/xrClinicHarness";
import { useXRClinicRuntime, type XRClinicRuntime } from "../interaction/useXRClinicRuntime";
import { XRClinicRuntimeView } from "../scene/XRClinicRuntimeView";
import { XRConsultationController } from "../interaction/XRConsultationController";
import { clinicalCase } from "../cases/adultDistanceBlur";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });
async function runtimeProbe() {
  let runtime: XRClinicRuntime;
  let editorOpen = false;
  function Probe({ active }: { active: boolean }) {
    runtime = useXRClinicRuntime({ active, scopeViewEnabled: true, editorOpen });
    return createElement(XRClinicRuntimeView, { active, runtime });
  }
  const sim = await clinic({ renderAdapter: ({ active }) => createElement(Probe, { active }) });
  dispose = sim.dispose;
  return { ...sim, runtime: () => runtime!, editor: async (open: boolean) => { editorOpen = open; await sim.rerender(); await sim.step(); } };
}
function tagged(scene: Object3D, tag: string) {
  let found: Object3D | undefined;
  scene.traverse(object => { if (object.userData[tag]) found = object; });
  return found;
}
describe("explicit XR scope viewing", () => {
  it("leaves the patient visible while consultation scope setup is incomplete, without instructional overlays", async () => {
    const sim = await clinic(); dispose = sim.dispose;
    await sim.pickup(0, "fundus"); await sim.at(0, [0, 1.33, .459]);
    await sim.scope(0); await sim.step(1 / 72, 12);
    const overlay = tagged(sim.state.scene, "xrScopeView")!;
    const background = tagged(overlay, "xrScopeBackground") as Mesh;
    const material = background.material as MeshBasicMaterial;
    expect(overlay.visible).toBe(true); expect(material.transparent).toBe(true);
    expect(material.opacity).toBeLessThan(.2);
    expect(tagged(overlay, "xrScopeViewObservation")?.visible).toBe(false);
    expect(tagged(overlay, "xrScopeGuidance")).toBeUndefined();
    expect(sim.labels()).not.toContain("B/Y · CLOSE SCOPE");
    await sim.event(0, "selectstart"); await sim.step(1 / 72, 12);
    expect(tagged(overlay, "xrScopeGuidance")).toBeUndefined();
    expect(material.opacity).toBeLessThan(.2); expect(sim.record).not.toHaveBeenCalled();
  });
  it("requires the instrument-hand button, toggles once per press and preserves grip/trigger behavior", async () => {
    const sim = await runtimeProbe();
    await sim.scope(0); expect(sim.runtime().scopeViewHandRef.current).toBeNull();
    await sim.pickup(0, "pupils"); await sim.scope(0); expect(sim.runtime().scopeViewHandRef.current).toBeNull();
    await sim.putDown(0); await sim.pickup(0, "fundus"); await sim.at(0, [0, 1.33, .459]);
    await sim.scope(1); expect(sim.runtime().scopeViewHandRef.current).toBeNull();
    await sim.event(0, "selectstart"); await sim.scope(0);
    expect(sim.runtime().scopeViewHandRef.current).toBe("left");
    expect(sim.runtime().toolsRef.current.fundus.powered).toBe(true);
    await sim.event(0, "squeezeend"); expect(sim.runtime().scopeViewHandRef.current).toBe("left");
    await sim.event(0, "selectend"); expect(sim.runtime().scopeViewHandRef.current).toBe("left");
    sim.buttons[0][5].pressed = true; await sim.step(1 / 72, 12);
    expect(sim.runtime().scopeViewHandRef.current).toBeNull();
    await sim.step(1 / 72, 12); expect(sim.runtime().scopeViewHandRef.current).toBeNull();
    sim.buttons[0][5].pressed = false; await sim.step(); await sim.scope(0);
    expect(sim.runtime().scopeViewHandRef.current).toBe("left");
    await sim.pickup(1, "fundus"); expect(sim.runtime().scopeViewHandRef.current).toBeNull();
    await sim.scope(1); expect(sim.runtime().scopeViewHandRef.current).toBe("right");
    await sim.putDown(1); expect(sim.runtime().scopeViewHandRef.current).toBeNull();
    expect(sim.record).not.toHaveBeenCalled();
  });
  it("closes on menus, recording, tracking, visibility, reset and exit, with no stale reopening", async () => {
    const sim = await runtimeProbe(); await sim.pickup(0, "fundus"); await sim.scope(0);
    await sim.panel(1); expect(sim.runtime().scopeViewHandRef.current).toBeNull();
    await sim.scope(0); expect(sim.runtime().scopeViewHandRef.current).toBeNull();
    await sim.panel(1); await sim.scope(0); await sim.editor(true);
    expect(sim.runtime().scopeViewHandRef.current).toBeNull();
    await sim.editor(false); await sim.scope(0);
    sim.buttons[0][5].pressed = true; sim.tracked[0] = false; await sim.step();
    expect(sim.runtime().scopeViewHandRef.current).toBeNull();
    sim.tracked[0] = true; await sim.step(1 / 72, 12);
    expect(sim.runtime().scopeViewHandRef.current).toBeNull();
    sim.buttons[0][5].pressed = false; await sim.step(); await sim.scope(0);
    await act(async () => { sim.session.visibilityState = "hidden"; sim.session.dispatchEvent(new Event("visibilitychange")); });
    expect(sim.runtime().scopeViewHandRef.current).toBeNull();
    sim.session.visibilityState = "visible"; await sim.step(); await sim.scope(0);
    await act(async () => sim.runtime().resetClinic()); expect(sim.runtime().scopeViewHandRef.current).toBeNull();
    await sim.pickup(0, "fundus"); await sim.scope(0); await sim.exit();
    expect(sim.runtime().scopeViewHandRef.current).toBeNull();
    await sim.scope(0); expect(sim.runtime().scopeViewHandRef.current).toBeNull();
  });
  it("shows the targeted eye and its authored schematic, then records OD and OS independently", async () => {
    const sim = await clinic(); dispose = sim.dispose; await sim.pickup(0, "fundus");
    for (const eye of ["OD", "OS"] as const) {
      await sim.at(0, [eye === "OD" ? -.048 : .048, 1.33, -.461]);
      await sim.event(0, "selectstart"); await sim.scope(0); await sim.step(1 / 72, 12);
      const overlay = tagged(sim.state.scene, "xrScopeView"), observation = tagged(sim.state.scene, "xrScopeViewObservation");
      expect(overlay?.visible).toBe(true); expect(observation?.visible).toBe(true);
      expect(tagged(sim.state.scene, "xrScopeObservedEye")?.userData.xrScopeObservedEye).toBe(eye);
      let pole: ShaderMaterial | undefined;
      observation!.traverse(object => { if (object instanceof Mesh && object.material instanceof ShaderMaterial) pole = object.material; });
      expect(pole?.uniforms.laterality.value).toBe(eye === "OD" ? -1 : 1);
      expect(sim.labels()).toContain(`OPHTHALMOSCOPY · ${eye} · ${eye === "OD" ? "RIGHT" : "LEFT"} EYE`);
      expect(sim.record).toHaveBeenCalledTimes(eye === "OD" ? 0 : 1);
      // Entry remains locked before this eye has completed its own dwell.
      await sim.click(1, sim.directRecord("fundus"));
      expect(sim.controls().some(button => button.userData.xrLabel === "DISC · CHOOSE")).toBe(false);
      expect(tagged(sim.state.scene, "xrScopeView")).toBeUndefined();
      await sim.click(1, sim.button("CANCEL")); await sim.scope(0); await sim.step(1 / 72, 100);
      await sim.event(0, "selectend"); await sim.click(1, sim.directRecord("fundus"));
      for (const label of ["DISC", "MACULA", "POSTERIOR POLE", "VIEW"]) await sim.click(1, sim.button(`${label} · CHOOSE`));
      await sim.click(1, sim.button("SAVE TO NOTEBOOK"));
      expect(sim.record).toHaveBeenLastCalledWith("fundus", "default", expect.stringContaining("Peripheral retina not fully assessed"), eye);
    }
    expect(sim.encounter().results.map(result => result.eye)).toEqual(["OD", "OS"]);
  });
  it("never renders or awards an eye view when the case has no authored appearance for that eye", async () => {
    const fundus = clinicalCase.exams.find(exam => exam.id === "fundus")!;
    const caseData = { ...clinicalCase, exams: clinicalCase.exams.map(exam => exam.id === "fundus"
      ? { ...fundus, findings: { "OD:default": fundus.findings["OD:default"] } } : exam) };
    const sim = await clinic({ renderAdapter: props => createElement(XRConsultationController, { ...props, caseData }) });
    dispose = sim.dispose; await sim.pickup(0, "fundus"); await sim.at(0, [.048, 1.33, -.461]);
    await sim.event(0, "selectstart"); await sim.scope(0); await sim.step(1 / 72, 100);
    expect(tagged(sim.state.scene, "xrScopeViewGuide")?.visible).toBe(true);
    expect(tagged(sim.state.scene, "xrScopeViewObservation")?.visible).toBe(false);
    expect(tagged(sim.state.scene, "xrScopeObservedEye")).toBeUndefined();
    await sim.event(0, "selectend"); await sim.click(1, sim.directRecord("fundus"));
    expect(sim.controls().some(button => button.userData.xrLabel === "DISC · CHOOSE")).toBe(false);
    expect(sim.record).not.toHaveBeenCalled();
  });
});
