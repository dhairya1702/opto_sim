import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { CLINIC_EYE_MIDPOINT, CLINIC_PATIENT_EYES } from "../../interaction/clinicPatient";
import { useXRClinicRuntime } from "../../interaction/useXRClinicRuntime";
import { gazeForEye, gazePositions, observeTarget, motilityObservations, motilityRecordedObservation, MOTILITY_DWELL_SECONDS, type MotilityCoverage } from "../../interaction/motility";
import { xrMotilityTarget } from "../../interaction/xrMotility";
import { MOTILITY_GUIDED_STEP_COUNT, motilityGuidedStep } from "../../interaction/motilityGuidance";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { XRGuidedStepBubble } from "../../scene/XRGuidedStepBubble";
import { XRSign } from "../../scene/XRClinicPanels";
import { usePracticeAttempt } from "../PracticeAttemptContext";
import { useClinicEyeMotion } from "./useClinicEyeMotion";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonField } from "./PracticeLessonUI";

const fields: LessonField[] = [{ id: "observation", label: "Movement observation", choices: motilityObservations }];
const initial = (): MotilityCoverage => ({ seen: [], current: null, dwell: 0, spatialGrace: 0 });
const initialReadout = () => ({ count: 0, current: "", distance: 0, tracking: false, progress: 0 });
export function MotilityPracticeController({ active, preview = false, onComplete, onExit, onMirror }: {
  active: boolean; preview?: boolean; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const { settings } = usePracticeAttempt();
  const guided = settings?.kind === "guided";
  const lesson = usePracticeLesson(onComplete);
  const [guides, setGuides] = useState(true);
  const [following, setFollowing] = useState(false), [asked, setAsked] = useState(false);
  const followingRef = useRef(false), askedRef = useRef(false);
  const coverage = useRef(initial());
  const [readout, setReadout] = useState(initialReadout);
  const interrupt = useCallback(() => { coverage.current = { ...coverage.current, current: null, dwell: 0, spatialGrace: 0 }; }, []);
  const runtime = useXRClinicRuntime({ active: active && !preview, editorOpen: lesson.mode !== "none", panelModeEnabled: false, onInterrupt: interrupt });
  const eyes = useClinicEyeMotion(active);
  const sample = () => {
    if (!active || !runtime.frameValid.current || !runtime.workingPose("pupils")) return null;
    return xrMotilityTarget(runtime.origin.toArray() as [number, number, number], CLINIC_EYE_MIDPOINT);
  };
  const clock = useRef(0);
  useFrame((_, dt) => {
    const spatial = sample();
    const valid = Boolean(spatial?.distanceReady && followingRef.current && runtime.toolsRef.current.pupils.powered);
    coverage.current = observeTarget(coverage.current, spatial?.target ?? { x: 0, y: 0, z: 1 }, dt, valid);
    eyes.forEach((eye, id) => {
      if (!valid || !spatial) { eye.position.set(0, 0, 0); return; }
      const gaze = gazeForEye(spatial.target, CLINIC_PATIENT_EYES[id][0]);
      eye.position.set(Math.sin(gaze.yaw) * .012, Math.sin(gaze.pitch) * .012, 0);
    });
    clock.current += dt;
    if (clock.current >= .1) {
      clock.current = 0;
      const next = {
        count: coverage.current.seen.length,
        current: coverage.current.current ?? "",
        distance: Math.round(spatial?.distanceCm ?? 0),
        tracking: valid,
        progress: Math.min(100, Math.round(coverage.current.dwell / MOTILITY_DWELL_SECONDS * 100)),
      };
      setReadout(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    }
  });
  const reset = useCallback(() => {
    lesson.reset(); coverage.current = initial(); followingRef.current = false; askedRef.current = false;
    setFollowing(false); setAsked(false); setGuides(true); setReadout(initialReadout());
    runtime.resetClinic(); eyes.forEach(eye => eye.position.set(0, 0, 0));
  }, [lesson.reset, runtime.resetClinic, eyes]);
  useEffect(() => { if (!active) reset(); }, [active, reset]);
  const ask = () => {
    if (coverage.current.seen.length !== gazePositions.length || !followingRef.current) return;
    askedRef.current = true; setAsked(true);
  };
  const actions = [
    { label: following ? "FOLLOWING ✓" : "FOLLOW LIGHT · HEAD STILL", run: () => { followingRef.current = true; setFollowing(true); }, active: following },
    { label: asked ? "SYMPTOMS ASKED ✓" : "ASK ABOUT SYMPTOMS", run: ask, disabled: readout.count !== gazePositions.length, active: asked },
    { label: guides ? "HIDE GAZE GUIDE" : "SHOW GAZE GUIDE", run: () => setGuides(value => !value), active: guides },
  ];
  const ready = active && readout.count === gazePositions.length && asked;
  const status = !following ? "Ask the patient to follow the light and keep the head still."
    : readout.count < gazePositions.length ? `${readout.count}/9 gaze points · ${readout.distance} cm · ${readout.current || "hold the lit penlight at 30–40 cm"}`
    : !asked ? "Nine gaze points observed · ask about symptoms."
      : "9/9 complete · patient reports no diplopia, pain or discomfort · choose the movement observation and submit.";
  const guidance = motilityGuidedStep({
    toolHeld: runtime.tools.pupils.placement.kind === "held",
    following,
    seen: coverage.current.seen,
    symptomsAsked: asked,
    observationChosen: Boolean(lesson.entries.observation),
    recorded: lesson.recorded,
  });
  const record = () => {
    const observation = lesson.entriesRef.current.observation;
    const valid = active && followingRef.current && coverage.current.seen.length === gazePositions.length && askedRef.current;
    lesson.submit(Boolean(valid && observation), true, motilityRecordedObservation(observation) + (observation !== "full" ? " Recheck the coordinated movements in this example." : ""));
  };
  useEffect(() => { onMirror?.({ title: "Motility", status, ready, entryReady: ready, fields, actions, lesson, reset, record }); },
    [onMirror, status, ready, lesson.mode, lesson.entries, lesson.feedback, lesson.recorded, following, asked, guides]);
  return <>
    <XRClinicRuntimeView cleanHands runtime={runtime} active={active && !preview} preview={preview}
      title="MOTILITY · PRACTICE" showWallInstructions={!guided} />
    {(active || preview) && guided && <XRGuidedStepBubble stepId={guidance.id} stepNumber={guidance.index + 1}
      total={MOTILITY_GUIDED_STEP_COUNT} title={guidance.title} lines={guidance.lines} complete={guidance.complete} />}
    {active && guides && gazePositions.map(position => {
      const seen = coverage.current.seen.includes(position.id);
      const current = readout.current === position.id && !seen;
      const progress = current ? readout.progress / 100 : 0;
      return <group key={position.id} position={[position.x * .35 * .65, 1.5 + position.y * .35 * .45, CLINIC_EYE_MIDPOINT[2] + .35]}>
        <mesh scale={[.055, .038, 1]}>
          <ringGeometry args={[.78, 1, 48]} />
          <meshBasicMaterial color={seen ? "#65c9b6" : current ? "#f3c969" : "#8da8a3"} transparent opacity={seen ? .9 : current ? .95 : .48} />
        </mesh>
        {current && progress > 0 && <mesh position={[0, 0, .001]} scale={[.055, .038, 1]}>
          <ringGeometry args={[.54, .72, 48, 1, Math.PI / 2, Math.PI * 2 * progress]} />
          <meshBasicMaterial color="#fff0a8" />
        </mesh>}
        <mesh position={[0, 0, .001]}><circleGeometry args={[.007, 20]} /><meshBasicMaterial color={seen ? "#dffff7" : current ? "#fff6c9" : "#c5d8d4"} /></mesh>
        <XRSign text={[seen ? `✓ ${position.label}` : current ? `${readout.progress}% · ${position.label}` : `○ ${position.label}`]}
          p={[0, -.052, .002]} size={[.13, .026]} bg={seen ? "#176b5e" : current ? "#6d5922" : "#173a3e"} fg="#f4fffc" />
      </group>;
    })}
    <PracticeLessonUI runtime={runtime} active={active} title="MOTILITY" status={status} tools={["pupils"]} actions={actions} directActions={actions} forceBoardVisible wallOnly fields={fields} lesson={lesson}
      entryReady={ready} ready={ready} onRecord={record} onReset={reset} onExit={onExit}
      help={["Pick the penlight; hold its trigger.", "Ask the patient to follow it with the head still.", "Move slowly at 30–40 cm, holding all nine points.", "Use the H path and centre up/down positions.", "Ask about diplopia, pain and discomfort; record."]} />
  </>;
}
