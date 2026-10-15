import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Quaternion, Vector3 } from "three";
import {
  NEAR_FUSIONAL_CASE, cancelNearFusionalRun, configureNearFusionalRun, enterNearFusionalRecord, interruptNearFusionalRun,
  nearFusionalBaseFromRoll, nearFusionalDisclosure, nearFusionalEyeState, nearFusionalGuidedStep,
  nearFusionalPatientReport, nearFusionalRecordFieldIds, newNearFusionalRun, releaseNearFusionalPrism,
  reviseNearFusionalSetup, sampleNearFusionalRun, submitNearFusionalRecord,
  type NearFusionalRun, type NearFusionalSpatialSample,
} from "../../interaction/nearFusionalVergenceProcedure";
import {
  LIBRARY_SURFACES, LIBRARY_TITLES, libraryDistance, libraryEquipment, libraryNear, libraryOpticPlacement,
  librarySockets,
} from "../../interaction/xrLibraryEquipment";
import { isPatientFitted } from "../../interaction/xrSensoryEquipment";
import { consultationToolDefinition, toolInHand } from "../../interaction/xrConsultationTools";
import { useXRClinicRuntime } from "../../interaction/useXRClinicRuntime";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { LibraryEquipmentTray, LibraryNearStand } from "../../scene/LibraryClinicEquipment";
import { XRSign } from "../../scene/XRClinicPanels";
import { usePracticeAttempt } from "../PracticeAttemptContext";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonAction, type LessonField } from "./PracticeLessonUI";
import { useClinicEyeMotion } from "./useClinicEyeMotion";

const fieldLabels: Record<(typeof nearFusionalRecordFieldIds)[number], string> = {
  "bi-blur": "BI blur", "bi-break": "BI break", "bi-recovery": "BI recovery",
  "bo-blur": "BO blur", "bo-break": "BO break", "bo-recovery": "BO recovery",
};

