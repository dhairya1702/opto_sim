import { Camera, Quaternion, Vector3 } from "three";
import type { ScopeViewerPose } from "./xrScopes";

export const createXRViewerScratch = () => ({ position: new Vector3(), forward: new Vector3(), rotation: new Quaternion(), poses: [] as ScopeViewerPose[] });
/** The ArrayCamera is a rendering/culling camera, not either of the learner's eyes. */
export function xrViewerPoses(viewer: Camera, scratch: ReturnType<typeof createXRViewerScratch>) {
  const cameras = "cameras" in viewer ? (viewer as import("three").ArrayCamera).cameras : [viewer];
  cameras.forEach((camera, index) => {
    camera.getWorldPosition(scratch.position); camera.getWorldQuaternion(scratch.rotation);
    scratch.forward.set(0, 0, -1).applyQuaternion(scratch.rotation);
    scratch.poses[index] = { viewer: scratch.position.toArray() as [number, number, number], look: scratch.forward.toArray() as [number, number, number] };
  });
  scratch.poses.length = cameras.length;
  return scratch.poses;
}
