import * as THREE from "three";
import { act } from "@react-three/fiber";
import { afterEach, describe, expect, it, vi } from "vitest";
import { consultationXRArrival } from "../interaction/xrConsultationNavigation";
import { stations, walkable } from "../interaction/navigation";
import { CONSULTATION_TOOLS, consultationToolDefinition } from "../interaction/xrConsultationTools";
import { coverProcedure } from "../interaction/cover";
import { gazePositions } from "../interaction/motility";
import { clinic } from "./helpers/xrClinicHarness";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });

describe("mounted consultation two-controller walkthrough", () => {
  it("explains an out-of-reach grip and highlights the tool when the hand reaches its handle", async () => {
    const sim = await clinic(); dispose = sim.dispose;
    await sim.at(0, [-1.34, 1.05, 1.45]);
    await sim.step(1 / 72, 10);
    expect(sim.labels().some(label => label.includes("MOVE CLOSER"))).toBe(true);
    await sim.event(0, "squeezestart");
    expect(sim.labels().some(label => label.includes("then release and squeeze the side grip"))).toBe(true);
    expect(sim.interact).not.toHaveBeenCalled();
    await sim.event(0, "squeezeend");
    await sim.at(0, consultationToolDefinition("pupils").home);
    await sim.step(1 / 72, 10);
    expect(sim.labels()).toContain("GRIP · Penlight");
    await sim.event(0, "squeezestart");
    await sim.at(0, [-.048, 1.5, -.1]);
    expect(sim.tool("pupils").position.distanceTo(sim.grips[0].position)).toBeLessThan(1e-8);
  });

  it("provides unobstructed VR arrivals close to equipment without changing desktop destinations", () => {
    for (const id of ["trolley", "refraction"] as const) {
      const station = stations.find(candidate => candidate.id === id)!;
      const arrival = consultationXRArrival(id, station.position);
      expect(arrival[1]).toBe(0);
      expect(walkable(arrival[0], arrival[2])).toBe(true);
      const tools = id === "trolley" ? CONSULTATION_TOOLS.filter(tool => tool.home[2] > 0) : CONSULTATION_TOOLS.filter(tool => tool.home[2] < 0);
      for (const tool of tools) {
        expect(Math.hypot(tool.home[0] - arrival[0], tool.home[2] - arrival[2]), tool.label).toBeLessThan(.82);
      }
    }
    expect(stations.find(station => station.id === "trolley")?.position).toEqual([-.65, 1.6, 1.7]);
  });

  it("keeps the actual resting models inside their registered placement footprints", async () => {
    const sim = await clinic(); dispose = sim.dispose;
    const allBounds: THREE.Box3[] = [];
    for (const definition of CONSULTATION_TOOLS) {
      const bounds = new THREE.Box3().setFromObject(sim.tool(definition.id).children[0]);
      for (const other of allBounds) expect(bounds.intersectsBox(other), `${definition.label} overlaps another model`).toBe(false);
      allBounds.push(bounds);
      const size = bounds.getSize(new THREE.Vector3());
      expect(size.x, `${definition.label} width`).toBeLessThanOrEqual(definition.footprint[0] + .001);
      expect(size.z, `${definition.label} depth`).toBeLessThanOrEqual(definition.footprint[1] + .001);
      const surfaceHeight = definition.home[1] - definition.restHeight;
      expect(bounds.min.y, `${definition.label} must not cut into its surface`).toBeGreaterThanOrEqual(surfaceHeight - .001);
    }
  });

  it("picks up two tools, moves their visible geometry, uses a panel, transfers, and picks up again", async () => {
    const sim = await clinic({ guided: true }); dispose = sim.dispose;
    await sim.pickup(0, "pupils");
    await sim.pickup(1, "cover");
    expect(sim.interact).not.toHaveBeenCalled();
    await sim.at(0, [-.048, 1.5, -.1]);
    await sim.at(1, [.3, 1.3, .1]);
    const light = sim.tool("pupils");
    const emitter = light.localToWorld(new THREE.Vector3(...consultationToolDefinition("pupils").workingPoint));
    expect(emitter.distanceTo(new THREE.Vector3(-.048, 1.5, -.237))).toBeLessThan(1e-8);
    await sim.event(0, "selectstart");
    expect(light.getObjectByProperty("type", "SpotLight")).toBeDefined();
    await sim.panel(0);
    expect(light.getObjectByProperty("type", "SpotLight")).toBeUndefined();
    await sim.event(0, "selectend");
    await sim.click(0, sim.button("PUPILS"));
    expect(sim.labels()).toContain("PUPIL ASSESSMENT · OU");
    expect(sim.interact).not.toHaveBeenCalled();
    expect(sim.tool("cover").position.distanceTo(sim.grips[1].position)).toBeLessThan(1e-8);
    // Switching mode with trigger held must not activate a tool or the panel on release.
    await sim.event(0, "selectstart");
    await sim.panel(0);
    await sim.event(0, "selectend");
    expect(sim.interact).not.toHaveBeenCalled();
    expect(light.getObjectByProperty("type", "SpotLight")).toBeUndefined();
    // Return the right tool, then transfer the left penlight to the empty right hand.
    await sim.at(1, consultationToolDefinition("cover").home);
    await sim.putDown(1);
    await sim.at(1, sim.tool("pupils").position.toArray() as [number, number, number]);
    await sim.event(1, "squeezestart");
    await sim.event(0, "squeezeend");
    await sim.at(1, [.2, 1.4, 0]);
    expect(sim.tool("pupils").position.distanceTo(sim.grips[1].position)).toBeLessThan(1e-8);
    await sim.at(1, consultationToolDefinition("pupils").home);
    await sim.putDown(1);
    await sim.pickup(0, "pupils");
    await sim.at(0, [-.1, 1.4, 0]);
    expect(sim.tool("pupils").position.distanceTo(sim.grips[0].position)).toBeLessThan(1e-8);
    expect(sim.record).not.toHaveBeenCalled();
  });

  it("pauses pupil observation during tracking loss and permits explicit recording through a held-tool panel", async () => {
    const sim = await clinic({ guided: true }); dispose = sim.dispose;
    await sim.pickup(0, "pupils");
    await sim.pickup(1, "cover");
    await sim.panel(1);
    await sim.click(1, sim.button("PUPILS"));
    await sim.click(1, sim.button("GIVE DISTANT FIXATION"));
    await sim.click(1, sim.button("DIM ROOM"));
    await sim.at(0, [-.048, 1.5, -.1]);
    await sim.event(0, "selectstart");
    await sim.step(1 / 72, 40);
    sim.tracked[0] = false;
    await sim.step();
    expect(sim.tool("pupils").visible).toBe(false);
    expect(sim.tool("pupils").getObjectByProperty("type", "SpotLight")).toBeUndefined();
    sim.tracked[0] = true;
    await sim.step();
    expect(sim.tool("pupils").visible).toBe(true);
    await sim.event(0, "selectend");
    await sim.event(0, "selectstart");
    await sim.step(1 / 72, 25);
    await act(async () => {
      sim.session.visibilityState = "hidden";
      sim.session.dispatchEvent(new Event("visibilitychange"));
    });
    expect(sim.tool("pupils").visible).toBe(false);
    expect(sim.tool("pupils").getObjectByProperty("type", "SpotLight")).toBeUndefined();
    sim.session.visibilityState = "visible";
    await sim.step();
    await sim.event(0, "selectend");
    await sim.event(0, "selectstart");
    await sim.step(1 / 72, 25);
    expect(sim.labels()).toContain("○ OD direct / OS consensual");
    expect(sim.record).not.toHaveBeenCalled();
    await sim.step(1 / 72, 35);
    await sim.event(0, "selectend");
    await sim.step(1 / 72, 30);
    await sim.at(0, [.048, 1.5, -.1]);
    await sim.event(0, "selectstart");
    await sim.step(1 / 72, 60);
    await sim.event(0, "selectend");
    // Now six observation fields are enabled; use real ray hits rather than invoking callbacks.
    for (const label of ["OD SIZE", "OS SIZE", "EQUALITY", "OD DIRECT", "OS DIRECT", "CONSENSUAL"]) {
      await sim.click(1, sim.button(`${label} · CHOOSE`));
    }
    await sim.click(1, sim.button("RECORD FINDING"));
    expect(sim.record).toHaveBeenCalledTimes(1);
    expect(sim.record).toHaveBeenCalledWith("pupils", "general", expect.any(String));
  });

  it("places on the real refraction surface and recovers cleanly from disconnect and session end", async () => {
    const sim = await clinic(); dispose = sim.dispose;
    await sim.pickup(0, "pupils");
    await sim.pickup(1, "cover");
    await sim.at(0, [-1.14, 1, -.94]);
    await sim.putDown(0);
    await sim.step();
    expect(sim.tool("pupils").position.y).toBeCloseTo(.995);
    expect(sim.tool("pupils").position.z).toBeCloseTo(-.94);
    await sim.pickup(0, "pupils");
    await sim.event(0, "selectstart");
    await sim.event(0, "disconnected");
    await sim.step();
    expect(sim.tool("pupils").position.z).toBeCloseTo(-.94);
    expect(sim.tool("pupils").getObjectByProperty("type", "SpotLight")).toBeUndefined();
    await sim.exit();
    const remaining: THREE.Object3D[] = [];
    sim.state.scene.traverse(object => { if (object.userData.consultationToolId) remaining.push(object); });
    expect(remaining).toHaveLength(0);
    await sim.event(1, "selectstart");
    await sim.event(1, "selectend");
    expect(sim.interact).not.toHaveBeenCalled();
    expect(sim.record).not.toHaveBeenCalled();
  });
});


