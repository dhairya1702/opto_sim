import { createElement } from "react";
import { act } from "@react-three/fiber";
import { Mesh, MeshBasicMaterial, type Object3D, Quaternion, Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clinic } from "./helpers/xrClinicHarness";
import { useXRPracticeResult, XRPracticeResultHUD, XR_RESULT_DURATION_MS } from "../scene/XRPracticeResultHUD";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("temporary Practice result HUD", () => {
  it("wraps feedback near the headset, follows its pose and does not intercept rays", async () => {
    let notice: ReturnType<typeof useXRPracticeResult>;
    function Feedback({ active }: { active: boolean }) {
      notice = useXRPracticeResult();
      return createElement(XRPracticeResultHUD, { active, result: notice.result });
    }
    const sim = await clinic({ renderAdapter: ({ active }) => createElement(Feedback, { active }) });
    dispose = sim.dispose;
    const hud = () => {
      let object: Object3D | undefined;
      sim.state.scene.traverse(child => { if (child.userData.xrPracticeResultHUD) object = child; });
      return object;
    };
    expect(hud()).toBeUndefined();
    const message = "Corneal reflexes are centred and symmetrical in this example. Your observation has been recorded.";
    await act(async () => notice!.showResult("correct", message));
    sim.viewerCamera.position.set(.3, 1.55, .45); sim.viewerCamera.rotation.y = .4;
    await sim.step();
    const board = hud()!;
    const rotation = sim.viewerCamera.getWorldQuaternion(new Quaternion());
    const expected = new Vector3(0, -.04, -.9).applyQuaternion(rotation).add(sim.viewerCamera.position);
    expect(board.position.distanceTo(expected)).toBeLessThan(1e-8);
    expect(board.quaternion.angleTo(rotation)).toBeLessThan(1e-6);
    expect(board.userData.xrIgnoreRay).toBe(true); expect(board.userData.xrPanel).toBeUndefined();
    expect(sim.labels()).toContain("CORRECT");
    const rows: string[] = [];
    board.traverse(child => {
      if (!(child instanceof Mesh)) return;
      expect(child.renderOrder).toBeGreaterThan(1102);
      const materials = Array.isArray(child.material) ? child.material : [child.material];
      expect(materials.every(material => !material.depthTest && !material.depthWrite)).toBe(true);
      materials.forEach(material => {
        if (!(material instanceof MeshBasicMaterial)) return;
        const image = material.map?.image as { renderedText?: string[] } | undefined;
        rows.push(...(image?.renderedText ?? []).filter(line => line !== "CORRECT"));
      });
    });
    expect(rows.join(" ")).toBe(message); expect(rows.every(line => line.length <= 44)).toBe(true);
  });

  it("dismisses after five seconds, restarts for identical resubmissions and clears timers on unmount", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    let notice: ReturnType<typeof useXRPracticeResult>;
    function Feedback({ active }: { active: boolean }) {
      notice = useXRPracticeResult();
      return createElement(XRPracticeResultHUD, { active, result: notice.result });
    }
    const sim = await clinic({ renderAdapter: ({ active }) => createElement(Feedback, { active }) });
    dispose = sim.dispose;
    await act(async () => notice!.showResult("retry", "Compare the direction and try again."));
    await act(async () => vi.advanceTimersByTimeAsync(3000));
    await sim.rerender(); expect(sim.labels()).toContain("TRY AGAIN");
    await act(async () => notice!.showResult("retry", "Compare the direction and try again."));
    await act(async () => vi.advanceTimersByTimeAsync(XR_RESULT_DURATION_MS - 1));
    expect(sim.labels()).toContain("TRY AGAIN");
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(sim.labels()).not.toContain("TRY AGAIN");
    await act(async () => notice!.showResult("incomplete", "Inspect both reflexes before submitting."));
    expect(sim.labels()).toContain("NOT READY YET");
    await sim.dispose(); dispose = undefined;
    expect(vi.getTimerCount()).toBe(0);
  });
});
