import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { CLINIC_EYE_MIDPOINT } from "../../interaction/clinicPatient";
import { useXRClinicRuntime, type ClinicInputMode } from "../../interaction/useXRClinicRuntime";
import { desktopPenlightPose } from "../../interaction/desktopClinicInput";
import { gazePositions, interruptMotility, motilityHRoutePositions, motilityNextGazeIds, newMotilityCoverage, observeTarget, motilityObservations, motilityScenario, motilityScenarios, scenarioGazeForEye, MOTILITY_DWELL_SECONDS, type MotilityCoverage, type MotilityScenarioId } from "../../interaction/motility";
import { xrMotilityTarget } from "../../interaction/xrMotility";
import { MOTILITY_GUIDED_STEP_COUNT, motilityGuidedStep } from "../../interaction/motilityGuidance";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { XRGuidedStepBubble } from "../../scene/XRGuidedStepBubble";
import { usePracticeAttempt } from "../PracticeAttemptContext";
import { useClinicEyeMotion } from "./useClinicEyeMotion";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonField } from "./PracticeLessonUI";

const fields: LessonField[] = [{ id: "observation", label: "Movement observation", choices: motilityObservations }];
const initial = newMotilityCoverage;
const initialReadout = () => ({ count: 0, current: "", distance: 0, tracking: false, progress: 0, notice: "", next: [] as readonly string[] });
export function MotilityPracticeController({ active, preview = false, inputMode = "xr", scenarioId = "full", onComplete, onNext, onExit, onMirror }: {
  active: boolean; preview?: boolean; inputMode?: ClinicInputMode; scenarioId?: MotilityScenarioId; onComplete: () => void; onNext?: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const { settings } = usePracticeAttempt();
  const guided = settings?.kind === "guided";
  const guideAvailable = settings?.kind !== "test";
  const lesson = usePracticeLesson(onComplete);
  const scenario = motilityScenario(scenarioId);
  const [guides, setGuides] = useState(guideAvailable);
  const [following, setFollowing] = useState(false), [asked, setAsked] = useState(false);
  const followingRef = useRef(false), askedRef = useRef(false);
  const coverage = useRef(initial());
  const desktopGaze = useRef(0);
  const [readout, setReadout] = useState(initialReadout);
  const interrupt = useCallback(() => { coverage.current = interruptMotility(coverage.current); }, []);
  const desktopPose = () => {
    const position = motilityHRoutePositions[desktopGaze.current % motilityHRoutePositions.length];
    return desktopPenlightPose([position.x * .35 * .65, 1.5 + position.y * .35 * .45, CLINIC_EYE_MIDPOINT[2] + .35]);
  };
  const runtime = useXRClinicRuntime({ active: active && !preview, inputMode, editorOpen: lesson.mode !== "none", panelModeEnabled: false,
    desktopHeldPose: id => id === "pupils" ? desktopPose() : null,
    onThumbstickStep: (id, step) => {
      if (id !== "pupils") return false;
      desktopGaze.current = (desktopGaze.current + step + motilityHRoutePositions.length) % motilityHRoutePositions.length;
      runtime.setDesktopHeldPose("pupils", desktopPose()); return true;
    }, onInterrupt: interrupt });
  const eyes = useClinicEyeMotion(active);
  const sample = () => {
    if (!active || !runtime.frameValid.current || !runtime.workingPose("pupils")) return null;
    return xrMotilityTarget(runtime.origin.toArray() as [number, number, number], CLINIC_EYE_MIDPOINT);
  };
  const clock = useRef(0);
  useFrame(({ clock: frameClock }, dt) => {
    const spatial = sample();
    const valid = Boolean(spatial?.distanceReady && followingRef.current && runtime.toolsRef.current.pupils.powered);
    coverage.current = observeTarget(coverage.current, spatial?.target ?? { x: 0, y: 0, z: 1 }, dt, valid, { assisted: inputMode === "desktop" });
    eyes.forEach((eye, id) => {
      if (!valid || !spatial) { eye.position.set(0, 0, 0); return; }
      const gaze = scenarioGazeForEye(scenario.id, spatial.target, id, frameClock.elapsedTime);
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
        notice: coverage.current.notice ?? "",
        next: motilityNextGazeIds(coverage.current),
      };
      setReadout(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    }
  });
  const reset = useCallback(() => {
    lesson.reset(); coverage.current = initial(); followingRef.current = false; askedRef.current = false;
    setFollowing(false); setAsked(false); setGuides(guideAvailable); setReadout(initialReadout());
    desktopGaze.current = 0; runtime.resetClinic(); eyes.forEach(eye => eye.position.set(0, 0, 0));
  }, [lesson.reset, runtime.resetClinic, eyes, guideAvailable]);
  useEffect(() => { if (!active) reset(); }, [active, reset]);
  const previousScenario = useRef(scenario.id);
  useEffect(() => {
    if (previousScenario.current === scenario.id) return;
    previousScenario.current = scenario.id;
    lesson.reset(); coverage.current = initial(); followingRef.current = false; askedRef.current = false;
    setFollowing(false); setAsked(false); setGuides(guideAvailable); setReadout(initialReadout());
    eyes.forEach(eye => eye.position.set(0, 0, 0));
  }, [scenario.id, lesson.reset, eyes, guideAvailable]);
  const ask = () => {
    if (coverage.current.seen.length !== gazePositions.length || !followingRef.current) return;
    askedRef.current = true; setAsked(true);
  };
  const actions = [
    { label: following ? "FOLLOWING ✓" : "FOLLOW LIGHT · HEAD STILL", run: () => { followingRef.current = true; setFollowing(true); }, active: following },
    { label: asked ? "SYMPTOMS ASKED ✓" : "ASK ABOUT SYMPTOMS", run: ask, disabled: readout.count !== gazePositions.length, active: asked },
    ...(inputMode === "desktop" ? [{ label: runtime.tools.pupils.powered ? "PENLIGHT ON ✓" : "SWITCH PENLIGHT ON", run: () => runtime.setToolPower("pupils", true), active: runtime.tools.pupils.powered },
      { label: "MOVE TO NEXT GAZE", run: () => { desktopGaze.current = (desktopGaze.current + 1) % motilityHRoutePositions.length; runtime.setDesktopHeldPose("pupils", desktopPose()); } }] : []),
    ...(guideAvailable ? [{ label: guides ? "HIDE GAZE GUIDE" : "SHOW GAZE GUIDE", run: () => setGuides(value => !value), active: guides }] : []),
  ];
  const ready = active && readout.count === gazePositions.length && asked;
  const status = !following ? "Ask the patient to follow the light and keep the head still."
    : readout.count < gazePositions.length ? `${readout.count}/9 gaze points · ${readout.distance} cm · ${readout.notice || (readout.current ? "hold steady" : "follow the highlighted H route")}`
    : !asked ? "Nine gaze points observed · ask about symptoms."
      : `9/9 complete · Arun: ${scenario.patientReply} choose the movement observation and submit.`;
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
    const correct = observation === scenario.id;
    lesson.submit(Boolean(valid && observation), correct, correct
      ? scenario.teachingFeedback
      : `That does not match this finding. Recheck both eyes in each gaze direction and compare the symptom report.`);
  };
  useEffect(() => { onMirror?.({ title: "Motility", findingPosition: { current: motilityScenarios.findIndex(item => item.id === scenario.id) + 1, total: motilityScenarios.length },
    reportLines: asked ? [scenario.patientReply] : undefined, status, ready, entryReady: ready, fields, actions, lesson, reset, record, next: onNext }); },
    [onMirror, status, ready, lesson.mode, lesson.entries, lesson.feedback, lesson.recorded, following, asked, guides, scenario, onNext]);
  return <>
    <XRClinicRuntimeView cleanHands runtime={runtime} active={active && !preview} preview={preview}
      title="MOTILITY · PRACTICE" showWallInstructions={!guided} />
    {(active || preview) && guided && <XRGuidedStepBubble stepId={guidance.id} stepNumber={guidance.index + 1}
      total={MOTILITY_GUIDED_STEP_COUNT} title={guidance.title} lines={guidance.lines} complete={guidance.complete} />}
    {active && guideAvailable && guides && gazePositions.map(position => {
      const seen = coverage.current.seen.includes(position.id);
      const current = readout.current === position.id && !seen;
      const next = readout.next.includes(position.id);
      const progress = current ? readout.progress / 100 : 0;
      return <group key={position.id} position={[position.x * .35 * .65, 1.5 + position.y * .35 * .45, CLINIC_EYE_MIDPOINT[2] + .35]}
        userData={{ xrMotilityGazeGuide: position.id }}>
        <mesh scale={[.038, .027, 1]} userData={{ xrMotilityGuideRing: true }}>
          <ringGeometry args={[.78, 1, 48]} />
          <meshBasicMaterial color={seen ? "#65c9b6" : current || next ? "#f3c969" : "#8da8a3"} transparent opacity={seen ? .9 : current || next ? .95 : .32} />
        </mesh>
        {current && progress > 0 && <mesh position={[0, 0, .001]} scale={[.038, .027, 1]} userData={{ xrMotilityGuideProgress: true }}>
          <ringGeometry args={[.54, .72, 48, 1, Math.PI / 2, Math.PI * 2 * progress]} />
          <meshBasicMaterial color="#fff0a8" />
        </mesh>}
        <mesh position={[0, 0, .001]}><circleGeometry args={[.005, 20]} /><meshBasicMaterial color={seen ? "#dffff7" : current ? "#fff6c9" : "#c5d8d4"} /></mesh>
      </group>;
    })}
    <PracticeLessonUI runtime={runtime} active={active} title="MOTILITY" status={status} tools={["pupils"]} actions={actions} directActions={actions} forceBoardVisible wallOnly fields={fields} lesson={lesson}
      entryReady={ready} ready={ready} onRecord={record} onReset={reset} onNext={onNext} onExit={onExit}
      help={["Pick the penlight; hold its trigger.", "Ask the patient to follow it with the head still.", "Move slowly at 30–40 cm, holding all nine points.", "Use the H path and centre up/down positions.", "Ask about diplopia, pain and discomfort; record."]} />
  </>;
}
