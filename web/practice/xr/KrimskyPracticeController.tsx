import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from "three";
import { krimskyCases, krimskyEye, type KrimskyMethod } from "../../interaction/krimsky";
import { CLINIC_PATIENT_EYES } from "../../interaction/clinicPatient";
import { useXRClinicRuntime } from "../../interaction/useXRClinicRuntime";
import { advanceKrimskyBaselineDwell, KRIMSKY_BASELINE_DWELL_SECONDS, captureKrimskyComparison, clinicKrimskyReflex, krimskyComparisonSubmission, krimskyPrismCellY, stepKrimskyPrismPower, xrKrimskyTechnique, type ExaminerEye, type KrimskyComparison } from "../../interaction/xrKrimskyPractice";
import { createXRViewerScratch, xrExaminerPose, xrViewerPoses } from "../../interaction/xrViewer";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { XRHeadPanel, XRPanelButton, XRSign } from "../../scene/XRClinicPanels";
import { Box } from "../../scene/Models";
import { XRKrimskyMonocularView } from "../../scene/XRKrimskyMonocularView";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonAction, type LessonField } from "./PracticeLessonUI";

const fields: LessonField[] = [{ id: "power", label: "Neutralising power", choices: [], number: { min: 0, max: 40, unit: "Δ" } }];
const initialSetup = () => ({ method: "standard" as KrimskyMethod, fixation: false, examinerEye: null as ExaminerEye | null, base: "", power: 0 });
export function KrimskyPracticeController({ active, preview = false, onComplete, onExit, onMirror }: {
  active: boolean; preview?: boolean; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const { gl, camera } = useThree();
  const [index, setIndex] = useState(0);
  const finding = krimskyCases[index];
  const lesson = usePracticeLesson(onComplete);
  const [setup, setSetup] = useState(initialSetup);
  const setupRef = useRef(setup);
  const baselineRef = useRef(false), baselineDwell = useRef(0), wasViewing = useRef(false);
  const capturedRef = useRef<KrimskyComparison | null>(null);
  const [baseline, setBaseline] = useState(false), [baselineProgress, setBaselineProgress] = useState(0), [captured, setCaptured] = useState<KrimskyComparison | null>(null), [message, setMessage] = useState("");
  const clearPending = lesson.clearPending;
  const interrupt = useCallback(() => { if (!capturedRef.current) clearPending(); }, [clearPending]);
  const runtime = useXRClinicRuntime({ active: active && !preview, editorOpen: lesson.mode !== "none", onInterrupt: interrupt,
    onToolUsed: (id, action) => { if (id === "prism" && action === "activate") compare(); },
    onThumbstickStep: (id, step) => id === "prism" && stepPrism(step),
    onMenu: open => lesson.setMode(open ? "menu" : "none"), onSelection: selection => { if (selection.station === "patient") lesson.setMode("menu"); },
  });
  const vectors = useMemo(() => ({ viewer: new Vector3(), look: new Vector3(), rotation: new Quaternion(), prism: new Vector3(), forward: new Vector3(), xrViewer: createXRViewerScratch() }), []);
  const reflexes = useRef<Group>(null);
  const sample = () => {
    const frame = active && runtime.frameValid.current;
    const held = Boolean(frame && runtime.workingPose("pupils"));
    const penlightPosition = held ? runtime.origin.toArray() as [number, number, number] : [0, 0, 0] as const;
    const penlightForward = held ? runtime.direction.toArray() as [number, number, number] : [0, 0, 1] as const;
    // Panel use must not remove a physically held prism; its live geometry still applies.
    const prismHeld = Boolean(frame && runtime.workingPose("prism", true));
    const placement = runtime.toolsRef.current.prism.placement;
    const prism = runtime.objects.current.get("prism");
    let prismPosition: [number, number, number] | null = null;
    if (prism && (placement.kind !== "held" || prismHeld)) {
      vectors.prism.set(0, krimskyPrismCellY(setupRef.current.power), .012); prism.localToWorld(vectors.prism);
      prismPosition = vectors.prism.toArray() as [number, number, number];
      prism.getWorldQuaternion(vectors.rotation); vectors.forward.set(0, 0, -1).applyQuaternion(vectors.rotation);
    }
    const viewer = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    const poses = xrViewerPoses(viewer, vectors.xrViewer);
    const examinerPose = setupRef.current.examinerEye ? xrExaminerPose(poses, setupRef.current.examinerEye) : poses[0];
    if (examinerPose) { vectors.viewer.set(...examinerPose.viewer); vectors.look.set(...examinerPose.look); }
    else { viewer.getWorldPosition(vectors.viewer); viewer.getWorldQuaternion(vectors.rotation); vectors.look.set(0, 0, -1).applyQuaternion(vectors.rotation); }
    return xrKrimskyTechnique({ ...setupRef.current, baseline: baselineRef.current, held,
      light: Boolean(frame && runtime.toolsRef.current.pupils.powered), penlightPosition, penlightForward,
      viewerPosition: vectors.viewer.toArray() as [number, number, number], viewerForward: vectors.look.toArray() as [number, number, number],
      prismPosition, prismForward: vectors.forward.toArray() as [number, number, number], prismHeld,
    }, finding);
  };
  const [technique, setTechnique] = useState(sample);
  const invalidateView = () => {
    if (capturedRef.current) return; // Explicitly completed comparisons survive putting tools down.
    baselineRef.current = false; baselineDwell.current = 0; setBaseline(false); setBaselineProgress(0); clearPending(); setMessage("");
  };
  const clock = useRef(0);
  const correctionKey = useRef("");
  useFrame((_, dt) => {
    const next = sample();
    if (wasViewing.current && !next.viewing) invalidateView();
    wasViewing.current = next.viewing;
    const key = `${next.prismEye}:${next.correctionReady}`;
    if (correctionKey.current !== key && !capturedRef.current) clearPending();
    correctionKey.current = key;
    if (!baselineRef.current && !capturedRef.current) {
      const dwell = advanceKrimskyBaselineDwell(baselineDwell.current, next.baselineReady, dt);
      baselineDwell.current = dwell;
      if (Math.abs(dwell - baselineProgress) >= .08 || (dwell === 0 && baselineProgress !== 0) || dwell === KRIMSKY_BASELINE_DWELL_SECONDS) setBaselineProgress(dwell);
      if (dwell >= KRIMSKY_BASELINE_DWELL_SECONDS) {
        baselineRef.current = true;
        setBaseline(true);
        setMessage(`Baseline captured · add prism before ${krimskyEye(setupRef.current.method)}.`);
      }
    }
    if (reflexes.current) {
      reflexes.current.visible = active && next.lit;
      const os = reflexes.current.children.find(child => child.userData.xrKrimskyReflex === "OS");
      if (os) os.position.x = CLINIC_PATIENT_EYES.OS[0] + clinicKrimskyReflex(finding, next.residual);
      reflexes.current.children.forEach(child => {
        if (child instanceof Mesh && child.material instanceof MeshBasicMaterial) child.material.opacity = .35 + next.quality * .65;
      });
    }
    clock.current += dt;
    if (clock.current >= .1) { clock.current = 0; setTechnique(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next); }
  });
  const updateSetup = (next: typeof setup) => { setupRef.current = next; setSetup(next); };
  const clearComparison = () => { capturedRef.current = null; setCaptured(null); clearPending(); setMessage(""); };
  const reset = useCallback(() => {
    lesson.reset(); setupRef.current = { ...initialSetup(), method: setupRef.current.method }; setSetup(setupRef.current);
    baselineRef.current = false; baselineDwell.current = 0; setBaseline(false); setBaselineProgress(0); wasViewing.current = false; correctionKey.current = "";
    capturedRef.current = null; setCaptured(null); setMessage(""); runtime.resetClinic();
  }, [lesson.reset, runtime.resetClinic]);
  useEffect(() => { reset(); }, [index, reset]);
  useEffect(() => { if (!active) reset(); }, [active, reset]);
  const changeMethod = (method: KrimskyMethod) => {
    if (!active || preview || method === setupRef.current.method) return;
    lesson.reset(); clearComparison(); baselineRef.current = false; baselineDwell.current = 0; setBaseline(false); setBaselineProgress(0);
    updateSetup({ ...setupRef.current, method, base: "", power: 0 });
  };
  const changePrism = (base: string, power: number) => {
    if (!active || preview || lesson.awarded.current || !baselineRef.current) return;
    clearComparison(); updateSetup({ ...setupRef.current, base, power: Math.max(0, Math.min(40, Math.round(power))) });
    if (!sample().viewing) invalidateView();
  };
  function stepPrism(step: -1 | 1) {
    if (!active || preview || lesson.awarded.current || !baselineRef.current || !setupRef.current.base) return false;
    const power = stepKrimskyPrismPower(setupRef.current.power, step);
    if (power === setupRef.current.power) return false;
    changePrism(setupRef.current.base, power);
    return true;
  }
  const selectExaminerEye = (examinerEye: ExaminerEye | null) => {
    if (!active || preview || lesson.awarded.current || examinerEye === setupRef.current.examinerEye) return;
    clearComparison(); baselineRef.current = false; baselineDwell.current = 0; setBaseline(false); setBaselineProgress(0);
    updateSetup({ ...setupRef.current, examinerEye, base: "", power: 0 });
  };
  function compare() {
    if (!active || preview || lesson.awarded.current || capturedRef.current) return;
    const live = sample();
    const comparison = captureKrimskyComparison(live);
    if (!comparison) { setMessage(live.correctionReady ? "Reflexes remain asymmetric · adjust prism and compare again." : "Align the light/view and prism before comparing."); return; }
    capturedRef.current = comparison; setCaptured(comparison); clearPending();
    setMessage("Matching reflex comparison captured · release the light or place tools down, then record your reading.");
  }
  const cancel = () => { if (!lesson.awarded.current) clearComparison(); lesson.setMode("none"); };
  const record = () => {
    if (!active || preview || !runtime.frameValid.current) return;
    const comparison = capturedRef.current, answer = lesson.entriesRef.current.power;
    const correct = krimskyComparisonSubmission(comparison, answer ?? "");
    if (correct === null || !comparison) return;
    lesson.submit(true, correct, correct
      ? `${comparison.method === "modified" ? "Modified Krimsky" : "Krimsky"}: ${comparison.power}Δ ${comparison.base}, prism before ${comparison.eye}, at about ${Math.round(comparison.distanceCm)} cm.`
      : "Read the captured neutralising prism and record its power in Δ.");
  };
  const next = () => { if (!lesson.awarded.current) return; reset(); setIndex(value => (value + 1) % krimskyCases.length); };
  const status = captured ? message || "Comparison captured · enter the prism power you read."
    : !runtime.tools.pupils.powered ? "Pick up the penlight and hold its trigger."
    : !setup.fixation ? "Ask the patient to look at the light."
    : !setup.examinerEye ? "Say which eye you are closing, or choose an examiner-eye view."
    : !technique.viewing ? `${Math.round(technique.distanceCm)} cm · hold light about 50 cm, aim between eyes and centre your view.`
    : !baseline ? `Keep prism clear and hold the ${setup.examinerEye} examiner-eye view steady · ${Math.round(baselineProgress / KRIMSKY_BASELINE_DWELL_SECONDS * 100)}%.`
    : message || (!technique.correctionReady ? `Hold the gold-ringed prism cell before ${krimskyEye(setup.method)} and select BI/BO.`
      : technique.neutral ? "Reflexes match · prism-hand trigger captures comparison." : "Reflexes remain asymmetric · adjust prism power and compare.");
  const actions: LessonAction[] = [
    { label: setup.fixation ? "FIXATION GIVEN ✓" : "LOOK AT THE LIGHT", active: setup.fixation, run: () => updateSetup({ ...setupRef.current, fixation: true }) },
    { label: "PRISM / METHOD SETTINGS", run: () => lesson.setMode("settings") },
    { label: "CLOSE RIGHT EYE · LEFT VIEW", active: setup.examinerEye === "left", run: () => selectExaminerEye("left") },
    { label: "CLOSE LEFT EYE · RIGHT VIEW", active: setup.examinerEye === "right", run: () => selectExaminerEye("right") },
    { label: "OPEN BOTH EYES", active: setup.examinerEye === null, run: () => selectExaminerEye(null) },
  ];
  const configuration: LessonAction[] = [
    { label: "STANDARD · OS", active: setup.method === "standard", run: () => changeMethod("standard") },
    { label: "MODIFIED · OD", active: setup.method === "modified", run: () => changeMethod("modified") },
    { label: "BASE IN · BI", active: setup.base === "BI", disabled: !baseline || lesson.recorded, run: () => changePrism("BI", 0) },
    { label: "BASE OUT · BO", active: setup.base === "BO", disabled: !baseline || lesson.recorded, run: () => changePrism("BO", 0) },
    { label: "PRISM CELL DOWN", disabled: !baseline || !setup.base || lesson.recorded || setup.power === 0, run: () => stepPrism(-1) },
    { label: "PRISM CELL UP", disabled: !baseline || !setup.base || lesson.recorded || setup.power === 40, run: () => stepPrism(1) },
    { label: "CAPTURE REFLEX COMPARISON", disabled: !technique.correctionReady || Boolean(captured) || lesson.recorded, run: compare },
  ];
  const ready = active && !preview && Boolean(captured);
  useEffect(() => { onMirror?.({ title: setup.method === "modified" ? "Modified Krimsky" : "Krimsky", findingPosition: { current: index + 1, total: krimskyCases.length },
    status: `${status} · selected prism ${setup.power}Δ ${setup.base || "base unselected"}`, ready, entryReady: ready, fields, actions: [...actions, ...configuration], lesson, reset, record, next, cancel }); },
    [onMirror, status, ready, technique.baselineReady, technique.correctionReady, lesson.mode, lesson.entries, lesson.feedback, lesson.recorded, index, setup, baseline, baselineProgress]);
  const settings = <XRHeadPanel>
    <Box s={[.78, 1.10, .018]} c="#102329" radius={.012} />
    <XRSign text={["KRIMSKY · METHOD + PRISM", `OD fixating · OS deviating · ${setup.power}Δ ${setup.base || "choose base"}`, captured ? "Completed comparison captured" : "Prism-hand trigger · compare live reflexes"]} p={[0, .40, .012]} size={[.72, .20]} bg="#102329" fg="#eefbf7" />
    {configuration.map((action, i) => <XRPanelButton key={action.label} label={action.label} active={action.active} disabled={action.disabled}
      position={[i === 6 ? 0 : i % 2 ? .18 : -.18, .24 - Math.floor(i / 2) * .085, .025]} width={i === 6 ? .70 : .34} onClick={action.run} />)}
    <XRPanelButton label="CLOSE SETTINGS" position={[-.18, -.205, .025]} width={.34} onClick={() => lesson.setMode("none")} />
    <XRPanelButton label="EXIT VR" position={[.18, -.205, .025]} width={.34} onClick={onExit} />
    <XRSign text={[status]} p={[0, -.37, .012]} size={[.72, .15]} bg="#102329" fg="#eefbf7" />
  </XRHeadPanel>;
  return <>
    <XRClinicRuntimeView cleanHands runtime={runtime} active={active && !preview} preview={preview} title="KRIMSKY · PRACTICE" instruction="Prism-hand trigger · compare · A/X · controls and recording" instrumentSettings={{ prism: { power: setup.power, base: setup.base } }} />
    {active && <group ref={reflexes} visible={false} userData={{ xrIgnoreRay: true }}>
      {(["OD", "OS"] as const).map(eye => <mesh key={eye} position={[CLINIC_PATIENT_EYES[eye][0], CLINIC_PATIENT_EYES[eye][1], -.568]} userData={{ xrKrimskyReflex: eye }}>
        <circleGeometry args={[.0015, 24]} /><meshBasicMaterial args={[{ color: "#fff9d8", transparent: true, depthWrite: false }]} />
      </mesh>)}
    </group>}
    <XRKrimskyMonocularView active={active && !preview} examinerEye={setup.examinerEye} reflexOffset={clinicKrimskyReflex(finding, technique.residual)} baselineProgress={baselineProgress} baseline={baseline} power={setup.power} base={setup.base} />
    <PracticeLessonUI runtime={runtime} active={active} title={setup.method === "modified" ? "MODIFIED KRIMSKY" : "KRIMSKY"} status={status} tools={["pupils", "prism"]} actions={actions} fields={fields} lesson={lesson}
      entryReady={ready} ready={ready} onRecord={record} onReset={reset} onNext={next} onExit={onExit} settings={settings} onCancel={cancel}
      help={["Ask fixation on the penlight; hold its trigger.", "Say which eye you are closing, or choose the matching examiner-eye view.", "At about 50 cm, hold steady; baseline captures automatically with the prism clear.", "Standard: prism before OS; modified: before OD.", "Use the prism-hand thumbstick to move through cells; choose BI/BO in settings.", "Prism-hand trigger captures; A/X opens recording."]} />
  </>;
}
