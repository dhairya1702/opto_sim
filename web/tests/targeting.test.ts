import { expect, it } from "vitest";
import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from "three";
import { examUnderRay, stationUnderRay } from "../interaction/targeting";
const cube = (z: number) => {
  const m = new Mesh(new BoxGeometry(0.2, 0.2, 0.2), new MeshBasicMaterial());
  m.position.z = z;
  m.updateMatrixWorld();
  return m;
};
const ray = () => new Raycaster(new Vector3(0, 0, 0), new Vector3(0, 0, -1));
it("resolves stable station metadata through nested instrument meshes", () => {
  const station = new Group();
  station.userData.station = "refraction";
  const instrument = cube(-1);
  station.add(instrument);
  station.updateMatrixWorld(true);
  expect(stationUnderRay(ray(), [station])).toBe("refraction");
});
it("resolves a directly pickable near chart through its nested meshes", () => {
  const trolley = new Group();
  trolley.userData.station = "trolley";
  const nearChart = new Group();
  nearChart.userData.examId = "near";
  nearChart.add(cube(-1));
  trolley.add(nearChart);
  trolley.updateMatrixWorld(true);
  expect(stationUnderRay(ray(), [trolley])).toBe("trolley");
  expect(examUnderRay(ray(), [trolley])).toBe("near");
});
it("does not target tools beyond two metres or through an intervening wall", () => {
  const tool = cube(-1.5);
  tool.userData.station = "trolley";
  expect(stationUnderRay(ray(), [tool])).toBe("trolley");
  const wall = cube(-0.5);
  expect(stationUnderRay(ray(), [tool, wall])).toBeNull();
  tool.position.z = -2.2;
  tool.updateMatrixWorld(true);
  expect(stationUnderRay(ray(), [tool])).toBeNull();
});

it("resolves station and examination with a single bounded raycast", async () => {
  const { targetUnderRay } = await import("../interaction/targeting");
  const { vi } = await import("vitest");
  const tool = cube(-1); tool.userData.station = "trolley"; tool.userData.examId = "near";
  const pointer = ray(), original = pointer.intersectObjects;
  const intersect = vi.spyOn(pointer, "intersectObjects");
  intersect.mockImplementation((...args) => {
    expect(pointer.far).toBe(2);
    return original.apply(pointer, args);
  });
  expect(targetUnderRay(pointer, [tool])).toEqual({ station: "trolley", exam: "near" });
  expect(intersect).toHaveBeenCalledTimes(1);
  expect(pointer.far).toBe(Infinity);
});
it("uses the same held-object and visibility rules for both labels", async () => {
  const { targetUnderRay } = await import("../interaction/targeting");
  const held = cube(-.4); held.userData.held = true; held.userData.examId = "wrong";
  const hidden = cube(-.6); hidden.visible = false;
  const tool = cube(-1); tool.userData.station = "trolley"; tool.userData.examId = "near";
  expect(targetUnderRay(ray(), [held, hidden, tool])).toEqual({ station: "trolley", exam: "near" });
  expect(targetUnderRay(ray(), [held, tool, cube(-.8)])).toEqual({ station: null, exam: undefined });
});
