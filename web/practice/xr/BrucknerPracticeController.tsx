import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, MeshBasicMaterial } from "three";
import { useXRClinicRuntime, type XRClinicInterruption } from "../../interaction/useXRClinicRuntime";
import { CLINIC_PATIENT_EYES, CLINIC_PUPIL_RADIUS } from "../../interaction/clinicPatient";
import { brucknerScenarios, type BrucknerScenario } from "../../interaction/brucknerPractice";
import { xrBrucknerTechnique, xrBrucknerPrompt } from "../../interaction/xrPracticeBatch";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import type { BrucknerScopeView } from "../../scene/XRScopeOptics";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonField } from "./PracticeLessonUI";

const fields: LessonField[] = [{ id: "brightness", label: "Both red reflexes", choices: Object.entries(brucknerScenarios).map(([id, item]) => [id, item.label]) }];
const empty = () => xrBrucknerTechnique({ origin: [0, 0, 0], forward: [0, 0, -1], scopeOpen: false,
  held: false, light: false, fixation: false, largeSpot: false });
export function BrucknerPracticeController({ active, preview = false, scenario, onComplete, onNext, onExit, onMirror }: {
  active: boolean; preview?: boolean; scenario: BrucknerScenario; onComplete: () => void; onNext: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const lesson = usePracticeLesson(onComplete);
  const [fixation, setFixation] = useState(false);
  const setup = useRef({ fixation }); setup.current = { fixation };
  const [technique, setTechnique] = useState(empty);
  const lastReady = useRef(false);
  const capturedRef = useRef(false), captureArmed = useRef(true);
  const [captured, setCaptured] = useState(false);
  const eyepiece = useMemo(() => ({ active: false, ready: false, title: "BRUCKNER · BOTH EYES", message: "" }), []);
  const visual = useMemo<BrucknerScopeView>(() => ({ visible: false, brighter: "equal", eyepiece }), [eyepiece]);
  visual.brighter = scenario;
  const reflexes = useRef<Group>(null);
  const interrupt = useCallback((reason?: XRClinicInterruption) => {
    if (capturedRef.current && reason && ["release", "panel", "pickup", "transfer", "tracking", "procedure", "scope-view"].includes(reason)) return;
    capturedRef.current = false; captureArmed.current = reason === "configuration" || reason === "scope-view"; setCaptured(false);
    lastReady.current = false; visual.visible = false; lesson.clearPending();
    eyepiece.active = false; eyepiece.ready = false;
  }, [visual, eyepiece, lesson.clearPending]);
  const runtime = useXRClinicRuntime({ active: active && !preview, editorOpen: lesson.mode !== "none", scopeViewEnabled: true, onInterrupt: interrupt,
    onMenu: open => lesson.setMode(open ? "menu" : "none"), onSelection: selection => { if (selection.station === "patient") lesson.setMode("menu"); },
  });
  const sample = () => {
    if (!active || !runtime.frameValid.current || !runtime.workingPose("fundus")) return empty();
    const origin = runtime.origin.toArray() as [number, number, number], forward = runtime.direction.toArray() as [number, number, number];
    return xrBrucknerTechnique({ origin, forward, scopeOpen: runtime.scopeViewHandRef.current !== null, held: true,
      light: runtime.toolsRef.current.fundus.powered, largeSpot: runtime.scopeApertureRef.current === "large", ...setup.current });
  };
  const clock = useRef(0);
  useFrame((_, dt) => {
    const next = sample();
    if (!next.ready) captureArmed.current = true;
    if (next.ready && captureArmed.current && !capturedRef.current) { capturedRef.current = true; setCaptured(true); }
    if (lastReady.current && !next.ready && !capturedRef.current) lesson.clearPending();
    lastReady.current = next.ready;
    eyepiece.active = runtime.frameValid.current && runtime.scopeViewHandRef.current !== null;
    const presentationReady = next.illuminated && next.distanceReady && next.aimReady && setup.current.fixation && runtime.scopeApertureRef.current === "large";
    eyepiece.ready = eyepiece.active && presentationReady;
    eyepiece.message = xrBrucknerPrompt(next, { tracked: runtime.frameValid.current, held: runtime.toolsRef.current.fundus.placement.kind === "held",
      light: runtime.toolsRef.current.fundus.powered, fixation: setup.current.fixation, largeSpot: runtime.scopeApertureRef.current === "large" });
    if (eyepiece.ready) eyepiece.message = "Both reflexes inspected · compare brightness, then release the trigger and record at the wall.";
    // Visible illumination is physical feedback, not completion credit. Distance,
    // fixation and scope-open checks still gate capture through next.ready.
    visual.visible = next.illuminated;
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
    eyepiece.ready = false; eyepiece.active = false; visual.visible = false;
    lesson.reset(); setup.current = { fixation: false }; setFixation(false);
    setTechnique(empty()); runtime.closePanels();
  }, [lesson.reset, runtime.closePanels, eyepiece, visual]);
  const reset = useCallback(() => { clearAttempt(); runtime.resetClinic(); }, [clearAttempt, runtime.resetClinic]);
  useEffect(() => { clearAttempt(); }, [scenario, clearAttempt]);
  useEffect(() => { if (!active) reset(); }, [active, reset]);
  const actions = [
    { label: fixation ? "FIXATION GIVEN ✓" : "LOOK AT THE LIGHT", run: () => { setup.current.fixation = true; setFixation(true); }, active: fixation },
  ];
  const status = captured ? "Both reflexes inspected · choose relative brightness and submit." : xrBrucknerPrompt(technique, {
    tracked: runtime.frameValid.current, held: runtime.tools.fundus.placement.kind === "held",
    light: runtime.tools.fundus.powered, fixation, largeSpot: runtime.scopeAperture === "large",
  });
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
      help={["Pick the ophthalmoscope; hold the trigger.", "Use the free hand to select the large gold circle on the rear aperture wheel.", "Place the light about 1 metre from the patient and aim between both pupils.", "Press B/Y on the instrument hand to open the enlarged view of both pupils; press again to close.", "Compare the red reflex brightness in both pupils. Scope mode does not change your physical working distance."]} />
  </>;
}
