import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, Quaternion, Vector3 } from "three";
import { XRPanelButton, XRRoundedPanel, XRSign } from "./XRClinicPanels";

type Result = { id: number; kind: "correct" | "retry" | "incomplete" | "progress"; message: string };
export const XR_RESULT_DURATION_MS = 5000;
export const XR_RESULT_CARD_DISTANCE = 1.55;
export const XR_RESULT_CARD_WIDTH = .62;

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
    if (line && line.length + word.length + 1 > 34) { lines.push(line); line = ""; }
    line += (line ? " " : "") + word;
  }
  if (line) lines.push(line);
  return lines;
}

/** Shared feedback; only a correct result exposes the explicit next-case action. */
export function XRPracticeResultHUD({ result, active, onTryNewCase, nextCaseLabel = "TRY NEW CASE" }: {
  result: Result | null; active: boolean; onTryNewCase?: () => void; nextCaseLabel?: string;
}) {
  const root = useRef<Group>(null);
  const pose = useRef({ position: new Vector3(), rotation: new Quaternion(), offset: new Vector3() });
  useFrame(({ gl, camera }) => {
    if (!root.current) return;
    const viewer = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    const { position, rotation, offset } = pose.current;
    viewer.getWorldPosition(position); viewer.getWorldQuaternion(rotation);
    root.current.position.copy(position).add(offset.set(0, -.03, -XR_RESULT_CARD_DISTANCE).applyQuaternion(rotation));
    root.current.quaternion.copy(rotation); root.current.updateMatrixWorld(true);
  }, -1);
  useLayoutEffect(() => {
    root.current?.traverse(object => {
      if (!(object instanceof Mesh)) return;
      object.renderOrder = 1200;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => {
        // Fitted instruments use Three's transparent render pass for return
        // fades. Keep the result card in that same pass, ordered last, so a
        // trial frame or filter cannot be drawn through the feedback.
        material.transparent = true;
        material.depthTest = false;
        material.depthWrite = false;
      });
    });
  });
  if (!active || !result) return null;
  const lines = resultLines(result.message);
  const bodyHeight = Math.max(.08, lines.length * .038);
  const heading = result.kind === "correct" ? "CORRECT" : result.kind === "progress" ? "PROGRESS SAVED" : result.kind === "retry" ? "TRY AGAIN" : "NOT READY YET";
  const background = result.kind === "correct" ? "#244f48" : result.kind === "progress" ? "#315b56" : result.kind === "retry" ? "#584238" : "#294852";
  const canTryNewCase = result.kind === "correct" && Boolean(onTryNewCase);
  const cardHeight = bodyHeight + .13 + (canTryNewCase ? .105 : 0);
  const top = cardHeight / 2;
  return <group ref={root} userData={{ xrPracticeResultHUD: true, xrIgnoreRay: !canTryNewCase, xrPanel: canTryNewCase || undefined, xrPriorityPanel: canTryNewCase || undefined }}>
    <group userData={{ xrPracticeResultCard: true, width: XR_RESULT_CARD_WIDTH, height: cardHeight }}>
      <XRRoundedPanel width={XR_RESULT_CARD_WIDTH} height={cardHeight} radius={.045} color={background} position={[0, 0, -.012]} />
    </group>
    <XRSign text={[heading]} p={[0, top - .045, .004]} size={[.54, .05]} bg={background} fg="#f5fbf9" />
    <XRSign text={lines} p={[0, top - .085 - bodyHeight / 2, .006]} size={[.54, bodyHeight]} bg={background} fg="#edf5f2" />
    {canTryNewCase && <XRPanelButton label={nextCaseLabel} position={[0, -top + .05, .014]} width={.36} onClick={() => onTryNewCase?.()} />}
  </group>;
}
