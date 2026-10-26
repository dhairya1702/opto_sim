import { usePracticeVoiceProcedure } from "../../voice/usePracticeVoiceProcedure";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Quaternion, Vector3 } from "three";
import { useXRClinicRuntime, type ClinicInputMode, type XRClinicInterruption } from "../../interaction/useXRClinicRuntime";
import { desktopPatientFacingPose } from "../../interaction/desktopClinicInput";
import { CLINIC_PATIENT_EYES } from "../../interaction/clinicPatient";
import { xrPracticeEyePlacement } from "../../interaction/xrPracticeBatch";
import {
  FOUR_PRISM_GUIDED_STEP_COUNT, advanceFourPrismSample, cancelFourPrismRun, clinicFourPrismGaze,
  confirmFourPrismWithdrawal, establishFourPrismFixation, exitFourPrismRun, finalizeFourPrismRun, clearFourPrismFixation,
  fourPrismBaseAlignmentError, fourPrismGuidedStep, fourPrismObservationLabel, fourPrismScenarioAt,
  handleFourPrismTool, initialFourPrismRun, setFourPrismTargetPower, interruptFourPrismEye, markFourPrismObservation,
  repeatFourPrismComparison, resetFourPrismRun, reviseFourPrismFitting, seededFourPrismDeck,
  submitFourPrismInterpretation, xrFourPrismView, type FourPrismObservation, type FourPrismRunState,
} from "../../interaction/xrFourPrismPractice";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { XRGuidedStepBubble } from "../../scene/XRGuidedStepBubble";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonAction, type LessonField } from "./PracticeLessonUI";
import { useClinicEyeMotion } from "./useClinicEyeMotion";
import { isPatientFitted, sensoryEquipment, sensorySockets, sensoryFittingSignature } from "../../interaction/xrSensoryEquipment";
import { usePracticeAttempt } from "../PracticeAttemptContext";

const observationChoices = [
  ["version-with-refixation", "Version with refixation"],
  ["version-without-refixation", "Version without refixation"],
  ["no-movement", "No movement"],
] as const;
const observationFields: LessonField[] = [
  { id: "OD", label: "OD observation", choices: observationChoices },
  { id: "OS", label: "OS observation", choices: observationChoices },
];
const interpretationFields: LessonField[] = [{ id: "interpretation", label: "Final interpretation", choices: [
  ["normal", "Normal response"], ["suppression", "Central suppression of OS"],
] }];
const seed = () => globalThis.crypto?.getRandomValues ? globalThis.crypto.getRandomValues(new Uint32Array(1))[0] : Math.floor(Math.random() * 0x100000000);

