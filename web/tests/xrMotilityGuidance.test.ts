import { createElement } from "react";
import { Box3, Mesh, Object3D, Quaternion, Raycaster, Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MotilityPracticeController } from "../practice/xr/MotilityPracticeController";
import { PracticeAttemptProvider, type PracticeAttemptKind } from "../practice/PracticeAttemptContext";
import { wrapGuidedStepLines, XRGuidedStepBubble, XR_GUIDANCE_DISTANCE } from "../scene/XRGuidedStepBubble";
import { clinic } from "./helpers/xrClinicHarness";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });

const adapter = (kind: PracticeAttemptKind) => ({ active }: { active: boolean }) => createElement(
  PracticeAttemptProvider,
  {
    value: { settings: { kind, interaction: "vr", voice: "disabled" }, setSettings: vi.fn() },
    children: createElement(MotilityPracticeController, { active, onComplete: vi.fn(), onExit: vi.fn() }),
  },
);

describe("XR motility guided step bubble", () => {
  it("wraps long coaching copy into readable lines instead of shrinking a single line", () => {
    const wrapped = wrapGuidedStepLines(["Pick up the point target from the left instrument table. Place it on the Distance Target Dock beside Arun, then turn it on."]);
    expect(wrapped.length).toBeGreaterThan(2);
    expect(wrapped.every(line => line.length <= 44)).toBe(true);
  });

  it("shows and advances a view-following step HUD in Guided Practice", async () => {
    const sim = await clinic({ renderAdapter: adapter("guided") }); dispose = sim.dispose;
    expect(sim.guidedStep()).toBe("tool");
    expect(sim.labels()).toContain("Pick up the penlight");
    expect(sim.labels()).not.toContain("CONSULTATION 01");

    let bubble: Object3D | undefined, board: Object3D | undefined, acuity: Object3D | undefined, welcome: Object3D | undefined;
    sim.state.scene.traverse(object => {
      if (object.userData.xrGuidedStepBubble) bubble = object;
      if (object.userData.xrPersistentFindings) board = object;
      if (object.userData.station === "acuity") acuity = object;
      if (object.userData.xrWallWelcome) welcome = object;
    });
    expect(bubble).toBeDefined(); expect(board).toBeDefined(); expect(acuity).toBeDefined(); expect(welcome).toBeUndefined();
    expect(bubble!.position.x).toBeCloseTo(sim.viewerCamera.position.x);
    expect(bubble!.scale.toArray()).toEqual([1, 1, 1]);
    expect(new Box3().setFromObject(acuity!).getCenter(new Vector3()).x).toBeCloseTo(-1.22);
    expect(board!.position.x).toBeCloseTo(1.25);
    const bubbleBounds = new Box3().setFromObject(bubble!);
    const boardBounds = new Box3().setFromObject(board!);
    expect(bubbleBounds.intersectsBox(boardBounds)).toBe(false);
    expect(boardBounds.max.y).toBeLessThan(2.85);
    expect(boardBounds.min.y).toBeGreaterThan(.25);
    expect(sim.controls().some(object => object.userData.xrLabel === "FOLLOW LIGHT · HEAD STILL")).toBe(false);
    expect(sim.controls().some(object => object.userData.xrLabel === "ASK ABOUT SYMPTOMS")).toBe(false);

    await sim.pickup(0, "pupils");
    expect(sim.guidedStep()).toBe("instruct");
    expect(sim.labels()).toContain("Instruct Arun");
    expect(sim.button("FOLLOW LIGHT · HEAD STILL").userData.xrGlassButton).toBe(true);

    await sim.click(1, sim.button("FOLLOW LIGHT · HEAD STILL"));
    expect(sim.guidedStep()).toBe("primary");
    expect(sim.controls().some(object => object.userData.xrLabel === "FOLLOWING ✓")).toBe(false);
    expect(sim.controls().some(object => object.userData.xrLabel === "ASK ABOUT SYMPTOMS")).toBe(false);
    expect(sim.labels()).toContain("Establish primary gaze");

    await sim.event(0, "selectstart");
    await sim.at(0, [0, 1.5, -.086]);
    await sim.step(1 / 72, 60);
    expect(sim.guidedStep()).toBe("pattern");
    expect(sim.labels()).toContain("Complete the H-pattern");
  });

  it("follows seated height, translation and head rotation without intercepting rays", async () => {
    const sim = await clinic({ renderAdapter: () => createElement(XRGuidedStepBubble, {
      stepId: "tool", title: "Pick up the penlight", lines: ["Squeeze the side grip once beside its handle."],
    }) }); dispose = sim.dispose;
    let bubble: Object3D | undefined;
    sim.state.scene.traverse(object => { if (object.userData.xrGuidedStepBubble) bubble = object; });
    expect(bubble).toBeDefined();
    const initial = sim.viewerCamera.worldToLocal(bubble!.getWorldPosition(new Vector3()));
    for (const height of [1.05, 1.8]) {
      sim.viewerCamera.position.set(.8, height, -1.2);
      sim.viewerCamera.rotation.set(-.25, 1.1, .12);
      await sim.step();
      const local = sim.viewerCamera.worldToLocal(bubble!.getWorldPosition(new Vector3()));
      expect(local.distanceTo(initial)).toBeLessThan(1e-6);
      expect(local.y).toBeLessThan(0);
      expect(local.z).toBeCloseTo(-XR_GUIDANCE_DISTANCE);
      expect(bubble!.quaternion.angleTo(sim.viewerCamera.getWorldQuaternion(new Quaternion()))).toBeLessThan(1e-6);
    }
    bubble!.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => { expect(material.depthTest).toBe(false); expect(material.depthWrite).toBe(false); });
    });
    const ray = new Raycaster(sim.viewerCamera.position, bubble!.position.clone().sub(sim.viewerCamera.position).normalize());
    expect(ray.intersectObject(bubble!, true)).toEqual([]);
    sim.state.gl.xr.isPresenting = false;
    sim.state.camera.position.set(-1, 1.1, 2);
    sim.state.camera.rotation.set(.15, -.8, 0);
    await sim.step();
    const desktopLocal = sim.state.camera.worldToLocal(bubble!.getWorldPosition(new Vector3()));
    expect(desktopLocal.x).toBeCloseTo(0);
    expect(desktopLocal.y).toBeLessThan(0);
    expect(desktopLocal.z).toBeCloseTo(-XR_GUIDANCE_DISTANCE);
  });

  it("does not expose next-step coaching in independent Test attempts", async () => {
    const sim = await clinic({ renderAdapter: adapter("test") }); dispose = sim.dispose;
    expect(sim.guidedStep()).toBeUndefined();
    expect(sim.labels()).not.toContain("Pick up the penlight");
    expect(sim.labels()).not.toContain("○ Up");
    expect(sim.labels()).not.toContain("SHOW GAZE GUIDE");
    expect(sim.labels()).not.toContain("HIDE GAZE GUIDE");
  });
});