describe("free consultation responses", () => {
  it("aligns penlight aim independently of grip tilt and responds without exam start or setup", async () => {
    const sim = await clinic(); dispose = sim.dispose;
    await sim.pickup(0, "pupils");
    sim.grips[0].rotation.x = Math.PI / 2;
    sim.rays[0].rotation.set(0, 0, 0);
    await sim.at(0, [-.048, 1.5, -.1]);
    const forward = new THREE.Vector3(0, 1, 0).applyQuaternion(sim.tool("pupils").quaternion);
    expect(forward.distanceTo(new THREE.Vector3(0, 0, -1))).toBeLessThan(1e-8);
    expect(sim.tool("pupils").position.distanceTo(sim.grips[0].position)).toBeLessThan(1e-8);
    expect(sim.eyes("consultationPupil").every(eye => eye.scale.x === 1)).toBe(true);
    await sim.event(0, "selectstart");
    await sim.step(1 / 72, 3);
    expect(sim.eyes("consultationPupil").every(eye => eye.scale.x < 1)).toBe(true);
    // Looking at another panel cannot switch off the physical response.
    await sim.panel(1);
    await sim.click(1, sim.button("CLOSE MENU"));
    await sim.step(1 / 72, 3);
    expect(sim.eyes("consultationPupil").every(eye => eye.scale.x < 1)).toBe(true);
    sim.rays[0].rotation.y = Math.PI;
    await sim.step(1 / 72, 3);
    expect(sim.eyes("consultationPupil").every(eye => eye.scale.x === 1)).toBe(true);
    sim.rays[0].rotation.y = 0;
    await sim.step(1 / 72, 3);
    await sim.event(0, "selectend");
    await sim.step(1 / 72, 3);
    expect(sim.eyes("consultationPupil").every(eye => eye.scale.x === 1)).toBe(true);
    expect(sim.record).not.toHaveBeenCalled();
    expect(sim.interact).not.toHaveBeenCalled();
    expect(sim.labels().some(label => label.includes("START SELECTED"))).toBe(false);
  });

  it("follows the target only on instruction, supports simultaneous light response, and pauses on tracking loss", async () => {
    const sim = await clinic(); dispose = sim.dispose;
    await sim.pickup(0, "motility");
    await sim.at(0, [.12, 1.5, -.086]);
    await sim.event(0, "selectstart");
    await sim.step(1 / 72, 3);
    expect(sim.eyes("consultationGaze").every(eye => eye.position.x === 0)).toBe(true);
    await sim.panel(1);
    await sim.click(1, sim.button("FOLLOW THIS TARGET"));
    await sim.panel(1);
    await sim.step(1 / 72, 3);
    expect(sim.eyes("consultationGaze").every(eye => eye.position.x > 0)).toBe(true);
    await sim.pickup(1, "pupils");
    sim.rays[1].rotation.set(0, 0, 0);
    await sim.at(1, [-.048, 1.5, -.1]);
    await sim.event(1, "selectstart");
    await sim.step(1 / 72, 3);
    expect(sim.eyes("consultationGaze").every(eye => eye.position.x > 0)).toBe(true);
    expect(sim.eyes("consultationPupil").every(eye => eye.scale.x < 1)).toBe(true);
    sim.tracked[0] = false;
    await sim.step(1 / 72, 3);
    expect(sim.eyes("consultationGaze").every(eye => eye.position.x === 0)).toBe(true);
    expect(sim.record).not.toHaveBeenCalled();
  });

  it("records a complete cover sequence without starting an examination", async () => {
    const sim = await clinic({ guided: true }); dispose = sim.dispose;
    await sim.pickup(0, "cover");
    await sim.at(1, [0, 1.5, .327]);
    await sim.click(1, sim.button("GIVE FIXATION"));
    for (const step of coverProcedure) {
      await sim.at(0, step.position === "away" ? [.35, 1.379, -.523] : [step.position === "OD" ? -.048 : .048, 1.379, -.523]);
      await sim.step(1 / 72, Math.ceil(step.dwell * 72) + 2);
    }
    expect(sim.record).not.toHaveBeenCalled();
    for (const label of ["OD", "OS", "ALTERNATE", "INTERPRET"]) await sim.click(1, sim.button(`${label} · CHOOSE`));
    await sim.click(1, sim.button("RECORD FINDING"));
    expect(sim.record).toHaveBeenCalledExactlyOnceWith("cover", "distance", "No refixation movement observed during cover–uncover or alternating cover testing at distance.");
  });

  it("records motility explicitly and cancels unrecorded observations without removing held tools", async () => {
    const sim = await clinic({ guided: true }); dispose = sim.dispose;
    await sim.pickup(0, "motility");
    await sim.click(1, sim.button("GIVE FOLLOWING INSTRUCTION"));
    await sim.event(0, "selectstart");
    for (const gaze of gazePositions) {
      await sim.at(0, [gaze.x * .35 * .65, 1.5 + gaze.y * .35 * .45, -.086]);
      await sim.step(1 / 72, 54);
    }
    await sim.event(0, "selectend");
    await sim.click(1, sim.button("ASK DIPLOPIA / PAIN"));
    await sim.click(1, sim.button("OBSERVATION · CHOOSE"));
    expect(sim.record).not.toHaveBeenCalled();
    await sim.click(1, sim.button("RECORD FINDING"));
    expect(sim.record).toHaveBeenCalledExactlyOnceWith("motility", "default", "Full movements; no diplopia reported during the simulated assessment.");
    await sim.click(1, sim.button("CANCEL"));
    expect(sim.record).toHaveBeenCalledTimes(1);
    expect(sim.tool("motility").position.distanceTo(sim.grips[0].position)).toBeLessThan(1e-8);
  });
});


