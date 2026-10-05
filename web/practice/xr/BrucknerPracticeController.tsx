import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from "three";
import { useXRClinicRuntime } from "../../interaction/useXRClinicRuntime";
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
  const [fixation, setFixation] = useState(false), [largeSpot, setLargeSpot] = useState(false);
  const setup = useRef({ fixation, largeSpot }); setup.current = { fixation, largeSpot };
  const [technique, setTechnique] = useState(empty);
  const lastReady = useRef(false);
  const visual = useMemo<BrucknerScopeView>(() => ({ visible: false, largeSpot: false, brighter: "equal" }), []);
  visual.largeSpot = largeSpot; visual.brighter = scenario;
  const reflexes = useRef<Group>(null);
  const interrupt = useCallback(() => { lastReady.current = false; visual.visible = false; lesson.clearPending(); }, [visual, lesson.clearPending]);
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
      light: runtime.toolsRef.current.fundus.powered, ...setup.current });
  };
  const clock = useRef(0);
  useFrame((_, dt) => {
    const next = sample();
    if (lastReady.current && !next.ready) lesson.clearPending();
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
  const reset = useCallback(() => {
    lesson.reset(); setup.current = { fixation: false, largeSpot: false }; setFixation(false); setLargeSpot(false);
    setTechnique(empty()); runtime.resetClinic();
  }, [lesson.reset, runtime.resetClinic]);
  useEffect(() => { reset(); }, [scenario, reset]);
  useEffect(() => { if (!active) reset(); }, [active, reset]);
  const actions = [
    { label: fixation ? "FIXATION GIVEN ✓" : "LOOK AT THE LIGHT", run: () => { setup.current.fixation = true; setFixation(true); }, active: fixation },
    { label: largeSpot ? "LARGE SPOT ✓" : "SELECT LARGE SPOT", run: () => { interrupt(); setup.current.largeSpot = !setup.current.largeSpot; setLargeSpot(setup.current.largeSpot); }, active: largeSpot },
  ];
  const status = !runtime.tools.fundus.powered ? "Pick up the ophthalmoscope and hold its trigger."
    : !fixation ? "Ask the patient to look at the light." : !largeSpot ? "Select the large illumination spot."
    : !technique.ready ? `${Math.round(technique.distanceCm)} cm · aim at both pupils at about 1 m; look through the rear aperture.` : "Both reflexes visible · record their relative brightness.";
  const record = () => {
    const answer = lesson.entriesRef.current.brightness;
    const correct = answer === scenario;
    lesson.submit(sample().ready && Boolean(answer), correct, correct ? brucknerScenarios[scenario].answer : "Keep both pupils in the beam and compare the red reflex brightness.");
  };
  const next = () => { reset(); onNext(); };
  useEffect(() => { onMirror?.({ title: "Bruckner", status, ready: technique.ready, entryReady: technique.ready, fields, actions, lesson, reset, record, next }); },
    [onMirror, status, technique.ready, lesson.mode, lesson.entries, lesson.feedback, lesson.recorded, scenario, fixation, largeSpot]);
  return <>
    <XRClinicRuntimeView runtime={runtime} active={active && !preview} preview={preview} title="BRUCKNER · PRACTICE" brucknerView={visual} />
    {active && <group ref={reflexes} visible={false} userData={{ xrBrucknerReflexes: true, xrIgnoreRay: true }}>
      {(["OD", "OS"] as const).map(eye => <mesh key={eye} position={[CLINIC_PATIENT_EYES[eye][0], 1.5, -.565]} userData={{ eye: eye.toLowerCase() }}>
        <circleGeometry args={[CLINIC_PUPIL_RADIUS * .94, 24]} /><meshBasicMaterial args={[{ color: "#b82714" }]} />
      </mesh>)}
    </group>}
    <PracticeLessonUI runtime={runtime} active={active} title="BRUCKNER" status={status} tools={["fundus"]} actions={actions} fields={fields} lesson={lesson}
      entryReady={technique.ready} ready={technique.ready} onRecord={record} onReset={reset} onNext={next} onExit={onExit}
      help={["Pick the ophthalmoscope; hold the trigger.", "Use the large spot; ask fixation on its light.", "Hold it about 1 metre from the patient.", "Bring the rear aperture close to your viewing eye.", "Compare both red reflexes, then record."]} />
  </>;
}
