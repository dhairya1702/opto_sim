import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { getPerfSink } from "./perfFlag";

/** Runs before every other frame callback (R3F sorts ascending; negative priority keeps automatic rendering). */
const FIRST = -100_000;

/**
 * Mount only when `perfEnabled`. Times each frame from the first useFrame
 * callback to the end of renderer.render, in both desktop and WebXR loops.
 */
export function PerfFrameProbe() {
  const gl = useThree(state => state.gl);
  useEffect(() => {
    const original = gl.render;
    const timed: typeof gl.render = (scene, camera) => {
      const start = performance.now();
      original.call(gl, scene, camera);
      const end = performance.now();
      getPerfSink()?.frameEnd(end, end - start, gl);
    };
    gl.render = timed;
    return () => { if (gl.render === timed) gl.render = original; };
  }, [gl]);
  useFrame(() => { getPerfSink()?.frameStart(performance.now()); }, FIRST);
  return null;
}
