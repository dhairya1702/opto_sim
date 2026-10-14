import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, Quaternion, Vector3 } from "three";
import { createXRViewerScratch, xrExaminerPose, xrViewerPoses } from "../interaction/xrViewer";
import { KRIMSKY_BASELINE_DWELL_SECONDS, type ExaminerEye } from "../interaction/xrKrimskyPractice";
import { XRSign } from "./XRClinicPanels";

/** Headset-following read-only observation field for a selected examiner eye. */
export function XRKrimskyMonocularView({ active, examinerEye, reflexOffset, baselineProgress, baseline, power, base }: {
  active: boolean;
  examinerEye: ExaminerEye | null;
  reflexOffset: number;
  baselineProgress: number;
  baseline: boolean;
  power: number;
  base: string;
}) {
  const root = useRef<Group>(null);
  const scratch = useMemo(() => ({ viewer: createXRViewerScratch(), position: new Vector3(), rotation: new Quaternion(), offset: new Vector3() }), []);
  useFrame(({ gl, camera }) => {
    if (!root.current || !examinerEye) return;
    const poses = xrViewerPoses(gl.xr.isPresenting ? gl.xr.getCamera() : camera, scratch.viewer);
    const pose = xrExaminerPose(poses, examinerEye);
    root.current.visible = Boolean(active && pose);
    if (!pose) return;
    scratch.position.set(...pose.viewer);
    scratch.rotation.copy(scratch.viewer.rotation);
    root.current.position.copy(scratch.position).add(scratch.offset.set(examinerEye === "left" ? .30 : -.30, .08, -.72).applyQuaternion(scratch.rotation));
    root.current.quaternion.copy(scratch.rotation);
    root.current.updateMatrixWorld(true);
  });
  useEffect(() => {
    root.current?.traverse(object => {
      if (!(object instanceof Mesh)) return;
      object.renderOrder = 1120;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => { material.transparent = true; material.depthTest = false; material.depthWrite = false; });
    });
  });
  if (!active || !examinerEye) return null;
  const progress = Math.max(0, Math.min(1, baselineProgress / KRIMSKY_BASELINE_DWELL_SECONDS));
  const status = baseline ? `BASELINE CAPTURED · ${power}Δ ${base || "BASE UNSELECTED"}` : `HOLD STEADY · ${Math.round(progress * 100)}%`;
  return <group ref={root} visible={false} scale={.9} userData={{ xrKrimskyMonocularView: examinerEye, xrIgnoreRay: true }}>
    <mesh position={[0, 0, -.008]}><planeGeometry args={[.42, .25]} /><meshBasicMaterial color="#071215" opacity={.94} /></mesh>
    <mesh position={[0, 0, -.004]}><planeGeometry args={[.424, .254]} /><meshBasicMaterial color="#8df5d3" opacity={.42} wireframe /></mesh>
    {([[-.10, "OD"], [.10, "OS"]] as const).map(([x, eye]) => <group key={eye} position={[x, .015, 0]}>
      <mesh scale={[1.45, .75, 1]}><circleGeometry args={[.056, 40]} /><meshBasicMaterial color="#e8ddd1" /></mesh>
      <mesh><circleGeometry args={[.021, 32]} /><meshBasicMaterial color="#315f65" /></mesh>
      <mesh><circleGeometry args={[.009, 24]} /><meshBasicMaterial color="#071215" /></mesh>
      <mesh position={[eye === "OS" ? reflexOffset : 0, .004, .003]}><circleGeometry args={[.0045, 20]} /><meshBasicMaterial color="#fff7bd" /></mesh>
      <XRSign text={[eye]} p={[0, -.066, .004]} size={[.065, .022]} bg="#071215" fg="#d9e9e5" />
    </group>)}
    <XRSign text={[`MONOCULAR · ${examinerEye.toUpperCase()} EXAMINER EYE`]} p={[0, .098, .004]} size={[.38, .032]} bg="#102329" fg="#e8fff9" />
    <XRSign text={[status]} p={[0, -.098, .004]} size={[.38, .030]} bg="#102329" fg={baseline ? "#8df5d3" : "#f9d178"} />
  </group>;
}
