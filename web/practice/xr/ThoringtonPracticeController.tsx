import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import {
  THORINGTON_CASES, armThoringtonReport, cancelThoringtonEntry, classifyThoringtonCard, enterThorington,
  interruptThorington, newThoringtonRun, nextThoringtonCase, sampleThorington, submitThorington,
  thoringtonGuidedStep, thoringtonLightIntersection, thoringtonStatusDetail, thoringtonTestStatus,
  type ThoringtonInterpretation, type ThoringtonReportedSide, type ThoringtonRun, type ThoringtonSpatialSample,
} from "../../interaction/thoringtonProcedure";
import { CLINIC_EYE_MIDPOINT } from "../../interaction/clinicPatient";
import { useXRClinicRuntime } from "../../interaction/useXRClinicRuntime";
import { isPatientFitted } from "../../interaction/xrSensoryEquipment";
import { LIBRARY_SURFACES, libraryEquipment, libraryRodFitted, libraryRodOrientation, librarySockets } from "../../interaction/xrLibraryEquipment";
import { LibraryEquipmentTray, LibraryNearStand } from "../../scene/LibraryClinicEquipment";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { XRGuidedStepBubble } from "../../scene/XRGuidedStepBubble";
import { XRSign } from "../../scene/XRClinicPanels";
import { usePracticeAttempt } from "../PracticeAttemptContext";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonField } from "./PracticeLessonUI";

const emptySample = (): ThoringtonSpatialSample => ({ correctionFitted: false, correctionRevision: 0, rodFitted: false, grooveDegrees: null, rodFitRevision: 0,
  cardPresent: false, cardHeldOrSupported: false, cardDistanceCm: 0, cardFacing: false, cardUpright: false,
  penlightHeld: false, penlightPowered: false, penlightExaminerSide: false, penlightTowardPatient: false,
  apertureHit: false, fixationInstruction: false, tracking: false });

