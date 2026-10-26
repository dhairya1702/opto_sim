import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Quaternion, Vector3 } from "three";
import type { XRClinicRuntime } from "../interaction/useXRClinicRuntime";
import { XRSign } from "./XRClinicPanels";

/** Small Guided readout beside the pointer; distance comes from the instrument working pose. */
export function XRWorkingDistanceLabel({ runtime, tool, distanceCm, ready, eye }: { runtime: XRClinicRuntime; tool: "fundus" | "pupils" | "thorington"; distanceCm: number; ready: boolean; eye?: "OD" | "OS" }) {
  const root = useRef<Group>(null);
  const pose = useMemo(() => ({ position: new Vector3(), forward: new Vector3(), rotation: new Quaternion() }), []);
  useFrame(({ gl, camera }) => {
    const group = root.current;
    if (!group) return;
    const held = runtime.toolsRef.current[tool].placement;
    group.visible = runtime.frameValid.current && held.kind === "held" && runtime.scopeViewHandRef.current === null;
    if (!group.visible || held.kind !== "held") return;
    if (!runtime.workingPose(tool)) { group.visible = false; return; }
    const viewer = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    viewer.getWorldQuaternion(pose.rotation);
    const slot = runtime.slots.find(slot => slot.hand === held.hand);
    if (slot) {
      slot.ray.getWorldPosition(pose.position);
      slot.ray.getWorldQuaternion(group.quaternion);
      pose.forward.set(0, 0, -1).applyQuaternion(group.quaternion);
    } else {
      pose.position.copy(runtime.origin); pose.forward.copy(runtime.direction);
    }
    // Patient OS uses the learner's left; OD uses the learner's right.
    // Binocular lessons follow the holding hand instead of crossing the ray.
    const side = eye ? eye === "OS" ? -1 : 1 : held.hand === "left" ? -1 : 1;
    group.position.copy(pose.position).addScaledVector(pose.forward, .35)
      .add(pose.forward.set(side * .075, .025, 0).applyQuaternion(pose.rotation));
    group.quaternion.copy(pose.rotation);
    group.updateMatrixWorld(true);
  });
  return <group ref={root} visible={false} userData={{ xrIgnoreRay: true }}>
    <XRSign transparentBackground text={[`${Math.round(distanceCm)} cm`]} p={[0, 0, 0]} size={[.065, .014]}
      fg={ready ? "#87efb0" : "#fff4d0"} />
  </group>;
}
