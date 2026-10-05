import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { maddoxTrials, maddoxRotationCorrect } from "../../interaction/maddoxPractice";
import { capturePhoria, phoriaSubmission, xrMaddoxReport, type PhoriaCapture } from "../../interaction/xrPhoriaPractice";
import { useXRClinicRuntime } from "../../interaction/useXRClinicRuntime";
import { isPatientFitted, sensoryTargetCondition, sensoryFittingSignature } from "../../interaction/xrSensoryEquipment";
import { LIBRARY_SURFACES, libraryEquipment, librarySockets, libraryRodFitted, libraryNear, libraryOpticPlacement, libraryLightThroughCard, LIBRARY_TITLES } from "../../interaction/xrLibraryEquipment";
import { LibraryEquipmentTray, LibraryNearStand } from "../../scene/LibraryClinicEquipment";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { XRSign } from "../../scene/XRClinicPanels";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonField } from "./PracticeLessonUI";
const initial = () => ({ fixation: false, angle: 90, base: "", power: 20, started: false });
export function PhoriaPracticeController({ kind, active, preview = false, onComplete, onExit, onMirror }: {
  kind: "maddox" | "thorington"; active: boolean; preview?: boolean; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const lesson = usePracticeLesson(onComplete), live = active && !preview;
  const trial = useRef(0), pattern = useRef(0), generation = useRef(0);
  const setup = useRef(initial()), capture = useRef<PhoriaCapture | null>(null), records = useRef<string[]>([]);
  const [state, publish] = useState({ setup: setup.current, trial: 0, pattern: 0, report: "", ready: false, distanceCm: 0, records: [] as string[], captured: false });
  const sync = (report = "", ready = false, distanceCm = 0) => publish({ setup: { ...setup.current }, trial: trial.current, pattern: pattern.current, report, ready, distanceCm, records: [...records.current], captured: Boolean(capture.current) });
  const clear = useCallback(() => { capture.current = null; lesson.clearPending(); }, [lesson.clearPending]);
  const runtime = useXRClinicRuntime({ active: live, equipment: libraryEquipment(kind), placementSockets: librarySockets(kind), placementSurfaces: LIBRARY_SURFACES, editorOpen: lesson.mode !== "none",
    onMenu: open => lesson.setMode(open ? "menu" : "none"), onInterrupt: reason => {
      if (capture.current) return;
      lesson.clearPending();
      // Menu entry is part of adjusting the prism. Physical interruptions must
      // invalidate a begun trial immediately, even before another pose sample.
      if (reason !== "panel") { setup.current.started = false; setup.current.power = 20; }
    } });
  const signature = () => sensoryFittingSignature(runtime.toolsRef.current, ["subjective", "maddox"]);
  const signatureRef = useRef("");
  const sample = () => {
    const tools = runtime.toolsRef.current;
    const fitted = isPatientFitted(tools, "subjective") && libraryRodFitted(tools);
    const axis = kind === "maddox" ? maddoxTrials[trial.current]?.axis : trial.current === 0 ? "horizontal" : "vertical";
    let ready = live && runtime.frameValid.current && fitted && Boolean(axis && maddoxRotationCorrect(axis, setup.current.angle)) && setup.current.fixation;
    let distanceCm = 0;
    if (kind === "maddox") {
      const pose = runtime.supportedWorkingPose("worth", true);
      const condition = pose && sensoryTargetCondition(pose, tools);
      distanceCm = condition?.distanceCm ?? 0;
      const prism = runtime.supportedWorkingPose("prism", true);
      ready = Boolean(ready && condition?.facing && condition.endpoint === maddoxTrials[trial.current]?.site && tools.worth.powered && libraryOpticPlacement(prism, "OD") && setup.current.base === maddoxTrials[trial.current]?.base);
    } else {
      const card = runtime.supportedWorkingPose("thorington", true), light = runtime.supportedWorkingPose("pupils", true);
      distanceCm = card ? Math.hypot(card.position[0], card.position[1] - 1.5, card.position[2] + .573) * 100 : 0;
      ready = Boolean(ready && libraryNear(card) && tools.pupils.powered && libraryLightThroughCard(card, light));
    }
    return { ready, distanceCm };
  };
  const clock = useRef(0);
  useFrame((_, dt) => {
    const key = signature();
    if (key !== signatureRef.current) { signatureRef.current = key; generation.current++; clear(); setup.current.started = false; }
    const spatial = sample();
    if (!spatial.ready && !capture.current && setup.current.started) { setup.current.started = false; setup.current.power = 20; lesson.clearPending(); }
    clock.current += dt;
    if (clock.current >= .1) { clock.current = 0; sync(capture.current?.report ?? (spatial.ready && kind === "maddox" && setup.current.started ? xrMaddoxReport(trial.current, setup.current.power) : ""), spatial.ready, spatial.distanceCm); }
  });
  const reset = useCallback(() => {
    generation.current++; trial.current = 0; setup.current = initial(); capture.current = null; records.current = [];
    lesson.reset(); runtime.resetClinic(); signatureRef.current = signature(); sync();
  }, [lesson.reset, runtime.resetClinic]);
  useEffect(() => { if (!live) reset(); }, [live, reset]);
  const change = (values: Partial<ReturnType<typeof initial>>) => {
    if (!live || lesson.awarded.current) return;
    generation.current++; clear();
    if ((values.angle !== undefined && values.angle !== setup.current.angle)
      || (values.fixation !== undefined && values.fixation !== setup.current.fixation)) {
      setup.current.started = false; setup.current.power = 20;
    }
    setup.current = { ...setup.current, ...values }; sync();
  };
  const inspect = () => {
    if (!live || capture.current || lesson.awarded.current) return;
    const spatial = sample();
    capture.current = capturePhoria({ kind, trial: trial.current, pattern: pattern.current, ...spatial, ...setup.current, generation: generation.current, setup: signature() });
    if (capture.current) { lesson.clearPending(); sync(capture.current.report, spatial.ready, spatial.distanceCm); }
  };
  const record = () => {
    const observed = capture.current;
    if (!live || !runtime.frameValid.current || !observed || observed.setup !== signature() || observed.generation !== generation.current || lesson.awarded.current) return;
    const correct = phoriaSubmission(observed, lesson.entriesRef.current.power ?? "", lesson.entriesRef.current.direction, kind);
    if (correct === null) return;
    if (!correct) { lesson.submit(true, false, "Read the captured patient report and enter your own measurement."); return; }
    const row = `${kind === "maddox" ? `${maddoxTrials[trial.current].site} ${maddoxTrials[trial.current].axis}` : trial.current ? "vertical" : "horizontal"}: ${lesson.entriesRef.current.power}Δ ${observed.direction} · ${Math.round(observed.distanceCm)} cm`;
    records.current = [...records.current, row];
    const done = records.current.length === (kind === "maddox" ? 4 : 2);
    if (done) { lesson.submit(true, true, "All phoria measurements independently recorded."); sync(observed.report); return; }
    trial.current++; generation.current++; clear(); setup.current = initial(); lesson.setMode("none"); sync();
  };
  const next = () => { if (live) { pattern.current++; reset(); } };
  const cancel = () => { if (!lesson.awarded.current) { clear(); sync(); } lesson.setMode("none"); };
  const actions = [
    { label: setup.current.fixation ? "FIXATION GIVEN ✓" : "FIXATE THE LIGHT", run: () => change({ fixation: true }) },
    { label: "HORIZONTAL GROOVES", run: () => change({ angle: 0 }), active: state.setup.angle === 0 },
    { label: "VERTICAL GROOVES", run: () => change({ angle: 90 }), active: state.setup.angle === 90 },
    ...(kind === "maddox" ? [
      { label: runtime.tools.worth.powered ? "SWITCH LIGHT OFF" : "SWITCH LIGHT ON", run: () => { if (!live) return; clear(); setup.current.started = false; setup.current.power = 20; runtime.setToolPower("worth", !runtime.toolsRef.current.worth.powered); sync(); } },
      ...["BI", "BU"].map(base => ({ label: `BASE ${base}`, run: () => change({ base, started: false, power: 20 }), active: state.setup.base === base })),
      { label: "INTRODUCE 20Δ / BEGIN", disabled: !state.ready || state.setup.started, run: () => { if (sample().ready) change({ power: 20, started: true }); } },
      ...[-1, 1].map(step => ({ label: `PRISM ${step > 0 ? "+" : "−"}1Δ`, disabled: !state.setup.started || !state.ready, run: () => { if (sample().ready && setup.current.started) change({ power: Math.max(0, Math.min(20, setup.current.power + step)) }); } })),
    ] : []),
    { label: kind === "maddox" ? "CAPTURE COINCIDENCE" : "ASK NUMBER / STREAK POSITION", disabled: !state.ready || state.captured, run: inspect },
    { label: "NEW PATIENT PATTERN", run: next },
  ];
  const fields: LessonField[] = [{ id: "power", label: "My measurement", choices: [], number: { min: 0, max: 20, unit: "Δ" } }, ...(kind === "thorington" ? [{ id: "direction", label: "Direction", choices: ["orthophoria", "esophoria", "exophoria", "left-hyperphoria", "right-hyperphoria"].map(value => [value, value] as const) }] : [])];
  const condition = kind === "maddox" ? maddoxTrials[state.trial] : { site: "near", axis: state.trial ? "vertical" : "horizontal" };
  const status = `${condition.site} · ${condition.axis} · ${Math.round(state.distanceCm)} cm · ${state.records.length}/${kind === "maddox" ? 4 : 2} records · ` + (state.captured ? state.report : !state.ready ? "Fit correction and OD rod, orient grooves, establish fixation and align target/light/instrument." : state.report || "Setup ready · elicit the report and capture the observation.");
  const ready = live && state.captured;
  useEffect(() => { onMirror?.({ title: LIBRARY_TITLES[kind], findingPosition: { current: state.trial + 1, total: kind === "maddox" ? 4 : 2 }, status, ready, entryReady: ready, reportLines: state.records, fields, actions, lesson, reset, record, next, cancel }); }, [onMirror, status, ready, state, lesson.mode, lesson.entries, lesson.feedback, lesson.recorded, runtime.tools]);
  return <>
    <XRClinicRuntimeView runtime={runtime} active={live} preview={preview} title={LIBRARY_TITLES[kind].toUpperCase()} instrumentSettings={{ maddox: { angle: state.setup.angle }, worth: { point: true }, prism: { power: state.setup.power, base: state.setup.base } }} />
    {(live || preview) && <><LibraryEquipmentTray active={live} equipment={runtime.equipment} />{kind === "thorington" && <LibraryNearStand card="thorington" />}</>}
    {live && state.report && <XRSign text={["FICTIONAL PATIENT · REPORTED PERCEPT", state.report, kind === "maddox" ? `${state.setup.power}Δ ${state.setup.base} · illustrative streak/light relation` : "Illustrative numbered-card report"]} p={[.55, 1.75, -.10]} size={[.55, .23]} bg="#07151b" fg="#eefbf7" />}
    <PracticeLessonUI runtime={runtime} active={live} title={LIBRARY_TITLES[kind]} status={status} tools={[kind === "maddox" ? "prism" : "thorington"]} actions={actions} fields={fields} lesson={lesson} ready={ready} entryReady={ready} onRecord={record} onReset={reset} onNext={next} onExit={onExit} onCancel={cancel}
      help={["Fit correction and seat the Maddox rod before OD.", "Horizontal grooves: horizontal measurement; vertical: vertical.", kind === "maddox" ? "Dock the point target for 6 m; move it to 40 cm for near." : "Present the card at 40 cm; aim the lit penlight through its hole.", kind === "maddox" ? "Prism before OD: introduce 20Δ, then reduce to coincidence." : "Ask which number and side the streak crosses.", "Capture the observation; put tools down and enter your measurement.", "All optics and responses remain illustrative drafts."]} />
  </>;
}
