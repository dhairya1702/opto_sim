import { Object3D, Raycaster } from "three";
import type { StationId } from "../domain/types";
/** Resolve both labels from one nearest eligible hit, preserving occlusion. */
export function targetUnderRay(ray: Raycaster, objects: Object3D[], maxDistance = 2): { station: StationId | null; exam?: string } {
  const previousFar = ray.far;
  ray.far = Math.min(previousFar, maxDistance);
  let hits;
  try { hits = ray.intersectObjects(objects, true); }
  finally { ray.far = previousFar; }
  const hit = hits.find(h => {
    let object: Object3D | null = h.object;
    while (object) {
      if (!object.visible || object.userData.held) return false;
      object = object.parent;
    }
    return h.object.type === "Mesh";
  });
  let station: StationId | null = null;
  let exam: string | undefined;
  let object: Object3D | null = hit?.object ?? null;
  while (object) {
    station ??= object.userData.station ?? null;
    exam ??= object.userData.examId;
    object = object.parent;
  }
  return { station, exam };
}
export function stationUnderRay(ray: Raycaster, objects: Object3D[], maxDistance = 2): StationId | null {
  return targetUnderRay(ray, objects, maxDistance).station;
}
export function examUnderRay(ray: Raycaster, objects: Object3D[]): string | undefined {
  return targetUnderRay(ray, objects).exam;
}
