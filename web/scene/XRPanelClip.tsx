import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Matrix4, Mesh, Vector2, type Material } from "three";
import { perfCount } from "../perf/perfFlag";

/** Clip report text and illustrations to their reserved area in panel coordinates. */
export function XRPanelClip({ width, height, children }: { width: number; height: number; children: ReactNode }) {
  const root = useRef<Group>(null);
  const inverse = useRef(new Matrix4());
  const halfSize = useRef(new Vector2(width / 2, height / 2));
  const patches = useRef(new Map<Material, () => void>());
  useFrame(() => {
    if (!root.current) return;
    root.current.updateWorldMatrix(true, false);
    inverse.current.copy(root.current.matrixWorld).invert();
  }, -1);
  useLayoutEffect(() => () => {
    patches.current.forEach(restore => restore());
    patches.current.clear();
  }, []);
  useLayoutEffect(() => {
    halfSize.current.set(width / 2, height / 2);
    const present = new Set<Material>();
    root.current?.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const materials: Material[] = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        present.add(material);
        // One patch per material, including materials shared by several meshes.
        if (patches.current.has(material)) continue;
        const compile = material.onBeforeCompile;
        const cacheKey = material.customProgramCacheKey;
        const clippedCompile: Material["onBeforeCompile"] = (shader, renderer) => {
          compile.call(material, shader, renderer);
          shader.uniforms.reportInverse = { value: inverse.current };
          shader.uniforms.reportHalfSize = { value: halfSize.current };
          shader.vertexShader = `uniform mat4 reportInverse; varying vec2 reportPoint;\n${shader.vertexShader}`
            .replace("#include <project_vertex>", "#include <project_vertex>\nreportPoint = (reportInverse * modelMatrix * vec4(transformed, 1.0)).xy;");
          shader.fragmentShader = `uniform vec2 reportHalfSize; varying vec2 reportPoint;\n${shader.fragmentShader}`
            .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif (any(greaterThan(abs(reportPoint), reportHalfSize))) discard;");
        };
        const clippedCacheKey = () => `${cacheKey.call(material)}:bounded-report`;
        material.onBeforeCompile = clippedCompile;
        material.customProgramCacheKey = clippedCacheKey;
        material.needsUpdate = true;
        perfCount("report material patch");
        patches.current.set(material, () => {
          // Do not overwrite a hook replaced by another owner in the meantime.
          let restored = false;
          if (material.onBeforeCompile === clippedCompile) { material.onBeforeCompile = compile; restored = true; }
          if (material.customProgramCacheKey === clippedCacheKey) { material.customProgramCacheKey = cacheKey; restored = true; }
          if (restored) { material.needsUpdate = true; perfCount("report material restore"); }
        });
      }
    });
    // Reconcile after content commits without tearing down retained materials.
    for (const [material, restore] of patches.current) {
      if (present.has(material)) continue;
      restore();
      patches.current.delete(material);
    }
  });
  return <group ref={root} userData={{ xrIgnoreRay: true }}>{children}</group>;
}
