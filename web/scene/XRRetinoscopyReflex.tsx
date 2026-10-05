import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, ShaderMaterial } from "three";
import type { XRPupilEye } from "../interaction/xrPupils";
export type RetinoReflexVisual = { eye: XRPupilEye | null; offset: number; brightness: number; width: number; axis: 90 | 180 };
/** Illustrative reflex inside the actual patient's pupil, using shared motion/quality math. */
export function XRRetinoscopyReflex({ visual }: { visual: RetinoReflexVisual }) {
  const group = useRef<Group>(null);
  const material = useRef<ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ offset: { value: 0 }, brightness: { value: 1 }, width: { value: 1 }, horizontal: { value: false } }), []);
  useFrame(() => {
    if (!group.current || !material.current) return;
    group.current.visible = visual.eye !== null;
    if (!visual.eye) return;
    group.current.position.set(visual.eye === "OD" ? -.048 : .048, 1.5, -.568);
    uniforms.offset.value = visual.offset / .014;
    uniforms.brightness.value = visual.brightness;
    uniforms.width.value = visual.width;
    uniforms.horizontal.value = visual.axis === 180;
  });
  return <group ref={group} visible={false} userData={{ xrRetinoReflex: true, xrIgnoreRay: true }}>
    <mesh><circleGeometry args={[.007, 32]} /><shaderMaterial ref={material} uniforms={uniforms}
      vertexShader="varying vec2 v; void main(){v=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.); }"
      fragmentShader="varying vec2 v; uniform float offset; uniform float brightness; uniform float width; uniform bool horizontal; void main(){float axis=horizontal?v.y:v.x; float streak=exp(-pow((axis-.5-offset)/(.035+width*.22),2.)); vec3 c=mix(vec3(.24,.035,.015),vec3(.98,.43,.12),streak*brightness); gl_FragColor=vec4(c,1.); }" />
    </mesh>
  </group>;
}
