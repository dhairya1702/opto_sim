import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from "three";
import { useXRClinicRuntime, type XRClinicInterruption } from "../../interaction/useXRClinicRuntime";
import { CLINIC_PATIENT_EYES, CLINIC_PUPIL_RADIUS } from "../../interaction/clinicPatient";
import { brucknerScenarios, type BrucknerScenario } from "../../interaction/brucknerPractice";
import { xrBrucknerTechnique } from "../../interaction/xrPracticeBatch";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import type { BrucknerScopeView } from "../../scene/XRScopeOptics";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonField } from "./PracticeLessonUI";

const fields: LessonField[] = [{ id: "brightness", label: "Both red reflexes", choices: Object.entries(brucknerScenarios).map(([id, item]) => [id, item.label]) }];
const empty = () => ({ ready: false, distanceCm: 0, viewAligned: false, illuminated: false });
export function BrucknerPracticeController({ active, preview = false, scenario, onComplete, onNext, onExit, onMirror }: {
  active: boolean; preview?: boolean; scenario: BrucknerScenario; onComplete: () => void; onNext: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const { gl, camera } = useThree();
  const lesson = usePracticeLesson(onComplete);
  const [fixation, setFixation] = useState(false);
  const setup = useRef({ fixation }); setup.current = { fixation };
  const [technique, setTechnique] = useState(empty);
  const lastReady = useRef(false);
  const capturedRef = useRef(false), captureArmed = useRef(true);
  const [captured, setCaptured] = useState(false);
  const visual = useMemo<BrucknerScopeView>(() => ({ visible: false, brighter: "equal" }), []);
  visual.brighter = scenario;
  const reflexes = useRef<Group>(null);
  const interrupt = useCallback((reason?: XRClinicInterruption) => {
    if (capturedRef.current && reason && ["release", "panel", "pickup", "transfer", "tracking", "procedure"].includes(reason)) return;
    capturedRef.current = false; captureArmed.current = reason === "configuration"; setCaptured(false);
    lastReady.current = false; visual.visible = false; lesson.clearPending();
  }, [visual, lesson.clearPending]);
  const runtime = useXRClinicRuntime({ active: active && !preview, editorOpen: lesson.mode !== "none", onInterrupt: interrupt,
    onMenu: open => lesson.setMode(open ? "menu" : "none"), onSelection: selection => { if (selection.station === "patient") lesson.setMode("menu"); },
  });
  const vectors = useMemo(() => ({ viewer: new Vector3(), look: new Vector3(), aperture: new Vector3(), rotation: new Quaternion() }), []);
  const sample = () => {
    if (!active || !runtime.frameValid.current || !runtime.workingPose("fundus")) return empty();
    const origin = runtime.origin.toArray() as [number, number, number], forward = runtime.direction.toArray() as [number, number, number];
    const object = runtime.objects.current.get("fundus");
    if (!object) return empty();
    vectors.aperture.set(0, .17, -.032); object.localToWorld(vectors.aperture);
    const viewer = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    viewer.getWorldPosition(vectors.viewer); viewer.getWorldQuaternion(vectors.rotation);
    vectors.look.set(0, 0, -1).applyQuaternion(vectors.rotation);
    return xrBrucknerTechnique({ origin, forward, aperture: vectors.aperture.toArray() as [number, number, number],
      viewer: vectors.viewer.toArray() as [number, number, number], look: vectors.look.toArray() as [number, number, number], held: true,
      light: runtime.toolsRef.current.fundus.powered, largeSpot: runtime.scopeApertureRef.current === "large", ...setup.current });
  };
  const clock = useRef(0);
  useFrame((_, dt) => {
    const next = sample();
    if (!next.ready) captureArmed.current = true;
    if (next.ready && captureArmed.current && !capturedRef.current) { capturedRef.current = true; setCaptured(true); }
    if (lastReady.current && !next.ready && !capturedRef.current) lesson.clearPending();
    lastReady.current = next.ready; visual.visible = next.ready;
    if (reflexes.current) {
      reflexes.current.visible = next.illuminated;
      reflexes.current.children.forEach(child => {
        if (child instanceof Mesh && child.material instanceof MeshBasicMaterial) child.material.color.set(scenario === child.userData.eye ? "#ffb55d" : "#b82714");
      });
    }
    clock.current += dt;
    if (clock.current >= .1) { clock.current = 0; setTechnique(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next); }
  });
  const clearAttempt = useCallback(() => {
    capturedRef.current = false; captureArmed.current = true; setCaptured(false);
    lesson.reset(); setup.current = { fixation: false }; setFixation(false);
    setTechnique(empty()); runtime.closePanels();
  }, [lesson.reset, runtime.closePanels]);
  const reset = useCallback(() => { clearAttempt(); runtime.resetClinic(); }, [clearAttempt, runtime.resetClinic]);
  useEffect(() => { clearAttempt(); }, [scenario, clearAttempt]);
  useEffect(() => { if (!active) reset(); }, [active, reset]);
  const actions = [
    { label: fixation ? "FIXATION GIVEN ✓" : "LOOK AT THE LIGHT", run: () => { setup.current.fixation = true; setFixation(true); }, active: fixation },
  ];
  const status = captured ? "Both reflexes inspected · choose relative brightness and submit." : !runtime.tools.fundus.powered ? "Pick up the ophthalmoscope and hold its trigger."
    : !fixation ? "Ask the patient to look at the light." : runtime.scopeAperture !== "large" ? "Use your free hand to turn the ophthalmoscope aperture wheel to the large circle."
    : !technique.ready ? `${Math.round(technique.distanceCm)} cm · aim at both pupils at about 1 m; look through the rear aperture.` : "Both reflexes visible · record their relative brightness.";
  const record = () => {
    const answer = lesson.entriesRef.current.brightness;
    const correct = answer === scenario;
    lesson.submit(active && !preview && runtime.frameValid.current && capturedRef.current && Boolean(answer), correct, correct ? brucknerScenarios[scenario].answer : "Keep both pupils in the beam and compare the red reflex brightness.");
  };
  const next = () => { if (!lesson.awarded.current) return; clearAttempt(); onNext(); };
  useEffect(() => { onMirror?.({ title: "Bruckner", status, ready: active && !preview && captured, entryReady: captured, fields, actions, lesson, reset, record, next }); },
    [onMirror, status, technique.ready, lesson.mode, lesson.entries, lesson.feedback, lesson.recorded, scenario, fixation, runtime.scopeAperture, captured]);
  return <>
    <XRClinicRuntimeView cleanHands runtime={runtime} active={active && !preview} preview={preview} title="BRUCKNER · PRACTICE" brucknerView={visual} />
    {active && <group ref={reflexes} visible={false} userData={{ xrBrucknerReflexes: true, xrIgnoreRay: true }}>
      {(["OD", "OS"] as const).map(eye => <mesh key={eye} position={[CLINIC_PATIENT_EYES[eye][0], 1.5, -.565]} userData={{ eye: eye.toLowerCase() }}>
        <circleGeometry args={[CLINIC_PUPIL_RADIUS * .94, 24]} /><meshBasicMaterial args={[{ color: "#b82714" }]} />
      </mesh>)}
    </group>}
    <PracticeLessonUI runtime={runtime} active={active} title="BRUCKNER" status={status} tools={["fundus"]} actions={actions} fields={fields} lesson={lesson}
      entryReady={captured} ready={active && !preview && captured} onRecord={record} onReset={reset} onNext={next} onExit={onExit} onCancel={() => { interrupt(); lesson.setMode("none"); }}
      help={["Pick the ophthalmoscope; hold the trigger.", "Bring your free controller beside the aperture wheel below the rear peephole; point at it and press/release trigger to select the large circle.", "Hold it about 1 metre from the patient.", "Bring the rear aperture close to your viewing eye.", "Compare both red reflexes, then record."]} />
  </>;
}
