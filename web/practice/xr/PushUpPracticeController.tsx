import { pushUpBoardActions } from "../../interaction/practiceBoardActions";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import {
  PUSH_UP_MAX_CM, PUSH_UP_MIN_CM, givePushUpInstruction, interruptPushUp, newPushUpRun, pushUpDisclosure,
  pushUpEye, pushUpGuidedStep, restartPushUpEye, samplePushUp, submitPushUpRecord,
  type PushUpRun, type PushUpSpatialSample,
} from "../../interaction/pushUpProcedure";
import { LIBRARY_SURFACES, LIBRARY_TITLES, libraryEquipment, libraryOcclusion, librarySockets } from "../../interaction/xrLibraryEquipment";
import { isPatientFitted } from "../../interaction/xrSensoryEquipment";
import { consultationToolDefinition, toolInHand } from "../../interaction/xrConsultationTools";
import { useXRClinicRuntime, type ClinicInputMode } from "../../interaction/useXRClinicRuntime";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { LibraryEquipmentTray } from "../../scene/LibraryClinicEquipment";
import { XRSign } from "../../scene/XRClinicPanels";
import { usePracticeAttempt } from "../PracticeAttemptContext";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonAction, type LessonField } from "./PracticeLessonUI";
import { useClinicEyeMotion } from "./useClinicEyeMotion";
import { clinicNearEyeOffset } from "../../interaction/clinicNearEyeMotion";

