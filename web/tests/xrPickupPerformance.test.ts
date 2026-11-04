import { afterEach, expect, it, vi } from "vitest";
import { createElement } from "react";
import { setPerfSink } from "../perf/perfFlag";
import { initialConsultationTools } from "../interaction/xrConsultationTools";
import { ConsultationInstruments } from "../scene/ConsultationInstruments";
import type { ClinicInstrumentSettings } from "../scene/LibraryClinicEquipment";
import { clinic } from "./helpers/xrClinicHarness";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; setPerfSink(null); vi.unstubAllGlobals(); });

it("picks up the canonical tool without rescanning the scene or rendering unrelated instruments", async () => {
  const counts = new Map<string, number>();
  setPerfSink({ count: (name, amount = 1) => counts.set(name, (counts.get(name) ?? 0) + amount),
    render: name => counts.set(name, (counts.get(name) ?? 0) + 1), event() {}, frameStart() {}, frameEnd() {} });
  const sim = await clinic(); dispose = sim.dispose;
  await sim.step(1 / 72, 12);
  const tool = sim.tool("pupils");
  counts.clear();
  await sim.pickup(0, "pupils"); await sim.step(1 / 72, 12);
  expect(sim.tool("pupils")).toBe(tool);
  expect(counts.get("ray target audit") ?? 0).toBe(0);
  expect(counts.get("InstrumentInstance")).toBe(1);
  // The held-tool controls mount once; subsequent pose frames reuse the index.
  expect(counts.get("ray target registry rebuild")).toBe(1);
  counts.clear();
  await sim.step(1 / 72, 12);
  expect(counts.get("ray target registry rebuild") ?? 0).toBe(0);
  expect(counts.get("InstrumentInstance") ?? 0).toBe(0);
});

it("updates per-tool settings and action callbacks without detaching canonical instrument refs", async () => {
  const register = vi.fn(), oldFlip = vi.fn(), newFlip = vi.fn();
  const state = initialConsultationTools();
  let settings: ClinicInstrumentSettings = { prism: { power: 4 }, "lens-flipper": { onFlip: oldFlip } };
  const sim = await clinic({ renderAdapter: () => createElement(ConsultationInstruments, {
    state, equipment: ["prism", "lens-flipper"], highlighted: [], returnedAt: {}, register, settings,
  }) });
  dispose = sim.dispose;
  const prism = sim.tool("prism");
  // userData markers are nested; inspect the model's actual working-cell mesh.
  const power = () => {
    let value: number | undefined;
    prism.traverse(object => { if (object.userData.xrPrismWorkingCell) value = object.userData.xrPrismPower; });
    return value;
  };
  expect(power()).toBe(4);
  const flip = () => sim.controls().find(object => object.userData.xrInstrumentControl === "lens-flipper")?.userData.xrAction();
  flip(); expect(oldFlip).toHaveBeenCalledTimes(1);
  register.mockClear();
  settings = { prism: { power: 10 }, "lens-flipper": { onFlip: newFlip } };
  await sim.rerender();
  expect(sim.tool("prism")).toBe(prism);
  expect(power()).toBe(10);
  flip(); expect(newFlip).toHaveBeenCalledTimes(1);
  expect(oldFlip).toHaveBeenCalledTimes(1);
  expect(register).not.toHaveBeenCalled();
});
