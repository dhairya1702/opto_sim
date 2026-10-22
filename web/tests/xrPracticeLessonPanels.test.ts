import { createElement } from "react";
import { act } from "@react-three/fiber";
import { Box3, Mesh, type Object3D } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clinic } from "./helpers/xrClinicHarness";
import { VergencePracticeController } from "../practice/xr/VergencePracticeController";
import { NPCPracticeController } from "../practice/xr/NPCPracticeController";
import { WorthPracticeController } from "../practice/xr/WorthPracticeController";
import { PushUpPracticeController } from "../practice/xr/PushUpPracticeController";
import { MinusLensPracticeController } from "../practice/xr/MinusLensPracticeController";
import { RelativeAccommodationPracticeController } from "../practice/xr/RelativeAccommodationPracticeController";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type PracticeLesson } from "../practice/xr/PracticeLessonUI";
import { useXRClinicRuntime } from "../interaction/useXRClinicRuntime";
let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });

function panelBounds(scene: Object3D, surface: "wall" | "head") {
  const panels: Object3D[] = [];
  scene.updateMatrixWorld(true);
  scene.traverse(object => { if (object.userData[surface === "wall" ? "xrPersistentFindings" : "xrObservationEditor"]) panels.push(object); });
  expect(panels).toHaveLength(1);
  const panel = panels[0];
  // The wall findings have no backing. Headset menus still have one.
  const backing = surface === "head" ? panel.children[0] : undefined;
  if (backing) expect(backing).toBeInstanceOf(Mesh);
  const backingBounds = backing ? new Box3().setFromObject(backing) : null;
  const buttons: { label: string; bounds: Box3 }[] = [];
  panel.traverse(object => {
    if (!object.userData.xrButton) return;
    const face = object.children[0]; expect(face).toBeInstanceOf(Mesh);
    const bounds = new Box3().setFromObject(face);
    if (backingBounds) {
      expect(bounds.min.x).toBeGreaterThanOrEqual(backingBounds.min.x - 1e-6);
      expect(bounds.max.x).toBeLessThanOrEqual(backingBounds.max.x + 1e-6);
      expect(bounds.min.y).toBeGreaterThanOrEqual(backingBounds.min.y - 1e-6);
      expect(bounds.max.y).toBeLessThanOrEqual(backingBounds.max.y + 1e-6);
    }
    buttons.push({ label: object.userData.xrLabel, bounds });
  });
  for (let i = 0; i < buttons.length; i++) for (let j = i + 1; j < buttons.length; j++) {
    const a = buttons[i].bounds, b = buttons[j].bounds;
    expect(a.min.x < b.max.x - 1e-6 && a.max.x > b.min.x + 1e-6 && a.min.y < b.max.y - 1e-6 && a.max.y > b.min.y + 1e-6,
      `${buttons[i].label} overlaps ${buttons[j].label}`).toBe(false);
  }
  return buttons.map(button => button.label);
}

describe("headset panel layout", () => {
  it.each(["facility", "worth", "npc", "relative", "push-up", "minus-lens"] as const)("keeps %s observation controls hidden until technique is ready, even if recording mode is requested", async kind => {
    let mirror: BatchMirror;
    const complete = vi.fn();
    const sim = await clinic({ renderAdapter: ({ active }) => {
      const common = { active, onComplete: complete, onExit: vi.fn(), onMirror: (next: BatchMirror) => { mirror = next; } };
      return kind === "facility" ? createElement(VergencePracticeController, { ...common, kind: "facility" })
        : kind === "worth" ? createElement(WorthPracticeController, common)
        : kind === "npc" ? createElement(NPCPracticeController, common)
        : kind === "push-up" ? createElement(PushUpPracticeController, common)
        : kind === "minus-lens" ? createElement(MinusLensPracticeController, common)
        : createElement(RelativeAccommodationPracticeController, common);
    } }); dispose = sim.dispose;
    if (kind === "facility") await sim.pickup(1, "prism-flipper");
    await act(async () => mirror!.lesson.setMode("record")); await sim.step();
    expect(mirror!.ready).toBe(false);
    const labels = panelBounds(sim.state.scene, "wall");
    expect(labels).not.toContain("SUBMIT");
    expect(labels.some(label => label.startsWith("ENTRY "))).toBe(false);
    await act(async () => {
      for (const field of mirror!.fields) mirror!.lesson.choose(field.id, field.number ? "1" : field.choices[0][0]);
      mirror!.record();
    });
    expect(complete).not.toHaveBeenCalled();
    expect(sim.record).not.toHaveBeenCalled(); expect(sim.encounter().results).toEqual([]);
  });

  // Explicit ready UI fixtures isolate layout from clinical setup. Procedure completion
  // and captured values are exercised by the mounted lesson and pure procedure tests.
  it.each(["worth", "npc", "relative", "push-up", "minus-lens"] as const)("fits ready %s entries and pagination without overlap and retains entries between pages", async kind => {
    let lesson: PracticeLesson;
    const record = vi.fn();
    let mirror: BatchMirror;
    const source = await clinic({ renderAdapter: ({ active }) => {
      const common = { active, onComplete: vi.fn(), onExit: vi.fn(), onMirror: (next: BatchMirror) => { mirror = next; } };
      return kind === "worth" ? createElement(WorthPracticeController, common)
        : kind === "npc" ? createElement(NPCPracticeController, common)
        : kind === "push-up" ? createElement(PushUpPracticeController, common)
        : kind === "minus-lens" ? createElement(MinusLensPracticeController, common)
        : createElement(RelativeAccommodationPracticeController, common);
    } });
    dispose = source.dispose;
    const fields = mirror!.fields;
    await source.dispose(); dispose = undefined;
    function ReadyPanel({ active }: { active: boolean }) {
      lesson = usePracticeLesson(vi.fn());
      const runtime = useXRClinicRuntime({ active, editorOpen: lesson.mode !== "none", onInterrupt: () => undefined });
      return createElement(PracticeLessonUI, { runtime, active, title: "Layout fixture", status: "Captured", help: [], tools: [],
        actions: Array.from({ length: 11 }, (_, index) => ({ label: `ACTION ${index}`, run: () => undefined })), directActions: [],
        fields, lesson, entryReady: true, ready: true, onRecord: record, onReset: lesson.reset, onExit: vi.fn() });
    }
    const sim = await clinic({ renderAdapter: ({ active }) => createElement(ReadyPanel, { active }) }); dispose = sim.dispose;
    const labels = panelBounds(sim.state.scene, "wall");
    const paginated = labels.includes("NEXT ENTRIES");
    if (kind !== "worth") expect(paginated).toBe(true);
    await sim.click(1, sim.button("SUBMIT")); expect(record).not.toHaveBeenCalled();
    const first = fields[0];
    await sim.click(1, sim.button(first.number ? `ENTRY +${first.number.step ?? 1}${first.number.unit}` : first.choices[0][1].toUpperCase()));
    const entries = { ...lesson!.entries };
    if (paginated) {
      await sim.click(1, sim.button("NEXT ENTRIES"));
      expect(panelBounds(sim.state.scene, "wall")).toContain("PREVIOUS ENTRIES");
      expect(lesson!.entries).toEqual(entries);
      await sim.click(1, sim.button("PREVIOUS ENTRIES")); expect(lesson!.entries).toEqual(entries);
    } else {
      expect(labels).toContain("RIGHT HYPER");
    }
    await act(async () => lesson!.setMode("menu")); await sim.step();
    expect(panelBounds(sim.state.scene, "head")).toContain("CLOSE");
  });
});
