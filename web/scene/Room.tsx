import { Component, Suspense, useEffect, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import type { WebGLRenderer } from "three";
import { Edges } from "@react-three/drei";
import { Box, ConsultingRoomShell, Patient, Refraction, Retinoscope, Sign, SlitLamp, Trolley } from "./Models";
import { Controller } from "../interaction/Controller";
import { XRConsultationController, type ConsultationExam, type ConsultationPanel } from "../interaction/XRConsultationController";
import type { ClinicalCase, Eye, StationId } from "../domain/types";
import { HeldInstrument } from "./ExaminationView";
type Props = {
  active: boolean;
  caseData: ClinicalCase;
  xrActive?: boolean;
  xrPreview?: boolean;
  suspended?: boolean;
  target: StationId | null;
  onTarget: (id: StationId | null, examId?: string) => void;
  onInteract: (id: StationId, examId?: string) => void;
  held?: string;
  visit: { id: StationId; seq: number } | null;
  onCanvas: (c: HTMLCanvasElement) => void;
  onRenderer?: (renderer: WebGLRenderer) => void;
  patientName?: string;
  onXRExit?: () => void;
  onXRPanel?: (panel: ConsultationPanel) => void;
  onXRProcedureComplete?: (exam: ConsultationExam, mode: string, observation: string, eye?: Eye) => boolean | void;
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
export function ConsultationInterior({ held, xr = false }: { held?: string; xr?: boolean }) {
  return (
    <>
      <ConsultingRoomShell />
      <group userData={{ station: "patient" }}>
        <Patient xr={xr} />
      </group>
      <group userData={{ station: "trolley" }}>
        <Trolley held={held} portable={!xr} />
      </group>
      <group userData={{ station: "fundus", examId: "fundus" }}>
        {!xr && held !== "fundus" && <Retinoscope p={[-1.13, 0.91, 1.04]} ophthalmo />}
      </group>
      <group userData={{ station: "refraction", examId: "subjective" }}>
        <Refraction portable={!xr} />
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
          camera={{ position: [0, 1.6, 1.65], fov: 66, near: 0.01, far: 20 }}
          onCreated={({ gl }) => {
            gl.xr.enabled = true;
            props.onCanvas(gl.domElement);
            props.onRenderer?.(gl);
            gl.domElement.addEventListener("webglcontextlost", props.onFailure);
            setLoaded(true);
          }}
          fallback={
            <div className="scene-fallback">
              3D is unavailable. Use the accessible station list to complete the encounter.
            </div>
          }
        >
          <ConsultationInterior held={props.held} xr={Boolean(props.xrActive)} />
          <Controller
            active={props.active && !props.xrActive}
            onTarget={props.onTarget}
            onInteract={props.onInteract}
            visit={props.visit}
          />
          <XRConsultationController
            caseData={props.caseData}
            active={Boolean(props.xrActive && props.active)}
            preview={Boolean(props.xrPreview && props.active)}
            patientName={props.patientName}
            onOpenPanel={props.onXRPanel}
            onExitVR={props.onXRExit}
            onInteract={props.onInteract}
            onProcedureComplete={props.onXRProcedureComplete}
          />
          {props.target && <Highlight id={props.target} />}
          {props.held && !props.xrActive && props.held !== "anterior" && (
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
