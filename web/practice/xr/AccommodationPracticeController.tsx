import { facilityClearDelay } from "../../interaction/accommodativeFacility";
import { usePracticeVoiceProcedure } from "../../voice/usePracticeVoiceProcedure";
import { XRGuidedStepBubble } from "../../scene/XRGuidedStepBubble";
import { accommodativeFacilityBoardActions } from "../../interaction/practiceBoardActions";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import {
  accommodativeFacilityEye, accommodativeFacilityGuidedStep, accommodativeFacilitySeconds,
  establishFacilityFixation, facilityGeometryIssue, flipAccommodativeFacility,
  facilityUsesAccessibilityShortcuts,
  interruptAccommodativeFacility, newAccommodativeFacilityRun, restartAccommodativeFacilityEye,
  sampleAccommodativeFacility, startAccommodativeFacility, submitAccommodativeFacility,
  type AccommodativeFacilityRun, type FacilitySpatialSample,
} from "../../interaction/accommodativeFacilityProcedure";
import { LIBRARY_SURFACES, LIBRARY_TITLES, libraryEquipment, libraryNear, libraryOcclusion, libraryOpticPlacement, librarySockets } from "../../interaction/xrLibraryEquipment";
import { isPatientFitted } from "../../interaction/xrSensoryEquipment";
import { consultationToolDefinition } from "../../interaction/xrConsultationTools";
import { useXRClinicRuntime, type ClinicInputMode } from "../../interaction/useXRClinicRuntime";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { LibraryEquipmentTray, LibraryNearStand } from "../../scene/LibraryClinicEquipment";
import { XRSign } from "../../scene/XRClinicPanels";
import { usePracticeAttempt } from "../PracticeAttemptContext";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonAction, type LessonField } from "./PracticeLessonUI";

