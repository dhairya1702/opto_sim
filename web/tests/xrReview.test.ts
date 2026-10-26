import { createElement } from "react";
import { act } from "@react-three/fiber";
import { Mesh, Object3D, Quaternion, Raycaster, Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clinic } from "./helpers/xrClinicHarness";
import { useXRClinicRuntime, type XRClinicRuntime } from "../interaction/useXRClinicRuntime";
import { XRClinicRuntimeView } from "../scene/XRClinicRuntimeView";
import { libraryEquipment, librarySockets, LIBRARY_SOCKETS, type LibraryKind } from "../interaction/xrLibraryEquipment";
import { consultationToolDefinition, grabConsultationTool, initialConsultationTools, releaseConsultationTool } from "../interaction/xrConsultationTools";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });
async function setup(kind: LibraryKind = "maddox", onSelection = vi.fn(), onMenu = vi.fn()) {
  let runtime: XRClinicRuntime;
  function Probe({ active }: { active: boolean }) {
    runtime = useXRClinicRuntime({ active, equipment: libraryEquipment(kind), placementSockets: librarySockets(kind), onSelection, onMenu });
    return createElement(XRClinicRuntimeView, { runtime, active, sensoryStation: kind === "horizontal-distance" ? "four-prism" : undefined });
  }
  const sim = await clinic({ renderAdapter: ({ active }) => createElement(Probe, { active }) });
  dispose = sim.dispose;
  return { ...sim, runtime: () => runtime! };
}
function visible(object: Object3D) {
  for (let ancestor: Object3D | null = object; ancestor; ancestor = ancestor.parent) if (!ancestor.visible) return false;
  return true;
}
function rayTo(scene: Object3D, target: Vector3, direction: Vector3) {
  return new Raycaster(target.clone().addScaledVector(direction, -.05), direction).intersectObject(scene, true).filter(hit => visible(hit.object));
}
describe("XR review regressions against mounted scene geometry", () => {
  it.each([0, 1])("ignores repeated empty-hand trigger presses on the patient from controller %s but retains A/X menus", async hand => {
    const onSelection = vi.fn(), onMenu = vi.fn();
    const sim = await setup("maddox", onSelection, onMenu);
    sim.rays[hand].position.set(0, 1.5, .1);
    sim.rays[hand].rotation.set(0, 0, 0);
    await sim.step();
    for (let press = 0; press < 3; press++) {
      await sim.event(hand, "selectstart");
      expect(sim.runtime().slots[hand].pendingSelection?.data.station).toBe("patient");
      await sim.event(hand, "selectend");
    }
    expect(onSelection).not.toHaveBeenCalled();
    expect(onMenu).not.toHaveBeenCalled();
    await sim.panel(hand);
    expect(onMenu).toHaveBeenLastCalledWith(true);
    await sim.panel(hand);
    expect(onMenu).toHaveBeenLastCalledWith(false);
    expect(sim.encounter().results).toHaveLength(0);
  });
  it("mounts the shared arrival instructions on the clinic wall instead of in front of the headset", async () => {
    const sim = await setup();
    let welcome: Object3D | undefined;
    sim.state.scene.traverse(object => { if (object.userData.xrWallWelcome) welcome = object; });
    expect(welcome).toBeDefined();
    const centre = new Vector3();
    let sign: Object3D | undefined;
    welcome!.traverse(object => { if (!sign && object instanceof Mesh) sign = object; });
    sign!.getWorldPosition(centre);
    expect(centre.x).toBeCloseTo(.05);
    expect(centre.z).toBeLessThan(-2.4);
  });
  it("aligns the actual occluder head with its declared working point through both nested rotations", async () => {
    const sim = await setup("push-up"), tool = sim.tool("cover");
    let head: Object3D | undefined;
    tool.traverse(object => { if (object.userData.instrumentWorkingFace) head = object; });
    expect(head).toBeDefined();
    const working = tool.localToWorld(new Vector3(...consultationToolDefinition("cover").workingPoint));
    expect(head!.getWorldPosition(new Vector3()).distanceTo(working)).toBeLessThan(1e-8);
  });
  it("renders the docked mirror point ahead of both its backing disc and the opaque mirror", async () => {
    const sim = await setup();
    const socket = librarySockets("maddox").find(socket => socket.id === "sensory-worth-distance")!;
    await sim.pickup(0, "worth"); sim.grips[0].rotation.set(0, Math.PI, 0);
    await sim.at(0, socket.position); await sim.putDown(0);
    await act(async () => sim.runtime().setToolPower("worth", true)); await sim.step();
    let dot: Object3D | undefined;
    sim.state.scene.traverse(object => { if (object.userData.xrWorthDot && object.parent?.userData.xrWorthFace === "mirror") dot = object; });
    expect(dot).toBeDefined(); expect(visible(dot!)).toBe(true);
    const hits = rayTo(sim.state.scene, dot!.getWorldPosition(new Vector3()), new Vector3(0, 0, 1));
    expect(hits[0]?.object).toBe(dot);
  });
  it("renders the distance letter ahead of the opaque mirror and facing the patient", async () => {
    const sim = await setup("horizontal-distance");
    let sign: Mesh | undefined;
    sim.state.scene.traverse(object => {
      if (object instanceof Mesh && !Array.isArray(object.material)) {
        const text = (object.material as unknown as { map?: { image?: { renderedText?: string[] } } }).map?.image?.renderedText;
        if (text?.includes("E")) sign = object;
      }
    });
    expect(sign).toBeDefined();
    expect(rayTo(sim.state.scene, sign!.getWorldPosition(new Vector3()), new Vector3(0, 0, 1))[0]?.object).toBe(sign);
  });
  it("keeps the physical Thorington centre aperture clear for the light", async () => {
    const sim = await setup("thorington"), card = sim.tool("thorington");
    const [cx, cy, cz] = consultationToolDefinition("thorington").workingPoint;
    const rotation = card.getWorldQuaternion(new Quaternion());
    // Sample the centre and inside the entire 6 mm radius from either face.
    for (const x of [-.004, 0, .004]) for (const y of [-.004, 0, .004]) {
      const target = card.localToWorld(new Vector3(cx + x, cy + y, cz));
      for (const z of [-1, 1]) expect(rayTo(card, target, new Vector3(0, 0, z).applyQuaternion(rotation))).toHaveLength(0);
    }
  });
  it("cannot re-enable tracking, pickup, power or teleport after end while active props remain true", async () => {
    const sim = await setup(); await sim.pickup(0, "worth");
    await act(async () => sim.runtime().setToolPower("worth", true));
    await act(async () => sim.session.dispatchEvent(new Event("end")));
    await sim.rerender(); await sim.step(1 / 72, 12); await sim.pickup(1, "worth");
    await act(async () => { sim.runtime().setToolPower("worth", true); sim.runtime().teleport([1, 0, 1]); });
    expect(sim.runtime().frameValid.current).toBe(false);
    expect(sim.runtime().slots.every(slot => !slot.tracked)).toBe(true);
    expect(sim.runtime().toolsRef.current.worth.placement.kind).toBe("socket");
    expect(sim.runtime().toolsRef.current.worth.powered).toBe(false);
    expect(sim.referenceOffsets).toHaveLength(1); // Only the initial valid-frame arrival.
  });
  it("hides held lights and rejects stale aim when only target-ray tracking is lost", async () => {
    const sim = await setup("thorington"); await sim.pickup(0, "pupils"); await sim.event(0, "selectstart");
    expect(sim.runtime().toolsRef.current.pupils.powered).toBe(true);
    sim.rayTracked[0] = false; await sim.step();
    expect(sim.tracked[0]).toBe(true); expect(sim.runtime().slots[0].tracked).toBe(false);
    expect(sim.tool("pupils").visible).toBe(false); expect(sim.runtime().toolsRef.current.pupils.powered).toBe(false);
    expect(sim.runtime().workingPose("pupils")).toBe(false);
    sim.rayTracked[0] = true; await sim.step(); await sim.event(0, "selectstart");
    expect(sim.runtime().toolsRef.current.pupils.powered).toBe(false); // No synthesized edge.
    await sim.event(0, "selectend"); await sim.event(0, "selectstart");
    expect(sim.runtime().toolsRef.current.pupils.powered).toBe(true);
  });
  it("keeps current tracking and a held trigger through an ordinary slow XR frame", async () => {
    const sim = await setup("thorington"); await sim.pickup(0, "pupils"); await sim.event(0, "selectstart");
    expect(sim.runtime().toolsRef.current.pupils.powered).toBe(true);
    await sim.step(.18);
    expect(sim.runtime().frameValid.current).toBe(true);
    expect(sim.runtime().slots[0].tracked).toBe(true);
    expect(sim.runtime().toolsRef.current.pupils.powered).toBe(true);
  });
  it("lands at each requested pad with room-scale headset offsets and rejects viewer tracking loss", async () => {
    const sim = await setup(); sim.physicalViewer.x = .23; sim.physicalViewer.z = -.31;
    await sim.step(); await act(async () => sim.runtime().teleport([.65, 0, 1.75]));
    expect(sim.referenceOffsets.at(-1)?.x).toBeCloseTo(-.42);
    expect(sim.referenceOffsets.at(-1)?.z).toBeCloseTo(-2.06);
    expect(sim.referenceOffsets.at(-1)?.y).toBe(0);
    sim.physicalViewer.x = .35; await sim.step();
    await act(async () => sim.runtime().teleport([0, 0, .25]));
    expect(sim.referenceOffsets.at(-1)).toEqual({ x: .35, y: 0, z: -.56 });
    sim.viewerTracked.current = false; await sim.step();
    expect(sim.runtime().frameValid.current).toBe(false);
    expect(sim.runtime().slots.every(slot => !slot.tracked)).toBe(true);
  });
  it.each([0, 1])("latches a floor-ring destination on controller %s so release drift cannot cancel teleport", async controller => {
    const sim = await setup();
    let pad: Object3D | undefined;
    sim.state.scene.traverse(object => { if (!pad && object.userData.xrTeleport) pad = object; });
    expect(pad).toBeDefined();
    const destination = pad!.userData.xrTeleport as [number, number, number];
    sim.rays[controller].position.copy(pad!.getWorldPosition(new Vector3())).add(new Vector3(0, 1, 0));
    sim.rays[controller].rotation.set(-Math.PI / 2, 0, 0); await sim.step();
    const before = sim.referenceOffsets.length;
    await sim.event(controller, "selectstart");
    sim.rays[controller].position.set(8, 8, 8); sim.rays[controller].rotation.set(0, 0, 0); await sim.step();
    await sim.event(controller, "selectend");
    expect(sim.referenceOffsets).toHaveLength(before + 1);
    expect(sim.referenceOffsets.at(-1)?.x).toBeCloseTo(-destination[0]);
    expect(sim.referenceOffsets.at(-1)?.z).toBeCloseTo(-destination[2]);
  });
  it("recenters the clinic to the current headset yaw and preserves that orientation across floor moves", async () => {
    const sim = await setup();
    sim.physicalViewer.x = .4; sim.physicalViewer.z = -.2; sim.physicalViewer.yaw = Math.PI / 2; await sim.step();
    await act(async () => sim.runtime().recenterClinic());
    expect(sim.referenceOffsets.at(-1)?.x).toBeCloseTo(-1.5);
    expect(sim.referenceOffsets.at(-1)?.z).toBeCloseTo(-.2);
    expect(sim.referenceRotations.at(-1)?.y).toBeCloseTo(Math.SQRT1_2);
    expect(sim.referenceRotations.at(-1)?.w).toBeCloseTo(Math.SQRT1_2);
    sim.physicalViewer.yaw = 0; await sim.step();
    await act(async () => sim.runtime().teleport([0, 0, .25]));
    expect(sim.referenceOffsets.at(-1)?.x).toBeCloseTo(.15);
    expect(sim.referenceOffsets.at(-1)?.z).toBeCloseTo(-.2);
    expect(sim.referenceRotations.at(-1)?.y).toBeCloseTo(Math.SQRT1_2);
  });
  it.each(["library-thorington-near", "practice-near-stand"])("does not restore lesson readiness on unsupported release from %s", id => {
    const socket = LIBRARY_SOCKETS.find(socket => socket.id === id)!;
    const held = grabConsultationTool(initialConsultationTools(), socket.tool, "left");
    const placed = releaseConsultationTool(held, "left", { position: socket.position, rotation: socket.rotation }, [], [socket], [socket.tool]);
    expect(placed.state[socket.tool].placement.kind).toBe("socket");
    const result = releaseConsultationTool(grabConsultationTool(placed.state, socket.tool, "left"), "left", { position: [0, 2.4, 0], rotation: [0, 0, 0, 1] }, [], [socket], [socket.tool]);
    expect(result.returned).toBe(true);
    expect(result.state[socket.tool].placement).toEqual({ kind: "socket", position: consultationToolDefinition(socket.tool).home, rotation: consultationToolDefinition(socket.tool).restRotation });
  });
});