export function PushUpPracticeController({ active, preview = false, inputMode = "xr", onComplete, onExit, onMirror }: {
  active: boolean; preview?: boolean; inputMode?: ClinicInputMode; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const live = active && !preview;
  const { settings } = usePracticeAttempt();
  const attemptKind = settings?.kind ?? "guided";
  const disclosure = pushUpDisclosure(attemptKind);
  const completionSent = useRef(false);
  const lesson = usePracticeLesson(() => { if (!completionSent.current) { completionSent.current = true; onComplete(); } });
  const run = useRef<PushUpRun>(newPushUpRun());
  const distance = useRef(40);
  const carriageHeld = useRef(false);
  const clock = useRef(0);
  const temp = useMemo(() => new Vector3(), []);
  const eyes = useClinicEyeMotion(live);
  const [state, setState] = useState({ run: run.current, distance: 40 });

  const runtime = useXRClinicRuntime({ active: live, inputMode, equipment: libraryEquipment("push-up"), placementSockets: librarySockets("push-up"), placementSurfaces: LIBRARY_SURFACES,
    editorOpen: lesson.mode !== "none", onMenu: open => lesson.setMode(open ? "menu" : "none"),
    onInterrupt: reason => {
      if (["tracking", "visibility", "transfer", "procedure", "pickup"].includes(reason))
        run.current = interruptPushUp(run.current, "The physical procedure was interrupted.");
    }, onThumbstickStep: (id, step) => {
      if (id !== "push-up-rule" || run.current.capture || run.current.phase === "complete") return false;
      const next = Math.round(Math.max(PUSH_UP_MIN_CM, Math.min(PUSH_UP_MAX_CM, distance.current + step)) * 10) / 10;
      if (next === distance.current) return false;
      distance.current = next; setState({ run: run.current, distance: next }); return true;
    } });

  const spatial = (nowMs = performance.now()): PushUpSpatialSample => {
    const tool = runtime.toolsRef.current["push-up-rule"];
    const docked = tool.placement.kind === "socket" && tool.placement.socketId === "library-push-up-spectacle";
    return { nowMs, distanceCm: distance.current, correctionFitted: isPatientFitted(runtime.toolsRef.current, "subjective"),
      occlusionReady: libraryOcclusion(runtime.toolsRef.current, pushUpEye(run.current)), ruleDocked: docked,
      patientFacing: docked, upright: docked, midlineOffsetCm: docked ? 0 : 99,
      visible: Boolean(runtime.objects.current.get("push-up-rule")?.visible), tracking: runtime.frameValid.current };
  };
  const publish = useCallback(() => {
    const next = { run: run.current, distance: distance.current };
    setState(previous => previous.run === next.run && previous.distance === next.distance ? previous : next);
  }, []);

  useFrame((_, dt) => {
    const sample = spatial();
    const tool = runtime.toolsRef.current["push-up-rule"];
    const object = runtime.objects.current.get("push-up-rule");
    if (sample.ruleDocked && object && !run.current.capture && run.current.phase !== "complete") {
      object.updateMatrixWorld(true);
      const free = runtime.slots.find(slot => slot.hand && slot.tracked && slot.triggerDown && !toolInHand(runtime.toolsRef.current, slot.hand));
      if (free) {
        free.grip.getWorldPosition(temp); object.worldToLocal(temp);
        const next = Math.round(Math.max(PUSH_UP_MIN_CM, Math.min(PUSH_UP_MAX_CM, temp.z * 100)) * 10) / 10;
        const close = Math.abs(temp.x) <= .09 && Math.abs(temp.y - .045) <= .11 && temp.z >= 0 && temp.z <= .46;
        if (close) {
          if (!carriageHeld.current) runtime.pulseHand(free.hand!, .3, 35);
          carriageHeld.current = true;
          if (Math.abs(next - distance.current) >= .1) distance.current = next;
        } else carriageHeld.current = false;
      } else carriageHeld.current = false;
    }
    run.current = samplePushUp(run.current, { ...sample, distanceCm: distance.current });
    const convergence = pushUpEye(run.current) === "OU" && run.current.instructionArmed
      ? Math.max(0, Math.min(1, (40 - distance.current) / 35)) : 0;
    eyes.forEach((eye, id) => {
      const target = clinicNearEyeOffset(id, convergence);
      const blend = 1 - Math.exp(-Math.min(dt, .1) * 7);
      eye.position.x += (target - eye.position.x) * blend;
      eye.position.y *= 1 - blend;
    });
    clock.current += dt;
    if (clock.current >= .1) { clock.current = 0; publish(); }
  });

  const reset = useCallback(() => {
    run.current = newPushUpRun(completionSent.current); distance.current = 40; carriageHeld.current = false;
    lesson.reset(); runtime.resetClinic(); eyes.forEach(eye => eye.position.set(0, 0, 0)); publish();
  }, [eyes, lesson.reset, publish, runtime.resetClinic]);
  useEffect(() => { if (!live) reset(); }, [live, reset]);

  const fitCorrection = () => {
    if (!live || isPatientFitted(runtime.toolsRef.current, "subjective")) return;
    const tool = runtime.toolsRef.current.subjective;
    runtime.updateTools({ ...runtime.toolsRef.current, subjective: { ...tool, placement: { kind: "socket", position: [0, 1.5, -.511], rotation: [0, 0, 0, 1], socketId: "sensory-correction", fittingLayer: "correction" }, revision: (tool.revision ?? 0) + 1 } });
  };
  const prepareOcclusion = () => {
    if (!live) return;
    const eye = pushUpEye(run.current), tool = runtime.toolsRef.current.cover;
    if (eye === "OU") {
      const definition = consultationToolDefinition("cover");
      const rest = { kind: "socket" as const, position: definition.home, rotation: definition.restRotation };
      runtime.updateTools({ ...runtime.toolsRef.current, cover: { ...tool, placement: rest, lastRest: rest, revision: (tool.revision ?? 0) + 1 } });
      return;
    }
    const socket = librarySockets("push-up").find(candidate => candidate.id === `sensory-occlude-${eye === "OD" ? "OS" : "OD"}`);
    if (!socket) return;
    runtime.updateTools({ ...runtime.toolsRef.current, cover: { ...tool, placement: { kind: "socket", position: socket.position, rotation: socket.rotation, socketId: socket.id, fittingLayer: socket.fittingLayer }, revision: (tool.revision ?? 0) + 1 } });
  };
  const instruct = () => { if (live) { run.current = givePushUpInstruction(run.current); publish(); } };
  const restart = () => { if (live) { run.current = restartPushUpEye(run.current); distance.current = 40; lesson.clearPending(); publish(); } };
  const cancel = () => { if (!lesson.awarded.current) { run.current = restartPushUpEye(run.current); lesson.clearPending(); publish(); } lesson.setMode("none"); };
  const record = () => {
    if (!live || lesson.awarded.current) return;
    const before = run.current;
    const next = submitPushUpRecord(before, lesson.entriesRef.current.distance ?? "", lesson.entriesRef.current.amplitude ?? "");
    run.current = next;
    if (next.records.length === before.records.length) { lesson.submit(true, false, next.feedback); publish(); return; }
    lesson.clearPending(); lesson.setMode("none");
    if (next.phase === "complete") lesson.submit(true, true, "OD, OS, and OU Push-up amplitudes recorded.");
    else lesson.progress(next.feedback);
    publish();
  };

  const fields: LessonField[] = [
    { id: "distance", label: "Sustained-blur distance", choices: [], number: { min: 2, max: 42, step: .1, unit: " cm" } },
    { id: "amplitude", label: "100 ÷ distance", choices: [], number: { min: 0, max: 50, step: .01, unit: " D" } },
  ];
  const sample = spatial();
  const coach = pushUpGuidedStep(state.run, sample);
  const eye = pushUpEye(state.run);
  const entryReady = live && Boolean(state.run.capture);
  const actions: LessonAction[] = [
    { label: "FIT NEAR CORRECTION", active: sample.correctionFitted, run: fitCorrection },
    { label: eye === "OD" ? "COVER OS · TEST OD" : eye === "OS" ? "COVER OD · TEST OS" : "REMOVE COVER · TEST OU", active: sample.occlusionReady, run: prepareOcclusion },
    { label: "GIVE FIRST SUSTAINED BLUR INSTRUCTION", active: state.run.instructionArmed, disabled: !sample.ruleDocked, run: instruct },
    { label: "PATIENT REPORT · WHAT DO YOU SEE?", disabled: !state.run.instructionArmed, run: publish },
    { label: "RESTART CURRENT EYE", run: restart },
  ];
  const directActions = pushUpBoardActions(state.run).map(id => ({ instruction: actions[2], report: actions[3] })[id]);
  const records = state.run.records.map(record => `${record.eye}: ${record.submittedDistanceCm.toFixed(1)} cm · ${record.submittedAmplitudeD.toFixed(2)} D`);
  const xrStatus = `${state.run.records.length}/3 eyes · ${eye} · ${state.run.phase.replaceAll("-", " ")} · ${state.run.feedback}`;
  const accessibleStatus = `${state.run.records.length}/3 eyes · ${eye} · accessible ruler reading ${state.distance.toFixed(1)} cm · ${state.run.feedback}`;
  const voiceReport = state.run.instructionArmed ? state.run.report || "The letters are clear." : undefined;
  useEffect(() => { onMirror?.({ title: LIBRARY_TITLES["push-up"], findingPosition: { current: Math.min(3, state.run.eyeIndex + 1), total: 3 },
    status: accessibleStatus, ready: entryReady, entryReady, fields, actions, lesson, reset, record, cancel, reportLines: records, voiceReport });
  }, [onMirror, accessibleStatus, entryReady, state, lesson.mode, lesson.entries, lesson.recorded, lesson.feedback]);

  const highlighted = coach.index === 0 ? ["subjective" as const] : coach.index === 1 ? ["cover" as const] : coach.index === 2 ? ["push-up-rule" as const] : [];
  return <>
    <XRClinicRuntimeView cleanHands runtime={runtime} active={live} preview={preview} title="PUSH-UP AMPLITUDE"
      instructionalEquipment={disclosure.showHighlights ? highlighted : []}
      instrumentSettings={{ "push-up-rule": { distanceCm: state.distance, highlightCarriage: disclosure.showHighlights && coach.index >= 4 && coach.index <= 5,
        highlightStart: disclosure.showHighlights && coach.index === 4 } }} />
    {(live || preview) && <LibraryEquipmentTray active={live} equipment={runtime.equipment} showFittingGuides={disclosure.showHighlights} />}
    {live && voiceReport && <XRSign text={["FICTIONAL PATIENT · CURRENT RESPONSE", voiceReport]} p={[.55, 1.75, -.10]} size={[.58, .20]} bg="#07151b" fg="#eefbf7" />}
    {live && disclosure.showCoach && <XRSign text={[`GUIDED STEP ${coach.index + 1} / 7 · ${coach.title}`, ...coach.lines]} p={[-.58, 1.74, -.08]} size={[.62, .22]} bg="#102329" fg="#eefbf7" />}
    <PracticeLessonUI runtime={runtime} active={live} title={LIBRARY_TITLES["push-up"]} status={xrStatus} tools={["push-up-rule"]} actions={actions}
      directActions={directActions} fields={fields} lesson={lesson} entryReady={entryReady} ready={entryReady} onRecord={record} onReset={reset} onExit={onExit} onCancel={cancel}
      boardStatusLines={[`EYE ${state.run.eyeIndex + 1} / 3 · ${eye}`, state.run.capture ? "ENDPOINT FROZEN · READ THE MODELED SCALE" : attemptKind === "guided" ? coach.title : "Complete the physical sequence."]}
      help={attemptKind === "guided" ? ["Fit near correction and prepare the displayed eye's occlusion.", "Dock the ruler's patient end at the spectacle plane.", "Use the free controller trigger beside the carriage to slide the letter card.", "Begin within 38–42 cm, then move inward until sustained blur is reported and frozen.", "Read the modeled scale and independently enter distance and 100 ÷ distance.", "The geometry, timing and eye motion are illustrative drafts pending clinical and device review."]
        : ["Use the modeled centimetre scale and neutral patient reports.", "The physical geometry and eye movement are illustrative drafts."]} />
  </>;
}
