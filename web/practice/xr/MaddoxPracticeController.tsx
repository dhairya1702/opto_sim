import { usePracticeVoiceProcedure } from "../../voice/usePracticeVoiceProcedure";
import { usePatientReportSpeech } from "../../voice/usePatientReportSpeech";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import {
  MADDOX_GUIDED_STEP_COUNT, MADDOX_PRISM_CELLS, MADDOX_TRIALS, armMaddoxReport, cancelMaddoxEntry,
  captureMaddox, enterMaddox, interruptMaddox, maddoxFittingGuideSocketIds, maddoxGuidedStep,
  maddoxNearLightCondition, maddoxSetupIssue, newMaddoxRun, sampleMaddox, submitMaddox, type MaddoxBase, type MaddoxRun, type MaddoxSpatialSample,
} from "../../interaction/maddoxProcedure";
import { useXRClinicRuntime, type ClinicInputMode } from "../../interaction/useXRClinicRuntime";
import { desktopPenlightPose } from "../../interaction/desktopClinicInput";
import { PRISM_BAR_WORKING_Y } from "../../interaction/xrConsultationTools";
import { CLINIC_PATIENT_EYES } from "../../interaction/clinicPatient";
import { isPatientFitted, sensoryTargetCondition } from "../../interaction/xrSensoryEquipment";
import { LIBRARY_SURFACES, libraryEquipment, libraryRodFitted, libraryRodOrientation, librarySockets } from "../../interaction/xrLibraryEquipment";
import { LibraryEquipmentTray } from "../../scene/LibraryClinicEquipment";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { XRWorkingDistanceLabel } from "../../scene/XRWorkingDistanceLabel";
import { XRGuidedStepBubble } from "../../scene/XRGuidedStepBubble";
import { XRSign } from "../../scene/XRClinicPanels";
import { wrapGuidedStepLines } from "../../scene/XRGuidedStepBubble";
import { usePracticeAttempt } from "../PracticeAttemptContext";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonField } from "./PracticeLessonUI";

const emptySample = (): MaddoxSpatialSample => ({ correctionFitted: false, rodFitted: false, grooveDegrees: null, targetReady: false,
  targetPowered: false, targetSite: null, distanceCm: 0, fixationInstruction: false, prismHeld: false, prismForward: false,
  prismAligned: false, cell: null, base: null, tracking: false });
const initialPrismSetting = Object.freeze({ power: 20 as (typeof MADDOX_PRISM_CELLS)[number], base: "BI" as MaddoxBase });

