import { createElement } from "react";
import { act } from "@react-three/fiber";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Quaternion, Vector3 } from "three";
import { clinic } from "./helpers/xrClinicHarness";
import { useXRClinicRuntime, type XRClinicRuntime } from "../interaction/useXRClinicRuntime";
import { XRClinicRuntimeView } from "../scene/XRClinicRuntimeView";
import { consultationToolDefinition, type ConsultationToolId } from "../interaction/xrConsultationTools";
import { isPatientFitted, sensoryEquipment, sensorySockets, SENSORY_SOCKETS } from "../interaction/xrSensoryEquipment";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });
async function foundation(kind?: "worth" | "stereo", preview = false) {
  let runtime: XRClinicRuntime;
  const interruption = vi.fn();
  function Probe({ active }: { active: boolean }) {
    runtime = useXRClinicRuntime({ active: active && !preview, equipment: kind ? sensoryEquipment(kind) : undefined,
      placementSockets: kind ? sensorySockets(kind) : undefined, onInterrupt: interruption });
    return createElement(XRClinicRuntimeView, { runtime, active: active && !preview, preview });
  }
  const sim = await clinic({ renderAdapter: ({ active }) => createElement(Probe, { active }) });
  dispose = sim.dispose;
  const ids = () => {
    const list: ConsultationToolId[] = [];
    sim.state.scene.traverse(object => { if (object.userData.consultationToolId) list.push(object.userData.consultationToolId as ConsultationToolId); });
    return list;
  };
  return { ...sim, ids, runtime: () => runtime!, interruption };
}

