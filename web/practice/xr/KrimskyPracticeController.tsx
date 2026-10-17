import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from "three";
import { krimskyCases, krimskyEye, type KrimskyMethod } from "../../interaction/krimsky";
import { KRIMSKY_GUIDED_STEP_COUNT, krimskyGuidedStep } from "../../interaction/alignmentGuidance";
import { CLINIC_PATIENT_EYES } from "../../interaction/clinicPatient";
import { PRISM_BAR_WORKING_Y } from "../../interaction/xrConsultationTools";
import { useXRClinicRuntime } from "../../interaction/useXRClinicRuntime";
import { captureKrimskyComparison, clinicKrimskyReflex, krimskyComparisonSubmission, KRIMSKY_PRISM_POWERS, stepKrimskyPrismPower, xrKrimskyTechnique, type ExaminerEye, type KrimskyComparison } from "../../interaction/xrKrimskyPractice";
import { createXRViewerScratch, xrExaminerPose, xrViewerPoses } from "../../interaction/xrViewer";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { XRGuidedStepBubble } from "../../scene/XRGuidedStepBubble";
import { XRHeadPanel, XRPanelButton, XRSign } from "../../scene/XRClinicPanels";
import { Box } from "../../scene/Models";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonAction, type LessonField } from "./PracticeLessonUI";
import { usePracticeAttempt } from "../PracticeAttemptContext";

