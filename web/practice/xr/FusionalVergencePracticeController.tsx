import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Quaternion, Vector3 } from "three";
import {
  cancelFusionalRun, configureFusionalRun, enterFusionalRecord, fusionalBaseFromRoll, fusionalDisclosure,
  fusionalEyeState, fusionalGuidedStep, fusionalPatientReport, fusionalRecordFieldIds, interruptFusionalRun,
  newFusionalRun, releaseFusionalPrism, reviseFusionalSetup, sampleFusionalRun, submitFusionalRecord,
  type FusionalRun, type FusionalSpatialSample,
} from "../../interaction/fusionalVergenceProcedure";
import { LIBRARY_SURFACES, libraryEquipment, librarySockets, LIBRARY_TITLES, libraryOpticPlacement } from "../../interaction/xrLibraryEquipment";
import { isPatientFitted } from "../../interaction/xrSensoryEquipment";
import { consultationToolDefinition, toolInHand } from "../../interaction/xrConsultationTools";
import { useXRClinicRuntime, type ClinicInputMode } from "../../interaction/useXRClinicRuntime";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { LibraryEquipmentTray } from "../../scene/LibraryClinicEquipment";
import { XRSign } from "../../scene/XRClinicPanels";
import { usePracticeAttempt } from "../PracticeAttemptContext";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonAction, type LessonField } from "./PracticeLessonUI";
import { useClinicEyeMotion } from "./useClinicEyeMotion";

const fieldLabels: Record<(typeof fusionalRecordFieldIds)[number], string> = {
  "bi-blur": "BI blur", "bi-break": "BI break", "bi-recovery": "BI recovery",
  "bo-blur": "BO blur", "bo-break": "BO break", "bo-recovery": "BO recovery",
};