describe("free-roam consultation presentation", () => {
  it("never opens a test panel on selection, pickup, placement, or hand transfer", async () => {
    const sim = await clinic({ selectedExamId: "pupils" }); dispose = sim.dispose;
    const unguided = () => {
      expect(sim.controls().filter(control => !control.userData.xrRecordTool && !control.userData.xrInstrumentControl)).toHaveLength(0);
      expect(sim.labels().some(label => /PUPIL ASSESSMENT|COVER TEST|OCULAR MOTILITY|CHOOSE EXAMINATION|TECHNIQUE PAUSED|gaze positions|technique steps/.test(label))).toBe(false);
    };
    unguided();
    for (const id of ["pupils", "motility", "cover"] as const) {
      await sim.pickup(0, id);
      unguided();
      await sim.at(1, sim.tool(id).position.toArray() as [number, number, number]);
      await sim.event(1, "squeezestart");
      await sim.event(0, "squeezeend");
      unguided();
      await sim.at(1, consultationToolDefinition(id).home);
      await sim.putDown(1);
      unguided();
    }
    expect(sim.interact).not.toHaveBeenCalled();
    expect(sim.record).not.toHaveBeenCalled();
  });

  it("offers patient instructions and case panels only when the learner requests the menu", async () => {
    const sim = await clinic(); dispose = sim.dispose;
    await sim.pickup(0, "pupils");
    await sim.panel(1);
    expect(sim.labels()).toContain("ARUN");
    expect(sim.labels()).toContain("Patient instructions");
    expect(sim.labels()).not.toContain("PUPILS");
    await sim.click(1, sim.button("HISTORY"));
    await sim.click(1, sim.button("NOTEBOOK"));
    await sim.click(1, sim.button("MY ASSESSMENT"));
    expect(sim.openPanel.mock.calls.map(([panel]) => panel)).toEqual(["interview", "notes", "submission"]);
    await sim.click(1, sim.button("CLOSE MENU"));
    expect(sim.controls().filter(control => !control.userData.xrRecordTool && !control.userData.xrInstrumentControl)).toHaveLength(0);
    expect(sim.record).not.toHaveBeenCalled();
    await sim.panel(1);
    await sim.panel(1);
    expect(sim.labels()).toContain("FOLLOW THIS TARGET");
    await sim.panel(1);
    expect(sim.controls().filter(control => !control.userData.xrRecordTool && !control.userData.xrInstrumentControl)).toHaveLength(0);
  });
});


