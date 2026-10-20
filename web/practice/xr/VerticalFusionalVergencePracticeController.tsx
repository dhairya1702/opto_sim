import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Quaternion, Vector3 } from "three";
import {
  cancelVerticalFusionalRun, configureVerticalFusionalRun, enterVerticalFusionalRecord, interruptVerticalFusionalRun,
  newVerticalFusionalRun, releaseVerticalFusionalPrism, reviseVerticalFusionalSetup, sampleVerticalFusionalRun,
  submitVerticalFusionalRecord, verticalFusionalBaseFromRoll, verticalFusionalDisclosure, verticalFusionalEyeState,
  verticalFusionalGuidedStep, verticalFusionalPatientReport, verticalFusionalRecordFieldIds,
  type VerticalFusionalRun, type VerticalFusionalSpatialSample,
} from "../../interaction/verticalFusionalVergenceProcedure";
import { LIBRARY_SURFACES, libraryEquipment, librarySockets, LIBRARY_TITLES, libraryOpticPlacement } from "../../interaction/xrLibraryEquipment";
import { isPatientFitted, sensoryTargetCondition } from "../../interaction/xrSensoryEquipment";
import { consultationToolDefinition, toolInHand } from "../../interaction/xrConsultationTools";
import { useXRClinicRuntime, type ClinicInputMode } from "../../interaction/useXRClinicRuntime";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { LibraryEquipmentTray } from "../../scene/LibraryClinicEquipment";
import { XRSign } from "../../scene/XRClinicPanels";
import { usePracticeAttempt } from "../PracticeAttemptContext";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonAction, type LessonField } from "./PracticeLessonUI";
import { useClinicEyeMotion } from "./useClinicEyeMotion";

const fieldLabels: Record<(typeof verticalFusionalRecordFieldIds)[number], string> = {
  "bu-break": "BU break", "bu-recovery": "BU recovery", "bd-break": "BD break", "bd-recovery": "BD recovery",
};

