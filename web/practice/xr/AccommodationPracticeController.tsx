import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { facilityDuration, facilityRemaining, facilityClearDelay } from "../../interaction/accommodativeFacility";
import { accommodationEyes, newAccommodationFacility, flipAccommodationFacility, type AccommodationKind, type AccommodationTimedRun } from "../../interaction/xrAccommodationPractice";
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
  const eyeIndex = useRef(0), setup = useRef({ fixation: false });
  const timed = useRef<AccommodationTimedRun | null>(null), capture = useRef<VergenceCapture | null>(null), history = useRef<string[]>([]), generation = useRef(0), key = useRef("");
  const eye = () => accommodationEyes(kind)[eyeIndex.current];
  const [state, setState] = useState({ eye: eye(), distance: 0, ready: false, captured: false, report: "", side: "plus", cycles: 0, seconds: 60, history: [] as string[] });
  const clearRun = useCallback(() => { if (capture.current) return; timed.current = null; lesson.clearPending(); }, [lesson.clearPending]);
  const runtime = useXRClinicRuntime({ active: live, equipment: libraryEquipment(kind), placementSockets: librarySockets(kind), placementSurfaces: LIBRARY_SURFACES, editorOpen: lesson.mode !== "none",
    onMenu: open => lesson.setMode(open ? "menu" : "none"), onInterrupt: reason => { if (["visibility", "transfer", "tracking", "procedure"].includes(reason)) clearRun(); },
    onToolUsed: (id, action) => { if (id === "lens-flipper" && action === "activate") flip(); } });
  const signature = () => { const cover = runtime.toolsRef.current.cover; return `${librarySetupKey(runtime.toolsRef.current, kind)}:${cover.revision}:${cover.placement.kind === "held" ? cover.placement.hand : cover.placement.socketId ?? "free"}`; };
  const sample = () => {
    const target = runtime.supportedWorkingPose("near", true), distance = libraryDistance(target);
    const optic = runtime.supportedWorkingPose(libraryTool(kind), true);
    return { distance: distance.distanceCm, ready: live && runtime.frameValid.current && isPatientFitted(runtime.toolsRef.current, "subjective") && setup.current.fixation
      && libraryOcclusion(runtime.toolsRef.current, eye())
      && libraryNear(target) && libraryOpticPlacement(optic, eye(), true) };
  };
  const publish = (spatial = sample()) => {
    const current = timed.current, now = performance.now();
    const report = capture.current ? capture.current.reports.join(" ") : !current ? "Start with the plus side at clear near fixation." : now - current.presented >= facilityClearDelay[current.side] ? "Clear; flip now." : "Patient is clearing the lens…";
    const next = { eye: eye(), distance: spatial.distance, ready: spatial.ready, captured: Boolean(capture.current), report,
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
      const current = timed.current;
      if (current && performance.now() - current.start >= facilityDuration) capture.current = freezeVergenceCapture(generation.current, nextKey, eye(), { cycles: current.cycles }, spatial.distance, [`${eye()} · ${current.cycles} full ±2.00 D pairs in 60 seconds.`]);
    }
    clock.current += dt; if (clock.current >= .1) { clock.current = 0; publish(spatial); }
  });
  const reset = useCallback(() => {
    generation.current++; capture.current = null; eyeIndex.current = 0; history.current = []; setup.current = { fixation: false }; clearRun(); lesson.reset(); runtime.resetClinic(); key.current = signature(); publish();
  }, [clearRun, lesson.reset, runtime.resetClinic]);
  useEffect(() => { if (!live) reset(); }, [live, reset]);
  const start = () => { if (live && sample().ready && !timed.current && !capture.current && !lesson.awarded.current) { timed.current = newAccommodationFacility(performance.now()); publish(); } };
  function flip() { if (!live || !timed.current || capture.current) return; timed.current = flipAccommodationFacility(timed.current, performance.now(), sample().ready); publish(); }
  const cancel = () => { if (!lesson.awarded.current) { capture.current = null; clearRun(); publish(); } lesson.setMode("none"); };
  const record = () => {
    const observed = capture.current;
    if (!live || !runtime.frameValid.current || !observed || observed.setup !== signature() || lesson.awarded.current) return;
    const correct = numericCaptureSubmission(observed.values, lesson.entriesRef.current, .011);
    if (correct === null) return;
    if (!correct) { lesson.submit(true, false, "Check the captured full-cycle count."); return; }
    history.current = [...history.current, `${observed.label}: ${Object.entries(lesson.entriesRef.current).map(([label, value]) => `${label} ${value}`).join(" · ")}`];
    if (eyeIndex.current === accommodationEyes(kind).length - 1) { lesson.submit(true, true, "All required accommodation observations recorded."); publish(); return; }
    eyeIndex.current++; generation.current++; capture.current = null; clearRun(); lesson.setMode("none"); publish();
  };
  const field = (id: string, label: string, min: number, max: number, unit: string, step: number): LessonField => ({ id, label, choices: [], number: { min, max, unit, step } });
  const fields = [field("cycles", "Full plus/minus pairs in 60 seconds", 0, 100, " cpm", 1)];
  const actions = [
    { label: "ESTABLISH FIXATION", run: () => { if (!live || lesson.awarded.current) return; setup.current.fixation = true; publish(); } },
    { label: "START 60-SECOND RUN", disabled: !state.ready || Boolean(timed.current || capture.current), run: start },
    { label: "CLEAR / FLIP ±2 D", disabled: !state.ready || !timed.current || state.captured || performance.now() - (timed.current?.presented ?? Infinity) < facilityClearDelay[timed.current?.side ?? "plus"], run: flip },
    { label: "RESTART CURRENT RUN", run: () => { if (!live || lesson.awarded.current) return; capture.current = null; clearRun(); publish(); } },
  ];
  const status = `${state.history.length}/${accommodationEyes(kind).length} records · ${state.eye} · ${state.seconds}s · ${state.cycles} cycles · ${state.side} · ${!state.ready && !state.captured ? "Fit correction and opposite-eye cover; align target and flipper." : state.report}`;
  const ready = live && state.captured;
  useEffect(() => { onMirror?.({ title: LIBRARY_TITLES[kind], findingPosition: { current: eyeIndex.current + 1, total: accommodationEyes(kind).length }, status, ready, entryReady: ready, fields, actions, lesson, reset, record, cancel, reportLines: state.history }); }, [onMirror, status, ready, state, lesson.mode, lesson.entries, lesson.recorded, lesson.feedback]);
  return <>
    <XRClinicRuntimeView cleanHands runtime={runtime} active={live} preview={preview} title={LIBRARY_TITLES[kind].toUpperCase()} instrumentSettings={{ "lens-flipper": { side: state.side } }} />
    {(live || preview) && <><LibraryEquipmentTray active={live} equipment={runtime.equipment} /><LibraryNearStand /></>}
    {live && state.ready && <XRSign text={["FICTIONAL PATIENT · REPORTED RESPONSE", state.report]} p={[.55, 1.75, -.10]} size={[.55, .20]} bg="#07151b" fg="#eefbf7" />}
    <PracticeLessonUI runtime={runtime} active={live} title={LIBRARY_TITLES[kind]} status={status} tools={[libraryTool(kind)]} actions={actions} directActions={actions.slice(1)} fields={fields} lesson={lesson} ready={ready} entryReady={ready} onRecord={record} onReset={reset} onExit={onExit} onCancel={cancel}
      help={["Fit correction; fit cover over the opposite eye for OD or OS.", "OU requires both eyes uncovered. Establish near fixation.", "Release the near card on its stand at 40 cm; hold the flipper before the eyes.", "Flip only after clear; one plus/minus pair is a cycle.", "Complete each eye in order; entries begin blank.", "Illustrative geometry and authored timing require clinician review."]} />
  </>;
}
