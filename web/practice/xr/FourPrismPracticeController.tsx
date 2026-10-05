import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Quaternion, Vector3 } from "three";
import { useXRClinicRuntime } from "../../interaction/useXRClinicRuntime";
import { fourPrismResponse } from "../../interaction/sensory";
import type { PrismCase } from "../../interaction/fourPrism";
import { advanceFourPrismSequence, captureFourPrism, clinicFourPrismGaze, emptyFourPrismSequence, fourPrismSubmission, xrFourPrismView, type FourPrismCapture } from "../../interaction/xrFourPrismPractice";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonField } from "./PracticeLessonUI";
import { useClinicEyeMotion } from "./useClinicEyeMotion";
import { isPatientFitted, sensoryEquipment, sensorySockets, sensoryFittingSignature } from "../../interaction/xrSensoryEquipment";

const fields: LessonField[] = [{ id: "interpretation", label: "Bilateral response", choices: [["normal", "Normal response · no suppression"], ["suppression", "Central suppression of OS"]] }];
export function FourPrismPracticeController({ active, preview = false, onComplete, onExit, onMirror }: {
  active: boolean; preview?: boolean; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const { gl, camera } = useThree();
  const lesson = usePracticeLesson(onComplete);
  const [scenario, setScenario] = useState<PrismCase>("normal");
  const setup = useRef({ fixation: false, power: 0, base: "" });
  const [settings, setSettings] = useState(setup.current);
  const sequence = useRef(emptyFourPrismSequence());
  const capture = useRef<FourPrismCapture | null>(null);
  const attempt = useRef(0), revision = useRef(0), correctionKey = useRef("");
  const captureFitting = useRef("");
  const [readout, setReadout] = useState({ count: 0, dwell: 0, correction: false, view: false, captured: false, report: "" });
  const interrupt = useCallback(() => { if (!capture.current) sequence.current = { ...sequence.current, eye: null, dwellMs: 0 }; }, []);
  const runtime = useXRClinicRuntime({ active: active && !preview, editorOpen: lesson.mode !== "none", equipment: sensoryEquipment("four-prism"), placementSockets: sensorySockets("four-prism"),
    onInterrupt: interrupt, onMenu: open => lesson.setMode(open ? "menu" : "none") });
  const eyes = useClinicEyeMotion(active);
  const vectors = useMemo(() => ({ position: new Vector3(), forward: new Vector3(), rotation: new Quaternion() }), []);
  const clear = () => {
    capture.current = null; sequence.current = emptyFourPrismSequence(); lesson.clearPending();
    eyes.forEach(eye => eye.position.set(0, 0, 0));
  };
  const reset = useCallback(() => {
    attempt.current++; revision.current++; capture.current = null; sequence.current = emptyFourPrismSequence();
    setup.current = { fixation: false, power: 0, base: "" }; setSettings(setup.current); lesson.reset();
    correctionKey.current = ""; captureFitting.current = ""; runtime.resetClinic(); eyes.forEach(eye => eye.position.set(0, 0, 0));
    setReadout({ count: 0, dwell: 0, correction: false, view: false, captured: false, report: "" });
  }, [lesson.reset, runtime.resetClinic, eyes]);
  useEffect(() => { if (!active || preview) reset(); }, [active, preview, reset]);
  const clock = useRef(0);
  useFrame((_, dt) => {
    if (!active || preview) return;
    const correction = isPatientFitted(runtime.toolsRef.current, "subjective");
    const signature = sensoryFittingSignature(runtime.toolsRef.current, ["subjective"]);
    if (correctionKey.current !== signature) { revision.current++; clear(); }
    correctionKey.current = signature;
    const viewer = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    viewer.getWorldPosition(vectors.position); viewer.getWorldQuaternion(vectors.rotation);
    vectors.forward.set(0, 0, -1).applyQuaternion(vectors.rotation);
    const view = runtime.frameValid.current && lesson.mode === "none" && xrFourPrismView(vectors.position.toArray() as [number, number, number], vectors.forward.toArray() as [number, number, number]);
    const held = runtime.frameValid.current && runtime.workingPose("prism");
    const previous = sequence.current;
    if (!capture.current) {
      sequence.current = advanceFourPrismSequence(previous, { ...setup.current, correction, view, dtMs: dt * 1000,
        position: held ? runtime.origin.toArray() as [number, number, number] : null,
        forward: held ? runtime.direction.toArray() as [number, number, number] : [0, 0, -1] });
      capture.current = captureFourPrism(sequence.current, scenario, attempt.current, revision.current);
      if (capture.current) captureFitting.current = signature;
    }
    const current = sequence.current;
    const observedEye = current.observed.length > previous.observed.length ? current.observed.at(-1) : null;
    const motionEye = current.eye ?? observedEye;
    const gaze = motionEye ? clinicFourPrismGaze(motionEye, scenario, observedEye ? 2400 : current.dwellMs) : { od: 0, os: 0 };
    eyes.forEach((eye, id) => eye.position.set(id === "OD" ? gaze.od : gaze.os, 0, 0));
    clock.current += dt;
    if (clock.current >= .1 || observedEye) {
      clock.current = 0;
      setReadout(old => {
        const next = { count: current.observed.length, dwell: current.dwellMs, correction, view, captured: Boolean(capture.current),
          report: observedEye ? `${observedEye}: ${fourPrismResponse(scenario, observedEye)}` : old.report };
        return JSON.stringify(old) === JSON.stringify(next) ? old : next;
      });
    }
  });
  const configure = (next: typeof settings) => {
    if (!active || preview || lesson.awarded.current) return;
    if (JSON.stringify(next) === JSON.stringify(setup.current)) return;
    revision.current++; clear(); setup.current = next; setSettings(next);
  };
  const actions = [
    { label: settings.fixation ? "DISTANCE FIXATION ✓" : "FIXATE ISOLATED LETTER · SINGLE", disabled: !readout.correction, run: () => configure({ ...setup.current, fixation: true }), active: settings.fixation },
    { label: `BASE OUT · BO${settings.base === "BO" ? " ✓" : ""}`, run: () => configure({ ...setup.current, base: "BO" }), active: settings.base === "BO" },
    { label: `BASE IN · BI${settings.base === "BI" ? " ✓" : ""}`, run: () => configure({ ...setup.current, base: "BI" }), active: settings.base === "BI" },
    ...[-1, 1].map(step => ({ label: `PRISM ${step > 0 ? "+" : "−"}1Δ`, run: () => configure({ ...setup.current, power: Math.max(0, Math.min(10, setup.current.power + step)) }) })),
    { label: "CLEAR DISTANCE FIXATION", run: () => configure({ ...setup.current, fixation: false }) },
    { label: "NEW PATIENT PATTERN", run: () => next() },
  ];
  const ready = active && !preview && readout.captured;
  const status = `${settings.power}Δ ${settings.base || "base unselected"} · ${readout.count}/2 placements · ` + (!readout.correction ? "Fit best distance correction on the patient."
    : !settings.fixation ? "Establish isolated-letter distance fixation." : ready ? `Bilateral comparison captured · put prism down and enter your interpretation. ${capture.current?.reports.join(" ") ?? ""}`
    : readout.count === 1 && !sequence.current.withdrawn ? "OD observed · withdraw prism clear of both eyes before OS."
    : !readout.view ? "Centre your examiner view on both eyes; close the panel to observe."
    : `Hold the gold-ringed cell before ${readout.count ? "OS" : "OD"} for 2400 ms · ${Math.round(readout.dwell)} ms`) + (readout.report ? ` ${readout.report}` : "");
  const record = () => {
    if (!active || preview || !runtime.frameValid.current || !isPatientFitted(runtime.toolsRef.current, "subjective")
      || sensoryFittingSignature(runtime.toolsRef.current, ["subjective"]) !== captureFitting.current) return;
    const result = fourPrismSubmission(capture.current, lesson.entriesRef.current.interpretation ?? "");
    if (result === null) return;
    lesson.submit(true, result, result ? "Both-eye response correctly recorded." : "Compare the version and inward refixation from both placements.");
  };
  const cancel = () => { if (!lesson.awarded.current) { clear(); setReadout(old => ({ ...old, count: 0, captured: false, report: "" })); } lesson.setMode("none"); };
  const next = () => { if (!active || preview) return; reset(); setScenario(value => value === "normal" ? "suppression" : "normal"); };
  useEffect(() => { onMirror?.({ title: "4Δ base-out", reportLines: capture.current?.reports, findingPosition: { current: scenario === "normal" ? 1 : 2, total: 2 }, status, ready, entryReady: ready, fields, actions, lesson, reset, record, next, cancel }); },
    [onMirror, status, ready, lesson.mode, lesson.entries, lesson.recorded, lesson.feedback, settings, scenario]);
  return <>
    <XRClinicRuntimeView runtime={runtime} active={active && !preview} preview={preview} title="4Δ BASE-OUT · PRACTICE" sensoryStation="four-prism" />
    <PracticeLessonUI runtime={runtime} active={active && !preview} title="4Δ BASE-OUT" status={status} tools={["prism"]} actions={actions} directActions={actions.slice(1, 5)} fields={fields} lesson={lesson}
      ready={ready} entryReady={ready} onRecord={record} onReset={reset} onNext={next} onExit={onExit} onCancel={cancel}
      help={["Fit correction; establish isolated-letter distance fixation.", "Select exactly 4Δ BO. Working cell faces the patient.", "Watch OD first through version and refixation (2400 ms).", "Withdraw clear of both eyes, then observe OS.", "A/X pauses unfinished dwell; completed comparison survives release.", "Illustrative movements; no calibrated ocular physiology."]} />
  </>;
}