export function NearFusionalVergencePracticeController({ active, preview = false, onComplete, onExit, onMirror }: {
  active: boolean; preview?: boolean; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const live = active && !preview;
  const { settings } = usePracticeAttempt();
  const attemptKind = settings?.kind ?? "guided";
  const disclosure = nearFusionalDisclosure(attemptKind);
  const completionSent = useRef(false);
  const lesson = usePracticeLesson(() => { if (!completionSent.current) { completionSent.current = true; onComplete(); } });
  const eyes = useClinicEyeMotion(live);
  const run = useRef<NearFusionalRun>(newNearFusionalRun());
  const power = useRef(0);
  const previousCorrection = useRef(false);
  const previousCorrectionRevision = useRef(0);
  const previousTargetSignature = useRef("");
  const previousHeld = useRef(false);
  const dialDrag = useRef<{ hand: "left" | "right"; angle: number } | null>(null);
  const lastHapticInteger = useRef(0);
  const clock = useRef(0);
  const temp = useMemo(() => new Vector3(), []);
  const up = useMemo(() => new Vector3(), []);
  const quaternion = useMemo(() => new Quaternion(), []);
  const [state, setState] = useState({ run: run.current, power: 0, base: null as "BI" | "BO" | null,
    targetDistanceCm: 0, history: [] as string[] });

  const changePower = useCallback((step: number) => {
    if (!live || run.current.released || run.current.record) return false;
    power.current = Math.round(Math.max(0, Math.min(30, power.current + step)) * 10) / 10;
    return true;
  }, [live]);

  const runtime = useXRClinicRuntime({ active: live, equipment: libraryEquipment("horizontal-near"), placementSockets: librarySockets("horizontal-near"),
    placementSurfaces: LIBRARY_SURFACES, editorOpen: lesson.mode !== "none", onMenu: open => lesson.setMode(open ? "menu" : "none"),
    onInterrupt: reason => {
      dialDrag.current = null;
      if (["tracking", "visibility", "transfer", "procedure", "release"].includes(reason))
        run.current = interruptNearFusionalRun(run.current, "The physical procedure was interrupted.");
    },
    onThumbstickStep: (id, step, _hand, axis) => {
      if (id !== "vergence-prism" || axis !== "vertical") return false;
      const integer = Math.floor(power.current + 1e-8);
      return changePower(step * .1) && Math.floor(power.current + 1e-8) !== integer;
    },
  });

  const targetState = () => {
    const pose = runtime.supportedWorkingPose("near", true);
    const distance = libraryDistance(pose);
    const targetTool = runtime.toolsRef.current.near;
    const supported = targetTool.placement.kind === "socket" && targetTool.placement.socketId === "practice-near-stand";
    const ready = supported && libraryNear(pose);
    const revision = targetTool.revision ?? 0;
    const poseKey = pose ? [...pose.position, ...pose.forward].map(value => Math.round(value * 1000) / 1000).join(":") : "missing";
    const signature = `${revision}:${ready}:${Math.round(distance.distanceCm * 10) / 10}:${poseKey}`;
    return { ready, distanceCm: distance.distanceCm, signature };
  };

  const spatial = (nowMs = performance.now()): NearFusionalSpatialSample => {
    const tool = runtime.toolsRef.current["vergence-prism"];
    const held = tool.placement.kind === "held";
    const object = runtime.objects.current.get("vergence-prism");
    const pose = runtime.supportedWorkingPose("vergence-prism", true);
    const target = targetState();
    let base: "BI" | "BO" | null = null;
    if (object && held) {
      object.getWorldQuaternion(quaternion);
      up.set(0, 1, 0).applyQuaternion(quaternion);
      base = nearFusionalBaseFromRoll(Math.atan2(-up.x, up.y));
    }
    return { nowMs, power: power.current, base, correctionFitted: isPatientFitted(runtime.toolsRef.current, "subjective"),
      targetEstablished: target.ready, targetDistanceCm: target.distanceCm, prismHeld: held,
      alignedOD: held && libraryOpticPlacement(pose, "OD"), patientFacing: Boolean(pose && pose.forward[2] < -Math.cos(Math.PI / 6)),
      tiltValid: base !== null, visible: Boolean(object?.visible), tracking: runtime.frameValid.current };
  };

  const publish = useCallback((sample = spatial()) => {
    const history = (["BI", "BO"] as const).flatMap(base => {
      const capture = run.current.captures[base];
      return capture ? [`${base}: ${capture.blur.actualDelta} / ${capture.break.actualDelta} / ${capture.recovery.actualDelta}Δ · ${capture.targetDistanceCm.toFixed(1)} cm`] : [];
    });
    const next = { run: run.current, power: power.current, base: sample.base, targetDistanceCm: sample.targetDistanceCm, history };
    setState(previous => previous.run === next.run && previous.power === next.power && previous.base === next.base
      && previous.targetDistanceCm === next.targetDistanceCm ? previous : next);
  }, []);

  useFrame((_, dt) => {
    const target = targetState();
    const sample = spatial();
    const correctionRevision = runtime.toolsRef.current.subjective.revision ?? 0;
    if (run.current.correctionFitted && previousCorrection.current && correctionRevision !== previousCorrectionRevision.current && !run.current.record) {
      run.current = reviseNearFusionalSetup(run.current, "Near correction was changed.", sample.correctionFitted, target.ready); lesson.clearPending();
    } else if (previousCorrection.current && !sample.correctionFitted && !run.current.record) {
      run.current = reviseNearFusionalSetup(run.current, "Near correction was removed.", false, target.ready); lesson.clearPending();
    }
    previousCorrection.current = sample.correctionFitted;
    previousCorrectionRevision.current = correctionRevision;
    if (sample.correctionFitted && !run.current.correctionFitted) run.current = configureNearFusionalRun(run.current, "fit-correction");

    if (!previousTargetSignature.current) previousTargetSignature.current = target.signature;
    else if (run.current.targetEstablished && target.signature !== previousTargetSignature.current && !run.current.record) {
      run.current = reviseNearFusionalSetup(run.current, "The near target position or orientation changed.", sample.correctionFitted, false);
      lesson.clearPending();
    }
    previousTargetSignature.current = target.signature;

    if (sample.prismHeld && !previousHeld.current) run.current = configureNearFusionalRun(run.current, "pickup-prism");
    if (!sample.prismHeld && previousHeld.current) {
      dialDrag.current = null;
      if (run.current.captures.BI && run.current.captures.BO) run.current = releaseNearFusionalPrism(run.current);
      else run.current = interruptNearFusionalRun(run.current, "The prism was released before the run was complete.");
    }
    previousHeld.current = sample.prismHeld;

    const object = runtime.objects.current.get("vergence-prism");
    if (sample.prismHeld && object && !run.current.released) {
      object.updateMatrixWorld(true);
      const free = runtime.slots.find(slot => slot.hand && slot.tracked && slot.triggerDown && !toolInHand(runtime.toolsRef.current, slot.hand));
      if (free?.hand) {
        free.grip.getWorldPosition(temp); object.worldToLocal(temp);
        const dx = temp.x - .065, dy = temp.y - .055;
        const close = Math.hypot(dx, dy) <= .075 && Math.abs(temp.z - .006) <= .09;
        if (close) {
          const angle = Math.atan2(dx, dy);
          if (!dialDrag.current || dialDrag.current.hand !== free.hand) {
            dialDrag.current = { hand: free.hand, angle }; runtime.pulseHand(free.hand, .3, 35);
          } else {
            let delta = angle - dialDrag.current.angle;
            if (delta > Math.PI) delta -= Math.PI * 2;
            if (delta < -Math.PI) delta += Math.PI * 2;
            const before = power.current;
            if (Math.abs(delta) > .002) {
              changePower(delta / (Math.PI * 1.5) * 30); dialDrag.current.angle = angle;
              const integer = Math.floor(power.current + 1e-8);
              if (integer !== lastHapticInteger.current) { lastHapticInteger.current = integer; runtime.pulseHand(free.hand, .18, 24); }
              if (power.current !== before) run.current = sampleNearFusionalRun(run.current, { ...sample, power: power.current });
            }
          }
        } else dialDrag.current = null;
      } else dialDrag.current = null;
    } else dialDrag.current = null;

    run.current = sampleNearFusionalRun(run.current, { ...sample, power: power.current });
    const eyeState = nearFusionalEyeState(run.current, power.current);
    eyes.forEach((eye, id) => {
      const targetX = (id === "OD" ? eyeState.OD : eyeState.OS) * .012 / .035;
      const blend = 1 - Math.exp(-Math.min(dt, .1) * 7);
      eye.position.x += (targetX - eye.position.x) * blend; eye.position.y *= 1 - blend;
    });
    clock.current += dt;
    if (clock.current >= .1) { clock.current = 0; publish(sample); }
  });

  const reset = useCallback(() => {
    run.current = newNearFusionalRun(completionSent.current); power.current = 0; previousCorrection.current = false;
    previousCorrectionRevision.current = 0; previousTargetSignature.current = ""; previousHeld.current = false;
    dialDrag.current = null; lastHapticInteger.current = 0; lesson.reset(); runtime.resetClinic();
    eyes.forEach(eye => eye.position.set(0, 0, 0)); publish();
  }, [eyes, lesson.reset, publish, runtime.resetClinic]);
  useEffect(() => { if (!live) reset(); }, [live, reset]);

  const fitCorrection = () => {
    if (!live) return;
    const tool = runtime.toolsRef.current.subjective;
    if (!isPatientFitted(runtime.toolsRef.current, "subjective")) runtime.updateTools({ ...runtime.toolsRef.current, subjective: { ...tool,
      placement: { kind: "socket", position: [0, 1.5, -.511], rotation: [0, 0, 0, 1], socketId: "sensory-correction", fittingLayer: "correction" },
      revision: (tool.revision ?? 0) + 1 } });
  };
  const establishTarget = () => {
    const target = targetState();
    if (!live || !target.ready || run.current.targetEstablished) return;
    run.current = configureNearFusionalRun(run.current, "establish-target"); previousTargetSignature.current = target.signature; publish();
  };
  const instruct = () => { if (!live) return; run.current = configureNearFusionalRun(run.current, "give-instruction"); run.current = sampleNearFusionalRun(run.current, spatial()); publish(); };
  const report = () => publish();
  const cancel = () => { if (!live) return; run.current = cancelNearFusionalRun(run.current); power.current = 0; lesson.clearPending(); lesson.setMode("none"); publish(); };
  const release = () => {
    if (!live || !run.current.captures.BI || !run.current.captures.BO) return;
    const current = runtime.toolsRef.current["vergence-prism"], definition = consultationToolDefinition("vergence-prism");
    const rest = { kind: "socket" as const, position: definition.home, rotation: definition.restRotation };
    runtime.updateTools({ ...runtime.toolsRef.current, "vergence-prism": { ...current, placement: rest, lastRest: rest, revision: (current.revision ?? 0) + 1 } });
    run.current = releaseNearFusionalPrism(run.current); publish();
  };
  const record = () => {
    if (!live) return;
    let next = run.current;
    nearFusionalRecordFieldIds.forEach(id => { next = enterNearFusionalRecord(next, id, lesson.entriesRef.current[id] ?? ""); });
    next = submitNearFusionalRecord(next); run.current = next;
    if (!next.record) { lesson.submit(true, false, next.feedback); publish(); return; }
    lesson.submit(true, true, "Horizontal near vergence finding recorded without normative classification."); publish();
  };
  const adjust = (step: number) => { if (changePower(step)) { run.current = sampleNearFusionalRun(run.current, spatial()); publish(); } };

  const fields: LessonField[] = nearFusionalRecordFieldIds.map(id => {
    const xField = id.endsWith("blur") && NEAR_FUSIONAL_CASE.endpoints[id.startsWith("bi") ? "BI" : "BO"].blur === null;
    return xField ? { id, label: fieldLabels[id], choices: [["X", "X · no blur before break"]] }
      : { id, label: fieldLabels[id], choices: [], number: { min: 0, max: 30, step: .1, unit: "Δ" } };
  });
  const sample = spatial();
  const coach = nearFusionalGuidedStep(state.run, sample);
  const targetReady = targetState().ready;
  const entryReady = live && state.run.released && Boolean(state.run.captures.BI && state.run.captures.BO);
  const entryFields = entryReady ? fields : [];
  const actions: LessonAction[] = [
    { label: "FIT NEAR CORRECTION", active: state.run.correctionFitted, run: fitCorrection },
    { label: "CONFIRM PREPARED NEAR TARGET AT 40 CM", active: state.run.targetEstablished, disabled: !state.run.correctionFitted || !targetReady, run: establishTarget },
    { label: "GIVE BLUR / DOUBLE / RECOVERY INSTRUCTION", active: state.run.instructionArmed, disabled: !state.run.targetEstablished, run: instruct },
    { label: "PATIENT REPORT · WHAT DO YOU SEE?", disabled: !state.run.instructionArmed, run: report },
    { label: "DIAL +0.1Δ · ACCESSIBILITY", disabled: !state.run.prismHeld || state.run.released, run: () => adjust(.1) },
    { label: "DIAL −0.1Δ · ACCESSIBILITY", disabled: !state.run.prismHeld || state.run.released, run: () => adjust(-.1) },
    ...(state.run.captures.BI && state.run.captures.BO && !state.run.released ? [{ label: "RELEASE ROTARY PRISM", run: release }] : []),
  ];
  const neutralPhase = attemptKind === "guided" ? state.run.phase.replaceAll("-", " ") : "procedure in progress";
  const capturedCount = Number(Boolean(state.run.captures.BI)) + Number(Boolean(state.run.captures.BO));
  const status = `${capturedCount}/2 bases · target ${state.targetDistanceCm.toFixed(1)} cm · scale ${state.power.toFixed(1)}Δ · ${state.base ?? "orient BI/BO"} · ${neutralPhase} · ${state.run.feedback}`;
  const voiceReport = state.run.instructionArmed ? nearFusionalPatientReport(state.run, state.power) : undefined;
  useEffect(() => { onMirror?.({ title: LIBRARY_TITLES["horizontal-near"], findingPosition: { current: state.run.captures.BI ? 2 : 1, total: 2 },
    status, ready: entryReady, entryReady, fields: entryFields, actions, lesson, reset, record, cancel, reportLines: state.history, voiceReport });
  }, [onMirror, status, entryReady, state, lesson.mode, lesson.entries, lesson.recorded, lesson.feedback]);

  return <>
    <XRClinicRuntimeView cleanHands runtime={runtime} active={live} preview={preview} title="HORIZONTAL NEAR VERGENCE"
      showInstructionalHighlights={disclosure.showHighlights}
      instrumentSettings={{ near: { isolatedTarget: true }, "vergence-prism": { power: state.power, base: state.base ?? undefined,
        highlightAperture: disclosure.showHighlights && coach.index === 4, highlightDial: disclosure.showHighlights && coach.index >= 5 && coach.index <= 8 } }} />
    {(live || preview) && <><LibraryEquipmentTray active={live} equipment={runtime.equipment} showFittingGuides={disclosure.showHighlights} /><LibraryNearStand /></>}
    {live && voiceReport && <XRSign text={["FICTIONAL PATIENT · CURRENT RESPONSE", voiceReport]} p={[.55, 1.75, -.10]} size={[.58, .20]} bg="#07151b" fg="#eefbf7" />}
    {(live || preview) && disclosure.showCoach && <XRSign text={[`GUIDED STEP ${coach.index + 1} / 10 · ${coach.title}`, ...coach.lines]} p={[-.58, 1.74, -.08]} size={[.62, .22]} bg="#102329" fg="#eefbf7" />}
    <PracticeLessonUI runtime={runtime} active={live} title={LIBRARY_TITLES["horizontal-near"]} status={status} tools={["near", "vergence-prism"]}
      actions={actions} directActions={actions.filter(action => action.label.includes("INSTRUCTION") || action.label.includes("REPORT") || action.label.includes("RELEASE"))}
      fields={entryFields} lesson={lesson} entryReady={entryReady} ready={entryReady} onRecord={record} onReset={reset} onExit={onExit} onCancel={cancel}
      boardStatusLines={[`BASES ${capturedCount} / 2`, `TARGET ${state.targetDistanceCm.toFixed(1)} CM · SCALE ${state.power.toFixed(1)}Δ`, attemptKind === "guided" ? coach.title : "Complete the required sequence."]}
      help={attemptKind === "guided" ? ["Fit near correction and release the prepared isolated near target onto its 38–42 cm stand.", "Hold the dedicated rotary prism before OD. Physical roll selects BI or BO.", "Use free-hand trigger movement around the dial; thumbstick and panel steps are accessibility fallbacks.", "Hold zero baseline for 250 ms, change about 1–2Δ/s, reduce after diplopia, and return to zero before BO.", "Release the prism, then enter six blank fields independently. Geometry and responses remain draft assumptions."] : ["Use the modeled scale, neutral controller prompts, and the same physical procedure gates.", "No endpoint powers or corrective interpretation are shown before capture."]} />
  </>;
}
