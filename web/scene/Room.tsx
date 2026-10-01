import { Component, Suspense, useEffect, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import { Box, Cylinder, Patient, Refraction, Retinoscope, Sign, SlitLamp, Trolley } from "./Models";
import { Controller } from "../interaction/Controller";
import type { StationId } from "../domain/types";
import { HeldInstrument } from "./ExaminationView";
type Props = {
  active: boolean;
  suspended?: boolean;
  target: StationId | null;
  onTarget: (id: StationId | null, examId?: string) => void;
  onInteract: (id: StationId, examId?: string) => void;
  held?: string;
  visit: { id: StationId; seq: number } | null;
  onCanvas: (c: HTMLCanvasElement) => void;
  onFailure: () => void;
};
class SceneBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? (
      <div className="scene-fallback">
        The 3D room could not load. All examinations remain available in the station list.
      </div>
    ) : (
      this.props.children
    );
  }
}
const bounds: Record<StationId, { p: [number, number, number]; s: [number, number, number] }> = {
  patient: { p: [0, 0.92, -0.63], s: [0.85, 1.64, 0.93] },
  trolley: { p: [-1.37, 0.65, 0.75], s: [0.92, 1.3, 0.63] },
  refraction: { p: [-1.45, 0.64, -1.4], s: [0.91, 1.25, 1.26] },
  slit: { p: [1.35, 1.2, -0.95], s: [0.75, 0.8, 0.65] },
  fundus: { p: [-1.13, 1.09, 1.04], s: [0.18, 0.42, 0.16] },
  acuity: { p: [0.05, 1.84, -2.41], s: [0.69, 1, 0.03] },
};
function Highlight({ id }: { id: StationId }) {
  const b = bounds[id];
  return (
    <mesh position={b.p} raycast={() => null}>
      <boxGeometry args={b.s} />
      <meshBasicMaterial visible={false} />
      <Edges color="#5fa8a3" threshold={15} raycast={() => null} />
    </mesh>
  );
}
function Interior({ held }: { held?: string }) {
  return (
    <>
      <color attach="background" args={["#d4dedb"]} />
      <ambientLight intensity={0.9} />
      <hemisphereLight args={["#fbfff9", "#737d80", 1.7]} />
      <directionalLight
        position={[-2, 4, 2]}
        intensity={2.2}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-bias={-0.001}
      />
      <Box p={[0, -0.05, 0]} s={[4.15, 0.1, 5.15]} c="#d0d1c9" />
      {Array.from({ length: 7 }, (_, i) => (
        <Box key={`x${i}`} p={[-1.5 + i * 0.5, 0.002, 0]} s={[0.004, 0.002, 5]} c="#b9bdb6" />
      ))}
      {Array.from({ length: 9 }, (_, i) => (
        <Box key={`z${i}`} p={[0, 0.003, -2 + i * 0.5]} s={[4, 0.002, 0.004]} c="#b9bdb6" />
      ))}
      <Box p={[0, 1.5, -2.55]} s={[4.2, 3, 0.1]} c="#e3e8e2" />
      <Box p={[-2.05, 1.5, 0]} s={[0.1, 3, 5.1]} c="#edf0e9" />
      <Box p={[2.05, 1.5, 0]} s={[0.1, 3, 5.1]} c="#d4dfdb" />
      <Box p={[0, 1.5, 2.55]} s={[4.2, 3, 0.1]} c="#e8ebe5" />
      <Box p={[0, 3.04, 0]} s={[4.2, 0.08, 5.2]} c="#f1f2eb" />
      <Box p={[0, 0.07, -2.48]} s={[4, 0.14, 0.04]} c="#b0c0bc" />
      <Box p={[-1.98, 0.07, 0]} s={[0.04, 0.14, 5]} c="#b0c0bc" />
      <Box p={[1.98, 0.07, 0]} s={[0.04, 0.14, 5]} c="#b0c0bc" />
      <Box p={[0, 2.96, -0.6]} s={[1.4, 0.04, 0.65]} c="#fafbf0" />
      <pointLight position={[0, 2.7, -0.6]} intensity={5} distance={5} />
      <Box p={[-1.985, 1.92, -0.25]} s={[0.035, 1.25, 1.55]} c="#9bbab8" />
      {Array.from({ length: 12 }, (_, i) => (
        <Box
          key={i}
          p={[-1.96, 1.36 + i * 0.1, -0.25]}
          s={[0.025, 0.065, 1.52]}
          c="#edf0e5"
          r={[0, 0, 0.07]}
        />
      ))}
      <Box p={[1.42, 1.1, 2.48]} s={[0.85, 2.2, 0.04]} c="#b4c3bc" />
      <Cylinder
        p={[1.12, 1.02, 2.42]}
        h={0.16}
        radius={0.014}
        c="#788c8a"
        r={[0, 0, Math.PI / 2]}
      />
      <Sign text={["CONSULTATION 01", "OPTOMETRY"]} p={[-1.15, 2.28, -2.485]} size={[0.95, 0.33]} />
      <group userData={{ station: "patient" }}>
        <Patient />
      </group>
      <group userData={{ station: "trolley" }}>
        <Trolley held={held} />
      </group>
      <group userData={{ station: "fundus", examId: "fundus" }}>
        {held !== "fundus" && <Retinoscope p={[-1.13, 0.91, 1.04]} ophthalmo />}
      </group>
      <group userData={{ station: "refraction", examId: "subjective" }}>
        <Refraction />
      </group>
      <group userData={{ station: "slit", examId: "anterior" }}>
        <SlitLamp />
      </group>
      <group userData={{ station: "acuity" }}>
        <Box p={[0.05, 1.84, -2.445]} s={[0.72, 1.04, 0.08]} c="#273d42" />
        <Sign
          text={[
            "E",
            "F  P",
            "T  O  Z",
            "L  P  E  D",
            "P E C F D",
            "E D F C Z P",
            "SIMULATED DISPLAY",
          ]}
          p={[0.05, 1.84, -2.398]}
          size={[0.65, 0.97]}
          bg="#f8faf3"
          fg="#24363b"
        />
      </group>
      <Box p={[1.29, 1.98, -2.46]} s={[0.48, 0.6, 0.03]} c="#a6bdb6" />
      <Sign
        text={["EYE HEALTH", "Observe", "Ask · Assess · Explain"]}
        p={[1.29, 1.98, -2.438]}
        size={[0.44, 0.56]}
      />
    </>
  );
}
export function Room(props: Props) {
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("webgl2");
    if (!context) props.onFailure();
    else context.getExtension("WEBGL_lose_context")?.loseContext();
  }, []);
  return (
    <SceneBoundary onFailure={props.onFailure}>
      <Suspense fallback={<div className="scene-fallback">Preparing consultation room…</div>}>
        <Canvas
          shadows
          frameloop={props.suspended ? "never" : "always"}
          dpr={[1, 1.5]}
          camera={{ position: [0, 1.6, 1.65], fov: 66, near: 0.05, far: 20 }}
          onCreated={({ gl }) => {
            props.onCanvas(gl.domElement);
            gl.domElement.addEventListener("webglcontextlost", props.onFailure);
            setLoaded(true);
          }}
          fallback={
            <div className="scene-fallback">
              3D is unavailable. Use the accessible station list to complete the encounter.
            </div>
          }
        >
          <Interior held={props.held} />
          <Controller
            active={props.active}
            onTarget={props.onTarget}
            onInteract={props.onInteract}
            visit={props.visit}
          />
          {props.target && <Highlight id={props.target} />}
          {props.held && props.held !== "anterior" && (
            <group userData={{ held: true }}>
              <HeldInstrument key={props.held} id={props.held} />
            </group>
          )}
        </Canvas>
        {!loaded && <div className="scene-loading">Preparing consultation room…</div>}
      </Suspense>
    </SceneBoundary>
  );
}
