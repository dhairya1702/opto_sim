import { useEffect, useRef } from "react";
import { DoubleSide, type Group } from "three";
import type { CoverEye, CoverPosition } from "../interaction/cover";
import { COVER_GUIDE_HALF_SIZE, xrCoverGuideAnchors } from "../interaction/xrPracticeBatch";

const anchors = xrCoverGuideAnchors();
const GOLD = "#f3c969", GREEN = "#65c9b6";

/**
 * Practice-only placement guide for the cover tests, in the style of the motility gaze rings.
 * Exactly one ring at a time, with no text: it marks where the paddle goes for the current
 * ordered step. It never advances or records anything.
 */
export function XRCoverGuide({ target, current, progress }: {
  /** Required position for the current step and the eye it refers to (covered or just uncovered). */
  target: { position: CoverPosition; eye: CoverEye };
  /** Where the paddle currently is, as classified by the shared sequence geometry. */
  current: CoverPosition | null;
  /** 0–1 hold progress for the current step. */
  progress: number;
}) {
  const root = useRef<Group | null>(null);
  useEffect(() => { root.current?.traverse(object => { object.raycast = () => undefined; }); });
  const awayStep = target.position === "away";
  const inPlace = current === target.position;
  // The cover ring matches the accepted paddle zone; the away ring is a simple round target.
  const scale: [number, number, number] = awayStep ? [.04, .04, 1] : [COVER_GUIDE_HALF_SIZE[0], COVER_GUIDE_HALF_SIZE[1], 1];
  return <group ref={root} userData={{ xrIgnoreRay: true, xrCoverGuide: true, coverGuideTarget: target.position, coverGuideEye: target.eye }}>
    <group position={awayStep ? anchors.away[target.eye] : anchors.cover[target.eye]}
      userData={awayStep ? { coverGuideAway: target.eye } : { coverGuideRing: target.eye }}>
      <mesh scale={scale} renderOrder={1150}>
        <ringGeometry args={[.86, 1, 48]} />
        <meshBasicMaterial color={inPlace ? GREEN : GOLD} transparent opacity={.95} side={DoubleSide} depthWrite={false} />
      </mesh>
      {progress > 0 && <mesh position={[0, 0, .001]} scale={scale} renderOrder={1151}>
        <ringGeometry args={[.66, .8, 48, 1, Math.PI / 2, Math.PI * 2 * Math.min(1, progress)]} />
        <meshBasicMaterial color="#fff0a8" side={DoubleSide} depthWrite={false} />
      </mesh>}
    </group>
  </group>;
}
