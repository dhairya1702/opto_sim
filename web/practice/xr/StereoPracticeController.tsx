import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { DoubleSide, Group } from "three";
import { useXRClinicRuntime, type XRClinicInterruption } from "../../interaction/useXRClinicRuntime";
import { consultationToolDefinition } from "../../interaction/xrConsultationTools";
import { sensoryEquipment, sensorySockets, isPatientFitted, sensoryFittingSignature } from "../../interaction/xrSensoryEquipment";
import { stereoPracticeLevels, stereoTargets } from "../../interaction/stereoPractice";
import {
  STEREO_GUIDED_STEP_COUNT, classifyXRStereoResponse, fixateXRStereoPage, initialXRStereoRun,
  interruptXRStereoRun, markXRStereoResponse, nextXRStereoPage, requestXRStereoReply,
  reviseXRStereoSetup, stereoCircleNames, stereoGuidedStep, xrStereoEntryCorrect, xrStereoGeometry,
  type StereoCircle, type StereoClassification, type XRStereoRun,
} from "../../interaction/xrStereoPractice";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { XRGuidedStepBubble } from "../../scene/XRGuidedStepBubble";
import { Box } from "../../scene/Models";
import { XRHeadPanel, XRPanelButton, XRSign } from "../../scene/XRClinicPanels";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonAction, type LessonField } from "./PracticeLessonUI";
import { usePracticeAttempt } from "../PracticeAttemptContext";

const equipment = sensoryEquipment("stereo"), sockets = sensorySockets("stereo");
const fields: LessonField[] = [{ id: "threshold", label: "Last correct threshold", choices: stereoPracticeLevels.map(level => [String(level), `${level} arcsec`]) }];

