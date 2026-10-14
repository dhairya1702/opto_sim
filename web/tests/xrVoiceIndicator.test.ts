import { createElement } from "react";
import { Box3, Object3D } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { XRVoiceIndicator } from "../scene/XRVoiceIndicator";
import { clinic } from "./helpers/xrClinicHarness";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });

describe("shared XR voice indicator", () => {
  it("keeps listening status above the patient and away from the findings-board region", async () => {
    const sim = await clinic({ renderAdapter: () => createElement(XRVoiceIndicator, { status: "listening" }) });
    dispose = sim.dispose;
    let indicator: Object3D | undefined;
    sim.state.scene.traverse(object => { if (object.userData.xrVoiceIndicator) indicator = object; });
    expect(indicator).toBeDefined();
    expect(indicator!.position.toArray()).toEqual([0, 2.76, -2.47]);
    const bounds = new Box3().setFromObject(indicator!);
    expect(bounds.max.y).toBeLessThan(3);
    expect(bounds.min.x).toBeGreaterThan(-.25);
    expect(bounds.max.x).toBeLessThan(.25);
    expect(sim.labels()).toContain("LISTENING");
  });
});
