import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Matrix4, Mesh, Vector2, type Material } from "three";

/** Clip report text and illustrations to their reserved area in panel coordinates. */
export function XRPanelClip({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  const root = useRef<Group>(null);
  const inverse = useRef(new Matrix4());
  useFrame(() => {
    if (!root.current) return;
    root.current.updateWorldMatrix(true, false);
    inverse.current.copy(root.current.matrixWorld).invert();
  }, -1);
  useLayoutEffect(() => {
    const cleanups: (() => void)[] = [];
    root.current?.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const materials: Material[] = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        const compile = material.onBeforeCompile;
        const cacheKey = material.customProgramCacheKey;
        material.onBeforeCompile = (shader, renderer) => {
          compile.call(material, shader, renderer);
          shader.uniforms.reportInverse = { value: inverse.current };
          shader.uniforms.reportHalfSize = { value: new Vector2(width / 2, height / 2) };
          shader.vertexShader = `uniform mat4 reportInverse; varying vec2 reportPoint;\n${shader.vertexShader}`
            .replace("#include <project_vertex>", "#include <project_vertex>\nreportPoint = (reportInverse * modelMatrix * vec4(transformed, 1.0)).xy;");
          shader.fragmentShader = `uniform vec2 reportHalfSize; varying vec2 reportPoint;\n${shader.fragmentShader}`
            .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif (any(greaterThan(abs(reportPoint), reportHalfSize))) discard;");
        };
        material.customProgramCacheKey = () => `${cacheKey.call(material)}:bounded-report`;
        material.needsUpdate = true;
        cleanups.push(() => {
          material.onBeforeCompile = compile;
          material.customProgramCacheKey = cacheKey;
          material.needsUpdate = true;
        });
      }
    });
    return () => cleanups.forEach(cleanup => cleanup());
  }, [width, height, children]);
  return <group ref={root} userData={{ xrIgnoreRay: true }}>{children}</group>;
}
