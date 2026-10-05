import { describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import {
  CONSULTATION_TOOLS, consultationToolDefinition, consultationToolReady,
  consultationPickupHint, consultationPickupLabel,
  grabConsultationTool, initialConsultationTools, powerConsultationTool,
  releaseConsultationTool, resetConsultationHands, toolInHand,
  type ConsultationTools,
} from "../interaction/xrConsultationTools";

const identity = [0, 0, 0, 1] as const;
const surface = [{ id: "clear", x: 0, z: 0, y: .8, width: 1, depth: 1 }];
const hold = (id: "pupils" | "cover" = "pupils") => grabConsultationTool(initialConsultationTools(), id, "left");
const totalHeld = (state: ConsultationTools) => Object.values(state).filter(tool => tool.placement.kind === "held").length;

describe("consultation instrument ownership", () => {
  it("holds different instruments independently and refuses occupied-hand replacement", () => {
    let state = hold();
    state = grabConsultationTool(state, "cover", "right");
    expect(toolInHand(state, "left")).toBe("pupils");
    expect(toolInHand(state, "right")).toBe("cover");
    expect(grabConsultationTool(state, "near", "left")).toBe(state);
    expect(totalHeld(state)).toBe(2);
  });

  it("transfers atomically, switches off illumination, and ignores the old hand release", () => {
    const powered = powerConsultationTool(hold(), "left", true);
    const transferred = grabConsultationTool(powered, "pupils", "right");
    expect(toolInHand(transferred, "left")).toBeNull();
    expect(toolInHand(transferred, "right")).toBe("pupils");
    expect(transferred.pupils.powered).toBe(false);
    expect(releaseConsultationTool(transferred, "left").state).toBe(transferred);
    expect(totalHeld(transferred)).toBe(1);
  });

  it("maintains one owner when two hands contend for the same instrument", () => {
    let state = hold();
    state = grabConsultationTool(state, "pupils", "right");
    state = grabConsultationTool(state, "pupils", "left");
    expect(totalHeld(state)).toBe(1);
    expect(toolInHand(state, "left")).toBe("pupils");
  });

  it("does not invent trigger actions for passive tools", () => {
    const state = hold("cover");
    expect(powerConsultationTool(state, "left", true)).toBe(state);
    expect(powerConsultationTool(state, "right", true)).toBe(state);
  });

  it("preserves the other hand when one tool is released", () => {
    const state = grabConsultationTool(hold(), "cover", "right");
    const next = releaseConsultationTool(state, "left").state;
    expect(toolInHand(next, "left")).toBeNull();
    expect(toolInHand(next, "right")).toBe("cover");
  });
});

describe("consultation assisted placement", () => {
  it("returns to its own socket within snap distance", () => {
    const home = consultationToolDefinition("pupils").home;
    const result = releaseConsultationTool(hold(), "left", { position: [home[0] + .04, home[1], home[2]], rotation: identity });
    expect(result.returned).toBe(false);
    expect(result.state.pupils.placement).toEqual({ kind: "socket", position: home, rotation: identity });
  });

  it("places above a clear surface and can be picked up again", () => {
    const result = releaseConsultationTool(hold(), "left", { position: [0, 1, 0], rotation: identity }, surface);
    expect(result.returned).toBe(false);
    expect(result.state.pupils.placement).toEqual({ kind: "surface", position: [0, .915, 0], rotation: identity });
    const next = grabConsultationTool(result.state, "pupils", "right");
    expect(toolInHand(next, "right")).toBe("pupils");
    expect(next.pupils.lastRest).toEqual(result.state.pupils.placement);
  });

  it("returns to the last surface after release in unsupported space", () => {
    const placed = releaseConsultationTool(hold(), "left", { position: [0, 1, 0], rotation: identity }, surface).state;
    const heldAgain = grabConsultationTool(placed, "pupils", "right");
    const result = releaseConsultationTool(powerConsultationTool(heldAgain, "right", true), "right", { position: [0, 2, 0], rotation: identity }, surface);
    expect(result.returned).toBe(true);
    expect(result.state.pupils.placement).toEqual(placed.pupils.placement);
    expect(result.state.pupils.powered).toBe(false);
  });

  it("rejects releases below a surface, beyond its edge, or too high above it", () => {
    for (const position of [[0, .7, 0], [.49, 1, 0], [0, 1.5, 0]] as const) {
      const result = releaseConsultationTool(hold(), "left", { position, rotation: identity }, surface);
      expect(result.returned).toBe(true);
      expect(result.state.pupils.placement.kind).toBe("socket");
    }
  });

  it("prevents instruments overlapping on a surface", () => {
    const first = releaseConsultationTool(hold(), "left", { position: [0, 1, 0], rotation: identity }, surface).state;
    const second = grabConsultationTool(first, "cover", "right");
    const result = releaseConsultationTool(second, "right", { position: [0, 1, 0], rotation: identity }, surface);
    expect(result.returned).toBe(true);
    expect(result.state.pupils.placement).toEqual(first.pupils.placement);
  });

  it("accounts for a rotated card footprint at surface edges", () => {
    const state = grabConsultationTool(initialConsultationTools(), "near", "left");
    const result = releaseConsultationTool(state, "left", { position: [.4, .9, 0], rotation: identity }, surface);
    expect(result.returned).toBe(true);
    const yaw90 = [0, Math.SQRT1_2, 0, Math.SQRT1_2] as const;
    const rotated = releaseConsultationTool(state, "left", { position: [.39, .9, 0], rotation: yaw90 }, surface);
    expect(rotated.returned).toBe(false);
  });

  it("reserves home sockets even when their instruments are held", () => {
    const home = consultationToolDefinition("pupils").home;
    const state = grabConsultationTool(hold(), "cover", "right");
    const result = releaseConsultationTool(state, "right", { position: home, rotation: identity });
    expect(result.returned).toBe(true);
    expect(result.state.cover.placement.kind).toBe("socket");
  });

  it("uses the free home if another instrument occupies the last surface position", () => {
    let state = releaseConsultationTool(hold(), "left", { position: [0, 1, 0], rotation: identity }, surface).state;
    state = grabConsultationTool(state, "pupils", "left");
    state = grabConsultationTool(state, "cover", "right");
    state = releaseConsultationTool(state, "right", { position: [0, 1, 0], rotation: identity }, surface).state;
    const returned = releaseConsultationTool(state, "left");
    expect(returned.state.pupils.placement.kind).toBe("socket");
    expect(returned.state.cover.placement.kind).toBe("surface");
  });

  it("keeps every initial home distinct and within pickup clearance", () => {
    for (const tool of CONSULTATION_TOOLS) {
      const state = grabConsultationTool(initialConsultationTools(), tool.id, "left");
      const result = releaseConsultationTool(state, "left", { position: tool.home, rotation: tool.restRotation });
      expect(result.returned, tool.label).toBe(false);
    }
  });

  it("returns both hands and clears power on session exit", () => {
    let state = grabConsultationTool(hold(), "motility", "right");
    state = powerConsultationTool(powerConsultationTool(state, "left", true), "right", true);
    const next = resetConsultationHands(state);
    expect(totalHeld(next)).toBe(0);
    expect(Object.values(next).every(tool => !tool.powered)).toBe(true);
  });
});

describe("consultation technique availability", () => {
  it("names the closest visible handle and only offers grip within the actual pickup radius", () => {
    const handles = [
      { id: "pupils" as const, position: [0, 1, 0] as const, visible: true },
      { id: "cover" as const, position: [.2, 1, 0] as const, visible: true },
      { id: "near" as const, position: [0, 1, .5] as const, visible: false },
    ];
    const far = consultationPickupHint([0, 1, .5], handles);
    expect(far?.id).toBe("pupils");
    expect(far?.reachable).toBe(false);
    expect(consultationPickupLabel(far)).toContain("50 CM · MOVE CLOSER");
    const near = consultationPickupHint([.02, 1, 0], handles);
    expect(near?.reachable).toBe(true);
    expect(consultationPickupLabel(near)).toBe("GRIP · Penlight");
    expect(consultationPickupHint([0, 1, 0], [])).toBeNull();
  });

  it("points illuminated tips along the controller while keeping occluders upright", () => {
    for (const id of ["pupils", "motility"] as const) {
      const definition = consultationToolDefinition(id);
      const grip = new Quaternion(...definition.gripRotation);
      const forward = new Vector3(...definition.forward).applyQuaternion(grip);
      const tip = new Vector3(...definition.workingPoint).applyQuaternion(grip);
      expect(forward.distanceTo(new Vector3(0, 0, -1))).toBeLessThan(1e-9);
      expect(tip.z).toBeCloseTo(-.137);
    }
    const occluder = consultationToolDefinition("cover");
    const head = new Vector3(...occluder.workingPoint).applyQuaternion(new Quaternion(...occluder.gripRotation));
    expect(head.y).toBeCloseTo(.121);
    expect(head.z).toBeCloseTo(0);
  });

  it("requires a held, tracked instrument in tool mode", () => {
    const hands = { left: { tracked: true, panel: false }, right: { tracked: true, panel: false } };
    expect(consultationToolReady(hold(), "pupils", hands)).toBe(true);
    expect(consultationToolReady(initialConsultationTools(), "pupils", hands)).toBe(false);
    expect(consultationToolReady(hold(), "pupils", { ...hands, left: { tracked: false, panel: false } })).toBe(false);
    expect(consultationToolReady(hold(), "pupils", { ...hands, left: { tracked: true, panel: true } })).toBe(false);
  });
});