describe("sensory shared runtime foundation", () => {
  it("holds after grip release, preserves the trigger, and places only on a fresh second squeeze", async () => {
    const sim = await foundation();
    await sim.at(0, consultationToolDefinition("pupils").home);
    await sim.event(0, "squeezestart");
    await sim.event(0, "squeezestart"); // Duplicate device event must not put it down.
    expect(sim.runtime().toolsRef.current.pupils.placement).toEqual({ kind: "held", hand: "left" });
    await sim.at(0, [-1.14, 1, -.94]);
    await sim.event(0, "selectstart");
    const interrupts = sim.interruption.mock.calls.length;
    await sim.event(0, "squeezeend"); await sim.step();
    expect(sim.runtime().toolsRef.current.pupils.powered).toBe(true);
    expect(sim.runtime().slots[0].triggerRoute).toBe("tool");
    expect(sim.interruption).toHaveBeenCalledTimes(interrupts);
    expect(sim.tool("pupils").position.equals(sim.grips[0].position)).toBe(true);
    const marker = sim.runtime().placementMarkers.current.get("left")!;
    expect(marker.visible).toBe(true);
    expect(marker.getObjectByName("place")?.visible).toBe(true);
    const destination = marker.position.clone();
    const revision = sim.runtime().toolsRef.current.pupils.revision;
    await sim.step(1 / 72, 12); // Preview must never mutate ownership/power/revision.
    expect(sim.runtime().toolsRef.current.pupils.revision).toBe(revision);
    await sim.event(0, "squeezestart"); await sim.step();
    expect(sim.runtime().toolsRef.current.pupils.placement.kind).toBe("surface");
    expect(sim.tool("pupils").position.equals(destination)).toBe(true);
    expect(sim.runtime().toolsRef.current.pupils.powered).toBe(false);
    expect(marker.visible).toBe(false);
    await sim.event(0, "squeezestart");
    expect(sim.runtime().toolsRef.current.pupils.placement.kind).toBe("surface");
    await sim.event(0, "squeezeend"); await sim.event(0, "selectend");
    expect(sim.record).not.toHaveBeenCalled();
  });
  it("previews fallback return and fitting sockets using the actual placement destination", async () => {
    const sim = await foundation("worth");
    await sim.pickup(0, "red-green"); await sim.at(0, [0, 2, 0]);
    const marker = sim.runtime().placementMarkers.current.get("left")!;
    expect(marker.visible).toBe(true);
    expect(marker.getObjectByName("return")?.visible).toBe(true);
    expect(marker.position.toArray()).toEqual(consultationToolDefinition("red-green").home);
    await sim.putDown(0);
    expect(sim.tool("red-green").position.equals(marker.position)).toBe(true);
    await sim.pickup(0, "red-green");
    const socket = SENSORY_SOCKETS.find(s => s.id === "sensory-red-green")!;
    await sim.at(0, socket.position);
    expect(marker.getObjectByName("place")?.visible).toBe(true);
    expect(marker.position.toArray()).toEqual(socket.position);
    await sim.putDown(0);
    expect(isPatientFitted(sim.runtime().toolsRef.current, "red-green")).toBe(true);
    expect(sim.tool("red-green").position.equals(marker.position)).toBe(true);
  });
  it("keeps a flat card's footprint preview horizontal instead of tilting it with the model", async () => {
    const sim = await foundation(); await sim.pickup(0, "near");
    await sim.at(0, consultationToolDefinition("near").home);
    const marker = sim.runtime().placementMarkers.current.get("left")!;
    const outline = marker.getObjectByName("place")!.getObjectByName("outline")!;
    expect(outline.quaternion.angleTo(new Quaternion())).toBeCloseTo(0);
    expect(outline.scale.toArray()).toEqual([.25, .035, .18]);
  });
  it("transfers atomically and never drops on old-hand release or a stale grip after tracking loss", async () => {
    const sim = await foundation();
    await sim.pickup(0, "pupils"); await sim.at(0, [0, 1.4, .2]);
    await sim.event(0, "selectstart");
    await sim.at(1, sim.tool("pupils").position.toArray() as [number, number, number]);
    await sim.event(1, "squeezestart"); await sim.event(0, "squeezeend");
    expect(sim.runtime().toolsRef.current.pupils.placement).toEqual({ kind: "held", hand: "right" });
    expect(sim.runtime().toolsRef.current.pupils.powered).toBe(false);
    await sim.step();
    const marker = sim.runtime().placementMarkers.current.get("right")!;
    expect(sim.runtime().placementMarkers.current.get("left")?.visible).toBe(false);
    sim.tracked[1] = false; await sim.step(); expect(marker.visible).toBe(false);
    sim.tracked[1] = true; await sim.step();
    await sim.event(1, "squeezestart");
    expect(sim.runtime().toolsRef.current.pupils.placement.kind).toBe("held");
    await sim.at(1, consultationToolDefinition("pupils").home);
    await sim.event(1, "squeezeend"); await sim.grip(1);
    expect(sim.runtime().toolsRef.current.pupils.placement.kind).toBe("socket");
    expect(marker.visible).toBe(false);
  });
  it("clears placement guides on visibility interruption, reset and session exit", async () => {
    const sim = await foundation(); await sim.pickup(0, "cover");
    const marker = sim.runtime().placementMarkers.current.get("left")!;
    expect(marker.visible).toBe(true);
    await act(async () => { sim.session.visibilityState = "hidden"; sim.session.dispatchEvent(new Event("visibilitychange")); });
    expect(marker.visible).toBe(false);
    sim.session.visibilityState = "visible"; await sim.step();
    expect(sim.runtime().toolsRef.current.cover.placement.kind).toBe("held");
    expect(marker.visible).toBe(true);
    await act(async () => sim.runtime().resetClinic()); expect(marker.visible).toBe(false);
    await sim.pickup(0, "cover");
    await act(async () => sim.session.dispatchEvent(new Event("end")));
    expect(marker.visible).toBe(false);
    expect(sim.runtime().toolsRef.current.cover.placement.kind).toBe("socket");
    await sim.event(0, "squeezestart");
    expect(sim.runtime().toolsRef.current.cover.placement.kind).toBe("socket");
  });
  it("keeps optional sensory tools out of consultation and only renders a selected lesson kit", async () => {
    const sim = await foundation();
    expect(sim.ids()).not.toContain("worth");
    expect(sim.ids()).not.toContain("polarised");
    expect(sim.runtime().supportedWorkingPose("worth")).toBeNull();
    await act(async () => sim.runtime().setToolPower("worth", true));
    expect(sim.runtime().toolsRef.current.worth.powered).toBe(false);
    await sim.dispose(); dispose = undefined;
    const lesson = await foundation("worth");
    expect(lesson.ids().sort()).toEqual(["red-green", "subjective", "worth"]);
    const data = lesson.tool("worth").userData;
    expect(data.examId).toBeUndefined();
    expect(lesson.tool("red-green").userData.examId).toBeUndefined();
  });
  it("reads actual resting and held working transforms and gates only held samples by tracking/panel", async () => {
    const sim = await foundation("stereo");
    const id = "stereo", definition = consultationToolDefinition(id);
    const object = sim.tool(id);
    const initial = sim.runtime().supportedWorkingPose(id);
    expect(initial).not.toBeNull();
    const expected = new Vector3(...definition.workingPoint).applyQuaternion(object.getWorldQuaternion(new Quaternion())).add(object.getWorldPosition(new Vector3()));
    expect(new Vector3(...initial!.position).distanceTo(expected)).toBeLessThan(1e-10);
    await sim.pickup(0, id);
    expect(sim.runtime().supportedWorkingPose(id)).not.toBeNull();
    await sim.panel(0);
    expect(sim.runtime().supportedWorkingPose(id)).toBeNull();
    expect(sim.runtime().supportedWorkingPose(id, true)).not.toBeNull();
    sim.tracked[0] = false; await sim.step();
    expect(sim.runtime().supportedWorkingPose(id, true)).toBeNull();
    sim.tracked[0] = true; await sim.step();
    const socket = SENSORY_SOCKETS.find(candidate => candidate.id === "sensory-stereo-near");
    if (!socket) throw new Error("Missing near stand");
    await sim.at(0, socket.position); await sim.putDown(0); await sim.step();
    const resting = sim.runtime().supportedWorkingPose(id);
    expect(resting).not.toBeNull();
    sim.tracked[0] = false; await sim.step();
    expect(sim.runtime().supportedWorkingPose(id)).toEqual(resting);
    // A supported transform is sampled from the actual object, not its authored home.
    object.position.x += .03; object.updateMatrixWorld(true);
    expect(sim.runtime().supportedWorkingPose(id)?.position[0]).toBeCloseTo(resting!.position[0] + .03);
  });
  it("fits/removes with either hand and preserves explicit Worth power through trigger/panel/release then extinguishes on exit", async () => {
    const sim = await foundation("worth");
    for (const [hand, id, name] of [[0, "subjective", "sensory-correction"], [1, "red-green", "sensory-red-green"]] as const) {
      const socket = SENSORY_SOCKETS.find(candidate => candidate.id === name);
      if (!socket) throw new Error(name);
      await sim.pickup(hand, id); await sim.at(hand, socket.position); await sim.putDown(hand); await sim.step();
      expect(isPatientFitted(sim.runtime().toolsRef.current, id)).toBe(true);
    }
    await sim.pickup(1, "red-green");
    expect(isPatientFitted(sim.runtime().toolsRef.current, "red-green")).toBe(false);
    await sim.putDown(1); await sim.step();
    await sim.pickup(0, "worth");
    await act(async () => sim.runtime().setToolPower("worth", true));
    await sim.event(0, "selectstart"); await sim.event(0, "selectend"); await sim.panel(0);
    expect(sim.runtime().toolsRef.current.worth.powered).toBe(true);
    await sim.putDown(0); await sim.step();
    expect(sim.runtime().toolsRef.current.worth.powered).toBe(true);
    await sim.exit();
    expect(sim.runtime().toolsRef.current.worth.powered).toBe(false);
    await act(async () => sim.runtime().setToolPower("worth", true));
    expect(sim.runtime().toolsRef.current.worth.powered).toBe(false);
    expect(sim.record).not.toHaveBeenCalled();
  });
  it("keeps preview targets inspectable without controller pickup or active teleport controls", async () => {
    const sim = await foundation("worth", true);
    expect(sim.ids()).toContain("worth");
    await sim.pickup(0, "worth");
    expect(sim.runtime().toolsRef.current.worth.placement.kind).toBe("socket");
    const pads: unknown[] = [];
    sim.state.scene.traverse(object => { if (object.userData.xrTeleport) pads.push(object.userData.xrTeleport); });
    expect(pads).toHaveLength(0);
    expect(sim.record).not.toHaveBeenCalled();
  });
});
