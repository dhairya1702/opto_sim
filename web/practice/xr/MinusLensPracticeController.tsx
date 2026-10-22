import { usePracticeVoiceProcedure } from "../../voice/usePracticeVoiceProcedure";
import { XRGuidedStepBubble } from "../../scene/XRGuidedStepBubble";
import { minusLensBoardActions } from "../../interaction/practiceBoardActions";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import {
  confirmMinusLensInitialClear, giveMinusLensInstruction, interruptMinusLens, minusLensDisclosure, minusLensEye,
  minusLensGuidedStep, minusLensPatientReport, newMinusLensRun, restartMinusLensEye, sampleMinusLens,
  stepMinusLensPower, submitMinusLensRecord, type MinusLensRun, type MinusLensSpatialSample,
} from "../../interaction/minusLensProcedure";
import {
  LIBRARY_SURFACES, LIBRARY_TITLES, libraryEquipment, libraryNear, libraryOcclusion, libraryOpticPlacement, librarySockets,
} from "../../interaction/xrLibraryEquipment";
import { isPatientFitted } from "../../interaction/xrSensoryEquipment";
import { consultationToolDefinition, toolInHand } from "../../interaction/xrConsultationTools";
import { useXRClinicRuntime, type ClinicInputMode } from "../../interaction/useXRClinicRuntime";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { LibraryEquipmentTray, LibraryNearStand } from "../../scene/LibraryClinicEquipment";
import { XRSign } from "../../scene/XRClinicPanels";
import { usePracticeAttempt } from "../PracticeAttemptContext";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonAction, type LessonField } from "./PracticeLessonUI";

