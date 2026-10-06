import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clinic } from "./helpers/xrClinicHarness";
import { nextScopeAperture, scopeBeamAngle } from "../interaction/xrScopeEquipment";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });
describe("shared ophthalmoscope aperture selector", () => {
  it("uses the same two beam settings for equipment rendering and procedure geometry", () => {
    expect(nextScopeAperture("small")).toBe("large"); expect(nextScopeAperture("large")).toBe("small");
    expect(scopeBeamAngle("small")).toBe(.04); expect(scopeBeamAngle("large")).toBe(.16);
  });
  it("requires a nearby free hand, changes the consultation beam without recording, and survives placement/transfer", async () => {
    const sim = await clinic(); dispose = sim.dispose;
    await sim.pickup(0, "fundus"); await sim.at(0, [0, 1.33, .459]);
    expect(sim.apertureWheel().userData.scopeAperture).toBe("small");
    // A far ray cannot adjust a physical selector.
    await sim.click(1, sim.apertureWheel());
    expect(sim.apertureWheel().userData.scopeAperture).toBe("small");
    expect(sim.labels().some(line => line.includes("Bring your free hand beside"))).toBe(true);
    // The hand holding the scope cannot operate its own rear wheel.
    await sim.click(0, sim.apertureWheel());
    expect(sim.apertureWheel().userData.scopeAperture).toBe("small");
    expect(sim.labels()).toContain("Use your free hand to adjust the instrument selector.");
    await sim.cycleAperture(1); expect(sim.apertureWheel().userData.scopeAperture).toBe("large");
    sim.rays[0].position.set(0, 1.5, .459);
    sim.rays[0].rotation.set(0, 0, 0); // aim at the patient, rather than the selector tested above
    await sim.event(0, "selectstart"); await sim.step();
    const light = sim.tool("fundus").getObjectByProperty("type", "SpotLight") as THREE.SpotLight;
    expect(light.angle).toBe(.16);
    await sim.cycleAperture(1); expect(sim.apertureWheel().userData.scopeAperture).toBe("small");
    expect((sim.tool("fundus").getObjectByProperty("type", "SpotLight") as THREE.SpotLight).angle).toBe(.04);
    // Put down / pick up and transfer leave the mechanical setting alone.
    await sim.cycleAperture(1); await sim.event(0, "selectend"); await sim.event(0, "squeezeend"); await sim.step();
    expect(sim.apertureWheel().userData.scopeAperture).toBe("large");
    await sim.pickup(1, "fundus"); await sim.pickup(0, "fundus");
    expect(sim.apertureWheel().userData.scopeAperture).toBe("large");
    expect(sim.record).not.toHaveBeenCalled(); expect(sim.encounter().results).toHaveLength(0);
    await sim.exit(); await sim.enter(); expect(sim.apertureWheel().userData.scopeAperture).toBe("small");
  });
  it("clears consultation inspection and draft entries when the aperture changes, requiring another view before saving", async () => {
    const sim = await clinic(); dispose = sim.dispose;
    await sim.pickup(0, "fundus"); await sim.at(0, [.048, 1.33, -.461]);
    sim.rays[0].rotation.set(0, 0, 0);
    sim.viewerCamera.position.set(.048, 1.5, -.369);
    await sim.event(0, "selectstart"); await sim.step(1 / 72, 100);
    await sim.event(0, "selectend"); await sim.step();
    await sim.click(1, sim.directRecord("fundus"));
    for (const label of ["DISC", "MACULA", "POSTERIOR POLE", "VIEW"]) await sim.click(1, sim.button(`${label} · CHOOSE`));
    expect(sim.controls().some(button => button.userData.xrLabel === "SAVE TO NOTEBOOK")).toBe(true);
    await sim.cycleAperture(1);
    expect(sim.apertureWheel().userData.scopeAperture).toBe("large");
    expect(sim.controls().some(button => button.userData.xrLabel === "SAVE TO NOTEBOOK")).toBe(false);
    expect(sim.controls().some(button => button.userData.xrLabel === "DISC · CHOOSE")).toBe(false);
    expect(sim.record).not.toHaveBeenCalled();
    await sim.click(1, sim.button("CANCEL"));
    await sim.event(0, "selectstart"); await sim.step(1 / 72, 100); await sim.event(0, "selectend"); await sim.step();
    await sim.click(1, sim.directRecord("fundus"));
    expect(sim.controls().some(button => button.userData.xrLabel === "SAVE TO NOTEBOOK")).toBe(false);
    for (const label of ["DISC", "MACULA", "POSTERIOR POLE", "VIEW"]) await sim.click(1, sim.button(`${label} · CHOOSE`));
    await sim.click(1, sim.button("SAVE TO NOTEBOOK"));
    expect(sim.record).toHaveBeenCalledTimes(1); expect(sim.encounter().results).toHaveLength(1);
  });
});
