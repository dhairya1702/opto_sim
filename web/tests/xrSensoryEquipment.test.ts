import { describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import { CLINIC_EYE_MIDPOINT, CLINIC_PATIENT_EYES } from "../interaction/clinicPatient";
import {
  ALL_CLINIC_TOOLS, CONSULTATION_EQUIPMENT, consultationPickupHint, consultationToolDefinition,
  grabConsultationTool, initialConsultationTools, powerConsultationTool, releaseConsultationTool,
  resetConsultationHands, setConsultationToolPower, toolInHand,
  type ConsultationToolId, type ConsultationTools, type PlacementSocket,
} from "../interaction/xrConsultationTools";
import {
  SENSORY_DISTANCE_TARGET, SENSORY_MIRROR, SENSORY_NEAR_TARGET, SENSORY_SOCKETS, SENSORY_SURFACES,
  isPatientFitted, sensoryEquipment, sensoryFittingSignature, sensoryMirrorPath,
  sensoryNearCondition, sensorySockets, sensoryTargetCondition,
} from "../interaction/xrSensoryEquipment";
import { walkable } from "../interaction/navigation";

const socket = (id: string) => {
  const found = SENSORY_SOCKETS.find(candidate => candidate.id === id);
  if (!found) throw new Error(id);
  return found;
};
const place = (state: ConsultationTools, target: PlacementSocket) => releaseConsultationTool(
  grabConsultationTool(state, target.tool, "left"), "left", { position: target.position, rotation: target.rotation }, [], SENSORY_SOCKETS,
).state;
const poseOf = (state: ConsultationTools, id: ConsultationToolId) => {
  const placement = state[id].placement;
  if (placement.kind === "held") throw new Error("Expected resting instrument");
  const definition = consultationToolDefinition(id);
  const rotation = new Quaternion(...placement.rotation);
  return {
    position: new Vector3(...definition.workingPoint).applyQuaternion(rotation).add(new Vector3(...placement.position)).toArray() as [number, number, number],
    forward: new Vector3(...definition.forward).applyQuaternion(rotation).toArray() as [number, number, number],
  };
};

describe("sensory equipment and patient fitting", () => {
  it("keeps consultation selection and original homes separate from optional lesson instruments", () => {
    expect(CONSULTATION_EQUIPMENT).not.toContain("worth");
    expect(CONSULTATION_EQUIPMENT).not.toContain("stereo");
    expect(sensoryEquipment("worth")).toEqual(["subjective", "red-green", "worth"]);
    expect(sensoryEquipment("stereo")).toEqual(["subjective", "polarised", "stereo"]);
    expect(sensoryEquipment("four-prism")).toEqual(["subjective", "prism"]);
    expect(consultationToolDefinition("subjective").home).toEqual([-1.45, .9625, -1.08]);
    expect(sensorySockets("stereo").some(s => s.tool === "red-green")).toBe(false);
  });
  it("reserves distinct visible handle homes for all instruments and both-hand transfer", () => {
    for (const tool of ALL_CLINIC_TOOLS) {
      const state = grabConsultationTool(initialConsultationTools(), tool.id, "right");
      expect(releaseConsultationTool(state, "right", { position: tool.home, rotation: tool.restRotation }).returned, tool.id).toBe(false);
    }
    let state = grabConsultationTool(initialConsultationTools(), "worth", "left");
    state = grabConsultationTool(state, "worth", "right");
    expect(toolInHand(state, "left")).toBeNull();
    expect(toolInHand(state, "right")).toBe("worth");
    const hint = consultationPickupHint([1.04, .93, 1.18], ALL_CLINIC_TOOLS.map(tool => ({ id: tool.id, position: tool.home, visible: true })));
    expect(hint?.id).toBe("red-green");
    expect(hint?.reachable).toBe(true);
  });
  it("uses rotated sensory footprints at tray edges and ignores homes absent from the selected kit", () => {
    const held = grabConsultationTool(initialConsultationTools(), "stereo", "left");
    const forward = releaseConsultationTool(held, "left", { position: [1.69, 1, 1.04], rotation: [0, 0, 0, 1] }, SENSORY_SURFACES);
    expect(forward.returned).toBe(true);
    const rotated = releaseConsultationTool(held, "left", { position: [1.69, 1, 1.04], rotation: [0, Math.SQRT1_2, 0, Math.SQRT1_2] }, SENSORY_SURFACES);
    expect(rotated.returned).toBe(false);
    const pupilHome = consultationToolDefinition("pupils").home;
    const clearTrolley = [{ id: "lesson-trolley", x: -1.37, z: .75, y: .8775, width: .84, depth: .55 }];
    const worth = grabConsultationTool(initialConsultationTools(), "worth", "left");
    const selected = releaseConsultationTool(worth, "left", { position: pupilHome, rotation: [0, 0, 0, 1] }, clearTrolley, [], sensoryEquipment("worth"));
    expect(selected.returned).toBe(false);
    expect(selected.state.worth.placement.kind).toBe("surface");
  });
  it("seats correction and one compatible filter layer; allows removal and rejects two filter frames", () => {
    let state = place(initialConsultationTools(), socket("sensory-correction"));
    state = place(state, socket("sensory-red-green"));
    expect(isPatientFitted(state, "subjective")).toBe(true);
    expect(isPatientFitted(state, "red-green")).toBe(true);
    state = place(state, socket("sensory-polarised"));
    expect(isPatientFitted(state, "polarised")).toBe(false);
    const signature = sensoryFittingSignature(state, ["subjective", "red-green"]);
    state = grabConsultationTool(state, "red-green", "right");
    expect(isPatientFitted(state, "red-green")).toBe(false);
    state = place(releaseConsultationTool(state, "right").state, socket("sensory-red-green"));
    expect(isPatientFitted(state, "red-green")).toBe(true);
    expect(sensoryFittingSignature(state, ["subjective", "red-green"])).not.toBe(signature);
  });
  it("rejects backwards, remote, wrong tool and untagged imitations of a patient fit", () => {
    const target = socket("sensory-red-green");
    for (const position of [target.position, [.5, 1.5, -.482] as const]) {
      const state = grabConsultationTool(initialConsultationTools(), "red-green", "left");
      const result = releaseConsultationTool(state, "left", { position, rotation: [0, 1, 0, 0] }, [], SENSORY_SOCKETS);
      expect(isPatientFitted(result.state, "red-green")).toBe(false);
    }
    let state = initialConsultationTools();
    state = { ...state, "red-green": { ...state["red-green"], placement: { kind: "socket", position: target.position, rotation: target.rotation } } };
    expect(isPatientFitted(state, "red-green")).toBe(false);
    const fitted = place(initialConsultationTools(), target);
    const removed = grabConsultationTool(fitted, "red-green", "left");
    const remote = releaseConsultationTool(removed, "left", { position: [1, 2, 0], rotation: target.rotation }, [], SENSORY_SOCKETS);
    expect(isPatientFitted(remote.state, "red-green")).toBe(false);
    expect(remote.state["red-green"].placement).toMatchObject({ position: consultationToolDefinition("red-green").home });
    const wrong = releaseConsultationTool(grabConsultationTool(initialConsultationTools(), "polarised", "left"), "left", { position: target.position, rotation: target.rotation }, [], [target]);
    expect(isPatientFitted(wrong.state, "polarised")).toBe(false);
  });
  it("maps filter lens centres to canonical OD/OS and keeps fitted layers apart", () => {
    const redGreen = socket("sensory-red-green");
    const correction = socket("sensory-correction");
    expect(redGreen.position[0] - .048).toBe(CLINIC_PATIENT_EYES.OD[0]);
    expect(redGreen.position[0] + .048).toBe(CLINIC_PATIENT_EYES.OS[0]);
    expect(redGreen.position[1]).toBe(CLINIC_PATIENT_EYES.OD[1]);
    expect(redGreen.position[2] - correction.position[2]).toBeGreaterThan(.024);
  });
});

describe("sensory persistent illumination", () => {
  it("keeps Worth power through trigger edges, release, transfer and menu-style momentary shutoff", () => {
    let state = grabConsultationTool(initialConsultationTools(), "worth", "left");
    expect(powerConsultationTool(state, "left", true)).toBe(state);
    state = setConsultationToolPower(state, "worth", true);
    expect(powerConsultationTool(state, "left", false)).toBe(state);
    state = grabConsultationTool(state, "worth", "right");
    expect(state.worth.powered).toBe(true);
    state = releaseConsultationTool(state, "right").state;
    expect(state.worth.powered).toBe(true);
    state = setConsultationToolPower(state, "worth", false);
    expect(state.worth.powered).toBe(false);
  });
  it("preserves existing momentary lights and extinguishes resting Worth on exit/reset", () => {
    let state = setConsultationToolPower(initialConsultationTools(), "worth", true);
    state = powerConsultationTool(grabConsultationTool(state, "pupils", "left"), "left", true);
    expect(state.pupils.powered).toBe(true);
    state = releaseConsultationTool(state, "left").state;
    expect(state.pupils.powered).toBe(false);
    expect(resetConsultationHands(state).worth.powered).toBe(false);
    expect(initialConsultationTools().worth.powered).toBe(false);
  });
});

describe("physical near and mirrored distance endpoints", () => {
  it("samples working-point transforms at both supported stands", () => {
    for (const id of ["worth", "stereo"] as const) {
      const state = place(initialConsultationTools(), socket(`sensory-${id}-near`));
      const pose = poseOf(state, id);
      pose.position.forEach((value, index) => expect(value).toBeCloseTo(SENSORY_NEAR_TARGET[index], 12));
      expect(sensoryNearCondition(pose)).toMatchObject({ facing: true, ready: true });
      expect(sensoryNearCondition(pose).distanceCm).toBeCloseTo(40, 12);
      if (id === "worth") expect(sensoryTargetCondition(pose, state).endpoint).toBe("near");
    }
  });
  it("preserves exact 38/42 cm stereo boundaries, facing and spatial alignment", () => {
    for (const cm of [38, 40, 42]) expect(sensoryNearCondition({ position: [0, 1.5, CLINIC_EYE_MIDPOINT[2] + cm / 100], forward: [0, 0, -1] }).ready).toBe(true);
    for (const cm of [37.99, 42.01]) expect(sensoryNearCondition({ position: [0, 1.5, CLINIC_EYE_MIDPOINT[2] + cm / 100], forward: [0, 0, -1] }).ready).toBe(false);
    expect(sensoryNearCondition({ position: SENSORY_NEAR_TARGET, forward: [0, 0, 1] }).ready).toBe(false);
    expect(sensoryNearCondition({ position: [.30, 1.5, CLINIC_EYE_MIDPOINT[2] + .264575], forward: [-.75, 0, -.6614] }).ready).toBe(false);
  });
  it("computes a real reflected virtual target and a valid in-bounds mirror intersection", () => {
    const path = sensoryMirrorPath(SENSORY_DISTANCE_TARGET);
    expect(path.valid).toBe(true);
    expect(path.distanceCm).toBeCloseTo(600, 9);
    expect(path.intersection[2]).toBe(SENSORY_MIRROR.center[2]);
    const eyeToMirror = new Vector3(...path.intersection).sub(new Vector3(...CLINIC_EYE_MIDPOINT));
    const targetToMirror = new Vector3(...path.intersection).sub(new Vector3(...SENSORY_DISTANCE_TARGET));
    expect((eyeToMirror.length() + targetToMirror.length()) * 100).toBeCloseTo(600, 9);
    expect(sensoryMirrorPath(SENSORY_DISTANCE_TARGET, { ...SENSORY_MIRROR, center: [1.2, 1.5, 2.3], width: .1 }).valid).toBe(false);
    expect(sensoryMirrorPath([.65, 1.5, 2.5]).valid).toBe(false);
  });
  it("earns distance identity only at the tagged dock, never at an arbitrary 6 m pose or reversed target", () => {
    const state = place(initialConsultationTools(), socket("sensory-worth-distance"));
    const pose = poseOf(state, "worth");
    expect(pose.position).toEqual(SENSORY_DISTANCE_TARGET);
    expect(sensoryTargetCondition(pose, state)).toMatchObject({ endpoint: "distance", facing: true });
    expect(sensoryTargetCondition(pose, initialConsultationTools()).endpoint).toBeNull();
    expect(sensoryTargetCondition({ ...pose, forward: [0, 0, -1] }, state).endpoint).toBeNull();
    expect(sensoryTargetCondition({ position: [0, 1.5, 1.427], forward: [0, 0, -1] }, state).endpoint).toBeNull();
    const removed = grabConsultationTool(state, "worth", "left");
    const returned = releaseConsultationTool(removed, "left", { position: [0, 2.8, 0], rotation: [0, 1, 0, 0] }, [], SENSORY_SOCKETS).state;
    expect(sensoryTargetCondition(poseOf(returned, "worth"), returned).endpoint).toBeNull();
  });
  it("provides reachable approach rings clear of existing furnishings and sensory side tray", () => {
    for (const [x, z] of [[.65, 1.65], [0, .25], [.65, -.16]]) {
      expect(walkable(x, z)).toBe(true);
      expect(Math.abs(x - 1.31) < .92 / 2 + .19 && Math.abs(z - 1.04) < .52 / 2 + .19).toBe(false);
    }
  });
});
