import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { pushUpBlurCm } from "../../interaction/accommodationPractice";
import { facilityDuration, facilityRemaining, facilityClearDelay } from "../../interaction/accommodativeFacility";
import { nextMinusLens, minusLensResponseMs } from "../../interaction/minusLens";
import { initialRelativeState, relativeStep, relativeBlur, recordRelative, type RelativeState } from "../../interaction/relativeAccommodation";
import { accommodationEyes, pushUpEndpoint, minusLensEndpoint, newAccommodationFacility, flipAccommodationFacility, type AccommodationKind, type AccommodationTimedRun } from "../../interaction/xrAccommodationPractice";
import { LIBRARY_SURFACES, libraryEquipment, librarySockets, libraryTool, libraryNear, libraryOpticPlacement, libraryDistance, librarySetupKey, libraryOcclusion, LIBRARY_TITLES } from "../../interaction/xrLibraryEquipment";
import { isPatientFitted } from "../../interaction/xrSensoryEquipment";
import { freezeVergenceCapture, numericCaptureSubmission, type VergenceCapture } from "../../interaction/xrVergencePractice";
import { useXRClinicRuntime } from "../../interaction/useXRClinicRuntime";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { LibraryEquipmentTray, LibraryNearStand } from "../../scene/LibraryClinicEquipment";
import { XRSign } from "../../scene/XRClinicPanels";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonField } from "./PracticeLessonUI";
export function AccommodationPracticeController({ kind, active, preview = false, onComplete, onExit, onMirror }: {
  kind: AccommodationKind; active: boolean; preview?: boolean; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const live = active && !preview, lesson = usePracticeLesson(onComplete);
  const eyeIndex = useRef(0), setup = useRef({ fixation: false, power: 0 }), initialized = useRef(false), settled = useRef(0), relative = useRef<RelativeState>({ ...initialRelativeState });
  const timed = useRef<AccommodationTimedRun | null>(null), capture = useRef<VergenceCapture | null>(null), history = useRef<string[]>([]), generation = useRef(0), key = useRef("");
  const eye = () => accommodationEyes(kind)[eyeIndex.current];
  const [state, setState] = useState({ eye: eye(), power: 0, phase: "nra", distance: 0, ready: false, settled: false, captured: false, report: "", side: "plus", cycles: 0, seconds: 60, history: [] as string[] });
  const clearRun = useCallback(() => { if (capture.current) return; initialized.current = false; settled.current = 0; setup.current.power = 0; relative.current = { ...initialRelativeState }; timed.current = null; lesson.clearPending(); }, [lesson.clearPending]);
  const runtime = useXRClinicRuntime({ active: live, equipment: libraryEquipment(kind), placementSockets: librarySockets(kind), placementSurfaces: LIBRARY_SURFACES, editorOpen: lesson.mode !== "none",
    onMenu: open => lesson.setMode(open ? "menu" : "none"), onInterrupt: reason => { if (["visibility", "transfer", "tracking", "procedure"].includes(reason)) clearRun(); },
    onToolUsed: (id, action) => { if (id === "lens-flipper" && action === "activate") flip(); } });
  const signature = () => { const cover = runtime.toolsRef.current.cover; return `${librarySetupKey(runtime.toolsRef.current, kind)}:${kind === "relative" ? "OU" : `${cover.revision}:${cover.placement.kind === "held" ? cover.placement.hand : cover.placement.socketId ?? "free"}`}`; };
  const sample = () => {
    const target = runtime.supportedWorkingPose(kind === "push-up" ? "fixation" : "near", true), distance = libraryDistance(target, kind === "push-up");
    const optic = runtime.supportedWorkingPose(libraryTool(kind), true);
    return { distance: distance.distanceCm, ready: live && runtime.frameValid.current && isPatientFitted(runtime.toolsRef.current, "subjective") && setup.current.fixation
      && (kind === "relative" || libraryOcclusion(runtime.toolsRef.current, eye()))
      && (kind === "push-up" ? distance.ready && distance.distanceCm >= 2 && distance.distanceCm <= 42 : libraryNear(target) && libraryOpticPlacement(optic, eye(), true)) };
  };
  const publish = (spatial = sample()) => {
    const current = timed.current, now = performance.now(), isSettled = settled.current >= minusLensResponseMs;
    const report = capture.current ? capture.current.reports.join(" ") : kind === "push-up" ? spatial.distance <= pushUpBlurCm[eye()] + 1e-8 ? "First sustained blur." : "The target is clear." : kind === "accommodative-facility" ? !current ? "Start with the plus side at clear near fixation." : now - current.presented >= facilityClearDelay[current.side] ? "Clear; flip now." : "Patient is clearing the lens…" : !isSettled ? "Wait for the patient’s response." : kind === "relative" ? relativeBlur(relative.current) ? "First sustained blur." : "Clear and single." : setup.current.power === -4 ? "First sustained blur." : "Clear.";
    const next = { eye: eye(), power: setup.current.power, phase: relative.current.phase, distance: spatial.distance, ready: spatial.ready, settled: isSettled, captured: Boolean(capture.current), report,
      side: current?.side ?? "plus", cycles: current?.cycles ?? capture.current?.values.cycles ?? 0, seconds: current ? facilityRemaining(current.start, now) : capture.current ? 0 : 60, history: [...history.current] };
    setState(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
  };
  const clock = useRef(0);
  useFrame((_, dt) => {
    const nextKey = signature();
    if (key.current !== nextKey) { key.current = nextKey; generation.current++; capture.current = null; clearRun(); }
    const spatial = sample();
    if (!spatial.ready && !capture.current) clearRun();
    if (spatial.ready && !capture.current) {
      if (kind === "push-up" && Math.abs(spatial.distance - 40) <= 2) initialized.current = true;
      settled.current += dt * 1000;
      const current = timed.current;
      if (current && performance.now() - current.start >= facilityDuration) capture.current = freezeVergenceCapture(generation.current, nextKey, eye(), { cycles: current.cycles }, spatial.distance, [`${eye()} · ${current.cycles} full ±2.00 D pairs in 60 seconds.`]);
    }
    clock.current += dt; if (clock.current >= .1) { clock.current = 0; publish(spatial); }
  });
  const reset = useCallback(() => {
    generation.current++; capture.current = null; eyeIndex.current = 0; history.current = []; setup.current = { fixation: false, power: 0 }; clearRun(); lesson.reset(); runtime.resetClinic(); key.current = signature(); publish();
  }, [clearRun, lesson.reset, runtime.resetClinic]);
  useEffect(() => { if (!live) reset(); }, [live, reset]);
  const lensStep = (direction: "add" | "remove" = "add") => {
    if (!live || lesson.awarded.current || capture.current || !sample().ready || settled.current < minusLensResponseMs) return;
    if (kind === "relative") { relative.current = relativeStep(relative.current); setup.current.power = relative.current.power; }
    else setup.current.power = nextMinusLens(setup.current.power, direction);
    settled.current = 0; lesson.clearPending(); publish();
  };
  const mark = () => {
    if (!live || capture.current || lesson.awarded.current) return;
    const spatial = sample(); let values: Record<string, number> | null = null;
    if (kind === "push-up") values = pushUpEndpoint(eye(), spatial.distance, initialized.current, spatial.ready);
    else if (kind === "minus-lens") values = minusLensEndpoint(setup.current.power, settled.current >= minusLensResponseMs, spatial.ready);
    else if (kind === "relative" && spatial.ready) {
      relative.current = recordRelative(relative.current, settled.current >= minusLensResponseMs);
      if (relative.current.phase === "done") values = { nra: relative.current.nra ?? 0, pra: relative.current.pra ?? 0 };
    }
    if (values) capture.current = freezeVergenceCapture(generation.current, signature(), eye(), values, spatial.distance, [kind === "relative" ? `NRA +${values.nra.toFixed(2)} D · PRA ${values.pra.toFixed(2)} D.` : kind === "minus-lens" ? `${eye()} · sustained blur at ${setup.current.power.toFixed(2)} D added; amplitude ${values.amplitude.toFixed(2)} D.` : `${eye()} · sustained blur at ${values.distance.toFixed(1)} cm from spectacle plane; amplitude ${values.amplitude.toFixed(2)} D.`]);
    publish();
  };
  const start = () => { if (live && kind === "accommodative-facility" && sample().ready && !timed.current && !capture.current && !lesson.awarded.current) { timed.current = newAccommodationFacility(performance.now()); publish(); } };
  function flip() { if (!live || !timed.current || capture.current) return; timed.current = flipAccommodationFacility(timed.current, performance.now(), sample().ready); publish(); }
  const cancel = () => { if (!lesson.awarded.current) { capture.current = null; clearRun(); publish(); } lesson.setMode("none"); };
  const record = () => {
    const observed = capture.current;
    if (!live || !runtime.frameValid.current || !observed || observed.setup !== signature() || lesson.awarded.current) return;
    const correct = numericCaptureSubmission(observed.values, lesson.entriesRef.current, .011);
    if (correct === null) return;
    if (!correct) { lesson.submit(true, false, "Check your captured endpoint, calculation or full-cycle count."); return; }
    history.current = [...history.current, `${observed.label}: ${Object.entries(lesson.entriesRef.current).map(([label, value]) => `${label} ${value}`).join(" · ")}`];
    if (eyeIndex.current === accommodationEyes(kind).length - 1) { lesson.submit(true, true, "All required accommodation observations recorded."); publish(); return; }
    eyeIndex.current++; generation.current++; capture.current = null; clearRun(); lesson.setMode("none"); publish();
  };
  const field = (id: string, label: string, min: number, max: number, unit: string, step: number): LessonField => ({ id, label, choices: [], number: { min, max, unit, step } });
  const fields = kind === "push-up" ? [field("distance", "Sustained-blur distance", 0, 42, " cm", .1), field("amplitude", "100 / distance in cm", 0, 50, " D", .01)] : kind === "relative" ? [field("nra", "NRA", 0, 5, " D", .25), field("pra", "PRA", -5, 0, " D", .25)] : kind === "minus-lens" ? [field("amplitude", "Amplitude: minus added + 2.50", 0, 20, " D", .25)] : [field("cycles", "Full plus/minus pairs in 60 seconds", 0, 100, " cpm", 1)];
  const actions = [
    { label: "ESTABLISH FIXATION", run: () => { if (!live || lesson.awarded.current) return; setup.current.fixation = true; publish(); } },
    ...(kind === "minus-lens" ? [{ label: "ADD −0.25 D", disabled: !state.ready || !state.settled || state.captured, run: () => lensStep() }, { label: "REMOVE 0.25 D", disabled: !state.ready || !state.settled || state.captured, run: () => lensStep("remove") }] : kind === "relative" ? [{ label: state.phase === "baseline" ? "REMOVE +0.25 D" : state.phase === "pra" ? "ADD −0.25 D" : "ADD +0.25 D", disabled: !state.ready || !state.settled || state.captured, run: () => lensStep() }] : []),
    ...(kind === "accommodative-facility" ? [{ label: "START 60-SECOND RUN", disabled: !state.ready || Boolean(timed.current || capture.current), run: start }, { label: "CLEAR / FLIP ±2 D", disabled: !state.ready || !timed.current || state.captured || performance.now() - (timed.current?.presented ?? Infinity) < facilityClearDelay[timed.current?.side ?? "plus"], run: flip }] : [{ label: kind === "relative" && state.phase === "baseline" ? "CONFIRM CLEAR BASELINE" : "MARK SUSTAINED BLUR", disabled: !state.ready || state.captured || (kind !== "push-up" && !state.settled), run: mark }]),
    { label: "RESTART CURRENT RUN", run: () => { if (!live || lesson.awarded.current) return; capture.current = null; clearRun(); publish(); } },
  ];
  const status = `${state.history.length}/${accommodationEyes(kind).length} records · ${state.eye} · ${kind === "push-up" ? `${state.distance.toFixed(1)} cm from spectacle plane` : kind === "accommodative-facility" ? `${state.seconds}s · ${state.cycles} cycles · ${state.side}` : `${state.power.toFixed(2)} D · ${kind === "relative" ? state.phase : "minus-lens"}`} · ${!state.ready && !state.captured ? "Fit correction and opposite-eye cover where required; align target and lens." : state.report}`;
  const ready = live && state.captured;
  useEffect(() => { onMirror?.({ title: LIBRARY_TITLES[kind], findingPosition: { current: eyeIndex.current + 1, total: accommodationEyes(kind).length }, status, ready, entryReady: ready, fields, actions, lesson, reset, record, cancel, reportLines: state.history }); }, [onMirror, status, ready, state, lesson.mode, lesson.entries, lesson.recorded, lesson.feedback]);
  return <>
    <XRClinicRuntimeView runtime={runtime} active={live} preview={preview} title={LIBRARY_TITLES[kind].toUpperCase()} instrumentSettings={{ "trial-lens": { power: state.power }, "lens-flipper": { side: state.side } }} />
    {(live || preview) && <><LibraryEquipmentTray active={live} equipment={runtime.equipment} />{kind !== "push-up" && <LibraryNearStand />}</>}
    {live && state.ready && <XRSign text={["FICTIONAL PATIENT · REPORTED RESPONSE", state.report]} p={[.55, 1.75, -.10]} size={[.55, .20]} bg="#07151b" fg="#eefbf7" />}
    <PracticeLessonUI runtime={runtime} active={live} title={LIBRARY_TITLES[kind]} status={status} tools={[libraryTool(kind)]} actions={actions} directActions={actions.slice(1)} fields={fields} lesson={lesson} ready={ready} entryReady={ready} onRecord={record} onReset={reset} onExit={onExit} onCancel={cancel}
      help={["Fit correction; fit cover over the opposite eye for OD or OS.", "OU requires both eyes uncovered. Establish near fixation.", kind === "push-up" ? "Begin at 40 cm and move the target inward to sustained blur." : "Release the near card on its stand at 40 cm; hold the lens before the eyes.", kind === "relative" ? "NRA blur → remove plus → confirm clear baseline → PRA blur." : kind === "accommodative-facility" ? "Flip only after clear; one plus/minus pair is a cycle." : "Mark sustained blur, then put tools down to record.", "Complete each eye in order; entries begin blank.", "Illustrative geometry and authored timing require clinician review."]} />
  </>;
}
