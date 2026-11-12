import { createElement, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Mesh, Raycaster, Vector3 } from "three";
import { expect, it, vi } from "vitest";
import { clinic } from "./helpers/xrClinicHarness";
import { useXRClinicRuntime } from "../interaction/useXRClinicRuntime";

it("does not commit unchanged desktop highlights and updates on target changes", async () => {
  vi.stubGlobal("window", new EventTarget());
  const target = new Mesh(); target.userData.consultationToolId = "pupils";
  let aimed = false, changes = 0, highlighted: string[] = [];
  const intersect = vi.spyOn(Raycaster.prototype, "intersectObjects").mockImplementation(() =>
    aimed ? [{ object: target, distance: .5, point: new Vector3() }] : []);
  function Probe() {
    const { gl } = useThree();
    gl.domElement ??= Object.assign(new EventTarget(), { focus() {} }) as unknown as HTMLCanvasElement;
    const runtime = useXRClinicRuntime({ active: true, inputMode: "desktop", equipment: [] });
    highlighted = runtime.highlighted;
    useEffect(() => { changes++; }, [runtime.highlighted]);
    return null;
  }
  const sim = await clinic({ renderAdapter: () => createElement(Probe) });
  try {
    await sim.step(.1, 20); expect(changes).toBe(1);
    aimed = true; await sim.step(.1, 3);
    expect(highlighted).toEqual(["pupils"]); expect(changes).toBe(2);
    await sim.step(.1, 20); expect(changes).toBe(2);
    aimed = false; await sim.step(.1, 3);
    expect(highlighted).toEqual([]); expect(changes).toBe(3);
    await sim.step(.1, 20); expect(changes).toBe(3);
  } finally { await sim.dispose(); intersect.mockRestore(); vi.unstubAllGlobals(); }
});