describe("on-request finding recording and exit", () => {
  it("saves the learner's penlight observation to the encounter only after explicit entry and save", async () => {
    const sim = await clinic(); dispose = sim.dispose;
    await sim.pickup(0, "pupils");
    await sim.panel(1);
    await sim.click(1, sim.button("RECORD OBSERVATION"));
    expect(sim.labels()).toContain("MY OBSERVATIONS");
    expect(sim.controls().some(button => button.userData.xrLabel === "SAVE TO NOTEBOOK")).toBe(false);
    expect(sim.encounter().results).toHaveLength(0);
    await sim.click(1, sim.button("CANCEL"));
    await sim.click(1, sim.button("LOOK STRAIGHT AHEAD"));
    await sim.click(1, sim.button("DIM ROOM LIGHTS"));
    await sim.panel(1);
    await sim.at(0, [-.048, 1.5, -.1]);
    await sim.event(0, "selectstart");
    await sim.step(1 / 72, 60);
    await sim.event(0, "selectend");
    await sim.step(1 / 72, 30);
    await sim.at(0, [.048, 1.5, -.1]);
    await sim.event(0, "selectstart");
    await sim.step(1 / 72, 60);
    await sim.event(0, "selectend");
    expect(sim.encounter().results).toHaveLength(0);
    await sim.panel(1);
    await sim.click(1, sim.button("RECORD OBSERVATION"));
    for (const label of ["OD SIZE", "OS SIZE", "EQUALITY", "CONSENSUAL", "OD DIRECT", "OS DIRECT"]) await sim.click(1, sim.button(`${label} · CHOOSE`));
    expect(sim.encounter().results).toHaveLength(0);
    await sim.click(1, sim.button("SAVE TO NOTEBOOK"));
    const recorded = sim.encounter().results;
    expect(recorded).toHaveLength(1);
    expect(recorded[0].value).toContain("OD 2 mm, OS 2 mm");
    expect(recorded[0].expectedValue).toContain("OD 4 mm, OS 4 mm");
    expect(sim.encounter().events.some(event => event.type === "exam" && event.resultId === recorded[0].id)).toBe(true);
    expect(sim.labels()).not.toContain("MY OBSERVATIONS");
    expect(sim.labels()).toContain("Saved to your notebook.");
  });

  it("records complete near cover observations after requesting target fixation in menu mode", async () => {
    const sim = await clinic(); dispose = sim.dispose;
    await sim.pickup(0, "cover");
    await sim.at(1, [0, 1.5, -.073]);
    await sim.panel(1);
    await sim.click(1, sim.button("LOOK AT THIS TARGET"));
    await sim.panel(1);
    for (const step of coverProcedure) {
      await sim.at(0, step.position === "away" ? [.35, 1.379, -.523] : [step.position === "OD" ? -.048 : .048, 1.379, -.523]);
      await sim.step(1 / 72, Math.ceil(step.dwell * 72) + 2);
    }
    await sim.panel(1);
    await sim.click(1, sim.button("RECORD OBSERVATION"));
    for (const label of ["OD", "OS", "ALTERNATE", "INTERPRET"]) await sim.click(1, sim.button(`${label} · CHOOSE`));
    await sim.click(1, sim.button("SAVE TO NOTEBOOK"));
    expect(sim.record).toHaveBeenCalledExactlyOnceWith("cover", "near", expect.any(String));
  });

  it("exits explicitly from the patient-menu corner and from recording without saving", async () => {
    const sim = await clinic(); dispose = sim.dispose;
    await sim.pickup(0, "pupils");
    await sim.panel(1);
    await sim.click(1, sim.button("EXIT VR"));
    expect(sim.exitVR).toHaveBeenCalledTimes(1);
    expect(sim.record).not.toHaveBeenCalled();
    await sim.click(1, sim.button("RECORD OBSERVATION"));
    await sim.click(1, sim.button("EXIT VR"));
    expect(sim.exitVR).toHaveBeenCalledTimes(2);
    expect(sim.record).not.toHaveBeenCalled();
    expect(sim.encounter().results).toHaveLength(0);
    await sim.exit();
    expect(sim.labels()).not.toContain("MY OBSERVATIONS");
  });
});