export function MinusLensPracticeController({ active, preview = false, inputMode = "xr", onComplete, onExit, onMirror }: {
  active: boolean; preview?: boolean; inputMode?: ClinicInputMode; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const live = active && !preview;
  const { settings } = usePracticeAttempt();
  const attemptKind = settings?.kind ?? "guided";
  const disclosure = minusLensDisclosure(attemptKind);
  const completionSent = useRef(false);
  const lesson = usePracticeLesson(() => { if (!completionSent.current) { completionSent.current = true; onComplete(); } });
  const run = useRef<MinusLensRun>(newMinusLensRun());
  const dialDrag = useRef<{ hand: "left" | "right"; angle: number; remainderD: number } | null>(null);
  const publishClock = useRef(0);
  const temp = useMemo(() => new Vector3(), []);
  const [state, setState] = useState({ run: run.current });

  function spatial(nowMs = performance.now()): MinusLensSpatialSample {
    const tool = runtime.toolsRef.current["minus-lens-holder"];
    const lensHeld = tool.placement.kind === "held";
    const lensPose = runtime.supportedWorkingPose("minus-lens-holder", true);
    const targetPose = runtime.supportedWorkingPose("near", true);
    return { nowMs, correctionFitted: isPatientFitted(runtime.toolsRef.current, "subjective"),
      targetReady: libraryNear(targetPose), occlusionReady: libraryOcclusion(runtime.toolsRef.current, minusLensEye(run.current)),
      lensHeld, lensAligned: lensHeld && libraryOpticPlacement(lensPose, minusLensEye(run.current)),
      visible: Boolean(runtime.objects.current.get("minus-lens-holder")?.visible), tracking: runtime.frameValid.current };
  }

  const publish = useCallback(() => {
    const next = { run: run.current };
    setState(previous => previous.run === next.run ? previous : next);
  }, []);

  const applyStep = useCallback((direction: "add" | "remove", sample?: MinusLensSpatialSample) => {
    if (!live || lesson.awarded.current) return false;
    const before = run.current.powerD;
    run.current = stepMinusLensPower(run.current, direction, sample ?? spatial());
    const changed = run.current.powerD !== before;
    if (changed) lesson.clearPending();
    publish();
    return changed;
  }, [lesson.clearPending, live, publish]);

  const runtime = useXRClinicRuntime({ active: live, inputMode, equipment: libraryEquipment("minus-lens"), placementSockets: librarySockets("minus-lens"), placementSurfaces: LIBRARY_SURFACES,
    editorOpen: lesson.mode !== "none", onMenu: open => lesson.setMode(open ? "menu" : "none"),
    onInterrupt: reason => {
      if (["tracking", "visibility", "transfer", "procedure", "pickup", "release"].includes(reason)) {
        dialDrag.current = null;
        run.current = interruptMinusLens(run.current, "The physical procedure was interrupted.");
      }
    },
    onThumbstickStep: (id, step, _hand, axis) => {
      if (id !== "minus-lens-holder" || axis !== "vertical") return false;
      return applyStep(step > 0 ? "add" : "remove");
    },
  });

  useFrame((_, dt) => {
    const sample = spatial();
    const tool = runtime.toolsRef.current["minus-lens-holder"];
    const object = runtime.objects.current.get("minus-lens-holder");
    if (sample.lensHeld && object && run.current.initialClearConfirmed && !run.current.capture) {
      object.updateMatrixWorld(true);
      const free = runtime.slots.find(slot => slot.hand && slot.tracked && slot.triggerDown && !toolInHand(runtime.toolsRef.current, slot.hand));
      if (free?.hand) {
        free.grip.getWorldPosition(temp); object.worldToLocal(temp);
        const dx = temp.x - .065, dy = temp.y - .045;
        const close = Math.hypot(dx, dy) <= .070 && Math.abs(temp.z - .006) <= .09;
        if (close) {
          const angle = Math.atan2(dx, dy);
          if (!dialDrag.current || dialDrag.current.hand !== free.hand) {
            dialDrag.current = { hand: free.hand, angle, remainderD: 0 }; runtime.pulseHand(free.hand, .3, 35);
          } else {
            let delta = angle - dialDrag.current.angle;
            if (delta > Math.PI) delta -= Math.PI * 2;
            if (delta < -Math.PI) delta += Math.PI * 2;
            dialDrag.current.angle = angle;
            dialDrag.current.remainderD += -delta / (Math.PI * 1.5) * 4;
            let changed = false;
            while (dialDrag.current.remainderD >= .25) {
              changed = applyStep("add", { ...sample, nowMs: performance.now() }) || changed;
              dialDrag.current.remainderD -= .25;
            }
            while (dialDrag.current.remainderD <= -.25) {
              changed = applyStep("remove", { ...sample, nowMs: performance.now() }) || changed;
              dialDrag.current.remainderD += .25;
            }
            if (changed) runtime.pulseHand(free.hand, .18, 24);
          }
        } else dialDrag.current = null;
      } else dialDrag.current = null;
    } else dialDrag.current = null;

    run.current = sampleMinusLens(run.current, { ...sample, nowMs: performance.now() });
    publishClock.current += dt;
    if (publishClock.current >= .1) { publishClock.current = 0; publish(); }
  });

  const reset = useCallback(() => {
    run.current = newMinusLensRun(completionSent.current); dialDrag.current = null;
    lesson.reset(); runtime.resetClinic(); publish();
  }, [lesson.reset, publish, runtime.resetClinic]);
  useEffect(() => { if (!live) reset(); }, [live, reset]);

  const fitCorrection = () => {
    if (!live || isPatientFitted(runtime.toolsRef.current, "subjective")) return;
    const tool = runtime.toolsRef.current.subjective;
    runtime.updateTools({ ...runtime.toolsRef.current, subjective: { ...tool, placement: { kind: "socket", position: [0, 1.5, -.511], rotation: [0, 0, 0, 1], socketId: "sensory-correction", fittingLayer: "correction" }, revision: (tool.revision ?? 0) + 1 } });
  };
  const prepareOcclusion = () => {
    if (!live) return;
    const eye = minusLensEye(run.current), tool = runtime.toolsRef.current.cover;
    const socket = librarySockets("minus-lens").find(candidate => candidate.id === `sensory-occlude-${eye === "OD" ? "OS" : "OD"}`);
    if (!socket) return;
    runtime.updateTools({ ...runtime.toolsRef.current, cover: { ...tool, placement: { kind: "socket", position: socket.position, rotation: socket.rotation, socketId: socket.id, fittingLayer: socket.fittingLayer }, revision: (tool.revision ?? 0) + 1 } });
  };
  const instruct = () => { if (live) { run.current = giveMinusLensInstruction(run.current, spatial()); publish(); } };
  const confirmClear = () => { if (live) { run.current = confirmMinusLensInitialClear(run.current, spatial()); publish(); } };
  const restart = () => { if (live) { run.current = restartMinusLensEye(run.current); dialDrag.current = null; lesson.clearPending(); publish(); } };
  const cancel = () => { if (!lesson.awarded.current) { run.current = restartMinusLensEye(run.current); lesson.clearPending(); publish(); } lesson.setMode("none"); };
  const record = () => {
    if (!live || lesson.awarded.current) return;
    const before = run.current;
    const next = submitMinusLensRecord(before, lesson.entriesRef.current.power ?? "", lesson.entriesRef.current.amplitude ?? "");
    run.current = next;
    if (next.records.length === before.records.length) { lesson.submit(true, false, next.feedback); publish(); return; }
    lesson.clearPending(); lesson.setMode("none");
    if (next.phase === "complete") lesson.submit(true, true, "OD and OS minus-lens amplitudes recorded.");
    else lesson.progress(next.feedback);
    publish();
  };

  const fields: LessonField[] = [
    { id: "power", label: "Raw added-minus endpoint", choices: [], number: { min: -4, max: 0, step: .25, unit: " D" } },
    { id: "amplitude", label: "Minus added + 2.50", choices: [], number: { min: 0, max: 20, step: .25, unit: " D" } },
  ];
  const sample = spatial();
  const coach = minusLensGuidedStep(state.run, sample);
  const eye = minusLensEye(state.run);
  const entryReady = live && Boolean(state.run.capture);
  const actions: LessonAction[] = [
    { label: "FIT NEAR CORRECTION", active: sample.correctionFitted, run: fitCorrection },
    { label: eye === "OD" ? "COVER OS · TEST OD" : "COVER OD · TEST OS", active: sample.occlusionReady, run: prepareOcclusion },
    { voiceIds: ["fixate-target"], label: "GIVE FIRST SUSTAINED BLUR INSTRUCTION", active: state.run.instructionArmed, disabled: Boolean(minusLensGeometryBlock(sample)), run: instruct },
    { label: "CONFIRM LINE CLEAR AT 0.00 D", active: state.run.initialClearConfirmed, disabled: !state.run.instructionArmed || state.run.powerD !== 0 || Boolean(minusLensGeometryBlock(sample)), run: confirmClear },
    { voiceIds: ["request-report"], label: "PATIENT REPORT · WHAT DO YOU SEE?", disabled: !state.run.instructionArmed, run: publish },
    { label: "DIAL ADD −0.25 D · ACCESSIBILITY", disabled: !state.run.initialClearConfirmed || state.run.powerD <= -4 || Boolean(state.run.capture), run: () => applyStep("add") },
    { label: "DIAL REMOVE 0.25 D · ACCESSIBILITY", disabled: !state.run.initialClearConfirmed || state.run.powerD >= 0 || Boolean(state.run.capture), run: () => applyStep("remove") },
    { label: "RESTART CURRENT EYE", run: restart },
  ];
  const directActions = minusLensBoardActions(state.run).map(id => ({
    instruction: actions[2], initialClear: actions[3], report: actions[4], add: actions[5], remove: actions[6],
  })[id]);
  const records = state.run.records.map(item => `${item.eye}: ${item.submittedPowerD.toFixed(2)} D added · ${item.submittedAmplitudeD.toFixed(2)} D amplitude`);
  const status = `${state.run.records.length}/2 eyes · ${eye} · accessible scale ${state.run.powerD.toFixed(2)} D · ${attemptKind === "guided" ? state.run.phase.replaceAll("-", " ") : "procedure in progress"} · ${state.run.feedback}`;
  const voiceReport = minusLensPatientReport(state.run) || undefined;
  usePracticeVoiceProcedure("minus-lens", active && !preview, { actions, voiceReport: voiceReport });
  useEffect(() => { onMirror?.({ title: LIBRARY_TITLES["minus-lens"], findingPosition: { current: Math.min(2, state.run.eyeIndex + 1), total: 2 },
    status, ready: entryReady, entryReady, fields, actions, lesson, reset, record, cancel, reportLines: records, voiceReport });
  }, [onMirror, status, entryReady, state, lesson.mode, lesson.entries, lesson.recorded, lesson.feedback]);

  const highlighted = coach.index === 0 ? ["subjective" as const] : coach.index === 1 ? ["near" as const]
    : coach.index === 2 ? ["cover" as const] : coach.index === 3 ? ["minus-lens-holder" as const] : [];
  return <>
    <XRClinicRuntimeView cleanHands runtime={runtime} active={live} preview={preview} title="MINUS-LENS AMPLITUDE"
      instructionalEquipment={disclosure.showHighlights ? highlighted : []}
      instrumentSettings={{ near: { readableTarget: true }, "minus-lens-holder": { power: state.run.powerD,
        highlightAperture: disclosure.showHighlights && coach.index === 3, highlightDial: disclosure.showHighlights && coach.index === 6 } }} />
    {(live || preview) && <><LibraryEquipmentTray active={live} equipment={runtime.equipment} showFittingGuides={disclosure.showHighlights} /><LibraryNearStand /></>}
    {live && voiceReport && <XRSign text={["FICTIONAL PATIENT · CURRENT RESPONSE", voiceReport]} p={[.55, 1.75, -.10]} size={[.58, .20]} bg="#07151b" fg="#eefbf7" />}
    {(live || preview) && disclosure.showCoach && <XRGuidedStepBubble stepId={String(coach.index)} title={coach.title} lines={coach.lines} />}
    <PracticeLessonUI runtime={runtime} active={live} title={LIBRARY_TITLES["minus-lens"]} status={status} tools={["minus-lens-holder"]}
      actions={actions} directActions={directActions} fields={fields} lesson={lesson} entryReady={entryReady} ready={entryReady}
      onRecord={record} onReset={reset} onExit={onExit} onCancel={cancel}
      boardFindingLines={[`EYE ${state.run.eyeIndex + 1} / 2 · ${eye}`, `LENS SCALE ${state.run.powerD.toFixed(2)} D`]} boardStatusLines={[`EYE ${state.run.eyeIndex + 1} / 2 · ${eye}`, state.run.capture ? "ENDPOINT FROZEN · RECORD BOTH VALUES" : `LENS SCALE ${state.run.powerD.toFixed(2)} D`, attemptKind === "guided" ? coach.title : "Complete the physical sequence."]}
      help={attemptKind === "guided" ? ["Fit near correction, release the readable near target at 40 cm, and cover the opposite eye.", "Hold the monocular aperture over the tested eye and use the free controller beside its dial.", "Give the sustained-blur instruction and confirm the line is clear at 0.00 D.", "Turn the dial in 0.25 D steps. The fictional sustained response freezes automatically after the modeled delay.", "Independently enter the raw added-minus endpoint and the amplitude calculated as minus added + 2.50 D.", "Repeat for OS. Geometry, timing, and responses are illustrative drafts pending clinical and device review."]
        : ["Use the readable near target, monocular holder, modeled scale, and neutral patient reports.", "The physical geometry and response timing are illustrative drafts."]} />
  </>;
}

function minusLensGeometryBlock(sample: MinusLensSpatialSample) {
  return !sample.tracking || !sample.visible || !sample.correctionFitted || !sample.targetReady || !sample.occlusionReady || !sample.lensHeld || !sample.lensAligned;
}
