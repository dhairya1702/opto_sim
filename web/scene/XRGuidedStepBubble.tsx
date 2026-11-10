import { useLayoutEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, Quaternion, Vector3 } from "three";
import { XRRoundedPanel, XRSign } from "./XRClinicPanels";

export const XR_GUIDANCE_DISTANCE = 1.4;
export const XR_GUIDANCE_BOTTOM = -.64;
export const XR_GUIDANCE_WIDTH = .82;

export function wrapGuidedStepLines(lines: readonly string[], maxCharacters = 44): string[] {
  return lines.flatMap(line => {
    const words = line.trim().split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const wrapped: string[] = [];
    let current = "";
    words.forEach(word => {
      const candidate = current ? `${current} ${word}` : word;
      if (current && candidate.length > maxCharacters) {
        wrapped.push(current);
        current = word;
      } else current = candidate;
    });
    if (current) wrapped.push(current);
    return wrapped;
  });
}

export function XRGuidedStepBubble({ stepId, title, lines }: {
  stepId: string;
  /** Retained for adapter compatibility; numbering and context are not displayed. */
  stepNumber?: number;
  total?: number;
  title: string;
  lines: readonly string[];
  context?: string;
  complete?: boolean;
}) {
  const root = useRef<Group | null>(null);
  const pose = useRef({ position: new Vector3(), rotation: new Quaternion(), offset: new Vector3() });
  const titleLines = wrapGuidedStepLines([title], 38);
  const wrappedLines = wrapGuidedStepLines(lines, 48);
  const titleHeight = (titleLines.length + 1) * .036;
  const bodyHeight = wrappedLines.length ? (wrappedLines.length + 1) * .030 : 0;
  const height = titleHeight + bodyHeight + .036;
  useFrame(({ gl, camera }) => {
    if (!root.current) return;
    const immersive = gl.xr.isPresenting;
    const viewer = immersive ? gl.xr.getCamera() : camera;
    const { position, rotation, offset } = pose.current;
    viewer.getWorldPosition(position); viewer.getWorldQuaternion(rotation);
    // Desktop uses its actual frustum so narrow windows retain the full card.
    // XR uses a comfortable fixed angular placement in the lower binocular view.
    const halfHeight = XR_GUIDANCE_DISTANCE / camera.projectionMatrix.elements[5];
    const halfWidth = XR_GUIDANCE_DISTANCE / camera.projectionMatrix.elements[0];
    const scale = immersive ? 1 : Math.min(1, halfWidth * 1.7 / XR_GUIDANCE_WIDTH, halfHeight * .7 / height);
    const bottom = immersive ? XR_GUIDANCE_BOTTOM : -halfHeight * .86;
    root.current.position.copy(position).add(offset.set(0, bottom + height * scale / 2, -XR_GUIDANCE_DISTANCE).applyQuaternion(rotation));
    root.current.quaternion.copy(rotation);
    root.current.scale.setScalar(scale);
    root.current.updateMatrixWorld(true);
  }, -1);
  useLayoutEffect(() => {
    let order = 1100;
    root.current?.traverse(object => {
      object.raycast = () => undefined;
      if (!(object instanceof Mesh)) return;
      object.renderOrder = order++;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => {
        material.transparent = true;
        material.depthTest = false;
        material.depthWrite = false;
      });
    });
  });
  return <group ref={root}
    userData={{ xrGuidedStepBubble: true, xrIgnoreRay: true, guidedStepId: stepId }}>
    <XRRoundedPanel width={XR_GUIDANCE_WIDTH} height={height} radius={.038} color="#416254" topColor="#a3c3b6" opacity={.12} />
    <XRRoundedPanel width={XR_GUIDANCE_WIDTH - .004} height={height - .004} radius={.036} color="#142e24" topColor="#4b6458" opacity={.45} position={[0, 0, .001]} />
    <XRSign transparentBackground text={titleLines} p={[0, height / 2 - .016 - titleHeight / 2, .003]}
      size={[XR_GUIDANCE_WIDTH - .06, titleHeight]} fg="#f4fcf8" />
    {wrappedLines.length > 0 && <XRSign transparentBackground text={wrappedLines} p={[0, height / 2 - .020 - titleHeight - bodyHeight / 2, .003]}
      size={[XR_GUIDANCE_WIDTH - .06, bodyHeight]} fg="#edf6ef" />}
  </group>;
}