export function StereoPracticeController({ active, preview = false, onComplete, onExit, onMirror }: {
  active: boolean; preview?: boolean; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const { settings } = usePracticeAttempt();
  const guided = settings?.kind === "guided";
  const lesson = usePracticeLesson(onComplete);
  const runRef = useRef(initialXRStereoRun());
  const [run, setRun] = useState(runRef.current);
  const [message, setMessage] = useState("");
  const [restartNotice, setRestartNotice] = useState("");
  const [spatial, setSpatial] = useState({ ready: false, distanceCm: 0, correction: false, filters: false, facing: false, tracking: false, handled: false, supported: false });
  const alive = useRef(active && !preview);
  const fitSignature = useRef("");
  const clock = useRef(0);
  const pageRoot = useRef<Group>(null);
  const publish = useCallback((next: XRStereoRun) => {
    if (next === runRef.current) return false;
    runRef.current = next;
    setRun(next);
    return true;
  }, []);
  const clearUnfinished = useCallback((notice: string) => {
    const next = interruptXRStereoRun(runRef.current);
    if (!publish(next)) return;
    lesson.clearPending();
    setMessage(notice);
  }, [lesson.clearPending, publish]);
  const interrupt = useCallback((reason: XRClinicInterruption = "procedure") => {
    if (reason === "panel" || reason === "release" || reason === "pickup" || runRef.current.capture) return;
    clearUnfinished(reason === "tracking" || reason === "visibility"
      ? "Tracking was interrupted. Restore the booklet position, then establish fixation again."
      : "Booklet setup changed. Restore it, then establish fixation again.");
  }, [clearUnfinished]);
  const runtime = useXRClinicRuntime({
    active: active && !preview,
    equipment,
    placementSockets: sockets,
    editorOpen: lesson.mode !== "none",
    onInterrupt: interrupt,
    onMenu: open => lesson.setMode(open ? "menu" : "none"),
    onSelection: selection => { if (selection.station === "patient") lesson.setMode("menu"); },
  });
  const sample = useCallback(() => {
    const correction = isPatientFitted(runtime.toolsRef.current, "subjective");
    const filters = isPatientFitted(runtime.toolsRef.current, "polarised");
    const pose = runtime.supportedWorkingPose("stereo", true);
    const geometry = pose ? xrStereoGeometry(pose.position, pose.forward) : { distanceCm: 0, facing: false, ready: false };
    const placement = runtime.toolsRef.current.stereo.placement;
    const supported = placement.kind === "socket" && placement.socketId === "sensory-stereo-near";
    const tracking = alive.current && runtime.frameValid.current;
    return {
      ...geometry, correction, filters, tracking, supported,
      handled: (runtime.toolsRef.current.stereo.revision ?? 0) > 0,
      ready: tracking && correction && filters && geometry.ready,
    };
  }, [runtime]);
  useFrame((_, dt) => {
    const object = runtime.objects.current.get("stereo");
    if (pageRoot.current) {
      pageRoot.current.visible = Boolean((active || preview) && object?.visible);
      if (object) {
        pageRoot.current.position.copy(object.position);
        pageRoot.current.quaternion.copy(object.quaternion);
        pageRoot.current.updateMatrixWorld(true);
      }
    }
    const now = sample();
    const signature = sensoryFittingSignature(runtime.toolsRef.current, ["subjective", "polarised"]);
    if (signature !== fitSignature.current) {
      const hadProgress = runRef.current.records.length > 0 || Boolean(runRef.current.fixation || runRef.current.reply || runRef.current.capture);
      fitSignature.current = signature;
      publish(reviseXRStereoSetup(runRef.current));
      lesson.clearPending();
      setMessage("");
      if (hadProgress) setRestartNotice("Correction or polarised glasses changed—the comparison restarted.");
    } else if (!now.ready) {
      clearUnfinished(!now.tracking ? "Tracking was interrupted. Restore tracking and booklet position."
        : !now.facing ? "Turn the booklet so the circle page faces Arun, then establish fixation again."
          : "Return the booklet to the 38–42 cm teaching range, then establish fixation again.");
    }
    clock.current += dt;
    if (clock.current >= .1) {
      clock.current = 0;
      const view = { ...now, distanceCm: Math.round(now.distanceCm * 10) / 10 };
      setSpatial(previous => JSON.stringify(previous) === JSON.stringify(view) ? previous : view);
    }
  });
  const resetRun = useCallback(() => {
    const previous = runRef.current;
    publish(initialXRStereoRun(previous.attempt + 1, previous.generation + 1, previous.setupRevision));
    lesson.reset();
    setMessage("");
    setRestartNotice("");
  }, [lesson.reset, publish]);
  const reset = useCallback(() => {
    resetRun();
    runtime.resetClinic();
    fitSignature.current = sensoryFittingSignature(runtime.toolsRef.current, ["subjective", "polarised"]);
  }, [resetRun, runtime.resetClinic, runtime.toolsRef]);
  useEffect(() => {
    alive.current = active && !preview;
    if (!active || preview) reset();
    return () => { alive.current = false; };
  }, [active, preview, reset]);

  const fixate = () => {
    if (lesson.awarded.current) return;
    if (publish(fixateXRStereoPage(runRef.current, sample().ready))) {
      setMessage("Arun: Okay, I'm looking at the circles.");
      setRestartNotice("");
    }
  };
  const ask = () => {
    if (lesson.awarded.current) return;
    const current = runRef.current;
    const next = requestXRStereoReply(current, sample().ready);
    if (next !== current) {
      publish(next);
      setMessage("");
    }
    // Repeated questions deliberately retain and replay the same immutable response.
  };
  const mark = (circle: StereoCircle) => {
    if (lesson.awarded.current) return;
    const current = runRef.current;
    const next = markXRStereoResponse(current, circle, sample().ready);
    if (next === current) {
      if (current.reply) setMessage("That does not match Arun's spoken response. Listen again and transcribe the named circle.");
      return;
    }
    publish(next);
    setMessage("Response transcribed. Compare it with the examiner-only page key.");
  };
  const classify = (classification: StereoClassification) => {
    if (lesson.awarded.current) return;
    const now = sample(), current = runRef.current;
    const next = classifyXRStereoResponse(current, classification, now.ready, now.distanceCm);
    if (next === current) {
      if (current.markedCircle) setMessage("Recheck the marked response against the examiner-only page key.");
      return;
    }
    publish(next);
    setMessage(next.capture ? "Two consecutive errors reached. Record the threshold independently."
      : "Classification recorded. Turn one page to continue.");
  };
  const nextPage = () => {
    if (lesson.awarded.current) return;
    const next = nextXRStereoPage(runRef.current, sample().ready);
    if (next !== runRef.current) {
      publish(next);
      setMessage("Page turned. Ask Arun to look at the circles again.");
    }
  };
  const cancel = () => { if (!lesson.awarded.current) resetRun(); lesson.setMode("none"); };
  const record = () => {
    const capture = runRef.current.capture, entry = lesson.entriesRef.current.threshold ?? "";
    const correction = isPatientFitted(runtime.toolsRef.current, "subjective");
    const filters = isPatientFitted(runtime.toolsRef.current, "polarised");
    const valid = alive.current && runtime.frameValid.current && correction && filters && Boolean(capture)
      && capture?.attempt === runRef.current.attempt && capture?.setupRevision === runRef.current.setupRevision
      && capture.records.length === runRef.current.records.length
      && sensoryFittingSignature(runtime.toolsRef.current, ["subjective", "polarised"]) === fitSignature.current;
    if (!valid || !entry) { lesson.explain("Complete the comparison and choose a threshold before submitting."); return; }
    const correct = xrStereoEntryCorrect(capture, entry);
    lesson.submit(true, correct, correct ? `Stereopsis: ${entry} seconds of arc. Threshold recorded.`
      : "Recheck the confirmed page record and choose the last correctly identified level.");
  };
  const exit = () => { alive.current = false; reset(); onExit(); };

  const entryReady = Boolean(run.capture && run.records.length === run.capture.records.length);
  const ready = active && !preview && entryReady && spatial.correction && spatial.filters;
  const voiceReport = run.reply ? `The ${stereoCircleNames[run.reply.selected]} circle looks raised.` : undefined;
  const history = run.records.map(record => `${record.level} arcsec · patient ${record.reportedCircle} · classified ${record.classification}`);
  const key = stereoCircleNames[run.reply?.target ?? stereoTargets[run.page] ?? 0];
  const status = !spatial.correction ? "Near correction is not fitted."
    : !spatial.filters ? "Polarised glasses are not fitted over the correction."
      : !spatial.tracking ? "Restore headset and controller tracking."
        : !spatial.facing ? "The booklet must face Arun."
          : !spatial.ready ? `${spatial.distanceCm} cm · position the booklet within 38–42 cm.`
            : run.capture ? `Comparison captured · ${run.records.length} pages confirmed. Choose the last correct threshold.`
              : !run.fixation ? `Page ${run.page + 1} of 6 · ask Arun to look at the circles.`
                : !run.reply ? `Page ${run.page + 1} of 6 · ask which circle is raised.`
                  : !run.markedCircle ? `Arun: ${voiceReport} Mark the circle he named.`
                    : !run.confirmed ? `Examiner key · ${key}. Classify Arun's marked response.`
                      : `Page ${run.page + 1} confirmed · turn one page.`;
  const fullStatus = `${status}${message ? ` · ${message}` : ""}${restartNotice ? ` · ${restartNotice}` : ""}`;

  const fixationAction: LessonAction = { label: "LOOK AT THE CIRCLES", active: Boolean(run.fixation), disabled: !spatial.ready || Boolean(run.capture) || lesson.recorded, run: fixate };
  const askAction: LessonAction = { label: "ASK WHICH CIRCLE IS RAISED", disabled: !spatial.ready || !run.fixation || Boolean(run.capture) || lesson.recorded, run: ask };
  const markActions: LessonAction[] = stereoCircleNames.map(circle => ({ label: circle.toUpperCase(), active: run.markedCircle === circle,
    disabled: !spatial.ready || !run.reply || run.confirmed || lesson.recorded, run: () => mark(circle) }));
  const classificationActions: LessonAction[] = (["correct", "incorrect"] as const).map(value => ({ label: value.toUpperCase(), active: run.classification === value,
    disabled: !spatial.ready || !run.markedCircle || run.confirmed || lesson.recorded, run: () => classify(value) }));
  const turnAction: LessonAction = { label: "TURN PAGE", disabled: !spatial.ready || !run.confirmed || Boolean(run.capture) || lesson.recorded, run: nextPage };
  const actions = [fixationAction, askAction, ...markActions, ...classificationActions, turnAction, { label: "PATIENT-REPORTED VIEW", run: () => lesson.setMode("settings"), disabled: !run.reply }];
  const directActions = !spatial.ready ? [] : !run.fixation ? [fixationAction] : !run.reply ? [askAction]
    : !run.markedCircle ? markActions : !run.confirmed ? classificationActions : run.capture ? [] : [turnAction];
  const guidance = stereoGuidedStep({
    correctionFitted: spatial.correction,
    filtersFitted: spatial.filters,
    bookletHandled: spatial.handled,
    bookletSupported: spatial.supported,
    geometryReady: spatial.ready,
    distanceCm: spatial.distanceCm,
    facing: spatial.facing,
    tracking: spatial.tracking,
    run,
    recorded: lesson.recorded,
  });
  useEffect(() => {
    onMirror?.({ title: "Stereopsis", voiceReport, reportLines: history, status: fullStatus, ready, entryReady, fields, actions, lesson, reset, record, cancel });
  }, [onMirror, voiceReport, history.join("|"), fullStatus, ready, entryReady, run, lesson.mode, lesson.entries, lesson.feedback, lesson.recorded]);

  const reportPanel = <XRHeadPanel>
    <Box s={[.76, .70, .018]} c="#102329" radius={.012} />
    <XRSign text={["FICTIONAL PATIENT-REPORTED VIEW", voiceReport ?? "No current report.",
      "Enlarged illustration · not calibrated stereoscopic optics."]} p={[0, .14, .012]} size={[.70, .24]} bg="#102329" fg="#eefbf7" />
    {stereoCircleNames.map((circle, index) => <group key={circle} position={[(index - 1) * .14, -.08, .027]}>
      <mesh position={[0, run.reply?.selected === index ? .025 : 0, 0]}><circleGeometry args={[.032, 24]} /><meshBasicMaterial color={run.reply?.selected === index ? "#94d3b6" : "#e8e2d4"} side={DoubleSide} /></mesh>
    </group>)}
    <XRPanelButton label="CLOSE REPORT" position={[-.18, -.27, .025]} width={.34} onClick={() => lesson.setMode("none")} />
    <XRPanelButton label="EXIT VR" position={[.18, -.27, .025]} width={.34} onClick={exit} />
  </XRHeadPanel>;
  const book = consultationToolDefinition("stereo");
  const pageTurnEnabled = active && !preview && spatial.ready && run.confirmed && !run.capture && !lesson.recorded;
  return <>
    <XRClinicRuntimeView cleanHands runtime={runtime} active={active && !preview} preview={preview} sensoryStation="stereo" title="STEREOPSIS · PRACTICE"
      instruction="Fit frames · position booklet · fixate · ask · classify · turn page"
      showWallInstructions={!guided} showInstructionalHighlights={guided} />
    {(active || preview) && guided && <XRGuidedStepBubble stepId={guidance.id} stepNumber={guidance.index + 1}
      total={STEREO_GUIDED_STEP_COUNT} title={guidance.title} lines={guidance.lines} complete={guidance.complete} />}
    <group ref={pageRoot} userData={{ xrInteractiveSurface: "stereo", xrToolControls: "stereo" }}>
      <group position={book.workingPoint} rotation={[0, Math.PI, 0]}>
        {Array.from({ length: stereoPracticeLevels.length - run.page }, (_, index) => <Box key={index} p={[index * .0008, index * -.0007, .003 - index * .0006]} s={[.23, .115, .0005]} c={index % 2 ? "#d9d3c3" : "#efeada"} />)}
        <XRSign text={[`PAGE ${run.page + 1} OF 6`, `${stereoPracticeLevels[run.page]} arcsec`]} p={[0, .035, .008]} size={[.22, .032]} bg="#efeada" fg="#284b47" />
        {stereoCircleNames.map((circle, index) => <group key={circle} position={[(index - 1) * .07, -.01, .009]} userData={{ xrStereoPatientCircle: circle }}>
          <mesh><circleGeometry args={[.024, 32]} /><meshBasicMaterial color="#f8f4e9" side={DoubleSide} /></mesh>
          <mesh position={[0, 0, .001]}><ringGeometry args={[.016, .019, 32]} /><meshBasicMaterial color="#2d5450" side={DoubleSide} /></mesh>
        </group>)}
      </group>
      <group position={book.workingPoint}>
        <Box p={[0, 0, .014]} s={[.23, .115, .001]} c="#efeada" />
        <XRSign text={[`PAGE ${run.page + 1} OF 6`, `PAGE KEY · ${key.toUpperCase()}`]} p={[0, .037, .016]} size={[.15, .032]} bg="#efeada" fg="#284b47" />
        <group position={[.092, .037, .018]} userData={{ xrButton: true, xrWidth: .055, xrHeight: .045, xrLabel: "BOOKLET TURN PAGE",
          xrInstrumentControl: "stereo", xrAction: pageTurnEnabled ? nextPage : undefined }}>
          <Box s={[.05, .04, .009]} c={pageTurnEnabled ? "#1f7061" : "#9aa39e"} radius={.006} />
          <XRSign text={["TURN"]} p={[0, 0, .006]} size={[.044, .026]} bg={pageTurnEnabled ? "#1f7061" : "#9aa39e"} fg="#ffffff" />
        </group>
        {stereoCircleNames.map((circle, index) => <group key={circle} position={[(1 - index) * .07, -.018, .016]}
          userData={{ xrButton: true, xrWidth: .05, xrLabel: `BOOKLET ${circle.toUpperCase()}`, xrAction: active && !preview && spatial.ready && run.reply && !run.confirmed ? () => mark(circle) : undefined }}>
          <mesh><circleGeometry args={[.021, 32]} /><meshBasicMaterial color={run.markedCircle === circle ? "#94d3b6" : "#f8f4e9"} /></mesh>
          <mesh position={[0, 0, .001]}><ringGeometry args={[.013, .016, 32]} /><meshBasicMaterial color="#2d5450" /></mesh>
          <XRSign text={[circle.toUpperCase()]} p={[0, -.031, .001]} size={[.064, .012]} bg="#efeada" fg="#284b47" />
        </group>)}
      </group>
    </group>
    {active && run.reply && <group position={[.65, 1.66, -.18]} userData={{ xrIgnoreRay: true }}>
      <Box s={[.55, .35, .012]} c="#07151b" />
      <XRSign text={["FICTIONAL PATIENT-REPORTED VIEW", "ENLARGED ILLUSTRATION", "NOT CALIBRATED STEREOSCOPIC OPTICS", voiceReport ?? ""]} p={[0, .09, .012]} size={[.52, .15]} bg="#07151b" fg="#eefbf7" />
      {stereoCircleNames.map((circle, index) => <mesh key={circle} position={[(index - 1) * .12, run.reply?.selected === index ? -.055 : -.08, .018]}>
        <circleGeometry args={[.033, 24]} /><meshBasicMaterial color={run.reply?.selected === index ? "#94d3b6" : "#e8e2d4"} />
      </mesh>)}
    </group>}
    <PracticeLessonUI runtime={runtime} active={active && !preview} title="STEREOPSIS" status={fullStatus} tools={["subjective", "polarised", "stereo"]}
      actions={actions} directActions={directActions} fields={fields} lesson={lesson} entryReady={entryReady} ready={ready}
      onRecord={record} onCancel={cancel} onReset={reset} onExit={exit} settings={reportPanel}
      forceBoardVisible={Boolean(run.reply || run.capture)} boardStatusLines={[`PAGE ${run.page + 1} OF 6`, ...history.slice(-3), status]}
      help={guided ? ["Fit near correction and polarised glasses as separate layers.", "Face the booklet to Arun within 38–42 cm.",
        "Establish fixation for every page, ask, transcribe, then classify using the examiner key.", "Turn one page only after classification.",
        "Two consecutive errors end the run; record the last correct threshold independently.", "This is an educational approximation, not calibrated stereo optics."]
        : ["Complete the examination using the available neutral controls.", "This is an educational approximation, not calibrated stereo optics."]} />
  </>;
}
