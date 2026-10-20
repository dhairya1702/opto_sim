import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import {
  confirmRelativeAccommodationBaseline, confirmRelativeAccommodationInitialClear, giveRelativeAccommodationInstruction,
  interruptRelativeAccommodation, newRelativeAccommodationRun, relativeAccommodationDisclosure,
  relativeAccommodationGeometryIssue, relativeAccommodationGuidedStep, relativeAccommodationHasProgress,
  relativeAccommodationPatientReport, restartRelativeAccommodation, restartRelativeAccommodationConditions,
  sampleRelativeAccommodation, stepRelativeAccommodationPower, submitRelativeAccommodationRecord,
  type RelativeAccommodationRun, type RelativeAccommodationSpatialSample,
} from "../../interaction/relativeAccommodationProcedure";
import {
  LIBRARY_SURFACES, LIBRARY_TITLES, libraryEquipment, libraryNear, libraryOpticPlacement, librarySockets,
} from "../../interaction/xrLibraryEquipment";
import { isPatientFitted } from "../../interaction/xrSensoryEquipment";
import { toolInHand } from "../../interaction/xrConsultationTools";
import { useXRClinicRuntime, type ClinicInputMode } from "../../interaction/useXRClinicRuntime";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { LibraryEquipmentTray, LibraryNearStand } from "../../scene/LibraryClinicEquipment";
import { XRSign } from "../../scene/XRClinicPanels";
import { usePracticeAttempt } from "../PracticeAttemptContext";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonAction, type LessonField } from "./PracticeLessonUI";

