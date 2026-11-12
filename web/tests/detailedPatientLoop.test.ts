import { readFileSync } from "node:fs";
import { afterEach, beforeAll, expect, it, vi } from "vitest";
import * as THREE from "three";
import { clinic } from "./helpers/xrClinicHarness";
import { setPatientAppearance } from "../interaction/patientAppearance";
import { preloadDetailedPatient } from "../scene/DetailedPatient";
import { CLINIC_PUPIL_RADIUS } from "../interaction/clinicPatient";

let dispose: (() => Promise<void>) | undefined;
beforeAll(async () => {
  const data = JSON.parse(readFileSync(new URL("../../public/assets/patient-prototype/patient.json", import.meta.url), "utf8"));
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => data })));
  const loader = vi.spyOn(THREE.TextureLoader.prototype, "loadAsync").mockResolvedValue(new THREE.Texture());
  await preloadDetailedPatient(); loader.mockRestore(); vi.unstubAllGlobals();
});
afterEach(async () => { await dispose?.(); dispose = undefined; setPatientAppearance("current"); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it("uses the old visible eye geometry directly, including same-frame gaze, pupil light and reset", async () => {
  setPatientAppearance("detailed");
  const sim = await clinic(); dispose = sim.dispose;
  await sim.rerender(); await sim.step(1 / 72, 3);
  expect(sim.state.scene.getObjectByName("detailed-patient-skin")).toBeDefined();
  expect(sim.state.scene.getObjectByName("detailed-patient-OD")).toBeUndefined();
  const gaze = sim.eyes("consultationGaze");
  const od = gaze.find(object => object.userData.consultationGaze === "OD")!;
  const pupil = sim.eyes("consultationPupil").find(object => object.userData.consultationPupil === "OD")! as THREE.Mesh<THREE.CircleGeometry, THREE.MeshBasicMaterial>;
  const iris = od.children.find(object => object !== pupil) as THREE.Mesh<THREE.CircleGeometry>;
  expect(iris.geometry.type).toBe("CircleGeometry");
  expect(pupil.geometry.parameters.radius).toBe(CLINIC_PUPIL_RADIUS);
  expect(pupil.material.type).toBe("MeshBasicMaterial");
  expect(iris.getWorldPosition(new THREE.Vector3()).z).toBeCloseTo(-.571, 10);
  expect(pupil.getWorldPosition(new THREE.Vector3()).z).toBeCloseTo(-.570, 10);
  await sim.pickup(0, "motility"); await sim.at(0, [.12, 1.5, -.1]);
  await sim.event(0, "selectstart"); await sim.instruct("follow-target"); await sim.step(1 / 72, 4);
  expect(od.position.x).toBeGreaterThan(0);
  await sim.at(0, [-.12, 1.5, -.1]); await sim.step(1 / 72, 1);
  expect(od.position.x).toBeLessThan(0);
  expect(iris.getWorldPosition(new THREE.Vector3()).x + .048).toBeCloseTo(od.position.x, 10);
  expect(iris.getWorldPosition(new THREE.Vector3()).z).toBeCloseTo(-.571, 10);
  await sim.pickup(1, "pupils"); sim.rays[1].rotation.set(0, 0, 0);
  await sim.at(1, [-.048, 1.5, -.1]); await sim.event(1, "selectstart"); await sim.step(1 / 72, 4);
  expect(pupil.scale.x).toBeLessThan(1);
  sim.tracked[0] = false; await sim.step(1 / 72, 4);
  expect(od.position.length()).toBeCloseTo(0, 10);
  await sim.exit(); await sim.step(1 / 72, 4);
  expect(pupil.scale.x).toBe(1);
  expect(sim.record).not.toHaveBeenCalled();
});
