import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Euler, Group, Mesh, Quaternion, Vector3 } from "three";
import type { XRClinicRuntime } from "../interaction/useXRClinicRuntime";
import type { ConsultationToolId } from "../interaction/xrConsultationTools";

/** A larger Practice form, placed once ahead/right when a relevant tool is picked up. */
export function XRPracticeFindingsBoard({ runtime, active, tools, hidden = false, children }: {
  runtime: XRClinicRuntime; active: boolean; tools: readonly ConsultationToolId[]; hidden?: boolean; children: ReactNode;
}) {
  const [shown, setShown] = useState(false);
  const revisions = useRef(new Map<ConsultationToolId, number>());
  const root = useRef<Group | null>(null), positioned = useRef(false);
  const pose = useRef({ point: new Vector3(), rotation: new Quaternion(), euler: new Euler(0, 0, 0, "YXZ") });
  const key = tools.join("|");
  const register = useCallback((object: Group | null) => {
    if (root.current) runtime.findingsPanels.current.delete(root.current);
    if (object !== root.current) positioned.current = false;
    root.current = object;
    if (object) runtime.findingsPanels.current.add(object);
  }, [runtime.findingsPanels]);
  useEffect(() => {
    if (!active || tools.every(id => runtime.tools[id].revision === 0)) { setShown(false); revisions.current.clear(); return; }
    for (const id of tools) {
      const tool = runtime.tools[id];
      if (tool.placement.kind === "held" && revisions.current.get(id) !== tool.revision) {
        setShown(true); positioned.current = false;
      }
      revisions.current.set(id, tool.revision ?? 0);
    }
  }, [active, runtime.tools, key]);
  useFrame(({ gl, camera }) => {
    if (!root.current || positioned.current) return;
    const viewer = gl.xr.isPresenting ? gl.xr.getCamera() : camera, { point, rotation, euler } = pose.current;
    viewer.getWorldPosition(point); viewer.getWorldQuaternion(rotation);
    euler.setFromQuaternion(rotation, "YXZ"); euler.x = 0; euler.z = 0; rotation.setFromEuler(euler);
    root.current.position.copy(point).add(new Vector3(.75, -.04, -1.4).applyQuaternion(rotation));
    root.current.quaternion.copy(rotation); root.current.scale.setScalar(1.35);
    root.current.updateMatrixWorld(true); positioned.current = true;
  }, -1);
  useEffect(() => {
    root.current?.traverse(object => {
      if (!(object instanceof Mesh)) return;
      object.renderOrder = 1000;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => { material.depthTest = false; material.depthWrite = false; });
    });
  });
  if (!active || !shown || hidden) return null;
  return <group ref={register} userData={{ xrPanel: true, xrPersistentFindings: true }}>{children}</group>;
}