export function RelativeAccommodationPracticeController({ active, preview = false, inputMode = "xr", onComplete, onExit, onMirror }: {
  active: boolean; preview?: boolean; inputMode?: ClinicInputMode; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const live = active && !preview;
  const { settings } = usePracticeAttempt();
  const attemptKind = settings?.kind ?? "guided";
  const disclosure = relativeAccommodationDisclosure(attemptKind);
  const completionSent = useRef(false);
  const lesson = usePracticeLesson(() => { if (!completionSent.current) { completionSent.current = true; onComplete(); } });
  const run = useRef<RelativeAccommodationRun>(newRelativeAccommodationRun());
  const dialDrag = useRef<{ hand: "left" | "right"; angle: number; remainderD: number } | null>(null);
  const conditionKey = useRef("");
  const publishClock = useRef(0);
  const temp = useMemo(() => new Vector3(), []);
  const [state, setState] = useState({ run: run.current });

  function spatial(nowMs = performance.now()): RelativeAccommodationSpatialSample {
    const holder = runtime.toolsRef.current["trial-lens"];
    const holderHeld = holder.placement.kind === "held";
    const holderPose = runtime.supportedWorkingPose("trial-lens", true);
    const target = runtime.toolsRef.current.near;
    const targetPose = runtime.supportedWorkingPose("near", true);
    return { nowMs, correctionFitted: isPatientFitted(runtime.toolsRef.current, "subjective"),
      targetDocked: target.placement.kind === "socket" && target.placement.socketId === "practice-near-stand" && libraryNear(targetPose),
      holderHeld, holderAligned: holderHeld && libraryOpticPlacement(holderPose, "OU", true),
      visible: Boolean(runtime.objects.current.get("trial-lens")?.visible), tracking: runtime.frameValid.current };
  }

  const publish = useCallback(() => {
    const next = { run: run.current };
    setState(previous => previous.run === next.run ? previous : next);
  }, []);

  const applyStep = useCallback((direction: "plus" | "minus", sample?: RelativeAccommodationSpatialSample) => {
    if (!live || lesson.awarded.current) return false;
    const before = run.current.powerD;
    run.current = stepRelativeAccommodationPower(run.current, direction, sample ?? spatial());
    const changed = run.current.powerD !== before;
    if (changed) lesson.clearPending();
    publish();
    return changed;
  }, [lesson.clearPending, live, publish]);

  const runtime = useXRClinicRuntime({ active: live, inputMode, equipment: libraryEquipment("relative"), placementSockets: librarySockets("relative"), placementSurfaces: LIBRARY_SURFACES,
    editorOpen: lesson.mode !== "none", onMenu: open => lesson.setMode(open ? "menu" : "none"),
    onInterrupt: reason => {
      if (["tracking", "visibility", "transfer", "procedure", "pickup", "release"].includes(reason)) {
        dialDrag.current = null;
        run.current = interruptRelativeAccommodation(run.current, "The physical procedure was interrupted.");
      }
    },
    onThumbstickStep: (id, step, _hand, axis) => {
      if (id !== "trial-lens" || axis !== "vertical") return false;
      return applyStep(step > 0 ? "plus" : "minus");
    },
  });

  useFrame((_, dt) => {
    const tools = runtime.toolsRef.current;
    const nextConditionKey = `${tools.subjective.revision ?? 0}:${tools.near.revision ?? 0}`;
    if (!conditionKey.current) conditionKey.current = nextConditionKey;
    else if (conditionKey.current !== nextConditionKey) {
      conditionKey.current = nextConditionKey;
      if (relativeAccommodationHasProgress(run.current))
        run.current = restartRelativeAccommodationConditions(run.current, "The correction or supported target changed.");
    }

    const sample = spatial();
    const holder = tools["trial-lens"];
    const object = runtime.objects.current.get("trial-lens");
    if (sample.holderHeld && object && run.current.initialClearConfirmed && !run.current.praCapture) {
      object.updateMatrixWorld(true);
      const free = runtime.slots.find(slot => slot.hand && slot.tracked && slot.triggerDown && !toolInHand(tools, slot.hand));
      if (free?.hand) {
        free.grip.getWorldPosition(temp); object.worldToLocal(temp);
        const dx = temp.x - .075, dy = temp.y - .035;
        const close = Math.hypot(dx, dy) <= .072 && Math.abs(temp.z - .006) <= .09;
        if (close) {
          const angle = Math.atan2(dx, dy);
          if (!dialDrag.current || dialDrag.current.hand !== free.hand) {
            dialDrag.current = { hand: free.hand, angle, remainderD: 0 }; runtime.pulseHand(free.hand, .3, 35);
          } else {
            let delta = angle - dialDrag.current.angle;
            if (delta > Math.PI) delta -= Math.PI * 2;
            if (delta < -Math.PI) delta += Math.PI * 2;
            dialDrag.current.angle = angle;
            dialDrag.current.remainderD += -delta / (Math.PI * 1.5) * 4.25;
            let changed = false;
            while (dialDrag.current.remainderD >= .25) {
              changed = applyStep("plus", { ...sample, nowMs: performance.now() }) || changed;
              dialDrag.current.remainderD -= .25;
            }
            while (dialDrag.current.remainderD <= -.25) {
              changed = applyStep("minus", { ...sample, nowMs: performance.now() }) || changed;
              dialDrag.current.remainderD += .25;
            }
            if (changed) runtime.pulseHand(free.hand, .18, 24);
          }
        } else dialDrag.current = null;
      } else dialDrag.current = null;
    } else dialDrag.current = null;

    run.current = sampleRelativeAccommodation(run.current, { ...sample, nowMs: performance.now() });
    publishClock.current += dt;
    if (publishClock.current >= .1) { publishClock.current = 0; publish(); }
  });

  const reset = useCallback(() => {
    run.current = newRelativeAccommodationRun(completionSent.current); dialDrag.current = null; conditionKey.current = "";
    lesson.reset(); runtime.resetClinic(); publish();
  }, [lesson.reset, publish, runtime.resetClinic]);
  useEffect(() => { if (!live) reset(); }, [live, reset]);

  const fitCorrection = () => {
    if (!live || isPatientFitted(runtime.toolsRef.current, "subjective")) return;
    const tool = runtime.toolsRef.current.subjective;
    runtime.updateTools({ ...runtime.toolsRef.current, subjective: { ...tool, placement: { kind: "socket", position: [0, 1.5, -.511], rotation: [0, 0, 0, 1], socketId: "sensory-correction", fittingLayer: "correction" }, revision: (tool.revision ?? 0) + 1 } });
  };
  const placeTarget = () => {
    if (!live) return;
    const socket = librarySockets("relative").find(candidate => candidate.id === "practice-near-stand");
    if (!socket) return;
    const tool = runtime.toolsRef.current.near;
    runtime.updateTools({ ...runtime.toolsRef.current, near: { ...tool, placement: { kind: "socket", position: socket.position, rotation: socket.rotation, socketId: socket.id, fittingLayer: socket.fittingLayer }, revision: (tool.revision ?? 0) + 1 } });
  };
  const instruct = () => { if (live) { run.current = giveRelativeAccommodationInstruction(run.current, spatial()); publish(); } };
  const confirmInitial = () => { if (live) { run.current = confirmRelativeAccommodationInitialClear(run.current, spatial()); publish(); } };
  const confirmBaseline = () => { if (live) { run.current = confirmRelativeAccommodationBaseline(run.current, spatial()); publish(); } };
  const restart = () => { if (live) { run.current = restartRelativeAccommodation(run.current); dialDrag.current = null; lesson.clearPending(); publish(); } };
  const cancel = () => { if (!lesson.awarded.current) { run.current = restartRelativeAccommodation(run.current); lesson.clearPending(); publish(); } lesson.setMode("none"); };
  const record = () => {
    if (!live || lesson.awarded.current) return;
    const before = run.current;
    const next = submitRelativeAccommodationRecord(before, lesson.entriesRef.current.nra ?? "", lesson.entriesRef.current.pra ?? "");
    run.current = next;
    if (next.phase !== "complete") { lesson.submit(true, false, next.feedback); publish(); return; }
    lesson.submit(true, true, "Binocular NRA and PRA recorded.");
    publish();
  };

  const fields: LessonField[] = [
    { id: "nra", label: "NRA endpoint", choices: [], number: { min: 0, max: 5, step: .25, unit: " D" } },
    { id: "pra", label: "PRA endpoint", choices: [], number: { min: -5, max: 0, step: .25, unit: " D" } },
  ];
  const sample = spatial();
  const coach = relativeAccommodationGuidedStep(state.run, sample);
  const entryReady = live && Boolean(state.run.nraCapture && state.run.praCapture);
  const blocked = Boolean(relativeAccommodationGeometryIssue(sample));
  const actions: LessonAction[] = [
    { label: "FIT NEAR CORRECTION", active: sample.correctionFitted, run: fitCorrection },
    { label: "PLACE READABLE TARGET AT 40 CM", active: sample.targetDocked, run: placeTarget },
    { label: "GIVE CLEAR / SINGLE / SUSTAINED BLUR INSTRUCTION", active: state.run.instructionArmed, disabled: blocked, run: instruct },
    { label: "CONFIRM INITIAL CLEAR AT 0.00 D", active: state.run.initialClearConfirmed, disabled: !state.run.instructionArmed || state.run.powerD !== 0 || blocked, run: confirmInitial },
    { label: "PATIENT REPORT · WHAT DO YOU SEE?", disabled: !state.run.instructionArmed, run: publish },
    { label: "DIAL +0.25 D · ACCESSIBILITY", disabled: !state.run.initialClearConfirmed || Boolean(state.run.nraCapture) || state.run.powerD >= 2 || blocked, run: () => applyStep("plus") },
    { label: "DIAL −0.25 D · ACCESSIBILITY", disabled: !state.run.initialClearConfirmed || state.run.powerD <= (state.run.baselineConfirmed ? -2.25 : 0) || Boolean(state.run.praCapture) || blocked, run: () => applyStep("minus") },
    { label: "CONFIRM CLEAR BASELINE AT 0.00 D", active: state.run.baselineConfirmed, disabled: !state.run.nraCapture || state.run.powerD !== 0 || state.run.baselineConfirmed || blocked, run: confirmBaseline },
    { label: "RESTART NRA / PRA", run: restart },
  ];
  const records = state.run.record ? [`NRA ${state.run.record.submittedNraD.toFixed(2)} D · PRA ${state.run.record.submittedPraD.toFixed(2)} D`] : [];
  const phaseLabel = attemptKind === "guided" ? state.run.phase.replaceAll("-", " ") : "procedure in progress";
  const status = `OU · accessible scale ${state.run.powerD >= 0 ? "+" : ""}${state.run.powerD.toFixed(2)} D · ${phaseLabel} · ${state.run.feedback}`;
  const voiceReport = relativeAccommodationPatientReport(state.run) || undefined;
  useEffect(() => { onMirror?.({ title: LIBRARY_TITLES.relative, findingPosition: { current: 1, total: 1 }, status,
    ready: entryReady, entryReady, fields, actions, lesson, reset, record, cancel, reportLines: records, voiceReport });
  }, [onMirror, status, entryReady, state, lesson.mode, lesson.entries, lesson.recorded, lesson.feedback]);

  const highlighted = coach.index === 0 ? ["subjective" as const] : coach.index === 1 ? ["near" as const] : coach.index === 2 ? ["trial-lens" as const] : [];
  return <>
    <XRClinicRuntimeView cleanHands runtime={runtime} active={live} preview={preview} title="NRA / PRA"
      instructionalEquipment={disclosure.showHighlights ? highlighted : []}
      instrumentSettings={{ near: { readableTarget: true }, "trial-lens": { power: state.run.powerD,
        highlightAperture: disclosure.showHighlights && coach.index === 2,
        highlightDial: disclosure.showHighlights && coach.index >= 5 && coach.index <= 8 } }} />
    {(live || preview) && <><LibraryEquipmentTray active={live} equipment={runtime.equipment} showFittingGuides={disclosure.showHighlights} /><LibraryNearStand /></>}
    {live && voiceReport && <XRSign text={["FICTIONAL PATIENT · CURRENT RESPONSE", voiceReport]} p={[.55, 1.75, -.10]} size={[.58, .20]} bg="#07151b" fg="#eefbf7" />}
    {(live || preview) && disclosure.showCoach && <XRSign text={[`GUIDED STEP ${coach.index + 1} / 10 · ${coach.title}`, ...coach.lines]} p={[-.58, 1.74, -.08]} size={[.64, .24]} bg="#102329" fg="#eefbf7" />}
    <PracticeLessonUI runtime={runtime} active={live} title={LIBRARY_TITLES.relative} status={status} tools={["trial-lens"]}
      actions={actions} directActions={actions.slice(2)} fields={fields} lesson={lesson} entryReady={entryReady} ready={entryReady}
      onRecord={record} onReset={reset} onExit={onExit} onCancel={cancel}
      boardStatusLines={["BINOCULAR · OU", state.run.praCapture ? "BOTH ENDPOINTS FROZEN · RELEASE HOLDER AND RECORD" : `LENS SCALE ${state.run.powerD >= 0 ? "+" : ""}${state.run.powerD.toFixed(2)} D`, attemptKind === "guided" ? coach.title : "Complete the physical sequence."]}
      help={attemptKind === "guided" ? ["Fit near correction and release the readable target patient-facing on its 40 cm stand.", "Hold both clear apertures face-on over OD and OS; keep the other controller free for the physical dial.", "Give the clear/single and first-sustained-blur instruction, then confirm initial clarity at 0.00 D.", "Add plus in 0.25 D steps for NRA. The fictional sustained response freezes automatically.", "Remove all plus, explicitly confirm clear baseline at 0.00 D, then add minus for PRA.", "Release the holder and independently enter both signed endpoints. Geometry, timing, and responses are illustrative drafts pending clinical and device review."]
        : ["Use the supported readable near line, binocular holder, modeled scale, and neutral patient reports.", "The physical geometry and response timing are illustrative drafts."]} />
  </>;
}