export function FourPrismPracticeController({ active, preview = false, inputMode = "xr", onComplete, onExit, onMirror, scenarioSeed }: {
  active: boolean; preview?: boolean; inputMode?: ClinicInputMode; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void; scenarioSeed?: number;
}) {
  const { settings } = usePracticeAttempt();
  const guided = settings?.kind !== "test";
  const lesson = usePracticeLesson(onComplete);
  const deck = useRef(seededFourPrismDeck(scenarioSeed ?? seed()));
  const deckIndex = useRef(0);
  const initialScenario = guided ? "normal" : fourPrismScenarioAt(deck.current, 0);
  const runRef = useRef(initialFourPrismRun(initialScenario));
  const [run, setRun] = useState(runRef.current);
  const prismBaseRef = useRef<"left" | "right">("right");
  const [prismBase, setPrismBaseState] = useState<"left" | "right">("right");
  const [techniqueReason, setTechniqueReasonState] = useState("");
  const techniqueReasonRef = useRef("");
  const setTechniqueReason = useCallback((next: string) => {
    if (next === techniqueReasonRef.current) return;
    techniqueReasonRef.current = next; setTechniqueReasonState(next);
  }, []);
  const uiElapsedMs = useRef(0);
  const fitSignature = useRef("");
  const alive = useRef(active && !preview);
  const completedNotified = useRef(false);
  const eyes = useClinicEyeMotion(active);
  const { gl, camera } = useThree();
  const vectors = useMemo(() => ({ viewer: new Vector3(), viewerForward: new Vector3(), rotation: new Quaternion(), base: new Vector3(), toolRotation: new Quaternion() }), []);
  const publish = useCallback((next: FourPrismRunState, frameSample = false) => {
    const previous = runRef.current;
    if (next === previous) return false;
    runRef.current = next;
    // Keep exact dwell and animation in the ref; refresh the counter at 10 Hz.
    // Phase, capture, tool and feedback changes still publish immediately.
    if (frameSample && next.dwellMs !== previous.dwellMs && next.phase === previous.phase
      && next.currentEye === previous.currentEye && next.notice === previous.notice
      && next.eyeCaptures === previous.eyeCaptures && next.prismHandled === previous.prismHandled
      && next.prismToolRevision === previous.prismToolRevision && uiElapsedMs.current < 100) return false;
    uiElapsedMs.current = 0; setRun(next); return true;
  }, []);
  const interrupt = useCallback((reason: XRClinicInterruption = "procedure") => {
    if (!alive.current || runRef.current.completedRun) return;
    const tracking = reason === "tracking" || reason === "visibility" || reason === "exit";
    publish(interruptFourPrismEye(runRef.current, tracking, tracking
      ? "Tracking was interrupted. Completed eye evidence was preserved; establish fixation again."
      : "The unfinished observation was cancelled."));
  }, [publish]);
  const selectPrismBase = useCallback((base: "left" | "right") => {
    if (prismBaseRef.current === base) return true;
    prismBaseRef.current = base; setPrismBaseState(base);
    publish(interruptFourPrismEye(runRef.current, false, `Prism base arrow ${base}.`));
    return true;
  }, [publish]);
  const runtime = useXRClinicRuntime({ active: active && !preview, inputMode, editorOpen: lesson.mode !== "none",
    equipment: sensoryEquipment("four-prism"), placementSockets: sensorySockets("four-prism"), onInterrupt: interrupt,
    onThumbstickStep: (id, step, _hand, axis) => id === "four-prism" && axis === "horizontal"
      ? selectPrismBase(step < 0 ? "left" : "right") : false,
    onMenu: open => lesson.setMode(open ? "menu" : "none") });

  useEffect(() => { alive.current = active && !preview; }, [active, preview]);
  useEffect(() => () => { alive.current = false; runRef.current = exitFourPrismRun(runRef.current); eyes.forEach(eye => eye.position.set(0, 0, 0)); }, [eyes]);

  const sampleTool = useCallback(() => {
    const held = runtime.workingPose("four-prism");
    const object = runtime.objects.current.get("four-prism");
    if (object) object.getWorldQuaternion(vectors.toolRotation);
    vectors.base.set(prismBaseRef.current === "left" ? -1 : 1, 0, 0).applyQuaternion(vectors.toolRotation).normalize();
    const position = held ? runtime.origin.toArray() as [number, number, number] : null;
    const forward = held ? runtime.direction.toArray() as [number, number, number] : [0, 0, -1] as [number, number, number];
    return { held: Boolean(held), position, forward, baseAxis: vectors.base.toArray() as [number, number, number] };
  }, [runtime, vectors]);

  useFrame((_, dt) => {
    if (!alive.current) return;
    uiElapsedMs.current += dt * 1000;
    const fitted = isPatientFitted(runtime.toolsRef.current, "subjective");
    const signature = sensoryFittingSignature(runtime.toolsRef.current, ["subjective"]);
    if (signature !== fitSignature.current) {
      fitSignature.current = signature;
      publish(reviseFourPrismFitting(runRef.current, fitted, runtime.toolsRef.current.subjective.revision ?? 0));
      lesson.clearPending();
    }
    const tool = sampleTool();
    let next = handleFourPrismTool(runRef.current, tool.held, runtime.toolsRef.current["four-prism"].revision ?? 0);
    if (next.phase === "withdraw") next = confirmFourPrismWithdrawal(next, tool.position, tool.forward);
    const viewer = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    viewer.getWorldPosition(vectors.viewer); viewer.getWorldQuaternion(vectors.rotation);
    vectors.viewerForward.set(0, 0, -1).applyQuaternion(vectors.rotation);
    const view = runtime.frameValid.current && lesson.mode === "none"
      && xrFourPrismView(vectors.viewer.toArray() as [number, number, number], vectors.viewerForward.toArray() as [number, number, number]);
    const detectedEye = tool.position ? xrPracticeEyePlacement(tool.position, tool.forward, true) : null;
    const before = next;
    next = advanceFourPrismSample(next, { trackingValid: runtime.frameValid.current, examinerViewValid: view,
      correctionRevision: next.correctionRevision, fixationRevision: next.fixationRevision,
      prismToolRevision: runtime.toolsRef.current["four-prism"].revision ?? 0, prismHeld: tool.held,
      position: tool.position, forward: tool.forward, baseAxis: tool.baseAxis, detectedEye,
      boAlignmentErrorRad: fourPrismBaseAlignmentError(tool.baseAxis, next.expectedEye), sampledDurationMs: dt * 1000 });
    if (!before.eyeCaptures.OD && next.eyeCaptures.OD || !before.eyeCaptures.OS && next.eyeCaptures.OS) {
      const placement = runtime.toolsRef.current["four-prism"].placement;
      if (placement.kind === "held") runtime.pulseHand(placement.hand, .32, 45);
    }
    publish(next, true);
    const motionEye = next.currentEye;
    const gaze = motionEye ? clinicFourPrismGaze(motionEye, next.scenario, next.dwellMs) : { od: 0, os: 0 };
    eyes.forEach((eye, id) => eye.position.set(id === "OD" ? gaze.od : gaze.os, 0, 0));
    if (guided && ["orient-od", "orient-os", "observe-od", "observe-os"].includes(next.phase)) {
      const error = fourPrismBaseAlignmentError(tool.baseAxis, next.expectedEye);
      setTechniqueReason(!tool.held ? "Pick up the 4Δ prism." : detectedEye && detectedEye !== next.expectedEye ? `Position before ${next.expectedEye} first.`
        : detectedEye !== next.expectedEye ? `Centre the prism before ${next.expectedEye}.` : error > 20 * Math.PI / 180 ? `Point the base toward Arun’s ${next.expectedEye === "OD" ? "right" : "left"} temple.`
          : !view ? "Use a frontal examiner view with both eyes visible." : "");
    } else setTechniqueReason("");
  });

  const reset = useCallback(() => {
    publish(resetFourPrismRun(runRef.current)); lesson.reset(); runtime.resetClinic(); fitSignature.current = "";
    prismBaseRef.current = "right"; setPrismBaseState("right");
    setTechniqueReason(""); completedNotified.current = false; eyes.forEach(eye => eye.position.set(0, 0, 0));
  }, [eyes, lesson.reset, publish, runtime.resetClinic, setTechniqueReason]);
  useEffect(() => { if (!active || preview) reset(); }, [active, preview, reset]);

  const fixate = () => publish(establishFourPrismFixation(runRef.current));
  const fitCorrection = () => {
    const socket = sensorySockets("four-prism").find(candidate => candidate.tool === "subjective" && candidate.id === "sensory-correction");
    if (!socket) return;
    const tool = runtime.toolsRef.current.subjective;
    runtime.updateTools({ ...runtime.toolsRef.current, subjective: { ...tool,
      placement: { kind: "socket", position: socket.position, rotation: socket.rotation, socketId: socket.id, fittingLayer: socket.fittingLayer },
      revision: (tool.revision ?? 0) + 1 } });
  };
  const positionDesktopPrism = () => {
    const eye = runRef.current.expectedEye, anchor = CLINIC_PATIENT_EYES[eye];
    selectPrismBase(eye === "OD" ? "left" : "right");
    runtime.setDesktopHeldPose("four-prism", desktopPatientFacingPose("four-prism", [anchor[0], anchor[1], anchor[2] + .06]));
  };
  const setTargetPower = (powered: boolean) => {
    if (alive.current) publish(setFourPrismTargetPower(runRef.current, powered));
  };
  // Keyboard-accessible alternative; immersive learners use the display's physical switch.
  const targetAction: LessonAction = { label: "DISTANCE DISPLAY POWER", active: run.targetOn, disabled: !run.fitted || run.recorded,
    run: () => setTargetPower(!runRef.current.targetOn) };
  const fixationAction: LessonAction = { voiceIds: ["fixate-target"], label: "LOOK AT THE ISOLATED LETTER", disabled: !run.fitted || !run.targetOn || run.recorded,
    active: run.fixationSetupRevision === run.setupRevision, run: fixate };
  const withdrawAction: LessonAction = { label: "REMOVE PRISM", disabled: run.phase !== "withdraw",
    run: () => inputMode === "desktop"
      ? runtime.setDesktopHeldPose("four-prism", desktopPatientFacingPose("four-prism", [.4, 1.5, -.48]))
      : lesson.explain("In VR, move the prism clear of both eyes.") };
  const repeatAction: LessonAction = { label: "REPEAT COMPARISON", disabled: !run.eyeCaptures.OD,
    run: () => { publish(repeatFourPrismComparison(runRef.current)); lesson.clearPending(); } };
  const clearFixationAction: LessonAction = { label: "CLEAR FIXATION", disabled: run.fixationSetupRevision === null || run.recorded,
    run: () => { publish(clearFourPrismFixation(runRef.current)); lesson.clearPending(); } };
  const actions = [fixationAction, withdrawAction, repeatAction, clearFixationAction,
    ...(inputMode === "desktop" ? [
      targetAction,
      { label: "FIT THE TRIAL FRAME", active: run.fitted, run: fitCorrection },
      { label: `POSITION 4Δ BO BEFORE ${run.expectedEye}`, run: positionDesktopPrism },
    ] : [])];
  const directActions = run.phase === "fixation" ? (run.targetOn ? [fixationAction] : []) : run.phase === "withdraw" ? [withdrawAction] : run.completedRun ? [] : run.eyeCaptures.OD ? [repeatAction] : [];
  const fields = run.completedRun ? interpretationFields : observationFields;
  const bilateralCaptured = Boolean(run.eyeCaptures.OD && run.eyeCaptures.OS);
  const ready = bilateralCaptured || Boolean(run.completedRun);
  const entryReady = ready && runtime.frameValid.current;

  const record = () => {
    if (!alive.current || !runtime.frameValid.current) return;
    let next = runRef.current;
    if (!next.completedRun) {
      const od = lesson.entriesRef.current.OD as FourPrismObservation | undefined;
      const os = lesson.entriesRef.current.OS as FourPrismObservation | undefined;
      if (!od || !os) return;
      next = markFourPrismObservation(next, "OD", od);
      next = markFourPrismObservation(next, "OS", os);
      next = finalizeFourPrismRun(next);
      publish(next);
      if (!next.completedRun) { lesson.explain(next.notice); return; }
      lesson.clearPending(); lesson.progress("Correct Observations"); return;
    }
    const interpretation = lesson.entriesRef.current.interpretation as "normal" | "suppression" | undefined;
    if (!interpretation) return;
    next = submitFourPrismInterpretation(next, interpretation); publish(next);
    lesson.submit(true, next.recorded, next.notice);
    if (next.recorded && !completedNotified.current) completedNotified.current = true;
  };
  const cancel = () => { publish(cancelFourPrismRun(runRef.current)); lesson.clearPending(); lesson.setMode("none"); };
  const next = () => {
    if (!runRef.current.recorded) return;
    deckIndex.current += 1;
    const scenario = fourPrismScenarioAt(deck.current, deckIndex.current);
    publish(initialFourPrismRun(scenario, runRef.current.attempt + 1, runRef.current.generation + 1));
    prismBaseRef.current = "right"; setPrismBaseState("right");
    lesson.reset(); runtime.resetClinic(); fitSignature.current = ""; completedNotified.current = false;
  };
  const exit = () => { alive.current = false; publish(exitFourPrismRun(runRef.current)); eyes.forEach(eye => eye.position.set(0, 0, 0)); onExit(); };
  const history = run.completedRun?.records.map(record => `${record.capture.eye} · ${fourPrismObservationLabel(record.learnerObservation)}`) ?? [];
  const neutral = !run.fitted ? "Fit the trial frame." : !run.targetOn ? "Switch on the distance target." : run.fixationSetupRevision !== run.setupRevision ? "Ask Arun to look at the isolated letter."
    : !run.prismHandled ? "Pick up the 4Δ prism." : run.phase === "withdraw" ? "Remove Prism"
      : run.phase === "record" ? "Observations" : run.phase === "interpret" ? "Record"
        : run.phase === "complete" ? "Comparison recorded." : `Observe ${run.expectedEye} · Maintain the view.`;
  const status = `${neutral}${guided && techniqueReason ? ` · ${techniqueReason}` : ""}${run.notice ? ` · ${run.notice}` : ""}`;
  const guidance = fourPrismGuidedStep(run);

  usePracticeVoiceProcedure("four-prism", active && !preview, { actions, voiceReport: undefined });
  useEffect(() => { onMirror?.({ title: "4Δ base-out", reportLines: history, status, ready, entryReady, fields, actions, lesson, reset, record, next, cancel }); },
    [onMirror, history.join("|"), status, ready, entryReady, fields, run, lesson.mode, lesson.entries, lesson.feedback, lesson.recorded]);

  return <>
    <XRClinicRuntimeView cleanHands runtime={runtime} active={active && !preview} preview={preview} title="4Δ BASE-OUT · PRACTICE"
      instruction="Place before the tested eye · point the base toward that temple"
      sensoryStation="four-prism" distanceLetterPowered={run.targetOn}
      onDistanceLetterPowerChange={setTargetPower} highlightDistanceLetterPower={guided && run.fitted && !run.targetOn && !run.recorded} showWallInstructions={!guided} showInstructionalHighlights={guided}
      instrumentSettings={{ "four-prism": { base: prismBase } }} />
    {(active || preview) && guided && <XRGuidedStepBubble stepId={guidance.id} stepNumber={guidance.index + 1}
      total={FOUR_PRISM_GUIDED_STEP_COUNT} title={guidance.title} lines={guidance.lines} complete={guidance.complete} />}
    <PracticeLessonUI runtime={runtime} active={active && !preview} title="4Δ BASE-OUT" status={status} tools={["subjective", "four-prism"]}
      actions={actions} directActions={directActions} fields={fields} lesson={lesson} ready={ready} entryReady={entryReady}
      onRecord={record} onReset={reset} onNext={next} onExit={exit} onCancel={cancel} forceBoardVisible={Boolean(run.eyeCaptures.OD)}
      boardFindingLines={history} boardStatusLines={[...history, neutral]} help={guided ? ["Fit the trial frame, use the power button on the distance display, then ask Arun to look at the letter.",
        "Place the prism before Arun’s right eye with its base toward his right temple. For his left eye, point the base toward his left temple.", "Observe each eye for 3 seconds, removing the prism between eyes.",
        "Movement and handling are illustrative, not calibrated."]
        : ["Complete the examination using the available neutral controls.", "Movement and handling are illustrative, not calibrated."]} />
  </>;
}