export function ThoringtonPracticeController({ active, preview = false, onComplete, onExit, onMirror }: {
  active: boolean; preview?: boolean; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const { settings } = usePracticeAttempt();
  const guided = settings?.kind !== "test";
  const live = active && !preview;
  const completionSent = useRef(false);
  const lesson = usePracticeLesson(() => { if (!completionSent.current) { completionSent.current = true; onComplete(); } });
  const runRef = useRef<ThoringtonRun>(newThoringtonRun());
  const sampleRef = useRef<ThoringtonSpatialSample>(emptySample());
  const [run, setRunState] = useState(runRef.current);
  const [spatial, setSpatial] = useState(sampleRef.current);
  const fixation = useRef(false);
  const setRun = useCallback((next: ThoringtonRun) => { runRef.current = next; setRunState(next); }, []);
  const publishSample = useCallback((next: ThoringtonSpatialSample) => { sampleRef.current = next; setSpatial(next); }, []);
  const runtime = useXRClinicRuntime({ active: live, equipment: libraryEquipment("thorington"), placementSockets: librarySockets("thorington"), placementSurfaces: LIBRARY_SURFACES,
    editorOpen: lesson.mode !== "none", onMenu: open => lesson.setMode(open ? "menu" : "none"),
    onInterrupt: reason => {
      if (reason === "panel" || runRef.current.capture) return;
      const labels: Record<string, string> = { tracking: "Tracking was interrupted.", visibility: "Headset visibility was interrupted.",
        procedure: "Teleport interrupted the setup.", transfer: "Tool transfer interrupted the setup.", release: "Tool release interrupted the setup.",
        pickup: "Equipment changed.", exit: "The XR session ended." };
      setRun(interruptThorington(runRef.current, labels[reason] ?? "The physical setup changed."));
      fixation.current = false; lesson.clearPending();
    },
  });

  const physicalSample = useCallback((): ThoringtonSpatialSample => {
    const tools = runtime.toolsRef.current;
    const cardPlacement = tools.thorington.placement;
    const cardHeldOrSupported = cardPlacement.kind === "held" || cardPlacement.kind === "socket" && cardPlacement.socketId === "library-thorington-near";
    const cardPose = cardHeldOrSupported ? runtime.supportedWorkingPose("thorington", true) : null;
    const cardObject = runtime.objects.current.get("thorington");
    const cardUp = cardObject ? new Vector3(0, 1, 0).applyQuaternion(cardObject.getWorldQuaternion(runtime.quaternion)).normalize().toArray() as [number, number, number] : [0, 1, 0] as [number, number, number];
    const card = cardPose ? { position: cardPose.position, patientFacingNormal: cardPose.forward, up: cardUp } : null;
    const cardCondition = card ? classifyThoringtonCard(card, CLINIC_EYE_MIDPOINT) : null;
    const lightPlacement = tools.pupils.placement;
    const penlightHeld = lightPlacement.kind === "held";
    const lightPose = penlightHeld ? runtime.supportedWorkingPose("pupils", true) : null;
    const lightCondition = card && lightPose ? thoringtonLightIntersection(card, { position: lightPose.position, direction: lightPose.forward }) : null;
    return { correctionFitted: isPatientFitted(tools, "subjective"), correctionRevision: tools.subjective.revision ?? 0, rodFitted: libraryRodFitted(tools),
      grooveDegrees: libraryRodOrientation(tools), rodFitRevision: tools.maddox.revision ?? 0,
      cardPresent: Boolean(cardPose), cardHeldOrSupported, cardDistanceCm: cardCondition?.distanceCm ?? 0,
      cardFacing: Boolean(cardCondition?.patientFacing), cardUpright: Boolean(cardCondition?.upright), penlightHeld,
      penlightPowered: penlightHeld && tools.pupils.powered, penlightExaminerSide: Boolean(lightCondition?.examinerSide),
      penlightTowardPatient: Boolean(lightCondition?.towardPatient), apertureHit: Boolean(lightCondition?.apertureHit),
      fixationInstruction: fixation.current, tracking: live && runtime.frameValid.current };
  }, [live, runtime]);

  const clock = useRef(0);
  useFrame((_, dt) => {
    if (!live) return;
    clock.current += dt;
    if (clock.current < .04) return;
    clock.current = 0;
    const nextSample = physicalSample();
    const nextRun = sampleThorington(runRef.current, nextSample, performance.now());
    if (nextRun !== runRef.current) {
      if (runRef.current.capture && !nextRun.capture) { fixation.current = false; lesson.clearPending(); }
      setRun(nextRun);
    }
    publishSample(nextSample);
  });

  const reset = useCallback(() => {
    fixation.current = false; setRun(newThoringtonRun(0, completionSent.current)); lesson.reset(); runtime.resetClinic(); publishSample(emptySample());
  }, [lesson.reset, publishSample, runtime.resetClinic, setRun]);
  useEffect(() => { if (!live) reset(); }, [live, reset]);

  const ask = () => {
    if (!live || runRef.current.capture || lesson.awarded.current) return;
    fixation.current = true;
    const nextSample = { ...physicalSample(), fixationInstruction: true };
    publishSample(nextSample);
    const next = armThoringtonReport(runRef.current, nextSample); setRun(next);
    if (!next.reportInstruction) lesson.explain(next.feedback);
  };
  const toolsDown = runtime.tools.thorington.placement.kind !== "held" && runtime.tools.pupils.placement.kind !== "held";
  const entryReady = live && Boolean(run.capture) && toolsDown;
  const record = () => {
    if (!entryReady || lesson.awarded.current && runRef.current.phase !== "complete") return;
    const previous = runRef.current.records.length;
    let next = enterThorington(runRef.current, lesson.entriesRef.current.magnitude ?? "",
      (lesson.entriesRef.current.side ?? "") as ThoringtonReportedSide | "",
      (lesson.entriesRef.current.interpretation ?? "") as ThoringtonInterpretation | "");
    next = submitThorington(next); setRun(next);
    if (next.records.length === previous) { lesson.explain(next.feedback); return; }
    if (next.phase === "complete") { lesson.submit(true, true, "Both Modified Thorington axes were independently recorded."); return; }
    fixation.current = false; lesson.clearPending(); lesson.setMode("none"); lesson.progress(next.feedback);
  };
  const cancel = () => { if (runRef.current.phase !== "complete") { setRun(cancelThoringtonEntry(runRef.current)); fixation.current = false; lesson.clearPending(); } lesson.setMode("none"); };
  const nextCase = () => {
    if (!live || runRef.current.phase !== "complete") return;
    fixation.current = false; setRun(nextThoringtonCase(runRef.current)); lesson.reset(); runtime.resetClinic(); publishSample(emptySample());
  };

  const current = THORINGTON_CASES[run.caseIndex].trials[run.trialIndex];
  const statusDetail = guided ? thoringtonStatusDetail(run, spatial) : thoringtonTestStatus(run, spatial);
  const status = `${current.axis} · ${Math.round(spatial.cardDistanceCm)} cm · ${run.records.length}/2 records · ${run.capture
    ? toolsDown ? "Captured; enter magnitude, raw side, and interpretation." : "Captured; put the card and penlight down before entry."
    : statusDetail}`;
  const guidance = thoringtonGuidedStep(run, spatial);
  const actions = [{ label: run.reportInstruction ? "REPORTING INSTRUCTION GIVEN ✓" : "ASK NUMBER AND SIDE", run: ask,
    active: run.reportInstruction, disabled: Boolean(run.capture) }];
  const sideChoices: readonly ThoringtonReportedSide[] = current.axis === "horizontal" ? ["right", "left", "through"] : ["above", "below", "through"];
  const interpretationChoices: readonly ThoringtonInterpretation[] = current.axis === "horizontal"
    ? ["orthophoria", "esophoria", "exophoria"] : ["orthophoria", "left-hyperphoria", "right-hyperphoria"];
  const fields: LessonField[] = [
    { id: "magnitude", label: "Reported magnitude", choices: [], number: { min: 0, max: 10, unit: "Δ", step: 1 } },
    { id: "side", label: "Arun's reported side", choices: sideChoices.map(value => [value, value]) },
    { id: "interpretation", label: "Clinical interpretation", choices: interpretationChoices.map(value => [value, value]) },
  ];
  const records = run.records.map(record => `${record.capture.caseId} · ${record.capture.axis}: signed ${record.capture.signedCoordinate > 0 ? "+" : ""}${record.capture.signedCoordinate} at ${record.capture.actualCardDistanceCm.toFixed(1)} cm · report ${record.capture.rawReportedSide} · entered ${record.submittedMagnitude}Δ ${record.submittedInterpretation}`);
  const voiceReport = run.capture ? `Arun reports ${run.capture.report}` : undefined;
  useEffect(() => { onMirror?.({ title: "Modified Thorington", voiceReport, findingPosition: { current: run.trialIndex + 1, total: 2 },
    status, ready: entryReady, entryReady, reportLines: records, fields, actions, lesson, reset, record, next: run.phase === "complete" ? nextCase : undefined, cancel });
  }, [onMirror, voiceReport, status, entryReady, records.join("|"), run, lesson.mode, lesson.entries, lesson.feedback, lesson.recorded, runtime.tools]);

  return <>
    <XRClinicRuntimeView cleanHands runtime={runtime} active={live} preview={preview} title="MODIFIED THORINGTON"
      showInstructionalHighlights={guided} instrumentSettings={{ maddox: { angle: 0 } }} />
    {(live || preview) && <><LibraryEquipmentTray active={live} equipment={runtime.equipment} showFittingGuides={guided} /><LibraryNearStand card="thorington" /></>}
    {(live || preview) && guided && <XRGuidedStepBubble stepId={guidance.id} stepNumber={guidance.index + 1} total={10} title={guidance.title} lines={guidance.lines} complete={guidance.complete} />}
    {live && run.capture && <XRSign text={["FICTIONAL PATIENT-REPORTED VIEW", "ENLARGED ILLUSTRATION · NOT A CALIBRATED VISUAL TEST", run.capture.report]}
      p={[.56, 1.74, -.10]} size={[.68, .25]} bg="#07151b" fg="#eefbf7" />}
    <PracticeLessonUI runtime={runtime} active={live} title="Modified Thorington" status={status} tools={["thorington", "pupils"]}
      actions={actions} fields={fields} lesson={lesson} ready={entryReady} entryReady={entryReady} onRecord={record} onReset={reset}
      onNext={run.phase === "complete" ? nextCase : undefined} onExit={onExit} onCancel={cancel}
      help={guided ? ["Fit near correction and physically fit the Maddox rod before OD.", "Use horizontal grooves first; remove, roll 90°, and refit for vertical.",
        "Hold or support the combined card 38–42 cm away, upright and facing Arun.", "Hold the penlight trigger and aim from the examiner side through the real 10 mm aperture.",
        "Ask for number and side, maintain geometry for 250 ms, then put both tools down.", "Enter magnitude, raw side, and interpretation independently. All geometry remains an unvalidated draft."]
        : ["Grip, trigger, controller, keyboard, voice, and recording controls remain available as accessibility guidance.", "Complete the physical procedure and record the captured observation."]} />
  </>;
}
