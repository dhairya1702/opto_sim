import { createElement, StrictMode } from "react";
import { Material, Mesh, MeshBasicMaterial, ShaderLib, Vector2, Vector3, type WebGLRenderer } from "three";
import { afterEach, expect, it, vi } from "vitest";
import { XRPanelClip } from "../scene/XRPanelClip";
import { XRSign } from "../scene/XRClinicPanels";
import { setPerfSink } from "../perf/perfFlag";
import { clinic } from "./helpers/xrClinicHarness";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; setPerfSink(null); vi.unstubAllGlobals(); });

// Exercise the installed shader hook without pretending to compile on a GPU.
function compile(material: Material) {
  const shader = { uniforms: {}, vertexShader: ShaderLib.basic.vertexShader, fragmentShader: ShaderLib.basic.fragmentShader } as Parameters<Material["onBeforeCompile"]>[0];
  material.onBeforeCompile(shader, {} as WebGLRenderer);
  return shader;
}

it("keeps report material hooks and versions stable through text, bounds and pose updates", async () => {
  const counts = new Map<string, number>();
  setPerfSink({ count(name, amount = 1) { counts.set(name, (counts.get(name) ?? 0) + amount); },
    render() {}, event() {}, frameStart() {}, frameEnd() {} });
  let text = "Report 0", width = .72, height = .24, x = 0;
  const sim = await clinic({ renderAdapter: () => createElement("group", { name: "report-owner", position: [x, 1, -2], rotation: [0, .3, 0], scale: 1.5 },
    createElement(XRPanelClip, { width, height, children: createElement(XRSign, { text: [text], p: [0, 0, 0], transparentBackground: true }) })) });
  dispose = sim.dispose;
  const owner = sim.state.scene.getObjectByName("report-owner")!;
  const clip = owner.children[0], mesh = clip.children[0] as Mesh;
  const material = mesh.material as Material;
  const hook = material.onBeforeCompile, key = material.customProgramCacheKey(), version = material.version;
  const shader = compile(material), inverse = shader.uniforms.reportInverse.value;
  const halfSize = shader.uniforms.reportHalfSize.value as Vector2;
  expect(halfSize.toArray()).toEqual([.36, .12]);
  expect(shader.vertexShader.match(/uniform mat4 reportInverse/g)).toHaveLength(1);
  expect(shader.fragmentShader).toContain("if (any(greaterThan(abs(reportPoint), reportHalfSize))) discard;");
  counts.clear();
  for (let index = 1; index <= 10; index++) {
    text = `Report ${index}`; width = .8; height = .3; x = index / 10;
    await sim.rerender(); await sim.step();
    expect(material.onBeforeCompile).toBe(hook);
    expect(material.customProgramCacheKey()).toBe(key);
    expect(material.version).toBe(version);
  }
  expect(sim.labels()).toContain("Report 10");
  expect(halfSize.toArray()).toEqual([.4, .15]);
  expect(new Vector3(.2, .1, 0).applyMatrix4(clip.matrixWorld).applyMatrix4(inverse)
    .distanceTo(new Vector3(.2, .1, 0))).toBeLessThan(1e-8);
  expect(counts.get("report material patch") ?? 0).toBe(0);
  expect(counts.get("report material restore") ?? 0).toBe(0);
});

it("deduplicates shared material arrays, patches replacements and restores hooks when content leaves", async () => {
  const shared = new MeshBasicMaterial(), added = new MeshBasicMaterial();
  const originalCompile = vi.fn<Material["onBeforeCompile"]>(function (this: Material, shader) { shader.uniforms.original = { value: this }; });
  const originalKey = function (this: Material) { return `original-${this.type}`; };
  shared.onBeforeCompile = originalCompile; shared.customProgramCacheKey = originalKey;
  let first = true, extra = false, visible = true, secondMaterial = shared;
  const sim = await clinic({ renderAdapter: () => visible ? createElement(XRPanelClip, { width: .72, height: .24,
    children: [
      first && createElement("mesh", { key: "first", material: [shared, shared] }),
      createElement("mesh", { key: "second", material: secondMaterial }),
      extra && createElement("mesh", { key: "extra", material: added }),
    ],
  }) : null });
  dispose = sim.dispose;
  expect(shared.version).toBe(1);
  const patched = shared.onBeforeCompile, shader = compile(shared);
  expect(originalCompile).toHaveBeenCalledTimes(1);
  expect(shader.uniforms.original.value).toBe(shared);
  expect(shared.customProgramCacheKey()).toBe("original-MeshBasicMaterial:bounded-report");
  expect(shader.fragmentShader.match(/uniform vec2 reportHalfSize/g)).toHaveLength(1);
  first = false; extra = true;
  await sim.rerender();
  expect(shared.onBeforeCompile).toBe(patched);
  expect(shared.version).toBe(1);
  expect(added.version).toBe(1);
  secondMaterial = added;
  await sim.rerender();
  expect(shared.onBeforeCompile).toBe(originalCompile);
  expect(shared.customProgramCacheKey).toBe(originalKey);
  expect(shared.version).toBe(2);
  expect(added.version).toBe(1);
  visible = false;
  await sim.rerender();
  expect(added.onBeforeCompile).toBe(Material.prototype.onBeforeCompile);
  expect(added.customProgramCacheKey).toBe(Material.prototype.customProgramCacheKey);
  expect(added.version).toBe(2);
  shared.dispose(); added.dispose();
});

it("keeps clipping uniforms independent between panels and restores hooks on runtime unmount", async () => {
  const left = new MeshBasicMaterial(), right = new MeshBasicMaterial();
  const leftHook = left.onBeforeCompile, rightHook = right.onBeforeCompile;
  const sim = await clinic({ renderAdapter: () => createElement(StrictMode, null,
    createElement(XRPanelClip, { width: .6, height: .2, children: createElement("mesh", { material: left }) }),
    createElement(XRPanelClip, { width: .9, height: .4, children: createElement("mesh", { material: right }) })) });
  dispose = sim.dispose;
  const a = compile(left), b = compile(right);
  expect(a.uniforms.reportHalfSize.value.toArray()).toEqual([.3, .1]);
  expect(b.uniforms.reportHalfSize.value.toArray()).toEqual([.45, .2]);
  expect(a.uniforms.reportInverse.value).not.toBe(b.uniforms.reportInverse.value);
  expect(a.uniforms.reportHalfSize.value).not.toBe(b.uniforms.reportHalfSize.value);
  await sim.dispose(); dispose = undefined;
  expect(left.onBeforeCompile).toBe(leftHook);
  expect(right.onBeforeCompile).toBe(rightHook);
  left.dispose(); right.dispose();
});