const prismPowerChoices = KRIMSKY_PRISM_POWERS.map(power => [String(power), `${power}Δ`] as const);
const initialSetup = () => ({ method: "standard" as KrimskyMethod, fixation: false, examinerEye: null as ExaminerEye | null, base: "", power: 0 });
export function KrimskyPracticeController({ active, preview = false, onComplete, onExit, onMirror }: {
  active: boolean; preview?: boolean; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const { settings: attemptSettings } = usePracticeAttempt();
  const guided = attemptSettings?.kind === "guided";
  const { gl, camera } = useThree();
  const [index, setIndex] = useState(0);
  const finding = krimskyCases[index];
  const lesson = usePracticeLesson(onComplete);
  const [setup, setSetup] = useState(initialSetup);
  const setupRef = useRef(setup);
  const capturedRef = useRef<KrimskyComparison | null>(null);
  const prismAnchorPowerRef = useRef<number | null>(null);
  const [prismAnchorPower, setPrismAnchorPower] = useState<number | null>(null);
  const [captured, setCaptured] = useState<KrimskyComparison | null>(null), [message, setMessage] = useState("");
  const fields = useMemo<LessonField[]>(() => [{
    id: "power",
    label: captured ? `Neutralising prism · ${captured.base}` : "Neutralising prism",
    choices: prismPowerChoices,
  }], [captured]);
  const clearPending = lesson.clearPending;
  const interrupt = useCallback(() => { if (!capturedRef.current) clearPending(); }, [clearPending]);
  const runtime = useXRClinicRuntime({ active: active && !preview, editorOpen: lesson.mode !== "none", onInterrupt: interrupt,
    onToolUsed: (id, action) => { if (id === "prism" && action === "activate") compare(); },
    onThumbstickStep: (id, step, _hand, axis) => id === "prism" && (axis === "horizontal" ? selectPrismBase(step) : stepPrism(step)),
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
      vectors.prism.set(0, PRISM_BAR_WORKING_Y, .012); prism.localToWorld(vectors.prism);
      prismPosition = vectors.prism.toArray() as [number, number, number];
      prism.getWorldQuaternion(vectors.rotation); vectors.forward.set(0, 0, -1).applyQuaternion(vectors.rotation);
    }
    const viewer = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    const poses = xrViewerPoses(viewer, vectors.xrViewer);
    const examinerPose = setupRef.current.examinerEye ? xrExaminerPose(poses, setupRef.current.examinerEye) : poses[0];
    if (examinerPose) { vectors.viewer.set(...examinerPose.viewer); vectors.look.set(...examinerPose.look); }
    else { viewer.getWorldPosition(vectors.viewer); viewer.getWorldQuaternion(vectors.rotation); vectors.look.set(0, 0, -1).applyQuaternion(vectors.rotation); }
    return xrKrimskyTechnique({ ...setupRef.current, held,
      light: Boolean(frame && runtime.toolsRef.current.pupils.powered), penlightPosition, penlightForward,
      viewerPosition: vectors.viewer.toArray() as [number, number, number], viewerForward: vectors.look.toArray() as [number, number, number],
      prismPosition, prismForward: vectors.forward.toArray() as [number, number, number], prismHeld,
    }, finding);
  };
  const [technique, setTechnique] = useState(sample);
  const invalidateView = () => {
    if (capturedRef.current) return; // Explicitly completed comparisons survive putting tools down.
    clearPending(); setMessage("");
  };
  const clock = useRef(0);
  const correctionKey = useRef("");
  useFrame((_, dt) => {
    const next = sample();
    const requiredEye = krimskyEye(setupRef.current.method);
    const aligned = next.prismHeld && next.prismEye === requiredEye;
    if (prismAnchorPowerRef.current === null && aligned) {
      prismAnchorPowerRef.current = setupRef.current.power;
      setPrismAnchorPower(setupRef.current.power);
      const placement = runtime.toolsRef.current.prism.placement;
      if (placement.kind === "held") runtime.pulseHand(placement.hand, .45, 55);
      setMessage(`${setupRef.current.power}Δ ${setupRef.current.base || "prism"} aligned before ${requiredEye}.`);
    } else if (prismAnchorPowerRef.current !== null && !aligned) {
      prismAnchorPowerRef.current = null;
      setPrismAnchorPower(null);
      if (!capturedRef.current) setMessage("");
    }
    const key = `${next.prismEye}:${next.correctionReady}`;
    if (correctionKey.current !== key && !capturedRef.current) clearPending();
    correctionKey.current = key;
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
    correctionKey.current = ""; prismAnchorPowerRef.current = null; setPrismAnchorPower(null);
    capturedRef.current = null; setCaptured(null); setMessage(""); runtime.resetClinic();
  }, [lesson.reset, runtime.resetClinic]);
  useEffect(() => { reset(); }, [index, reset]);
  useEffect(() => { if (!active) reset(); }, [active, reset]);
  const changeMethod = (method: KrimskyMethod) => {
    if (!active || preview || method === setupRef.current.method) return;
    lesson.reset(); clearComparison(); prismAnchorPowerRef.current = null; setPrismAnchorPower(null);
    updateSetup({ ...setupRef.current, method, base: "", power: 0 });
  };
  const changePrism = (base: string, power: number) => {
    if (!active || preview || lesson.awarded.current || runtime.toolsRef.current.prism.placement.kind !== "held") return;
    clearComparison(); updateSetup({ ...setupRef.current, base, power: Math.max(0, Math.min(40, Math.round(power))) });
    // Keep the coach/reflex response synchronous with a discrete prism-cell change.
    // The regular frame sampler is intentionally throttled and may otherwise still
    // describe the previous cell for a perceptible beat after the thumbstick moves.
    setTechnique(sample());
    if (!sample().viewing) invalidateView();
  };
  function stepPrism(step: -1 | 1) {
    if (!active || preview || lesson.awarded.current || runtime.toolsRef.current.prism.placement.kind !== "held" || !setupRef.current.base) return false;
    const power = stepKrimskyPrismPower(setupRef.current.power, step);
    if (power === setupRef.current.power) return false;
    changePrism(setupRef.current.base, power);
    return true;
  }
  function selectPrismBase(step: -1 | 1) {
    if (!active || preview || lesson.awarded.current || runtime.toolsRef.current.prism.placement.kind !== "held") return false;
    const base = step < 0 ? "BI" : "BO";
    if (setupRef.current.base === base) return false;
    changePrism(base, setupRef.current.power);
    return true;
  }
  const selectExaminerEye = (examinerEye: ExaminerEye | null) => {
    if (!active || preview || lesson.awarded.current || examinerEye === setupRef.current.examinerEye) return;
    clearComparison(); prismAnchorPowerRef.current = null; setPrismAnchorPower(null);
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
  const status = captured ? `${message || "Comparison captured."} Recorded base: ${captured.base} · choose the matching prism-bar power.`
    : !runtime.tools.pupils.powered ? "Pick up the penlight and hold its trigger."
    : !setup.fixation ? "Ask the patient to look at the light."
    : !setup.examinerEye ? "Say which eye you are closing, or choose an examiner-eye view."
    : runtime.tools.prism.placement.kind !== "held" ? "Observe the initial reflex positions, then pick up the prism bar."
    : prismAnchorPower === null ? `Move the gold-ringed ${setup.power}Δ cell over ${krimskyEye(setup.method)}.`
    : !technique.viewing ? `${Math.round(technique.distanceCm)} cm · hold light about 50 cm, aim between eyes and centre your view.`
    : message || (!technique.correctionReady ? `Place the prism before ${krimskyEye(setup.method)} · thumbstick left/right selects BI/BO; up/down changes power.`
      : technique.neutral ? "Reflexes match · prism-hand trigger captures comparison." : "Reflexes remain asymmetric · adjust prism power and compare.");
  const actions: LessonAction[] = [
    { label: setup.fixation ? "FIXATION GIVEN ✓" : "LOOK AT THE LIGHT", active: setup.fixation, run: () => updateSetup({ ...setupRef.current, fixation: true }) },
    { label: "METHOD SETTINGS", run: () => lesson.setMode("settings") },
    { label: "CLOSE RIGHT EYE · LEFT VIEW", active: setup.examinerEye === "left", run: () => selectExaminerEye("left") },
    { label: "CLOSE LEFT EYE · RIGHT VIEW", active: setup.examinerEye === "right", run: () => selectExaminerEye("right") },
    { label: "OPEN BOTH EYES", active: setup.examinerEye === null, run: () => selectExaminerEye(null) },
  ];
  const methodConfiguration: LessonAction[] = [
    { label: "STANDARD · OS", active: setup.method === "standard", run: () => changeMethod("standard") },
    { label: "MODIFIED · OD", active: setup.method === "modified", run: () => changeMethod("modified") },
  ];
  const accessiblePrismConfiguration: LessonAction[] = [
    { label: "BASE IN · BI", active: setup.base === "BI", disabled: runtime.tools.prism.placement.kind !== "held" || lesson.recorded, run: () => changePrism("BI", 0) },
    { label: "BASE OUT · BO", active: setup.base === "BO", disabled: runtime.tools.prism.placement.kind !== "held" || lesson.recorded, run: () => changePrism("BO", 0) },
    { label: "PRISM CELL DOWN", disabled: runtime.tools.prism.placement.kind !== "held" || !setup.base || lesson.recorded || setup.power === 0, run: () => stepPrism(-1) },
    { label: "PRISM CELL UP", disabled: runtime.tools.prism.placement.kind !== "held" || !setup.base || lesson.recorded || setup.power === 40, run: () => stepPrism(1) },
    { label: "CAPTURE REFLEX COMPARISON", disabled: !technique.correctionReady || Boolean(captured) || lesson.recorded, run: compare },
  ];
  const ready = active && !preview && Boolean(captured);
  const guidance = krimskyGuidedStep({
    penlightHeld: runtime.tools.pupils.placement.kind === "held",
    fixation: setup.fixation,
    examinerEyeSelected: Boolean(setup.examinerEye),
    prismHeld: runtime.tools.prism.placement.kind === "held",
    prismAligned: prismAnchorPower !== null,
    neutral: technique.neutral,
    comparisonCaptured: Boolean(captured),
    powerEntered: Boolean(lesson.entries.power),
    recorded: lesson.recorded,
  });
  useEffect(() => { onMirror?.({ title: setup.method === "modified" ? "Modified Krimsky" : "Krimsky", findingPosition: { current: index + 1, total: krimskyCases.length },
    status: `${status} · selected prism ${setup.power}Δ ${setup.base || "base unselected"}`, ready, entryReady: ready, fields, actions: [...actions, ...methodConfiguration, ...accessiblePrismConfiguration], lesson, reset, record, next, cancel }); },
    [onMirror, status, ready, technique.correctionReady, lesson.mode, lesson.entries, lesson.feedback, lesson.recorded, index, setup, runtime.tools.prism.placement.kind, prismAnchorPower]);
  const settings = <XRHeadPanel>
    <Box s={[.78, .66, .018]} c="#102329" radius={.012} />
    <XRSign text={["KRIMSKY · METHOD", "Prism direction and power use the held prism's thumbstick."]} p={[0, .21, .012]} size={[.72, .14]} bg="#102329" fg="#eefbf7" />
    {methodConfiguration.map((action, i) => <XRPanelButton key={action.label} label={action.label} active={action.active} disabled={action.disabled}
      position={[i ? .18 : -.18, .08, .025]} width={.34} onClick={action.run} />)}
    <XRPanelButton label="CLOSE SETTINGS" position={[-.18, -.08, .025]} width={.34} onClick={() => lesson.setMode("none")} />
    <XRPanelButton label="EXIT VR" position={[.18, -.08, .025]} width={.34} onClick={onExit} />
    <XRSign text={[status]} p={[0, -.23, .012]} size={[.72, .12]} bg="#102329" fg="#eefbf7" />
  </XRHeadPanel>;
  return <>
    <XRClinicRuntimeView cleanHands runtime={runtime} active={active && !preview} preview={preview}
      title="KRIMSKY · PRACTICE" instruction="Prism thumbstick: ← BI · BO → · ↑↓ power · trigger compare"
      instrumentSettings={{ prism: { power: setup.power, base: setup.base, anchorPower: prismAnchorPower ?? undefined, aligned: prismAnchorPower !== null,
        reflexOffset: clinicKrimskyReflex(finding, technique.residual), showReflex: prismAnchorPower !== null && technique.lit } }} showWallInstructions={!guided} />
    {(active || preview) && guided && <XRGuidedStepBubble stepId={guidance.id} stepNumber={guidance.index + 1}
      total={KRIMSKY_GUIDED_STEP_COUNT} title={guidance.title} lines={guidance.lines} complete={guidance.complete} />}
    {active && <group ref={reflexes} visible={false} userData={{ xrIgnoreRay: true }}>
      {(["OD", "OS"] as const).map(eye => <mesh key={eye} position={[CLINIC_PATIENT_EYES[eye][0], CLINIC_PATIENT_EYES[eye][1], -.568]} userData={{ xrKrimskyReflex: eye }}>
        <circleGeometry args={[.0015, 24]} /><meshBasicMaterial args={[{ color: "#fff9d8", transparent: true, depthWrite: false }]} />
      </mesh>)}
    </group>}
    <PracticeLessonUI runtime={runtime} active={active} title={setup.method === "modified" ? "MODIFIED KRIMSKY" : "KRIMSKY"} status={status} tools={["pupils", "prism"]} actions={actions} fields={fields} lesson={lesson}
      entryReady={ready} ready={ready} onRecord={record} onReset={reset} onNext={next} onExit={onExit} settings={settings} onCancel={cancel}
      help={["Ask fixation on the penlight; hold its trigger.", "Say which eye you are closing; this records only your examiner-eye choice.", "Observe the initial reflex positions, then pick up the prism bar with your free hand.", "Standard: prism before OS; modified: before OD.", "Prism thumbstick: left = BI, right = BO, up/down changes power.", "Prism-hand trigger captures the neutral endpoint; A/X opens recording."]} />
  </>;
}
