import { useEffect, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { Object3D } from "three";

/** Move the canonical patient's existing iris/pupil groups, and restore on exit. */
export function useClinicEyeMotion(active: boolean) {
  const { scene } = useThree();
  const eyes = useMemo(() => new Map<"OD" | "OS", Object3D>(), []);
  useEffect(() => {
    scene.traverse(object => {
      const eye = object.userData.consultationGaze;
      if (eye === "OD" || eye === "OS") eyes.set(eye, object);
    });
    return () => { eyes.forEach(eye => eye.position.set(0, 0, 0)); eyes.clear(); };
  }, [active, scene, eyes]);
  return eyes;
}
