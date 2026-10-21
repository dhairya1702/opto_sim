import { XRGuidedStepBubble } from "../../scene/XRGuidedStepBubble";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import {
  NPC_RULE_MAX_CM, NPC_RULE_MIN_CM, cancelNPCRun, configureNPCRun, enterNPCRecord, interruptNPCRun,
  markNPCObjectiveEndpoint, newNPCRun, npcCaseOrder, npcDisclosure, npcEyeState, npcGuidedStep, npcPatientReport,
  npcRecordFieldIds, releaseNPCRule, restartNPCTrial, reviseNPCSetup, sampleNPC, submitNPCRecord, type NPCRun, type NPCSpatialSample,
} from "../../interaction/npcProcedure";
import { LIBRARY_SURFACES, libraryEquipment, librarySockets, LIBRARY_TITLES } from "../../interaction/xrLibraryEquipment";
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

export function NPCPracticeController({ active, preview = false, inputMode = "xr", onComplete, onExit, onMirror }: {
  active: boolean; preview?: boolean; inputMode?: ClinicInputMode; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const live = active && !preview;
  const { settings } = usePracticeAttempt();
  const attemptKind = settings?.kind ?? "guided";
  const order = useMemo(() => npcCaseOrder(attemptKind), [attemptKind]);
  const disclosure = npcDisclosure(attemptKind);
  const completionSent = useRef(false);
  const lesson = usePracticeLesson(() => { if (!completionSent.current) { completionSent.current = true; onComplete(); } });
  const eyes = useClinicEyeMotion(live);
  const caseIndex = useRef(0);
  const run = useRef<NPCRun>(newNPCRun(order[0]));
  const distance = useRef(40);
  const carriageHeld = useRef(false);
  const previousCorrection = useRef(false);
  const clock = useRef(0);
  const temp = useMemo(() => new Vector3(), []);
  const [state, setState] = useState({ distance: 40, run: run.current, history: [] as string[] });

  const runtime = useXRClinicRuntime({ active: live, inputMode, equipment: libraryEquipment("npc"), placementSockets: librarySockets("npc"), placementSurfaces: LIBRARY_SURFACES,
    onThumbstickStep: (id, step) => {
      if (id !== "npc-rule" || run.current.released) return false;
      const next = Math.round(Math.max(NPC_RULE_MIN_CM, Math.min(NPC_RULE_MAX_CM, distance.current + step * .5)) * 10) / 10;
      if (next === distance.current) return false;
      distance.current = next; run.current = sampleNPC(run.current, { ...spatial(), distanceCm: next }); publish(); return true;
    },
    editorOpen: lesson.mode !== "none", onMenu: open => lesson.setMode(open ? "menu" : "none"),
    onInterrupt: reason => {
      if (["tracking", "visibility", "transfer", "procedure", "pickup"].includes(reason) && run.current.phase !== "setup")
        run.current = interruptNPCRun(run.current, "The physical procedure was interrupted.");
    } });

  const spatial = (nowMs = performance.now()): NPCSpatialSample => {
    const tool = runtime.toolsRef.current["npc-rule"];
    const docked = tool.placement.kind === "socket" && tool.placement.socketId === "library-npc-spectacle";
    return { nowMs, distanceCm: distance.current, correctionFitted: isPatientFitted(runtime.toolsRef.current, "subjective"),
      ruleHeld: tool.placement.kind === "held", ruleDocked: docked, patientFacing: docked, upright: docked, midlineOffsetCm: docked ? 0 : 99,
      visible: Boolean(runtime.objects.current.get("npc-rule")?.visible), tracking: runtime.frameValid.current };
  };
  const publish = useCallback(() => {
    const next = { distance: distance.current, run: run.current, history: run.current.captures.map(capture => `Trial ${capture.trialNumber}: ${capture.break.actualCm.toFixed(1)} / ${capture.recovery.actualCm.toFixed(1)} cm · ${capture.break.method} · ${capture.break.breakingEye}`) };
    setState(previous => previous.distance === next.distance && previous.run === next.run ? previous : next);
  }, []);

  useFrame((_, dt) => {
    const sample = spatial();
    const tool = runtime.toolsRef.current["npc-rule"];
    if (previousCorrection.current && !sample.correctionFitted && run.current.captures.length < 3) {
      run.current = reviseNPCSetup(run.current, "Near correction was removed or changed."); lesson.clearPending();
    }
    previousCorrection.current = sample.correctionFitted;
    if (sample.correctionFitted && !run.current.correctionFitted) run.current = configureNPCRun(run.current, "fit-correction");
    if (sample.ruleHeld && !run.current.ruleHeld && !run.current.ruleDocked) run.current = configureNPCRun(run.current, "pickup-rule");
    if (sample.ruleDocked && !run.current.ruleDocked) run.current = configureNPCRun(run.current, "dock-rule");
    if (run.current.captures.length === 3 && !run.current.released && tool.placement.kind !== "held" && !sample.ruleDocked) run.current = releaseNPCRule(run.current);

    const object = runtime.objects.current.get("npc-rule");
    if (sample.ruleDocked && object && !run.current.released) {
      object.updateMatrixWorld(true);
      const free = runtime.slots.find(slot => slot.hand && slot.tracked && slot.triggerDown && !toolInHand(runtime.toolsRef.current, slot.hand));
      if (free) {
        free.grip.getWorldPosition(temp); object.worldToLocal(temp);
        const next = Math.round(Math.max(NPC_RULE_MIN_CM, Math.min(NPC_RULE_MAX_CM, temp.z * 100)) * 10) / 10;
        const close = Math.abs(temp.x) <= .08 && Math.abs(temp.y - .045) <= .10 && temp.z >= 0 && temp.z <= .46;
        if (close) {
          if (!carriageHeld.current) runtime.pulseHand(free.hand!, .3, 35);
          carriageHeld.current = true;
          if (Math.abs(next - distance.current) >= .1) { distance.current = next; run.current = sampleNPC(run.current, { ...sample, distanceCm: next }); }
        } else carriageHeld.current = false;
      } else carriageHeld.current = false;
    }
    run.current = sampleNPC(run.current, { ...sample, distanceCm: distance.current });
    const eyeState = npcEyeState(run.current, distance.current);
    eyes.forEach((eye, id) => {
      const target = clinicNearEyeOffset(id, eyeState.converging, eyeState.osDrifted);
      const blend = 1 - Math.exp(-Math.min(dt, .1) * 7);
      eye.position.x += (target - eye.position.x) * blend;
      eye.position.y *= 1 - blend;
    });
    clock.current += dt;
    if (clock.current >= .1) { clock.current = 0; publish(); }
  });

  const reset = useCallback(() => {
    run.current = newNPCRun(order[caseIndex.current], completionSent.current); distance.current = 40;
    previousCorrection.current = false;
    lesson.reset(); runtime.resetClinic(); eyes.forEach(eye => eye.position.set(0, 0, 0)); publish();
  }, [eyes, lesson.reset, order, publish, runtime.resetClinic]);
  useEffect(() => { if (!live) reset(); }, [live, reset]);

  const instruct = () => { if (!live) return; run.current = configureNPCRun(run.current, "give-instruction"); run.current = sampleNPC(run.current, spatial()); publish(); };
  const mark = () => { if (!live) return; const sample = spatial(); run.current = sampleNPC(run.current, sample); run.current = markNPCObjectiveEndpoint(run.current, sample); publish(); };
  const restart = () => { run.current = restartNPCTrial(run.current); distance.current = 40; lesson.clearPending(); publish(); };
  const cancel = () => { run.current = cancelNPCRun(run.current); distance.current = 40; lesson.clearPending(); lesson.setMode("none"); publish(); };
  const removeRule = () => {
    if (run.current.captures.length !== 3) return;
    const current = runtime.toolsRef.current["npc-rule"], definition = consultationToolDefinition("npc-rule");
    const rest = { kind: "socket" as const, position: definition.home, rotation: definition.restRotation };
    runtime.updateTools({ ...runtime.toolsRef.current, "npc-rule": { ...current, placement: rest, lastRest: rest, revision: (current.revision ?? 0) + 1 } });
    run.current = releaseNPCRule(run.current); publish();
  };
  const record = () => {
    let next = run.current;
    npcRecordFieldIds.forEach(id => { next = enterNPCRecord(next, id, lesson.entriesRef.current[id] ?? ""); });
    next = submitNPCRecord(next); run.current = next;
    if (!next.record) { lesson.submit(true, false, next.feedback); publish(); return; }
    lesson.submit(true, true, "Three-trial NPC finding recorded. No diagnosis was assigned."); publish();
  };
  const next = () => { caseIndex.current = (caseIndex.current + 1) % order.length; run.current = newNPCRun(order[caseIndex.current], true); distance.current = 40; lesson.reset(); runtime.resetClinic(); publish(); };

  const fields: LessonField[] = [
    ...npcRecordFieldIds.slice(0, 6).map((id, index) => ({ id, label: `Trial ${Math.floor(index / 2) + 1} ${index % 2 ? "recovery" : "break"}`, choices: [], number: { min: 2, max: 42, step: .1, unit: " cm" } })),
    { id: "detection-method", label: "Detection method", choices: [["patient-report", "Patient report"], ["objective-observation", "Objective observation"]] },
    { id: "breaking-eye", label: "Breaking eye", choices: [["OD", "OD"], ["OS", "OS"]] },
  ];
  const coach = npcGuidedStep(state.run, spatial());
  const entryReady = live && state.run.released && state.run.captures.length === 3;
  const actions: LessonAction[] = [
    { label: "FIT NEAR CORRECTION", active: state.run.correctionFitted, run: () => {
      const tool = runtime.toolsRef.current.subjective;
      if (!isPatientFitted(runtime.toolsRef.current, "subjective")) runtime.updateTools({ ...runtime.toolsRef.current, subjective: { ...tool, placement: { kind: "socket", position: [0, 1.5, -.511], rotation: [0, 0, 0, 1], socketId: "sensory-correction", fittingLayer: "correction" }, revision: (tool.revision ?? 0) + 1 } });
    } },
    { label: "GIVE CLEAR / SINGLE INSTRUCTION", active: state.run.instructionArmed, disabled: !state.run.ruleDocked, run: instruct },
    { label: "PATIENT REPORT · WHAT DO YOU SEE?", run: () => publish() },
    { label: "MARK OBSERVED ENDPOINT", disabled: state.run.phase !== "approach" && state.run.phase !== "recovery", run: mark },
    { label: "RESTART CURRENT TRIAL", run: restart },
    ...(state.run.captures.length === 3 && !state.run.released ? [{ label: "REMOVE / RELEASE RULE", run: removeRule }] : []),
  ];
  const neutralPhase = attemptKind === "guided" ? state.run.phase.replaceAll("-", " ") : "procedure in progress";
  const xrStatus = `${state.run.captures.length}/3 trials · ${neutralPhase} · ${state.run.feedback}`;
  const status = `${state.run.captures.length}/3 trials · accessible carriage reading ${state.distance.toFixed(1)} cm from spectacle plane · ${neutralPhase} · ${state.run.feedback}`;
  const voiceReport = npcPatientReport(state.run, state.distance);
  useEffect(() => { onMirror?.({ title: LIBRARY_TITLES.npc, findingPosition: { current: caseIndex.current + 1, total: 2 }, status, ready: entryReady,
    entryReady, fields, actions, lesson, reset, record, next: state.run.record ? next : undefined, cancel, reportLines: state.history, voiceReport });
  }, [onMirror, status, entryReady, state, lesson.mode, lesson.entries, lesson.recorded, lesson.feedback]);

  return <>
    <XRClinicRuntimeView cleanHands runtime={runtime} active={live} preview={preview} title="NEAR POINT OF CONVERGENCE"
      instrumentSettings={{ "npc-rule": { distanceCm: state.distance, highlightCarriage: disclosure.showHighlights && coach.index >= 3 && coach.index <= 8 } }} />
    {(live || preview) && <LibraryEquipmentTray active={live} equipment={runtime.equipment} showFittingGuides={disclosure.showHighlights} />}
    {live && <XRSign text={["FICTIONAL PATIENT · CURRENT RESPONSE", voiceReport]} p={[.55, 1.75, -.10]} size={[.55, .20]} bg="#07151b" fg="#eefbf7" />}
    {live && disclosure.showCoach && <XRGuidedStepBubble stepId={String(coach.index)} title={coach.title} lines={coach.lines} />}
    <PracticeLessonUI runtime={runtime} active={live} title={LIBRARY_TITLES.npc} status={xrStatus} tools={["npc-rule"]} actions={actions}
      directActions={actions.filter(action => action.label.includes("INSTRUCTION") || action.label.includes("MARK") || action.label.includes("RELEASED"))}
      fields={fields} lesson={lesson} entryReady={entryReady} ready={entryReady} onRecord={record} onReset={reset} onNext={state.run.record ? next : undefined} onExit={onExit} onCancel={cancel}
      boardFindingLines={[`TRIALS ${state.run.captures.length} / 3`]} boardStatusLines={[`TRIALS ${state.run.captures.length} / 3`, "READ THE MODELED CENTIMETRE SCALE", attemptKind === "guided" ? coach.title : "Complete the required sequence."]}
      help={attemptKind === "guided" ? ["Fit correction, pick up the dedicated rule and dock its patient end at the spectacle plane.", "Use the free controller trigger beside the carriage to slide the target while the rule remains docked.", "Begin at 38–42 cm; hold 250 ms, move inward, capture break, then move outward to recovery.", "Repeat three times, release the rule, and enter all values independently.", "Geometry, eye motion, ergonomics and readability are draft assumptions."] : ["Use the modeled centimetre scale and neutral controller prompts.", "The physical geometry and eye movement are illustrative drafts."]} />
  </>;
}
