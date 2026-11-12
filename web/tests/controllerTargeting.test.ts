import { createElement } from "react";
import { useThree } from "@react-three/fiber";
import { Raycaster } from "three";
import { expect, it, vi } from "vitest";
import { Controller } from "../interaction/Controller";
import { clinic } from "./helpers/xrClinicHarness";

it.each([true, false])("uses only the necessary legacy targeting scans (clinicControls=%s)", async clinicControls => {
  vi.stubGlobal("window", new EventTarget());
  let sim: Awaited<ReturnType<typeof clinic>> | undefined;
  const scan = vi.spyOn(Raycaster.prototype, "intersectObjects");
  function Adapter() {
    const { gl } = useThree();
    gl.domElement ??= Object.assign(new EventTarget(), { focus() {} }) as unknown as HTMLCanvasElement;
    return createElement(Controller, { active: true, clinicControls, onTarget: () => {}, onInteract: () => {}, visit: null });
  }
  try {
    sim = await clinic({ renderAdapter: () => createElement(Adapter) });
    scan.mockClear();
    await sim.step(1 / 72, 3);
    expect(scan).toHaveBeenCalledTimes(clinicControls ? 0 : 3);
  } finally { await sim?.dispose(); scan.mockRestore(); vi.unstubAllGlobals(); }
});