export function FusionalVergencePracticeController({ active, preview = false, inputMode = "xr", onComplete, onExit, onMirror }: {
  active: boolean; preview?: boolean; inputMode?: ClinicInputMode; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const live = active && !preview;
  const { settings } = usePracticeAttempt();
  const attemptKind = settings?.kind ?? "guided";
  const disclosure = fusionalDisclosure(attemptKind);
  const completionSent = useRef(false);
  const lesson = usePracticeLesson(() => { if (!completionSent.current) { completionSent.current = true; onComplete(); } });
  const eyes = useClinicEyeMotion(live);
  const run = useRef<FusionalRun>(newFusionalRun());
  const power = useRef(0);
  const targetEstablished = useRef(false);
  const previousCorrection = useRef(false);
  const previousHeld = useRef(false);
  const dialDrag = useRef<{ hand: "left" | "right"; angle: number } | null>(null);
  const lastHapticInteger = useRef(0);
  const clock = useRef(0);
  const temp = useMemo(() => new Vector3(), []);
  const up = useMemo(() => new Vector3(), []);
  const quaternion = useMemo(() => new Quaternion(), []);
  const [state, setState] = useState({ run: run.current, power: 0, base: null as "BI" | "BO" | null, history: [] as string[] });

  const changePower = useCallback((step: number) => {
    if (!live || run.current.released || run.current.record) return false;
    power.current = Math.round(Math.max(0, Math.min(30, power.current + step)) * 10) / 10;
    return true;
  }, [live]);

  const runtime = useXRClinicRuntime({ active: live, inputMode, equipment: libraryEquipment("horizontal-distance"), placementSockets: librarySockets("horizontal-distance"), placementSurfaces: LIBRARY_SURFACES,
    editorOpen: lesson.mode !== "none", onMenu: open => lesson.setMode(open ? "menu" : "none"),
    onInterrupt: reason => {
      if (["tracking", "visibility", "transfer", "procedure", "release"].includes(reason))
        run.current = interruptFusionalRun(run.current, "The physical procedure was interrupted.");
    },
    onThumbstickStep: (id, step, _hand, axis) => {
      if (id !== "vergence-prism" || axis !== "vertical") return false;
      const integer = Math.floor(power.current + 1e-8);
      return changePower(step * .1) && Math.floor(power.current + 1e-8) !== integer;
    },
  });

  const spatial = (nowMs = performance.now()): FusionalSpatialSample => {
    const tool = runtime.toolsRef.current["vergence-prism"];
    const held = tool.placement.kind === "held";
    const object = runtime.objects.current.get("vergence-prism");
    const pose = runtime.supportedWorkingPose("vergence-prism", true);
    let base: "BI" | "BO" | null = null;
    if (object && held) {
      object.getWorldQuaternion(quaternion);
      up.set(0, 1, 0).applyQuaternion(quaternion);
      base = fusionalBaseFromRoll(Math.atan2(-up.x, up.y));
    }
    const aligned = held && libraryOpticPlacement(pose, "OD");
    return { nowMs, power: power.current, base, correctionFitted: isPatientFitted(runtime.toolsRef.current, "subjective"),
      targetEstablished: targetEstablished.current, prismHeld: held, alignedOD: aligned,
      patientFacing: Boolean(pose && pose.forward[2] < -Math.cos(Math.PI / 6)), tiltValid: base !== null,
      visible: Boolean(object?.visible), tracking: runtime.frameValid.current };
  };

  const publish = useCallback((sample = spatial()) => {
    const history = (["BI", "BO"] as const).flatMap(base => {
      const capture = run.current.captures[base];
      return capture ? [`${base}: ${capture.blur.actualDelta} / ${capture.break.actualDelta} / ${capture.recovery.actualDelta}Δ`] : [];
    });
    const next = { run: run.current, power: power.current, base: sample.base, history };
    setState(previous => previous.run === next.run && previous.power === next.power && previous.base === next.base ? previous : next);
  }, []);

  useFrame((_, dt) => {
    const sample = spatial();
    if (previousCorrection.current && !sample.correctionFitted && !run.current.record) {
      run.current = reviseFusionalSetup(run.current, "Distance correction was removed or changed.", false); lesson.clearPending();
    }
    previousCorrection.current = sample.correctionFitted;
    if (sample.correctionFitted && !run.current.correctionFitted) run.current = configureFusionalRun(run.current, "fit-correction");
    if (sample.prismHeld && !previousHeld.current) run.current = configureFusionalRun(run.current, "pickup-prism");
    if (!sample.prismHeld && previousHeld.current) {
      dialDrag.current = null;
      if (run.current.captures.BI && run.current.captures.BO) run.current = releaseFusionalPrism(run.current);
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
              changePower(delta / (Math.PI * 1.5) * 30);
              dialDrag.current.angle = angle;
              const integer = Math.floor(power.current + 1e-8);
              if (integer !== lastHapticInteger.current) { lastHapticInteger.current = integer; runtime.pulseHand(free.hand, .18, 24); }
              if (power.current !== before) run.current = sampleFusionalRun(run.current, { ...sample, power: power.current });
            }
          }
        } else dialDrag.current = null;
      } else dialDrag.current = null;
    } else dialDrag.current = null;

    run.current = sampleFusionalRun(run.current, { ...sample, power: power.current });
    const eyeState = fusionalEyeState(run.current, power.current);
    eyes.forEach((eye, id) => {
      const target = (id === "OD" ? eyeState.OD : eyeState.OS) * .012 / .035;
      const blend = 1 - Math.exp(-Math.min(dt, .1) * 7);
      eye.position.x += (target - eye.position.x) * blend; eye.position.y *= 1 - blend;
    });
    clock.current += dt;
    if (clock.current >= .1) { clock.current = 0; publish(sample); }
  });

  const reset = useCallback(() => {
    run.current = newFusionalRun(completionSent.current); power.current = 0; targetEstablished.current = false;
    previousCorrection.current = false; previousHeld.current = false; dialDrag.current = null; lastHapticInteger.current = 0;
    lesson.reset(); runtime.resetClinic(); eyes.forEach(eye => eye.position.set(0, 0, 0)); publish();
  }, [eyes, lesson.reset, publish, runtime.resetClinic]);
  useEffect(() => { if (!live) reset(); }, [live, reset]);

  const fitCorrection = () => {
    if (!live) return;
    const tool = runtime.toolsRef.current.subjective;
    if (!isPatientFitted(runtime.toolsRef.current, "subjective")) runtime.updateTools({ ...runtime.toolsRef.current, subjective: { ...tool,
      placement: { kind: "socket", position: [0, 1.5, -.511], rotation: [0, 0, 0, 1], socketId: "sensory-correction", fittingLayer: "correction" }, revision: (tool.revision ?? 0) + 1 } });
  };
  const establishTarget = () => { if (!live || targetEstablished.current) return; targetEstablished.current = true; run.current = configureFusionalRun(run.current, "establish-target"); publish(); };
  const instruct = () => { if (!live) return; run.current = configureFusionalRun(run.current, "give-instruction"); run.current = sampleFusionalRun(run.current, spatial()); publish(); };
  const report = () => publish();
  const cancel = () => { if (!live) return; run.current = cancelFusionalRun(run.current); power.current = 0; targetEstablished.current = false; lesson.clearPending(); lesson.setMode("none"); publish(); };
  const release = () => {
    if (!live || !run.current.captures.BI || !run.current.captures.BO) return;
    const current = runtime.toolsRef.current["vergence-prism"], definition = consultationToolDefinition("vergence-prism");
    const rest = { kind: "socket" as const, position: definition.home, rotation: definition.restRotation };
    runtime.updateTools({ ...runtime.toolsRef.current, "vergence-prism": { ...current, placement: rest, lastRest: rest, revision: (current.revision ?? 0) + 1 } });
    run.current = releaseFusionalPrism(run.current); publish();
  };
  const record = () => {
    if (!live) return;
    let next = run.current;
    fusionalRecordFieldIds.forEach(id => { next = enterFusionalRecord(next, id, lesson.entriesRef.current[id] ?? ""); });
    next = submitFusionalRecord(next); run.current = next;
    if (!next.record) { lesson.submit(true, false, next.feedback); publish(); return; }
    lesson.submit(true, true, "Horizontal distance vergence finding recorded without normative classification."); publish();
  };
  const adjust = (step: number) => { if (changePower(step)) { run.current = sampleFusionalRun(run.current, spatial()); publish(); } };

  const fields: LessonField[] = fusionalRecordFieldIds.map(id => id === "bi-blur"
    ? { id, label: fieldLabels[id], choices: [["X", "X · no blur before break"]] }
    : { id, label: fieldLabels[id], choices: [], number: { min: 0, max: 30, step: .1, unit: "Δ" } });
  const coach = fusionalGuidedStep(state.run, spatial());
  const entryReady = live && state.run.released && Boolean(state.run.captures.BI && state.run.captures.BO);
  const entryFields = entryReady ? fields : [];
  const actions: LessonAction[] = [
    { label: "FIT DISTANCE CORRECTION", active: state.run.correctionFitted, run: fitCorrection },
    { label: "ESTABLISH MIRRORED DISTANCE TARGET", active: state.run.targetEstablished, disabled: !state.run.correctionFitted, run: establishTarget },
    { label: "GIVE BLUR / DOUBLE / RECOVERY INSTRUCTION", active: state.run.instructionArmed, disabled: !state.run.targetEstablished, run: instruct },
    { label: "PATIENT REPORT · WHAT DO YOU SEE?", disabled: !state.run.instructionArmed, run: report },
    { label: "DIAL +0.1Δ · ACCESSIBILITY", disabled: !state.run.prismHeld || state.run.released, run: () => adjust(.1) },
    { label: "DIAL −0.1Δ · ACCESSIBILITY", disabled: !state.run.prismHeld || state.run.released, run: () => adjust(-.1) },
    ...(state.run.captures.BI && state.run.captures.BO && !state.run.released ? [{ label: "RELEASE ROTARY PRISM", run: release }] : []),
  ];
  const neutralPhase = attemptKind === "guided" ? state.run.phase.replaceAll("-", " ") : "procedure in progress";
  const capturedCount = Number(Boolean(state.run.captures.BI)) + Number(Boolean(state.run.captures.BO));
  const status = `${capturedCount}/2 bases · accessible scale ${state.power.toFixed(1)}Δ · ${state.base ?? "orient BI/BO"} · ${neutralPhase} · ${state.run.feedback}`;
  const voiceReport = state.run.instructionArmed ? fusionalPatientReport(state.run, state.power) : undefined;
  useEffect(() => { onMirror?.({ title: LIBRARY_TITLES["horizontal-distance"], findingPosition: { current: state.run.captures.BI ? 2 : 1, total: 2 },
    status, ready: entryReady, entryReady, fields: entryFields, actions, lesson, reset, record, cancel, reportLines: state.history, voiceReport });
  }, [onMirror, status, entryReady, state, lesson.mode, lesson.entries, lesson.recorded, lesson.feedback]);

  return <>
    <XRClinicRuntimeView cleanHands runtime={runtime} active={live} preview={preview} title="HORIZONTAL DISTANCE VERGENCE" sensoryStation="four-prism"
      showInstructionalHighlights={disclosure.showHighlights}
      instrumentSettings={{ "vergence-prism": { power: state.power, base: state.base ?? undefined,
        highlightAperture: disclosure.showHighlights && coach.index === 4, highlightDial: disclosure.showHighlights && coach.index >= 5 && coach.index <= 8 } }} />
    {(live || preview) && <LibraryEquipmentTray active={live} equipment={runtime.equipment} showFittingGuides={disclosure.showHighlights} />}
    {live && voiceReport && <XRSign text={["FICTIONAL PATIENT · CURRENT RESPONSE", voiceReport]} p={[.55, 1.75, -.10]} size={[.58, .20]} bg="#07151b" fg="#eefbf7" />}
    {(live || preview) && disclosure.showCoach && <XRSign text={[`GUIDED STEP ${coach.index + 1} / 10 · ${coach.title}`, ...coach.lines]} p={[-.58, 1.74, -.08]} size={[.62, .22]} bg="#102329" fg="#eefbf7" />}
    <PracticeLessonUI runtime={runtime} active={live} title={LIBRARY_TITLES["horizontal-distance"]} status={status} tools={["vergence-prism"]}
      actions={actions} directActions={actions.filter(action => action.label.includes("INSTRUCTION") || action.label.includes("REPORT") || action.label.includes("RELEASE"))}
      fields={entryFields} lesson={lesson} entryReady={entryReady} ready={entryReady} onRecord={record} onReset={reset} onExit={onExit} onCancel={cancel}
      boardStatusLines={[`BASES ${capturedCount} / 2`, `READ SCALE ${state.power.toFixed(1)}Δ`, attemptKind === "guided" ? coach.title : "Complete the required sequence."]}
      help={attemptKind === "guided" ? ["Fit correction, establish the mirrored target, and give the full blur/double/recovery instruction.", "Hold the dedicated rotary prism before OD. Physical roll selects BI or BO.", "Hold the free-hand trigger beside the dial and move around its axis; thumbstick and panel steps are accessibility fallbacks.", "Hold zero baseline for 250 ms, change about 1–2Δ/s, reduce after diplopia, and return to zero before BO.", "Release the prism, then enter six blank fields independently. Geometry and responses remain draft assumptions."] : ["Use the modeled 0–30Δ scale, neutral controller prompts, and the same physical procedure gates.", "No endpoint powers or corrective interpretation are shown before capture."]} />
  </>;
}
