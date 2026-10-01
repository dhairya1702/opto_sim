import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Group, Mesh, Vector3, PointLight } from "three";
import { Cylinder, NearVisionCard, Retinoscope, Paddle, Ring, Sign } from "./Models";
import { MotilityExamination } from "./MotilityExamination";
import { EyeSurface } from "./EyeSurface";
import { PosteriorPole } from './PosteriorPole';
import { ManualAcuityExamination } from "./ManualAcuityExamination";
import { ManualPupilExamination } from "./ManualPupilExamination";
import { ManualCoverExamination } from "./ManualCoverExamination";
import { ManualNearPupilExamination } from "./ManualNearPupilExamination";
import { ManualRetinoscopyExamination } from "./ManualRetinoscopyExamination";
import type { ExamConfig } from "../domain/types";
export type ExaminationAnimation = {
  examId: string;
  config: ExamConfig;
  equipment: string;
  name: string;
};
export function Instrument({ id }: { id: string }) {
  if (id === "objective" || id === "fundus") return <Retinoscope ophthalmo={id === "fundus"} />;
  if (id === "near") return <NearVisionCard r={[Math.PI / 2, 0, 0]} />;
  if (["distance", "pinhole", "cover"].includes(id))
    return <Paddle p={[0, 0.1, 0]} pinhole={id === "pinhole"} />;
  if (id === "subjective")
    return (
      <group>
        <Ring p={[-0.078, 0, 0]} />
        <Ring p={[0.078, 0, 0]} />
      </group>
    );
  if (id === "pupils")
    return (
      <group>
        <group position={[-0.035, 0, 0]}>
          <Cylinder h={0.22} radius={0.017} c="#c7d1ce" />
          <Cylinder p={[0, 0.12, 0]} h={0.025} radius={0.021} c="#283a3d" />
        </group>
        <group position={[0.05, 0, 0]}>
          <Cylinder h={0.2} radius={0.006} c="#d8e2dc" />
          <mesh position={[0, 0.115, 0]}>
            <sphereGeometry args={[0.033, 18, 12]} />
            <meshStandardMaterial color="#d44f42" roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.115, 0.018]}>
            <ringGeometry args={[0.012, 0.021, 20]} />
            <meshBasicMaterial color="#f4d75e" />
          </mesh>
        </group>
      </group>
    );
  return (
    <group>
      <Cylinder h={0.22} radius={0.007} c="#c7d1ce" />
      <Cylinder p={[0, 0.12, 0]} h={0.025} radius={0.021} c="#283a3d" />
    </group>
  );
}
export function HeldInstrument({ id }: { id: string }) {
  const ref = useRef<Group>(null);
  const age = useRef(0);
  useFrame(({ camera }, dt) => {
    age.current = Math.min(1, age.current + dt * 2);
    const offset = new Vector3(
      0.29,
      -0.32 + (1 - Math.sin((age.current * Math.PI) / 2)) * 0.3,
      -0.55,
    ).applyQuaternion(camera.quaternion);
    ref.current!.position.copy(camera.position).add(offset);
    ref.current!.quaternion.copy(camera.quaternion);
  });
  return (
    <group ref={ref} rotation={[0, 0, -0.25]}>
      <Instrument id={id} />
    </group>
  );
}
function Demonstration({
  animation,
  progress,
  movement,
}: {
  animation: ExaminationAnimation;
  progress: number;
  movement: MutableRefObject<{ x: number; y: number; used: boolean }>;
}) {
  const tool = useRef<Group>(null);
  const light = useRef<PointLight>(null);
  const slit = useRef<Mesh>(null);
  const selectedX = animation.config.eye === "OD" ? -0.2 : animation.config.eye === "OS" ? 0.2 : 0;
  useFrame(({ camera, size }) => {
    const t = Math.min(1, progress * 4);
    const eyeX = animation.config.eye === "OD" ? -0.2 : animation.config.eye === "OS" ? 0.2 : 0;
    const baseDistance = eyeX === 0 ? 1.0 : 0.66;
    const distance = Math.max(
      baseDistance,
      (eyeX === 0 ? 0.42 : 0.23) / (Math.tan((43 * Math.PI) / 360) * (size.width / size.height)),
    );
    camera.position.set(eyeX * t, 0.06 * (1 - t), distance + 0.18 * (1 - t));
    camera.lookAt(eyeX * t, 0, 0);
    if (tool.current) {
      tool.current.position.set(
        movement.current.used
          ? eyeX + movement.current.x * (eyeX === 0 ? 0.38 : 0.17)
          : animation.examId === "cover"
            ? Math.sin(progress * Math.PI * 4) * 0.22
            : 0.25 + Math.sin(progress * Math.PI * 3) * 0.08,
        movement.current.used ? movement.current.y * 0.2 - 0.12 : -0.16,
        0.22,
      );
      tool.current.rotation.z = -0.35;
      if (light.current)
        light.current.position.set(tool.current.position.x, tool.current.position.y + 0.12, 0.2);
    }
    if (slit.current)
      slit.current.position.set(
        eyeX +
          (movement.current.used
            ? movement.current.x * 0.13
            : Math.sin(progress * Math.PI * 2) * 0.09),
        0,
        0.052,
      );
  });
  const pupils = animation.examId === "pupils";
  return (
    <>
      <color attach="background" args={["#101d22"]} />
      <ambientLight intensity={1.3} />
      <directionalLight position={[-1, 2, 3]} intensity={1.6} />
      {animation.examId==='fundus'&&<PosteriorPole x={selectedX} movement={movement}/>}
      {animation.examId!=='fundus'&&selectedX <= 0 && (
        <EyeSurface
          x={-0.2}
          pupils={pupils}
          motility={animation.examId === "motility"}
          progress={progress}
          movement={movement}
        />
      )}
      {animation.examId!=='fundus'&&selectedX >= 0 && (
        <EyeSurface
          x={0.2}
          pupils={pupils}
          motility={animation.examId === "motility"}
          progress={progress}
          movement={movement}
        />
      )}
      {["distance", "pinhole", "near"].includes(animation.examId) && (
        <Sign
          text={
            animation.examId === "near"
              ? ["NEAR · 40 cm", "N notation", "Authored measurement"]
              : ["DISTANCE · 6 m", "E  F  P", "Simulated chart"]
          }
          p={[selectedX, 0.14, -0.06]}
          size={[0.26, 0.105]}
          bg="#dfe8df"
          fg="#263c3e"
        />
      )}
      {animation.examId !== "anterior" && animation.examId!=='fundus' && (
        <group ref={tool}>
          <Instrument id={animation.examId} />
        </group>
      )}
      {pupils && (
        <pointLight
          ref={light}
          position={[Math.sin(progress * Math.PI * 3) * 0.25, 0, 0.2]}
          intensity={0.3}
          distance={0.7}
        />
      )}
      {animation.examId === "anterior" && (
        <mesh ref={slit} position={[selectedX, 0, 0.052]}>
          <planeGeometry args={[0.01, 0.17]} />
          <meshBasicMaterial color="#fff3bb" transparent opacity={0.7} />
        </mesh>
      )}
    </>
  );
}
export function ExaminationView(props: {
  animation: ExaminationAnimation;
  onComplete: (observation?: string) => void;
  onCancel: () => void;
}) {
  if (props.animation.examId === "motility")
    return <MotilityExamination onComplete={props.onComplete} onCancel={props.onCancel} />;
  if (["distance", "pinhole", "near"].includes(props.animation.examId))
    return (
      <ManualAcuityExamination
        examId={props.animation.examId as "distance" | "pinhole" | "near"}
        config={props.animation.config}
        name={props.animation.name}
        onComplete={props.onComplete}
        onCancel={props.onCancel}
      />
    );
  if (props.animation.examId === "pupils")
    return props.animation.config.mode === "near_response" ? (
      <ManualNearPupilExamination
        onComplete={props.onComplete}
        onCancel={props.onCancel}
      />
    ) : (
      <ManualPupilExamination
        config={props.animation.config}
        onComplete={props.onComplete}
        onCancel={props.onCancel}
      />
    );
  if (props.animation.examId === "cover")
    return (
      <ManualCoverExamination
        config={props.animation.config}
        onComplete={props.onComplete}
        onCancel={props.onCancel}
      />
    );
  if (props.animation.examId === "objective")
    return (
      <ManualRetinoscopyExamination
        config={props.animation.config}
        onComplete={props.onComplete}
        onCancel={props.onCancel}
      />
    );
  return <ScriptedExaminationView {...props} />;
}
function ScriptedExaminationView({
  animation,
  onComplete,
  onCancel,
}: {
  animation: ExaminationAnimation;
  onComplete: () => void;
  onCancel: () => void;
}) {
  const [progress, setProgress] = useState(0);
  const [ready, setReady] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const reduced = useRef(matchMedia("(prefers-reduced-motion: reduce)").matches);
  const completed = useRef(false);
  const movement = useRef({ x: 0.5, y: 0, used: false });
  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  useEffect(() => {
    const start = performance.now();
    const timer = setInterval(() => {
      const p = Math.min(1, (performance.now() - start) / (reduced.current ? 600 : 4500));
      setProgress((previous) => Math.max(previous, p));
      if (p === 1) {
        setReady(true);
        clearInterval(timer);
      }
    }, 40);
    return () => clearInterval(timer);
  }, []);
  const finish = () => {
    if (completed.current) return;
    completed.current = true;
    onComplete();
  };
  return (
    <dialog
      ref={dialog}
      className="examination-stage"
      aria-labelledby="examination-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
    >
      <header>
        <div>
          <p className="eyebrow">
            SIMULATED EXAMINATION ·{" "}
            {animation.config.eye === "OD"
              ? "RIGHT EYE"
              : animation.config.eye === "OS"
                ? "LEFT EYE"
                : "BOTH EYES"}
          </p>
          <h1 id="examination-title">{animation.name}</h1>
        </div>
        <button className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </header>
      <div
        className="eye-viewport"
        tabIndex={0}
        role="application"
        aria-label="Move examination instrument with mouse, touch or arrow keys"
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          movement.current = {
            x: Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1)),
            y: Math.max(-1, Math.min(1, 1 - ((e.clientY - r.top) / r.height) * 2)),
            used: true,
          };
        }}
        onKeyDown={(e) => {
          if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
          e.preventDefault();
          movement.current = {
            x: Math.max(
              -1,
              Math.min(
                1,
                movement.current.x +
                  (e.key === "ArrowLeft" ? -0.1 : e.key === "ArrowRight" ? 0.1 : 0),
              ),
            ),
            y: Math.max(
              -1,
              Math.min(
                1,
                movement.current.y + (e.key === "ArrowUp" ? 0.1 : e.key === "ArrowDown" ? -0.1 : 0),
              ),
            ),
            used: true,
          };
        }}
      >
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: [0, 0.1, 1.35], fov: 43 }}
          fallback={<p>Close-up unavailable. You can still complete this scripted examination.</p>}
        >
          <Demonstration animation={animation} progress={progress} movement={movement} />
        </Canvas>
        <span className="visual-label">
          {animation.examId==='fundus'?'Schematic posterior pole · limited undilated view · move to explore':'Move mouse or use arrow keys to position the instrument · illustrative view'}
        </span>
      </div>
      <footer>
        <p>
          {ready
            ? "Examination complete. Record the authored finding to your notebook."
            : `${animation.equipment} positioned automatically. Observing the selected procedure…`}
        </p>
        <progress value={progress} max={1} aria-label="Examination animation progress" />
        <div className="button-row">
          <button
            className="secondary"
            onClick={() => {
              setProgress(1);
              setReady(true);
            }}
            disabled={ready}
          >
            Skip animation
          </button>
          <button className="primary" onClick={finish} disabled={!ready}>
            Record finding & return to room →
          </button>
        </div>
        <p className="small muted">
          The animation illustrates the procedure. It does not assess manual technique or simulate
          optical measurements.
        </p>
      </footer>
    </dialog>
  );
}