it("records instructed target observations through the free-roam drawer and retains rejected entries", async () => {
  const sim = await clinic(); dispose = sim.dispose;
  await sim.pickup(0, "motility");
  await sim.panel(1);
  await sim.click(1, sim.button("FOLLOW THIS TARGET"));
  await sim.panel(1);
  await sim.event(0, "selectstart");
  for (const gaze of gazePositions) {
    await sim.at(0, [gaze.x * .35 * .65, 1.5 + gaze.y * .35 * .45, -.086]);
    await sim.step(1 / 72, 54);
  }
  await sim.event(0, "selectend");
  await sim.panel(1);
  await sim.click(1, sim.button("RECORD OBSERVATION"));
  await sim.click(1, sim.button("ASK DIPLOPIA / PAIN"));
  await sim.click(1, sim.button("OBSERVATION · CHOOSE"));
  sim.record.mockReturnValueOnce(false);
  await sim.click(1, sim.button("SAVE TO NOTEBOOK"));
  expect(sim.encounter().results).toHaveLength(0);
  expect(sim.labels()).toContain("MY OBSERVATIONS");
  await sim.click(1, sim.button("SAVE TO NOTEBOOK"));
  expect(sim.encounter().results).toHaveLength(1);
  expect(sim.encounter().results[0].examId).toBe("motility");
  expect(sim.labels()).not.toContain("MY OBSERVATIONS");
});

