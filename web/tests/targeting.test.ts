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
  station.userData.station = "slit";
  const instrument = cube(-1);
  station.add(instrument);
  station.updateMatrixWorld(true);
  expect(stationUnderRay(ray(), [station])).toBe("slit");
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
