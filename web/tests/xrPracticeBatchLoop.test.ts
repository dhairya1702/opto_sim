import { createElement } from "react";
import { act } from "@react-three/fiber";
import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clinic } from "./helpers/xrClinicHarness";
import { BrucknerPracticeController } from "../practice/xr/BrucknerPracticeController";
import { MotilityPracticeController } from "../practice/xr/MotilityPracticeController";
import { CoverPracticeController } from "../practice/xr/CoverPracticeController";
import type { BatchMirror } from "../practice/xr/PracticeLessonUI";
import { brucknerReflexVisual, type BrucknerScenario } from "../interaction/brucknerPractice";
import { coverTeachingIrisOffset } from "../interaction/coverDeviation";
import { gazePositions, motilityScenarios, type MotilityScenarioId } from "../interaction/motility";
import { PRISM_BAR_WORKING_Y, consultationToolDefinition } from "../interaction/xrConsultationTools";
import { SENSORY_SOCKETS } from "../interaction/xrSensoryEquipment";
import { PracticeAttemptProvider, type PracticeAttemptKind } from "../practice/PracticeAttemptContext";

let dispose: (() => Promise<void>) | undefined;
function requiredSensorySocket(id: string) {
  const socket = SENSORY_SOCKETS.find(candidate => candidate.id === id);
  if (!socket) throw new Error(`Required sensory socket is missing: ${id}`);
  return socket;
}
const COVER_NEAR_SOCKET = requiredSensorySocket("sensory-worth-near");
const COVER_DISTANCE_SOCKET = requiredSensorySocket("sensory-worth-distance");
afterEach(async () => { await dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });
async function lesson(kind: "bruckner" | "motility" | "cover-uncover" | "alternate-cover", advanceOnNext = false, initialScenario: BrucknerScenario = "od", initialMotilityScenario: MotilityScenarioId = "full", attemptKind?: PracticeAttemptKind) {
  let mirror: BatchMirror;
  let scenario: BrucknerScenario = initialScenario;
  let motilityScenario = initialMotilityScenario;
  const onMirror = (next: BatchMirror) => { mirror = next; };
  const complete = vi.fn(), next = vi.fn(() => {
    if (!advanceOnNext) return;
    if (kind === "motility") motilityScenario = motilityScenarios[(motilityScenarios.findIndex(item => item.id === motilityScenario) + 1) % motilityScenarios.length].id;
    else scenario = "os";
  }), exit = vi.fn();
  const sim = await clinic({ renderAdapter: ({ active }) => {
    const props = { active, onComplete: complete, onExit: exit, onMirror };
    const controller = kind === "bruckner" ? createElement(BrucknerPracticeController, { ...props, scenario, onNext: next })
      : kind === "motility" ? createElement(MotilityPracticeController, { ...props, scenarioId: motilityScenario, onNext: next }) : createElement(CoverPracticeController, { ...props, kind });
    return attemptKind ? createElement(PracticeAttemptProvider, {
      value: { settings: { kind: attemptKind, interaction: "vr", voice: "disabled" }, setSettings: vi.fn() }, children: controller,
    }) : controller;
  } });
  dispose = sim.dispose;
  const action = async (label: string) => {
    const found = mirror!.actions.find(action => action.label === label);
    if (!found) throw new Error(`Mirror action missing: ${label}`);
    await act(async () => found.run()); await sim.step(1 / 72, 10);
  };
  const coverAt = async (position: "OD" | "OS" | "away", count = 65) => {
    await sim.at(1, position === "away" ? [0, 1.1, -.3] : [position === "OD" ? -.048 : .048, 1.379, -.513]);
    await sim.step(1 / 72, count);
  };
  const coverSequence = async () => {
    for (const position of (kind === "alternate-cover" ? ["OD", "OS", "OD", "OS"] : ["OD", "away", "OS", "away"]) as ("OD" | "OS" | "away")[]) await coverAt(position);
  };
  const powerTarget = async () => {
    const targetSwitch = sim.button("TARGET POWER OFF");
    await sim.at(1, targetSwitch.getWorldPosition(new THREE.Vector3()).toArray() as [number, number, number]);
    await sim.click(1, targetSwitch); await sim.step(1 / 72, 12);
  };
  const prepareDistanceTarget = async () => {
    await sim.pickup(0, "worth"); await sim.at(0, COVER_DISTANCE_SOCKET.position); await sim.putDown(0); await sim.step(1 / 72, 12);
    await powerTarget();
  };
  const moveTargetNear = async () => {
    await sim.pickup(0, "worth"); await sim.at(0, COVER_NEAR_SOCKET.position); await sim.putDown(0); await sim.step(1 / 72, 12);
  };
  return { ...sim, action, complete, next, leave: exit, coverAt, coverSequence, powerTarget, prepareDistanceTarget, moveTargetNear, mirror: () => mirror!,
    change: async () => { scenario = "os"; await sim.rerender(); await sim.step(1 / 72, 12); },
  };
}
describe("new Practice lessons in the shared clinic", () => {
  it("keeps Bruckner eyes visible during setup, lights pupils only with beam coverage, and still gates completion", async () => {
    const sim = await lesson("bruckner");
    expect(sim.button("LOOK AT THE LIGHT")).toBeDefined();
    expect(sim.controls().some(control => control.userData.xrLabel === "RECENTER CLINIC")).toBe(false);
    await sim.scope(1);
    expect(["HELP", "RECENTER CLINIC", "EXIT VR"].every(label => sim.controls().some(control => control.userData.xrLabel === label))).toBe(true);
    await sim.click(1, sim.button("RECENTER CLINIC"));
    expect(sim.controls().some(control => control.userData.xrLabel === "RECENTER CLINIC")).toBe(false);
    expect(sim.labels()).toContain("1 · FIXATION —");
    expect(sim.labels()).toContain("2 · LARGE APERTURE —");
    await sim.pickup(0, "fundus");
    await sim.click(0, sim.button("LOOK AT THE LIGHT"));
    expect(sim.mirror().actions[0].active).toBe(false); // Instrument trigger never operates wall UI.
    await sim.at(0, [0, 1.33, .459]);
    await sim.scope(0); await sim.step(1 / 72, 12);
    expect(sim.labels().some(label => /^3 · WORKING DISTANCE \d+ CM ✓$/.test(label))).toBe(true);
    let observation: THREE.Object3D | undefined;
    sim.state.scene.traverse(object => { if (object.userData.xrScopeViewObservation) observation = object; });
    const pupilColours = () => {
      const colours: string[] = [];
      observation!.traverse(object => { if (object instanceof THREE.Mesh && object.userData.eye) colours.push((object.material as THREE.MeshBasicMaterial).color.getHexString()); });
      return colours;
    };
    expect(observation?.visible).toBe(true);
    expect(pupilColours()).toEqual(["080b0b", "080b0b"]);
    expect(sim.mirror().status).toContain("Ask the patient to look at the light");
    expect(sim.mirror().ready).toBe(false);
    // Light and small spot alone do not cover both pupils at this distance.
    await sim.event(0, "selectstart"); await sim.step(1 / 72, 12);
    expect(pupilColours()).toEqual(["080b0b", "080b0b"]);
    await sim.cycleAperture(1); await sim.step(1 / 72, 12);
    expect(pupilColours()).toEqual([brucknerReflexVisual("od", "od").color.slice(1), brucknerReflexVisual("od", "os").color.slice(1)]);
    expect(sim.mirror().ready).toBe(false); // No fixation instruction yet.
    // Both pupils are illuminated at 70 cm, but the taught working zone still gates credit.
    await sim.at(0, [0, 1.33, .159]);
    await sim.action("LOOK AT THE LIGHT"); await sim.step(1 / 72, 12);
    expect(sim.labels().some(label => /^3 · WORKING DISTANCE \d+ CM · TARGET 90–110 CM$/.test(label))).toBe(true);
    expect(observation?.visible).toBe(true);
    expect(pupilColours()).toEqual([brucknerReflexVisual("od", "od").color.slice(1), brucknerReflexVisual("od", "os").color.slice(1)]);
    expect(sim.mirror().status).toContain("move the light to 90–110 cm");
    expect(sim.mirror().ready).toBe(false); expect(sim.complete).not.toHaveBeenCalled();
    await sim.at(0, [0, 1.33, .459]); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready).toBe(true);
    await sim.event(0, "selectend"); await sim.step(1 / 72, 12);
    expect(observation?.visible).toBe(true); expect(pupilColours()).toEqual(["080b0b", "080b0b"]);
    expect(sim.labels()).toContain("4 · BOTH PUPILS ILLUMINATED ✓");
    expect(sim.mirror().status).toContain("Both reflexes inspected");
    expect(sim.labels()).not.toContain("B/Y · CLOSE SCOPE");
    expect(sim.record).not.toHaveBeenCalled();
  });
  it.each(["equal", "od", "os"] as const)("Bruckner scope mode shows both authored reflexes for %s, without headset alignment or automatic credit", async scenario => {
    const sim = await lesson("bruckner", false, scenario);
    await sim.pickup(0, "fundus"); await sim.at(0, [0, 1.33, .459]);
    await sim.click(1, sim.button("LOOK AT THE LIGHT"));
    await sim.cycleAperture(1); await sim.event(0, "selectstart"); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready).toBe(false);
    await sim.scope(1); expect(sim.mirror().ready).toBe(false); // Empty hand cannot open the scope.
    await sim.scope(0); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready).toBe(true);
    let overlay: THREE.Object3D | undefined, observation: THREE.Object3D | undefined;
    sim.state.scene.traverse(object => {
      if (object.userData.xrScopeView) overlay = object;
      if (object.userData.xrScopeViewObservation) observation = object;
    });
    expect(overlay?.visible).toBe(true); expect(observation?.visible).toBe(true);
    expect(overlay?.userData.xrIgnoreRay).toBe(true);
    let canonicalEyes: THREE.Object3D | undefined;
    observation!.traverse(object => { if (object.userData.xrCanonicalBrucknerEyes) canonicalEyes = object; });
    expect(canonicalEyes).toBeDefined();
    const pupils: THREE.Mesh[] = [];
    observation!.traverse(object => { if (object instanceof THREE.Mesh && object.userData.eye) pupils.push(object); });
    expect(pupils).toHaveLength(2);
    for (const pupil of pupils) {
      const reflex = brucknerReflexVisual(scenario, pupil.userData.eye);
      expect((pupil.material as THREE.MeshBasicMaterial).color.getHexString()).toBe(reflex.color.slice(1));
      expect((pupil.material as THREE.MeshBasicMaterial).opacity).toBe(reflex.opacity);
      expect(pupil.renderOrder).toBeGreaterThan(pupil.parent!.children[0].renderOrder);
    }
    expect(sim.labels()).toContain("OD · RIGHT"); expect(sim.labels()).toContain("OS · LEFT");
    expect(sim.labels()).not.toContain("ASSISTED EYEPIECE VIEW");
    expect(sim.complete).not.toHaveBeenCalled(); expect(sim.record).not.toHaveBeenCalled();
    // Head pose moves the window, never gates the patient's optical observation.
    sim.viewerCamera.position.set(1.4, 1.8, 2); sim.viewerCamera.rotation.y = .7;
    await sim.step(1 / 72, 12); expect(observation?.visible).toBe(true);
    const expected = sim.viewerCamera.position.clone().add(new THREE.Vector3(0, 0, -.68).applyQuaternion(sim.viewerCamera.quaternion));
    expect(overlay!.position.distanceTo(expected)).toBeLessThan(1e-8);
    await sim.scope(0); await sim.step(); expect(sim.mirror().ready).toBe(true); // Completed inspection retained.
    await sim.event(0, "selectend"); await sim.putDown(0);
    await sim.click(1, sim.button(scenario === "equal" ? "EQUAL REFLEXES" : `${scenario.toUpperCase()} BRIGHTER`));
    await sim.click(1, sim.button("SUBMIT / CHECK")); expect(sim.complete).toHaveBeenCalledTimes(1);
    expect(sim.encounter().results).toHaveLength(0);
  });
  it("Bruckner starts the next finding with the existing held tool and can capture and submit again", async () => {
    const sim = await lesson("bruckner", true);
    await sim.pickup(0, "fundus"); sim.viewerCamera.position.set(0, 1.5, .56); await sim.at(0, [0, 1.33, .459]);
    await sim.click(1, sim.button("LOOK AT THE LIGHT")); await sim.cycleAperture(1);
    await sim.event(0, "selectstart"); await sim.scope(0); await sim.step(1 / 72, 12);
    await sim.click(1, sim.button("OD BRIGHTER")); await sim.click(1, sim.button("SUBMIT / CHECK"));
    expect(sim.complete).toHaveBeenCalledTimes(1);
    const heldPose = sim.tool("fundus").getWorldPosition(new THREE.Vector3());
    // The result HUD must win the ray hit over the still-open findings board,
    // even while this controller continues to hold the scope.
    await sim.event(0, "selectend");
    await sim.click(0, sim.button("TRY NEW CASE")); await sim.rerender(); await sim.step(1 / 72, 12);
    expect(sim.tool("fundus").userData.xrIgnoreRay).toBe(true);
    expect(sim.tool("fundus").getWorldPosition(new THREE.Vector3()).distanceTo(heldPose)).toBeLessThan(1e-8);
    expect(sim.tool("fundus").getObjectByProperty("type", "SpotLight")).toBeUndefined();
    expect(sim.next).toHaveBeenCalledTimes(1); expect(sim.mirror().lesson.entries).toEqual({});
    expect(sim.controls().some(control => control.userData.xrLabel === "OS BRIGHTER")).toBe(false);
    await sim.click(1, sim.button("SUBMIT / CHECK")); expect(sim.labels()).toContain("NOT READY YET");
    expect(sim.complete).toHaveBeenCalledTimes(1);
    await sim.click(1, sim.button("LOOK AT THE LIGHT"));
    await sim.event(0, "selectstart");
    await sim.step(1 / 72, 12); expect(sim.mirror().ready).toBe(true);
    await sim.click(1, sim.button("OS BRIGHTER")); await sim.click(1, sim.button("SUBMIT / CHECK"));
    expect(sim.complete).toHaveBeenCalledTimes(2); expect(sim.labels()).toContain("CORRECT");
    expect(sim.encounter().results).toHaveLength(0);
  });
  it("Bruckner requires its own instrument, broad spot, actual distance and explicit scope view, then records only Practice", async () => {
    const sim = await lesson("bruckner");
    expect(sim.labels()).not.toContain("The reflex from OD appears brighter. Record OD as the brighter reflex and investigate possible causes.");
    await sim.pickup(0, "fundus");
    sim.rays[0].rotation.set(0, 0, 0); sim.viewerCamera.position.set(0, 1.5, .56);
    await sim.at(0, [0, 1.33, .459]);
    await sim.click(1, sim.button("LOOK AT THE LIGHT"));
    await sim.event(0, "selectstart"); await sim.scope(0); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready).toBe(false);
    expect(sim.controls().some(control => control.userData.xrLabel === "SELECT LARGE SPOT" || control.userData.xrLabel === "LARGE SPOT ✓")).toBe(false);
    expect(sim.mirror().actions).toHaveLength(1);
    // Aperture selection cannot substitute for physically finding the working distance.
    await sim.at(0, [0, 1.33, -.04]);
    await sim.cycleAperture(1);
    await sim.step(1 / 72, 12); expect(sim.mirror().ready).toBe(false);
    await sim.at(0, [0, 1.33, .459]);
    await sim.step(1 / 72, 12); expect(sim.mirror().ready).toBe(true);
    expect((sim.tool("fundus").getObjectByProperty("type", "SpotLight") as THREE.SpotLight).angle).toBeCloseTo(.16);
    let field: THREE.Object3D | undefined;
    sim.state.scene.traverse(object => { if (object.userData.xrBrucknerField) field = object; });
    expect(field?.visible).toBe(true);

    await sim.click(1, sim.button("EQUAL REFLEXES")); await sim.click(1, sim.button("SUBMIT / CHECK"));
    expect(sim.complete).not.toHaveBeenCalled();
    await sim.click(1, sim.button("OD BRIGHTER")); await sim.click(1, sim.button("SUBMIT / CHECK"));
    expect(sim.complete).toHaveBeenCalledTimes(1);
    sim.mirror().record(); expect(sim.complete).toHaveBeenCalledTimes(1);
    expect(sim.record).not.toHaveBeenCalled(); expect(sim.encounter().results).toHaveLength(0);
    await sim.click(1, sim.button("NEW PATIENT FINDING")); expect(sim.next).toHaveBeenCalledTimes(1);
    await sim.change(); expect(sim.mirror().ready).toBe(false); expect(sim.mirror().lesson.entries).toEqual({});
    expect(sim.tool("fundus").getObjectByProperty("type", "SpotLight")).toBeDefined();
  });
  it("Bruckner retains inspection while recording at the wall, but changing aperture or cancelling clears it", async () => {
    const sim = await lesson("bruckner");
    await sim.pickup(0, "fundus"); sim.viewerCamera.position.set(0, 1.5, .56); await sim.at(0, [0, 1.33, .459]);
    await sim.click(1, sim.button("LOOK AT THE LIGHT")); await sim.cycleAperture(1);
    await sim.event(0, "selectstart"); await sim.scope(0); await sim.step(1 / 72, 12);
    await sim.click(1, sim.button("OD BRIGHTER"));
    await sim.cycleAperture(1);
    expect(sim.mirror().ready).toBe(false); expect(sim.mirror().lesson.entries).toEqual({});
    await sim.click(1, sim.button("SUBMIT / CHECK")); expect(sim.complete).not.toHaveBeenCalled();
    await sim.cycleAperture(1); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready).toBe(true);
    sim.viewerCamera.rotation.y = -.45; await sim.event(0, "selectend");
    await sim.putDown(0); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready).toBe(true);
    await sim.click(1, sim.button("OD BRIGHTER")); expect(sim.mirror().lesson.entries.brightness).toBe("od");
    await sim.click(1, sim.button("CANCEL")); expect(sim.mirror().ready).toBe(false);
    expect(sim.mirror().lesson.entries).toEqual({}); expect(sim.complete).not.toHaveBeenCalled();
    await sim.click(1, sim.button("SUBMIT / CHECK")); expect(sim.complete).not.toHaveBeenCalled();
    expect(sim.mirror().lesson.feedback).toContain("Before submitting");
    await sim.exit(); sim.mirror().record(); expect(sim.complete).not.toHaveBeenCalled();
  });
  it("motility follows the held penlight, requires nine dwells and symptoms, and records an explicit observation", async () => {
    const sim = await lesson("motility");
    const guideRings: THREE.Object3D[] = [];
    sim.state.scene.traverse(object => { if (object.userData.xrMotilityGuideRing) guideRings.push(object); });
    expect(guideRings).toHaveLength(gazePositions.length);
    expect(guideRings.every(ring => ring.scale.x === .038 && ring.scale.y === .027)).toBe(true);
    expect(sim.labels()).not.toContain("○ Up");
    expect(sim.labels()).toContain("FOLLOW LIGHT · HEAD STILL");
    expect(sim.labels()).toContain("ASK ABOUT SYMPTOMS");
    expect(sim.labels()).toContain("HIDE GAZE GUIDE");
    expect(sim.labels()).toContain("RESET");
    expect(sim.labels()).not.toContain("RECENTER");
    expect(sim.labels()).not.toContain("PROCEDURE CONTROLS");
    await sim.pickup(0, "pupils");
    await sim.click(1, sim.button("FOLLOW LIGHT · HEAD STILL"));
    await sim.panel(0); // Motility keeps A/X out of panel mode; the held trigger remains the light.
    await sim.event(0, "selectstart");
    await sim.at(0, [0, 1.5, -.086]); await sim.step(1 / 72, 15);
    expect(sim.labels().some(label => /% · Centre/.test(label))).toBe(false);
    const progressGuides: THREE.Object3D[] = [];
    sim.state.scene.traverse(object => { if (object.userData.xrMotilityGuideProgress) progressGuides.push(object); });
    expect(progressGuides).toHaveLength(1);
    expect(progressGuides[0].scale.x).toBe(.038); expect(progressGuides[0].scale.y).toBe(.027);
    await sim.completeMotilityRoute();
    await sim.event(0, "selectend");
    expect(sim.mirror().ready).toBe(false);
    expect(sim.eyes("consultationGaze").every(eye => eye.position.x > 0)).toBe(true);
    await sim.click(1, sim.button("ASK ABOUT SYMPTOMS"));
    expect(sim.mirror().ready).toBe(true);
    expect(sim.mirror().status).toContain("choose the movement observation and submit");
    await sim.click(1, sim.button("FROM · FULL, SMOOTH AND ACCURATE OU"));
    await sim.click(1, sim.button("SUBMIT / CHECK")); expect(sim.complete).toHaveBeenCalledTimes(1);
    expect(sim.mirror().lesson.feedback).toContain("Full movements");
    expect(sim.record).not.toHaveBeenCalled();
    const eyeObjects = sim.eyes("consultationGaze");
    await sim.exit();
    expect(eyeObjects.every(eye => eye.position.length() === 0)).toBe(true);
    expect(sim.mirror().lesson.entries).toEqual({});
  });
  it("motility renders, reports, grades, and advances the shared abnormal scenario bank", async () => {
    const sim = await lesson("motility", true, "od", "od-abduction");
    expect(sim.mirror().findingPosition).toEqual({ current: 2, total: 5 });
    await sim.pickup(0, "pupils");
    await sim.click(1, sim.button("FOLLOW LIGHT · HEAD STILL"));
    await sim.event(0, "selectstart");
    await sim.completeMotilityRoute();
    await sim.at(0, [-.8 * .35 * .65, 1.5, -.086]); await sim.step(1 / 72, 12);
    const od = sim.eyes("consultationGaze").find(eye => eye.userData.consultationGaze === "OD")!;
    const os = sim.eyes("consultationGaze").find(eye => eye.userData.consultationGaze === "OS")!;
    expect(Math.abs(od.position.x)).toBeLessThan(Math.abs(os.position.x) / 2);
    await sim.event(0, "selectend");
    await sim.click(1, sim.button("ASK ABOUT SYMPTOMS"));
    expect(sim.mirror().reportLines).toEqual([motilityScenarios[1].patientReply]);
    expect(sim.mirror().status).toContain("two images when I look to my right");
    await sim.click(1, sim.button("FROM · FULL, SMOOTH AND ACCURATE OU"));
    await sim.click(1, sim.button("SUBMIT / CHECK"));
    expect(sim.complete).not.toHaveBeenCalled();
    expect(sim.mirror().lesson.feedback).toContain("does not match");
    await sim.click(1, sim.button("OD ABDUCTION RESTRICTED IN RIGHT GAZE"));
    await sim.click(1, sim.button("SUBMIT / CHECK"));
    expect(sim.complete).toHaveBeenCalledTimes(1);
    expect(sim.mirror().lesson.feedback).toContain("OD did not abduct fully");
    await sim.click(1, sim.button("NEW PATIENT FINDING"));
    await sim.rerender(); await sim.step(1 / 72, 12);
    expect(sim.mirror().findingPosition).toEqual({ current: 3, total: 5 });
    expect(sim.mirror().ready).toBe(false);
    expect(sim.mirror().lesson.entries).toEqual({});
  });
  it("motility tracking loss cannot complete an unfinished gaze dwell", async () => {
    const sim = await lesson("motility"); await sim.pickup(0, "pupils");
    await sim.click(1, sim.button("FOLLOW LIGHT · HEAD STILL")); await sim.at(0, [0, 1.5, -.086]);
    await sim.event(0, "selectstart"); await sim.step(1 / 72, 20);
    sim.tracked[0] = false; await sim.step(1 / 72, 30); sim.tracked[0] = true;
    await sim.event(0, "selectend"); await sim.event(0, "selectstart"); await sim.step(1 / 72, 20);
    expect(sim.mirror().status).toContain("0/9"); sim.mirror().record(); expect(sim.complete).not.toHaveBeenCalled();
  });
  it("motility rejects an abrupt route break, preserves completed points and recovers at the last point", async () => {
    const sim = await lesson("motility"); await sim.pickup(0, "pupils");
    await sim.click(1, sim.button("FOLLOW LIGHT · HEAD STILL")); await sim.event(0, "selectstart");
    await sim.at(0, [0, 1.5, -.086]); await sim.step(1 / 72, 54);
    expect(sim.mirror().status).toContain("1/9");
    await sim.at(0, [.8 * .35 * .65, 1.5 + .7 * .35 * .45, -.086]); await sim.step(1 / 72, 8);
    expect(sim.mirror().status).toContain("1/9");
    expect(sim.mirror().status).toContain("Move the target more slowly");
    await sim.at(0, [0, 1.5, -.086]); await sim.step(1 / 72, 24);
    expect(sim.mirror().status).toContain("1/9");
    expect(sim.mirror().status).not.toContain("return to the last confirmed point");
    expect(sim.complete).not.toHaveBeenCalled();
  });
  it("cover–uncover gates manual target setup, order/entry, authored motion, and separate distance/near findings", async () => {
    const sim = await lesson("cover-uncover");
    expect(sim.labels()).not.toContain("NEAR CARD · RELEASE HERE");
    let nearCardPresent = false;
    sim.state.scene.traverse(object => { if (object.userData.consultationToolId === "near") nearCardPresent = true; });
    expect(nearCardPresent).toBe(false);
    expect(sim.tool("worth").userData.consultationToolId).toBe("worth");
    expect(sim.tool("worth").position.toArray()).toEqual(consultationToolDefinition("worth").home);
    expect(sim.mirror().status).toContain("Pick up the target");
    expect(sim.labels()).toContain("Target");
    expect(sim.labels()).not.toContain("Worth four-dot target");
    expect(sim.controls().some(control => control.userData.xrLabel === "TARGET POWER OFF")).toBe(true);
    let noseFittingGuide = false;
    const correctionSocket = requiredSensorySocket("sensory-correction");
    sim.state.scene.traverse(object => {
      if (object.userData.xrInstructionalHighlight
        && object.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(...correctionSocket.position)) < 1e-6) noseFittingGuide = true;
    });
    expect(noseFittingGuide).toBe(false);
    await sim.prepareDistanceTarget();
    expect(sim.tool("worth").position.toArray()).toEqual(COVER_DISTANCE_SOCKET.position);
    expect(sim.mirror().status).toContain("mirrored distance");
    await sim.pickup(1, "cover");
    await sim.click(0, sim.button("LOOK AT THE DISTANCE TARGET"));
    await sim.coverAt("OS"); expect(sim.mirror().entryReady).toBe(false);
    await sim.coverSequence(); expect(sim.mirror().ready).toBe(true);
    sim.tracked[1] = false; await sim.step(1 / 72, 12);
    expect(sim.mirror().ready).toBe(true);
    sim.tracked[1] = true; await sim.step(1 / 72, 12);
    await sim.putDown(1); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready).toBe(true);
    await sim.click(0, sim.button("ORTHOPHORIA")); await sim.click(0, sim.button("SUBMIT / CHECK"));
    expect(sim.complete).not.toHaveBeenCalled();
    expect(sim.mirror().reportLines).toEqual(["Distance: Orthophoria"]);
    expect(sim.mirror().status).toContain("40 cm near stand");
    await sim.pickup(0, "worth"); await sim.at(0, COVER_NEAR_SOCKET.position); await sim.putDown(0); await sim.step(1 / 72, 12);
    await sim.pickup(1, "cover"); await sim.click(0, sim.button("LOOK AT THE NEAR TARGET")); await sim.coverSequence();
    await sim.putDown(1); await sim.click(0, sim.button("ORTHOPHORIA")); await sim.click(0, sim.button("SUBMIT / CHECK"));
    expect(sim.complete).toHaveBeenCalledTimes(1); expect(sim.record).not.toHaveBeenCalled();
    expect(sim.mirror().reportLines).toEqual(["Distance: Orthophoria", "Near 40 cm: Orthophoria"]);
    await sim.click(0, sim.button("NEW PATIENT FINDING"));
    await sim.putDown(1); await sim.prepareDistanceTarget(); await sim.pickup(1, "cover"); await sim.click(0, sim.button("LOOK AT THE DISTANCE TARGET"));
    const os = sim.eyes("consultationGaze").find(eye => eye.userData.consultationGaze === "OS")!;
    const od = sim.eyes("consultationGaze").find(eye => eye.userData.consultationGaze === "OD")!;
    // Left esotropia is manifest before covering: OS rests turned in (nasal is -x for OS).
    const turnedIn = coverTeachingIrisOffset("OS", { h: -20, v: 0 })[0];
    expect(os.position.x).toBeCloseTo(turnedIn, 4);
    expect(od.position.x).toBeCloseTo(0, 5);
    await sim.coverAt("OD");
    // OS takes up fixation and holds it while OD stays covered (not a returning twitch).
    expect(Math.abs(os.position.x)).toBeLessThan(1e-4);
    await sim.step(1 / 72, 72);
    expect(Math.abs(os.position.x)).toBeLessThan(1e-4);
    await sim.coverAt("away");
    expect(os.position.x).toBeCloseTo(turnedIn, 4);
    await sim.coverAt("OS"); expect(od.position.x).toBeCloseTo(0, 5);
    await sim.coverAt("away");
    await sim.click(0, sim.button("LEFT UNILATERAL ESOTROPIA")); await sim.click(0, sim.button("SUBMIT / CHECK"));
    expect(sim.complete).toHaveBeenCalledTimes(1);
    await sim.pickup(0, "worth"); await sim.at(0, COVER_NEAR_SOCKET.position); await sim.putDown(0); await sim.step(1 / 72, 12);
    await sim.click(0, sim.button("LOOK AT THE NEAR TARGET")); await sim.coverSequence();
    await sim.putDown(1); await sim.click(0, sim.button("LEFT UNILATERAL ESOTROPIA")); await sim.click(0, sim.button("SUBMIT / CHECK"));
    expect(sim.complete).toHaveBeenCalledTimes(2);
  });
  it("advances the Guided cover–uncover coach from pickup through ordered recording", async () => {
    const sim = await lesson("cover-uncover", false, "od", "full", "guided");
    expect(sim.labels()).toContain("GUIDED · STEP 1 OF 13");
    expect(sim.labels()).toContain("Pick up the target");
    await sim.pickup(0, "worth");
    expect(sim.labels()).toContain("GUIDED · STEP 2 OF 13");
    expect(sim.labels()).toContain("Place the distance target");
    await sim.at(0, COVER_DISTANCE_SOCKET.position); await sim.putDown(0); await sim.step(1 / 72, 12);
    expect(sim.labels()).toContain("GUIDED · STEP 3 OF 13");
    expect(sim.labels()).toContain("Turn on the target");
    await sim.powerTarget();
    expect(sim.labels()).toContain("GUIDED · STEP 4 OF 13");
    await sim.click(0, sim.button("LOOK AT THE DISTANCE TARGET"));
    expect(sim.labels()).toContain("GUIDED · STEP 5 OF 13");
    expect(sim.labels()).toContain("Pick up the occluder");
    await sim.pickup(1, "cover");
    expect(sim.labels()).toContain("GUIDED · STEP 6 OF 13");
    expect(sim.labels()).toContain("Move 1 of 4: Cover OD · watch OS");
    await sim.step(1 / 72, 12);
    const rings = () => { const found: string[] = [];
      sim.state.scene.traverse(object => { if (object.userData.coverGuideRing) found.push(`cover-${object.userData.coverGuideRing}`); if (object.userData.coverGuideAway) found.push(`away-${object.userData.coverGuideAway}`); });
      return found; };
    expect(rings()).toEqual(["cover-OD"]);
    let guideText = false;
    sim.state.scene.traverse(object => { if (object.userData.xrCoverGuide) object.traverse(child => { if (child !== object && child.type === "Mesh" && (child as THREE.Mesh).geometry.type !== "RingGeometry") guideText = true; }); });
    expect(guideText).toBe(true);
    expect(sim.labels()).toContain("MOVE PADDLE");
    await sim.coverAt("OD");
    expect(rings()).toEqual(["away-OD"]);
    await sim.coverAt("away");
    expect(rings()).toEqual(["cover-OS"]);
    await sim.coverAt("OS"); await sim.coverAt("away");
    expect(rings()).toEqual([]);
    expect(sim.labels()).toContain("GUIDED · STEP 7 OF 13");
    expect(sim.labels()).toContain("Classify the distance timing");
    await sim.click(0, sim.button("ORTHOPHORIA"));
    expect(sim.labels()).toContain("GUIDED · STEP 8 OF 13");
    await sim.click(0, sim.button("SUBMIT / CHECK"));
    expect(sim.complete).not.toHaveBeenCalled();
    expect(sim.labels()).toContain("GUIDED · STEP 9 OF 13");
    expect(sim.labels()).toContain("Move the target to near");
    await sim.pickup(0, "worth"); await sim.at(0, COVER_NEAR_SOCKET.position); await sim.putDown(0); await sim.step(1 / 72, 12);
    expect(sim.labels()).toContain("GUIDED · STEP 10 OF 13");
    expect(sim.labels()).toContain("Re-establish near fixation");
    await sim.click(0, sim.button("LOOK AT THE NEAR TARGET"));
    expect(sim.labels()).toContain("GUIDED · STEP 11 OF 13");
    await sim.coverSequence();
    expect(sim.labels()).toContain("GUIDED · STEP 12 OF 13");
    expect(sim.labels()).toContain("Classify the near timing");
    await sim.click(0, sim.button("ORTHOPHORIA"));
    expect(sim.labels()).toContain("GUIDED · STEP 13 OF 13");
    await sim.click(0, sim.button("SUBMIT / CHECK"));
    expect(sim.complete).toHaveBeenCalledTimes(1);
    expect(sim.labels()).toContain("GUIDED · COMPLETE");
  });
  it("advances the Guided alternating-cover coach through prism neutralisation", async () => {
    const sim = await lesson("alternate-cover", false, "od", "full", "guided");
    expect(sim.labels()).toContain("GUIDED · STEP 1 OF 16");
    expect(sim.labels()).toContain("Pick up the target");
    await sim.pickup(0, "worth");
    expect(sim.labels()).toContain("GUIDED · STEP 2 OF 16");
    await sim.at(0, COVER_DISTANCE_SOCKET.position); await sim.putDown(0); await sim.step(1 / 72, 12);
    expect(sim.labels()).toContain("GUIDED · STEP 3 OF 16");
    await sim.powerTarget();
    expect(sim.labels()).toContain("GUIDED · STEP 4 OF 16");
    await sim.click(0, sim.button("LOOK AT THE DISTANCE TARGET"));
    expect(sim.labels()).toContain("GUIDED · STEP 5 OF 16");
    let paddleGuideVisible = false;
    sim.state.scene.traverse(object => { if (object.userData.xrPaddlePlacementGuide) paddleGuideVisible = true; });
    expect(paddleGuideVisible).toBe(true);
    expect(sim.labels()).toContain("MOVE PADDLE");
    await sim.pickup(1, "cover");
    expect(sim.labels()).toContain("GUIDED · STEP 6 OF 16");
    await sim.coverSequence();
    expect(sim.labels()).toContain("GUIDED · STEP 7 OF 16");
    expect(sim.labels()).toContain("Pick up the prism bar");
    expect(sim.labels().join(" ")).toContain("OD moved inward on uncovering: an exodeviation.");
    expect(sim.labels()).toContain("Prism bar");
    expect(sim.labels()).not.toContain("0Δ · choose base");
    expect(sim.tool("prism").visible).toBe(true);
    expect(sim.tool("prism").position.toArray()).toEqual(consultationToolDefinition("prism").home);
    await sim.pickup(0, "prism");
    const prismGuideRings: THREE.Object3D[] = [];
    sim.state.scene.traverse(object => { if (object.userData.xrPrismGuideRing) prismGuideRings.push(object); });
    expect(prismGuideRings).toHaveLength(2);
    expect(sim.labels()).toContain("PLACE PRISM");
    expect(sim.labels()).toContain("Place the prism");
    expect(sim.mirror().status).toContain("eye placement ring");
    await sim.at(0, [.048, 1.357, -.481]); await sim.step(1 / 72, 12);
    expect(sim.labels()).toContain("Choose prism base and power");
    expect(sim.labels().join(" ")).toContain("Thumbstick left/right changes base; up/down changes power.");
    let workingRing: THREE.Object3D | undefined;
    sim.tool("prism").traverse(object => { if (object.userData.xrPrismWorkingCell) workingRing = object; });
    expect(workingRing?.position.y).toBe(PRISM_BAR_WORKING_Y);
    sim.axes[0][2] = -.8; await sim.step(); sim.axes[0][2] = 0; await sim.step();
    for (let i = 0; i < 4; i++) await sim.thumbstick(0, 1);
    expect(sim.mirror().status).toContain("prism 8Δ base-in");
    expect(sim.labels()).toContain("← BASE IN · BI");
    expect(workingRing?.position.y).toBe(PRISM_BAR_WORKING_Y);
    expect(sim.labels()).toContain("GUIDED · STEP 8 OF 16");
    expect(sim.labels()).toContain("Attempt 1 of 2");
    expect(sim.labels()).not.toContain("ATTEMPT 1 OF 2");
    expect(sim.mirror().status).toContain("ATTEMPT 1 OF 2");
    expect(sim.labels().join(" ")).toContain("Move the paddle next");
    let coverGuideVisible = false;
    sim.state.scene.traverse(object => { if (object.userData.xrCoverGuide) coverGuideVisible = true; });
    expect(coverGuideVisible).toBe(true);
    let prismGuideVisible = false;
    sim.state.scene.traverse(object => { if (object.userData.xrPrismPlacementGuide) prismGuideVisible = true; });
    expect(prismGuideVisible).toBe(false);
    expect(sim.controls().some(control => control.userData.xrLabel === "REPEAT WITH PRISM")).toBe(false);
    await sim.coverAt("OD"); await sim.coverAt("OS");
    expect(sim.labels()).toContain("Attempt 2 of 2");
    expect(sim.labels()).not.toContain("ATTEMPT 2 OF 2");
    expect(sim.mirror().status).toContain("ATTEMPT 2 OF 2");
    await sim.coverAt("OD"); await sim.coverAt("OS");
    expect(sim.labels()).toContain("Stop and adjust the prism");
    expect(sim.labels().join(" ")).toContain("Increase prism power");
    expect(sim.labels()).not.toContain("MOVE PADDLE");
    await sim.coverSequence();
    expect(sim.mirror().status).toContain("STOP · Inward movement remains at 8Δ base in");
    expect(sim.labels()).not.toContain("MOVE PADDLE");
    await sim.thumbstick(0, 1); await sim.thumbstick(0, 1);
    expect(sim.labels()).toContain("MOVE PADDLE");
    await sim.coverSequence();
    expect(sim.labels()).toContain("GUIDED · STEP 9 OF 16");
    expect(sim.labels()).toContain("Classify the distance movement");
    expect(sim.mirror().ready).toBe(true);
    await sim.panel(1); await sim.click(1, sim.button("RECORD FINDING"));
    await sim.click(1, sim.button("IN")); await sim.click(1, sim.button("EXO"));
    expect(sim.labels()).toContain("GUIDED · STEP 10 OF 16");
    await sim.click(1, sim.button("SUBMIT / CHECK"));
    expect(sim.complete).not.toHaveBeenCalled();
    expect(sim.mirror().reportLines).toEqual(["Distance: 12Δ base in before OS"]);
    expect(sim.labels()).toContain("GUIDED · STEP 11 OF 16");
    await sim.putDown(0); await sim.putDown(1); await sim.moveTargetNear();
    expect(sim.labels()).toContain("GUIDED · STEP 12 OF 16");
    await sim.click(1, sim.button("LOOK AT THE NEAR TARGET"));
    expect(sim.labels()).toContain("GUIDED · STEP 13 OF 16");
    await sim.pickup(1, "cover"); await sim.coverSequence();
    expect(sim.labels()).toContain("GUIDED · STEP 14 OF 16");
    await sim.pickup(0, "prism"); await sim.at(0, [.048, 1.357, -.481]);
    await sim.action("BASE IN"); for (let i = 0; i < 6; i++) await sim.action("POWER +2Δ");
    await sim.coverSequence();
    expect(sim.labels()).toContain("GUIDED · STEP 15 OF 16");
    await sim.panel(1); await sim.click(1, sim.button("RECORD FINDING"));
    await sim.click(1, sim.button("IN")); await sim.click(1, sim.button("EXO"));
    expect(sim.labels()).toContain("GUIDED · STEP 16 OF 16");
    await sim.click(1, sim.button("SUBMIT / CHECK"));
    expect(sim.complete).toHaveBeenCalledTimes(1);
    expect(sim.labels()).toContain("GUIDED · COMPLETE");
  });
  it.each(["cover-uncover", "alternate-cover"] as const)("does not show the %s coach during independent Test", async kind => {
    const sim = await lesson(kind, false, "od", "full", "test");
    expect(sim.labels().some(label => label.startsWith("GUIDED · STEP"))).toBe(false);
  });
  it("requires a real mirrored target and invalidates unfinished alternating-cover work when it moves", async () => {
    const sim = await lesson("alternate-cover");
    expect(sim.tool("worth").position.toArray()).toEqual(consultationToolDefinition("worth").home);
    expect(sim.mirror().status).toContain("Pick up the target");
    expect(sim.controls().some(control => control.userData.xrLabel === "LOOK AT THE DISTANCE TARGET")).toBe(false);
    await sim.prepareDistanceTarget(); await sim.pickup(1, "cover"); await sim.action("LOOK AT THE DISTANCE TARGET");
    await sim.coverSequence(); expect(sim.mirror().entryReady).toBe(true);
    await sim.pickup(0, "worth"); await sim.at(0, [0, 1.5, .1]); await sim.step(1 / 72, 12);
    expect(sim.mirror().entryReady).toBe(false);
    expect(sim.mirror().status).toContain("distance dock");
    await sim.at(0, COVER_DISTANCE_SOCKET.position); await sim.putDown(0); await sim.step(1 / 72, 12);
    expect(sim.mirror().entryReady).toBe(false);
    expect(sim.mirror().status).toContain("Ask the patient to fixate the mirrored distance target");
  });
  it("alternating cover requires actual prism alignment, correct neutralisation and two-hand panel recording", async () => {
    const sim = await lesson("alternate-cover"); await sim.prepareDistanceTarget();
    await sim.pickup(1, "cover"); await sim.action("LOOK AT THE DISTANCE TARGET");
    await sim.coverSequence(); expect(sim.mirror().entryReady).toBe(true); expect(sim.mirror().ready).toBe(false);
    await sim.pickup(0, "prism"); await sim.at(0, [.048, 1.357, -.481]);
    await sim.panel(1); await sim.click(1, sim.button("PRISM SETTINGS · ACCESSIBILITY"));
    await sim.click(1, sim.button("BASE OUT"));
    for (let i = 0; i < 6; i++) await sim.click(1, sim.button("POWER +2Δ"));
    await sim.click(1, sim.button("CLOSE SETTINGS")); await sim.panel(1); await sim.coverSequence();
    expect(sim.mirror().ready).toBe(false); expect(sim.mirror().status).toContain("Refixation remains");
    await sim.panel(1); await sim.click(1, sim.button("PRISM SETTINGS · ACCESSIBILITY")); await sim.click(1, sim.button("BASE IN"));
    await sim.click(1, sim.button("CLOSE SETTINGS")); await sim.panel(1); await sim.coverSequence();
    expect(sim.mirror().ready).toBe(true);
    await sim.panel(1); await sim.click(1, sim.button("RECORD FINDING"));
    expect(sim.mirror().ready).toBe(true);
    await sim.click(1, sim.button("IN")); await sim.click(1, sim.button("EXO")); await sim.click(1, sim.button("SUBMIT / CHECK"));
    expect(sim.complete).not.toHaveBeenCalled();
    expect(sim.mirror().reportLines).toEqual(["Distance: 12Δ base in before OS"]);
    await sim.putDown(0); await sim.putDown(1); await sim.moveTargetNear();
    await sim.pickup(1, "cover"); await sim.action("LOOK AT THE NEAR TARGET"); await sim.coverSequence();
    await sim.pickup(0, "prism"); await sim.at(0, [.048, 1.357, -.481]);
    await sim.action("BASE IN"); for (let i = 0; i < 6; i++) await sim.action("POWER +2Δ");
    await sim.coverSequence();
    expect(sim.mirror().ready, sim.mirror().status).toBe(true);
    await sim.panel(1); await sim.click(1, sim.button("RECORD FINDING"));
    await sim.click(1, sim.button("IN")); await sim.click(1, sim.button("EXO")); await sim.click(1, sim.button("SUBMIT / CHECK"));
    expect(sim.complete).toHaveBeenCalledTimes(1); expect(sim.mirror().lesson.feedback).toContain("Distance and near prism endpoints");
    expect(sim.mirror().reportLines).toEqual(["Distance: 12Δ base in before OS", "Near 40 cm: 12Δ base in before OS"]);
    expect(sim.record).not.toHaveBeenCalled(); sim.mirror().record(); expect(sim.complete).toHaveBeenCalledTimes(1);
  });
  it("records independent distance and near endpoints for all authored alternate-cover findings without Test credit", async () => {
    const sim = await lesson("alternate-cover");
    // Vertical cases are lateralised: R hypo is neutralised with base up before OD, R hyper with base up before OS.
    const cases = [["BASE IN", 12, "IN", "EXO", .048], ["BASE OUT", 18, "OUT", "ESO", .048], ["BASE UP", 8, "UP", "R HYPO / L HYPER", -.048], ["BASE UP", 10, "DOWN", "R HYPER / L HYPO", .048]] as const;
    for (const [caseIndex, [base, power, movement, deviation, prismX]] of cases.entries()) {
      await sim.prepareDistanceTarget();
      for (const endpoint of ["DISTANCE", "NEAR"] as const) {
        await sim.pickup(1, "cover"); await sim.action(`LOOK AT THE ${endpoint} TARGET`);
        await sim.coverSequence(); expect(sim.mirror().entryReady, `${endpoint}: ${sim.mirror().status}`).toBe(true);
        await sim.pickup(0, "prism"); await sim.at(0, [prismX, 1.357, -.481]);
        await sim.action(base); for (let i = 0; i < power / 2; i++) await sim.action("POWER +2Δ");
        await sim.coverSequence(); expect(sim.mirror().ready).toBe(true);
        await sim.panel(1); await sim.click(1, sim.button("RECORD FINDING"));
        await sim.click(1, sim.button(movement)); await sim.click(1, sim.button(deviation));
        await sim.click(1, sim.button("SUBMIT / CHECK"));
        if (endpoint === "DISTANCE") {
          expect(sim.complete).toHaveBeenCalledTimes(caseIndex);
          await sim.putDown(0); await sim.putDown(1); await sim.moveTargetNear();
        }
      }
      expect(sim.mirror().reportLines).toHaveLength(2);
      await sim.click(1, sim.button("NEW PATIENT FINDING"));
      await sim.putDown(0); await sim.putDown(1);
    }
    expect(sim.complete).toHaveBeenCalledTimes(4); expect(sim.record).not.toHaveBeenCalled();
    expect(sim.encounter().results).toHaveLength(0);
  }, 15_000);
  it("alternating cover holds the dissociated eye and stops movement with the eye behind the prism turned", async () => {
    const sim = await lesson("alternate-cover");
    const eye = (id: "OD" | "OS") => sim.eyes("consultationGaze").find(item => item.userData.consultationGaze === id)!;
    const temporal12 = coverTeachingIrisOffset("OS", { h: 12, v: 0 })[0];
    await sim.prepareDistanceTarget(); await sim.pickup(1, "cover"); await sim.action("LOOK AT THE DISTANCE TARGET");
    expect(eye("OS").position.x).toBeCloseTo(0, 5); // exophoria: straight while fusing
    await sim.coverSequence(); // ends covering OS
    expect(eye("OS").position.x).toBeCloseTo(temporal12, 4); // covered OS out by 12Δ
    expect(eye("OD").position.x).toBeCloseTo(0, 4); // uncovered OD fixates
    await sim.coverAt("OD");
    expect(eye("OS").position.x).toBeCloseTo(0, 4); // OS moved in by the full 12Δ and holds
    await sim.pickup(0, "prism"); await sim.at(0, [.048, 1.357, -.481]);
    await sim.action("BASE IN"); for (let i = 0; i < 6; i++) await sim.action("POWER +2Δ");
    for (const position of ["OD", "OS", "OD", "OS"] as const) {
      await sim.coverAt(position);
      expect(eye("OS").position.x).toBeCloseTo(temporal12, 4); // OS looks through the base-in prism, turned out
      expect(eye("OD").position.x).toBeCloseTo(0, 4); // no refixation movement in either eye
    }
    expect(sim.mirror().status).toContain("No refixation movement");
  });
  it("cancels without recording, resets the attempt, then records completed evidence after returning the occluder", async () => {
    const sim = await lesson("cover-uncover"); await sim.prepareDistanceTarget(); await sim.pickup(1, "cover"); await sim.click(0, sim.button("LOOK AT THE DISTANCE TARGET"));
    await sim.coverSequence(); await sim.click(0, sim.button("ORTHOPHORIA"));
    await sim.click(0, sim.button("CANCEL"));
    expect(sim.complete).not.toHaveBeenCalled(); expect(sim.mirror().lesson.entries).toEqual({});
    await act(async () => sim.mirror().reset()); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready).toBe(false); expect(sim.mirror().entryReady).toBe(false);
    expect(sim.tool("cover").position.toArray()).toEqual(consultationToolDefinition("cover").home);
    expect(sim.tool("worth").position.toArray()).toEqual(consultationToolDefinition("worth").home);
    expect(sim.controls().some(control => control.userData.xrLabel === "TARGET POWER OFF")).toBe(true);
    expect(sim.mirror().reportLines).toEqual([]);
    await sim.prepareDistanceTarget(); await sim.pickup(1, "cover"); await sim.click(0, sim.button("LOOK AT THE DISTANCE TARGET")); await sim.coverSequence();
    await sim.putDown(1); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready).toBe(true);
    await sim.click(0, sim.button("ORTHOPHORIA")); await sim.click(0, sim.button("SUBMIT / CHECK"));
    expect(sim.complete).not.toHaveBeenCalled();
    await sim.pickup(0, "worth"); await sim.at(0, COVER_NEAR_SOCKET.position); await sim.putDown(0); await sim.step(1 / 72, 12);
    await sim.pickup(1, "cover"); await sim.click(0, sim.button("LOOK AT THE NEAR TARGET")); await sim.coverSequence(); await sim.putDown(1);
    await sim.click(0, sim.button("ORTHOPHORIA")); await sim.click(0, sim.button("SUBMIT / CHECK"));
    expect(sim.complete).toHaveBeenCalledTimes(1);
  });
  it("alternating cover counts released-paddle exposure without erasing completed observations", async () => {
    const sim = await lesson("alternate-cover"); await sim.prepareDistanceTarget();
    await sim.pickup(1, "cover"); await sim.action("LOOK AT THE DISTANCE TARGET");
    await sim.coverAt("OD");
    expect(sim.mirror().status).toContain("Shift directly to OS");
    await sim.putDown(1); await sim.step(1 / 72, 20);
    await sim.pickup(1, "cover"); await sim.coverAt("OS");
    expect(sim.mirror().status).toContain("Shift directly to OD");
    // Short release retained OD, so this completes the original four steps.
    await sim.coverAt("OD"); await sim.coverAt("OS");
    expect(sim.mirror().entryReady).toBe(true);
    await sim.putDown(1); await sim.step(1 / 72, 100);
    expect(sim.mirror().entryReady).toBe(true);
    expect(sim.mirror().status).toContain("Sequence observed");
  });
  it("alternating cover restarts partial progress after a long release and cannot resume at OS", async () => {
    const sim = await lesson("alternate-cover"); await sim.prepareDistanceTarget();
    await sim.pickup(1, "cover"); await sim.action("LOOK AT THE DISTANCE TARGET");
    await sim.coverAt("OD"); expect(sim.mirror().status).toContain("Shift directly to OS");
    await sim.putDown(1); await sim.step(1 / 72, 100);
    expect(sim.mirror().status).toContain("uncovered too long");
    await sim.pickup(1, "cover"); await sim.coverAt("OS");
    expect(sim.mirror().status).toContain("Cover OD");
    expect(sim.mirror().entryReady).toBe(false);
    await sim.coverSequence(); expect(sim.mirror().entryReady).toBe(true);
  });
  it("alternating cover restarts unfinished steps after tracking loss but keeps completed observations", async () => {
    const sim = await lesson("alternate-cover"); await sim.prepareDistanceTarget();
    await sim.pickup(1, "cover"); await sim.action("LOOK AT THE DISTANCE TARGET");
    await sim.coverAt("OD"); expect(sim.mirror().status).toContain("Shift directly to OS");
    sim.tracked[1] = false; await sim.step(1 / 72, 12);
    sim.tracked[1] = true; await sim.coverAt("OS");
    expect(sim.mirror().status).toContain("Cover OD");
    expect(sim.mirror().entryReady).toBe(false);
    await sim.coverSequence(); expect(sim.mirror().entryReady).toBe(true);
    sim.tracked[1] = false; await sim.step(1 / 72, 12);
    sim.tracked[1] = true; await sim.step(1 / 72, 12);
    expect(sim.mirror().entryReady).toBe(true);
  });
  it("alternating cover loses dissociation after long exposure and cannot neutralise a prism away from the pupil", async () => {
    const sim = await lesson("alternate-cover"); await sim.prepareDistanceTarget(); await sim.pickup(1, "cover"); await sim.action("LOOK AT THE DISTANCE TARGET");
    await sim.coverAt("OD"); await sim.coverAt("away", 85);
    expect(sim.mirror().status).toContain("Cover OD"); expect(sim.mirror().entryReady).toBe(false);
    await sim.coverSequence(); await sim.pickup(0, "prism");
    await sim.action("BASE IN"); for (let i = 0; i < 6; i++) await sim.action("POWER +2Δ");
    await sim.coverSequence(); expect(sim.mirror().ready).toBe(false);
    await sim.at(0, [.048, 1.357, -.481]);
    await sim.coverAt("OD"); await sim.at(0, [.3, 1.357, -.481]); await sim.step(1 / 72, 12);
    await sim.at(0, [.048, 1.357, -.481]); await sim.coverAt("OS"); await sim.coverAt("OD"); await sim.coverAt("OS");
    expect(sim.mirror().ready).toBe(false);
    await sim.coverSequence(); expect(sim.mirror().ready).toBe(true);
    await sim.action("POWER +2Δ"); expect(sim.mirror().ready).toBe(false);
    await sim.exit(); sim.mirror().record(); expect(sim.complete).not.toHaveBeenCalled();
  });
});