export function AccommodationPracticeController({ active, preview = false, inputMode = "xr", onComplete, onExit, onMirror }: {
  kind: "accommodative-facility"; active: boolean; preview?: boolean; inputMode?: ClinicInputMode;
  onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const live = active && !preview;
  const { settings } = usePracticeAttempt();
  const attemptKind = settings?.kind ?? "guided";
  const completionSent = useRef(false);
  const lesson = usePracticeLesson(() => { if (!completionSent.current) { completionSent.current = true; onComplete(); } });
  const run = useRef<AccommodativeFacilityRun>(newAccommodativeFacilityRun());
  const publishClock = useRef(0);
  const [state, setState] = useState({ run: run.current, seconds: 60 });

  function spatial(nowMs = performance.now()): FacilitySpatialSample {
    const tools = runtime.toolsRef.current;
    const flipper = tools["lens-flipper"];
    const flipperHeld = flipper.placement.kind === "held";
    return { nowMs, correctionFitted: isPatientFitted(tools, "subjective"),
      targetReady: libraryNear(runtime.supportedWorkingPose("near", true)),
      occlusionReady: libraryOcclusion(tools, accommodativeFacilityEye(run.current)),
      flipperHeld, flipperAligned: flipperHeld && libraryOpticPlacement(runtime.supportedWorkingPose("lens-flipper", true), accommodativeFacilityEye(run.current), true),
      visible: Boolean(runtime.objects.current.get("lens-flipper")?.visible), tracking: runtime.frameValid.current };
  }
  const publish = useCallback(() => {
    const next = { run: run.current, seconds: accommodativeFacilitySeconds(run.current, performance.now()) };
    setState(previous => previous.run === next.run && previous.seconds === next.seconds ? previous : next);
  }, []);
  const flip = useCallback(() => {
    if (!live || lesson.awarded.current) return false;
    const before = run.current;
    run.current = flipAccommodativeFacility(before, spatial()); publish();
    return run.current.side !== before.side;
  }, [lesson.awarded, live, publish]);
  const runtime = useXRClinicRuntime({ active: live, inputMode, equipment: libraryEquipment("accommodative-facility"),
    placementSockets: librarySockets("accommodative-facility"), placementSurfaces: LIBRARY_SURFACES,
    editorOpen: lesson.mode !== "none", onMenu: open => lesson.setMode(open ? "menu" : "none"),
    onInterrupt: reason => { if (["visibility", "transfer", "tracking", "procedure", "configuration", "release"].includes(reason)) run.current = interruptAccommodativeFacility(run.current, "The physical procedure was interrupted."); },
    onToolUsed: (id, action) => {
      if (action === "pickup" && id !== "lens-flipper")
        run.current = interruptAccommodativeFacility(run.current, "The physical setup changed.");
      if (inputMode === "desktop" && id === "lens-flipper" && action === "activate") flip();
    },
  });
  useFrame((_, dt) => {
    run.current = sampleAccommodativeFacility(run.current, spatial());
    publishClock.current += dt; if (publishClock.current >= .1) { publishClock.current = 0; publish(); }
  });
  const reset = useCallback(() => {
    run.current = newAccommodativeFacilityRun(completionSent.current); lesson.reset(); runtime.resetClinic(); publish();
  }, [lesson.reset, publish, runtime.resetClinic]);
  useEffect(() => { if (!live) reset(); }, [live, reset]);

  const fitCorrection = () => {
    if (!live || isPatientFitted(runtime.toolsRef.current, "subjective")) return;
    const tool = runtime.toolsRef.current.subjective;
    runtime.updateTools({ ...runtime.toolsRef.current, subjective: { ...tool, placement: { kind: "socket", position: [0, 1.5, -.511], rotation: [0, 0, 0, 1], socketId: "sensory-correction", fittingLayer: "correction" }, revision: (tool.revision ?? 0) + 1 } });
  };
  const placeTarget = () => {
    if (!live) return;
    const socket = librarySockets("accommodative-facility").find(candidate => candidate.id === "practice-near-stand");
    if (!socket) return;
    const tool = runtime.toolsRef.current.near;
    runtime.updateTools({ ...runtime.toolsRef.current, near: { ...tool, placement: { kind: "socket", position: socket.position, rotation: socket.rotation, socketId: socket.id }, revision: (tool.revision ?? 0) + 1 } });
  };
  const prepareOcclusion = () => {
    if (!live) return;
    const eye = accommodativeFacilityEye(run.current), tool = runtime.toolsRef.current.cover;
    if (eye === "OU") {
      const definition = consultationToolDefinition("cover");
      const rest = { kind: "socket" as const, position: definition.home, rotation: definition.restRotation };
      runtime.updateTools({ ...runtime.toolsRef.current, cover: { ...tool, placement: rest, lastRest: rest, revision: (tool.revision ?? 0) + 1 } }); return;
    }
    const socket = librarySockets("accommodative-facility").find(candidate => candidate.id === `sensory-occlude-${eye === "OD" ? "OS" : "OD"}`);
    if (!socket) return;
    runtime.updateTools({ ...runtime.toolsRef.current, cover: { ...tool, placement: { kind: "socket", position: socket.position, rotation: socket.rotation, socketId: socket.id, fittingLayer: socket.fittingLayer }, revision: (tool.revision ?? 0) + 1 } });
  };
  const establish = () => { if (live) { run.current = establishFacilityFixation(run.current, spatial()); publish(); } };
  const start = () => { if (live) { run.current = startAccommodativeFacility(run.current, spatial()); publish(); } };
  const restart = () => { if (live) { run.current = restartAccommodativeFacilityEye(run.current); lesson.clearPending(); publish(); } };
  const cancel = () => { if (!lesson.awarded.current) { run.current = restartAccommodativeFacilityEye(run.current); lesson.clearPending(); publish(); } lesson.setMode("none"); };
  const record = () => {
    if (!live || lesson.awarded.current) return;
    const before = run.current, next = submitAccommodativeFacility(before, lesson.entriesRef.current.cycles ?? "");
    run.current = next;
    if (next.records.length === before.records.length) { lesson.submit(true, false, next.feedback); publish(); return; }
    lesson.clearPending(); lesson.setMode("none");
    if (next.phase === "complete") lesson.submit(true, true, "OD, OS, and OU accommodative facility recorded."); else lesson.progress(next.feedback);
    publish();
  };

  const sample = spatial(), eye = accommodativeFacilityEye(state.run), coach = accommodativeFacilityGuidedStep(state.run, sample);
  const entryReady = live && Boolean(state.run.capture);
  const fields: LessonField[] = [{ id: "cycles", label: "Full plus/minus pairs in 60 seconds", choices: [], number: { min: 0, max: 100, unit: " cpm", step: 1 } }];
  const setupActions: LessonAction[] = [
    { label: "FIT NEAR CORRECTION", active: sample.correctionFitted, run: fitCorrection },
    { label: "PLACE READABLE TARGET AT 40 CM", active: sample.targetReady, run: placeTarget },
    { label: eye === "OD" ? "COVER OS · TEST OD" : eye === "OS" ? "COVER OD · TEST OS" : "REMOVE COVER · TEST OU", active: sample.occlusionReady, run: prepareOcclusion },
  ];
  const procedureActions: LessonAction[] = [
    { voiceIds: ["fixate-target"], label: "ESTABLISH FIXATION", active: state.run.fixation, run: establish },
    { label: "START 60-SECOND RUN", disabled: Boolean(facilityGeometryIssue(sample)) || state.run.side !== "plus" || !state.run.fixation || state.run.phase === "running" || Boolean(state.run.capture), run: start },
    { label: "RESTART CURRENT RUN", run: restart },
  ];
  const desktopFlip: LessonAction = { label: "CLEAR / FLIP ±2 D", disabled: state.run.phase !== "running", run: flip };
  const actions: LessonAction[] = facilityUsesAccessibilityShortcuts(inputMode)
    ? [...setupActions, ...procedureActions.slice(0, 2), desktopFlip, procedureActions[2]]
    : procedureActions;
  const directActions = accommodativeFacilityBoardActions(state.run, inputMode).map(id => ({
    fixation: procedureActions[0], start: procedureActions[1], flip: desktopFlip,
  })[id]);
  const records = state.run.records.map(item => `${item.eye}: ${item.submittedCycles} full ±2.00 D pairs in 60 seconds`);
  const status = `${state.run.records.length}/3 eyes · ${eye} · ${state.seconds}s · ${state.run.cycles} cycles · ${state.run.side} · ${state.run.feedback}`;
  const report = state.run.phase === "running" && state.run.presentedMs !== null && !facilityGeometryIssue(sample)
    ? performance.now() - state.run.presentedMs >= facilityClearDelay[state.run.side] ? "It is clear now." : "It is still blurred."
    : undefined;
  usePracticeVoiceProcedure("accommodative-facility", active && !preview, { actions, voiceReport: report });
  useEffect(() => { onMirror?.({ title: LIBRARY_TITLES["accommodative-facility"], findingPosition: { current: Math.min(3, state.run.eyeIndex + 1), total: 3 }, status, ready: entryReady, entryReady, fields, actions, lesson, reset, record, cancel, reportLines: records, voiceReport: report });
  }, [onMirror, status, entryReady, state, lesson.mode, lesson.entries, lesson.recorded, lesson.feedback]);

  return <>
    <XRClinicRuntimeView cleanHands runtime={runtime} active={live} preview={preview} title="ACCOMMODATIVE FACILITY" showWallInstructions={false} instructionalEquipment={attemptKind === "guided" && coach.index === 4 ? ["lens-flipper"] : []} instrumentSettings={{ "lens-flipper": {
      side: state.run.side,
      onFlip: inputMode === "xr" && runtime.tools["lens-flipper"].placement.kind === "held" ? flip : undefined,
    } }} />
    {(live || preview) && <><LibraryEquipmentTray active={live} equipment={runtime.equipment} showFittingGuides={attemptKind === "guided"} /><LibraryNearStand /></>}
    {live && report && <XRSign text={["FICTIONAL PATIENT · CURRENT RESPONSE", report]} p={[.55, 1.75, -.10]} size={[.58, .20]} bg="#07151b" fg="#eefbf7" />}
    {(live || preview) && attemptKind === "guided" && <XRGuidedStepBubble stepId={String(coach.index)} title={coach.title} lines={coach.lines} />}
    <PracticeLessonUI runtime={runtime} active={live} title={LIBRARY_TITLES["accommodative-facility"]} status={status} tools={["lens-flipper"]} actions={actions} directActions={directActions} fields={fields} lesson={lesson} ready={entryReady} entryReady={entryReady} onRecord={record} onReset={reset} onExit={onExit} onCancel={cancel}
      boardFindingLines={[`EYE ${state.run.eyeIndex + 1} / 3 · ${eye}`, `${state.seconds} SECONDS · ${state.run.cycles} CYCLES`]} boardStatusLines={[`EYE ${state.run.eyeIndex + 1} / 3 · ${eye}`, state.run.capture ? "COUNT FROZEN · RECORD FULL PAIRS" : `${state.seconds} SECONDS · ${state.run.cycles} CYCLES`, attemptKind === "guided" ? coach.title : "Complete the physical sequence."]}
      help={["Fit correction and prepare OD, OS, then OU in order.", "Place the readable near target at 40 cm and align the ±2.00 D flipper.", "Establish fixation and start with plus.", "Flip only after each clear report; one plus/minus pair is one cycle.", "The count freezes at 60 seconds and remains available after releasing the flipper.", "Illustrative geometry and authored timing require clinician review."]} />
  </>;
}
