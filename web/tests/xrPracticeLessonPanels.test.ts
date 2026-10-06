import { createElement } from "react";
import { act } from "@react-three/fiber";
import { Mesh, type Object3D, Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clinic } from "./helpers/xrClinicHarness";
import { VergencePracticeController } from "../practice/xr/VergencePracticeController";
import { AccommodationPracticeController } from "../practice/xr/AccommodationPracticeController";
import { WorthPracticeController } from "../practice/xr/WorthPracticeController";
import type { BatchMirror } from "../practice/xr/PracticeLessonUI";
let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });
function panelBounds(scene: Object3D) {
  let panel: Object3D | undefined;
  scene.traverse(object => { if (object.userData.xrObservationEditor || object.userData.xrPersistentFindings) panel = object; });
  if (!panel) throw new Error("Missing lesson panel");
  const backing = panel.children[0];
  if (!(backing instanceof Mesh)) throw new Error("Missing panel backing");
  backing.geometry.computeBoundingBox();
  const bounds = backing.geometry.boundingBox?.clone().applyMatrix4(backing.matrix);
  if (!bounds) throw new Error("Missing backing bounds");
  const buttons: { label: string; left: number; right: number; bottom: number; top: number }[] = [];
  panel.traverse(object => {
    if (!object.userData.xrButton) return;
    const button = object.children[0];
    if (!(button instanceof Mesh)) throw new Error("Missing button geometry");
    button.geometry.computeBoundingBox();
    const size = button.geometry.boundingBox?.getSize(new Vector3());
    if (!size) throw new Error("Missing button bounds");
    const point = panel!.worldToLocal(object.getWorldPosition(new Vector3()));
    buttons.push({ label: object.userData.xrLabel, left: point.x - size.x / 2, right: point.x + size.x / 2, bottom: point.y - size.y / 2, top: point.y + size.y / 2 });
  });
  for (const button of buttons) {
    expect(button.left, button.label).toBeGreaterThanOrEqual(bounds.min.x - 1e-6);
    expect(button.right, button.label).toBeLessThanOrEqual(bounds.max.x + 1e-6);
    expect(button.bottom, button.label).toBeGreaterThanOrEqual(bounds.min.y - 1e-6);
    expect(button.top, button.label).toBeLessThanOrEqual(bounds.max.y + 1e-6);
  }
  for (let i = 0; i < buttons.length; i++) for (let j = i + 1; j < buttons.length; j++) {
    const a = buttons[i], b = buttons[j];
    expect(a.left < b.right - 1e-6 && a.right > b.left + 1e-6 && a.bottom < b.top - 1e-6 && a.top > b.bottom + 1e-6, `${a.label} overlaps ${b.label}`).toBe(false);
  }
  return buttons;
}
describe("headset panel layout", () => {
  it("automatically shows a larger paged numeric findings board after flipper pickup without awarding incomplete work", async () => {
    let mirror: BatchMirror;
    const complete = vi.fn();
    const sim = await clinic({ renderAdapter: ({ active }) => createElement(VergencePracticeController, { active, kind: "facility", onComplete: complete, onExit: vi.fn(), onMirror: next => { mirror = next; } }) });
    dispose = sim.dispose;
    expect(sim.controls()).toHaveLength(0);
    await sim.pickup(1, "prism-flipper");
    const labels = panelBounds(sim.state.scene).map(button => button.label);
    expect(labels).toContain("ENTRY +1 cpm"); expect(labels).toContain("PROCEDURE CONTROLS");
    expect(mirror!.lesson.mode).toBe("none");
    await act(async () => mirror!.record()); expect(complete).not.toHaveBeenCalled();
    await sim.click(1, sim.button("SUBMIT / CHECK"));
    expect(sim.labels()).toContain("NOT READY YET"); expect(complete).not.toHaveBeenCalled();
    await sim.event(1, "squeezeend"); await sim.step();
    expect(panelBounds(sim.state.scene).map(button => button.label)).toContain("ENTRY +1 cpm");
  });
  it("fits long menus and all Worth entry choices inside the backing without overlapping footer controls", async () => {
    let mirror: BatchMirror;
    const sim = await clinic({ renderAdapter: ({ active }) => createElement(WorthPracticeController, { active, onComplete: vi.fn(), onExit: vi.fn(), onMirror: next => { mirror = next; } }) });
    dispose = sim.dispose;
    await act(async () => mirror!.lesson.setMode("menu")); await sim.step(1 / 72, 12);
    expect(panelBounds(sim.state.scene).map(button => button.label)).toContain("CLOSE");
    await act(async () => mirror!.lesson.setMode("record")); await sim.step(1 / 72, 12);
    const labels = panelBounds(sim.state.scene).map(button => button.label);
    expect(labels).toContain("RIGHT HYPER"); expect(labels).toContain("SUBMIT / CHECK");
  });
  it.each(["npc", "relative"] as const)("fits paged decimal %s entries and navigation without overlap", async kind => {
    let mirror: BatchMirror;
    const sim = await clinic({ renderAdapter: ({ active }) => {
      const common = { active, onComplete: vi.fn(), onExit: vi.fn(), onMirror: (next: BatchMirror) => { mirror = next; } };
      return kind === "npc" ? createElement(VergencePracticeController, { ...common, kind }) : createElement(AccommodationPracticeController, { ...common, kind });
    } }); dispose = sim.dispose;
    await act(async () => mirror!.lesson.setMode("record")); await sim.step(1 / 72, 12);
    const labels = panelBounds(sim.state.scene).map(button => button.label); expect(labels).toContain("NEXT ENTRIES"); expect(labels).toContain("SUBMIT / CHECK");
    await sim.click(1, sim.button("NEXT ENTRIES")); panelBounds(sim.state.scene);
  });
});
