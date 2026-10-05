import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { CLINIC_EYE_MIDPOINT, CLINIC_PATIENT_EYES } from "../../interaction/clinicPatient";
import { useXRClinicRuntime } from "../../interaction/useXRClinicRuntime";
import { gazeForEye, gazePositions, observeTarget, motilityObservations, motilityRecordedObservation, MOTILITY_PATIENT_REPLY, type MotilityCoverage } from "../../interaction/motility";
import { xrMotilityTarget } from "../../interaction/xrMotility";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { XRSign } from "../../scene/XRClinicPanels";
import { useClinicEyeMotion } from "./useClinicEyeMotion";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonField } from "./PracticeLessonUI";

const fields: LessonField[] = [{ id: "observation", label: "Movement observation", choices: motilityObservations }];
const initial = (): MotilityCoverage => ({ seen: [], current: null, dwell: 0 });
export function MotilityPracticeController({ active, preview = false, onComplete, onExit, onMirror }: {
  active: boolean; preview?: boolean; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const lesson = usePracticeLesson(onComplete);
  const [guides, setGuides] = useState(false);
  const [following, setFollowing] = useState(false), [asked, setAsked] = useState(false);
  const followingRef = useRef(false), askedRef = useRef(false);
  const coverage = useRef(initial());
  const [readout, setReadout] = useState({ count: 0, current: "", distance: 0, tracking: false });
  const interrupt = useCallback(() => { coverage.current = { ...coverage.current, current: null, dwell: 0 }; }, []);
  const runtime = useXRClinicRuntime({ active, editorOpen: lesson.mode !== "none", onInterrupt: interrupt,
    onMenu: open => lesson.setMode(open ? "menu" : "none"), onSelection: selection => { if (selection.station === "patient") lesson.setMode("menu"); },
  });
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
      const next = { count: coverage.current.seen.length, current: coverage.current.current ?? "", distance: Math.round(spatial?.distanceCm ?? 0), tracking: valid };
      setReadout(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    }
  });
  const reset = useCallback(() => {
    lesson.reset(); coverage.current = initial(); followingRef.current = false; askedRef.current = false;
    setFollowing(false); setAsked(false); setGuides(false); setReadout({ count: 0, current: "", distance: 0, tracking: false });
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
  const ready = active && readout.count === gazePositions.length && asked && readout.tracking;
  const status = !following ? "Ask the patient to follow the light and keep the head still."
    : readout.count < gazePositions.length ? `${readout.count}/9 gaze points · ${readout.distance} cm · ${readout.current || "hold the lit penlight at 30–40 cm"}`
    : !asked ? "Nine gaze points observed · ask about symptoms." : `Patient: “${MOTILITY_PATIENT_REPLY}”`;
  const record = () => {
    const observation = lesson.entriesRef.current.observation;
    const valid = sample()?.distanceReady && runtime.toolsRef.current.pupils.powered && coverage.current.seen.length === gazePositions.length && askedRef.current;
    lesson.submit(Boolean(valid && observation), true, motilityRecordedObservation(observation) + (observation !== "full" ? " Recheck the coordinated movements in this example." : ""));
  };
  useEffect(() => { onMirror?.({ title: "Motility", status, ready, entryReady: ready, fields, actions, lesson, reset, record }); },
    [onMirror, status, ready, lesson.mode, lesson.entries, lesson.feedback, lesson.recorded, following, asked, guides]);
  return <>
    <XRClinicRuntimeView runtime={runtime} active={active} preview={preview} title="MOTILITY · PRACTICE" />
    {active && guides && gazePositions.map(position => <XRSign key={position.id} text={[`${coverage.current.seen.includes(position.id) ? "✓" : "○"} ${position.label}`]}
      p={[position.x * .35 * .65, 1.5 + position.y * .35 * .45, CLINIC_EYE_MIDPOINT[2] + .35]} size={[.08, .023]} bg="#173a3e" fg="#e8fff9" />)}
    <PracticeLessonUI runtime={runtime} active={active} title="MOTILITY" status={status} tools={["pupils"]} actions={actions} fields={fields} lesson={lesson}
      entryReady={ready} ready={ready} onRecord={record} onReset={reset} onExit={onExit}
      help={["Pick the penlight; hold its trigger.", "Ask the patient to follow it with the head still.", "Move slowly at 30–40 cm, holding all nine points.", "Use the H path and centre up/down positions.", "Ask about diplopia, pain and discomfort; record."]} />
  </>;
}