export function MaddoxPracticeController({ active, preview = false, inputMode = "xr", onComplete, onExit, onMirror }: {
  active: boolean; preview?: boolean; inputMode?: ClinicInputMode; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const { settings } = usePracticeAttempt();
  const guided = settings?.kind !== "test";
  const feedbackKind = guided ? "guided" : "test";
  const live = active && !preview;
  const lesson = usePracticeLesson(onComplete);
  const runRef = useRef<MaddoxRun>(newMaddoxRun());
  const sampleRef = useRef<MaddoxSpatialSample>(emptySample());
  const prismSettingRef = useRef(initialPrismSetting);
  const [run, setRunState] = useState(runRef.current);
  const [spatial, setSpatial] = useState(sampleRef.current);
  const [prismSetting, setPrismSettingState] = useState(prismSettingRef.current);
  const fixation = useRef(false);
  const lastCell = useRef<string>("");
  const captureTrigger = useRef<() => void>(() => undefined);
  const setRun = useCallback((next: MaddoxRun) => { runRef.current = next; setRunState(next); }, []);
  const setPrismSetting = useCallback((next: { power: (typeof MADDOX_PRISM_CELLS)[number]; base: MaddoxBase }) => {
    prismSettingRef.current = Object.freeze(next); setPrismSettingState(prismSettingRef.current);
  }, []);
  const stepPrismPower = useCallback((step: -1 | 1) => {
    const current = prismSettingRef.current;
    const index = MADDOX_PRISM_CELLS.indexOf(current.power);
    const nextIndex = Math.max(0, Math.min(MADDOX_PRISM_CELLS.length - 1, index + step));
    if (nextIndex === index) return false;
    setPrismSetting({ ...current, power: MADDOX_PRISM_CELLS[nextIndex] }); return true;
  }, [setPrismSetting]);
  const selectPrismBase = useCallback((step: -1 | 1) => {
    const current = prismSettingRef.current;
    const axis = MADDOX_TRIALS[runRef.current.trialIndex].axis;
    const base: MaddoxBase = axis === "horizontal" ? step < 0 ? "BI" : "BO" : step < 0 ? "BU" : "BD";
    if (base === current.base) return false;
    setPrismSetting({ ...current, base }); return true;
  }, [setPrismSetting]);
  const runtime = useXRClinicRuntime({ active: live, inputMode, equipment: libraryEquipment("maddox"), placementSockets: librarySockets("maddox"), placementSurfaces: LIBRARY_SURFACES,
    desktopHeldPose: id => id === "pupils" ? desktopPenlightPose([0, 1.5, -.18]) : null,
    editorOpen: lesson.mode !== "none", onMenu: open => lesson.setMode(open ? "menu" : "none"),
    onToolUsed: (id, action) => { if (id === "prism" && action === "activate") captureTrigger.current(); },
    onThumbstickStep: (id, step, _hand, axis) => id === "prism" && (axis === "horizontal" ? selectPrismBase(step) : stepPrismPower(step)),
    onInterrupt: reason => {
      if (reason === "panel" || runRef.current.capture) return;
      const labels: Record<string, string> = { tracking: "Tracking was interrupted.", visibility: "Headset visibility was interrupted.", procedure: "Teleport interrupted the setup.", transfer: "Tool transfer interrupted the setup.", release: "Tool release interrupted the setup.", pickup: "Equipment changed." };
      setRun(interruptMaddox(runRef.current, labels[reason] ?? "The physical setup changed."));
      lesson.clearPending(); fixation.current = false; lastCell.current = "";
    },
  });

  const physicalSample = useCallback((): MaddoxSpatialSample => {
    const tools = runtime.toolsRef.current;
    const trial = MADDOX_TRIALS[runRef.current.trialIndex];
    const correctionFitted = isPatientFitted(tools, "subjective");
    const rodFitted = libraryRodFitted(tools);
    const grooveDegrees = libraryRodOrientation(tools);
    let targetReady = false, targetPowered = false, distanceCm = 0;
    let targetDistanceReady: boolean | undefined, targetAimReady: boolean | undefined;
    if (trial.site === "distance") {
      const pose = runtime.supportedWorkingPose("worth", true);
      const condition = pose && sensoryTargetCondition(pose, tools);
      targetReady = condition?.endpoint === "distance" && Boolean(condition.facing);
      targetPowered = tools.worth.powered;
      distanceCm = condition?.distanceCm ?? 0;
    } else {
      const pose = runtime.supportedWorkingPose("pupils", true);
      const condition = maddoxNearLightCondition(pose);
      targetReady = condition.ready;
      targetDistanceReady = condition.distanceReady;
      targetAimReady = condition.aimReady;
      targetPowered = tools.pupils.powered;
      distanceCm = condition.distanceCm;
    }
    const placement = tools.prism.placement;
    const prismHeld = placement.kind === "held";
    let prismForward = false, prismAligned = false, cell: (typeof MADDOX_PRISM_CELLS)[number] | null = null, base: MaddoxBase | null = null;
    const object = runtime.objects.current.get("prism");
    if (object && prismHeld) {
      object.updateMatrixWorld(true);
      const localEye = object.worldToLocal(new Vector3(...CLINIC_PATIENT_EYES.OD));
      cell = prismSettingRef.current.power;
      prismAligned = Math.abs(localEye.x) <= .038 && Math.abs(localEye.y - PRISM_BAR_WORKING_Y) <= .030 && Math.abs(localEye.z - .012) <= .14;
      const quaternion = object.getWorldQuaternion(runtime.quaternion);
      const forward = new Vector3(0, 0, -1).applyQuaternion(quaternion);
      prismForward = forward.z <= -Math.cos(Math.PI / 6);
      base = prismSettingRef.current.base;
    }
    return { correctionFitted, rodFitted, grooveDegrees, targetReady, targetPowered, targetDistanceReady, targetAimReady, targetSite: targetReady ? trial.site : null,
      distanceCm, fixationInstruction: fixation.current, prismHeld, prismForward, prismAligned, cell, base, tracking: live && runtime.frameValid.current };
  }, [live, runtime]);

  const publishSample = useCallback((next: MaddoxSpatialSample) => { sampleRef.current = next; setSpatial(next); }, []);
  const clock = useRef(0);
  useFrame((_, dt) => {
    if (!live) return;
    clock.current += dt;
    if (clock.current < .05) return;
    clock.current = 0;
    let nextSample = physicalSample();
    const nextRun = runRef.current.reportInstruction && !runRef.current.capture ? sampleMaddox(runRef.current, nextSample, performance.now(), feedbackKind) : runRef.current;
    if (nextSample.prismAligned && nextSample.cell !== null) {
      const key = `${nextSample.cell}:${nextSample.base ?? "tilted"}`;
      if (key !== lastCell.current) {
        const hand = runtime.toolsRef.current.prism.placement.kind === "held" ? runtime.toolsRef.current.prism.placement.hand : null;
        if (hand) runtime.pulseHand(hand, .32, 45);
        lastCell.current = key;
      }
    } else lastCell.current = "";
    if (nextRun !== runRef.current) {
      if (runRef.current.reportInstruction && !nextRun.reportInstruction) {
        fixation.current = false;
        nextSample = { ...nextSample, fixationInstruction: false };
        lesson.clearPending();
      }
      setRun(nextRun);
    }
    publishSample(nextSample);
  });

  const reset = useCallback(() => {
    fixation.current = false; lastCell.current = ""; setRun(newMaddoxRun()); setPrismSetting(initialPrismSetting); lesson.reset(); runtime.resetClinic(); publishSample(emptySample());
  }, [lesson.reset, publishSample, runtime.resetClinic, setPrismSetting, setRun]);
  useEffect(() => { if (!live) reset(); }, [live, reset]);

  const ask = () => {
    if (!live || runRef.current.capture || lesson.awarded.current) return;
    const currentTrial = MADDOX_TRIALS[runRef.current.trialIndex];
    const sample = physicalSample();
    if (maddoxSetupIssue(sample, currentTrial, feedbackKind) !== "Ask Arun to fixate and report where the streak lies relative to the light.") return;
    fixation.current = true;
    const nextSample = { ...sample, fixationInstruction: true };
    publishSample(nextSample); setRun(armMaddoxReport(runRef.current, nextSample));
  };
  const placeAtSocket = (id: "subjective" | "maddox" | "worth", socketId: string, powered = false) => {
    if (!live) return;
    const socket = librarySockets("maddox").find(candidate => candidate.tool === id && candidate.id === socketId);
    if (!socket) return;
    const tool = runtime.toolsRef.current[id];
    runtime.updateTools({ ...runtime.toolsRef.current, [id]: { ...tool, powered: powered || tool.powered,
      placement: { kind: "socket", position: socket.position, rotation: socket.rotation, socketId: socket.id, fittingLayer: socket.fittingLayer },
      revision: (tool.revision ?? 0) + 1 } });
  };
  const capture = useCallback(() => {
    if (!live || runRef.current.capture || lesson.awarded.current) return;
    const nextSample = physicalSample(); publishSample(nextSample);
    const next = captureMaddox(runRef.current, nextSample, feedbackKind); setRun(next);
    if (!next.capture) lesson.explain(next.feedback);
    else { lesson.clearPending(); lesson.progress("Coincidence captured. Put both tools down, then record power and base."); }
  }, [feedbackKind, lesson, live, physicalSample, publishSample, setRun]);
  captureTrigger.current = capture;

  const toolsDown = runtime.tools.prism.placement.kind !== "held" && (run.capture?.site !== "near" || runtime.tools.pupils.placement.kind !== "held");
  const entryReady = live && Boolean(run.capture) && toolsDown;
  const record = () => {
    if (!entryReady || lesson.awarded.current) return;
    const previousRecords = runRef.current.records.length;
    let next = enterMaddox(runRef.current, lesson.entriesRef.current.power ?? "", (lesson.entriesRef.current.base ?? "") as MaddoxRun["entryBase"]);
    next = submitMaddox(next); setRun(next);
    if (next.records.length === previousRecords) { lesson.explain(next.feedback); return; }
    if (next.phase === "complete") { lesson.submit(true, true, "All four Maddox measurements independently recorded."); return; }
    fixation.current = false; setPrismSetting(initialPrismSetting); lesson.clearPending(); lesson.setMode("none"); lesson.progress(next.feedback);
  };
  const cancel = () => { if (!lesson.awarded.current) { setRun(cancelMaddoxEntry(runRef.current)); fixation.current = false; lesson.clearPending(); } lesson.setMode("none"); };

  const trial = MADDOX_TRIALS[run.trialIndex];
  const issue = maddoxSetupIssue(spatial, trial, feedbackKind);
  const procedureStatus = !run.reportInstruction ? issue || "Ask Arun to fixate and report the streak/light relationship."
    : run.report || issue || run.feedback || "Hold the selected prism cell steady.";
  const status = `${trial.site} · ${trial.axis} · ${Math.round(spatial.distanceCm)} cm · prism ${prismSetting.power}Δ ${prismSetting.base} · ${run.records.length}/4 records · ${run.capture ? toolsDown ? "Captured; enter power and base." : "Captured; put the tools down before entry." : procedureStatus}`;
  const guidance = maddoxGuidedStep(run, spatial);
  const fittingGuideSocketIds = maddoxFittingGuideSocketIds(spatial, trial);
  const highlightPowerSwitch = guided && trial.site === "distance" && spatial.targetReady && !spatial.targetPowered;
  const showAsk = live && !run.reportInstruction && !run.capture && run.phase !== "complete" && maddoxSetupIssue(spatial, trial, feedbackKind) === "Ask Arun to fixate and report where the streak lies relative to the light.";
  const askAction = { voiceIds: ["fixate-target", "request-report"], label: run.reportInstruction ? "REPORTING INSTRUCTION GIVEN ✓" : "ASK ARUN TO FIXATE / REPORT", run: ask, active: run.reportInstruction, disabled: Boolean(run.capture) };
  const actions = [
    ...(showAsk ? [askAction] : []),
    { label: "PRISM TRIGGER · CAPTURE", run: capture, disabled: Boolean(run.capture) },
    { label: "FIT CORRECTION", run: () => placeAtSocket("subjective", "sensory-correction"), active: spatial.correctionFitted },
    { label: `FIT MADDOX ROD · ${trial.axis === "horizontal" ? "HORIZONTAL" : "VERTICAL"} GROOVES`,
      run: () => placeAtSocket("maddox", trial.axis === "horizontal" ? "sensory-maddox-horizontal" : "sensory-maddox-vertical"),
      active: spatial.rodFitted && spatial.grooveDegrees === (trial.axis === "horizontal" ? 0 : 90) },
    ...(trial.site === "distance" ? [{ label: "DOCK + SWITCH ON DISTANCE POINT", run: () => placeAtSocket("worth", "sensory-worth-distance", true),
      active: spatial.targetReady && spatial.targetPowered }] : []),
  ];
  const fields: LessonField[] = [
    { id: "power", label: "Prism power you observed (Δ)", choices: MADDOX_PRISM_CELLS.map(power => [String(power), `${power}Δ`]) },
    { id: "base", label: "Prism base you observed", choices: [["BI", "BI · Base in"], ["BO", "BO · Base out"], ["BU", "BU · Base up"], ["BD", "BD · Base down"]] },
  ];
  const records = run.records.map(record => `${record.capture.site} ${record.capture.axis}: ${record.submittedPower}Δ ${record.submittedBase} · ${Math.round(record.capture.distanceCm)} cm`);
  const audioMessage = usePatientReportSpeech(live, run.report
    ? `${run.trialIndex}:${run.setupRevision}:${run.stableCell}:${run.stableBase}` : "", run.report);
  const audioStatus = run.report && audioMessage ? [audioMessage] : [];
  usePracticeVoiceProcedure("maddox", active && !preview, { actions, voiceReport: run.report || undefined });
  useEffect(() => { onMirror?.({ title: "Maddox rod", voiceReport: run.report || undefined, findingPosition: { current: run.trialIndex + 1, total: 4 }, status,
    ready: entryReady, entryReady, reportLines: records, fields, actions, lesson, reset, record, cancel });
  }, [onMirror, status, entryReady, run, lesson.mode, lesson.entries, lesson.feedback, lesson.recorded, runtime.tools]);

  return <>
    <XRClinicRuntimeView cleanHands runtime={runtime} active={live} preview={preview} title="MADDOX ROD" showWallInstructions={false} showInstructionalHighlights={guided}
      instrumentSettings={{ maddox: { angle: 0 }, worth: { point: true, highlightPowerSwitch, onPowerChange: live ? powered => runtime.setToolPower("worth", powered) : undefined }, prism: { profile: "maddox", power: prismSetting.power, base: prismSetting.base } }} />
    {live && guided && trial.site === "near" && !run.capture && <XRWorkingDistanceLabel runtime={runtime} tool="pupils" distanceCm={spatial.distanceCm} ready={spatial.targetDistanceReady === true} />}
    {(live || preview) && <LibraryEquipmentTray active={live} equipment={runtime.equipment} showFittingGuides={guided} fittingGuideSocketIds={fittingGuideSocketIds} />}
    {(live || preview) && guided && <XRGuidedStepBubble stepId={guidance.id} stepNumber={guidance.index + 1} total={MADDOX_GUIDED_STEP_COUNT}
      context={`TRIAL ${run.trialIndex + 1}/${MADDOX_TRIALS.length} · ${trial.site.toUpperCase()} · ${trial.axis.toUpperCase()}`}
      title={guidance.title} lines={guidance.lines} complete={guidance.complete} />}
    <PracticeLessonUI runtime={runtime} active={live} title="Maddox rod" status={status} tools={["prism", "pupils"]} actions={actions} directActions={showAsk ? [askAction] : []} forceBoardVisible fields={fields} lesson={lesson}
      boardReport={entryReady ? undefined : <>{run.report && <XRSign transparentBackground text={["ARUN SAYS · FICTIONAL PATIENT", ...wrapGuidedStepLines([run.report], 42)]}
        p={[0, 0, 0]} size={[.70, .22]} bg="#102329" fg="#eefbf7" />}</>}
      recordingOnlyBoard recordingFieldTop={.48} boardFindingLines={entryReady ? [] : audioStatus}
      ready={entryReady} entryReady={entryReady} onRecord={record} onReset={reset} onExit={onExit} onCancel={cancel}
      help={guided ? ["Place the trial frame over both eyes, then fit the red Maddox lens over the right eye (OD) using the single highlighted guide.", "Remove, rotate and refit the rod when the guide changes between horizontal and vertical trials.", "At distance, place the point target on the Distance Target Dock beside Arun, switch it on and confirm the point in the mirror. At near, hold the lit penlight 38–42 cm from his eyes.", "Hold the prism over OD. Thumbstick up/down changes power; left/right selects the base pair for the current axis.", "Start at 20Δ, press down to reduce through the cells, then use the prism-hand trigger at coincidence.", "Put tools down and enter power plus base. Optics, tolerances and reports are illustrative draft assumptions."] : ["Grip, trigger, panel and recording controls remain available as accessibility guidance.", "Complete the physical procedure and record the captured observation."]} />
  </>;
}
