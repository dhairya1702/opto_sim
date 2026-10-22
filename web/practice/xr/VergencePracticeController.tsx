import { usePracticeVoiceProcedure } from "../../voice/usePracticeVoiceProcedure";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { facilityDuration, facilityRemaining } from "../../interaction/accommodativeFacility";
import { vergenceFindings, vergenceFacilityDelay, prismVergenceGaze, facilityVergenceGaze } from "../../interaction/vergencePractice";
import { LIBRARY_SURFACES, libraryEquipment, librarySockets, libraryTool, libraryNear, libraryOpticPlacement, libraryDistance, librarySetupKey, LIBRARY_TITLES } from "../../interaction/xrLibraryEquipment";
import { isPatientFitted } from "../../interaction/xrSensoryEquipment";
import { freezeVergenceCapture, markVergenceEndpoint, newVergenceRun, newVergenceFacility, flipVergenceFacility, vergencePatientReport, vergenceBases, numericCaptureSubmission, type VergenceRun, type VergenceCapture, type TimedFacility, type PrismVergenceKind } from "../../interaction/xrVergencePractice";
import { useXRClinicRuntime, type ClinicInputMode } from "../../interaction/useXRClinicRuntime";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { LibraryEquipmentTray, LibraryNearStand } from "../../scene/LibraryClinicEquipment";
import { XRSign } from "../../scene/XRClinicPanels";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonField } from "./PracticeLessonUI";
import { useClinicEyeMotion } from "./useClinicEyeMotion";
type Kind = "facility";
export function VergencePracticeController({ kind, active, preview = false, inputMode = "xr", onComplete, onExit, onMirror }: {
  kind: Kind; active: boolean; preview?: boolean; inputMode?: ClinicInputMode; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const live = active && !preview, lesson = usePracticeLesson(onComplete), eyes = useClinicEyeMotion(live);
  const isPrism = kind !== "facility", near = true;
  const setup = useRef({ fixation: false, base: "", power: 0 }), baseIndex = useRef(0), generation = useRef(0);
  const run = useRef<VergenceRun>(newVergenceRun()), timed = useRef<TimedFacility | null>(null);
  const capture = useRef<VergenceCapture | null>(null), history = useRef<string[]>([]), key = useRef("");
  const [state, setState] = useState({ settings: setup.current, ready: false, distance: 0, report: "", phase: "", captured: false, seconds: 60, cycles: 0, side: "BO", history: [] as string[] });
  const clearRun = useCallback(() => { if (capture.current) return; run.current = newVergenceRun(); timed.current = null; lesson.clearPending(); }, [lesson.clearPending]);
  const runtime = useXRClinicRuntime({ active: live, inputMode, equipment: libraryEquipment(kind), placementSockets: librarySockets(kind), placementSurfaces: LIBRARY_SURFACES, editorOpen: lesson.mode !== "none",
    onMenu: open => lesson.setMode(open ? "menu" : "none"), onInterrupt: reason => { if (["visibility", "transfer", "tracking", "procedure"].includes(reason)) clearRun(); },
    onToolUsed: (id, action) => { if (inputMode === "desktop" && id === "prism-flipper" && action === "activate") flip(); } });
  const signature = () => librarySetupKey(runtime.toolsRef.current, kind);
  const sample = () => {
    const target = runtime.supportedWorkingPose("near", true);
    const distance = libraryDistance(target);
    const optic = runtime.supportedWorkingPose(libraryTool(kind), true);
    const ready = live && runtime.frameValid.current && isPatientFitted(runtime.toolsRef.current, "subjective") && setup.current.fixation
      && (!near || libraryNear(target)) && libraryOpticPlacement(optic, kind === "facility" ? "OU" : "OD");
    return { ready, distance: near ? libraryDistance(target).distanceCm : 600 };
  };
  const publish = (spatial = sample()) => {
    const current = timed.current, now = performance.now();
    const report = capture.current ? capture.current.reports.join(" ") : kind === "facility" ? !current ? "Start the timed run with clear near fixation."
      : now - current.presented >= vergenceFacilityDelay[current.side] ? "Clear and single · turn the flipper with your free hand."
        : current.lastFlip === "premature" ? "Flipped too soon; the patient was still double. That side was not credited."
          : current.lastFlip === "unpaired" ? "The preceding BO side was not cleared, so this pair was not counted."
            : "Patient is clearing the demand…" : vergencePatientReport(kind, setup.current.base, setup.current.power, run.current);
    const next = { settings: { ...setup.current }, ready: spatial.ready, distance: spatial.distance, report, captured: Boolean(capture.current),
      phase: isPrism ? run.current.phase : "60-second timed run",
      seconds: current ? facilityRemaining(current.start, now) : capture.current ? 0 : 60, cycles: current?.cycles ?? capture.current?.values.cycles ?? 0, side: current?.side ?? "BO", history: [...history.current] };
    setState(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
  };
  const clock = useRef(0);
  useFrame((_, dt) => {
    const signatureKey = signature();
    if (key.current !== signatureKey) { key.current = signatureKey; generation.current++; capture.current = null; clearRun(); }
    const spatial = sample();
    if (!spatial.ready && !capture.current) clearRun();
    if (spatial.ready && !capture.current) {
      if (isPrism && setup.current.base === vergenceBases(kind)[baseIndex.current] && setup.current.power === 0) run.current.initialized = true;
      const current = timed.current;
      if (kind === "facility" && current && performance.now() - current.start >= facilityDuration) {
        capture.current = freezeVergenceCapture(generation.current, signatureKey, "Near vergence facility", { cycles: current.cycles }, spatial.distance, [`60-second run · ${current.cycles} full 12Δ BO / 3Δ BI pairs.`]);
      }
    }
    eyes.forEach((eye, id) => {
      if (!spatial.ready || capture.current) { eye.position.set(0, 0, 0); return; }
      const finding = isPrism ? vergenceFindings[kind][setup.current.base] : undefined;
      const broken = finding && (run.current.phase === "recovery" ? setup.current.power > finding.recovery : setup.current.power >= finding.break);
      const gaze = kind === "facility" ? facilityVergenceGaze(timed.current?.side ?? "BO") : prismVergenceGaze(setup.current.power, setup.current.base, near, false, Boolean(broken));
      eye.position.set(gaze[id].x * .012 / .035, gaze[id].y * .012 / .035, 0);
    });
    clock.current += dt;
    if (clock.current >= .1) { clock.current = 0; publish(spatial); }
  });
  const reset = useCallback(() => {
    generation.current++; capture.current = null; run.current = newVergenceRun(); timed.current = null; history.current = []; baseIndex.current = 0; setup.current = { fixation: false, base: "", power: 0 };
    lesson.reset(); runtime.resetClinic(); key.current = signature(); eyes.forEach(eye => eye.position.set(0, 0, 0)); publish();
  }, [lesson.reset, runtime.resetClinic, eyes]);
  useEffect(() => { if (!live) reset(); }, [live, reset]);
  const change = (values: Partial<typeof setup.current>) => {
    if (!live || lesson.awarded.current || timed.current) return;
    if (capture.current) { capture.current = null; clearRun(); }
    lesson.clearPending(); setup.current = { ...setup.current, ...values }; publish();
  };
  const fitCorrection = () => {
    if (!live || isPatientFitted(runtime.toolsRef.current, "subjective")) return;
    const socket = librarySockets(kind).find(candidate => candidate.tool === "subjective" && candidate.id === "sensory-correction");
    if (!socket) return;
    const tool = runtime.toolsRef.current.subjective;
    runtime.updateTools({ ...runtime.toolsRef.current, subjective: { ...tool,
      placement: { kind: "socket", position: socket.position, rotation: socket.rotation, socketId: socket.id, fittingLayer: socket.fittingLayer },
      revision: (tool.revision ?? 0) + 1 } });
  };
  const mark = () => {
    if (!live || capture.current || lesson.awarded.current) return;
    const spatial = sample();
    if (isPrism) {
      run.current = markVergenceEndpoint(kind, setup.current.base, setup.current.power, run.current, spatial.ready);
      if (run.current.complete) capture.current = freezeVergenceCapture(generation.current, signature(), setup.current.base, run.current.values as Record<string, number>, spatial.distance, [`${setup.current.base}: blur ${run.current.values.blur ?? "X"}, break ${run.current.values.break}, recovery ${run.current.values.recovery}Δ.`]);
    }
    publish(spatial);
  };
  const start = () => { if (live && kind === "facility" && sample().ready && !timed.current && !capture.current && !lesson.awarded.current) { timed.current = newVergenceFacility(performance.now()); publish(); } };
  function flip() {
    if (!live || kind !== "facility" || !timed.current || capture.current) return;
    timed.current = flipVergenceFacility(timed.current, performance.now(), sample().ready); publish();
  }
  const cancel = () => { if (!lesson.awarded.current) { capture.current = null; clearRun(); publish(); } lesson.setMode("none"); };
  const record = () => {
    const observed = capture.current;
    if (!live || !runtime.frameValid.current || !observed || observed.setup !== signature() || lesson.awarded.current) return;
    const correct = numericCaptureSubmission(observed.values, lesson.entriesRef.current, .005);
    if (correct === null) return;
    if (!correct) { lesson.submit(true, false, "Use your captured endpoints or full-cycle count; entries are independent of the simulation."); return; }
    history.current = [...history.current, `${observed.label}: ${Object.entries(lesson.entriesRef.current).map(([label, value]) => `${label} ${value}`).join(" · ")}`];
    if (!isPrism || baseIndex.current === 1) { lesson.submit(true, true, "All required vergence observations recorded."); publish(); return; }
    baseIndex.current++; generation.current++; capture.current = null; clearRun(); setup.current = { ...setup.current, base: "", power: 0 }; lesson.setMode("none"); publish();
  };
  const fields: LessonField[] = kind === "facility" ? [{ id: "cycles", label: "Full cycles in 60 seconds", choices: [], number: { min: 0, max: 100, unit: " cpm" } }] : ([...(vergenceFindings[kind][setup.current.base]?.blur != null ? ["blur"] : []), "break", "recovery"]).map(id => ({ id, label: id, choices: [], number: { min: 0, max: 30, unit: "Δ" } }));
  const actions = [
    { label: "FIT NEAR CORRECTION", run: fitCorrection, active: isPatientFitted(runtime.toolsRef.current, "subjective") },
    { voiceIds: ["fixate-target"], label: "ESTABLISH FIXATION", run: () => change({ fixation: true }) },
    ...(isPrism ? vergenceBases(kind).map(base => ({ label: `BASE ${base}`, disabled: base !== vergenceBases(kind)[baseIndex.current], active: state.settings.base === base, run: () => { if (base === vergenceBases(kind)[baseIndex.current]) { clearRun(); change({ base, power: 0 }); } } })) : []),
    ...(isPrism ? [-1, 1].map(step => ({ label: `PRISM ${step > 0 ? "+" : "−"}1Δ`, disabled: !state.ready || !state.settings.base || state.captured, run: () => { if (sample().ready) change({ power: Math.max(0, Math.min(30, setup.current.power + step)) }); } })) : []),
    ...(kind === "facility" ? [{ label: "START 60-SECOND RUN", disabled: !state.ready || Boolean(timed.current || capture.current), run: start }] : [{ label: "MARK PATIENT ENDPOINT", disabled: !state.ready || state.captured, run: mark }]),
    { label: "RESTART CURRENT RUN", run: () => { if (!live || lesson.awarded.current) return; capture.current = null; clearRun(); setup.current.power = 0; publish(); } },
  ];
  const status = `${state.history.length}/${isPrism ? 2 : 1} records · ${kind === "facility" ? `${state.seconds}s · ${state.cycles} cycles · ${state.side}` : `${state.settings.power}Δ ${state.settings.base || "choose base"} · ${state.phase}`} · ` + (!state.ready && !state.captured ? "Fit correction, establish fixation and physically align target/instrument." : state.report);
  const ready = live && state.captured;
  usePracticeVoiceProcedure(kind, active && !preview, { actions, voiceReport: state.ready && timed.current && !capture.current ? (performance.now() - timed.current.presented >= vergenceFacilityDelay[timed.current.side] ? "It is clear and single now." : "It is not clear and single yet.") : undefined });
  useEffect(() => { onMirror?.({ title: LIBRARY_TITLES[kind], findingPosition: { current: baseIndex.current + 1, total: isPrism ? 2 : 1 }, status, ready, entryReady: ready, fields, actions, lesson, reset, record, cancel, reportLines: state.history }); }, [onMirror, status, ready, state, lesson.mode, lesson.entries, lesson.recorded, lesson.feedback]);
  return <>
    <XRClinicRuntimeView cleanHands runtime={runtime} active={live} preview={preview} title={LIBRARY_TITLES[kind].toUpperCase()} sensoryStation={!near ? "four-prism" : undefined} instrumentSettings={{ "prism-flipper": {
      side: state.side, onFlip: runtime.tools["prism-flipper"].placement.kind === "held" ? flip : undefined,
    }, prism: { power: state.settings.power, base: state.settings.base } }} />
    {(live || preview) && <><LibraryEquipmentTray active={live} equipment={runtime.equipment} />{near && <LibraryNearStand />}</>}
    {live && state.ready && <XRSign text={["FICTIONAL PATIENT · REPORTED RESPONSE", state.report]} p={[.55, 1.75, -.10]} size={[.55, .20]} bg="#07151b" fg="#eefbf7" />}
    <PracticeLessonUI runtime={runtime} active={live} title={LIBRARY_TITLES[kind]} status={status} tools={[libraryTool(kind)]} actions={actions} directActions={actions.filter(action => action.label.startsWith("PRISM") || action.label === "MARK PATIENT ENDPOINT")} fields={fields} lesson={lesson} ready={ready} entryReady={ready} onRecord={record} onReset={reset} onExit={onExit} onCancel={cancel}
      help={["Fit correction; establish the appropriate fixation target.", near ? "Keep the near target at 40 cm; use its stand to free a hand." : "Fixate the illustrative mirrored distance letter.", kind === "facility" ? "Keep the flipper before both eyes. Bring your free controller beside TURN and press/release its trigger after the patient clears each side." : "BI before BO, or BU before BD. Mark blur/break, then reduce to recovery.", "Capture the run, then put tools down and enter your findings.", "Physical geometry and eye motion are illustrative drafts."]} />
  </>;
}