it("opens recording directly beside a held tool and keeps the editor in front of the headset", async () => {
  const sim = await clinic(); dispose = sim.dispose;
  await sim.pickup(0, "pupils");
  expect(sim.labels()).not.toContain("Patient instructions");
  await sim.click(1, sim.directRecord("pupils"));
  expect(sim.labels()).toContain("MY OBSERVATIONS");
  expect(sim.labels()).not.toContain("Patient instructions");
  sim.viewerCamera.position.set(.4, 1.7, .8);
  sim.viewerCamera.rotation.y = .35;
  await sim.step(1 / 72, 3);
  const editors: THREE.Object3D[] = [];
  sim.state.scene.traverse(object => { if (object.userData.xrObservationEditor) editors.push(object); });
  const expected = sim.viewerCamera.position.clone().add(new THREE.Vector3(0, -.04, -.85).applyQuaternion(sim.viewerCamera.quaternion));
  expect(editors.length).toBeGreaterThan(0);
  expect(editors.every(editor => editor.position.distanceTo(expected) < 1e-8)).toBe(true);
  await sim.click(1, sim.button("CANCEL"));
  expect(sim.record).not.toHaveBeenCalled();
});

it("aims the retinoscope correctly, reverses its visible reflex with lenses, and records the inspected eye", async () => {
  const sim = await clinic(); dispose = sim.dispose;
  await sim.pickup(0, "objective");
  sim.grips[0].rotation.x = Math.PI / 2;
  sim.rays[0].rotation.set(0, 0, 0);
  await sim.at(0, [-.048, 1.33, .129]);
  const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(sim.tool("objective").quaternion);
  expect(forward.distanceTo(new THREE.Vector3(0, 0, -1))).toBeLessThan(1e-8);
  expect(sim.tool("objective").position.distanceTo(sim.grips[0].position)).toBeLessThan(1e-8);
  await sim.panel(1);
  await sim.click(1, sim.button("LOOK STRAIGHT AHEAD"));
  await sim.panel(1);
  await sim.event(0, "selectstart");
  const visual = () => {
    let found: THREE.Group | undefined;
    sim.state.scene.traverse(object => { if (object.userData.xrRetinoReflex) found = object as THREE.Group; });
    if (!found) throw new Error("No pupil reflex visualization");
    return found;
  };
  const offset = () => ((visual().children[0] as THREE.Mesh).material as THREE.ShaderMaterial).uniforms.offset.value as number;
  await sim.at(0, [-.042, 1.33, .129]);
  await sim.step(1 / 72, 3);
  expect(visual().visible).toBe(true);
  expect(offset()).toBeGreaterThan(0);
  const sweep = async () => {
    for (const x of [-.054, -.042, -.054]) { await sim.at(0, [x, 1.33, .129]); await sim.step(1 / 72, 3); }
  };
  await sweep(); // with motion
  for (let i = 0; i < 3; i++) await sim.click(1, sim.button("+0.25 D"));
  await sweep(); // neutral, 90
  await sim.click(1, sim.button("STREAK 90°"));
  await sweep(); // neutral, 180
  await sim.click(1, sim.button("+0.25 D"));
  await sim.at(0, [-.042, 1.33, .129]);
  await sim.step(1 / 72, 3);
  expect(offset()).toBeLessThan(0);
  await sweep(); // against
  await sim.click(1, sim.button("−0.25 D"));
  await sim.event(0, "selectend");
  await sim.step(1 / 72, 3);
  expect(visual().visible).toBe(false);
  expect(sim.record).not.toHaveBeenCalled();
  await sim.click(1, sim.directRecord("objective"));
  for (const label of ["GROSS", "CORRECTION", "NET SPHERE", "CYLINDER", "AXIS"]) await sim.click(1, sim.button(`${label} · CHOOSE`));
  await sim.click(1, sim.button("SAVE TO NOTEBOOK"));
  expect(sim.record).toHaveBeenCalledWith("objective", "default", expect.any(String), "OD");
  const result = sim.encounter().results[0];
  expect(result.eye).toBe("OD");
  expect(result.expectedValue).toContain("sphere −1.25 D");
  expect(result.value).toContain("sphere −2.00 D"); // entered value retained, never silently corrected
});

