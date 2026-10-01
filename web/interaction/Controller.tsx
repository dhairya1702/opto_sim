import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Raycaster, Vector2, Vector3 } from "three";
import type { StationId } from "../domain/types";
import { stations, walkable } from "./navigation";
import { stationUnderRay, examUnderRay } from "./targeting";
export function Controller({
  active,
  onTarget,
  onInteract,
  visit,
}: {
  active: boolean;
  onTarget: (id: StationId | null, examId?: string) => void;
  onInteract: (id: StationId, examId?: string) => void;
  visit: { id: StationId; seq: number } | null;
}) {
  const { camera, gl, scene } = useThree();
  const keys = useRef(new Set<string>());
  const target = useRef<StationId | null>(null);
  const targetExam = useRef<string | undefined>(undefined);
  const angles = useRef({ yaw: 0, pitch: -0.035 });
  const input = useRef({ drag: false, moved: false, x: 0, y: 0 });
  const ray = useRef(new Raycaster());
  const activeRef = useRef(active);
  activeRef.current = active;
  const actionRef = useRef(onInteract);
  actionRef.current = onInteract;
  useEffect(() => {
    camera.position.set(0, 1.6, 1.65);
    camera.rotation.order = "YXZ";
  }, [camera]);
  useEffect(() => {
    // Read-only browser QA probe; eliminated from the production build.
    if (!import.meta.env.DEV) return;
    const canvas = gl.domElement as HTMLCanvasElement & { __optoView?: () => unknown };
    canvas.__optoView = () => ({
      position: camera.position.toArray(),
      rotation: [camera.rotation.x, camera.rotation.y, camera.rotation.z],
      target: target.current,
      targetExam: targetExam.current,
      pressedKeys: [...keys.current],
    });
    return () => {
      delete canvas.__optoView;
    };
  }, [camera, gl]);
  useEffect(() => {
    if (!visit) return;
    const s = stations.find((s) => s.id === visit.id)!;
    camera.position.set(...s.position);
    camera.lookAt(...s.look);
    angles.current = { yaw: camera.rotation.y, pitch: camera.rotation.x };
  }, [visit, camera]);
  useEffect(() => {
    keys.current.clear();
    input.current = { drag: false, moved: false, x: 0, y: 0 };
    if (!active) {
      target.current = null;
      onTarget(null);
    }
  }, [active, onTarget]);
  useEffect(() => {
    const canvas = gl.domElement;
    const clear = () => {
      keys.current.clear();
      input.current.drag = false;
    };
    const editable = (e: Event) =>
      e.target instanceof HTMLElement &&
      !!e.target.closest("input,textarea,select,button,[role=dialog]");
    const keydown = (e: KeyboardEvent) => {
      if (!activeRef.current || editable(e)) return;
      if (
        ["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright", "e"].includes(
          e.key.toLowerCase(),
        )
      ) {
        e.preventDefault();
        keys.current.add(e.key.toLowerCase());
      }
      if (e.key.toLowerCase() === "e" && !e.repeat && target.current)
        actionRef.current(target.current, examUnderRay(ray.current, scene.children));
    };
    const keyup = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const down = (e: PointerEvent) => {
      if (!activeRef.current || document.pointerLockElement === canvas) return;
      input.current = { drag: true, moved: false, x: e.clientX, y: e.clientY };
      canvas.focus();
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!activeRef.current) return;
      const locked = document.pointerLockElement === canvas;
      if (!locked && !input.current.drag) return;
      // Pointer capture/release can emit a synthetic screen-sized delta.
      // Never apply that delta as a camera turn.
      const rawX = locked ? e.movementX : e.clientX - input.current.x,
        rawY = locked ? e.movementY : e.clientY - input.current.y;
      if (locked && (Math.abs(rawX) > 400 || Math.abs(rawY) > 400)) return;
      const dx = Math.max(-100, Math.min(100, rawX)),
        dy = Math.max(-100, Math.min(100, rawY));
      if (Math.abs(dx) + Math.abs(dy) > 2) input.current.moved = true;
      input.current.x = e.clientX;
      input.current.y = e.clientY;
      angles.current.yaw -= dx * 0.0024;
      angles.current.pitch = Math.max(-1.12, Math.min(1.12, angles.current.pitch - dy * 0.0024));
    };
    const pick = (ndc: Vector2) => {
      ray.current.setFromCamera(ndc, camera);
      return stationUnderRay(ray.current, scene.children);
    };
    const up = (e: PointerEvent) => {
      if (!activeRef.current) return;
      if (document.pointerLockElement === canvas) {
        if (target.current)
          actionRef.current(target.current, examUnderRay(ray.current, scene.children));
      } else if (!input.current.moved) {
        const rect = canvas.getBoundingClientRect();
        const id = pick(
          new Vector2(
            ((e.clientX - rect.left) / rect.width) * 2 - 1,
            (-(e.clientY - rect.top) / rect.height) * 2 + 1,
          ),
        );
        const exam = examUnderRay(ray.current, scene.children);
        if (id && (id !== "trolley" || exam)) actionRef.current(id, exam);
      }
      input.current.drag = false;
    };
    window.addEventListener("keydown", keydown);
    window.addEventListener("keyup", keyup);
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", clear);
    document.addEventListener("pointerlockchange", clear);
    canvas.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("keydown", keydown);
      window.removeEventListener("keyup", keyup);
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", clear);
      document.removeEventListener("pointerlockchange", clear);
      canvas.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      clear();
    };
  }, [camera, gl, scene]);
  useFrame((_, dt) => {
    if (!active) return;
    camera.rotation.set(angles.current.pitch, angles.current.yaw, 0, "YXZ");
    const k = keys.current,
      forward = Number(k.has("w") || k.has("arrowup")) - Number(k.has("s") || k.has("arrowdown")),
      right = Number(k.has("d") || k.has("arrowright")) - Number(k.has("a") || k.has("arrowleft"));
    const movement = new Vector3(right, 0, -forward);
    if (movement.lengthSq()) {
      movement
        .normalize()
        .applyAxisAngle(new Vector3(0, 1, 0), angles.current.yaw)
        .multiplyScalar(Math.min(dt, 0.04) * 1.15);
      if (walkable(camera.position.x + movement.x, camera.position.z))
        camera.position.x += movement.x;
      if (walkable(camera.position.x, camera.position.z + movement.z))
        camera.position.z += movement.z;
    }
    camera.position.y = 1.6;
    ray.current.setFromCamera(new Vector2(0, 0), camera);
    let found = stationUnderRay(ray.current, scene.children);
    const exam = examUnderRay(ray.current, scene.children);
    if (found === "trolley" && !exam) found = null;
    if (found !== target.current || exam !== targetExam.current) {
      target.current = found;
      targetExam.current = exam;
      onTarget(found, exam);
    }
  });
  return null;
}
