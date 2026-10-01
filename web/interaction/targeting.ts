import { Object3D, Raycaster } from "three";
import type { StationId } from "../domain/types";
/** The nearest opaque mesh wins. A wall/furniture hit cannot be skipped to reach a tool. */
export function stationUnderRay(
  ray: Raycaster,
  objects: Object3D[],
  maxDistance = 2,
): StationId | null {
  const hit = ray.intersectObjects(objects, true).find((h) => {
    let p: Object3D | null = h.object;
    while (p) {
      if (p.userData.held) return false;
      p = p.parent;
    }
    return h.object.type === "Mesh";
  });
  if (!hit || hit.distance > maxDistance) return null;
  let object: Object3D | null = hit.object;
  while (object) {
    if (object.userData.station) return object.userData.station as StationId;
    object = object.parent;
  }
  return null;
}
export function examUnderRay(ray: Raycaster, objects: Object3D[]): string | undefined {
  const hit = ray.intersectObjects(objects, true).find((h) => h.object.type === "Mesh");
  if (!hit || hit.distance > 2) return;
  let object: Object3D | null = hit.object;
  while (object) {
    if (object.userData.examId) return object.userData.examId;
    object = object.parent;
  }
}
