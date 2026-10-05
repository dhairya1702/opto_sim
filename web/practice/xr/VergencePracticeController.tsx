import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { facilityDuration, facilityRemaining } from "../../interaction/accommodativeFacility";
import { vergenceFindings, vergenceFacilityDelay, npcGaze, prismVergenceGaze, facilityVergenceGaze } from "../../interaction/vergencePractice";
import { LIBRARY_SURFACES, libraryEquipment, librarySockets, libraryTool, libraryNear, libraryOpticPlacement, libraryDistance, librarySetupKey, LIBRARY_TITLES } from "../../interaction/xrLibraryEquipment";
import { isPatientFitted } from "../../interaction/xrSensoryEquipment";
import { freezeVergenceCapture, markNPCEndpoint, markVergenceEndpoint, newNPCRun, newVergenceRun, newVergenceFacility, flipVergenceFacility, npcPhases, npcPatientReport, vergencePatientReport, vergenceBases, numericCaptureSubmission, type NPCRun, type VergenceRun, type VergenceCapture, type TimedFacility, type PrismVergenceKind } from "../../interaction/xrVergencePractice";
import { useXRClinicRuntime } from "../../interaction/useXRClinicRuntime";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { LibraryEquipmentTray, LibraryNearStand } from "../../scene/LibraryClinicEquipment";
import { XRSign } from "../../scene/XRClinicPanels";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonField } from "./PracticeLessonUI";
import { useClinicEyeMotion } from "./useClinicEyeMotion";
type Kind = PrismVergenceKind | "npc" | "facility";
export function VergencePracticeController({ kind, active, preview = false, onComplete, onExit, onMirror }: {
  kind: Kind; active: boolean; preview?: boolean; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const live = active && !preview, lesson = usePracticeLesson(onComplete), eyes = useClinicEyeMotion(live);
  const isPrism = kind !== "npc" && kind !== "facility", near = kind !== "horizontal-distance" && kind !== "vertical-distance";
  const setup = useRef({ fixation: false, base: "", power: 0 }), baseIndex = useRef(0), generation = useRef(0);
  const npc = useRef<NPCRun>(newNPCRun()), run = useRef<VergenceRun>(newVergenceRun()), timed = useRef<TimedFacility | null>(null);
  const capture = useRef<VergenceCapture | null>(null), history = useRef<string[]>([]), key = useRef("");
  const [state, setState] = useState({ settings: setup.current, ready: false, distance: 0, report: "", phase: "", captured: false, seconds: 60, cycles: 0, side: "BO", history: [] as string[] });
  const clearRun = useCallback(() => { if (capture.current) return; npc.current = newNPCRun(); run.current = newVergenceRun(); timed.current = null; lesson.clearPending(); }, [lesson.clearPending]);
  const runtime = useXRClinicRuntime({ active: live, equipment: libraryEquipment(kind), placementSockets: librarySockets(kind), placementSurfaces: LIBRARY_SURFACES, editorOpen: lesson.mode !== "none",
    onMenu: open => lesson.setMode(open ? "menu" : "none"), onInterrupt: reason => { if (["visibility", "transfer", "tracking", "procedure"].includes(reason)) clearRun(); },
    onToolUsed: (id, action) => { if (id === "prism-flipper" && action === "activate") flip(); } });
  const signature = () => librarySetupKey(runtime.toolsRef.current, kind);
  const sample = () => {
    const target = runtime.supportedWorkingPose(kind === "npc" ? "fixation" : "near", true);
    const distance = libraryDistance(target, kind === "npc");
    const optic = runtime.supportedWorkingPose(libraryTool(kind), true);
    const ready = live && runtime.frameValid.current && isPatientFitted(runtime.toolsRef.current, "subjective") && setup.current.fixation
      && (kind === "npc" ? distance.ready && distance.distanceCm >= 2 && distance.distanceCm <= 42 : (!near || libraryNear(target)) && libraryOpticPlacement(optic, kind === "facility" ? "OU" : "OD"));
    return { ready, distance: kind === "npc" ? distance.distanceCm : near ? libraryDistance(target).distanceCm : 600 };
  };
  const publish = (spatial = sample()) => {
    const current = timed.current, now = performance.now();
    const report = capture.current ? capture.current.reports.join(" ") : kind === "npc" ? npcPatientReport(npc.current, spatial.distance) : kind === "facility" ? !current ? "Start the timed run with clear near fixation." : now - current.presented >= vergenceFacilityDelay[current.side as "BO" | "BI"] ? "Clear and single · flip." : "Patient is clearing the demand…" : vergencePatientReport(kind, setup.current.base, setup.current.power, run.current);
    const next = { settings: { ...setup.current }, ready: spatial.ready, distance: spatial.distance, report, captured: Boolean(capture.current),
      phase: kind === "npc" ? npcPhases[npc.current.index] ?? "completed" : isPrism ? run.current.phase : "60-second timed run",
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
      if (kind === "npc" && !npc.current.initialized && Math.abs(spatial.distance - 40) <= 2) npc.current = { ...npc.current, initialized: true };
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
      const gaze = kind === "npc" ? npcGaze(spatial.distance, npcPhases[npc.current.index] ?? "complete") : kind === "facility" ? facilityVergenceGaze(timed.current?.side ?? "BO") : prismVergenceGaze(setup.current.power, setup.current.base, near, kind === "vertical-distance", Boolean(broken));
      eye.position.set(gaze[id].x * .012 / .035, gaze[id].y * .012 / .035, 0);
    });
    clock.current += dt;
    if (clock.current >= .1) { clock.current = 0; publish(spatial); }
  });
  const reset = useCallback(() => {
    generation.current++; capture.current = null; npc.current = newNPCRun(); run.current = newVergenceRun(); timed.current = null; history.current = []; baseIndex.current = 0; setup.current = { fixation: false, base: "", power: 0 };
    lesson.reset(); runtime.resetClinic(); key.current = signature(); eyes.forEach(eye => eye.position.set(0, 0, 0)); publish();
  }, [lesson.reset, runtime.resetClinic, eyes]);
  useEffect(() => { if (!live) reset(); }, [live, reset]);
  const change = (values: Partial<typeof setup.current>) => {
    if (!live || lesson.awarded.current || timed.current) return;
    if (capture.current) { capture.current = null; clearRun(); }
    lesson.clearPending(); setup.current = { ...setup.current, ...values }; publish();
  };
  const mark = () => {
    if (!live || capture.current || lesson.awarded.current) return;
    const spatial = sample();
    if (kind === "npc") {
      npc.current = markNPCEndpoint(npc.current, spatial.distance, spatial.ready);
      if (npc.current.values.length === 4) capture.current = freezeVergenceCapture(generation.current, signature(), "NPC", Object.fromEntries(npcPhases.map((phase, i) => [phase, Math.round(npc.current.values[i] * 10) / 10])), spatial.distance, npcPhases.map((phase, i) => `${phase}: ${npc.current.values[i].toFixed(1)} cm`));
    } else if (isPrism) {
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
    const correct = numericCaptureSubmission(observed.values, lesson.entriesRef.current, kind === "npc" ? .051 : .005);
    if (correct === null) return;
    if (!correct) { lesson.submit(true, false, "Use your captured endpoints or full-cycle count; entries are independent of the simulation."); return; }
    history.current = [...history.current, `${observed.label}: ${Object.entries(lesson.entriesRef.current).map(([label, value]) => `${label} ${value}`).join(" · ")}`];
    if (!isPrism || baseIndex.current === 1) { lesson.submit(true, true, "All required vergence observations recorded."); publish(); return; }
    baseIndex.current++; generation.current++; capture.current = null; clearRun(); setup.current = { ...setup.current, base: "", power: 0 }; lesson.setMode("none"); publish();
  };
  const fields: LessonField[] = kind === "npc" ? npcPhases.map(id => ({ id, label: id.replaceAll("-", " "), choices: [], number: { min: 0, max: 42, unit: " cm", step: .1 } })) : kind === "facility" ? [{ id: "cycles", label: "Full cycles in 60 seconds", choices: [], number: { min: 0, max: 100, unit: " cpm" } }] : ([...(vergenceFindings[kind][setup.current.base]?.blur != null ? ["blur"] : []), "break", "recovery"]).map(id => ({ id, label: id, choices: [], number: { min: 0, max: 30, unit: "Δ" } }));
  const actions = [
    { label: "ESTABLISH FIXATION", run: () => change({ fixation: true }) },
    ...(isPrism ? vergenceBases(kind).map(base => ({ label: `BASE ${base}`, disabled: base !== vergenceBases(kind)[baseIndex.current], active: state.settings.base === base, run: () => { if (base === vergenceBases(kind)[baseIndex.current]) { clearRun(); change({ base, power: 0 }); } } })) : []),
    ...(isPrism ? [-1, 1].map(step => ({ label: `PRISM ${step > 0 ? "+" : "−"}1Δ`, disabled: !state.ready || !state.settings.base || state.captured, run: () => { if (sample().ready) change({ power: Math.max(0, Math.min(30, setup.current.power + step)) }); } })) : []),
    ...(kind === "facility" ? [{ label: "START 60-SECOND RUN", disabled: !state.ready || Boolean(timed.current || capture.current), run: start }, { label: "CLEAR + SINGLE / FLIP", disabled: !state.ready || !timed.current || capture.current !== null || performance.now() - (timed.current?.presented ?? Infinity) < vergenceFacilityDelay[(timed.current?.side ?? "BO") as "BO" | "BI"], run: flip }] : [{ label: "MARK PATIENT ENDPOINT", disabled: !state.ready || state.captured, run: mark }]),
    { label: "RESTART CURRENT RUN", run: () => { if (!live || lesson.awarded.current) return; capture.current = null; clearRun(); setup.current.power = 0; publish(); } },
  ];
  const status = `${state.history.length}/${isPrism ? 2 : 1} records · ${kind === "facility" ? `${state.seconds}s · ${state.cycles} cycles · ${state.side}` : kind === "npc" ? `${state.distance.toFixed(1)} cm from spectacle plane · ${state.phase}` : `${state.settings.power}Δ ${state.settings.base || "choose base"} · ${state.phase}`} · ` + (!state.ready && !state.captured ? "Fit correction, establish fixation and physically align target/instrument." : state.report);
  const ready = live && state.captured;
  useEffect(() => { onMirror?.({ title: LIBRARY_TITLES[kind], findingPosition: { current: baseIndex.current + 1, total: isPrism ? 2 : 1 }, status, ready, entryReady: ready, fields, actions, lesson, reset, record, cancel, reportLines: state.history }); }, [onMirror, status, ready, state, lesson.mode, lesson.entries, lesson.recorded, lesson.feedback]);
  return <>
    <XRClinicRuntimeView runtime={runtime} active={live} preview={preview} title={LIBRARY_TITLES[kind].toUpperCase()} sensoryStation={!near ? "four-prism" : undefined} instrumentSettings={{ "prism-flipper": { side: state.side }, prism: { power: state.settings.power, base: state.settings.base } }} />
    {(live || preview) && <><LibraryEquipmentTray active={live} equipment={runtime.equipment} />{near && kind !== "npc" && <LibraryNearStand />}</>}
    {live && state.ready && <XRSign text={["FICTIONAL PATIENT · REPORTED RESPONSE", state.report]} p={[.55, 1.75, -.10]} size={[.55, .20]} bg="#07151b" fg="#eefbf7" />}
    <PracticeLessonUI runtime={runtime} active={live} title={LIBRARY_TITLES[kind]} status={status} tools={[libraryTool(kind)]} actions={actions} directActions={actions.filter(action => action.label.startsWith("PRISM") || action.label === "MARK PATIENT ENDPOINT" || action.label === "CLEAR + SINGLE / FLIP")} fields={fields} lesson={lesson} ready={ready} entryReady={ready} onRecord={record} onReset={reset} onExit={onExit} onCancel={cancel}
      help={["Fit correction; establish the appropriate fixation target.", kind === "npc" ? "Begin at 40 cm; move inward for both breaks, then outward for recoveries." : near ? "Keep the near target at 40 cm; use its stand to free a hand." : "Fixate the illustrative mirrored distance letter.", kind === "facility" ? "Hold the flipper before both eyes; trigger or button flips after clear." : isPrism ? "BI before BO, or BU before BD. Mark blur/break, then reduce to recovery." : "Mark subjective and objective endpoints in order.", "Capture the run, then put tools down and enter your findings.", "Physical geometry and eye motion are illustrative drafts."]} />
  </>;
}
