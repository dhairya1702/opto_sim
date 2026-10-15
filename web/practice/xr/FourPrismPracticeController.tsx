import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Quaternion, Vector3 } from "three";
import { useXRClinicRuntime, type XRClinicInterruption } from "../../interaction/useXRClinicRuntime";
import { xrPracticeEyePlacement } from "../../interaction/xrPracticeBatch";
import {
  FOUR_PRISM_GUIDED_STEP_COUNT, advanceFourPrismSample, cancelFourPrismRun, clinicFourPrismGaze,
  confirmFourPrismWithdrawal, establishFourPrismFixation, exitFourPrismRun, finalizeFourPrismRun, clearFourPrismFixation,
  fourPrismBaseAlignmentError, fourPrismGuidedStep, fourPrismObservationLabel, fourPrismScenarioAt,
  handleFourPrismTool, initialFourPrismRun, interruptFourPrismEye, markFourPrismObservation,
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

export function FourPrismPracticeController({ active, preview = false, onComplete, onExit, onMirror, scenarioSeed }: {
  active: boolean; preview?: boolean; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void; scenarioSeed?: number;
}) {
  const { settings } = usePracticeAttempt();
  const guided = settings?.kind !== "test";
  const lesson = usePracticeLesson(onComplete);
  const deck = useRef(seededFourPrismDeck(scenarioSeed ?? seed()));
  const deckIndex = useRef(0);
  const initialScenario = guided ? "normal" : fourPrismScenarioAt(deck.current, 0);
  const runRef = useRef(initialFourPrismRun(initialScenario));
  const [run, setRun] = useState(runRef.current);
  const [techniqueReason, setTechniqueReason] = useState("");
  const fitSignature = useRef("");
  const alive = useRef(active && !preview);
  const completedNotified = useRef(false);
  const eyes = useClinicEyeMotion(active);
  const { gl, camera } = useThree();
  const vectors = useMemo(() => ({ viewer: new Vector3(), viewerForward: new Vector3(), rotation: new Quaternion(), base: new Vector3(), toolRotation: new Quaternion() }), []);
  const publish = useCallback((next: FourPrismRunState) => {
    if (next === runRef.current) return false;
    runRef.current = next; setRun(next); return true;
  }, []);
  const interrupt = useCallback((reason: XRClinicInterruption = "procedure") => {
    if (!alive.current || runRef.current.completedRun) return;
    const tracking = reason === "tracking" || reason === "visibility" || reason === "exit";
    publish(interruptFourPrismEye(runRef.current, tracking, tracking
      ? "Tracking was interrupted. Completed eye evidence was preserved; establish fixation again."
      : "The unfinished observation was cancelled."));
  }, [publish]);
  const runtime = useXRClinicRuntime({ active: active && !preview, editorOpen: lesson.mode !== "none",
    equipment: sensoryEquipment("four-prism"), placementSockets: sensorySockets("four-prism"), onInterrupt: interrupt,
    onMenu: open => lesson.setMode(open ? "menu" : "none") });

  useEffect(() => { alive.current = active && !preview; }, [active, preview]);
  useEffect(() => () => { alive.current = false; runRef.current = exitFourPrismRun(runRef.current); eyes.forEach(eye => eye.position.set(0, 0, 0)); }, [eyes]);

  const sampleTool = useCallback(() => {
    const held = runtime.workingPose("four-prism");
    const object = runtime.objects.current.get("four-prism");
    if (object) object.getWorldQuaternion(vectors.toolRotation);
    vectors.base.set(1, 0, 0).applyQuaternion(vectors.toolRotation).normalize();
    const position = held ? runtime.origin.toArray() as [number, number, number] : null;
    const forward = held ? runtime.direction.toArray() as [number, number, number] : [0, 0, -1] as [number, number, number];
    return { held: Boolean(held), position, forward, baseAxis: vectors.base.toArray() as [number, number, number] };
  }, [runtime, vectors]);

  useFrame((_, dt) => {
    if (!alive.current) return;
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
    publish(next);
    const motionEye = next.currentEye;
    const gaze = motionEye ? clinicFourPrismGaze(motionEye, next.scenario, next.dwellMs) : { od: 0, os: 0 };
    eyes.forEach((eye, id) => eye.position.set(id === "OD" ? gaze.od : gaze.os, 0, 0));
    if (guided && ["orient-od", "orient-os", "observe-od", "observe-os"].includes(next.phase)) {
      const error = fourPrismBaseAlignmentError(tool.baseAxis, next.expectedEye);
      setTechniqueReason(!tool.held ? "Pick up the dedicated 4Δ prism." : detectedEye && detectedEye !== next.expectedEye ? `Position before ${next.expectedEye} first.`
        : detectedEye !== next.expectedEye ? `Centre the prism before ${next.expectedEye}.` : error > 20 * Math.PI / 180 ? `Rotate the base marking temporally for ${next.expectedEye}.`
          : !view ? "Use a frontal examiner view with both eyes visible." : "");
    } else if (techniqueReason) setTechniqueReason("");
  });

  const reset = useCallback(() => {
    publish(resetFourPrismRun(runRef.current)); lesson.reset(); runtime.resetClinic(); fitSignature.current = "";
    setTechniqueReason(""); completedNotified.current = false; eyes.forEach(eye => eye.position.set(0, 0, 0));
  }, [eyes, lesson.reset, publish, runtime.resetClinic]);
  useEffect(() => { if (!active || preview) reset(); }, [active, preview, reset]);

  const fixate = () => publish(establishFourPrismFixation(runRef.current));
  const fixationAction: LessonAction = { label: "LOOK AT THE ISOLATED LETTER", disabled: !run.fitted || run.recorded,
    active: run.fixationSetupRevision === run.setupRevision, run: fixate };
  const withdrawAction: LessonAction = { label: "WITHDRAW PRISM", disabled: run.phase !== "withdraw",
    run: () => lesson.explain("In VR, physically move the dedicated prism clear of both eyes.") };
  const repeatAction: LessonAction = { label: "REPEAT COMPARISON", disabled: !run.eyeCaptures.OD,
    run: () => { publish(repeatFourPrismComparison(runRef.current)); lesson.clearPending(); } };
  const clearFixationAction: LessonAction = { label: "CLEAR FIXATION", disabled: run.fixationSetupRevision === null || run.recorded,
    run: () => { publish(clearFourPrismFixation(runRef.current)); lesson.clearPending(); } };
  const actions = [fixationAction, withdrawAction, repeatAction, clearFixationAction];
  const directActions = run.phase === "fixation" ? [fixationAction] : run.phase === "withdraw" ? [withdrawAction] : run.completedRun ? [] : run.eyeCaptures.OD ? [repeatAction] : [];
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
      lesson.clearPending(); lesson.progress("Both observations confirmed. Now choose the final interpretation."); return;
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
    lesson.reset(); runtime.resetClinic(); fitSignature.current = ""; completedNotified.current = false;
  };
  const exit = () => { alive.current = false; publish(exitFourPrismRun(runRef.current)); eyes.forEach(eye => eye.position.set(0, 0, 0)); onExit(); };
  const history = run.completedRun?.records.map(record => `${record.capture.eye} · ${fourPrismObservationLabel(record.learnerObservation)}`) ?? [];
  const neutral = !run.fitted ? "Fit best distance correction." : run.fixationSetupRevision !== run.setupRevision ? "Ask Arun to look at the isolated letter."
    : !run.prismHandled ? "Pick up the dedicated 4Δ prism." : run.phase === "withdraw" ? "OD captured · withdraw the prism completely before OS."
      : run.phase === "record" ? "Record OD and OS observations separately." : run.phase === "interpret" ? "Choose the final interpretation."
        : run.phase === "complete" ? "Comparison recorded." : `Observe ${run.expectedEye} with valid placement and view · ${Math.round(run.dwellMs)} / 2400 ms`;
  const status = `${neutral}${guided && techniqueReason ? ` · ${techniqueReason}` : ""}${run.notice ? ` · ${run.notice}` : ""}`;
  const guidance = fourPrismGuidedStep(run);

  useEffect(() => { onMirror?.({ title: "4Δ base-out", reportLines: history, status, ready, entryReady, fields, actions, lesson, reset, record, next, cancel }); },
    [onMirror, history.join("|"), status, ready, entryReady, fields, run, lesson.mode, lesson.entries, lesson.feedback, lesson.recorded]);

  return <>
    <XRClinicRuntimeView cleanHands runtime={runtime} active={active && !preview} preview={preview} title="4Δ BASE-OUT · PRACTICE"
      sensoryStation="four-prism" showWallInstructions={!guided} showInstructionalHighlights={guided} />
    {(active || preview) && guided && <XRGuidedStepBubble stepId={guidance.id} stepNumber={guidance.index + 1}
      total={FOUR_PRISM_GUIDED_STEP_COUNT} title={guidance.title} lines={guidance.lines} complete={guidance.complete} />}
    <PracticeLessonUI runtime={runtime} active={active && !preview} title="4Δ BASE-OUT" status={status} tools={["subjective", "four-prism"]}
      actions={actions} directActions={directActions} fields={fields} lesson={lesson} ready={ready} entryReady={entryReady}
      onRecord={record} onReset={reset} onNext={next} onExit={exit} onCancel={cancel} forceBoardVisible={Boolean(run.eyeCaptures.OD)}
      boardStatusLines={[...history, neutral]} help={guided ? ["Fit best distance correction and establish isolated-letter fixation.",
        "Use the dedicated fixed 4Δ prism; point its base temporally for each eye.", "Observe OD continuously for 2400 ms, withdraw completely, then reverse orientation for OS.",
        "Record each eye's movement before interpreting. Movement and handling are illustrative, not calibrated."]
        : ["Complete the examination using the available neutral controls.", "Movement and handling are illustrative, not calibrated."]} />
  </>;
}
