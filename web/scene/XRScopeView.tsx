import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from "three";
import { createXRViewerScratch, xrViewerPoses } from "../interaction/xrViewer";
import { XRSign } from "./XRClinicPanels";
import { XRScopeObservation } from "./XRScopeObservation";
import type { BrucknerScopeView, FundusScopeView } from "./XRScopeOptics";

/** Read-only optical viewing aid: no answer controls or independent completion. */
export function XRScopeView({ active, brucknerView, fundusView }: { active: boolean; brucknerView?: BrucknerScopeView; fundusView?: FundusScopeView }) {
  const root = useRef<Group>(null), observation = useRef<Group>(null), guide = useRef<Group>(null);
  const background = useRef<MeshBasicMaterial>(null), border = useRef<MeshBasicMaterial>(null);
  const scratch = useMemo(() => ({ viewer: createXRViewerScratch(), position: new Vector3(), rotation: new Quaternion(), offset: new Vector3() }), []);
  const eyepiece = (brucknerView ?? fundusView)?.eyepiece;
  useFrame(({ gl, camera }) => {
    if (!root.current) return;
    const poses = xrViewerPoses(gl.xr.isPresenting ? gl.xr.getCamera() : camera, scratch.viewer);
    root.current.visible = Boolean(active && eyepiece?.active && poses.length);
    if (!root.current.visible) return;
    scratch.position.set(0, 0, 0);
    for (const pose of poses) scratch.position.add(scratch.offset.set(...pose.viewer));
    scratch.position.divideScalar(poses.length);
    scratch.rotation.copy(scratch.viewer.rotation);
    root.current.position.copy(scratch.position).add(scratch.offset.set(0, 0, -.9).applyQuaternion(scratch.rotation));
    root.current.quaternion.copy(scratch.rotation); root.current.updateMatrixWorld(true);
    if (observation.current) observation.current.visible = Boolean(brucknerView || eyepiece?.ready);
    if (guide.current) guide.current.visible = !brucknerView && !eyepiece?.ready;
    // Incomplete fundus setup must leave the real patient visible for aiming.
    // Bruckner retains visible eye outlines; its pupils illuminate independently.
    if (background.current) background.current.opacity = brucknerView || eyepiece?.ready ? 1 : .12;
    border.current?.color.set(eyepiece?.ready ? "#8df5d3" : "#f9d178");
  });
  useEffect(() => {
    root.current?.traverse(object => {
      if (!(object instanceof Mesh)) return;
      let ancestor: import("three").Object3D | null = object;
      object.renderOrder = 1156;
      while (ancestor) {
        if (typeof ancestor.userData.xrScopeOrder === "number") { object.renderOrder = ancestor.userData.xrScopeOrder; break; }
        ancestor = ancestor.parent;
      }
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      // Keep the vignette, observation and labels in one ordered render pass;
      // otherwise Three draws a transparent vignette after opaque text.
      materials.forEach(material => { material.transparent = true; material.depthTest = false; material.depthWrite = false; });
    });
  });
  if (!active || !eyepiece) return null;
  return <group ref={root} visible={false} userData={{ xrScopeView: true, xrIgnoreRay: true }}>
    <mesh position={[0, 0, -.012]} userData={{ xrScopeOrder: 1149 }}><ringGeometry args={[.247, 1.2, 64]} /><meshBasicMaterial color="#000000" transparent opacity={.45} /></mesh>
    <mesh position={[0, 0, -.006]} userData={{ xrScopeOrder: 1150, xrScopeBackground: true }}><circleGeometry args={[.24, 64]} /><meshBasicMaterial ref={background} color="#040909" transparent opacity={brucknerView ? 1 : .12} /></mesh>
    <mesh userData={{ xrScopeOrder: 1155 }}><ringGeometry args={[.24, .247, 64]} /><meshBasicMaterial ref={border} args={[{ color: "#f9d178" }]} /></mesh>
    <group ref={observation} visible={false} position={[0, .025, 0]} scale={brucknerView ? 9 : 7.5} userData={{ xrScopeViewObservation: true, xrScopeOrder: 1152 }}><XRScopeObservation brucknerView={brucknerView} fundusView={fundusView} /></group>
    <group ref={guide} visible={false} userData={{ xrScopeViewGuide: true, xrScopeOrder: 1152 }}>
      <mesh><ringGeometry args={[.02, .023, 32]} /><meshBasicMaterial color="#a3b6b1" /></mesh>
      <mesh><planeGeometry args={[.08, .002]} /><meshBasicMaterial color="#a3b6b1" /></mesh>
      <mesh><planeGeometry args={[.002, .08]} /><meshBasicMaterial color="#a3b6b1" /></mesh>
    </group>
    <XRSign text={[eyepiece.title]} p={[0, .18, .008]} size={[.25, .025]} bg="#102329" fg="#e8fff9" />
    {brucknerView && <><XRSign text={["OD · RIGHT"]} p={[-.108, -.08, .008]} size={[.18, .03]} bg="#040909" fg="#d6e8df" /><XRSign text={["OS · LEFT"]} p={[.108, -.08, .008]} size={[.18, .03]} bg="#040909" fg="#d6e8df" /></>}
  </group>;
}