export function VerticalFusionalVergencePracticeController({ active, preview = false, inputMode = "xr", onComplete, onExit, onMirror }: {
  active: boolean; preview?: boolean; inputMode?: ClinicInputMode; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const live = active && !preview;
  const { settings } = usePracticeAttempt();
  const attemptKind = settings?.kind ?? "guided";
  const disclosure = verticalFusionalDisclosure(attemptKind);
  const completionSent = useRef(false);
  const lesson = usePracticeLesson(() => { if (!completionSent.current) { completionSent.current = true; onComplete(); } });
  const eyes = useClinicEyeMotion(live);
  const run = useRef<VerticalFusionalRun>(newVerticalFusionalRun());
  const power = useRef(0), targetEstablished = useRef(false), previousCorrection = useRef(false), previousHeld = useRef(false);
  const dialDrag = useRef<{ hand: "left" | "right"; angle: number } | null>(null);
  const lastHapticInteger = useRef(0), publishClock = useRef(0);
  const temp = useMemo(() => new Vector3(), []), up = useMemo(() => new Vector3(), []), quaternion = useMemo(() => new Quaternion(), []);
  const [state, setState] = useState({ run: run.current, power: 0, base: null as "BU" | "BD" | null, history: [] as string[] });

  const changePower = useCallback((step: number) => {
    if (!live || run.current.released || run.current.record) return false;
    power.current = Math.round(Math.max(0, Math.min(30, power.current + step)) * 10) / 10;
    return true;
  }, [live]);

  const runtime = useXRClinicRuntime({ active: live, inputMode, equipment: libraryEquipment("vertical-distance"), placementSockets: librarySockets("vertical-distance"), placementSurfaces: LIBRARY_SURFACES,
    equipmentLabels: { worth: "Isolated distance target" },
    editorOpen: lesson.mode !== "none", onMenu: open => lesson.setMode(open ? "menu" : "none"),
    onInterrupt: reason => {
      if (["tracking", "visibility", "transfer", "procedure", "release"].includes(reason)) {
        dialDrag.current = null;
        run.current = interruptVerticalFusionalRun(run.current, "The physical procedure was interrupted.");
      }
    },
    onThumbstickStep: (id, step, _hand, axis) => {
      if (id !== "vergence-prism" || axis !== "vertical") return false;
      const integer = Math.floor(power.current + 1e-8);
      return changePower(step * .1) && Math.floor(power.current + 1e-8) !== integer;
    },
  });

  const targetReady = () => {
    const pose = runtime.supportedWorkingPose("worth", true);
    return Boolean(pose && runtime.toolsRef.current.worth.powered
      && sensoryTargetCondition(pose, runtime.toolsRef.current).endpoint === "distance");
  };
  const spatial = (nowMs = performance.now()): VerticalFusionalSpatialSample => {
    const tool = runtime.toolsRef.current["vergence-prism"], held = tool.placement.kind === "held";
    const object = runtime.objects.current.get("vergence-prism"), pose = runtime.supportedWorkingPose("vergence-prism", true);
    let base: "BU" | "BD" | null = null;
    if (object && held) { object.getWorldQuaternion(quaternion); up.set(0, 1, 0).applyQuaternion(quaternion);
      base = verticalFusionalBaseFromRoll(Math.atan2(-up.x, up.y)); }
    return { nowMs, power: power.current, base, correctionFitted: isPatientFitted(runtime.toolsRef.current, "subjective"),
      targetEstablished: targetEstablished.current && targetReady(), prismHeld: held, alignedOD: held && libraryOpticPlacement(pose, "OD"),
      patientFacing: Boolean(pose && pose.forward[2] < -Math.cos(Math.PI / 6)), tiltValid: base !== null,
      visible: Boolean(object?.visible), tracking: runtime.frameValid.current };
  };
  const publish = useCallback((sample = spatial()) => {
    const history = (["BU", "BD"] as const).flatMap(base => { const capture = run.current.captures[base];
      return capture ? [`${base}: ${capture.break.actualDelta} / ${capture.recovery.actualDelta}Δ`] : []; });
    const next = { run: run.current, power: power.current, base: sample.base, history };
    setState(previous => previous.run === next.run && previous.power === next.power && previous.base === next.base ? previous : next);
  }, []);

  useFrame((_, dt) => {
    const sample = spatial();
    if (targetEstablished.current && !sample.targetEstablished && run.current.phase !== "captured" && !run.current.released && !run.current.record) {
      targetEstablished.current = false;
      run.current = reviseVerticalFusionalSetup(run.current, "Distance target was moved or switched off.", sample.correctionFitted, false);
      lesson.clearPending();
    }
    if (previousCorrection.current && !sample.correctionFitted && !run.current.record) {
      run.current = reviseVerticalFusionalSetup(run.current, "Distance correction was removed or changed.", false); lesson.clearPending();
    }
    previousCorrection.current = sample.correctionFitted;
    if (sample.correctionFitted && !run.current.correctionFitted) run.current = configureVerticalFusionalRun(run.current, "fit-correction");
    if (sample.prismHeld && !previousHeld.current) run.current = configureVerticalFusionalRun(run.current, "pickup-prism");
    if (!sample.prismHeld && previousHeld.current) {
      dialDrag.current = null;
      if (run.current.captures.BU && run.current.captures.BD) run.current = releaseVerticalFusionalPrism(run.current);
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
          if (!dialDrag.current || dialDrag.current.hand !== free.hand) { dialDrag.current = { hand: free.hand, angle }; runtime.pulseHand(free.hand, .3, 35); }
          else {
            let delta = angle - dialDrag.current.angle;
            if (delta > Math.PI) delta -= Math.PI * 2; if (delta < -Math.PI) delta += Math.PI * 2;
            const before = power.current;
            if (Math.abs(delta) > .002) {
              changePower(delta / (Math.PI * 1.5) * 30); dialDrag.current.angle = angle;
              const integer = Math.floor(power.current + 1e-8);
              if (integer !== lastHapticInteger.current) { lastHapticInteger.current = integer; runtime.pulseHand(free.hand, .18, 24); }
              if (power.current !== before) run.current = sampleVerticalFusionalRun(run.current, { ...sample, power: power.current });
            }
          }
        } else dialDrag.current = null;
      } else dialDrag.current = null;
    } else dialDrag.current = null;
    run.current = sampleVerticalFusionalRun(run.current, { ...sample, power: power.current });
    const eyeState = verticalFusionalEyeState(run.current, power.current);
    eyes.forEach((eye, id) => { const target = id === "OD" ? eyeState.OD : eyeState.OS;
      const blend = 1 - Math.exp(-Math.min(dt, .1) * 7); eye.position.x += (target.x * .012 / .035 - eye.position.x) * blend;
      eye.position.y += (target.y * .012 / .035 - eye.position.y) * blend; });
    publishClock.current += dt; if (publishClock.current >= .1) { publishClock.current = 0; publish(sample); }
  });

  const reset = useCallback(() => {
    run.current = newVerticalFusionalRun(completionSent.current); power.current = 0; targetEstablished.current = false;
    previousCorrection.current = false; previousHeld.current = false; dialDrag.current = null; lastHapticInteger.current = 0;
    lesson.reset(); runtime.resetClinic(); eyes.forEach(eye => eye.position.set(0, 0, 0)); publish();
  }, [eyes, lesson.reset, publish, runtime.resetClinic]);
  useEffect(() => { if (!live) reset(); }, [live, reset]);
  const fitCorrection = () => {
    if (!live) return; const tool = runtime.toolsRef.current.subjective;
    if (!isPatientFitted(runtime.toolsRef.current, "subjective")) runtime.updateTools({ ...runtime.toolsRef.current, subjective: { ...tool,
      placement: { kind: "socket", position: [0, 1.5, -.511], rotation: [0, 0, 0, 1], socketId: "sensory-correction", fittingLayer: "correction" }, revision: (tool.revision ?? 0) + 1 } });
  };
  const establishTarget = () => { if (!live || !targetReady() || !isPatientFitted(runtime.toolsRef.current, "subjective") || targetEstablished.current) return; targetEstablished.current = true;
    run.current = configureVerticalFusionalRun(run.current, "establish-target"); publish(); };
  const instruct = () => { if (!live) return; run.current = configureVerticalFusionalRun(run.current, "give-instruction");
    run.current = sampleVerticalFusionalRun(run.current, spatial()); publish(); };
  const cancel = () => { if (!live) return; run.current = cancelVerticalFusionalRun(run.current); power.current = 0;
    targetEstablished.current = false; dialDrag.current = null; lesson.clearPending(); lesson.setMode("none"); publish(); };
  const release = () => {
    if (!live || !run.current.captures.BU || !run.current.captures.BD) return;
    const current = runtime.toolsRef.current["vergence-prism"], definition = consultationToolDefinition("vergence-prism");
    const rest = { kind: "socket" as const, position: definition.home, rotation: definition.restRotation };
    runtime.updateTools({ ...runtime.toolsRef.current, "vergence-prism": { ...current, placement: rest, lastRest: rest, revision: (current.revision ?? 0) + 1 } });
    dialDrag.current = null; run.current = releaseVerticalFusionalPrism(run.current); publish();
  };
  const record = () => {
    if (!live) return; let next = run.current;
    verticalFusionalRecordFieldIds.forEach(id => { next = enterVerticalFusionalRecord(next, id, lesson.entriesRef.current[id] ?? ""); });
    next = submitVerticalFusionalRecord(next); run.current = next;
    if (!next.record) { lesson.submit(true, false, next.feedback); publish(); return; }
    lesson.submit(true, true, "Vertical distance vergence finding recorded without normative classification."); publish();
  };
  const adjust = (step: number) => { if (changePower(step)) { run.current = sampleVerticalFusionalRun(run.current, spatial()); publish(); } };
  const fields: LessonField[] = verticalFusionalRecordFieldIds.map(id => ({ id, label: fieldLabels[id], choices: [], number: { min: 0, max: 30, step: .1, unit: "Δ" } }));
  const coach = verticalFusionalGuidedStep(state.run, spatial());
  const entryReady = live && state.run.released && Boolean(state.run.captures.BU && state.run.captures.BD), entryFields = entryReady ? fields : [];
  const actions: LessonAction[] = [
    { label: "FIT DISTANCE CORRECTION", active: state.run.correctionFitted, run: fitCorrection },
    { label: "ESTABLISH PREPARED MIRRORED TARGET", active: state.run.targetEstablished && targetReady(), disabled: !state.run.correctionFitted || !targetReady(), run: establishTarget },
    { label: "TOGGLE DISTANCE TARGET POWER", active: runtime.tools.worth.powered, run: () => { if (live) runtime.setToolPower("worth", !runtime.toolsRef.current.worth.powered); } },
    { label: "GIVE DOUBLE / RECOVERY INSTRUCTION", active: state.run.instructionArmed, disabled: !state.run.targetEstablished, run: instruct },
    { label: "PATIENT REPORT · WHAT DO YOU SEE?", disabled: !state.run.instructionArmed, run: publish },
    { label: "DIAL +0.1Δ · ACCESSIBILITY", disabled: !state.run.prismHeld || state.run.released, run: () => adjust(.1) },
    { label: "DIAL −0.1Δ · ACCESSIBILITY", disabled: !state.run.prismHeld || state.run.released, run: () => adjust(-.1) },
    ...(state.run.captures.BU && state.run.captures.BD && !state.run.released ? [{ label: "RELEASE ROTARY PRISM", run: release }] : []),
  ];
  const neutralPhase = attemptKind === "guided" ? state.run.phase.replaceAll("-", " ") : "procedure in progress";
  const capturedCount = Number(Boolean(state.run.captures.BU)) + Number(Boolean(state.run.captures.BD));
  const status = `${capturedCount}/2 directions · accessible scale ${state.power.toFixed(1)}Δ · ${state.base ?? "physically roll BU/BD"} · ${neutralPhase} · ${state.run.feedback}`;
  const voiceReport = state.run.instructionArmed ? verticalFusionalPatientReport(state.run, state.power) : undefined;
  useEffect(() => { onMirror?.({ title: LIBRARY_TITLES["vertical-distance"], findingPosition: { current: state.run.captures.BU ? 2 : 1, total: 2 },
    status, ready: entryReady, entryReady, fields: entryFields, actions, lesson, reset, record, cancel, reportLines: state.history, voiceReport });
  }, [onMirror, status, entryReady, state, lesson.mode, lesson.entries, lesson.recorded, lesson.feedback]);

  return <>
    <XRClinicRuntimeView cleanHands runtime={runtime} active={live} preview={preview} title="VERTICAL DISTANCE VERGENCE" sensoryFixationLetter
      showInstructionalHighlights={disclosure.showHighlights} instrumentSettings={{ worth: { fixationLetter: true, onPowerChange: powered => { if (live) runtime.setToolPower("worth", powered); } }, "vergence-prism": { power: state.power, base: state.base ?? undefined,
        highlightAperture: disclosure.showHighlights && coach.index === 4, highlightDial: disclosure.showHighlights && coach.index >= 5 && coach.index <= 8 } }} />
    {(live || preview) && <LibraryEquipmentTray active={live} equipment={runtime.equipment} showFittingGuides={disclosure.showHighlights} />}
    {live && voiceReport && <XRSign text={["FICTIONAL PATIENT · CURRENT RESPONSE", voiceReport]} p={[.55, 1.75, -.10]} size={[.58, .20]} bg="#07151b" fg="#eefbf7" />}
    {(live || preview) && disclosure.showCoach && <XRSign text={[`GUIDED STEP ${coach.index + 1} / 10 · ${coach.title}`, ...coach.lines]} p={[-.58, 1.74, -.08]} size={[.62, .22]} bg="#102329" fg="#eefbf7" />}
    <PracticeLessonUI runtime={runtime} active={live} title={LIBRARY_TITLES["vertical-distance"]} status={status} tools={["vergence-prism"]}
      actions={actions} directActions={actions.filter(action => action.label.includes("INSTRUCTION") || action.label.includes("REPORT") || action.label.includes("RELEASE"))}
      fields={entryFields} lesson={lesson} entryReady={entryReady} ready={entryReady} onRecord={record} onReset={reset} onExit={onExit} onCancel={cancel}
      boardStatusLines={[`DIRECTIONS ${capturedCount} / 2`, `READ SCALE ${state.power.toFixed(1)}Δ`, attemptKind === "guided" ? coach.title : "Complete the required sequence."]}
      help={attemptKind === "guided" ? ["Fit correction and establish the prepared mirrored isolated target one line larger than the poorer eye's best-corrected acuity.",
        "Ask for sustained diplopia and recovery to single; no blur endpoint is used.", "Hold the patient-facing aperture before OD and physically roll to BU, then BD at zero.",
        "Use the free-hand trigger around the dial; thumbstick and panel 0.1Δ steps are accessibility fallbacks.",
        "Hold each baseline and zero re-fusion for 250 ms, move about 1–2Δ/s, release, then independently enter four fields. Draft assumptions require clinician and Quest review."]
        : ["Use the modeled 0–30Δ scale, neutral controller prompts, and the same physical procedure gates.", "No endpoint powers, coach, phase answers, or corrective interpretation are shown before capture."]} />
  </>;
}