it("reveals the authored fundus only in explicit lit scope mode and handles interruption and OS recording", async () => {
  const sim = await clinic(); dispose = sim.dispose;
  await sim.pickup(0, "fundus");
  sim.grips[0].rotation.x = Math.PI / 2;
  sim.rays[0].rotation.set(0, 0, 0);
  await sim.at(0, [.048, 1.33, -.461]);
  expect(new THREE.Vector3(0, 0, 1).applyQuaternion(sim.tool("fundus").quaternion).distanceTo(new THREE.Vector3(0, 0, -1))).toBeLessThan(1e-8);
  const field = () => {
    let found: THREE.Object3D | undefined;
    sim.tool("fundus").traverse(object => { if (object.userData.xrFundusField) found = object; });
    if (!found) throw new Error("No viewing aperture");
    return found;
  };
  await sim.event(0, "selectstart");
  await sim.step(1 / 72, 5);
  expect(field().visible).toBe(false); // No scope mode yet.
  await sim.scope(0);
  await sim.step(1 / 72, 60);
  expect(field().visible).toBe(true);
  sim.tracked[0] = false;
  await sim.step(1 / 72, 3);
  expect(field().visible).toBe(false);
  sim.tracked[0] = true;
  await sim.step();
  await sim.event(0, "selectend");
  await sim.event(0, "selectstart"); await sim.scope(0);
  await sim.step(1 / 72, 40);
  await sim.click(1, sim.directRecord("fundus"));
  expect(sim.controls().some(button => button.userData.xrLabel === "DISC · CHOOSE")).toBe(false);
  await sim.click(1, sim.button("CANCEL"));
  await sim.scope(0); await sim.step(1 / 72, 100);
  await sim.event(0, "selectend");
  await sim.step(1 / 72, 3);
  expect(field().visible).toBe(false);
  expect(sim.encounter().results).toHaveLength(0);
  await sim.click(1, sim.directRecord("fundus"));
  for (const label of ["DISC", "MACULA", "POSTERIOR POLE", "VIEW"]) await sim.click(1, sim.button(`${label} · CHOOSE`));
  await sim.click(1, sim.button("SAVE TO NOTEBOOK"));
  expect(sim.record).toHaveBeenCalledWith("fundus", "default", expect.stringContaining("Peripheral retina not fully assessed"), "OS");
  expect(sim.encounter().results[0].eye).toBe("OS");
});
