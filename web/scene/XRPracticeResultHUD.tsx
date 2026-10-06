import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, Quaternion, Vector3 } from "three";
import { XRSign } from "./XRClinicPanels";

type Result = { id: number; kind: "correct" | "retry" | "incomplete"; message: string };
export const XR_RESULT_DURATION_MS = 5000;

/** Each submission restarts the notice, including repeated identical responses. */
export function useXRPracticeResult() {
  const [result, setResult] = useState<Result | null>(null);
  const sequence = useRef(0);
  const showResult = useCallback((kind: Result["kind"], message: string) => {
    setResult({ id: ++sequence.current, kind, message });
  }, []);
  const clearResult = useCallback(() => setResult(null), []);
  useEffect(() => {
    if (!result) return;
    const timer = setTimeout(clearResult, XR_RESULT_DURATION_MS);
    return () => clearTimeout(timer);
  }, [result, clearResult]);
  return { result, showResult, clearResult };
}

// Wrap prose instead of shrinking a long response into one distant line.
function resultLines(message: string) {
  const lines: string[] = [];
  let line = "";
  for (const word of message.split(/\s+/).filter(Boolean)) {
    if (line && line.length + word.length + 1 > 44) { lines.push(line); line = ""; }
    line += (line ? " " : "") + word;
  }
  if (line) lines.push(line);
  return lines;
}

/** Read-only headset feedback; it never intercepts controller selection rays. */
export function XRPracticeResultHUD({ result, active }: { result: Result | null; active: boolean }) {
  const root = useRef<Group>(null);
  const pose = useRef({ position: new Vector3(), rotation: new Quaternion(), offset: new Vector3() });
  useFrame(({ gl, camera }) => {
    if (!root.current) return;
    const viewer = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    const { position, rotation, offset } = pose.current;
    viewer.getWorldPosition(position); viewer.getWorldQuaternion(rotation);
    root.current.position.copy(position).add(offset.set(0, -.04, -.9).applyQuaternion(rotation));
    root.current.quaternion.copy(rotation); root.current.updateMatrixWorld(true);
  }, -1);
  useEffect(() => {
    root.current?.traverse(object => {
      if (!(object instanceof Mesh)) return;
      object.renderOrder = 1200;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => { material.depthTest = false; material.depthWrite = false; });
    });
  });
  if (!active || !result) return null;
  const lines = resultLines(result.message);
  const height = Math.max(.18, (lines.length + 1) * .055);
  const heading = result.kind === "correct" ? "CORRECT" : result.kind === "retry" ? "TRY AGAIN" : "NOT READY YET";
  const background = result.kind === "correct" ? "#125346" : result.kind === "retry" ? "#573323" : "#173a4b";
  return <group ref={root} userData={{ xrPracticeResultHUD: true, xrIgnoreRay: true }}>
    <mesh position={[0, -.02, -.012]}><planeGeometry args={[.84, height + .18]} /><meshBasicMaterial color={background} /></mesh>
    <XRSign text={[heading]} p={[0, height / 2 + .015, 0]} size={[.78, .075]} bg={background} fg="#ffffff" />
    <XRSign text={lines} p={[0, -.065, .002]} size={[.78, height]} bg={background} fg="#ffffff" />
  </group>;
}
