import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, Mesh, MeshBasicMaterial, Quaternion, Vector3 } from "three";
import { krimskyCases, krimskyEye, type KrimskyMethod } from "../../interaction/krimsky";
import { CLINIC_PATIENT_EYES } from "../../interaction/clinicPatient";
import { useXRClinicRuntime } from "../../interaction/useXRClinicRuntime";
import { consultationToolDefinition } from "../../interaction/xrConsultationTools";
import { xrKrimskyTechnique, clinicKrimskyReflex, captureKrimskyComparison, krimskyComparisonSubmission, type KrimskyComparison } from "../../interaction/xrKrimskyPractice";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { XRHeadPanel, XRPanelButton, XRSign } from "../../scene/XRClinicPanels";
import { Box } from "../../scene/Models";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonAction, type LessonField } from "./PracticeLessonUI";

const fields: LessonField[] = [{ id: "power", label: "Neutralising power", choices: [], number: { min: 0, max: 40, unit: "Δ" } }];
const initialSetup = () => ({ method: "standard" as KrimskyMethod, fixation: false, monocular: false, base: "", power: 0 });
export function KrimskyPracticeController({ active, preview = false, onComplete, onExit, onMirror }: {
  active: boolean; preview?: boolean; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const { gl, camera } = useThree();
  const [index, setIndex] = useState(0);
  const finding = krimskyCases[index];
  const lesson = usePracticeLesson(onComplete);
  const [setup, setSetup] = useState(initialSetup);
  const setupRef = useRef(setup);
  const baselineRef = useRef(false), wasViewing = useRef(false);
  const capturedRef = useRef<KrimskyComparison | null>(null);
  const [baseline, setBaseline] = useState(false), [captured, setCaptured] = useState<KrimskyComparison | null>(null), [message, setMessage] = useState("");
  const clearPending = lesson.clearPending;
  const interrupt = useCallback(() => { if (!capturedRef.current) clearPending(); }, [clearPending]);
  const runtime = useXRClinicRuntime({ active: active && !preview, editorOpen: lesson.mode !== "none", onInterrupt: interrupt,
    onToolUsed: (id, action) => { if (id === "prism" && action === "activate") compare(); },
    onMenu: open => lesson.setMode(open ? "menu" : "none"), onSelection: selection => { if (selection.station === "patient") lesson.setMode("menu"); },
  });
  const vectors = useMemo(() => ({ viewer: new Vector3(), look: new Vector3(), rotation: new Quaternion(), prism: new Vector3(), forward: new Vector3() }), []);
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
      vectors.prism.set(...consultationToolDefinition("prism").workingPoint); prism.localToWorld(vectors.prism);
      prismPosition = vectors.prism.toArray() as [number, number, number];
      prism.getWorldQuaternion(vectors.rotation); vectors.forward.set(0, 0, -1).applyQuaternion(vectors.rotation);
    }
    const viewer = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    viewer.getWorldPosition(vectors.viewer); viewer.getWorldQuaternion(vectors.rotation);
    vectors.look.set(0, 0, -1).applyQuaternion(vectors.rotation);
    return xrKrimskyTechnique({ ...setupRef.current, baseline: baselineRef.current, held,
      light: Boolean(frame && runtime.toolsRef.current.pupils.powered), penlightPosition, penlightForward,
      viewerPosition: vectors.viewer.toArray() as [number, number, number], viewerForward: vectors.look.toArray() as [number, number, number],
      prismPosition, prismForward: vectors.forward.toArray() as [number, number, number], prismHeld,
    }, finding);
  };
  const [technique, setTechnique] = useState(sample);
  const invalidateView = () => {
    if (capturedRef.current) return; // Explicitly completed comparisons survive putting tools down.
    baselineRef.current = false; setBaseline(false); clearPending(); setMessage("");
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
    baselineRef.current = false; setBaseline(false); wasViewing.current = false; correctionKey.current = "";
    capturedRef.current = null; setCaptured(null); setMessage(""); runtime.resetClinic();
  }, [lesson.reset, runtime.resetClinic]);
  useEffect(() => { reset(); }, [index, reset]);
  useEffect(() => { if (!active) reset(); }, [active, reset]);
  const changeMethod = (method: KrimskyMethod) => {
    if (!active || preview || method === setupRef.current.method) return;
    lesson.reset(); clearComparison(); baselineRef.current = false; setBaseline(false);
    updateSetup({ ...setupRef.current, method, base: "", power: 0 });
  };
  const changePrism = (base: string, power: number) => {
    if (!active || preview || lesson.awarded.current || !baselineRef.current) return;
    clearComparison(); updateSetup({ ...setupRef.current, base, power: Math.max(0, Math.min(40, Math.round(power))) });
    if (!sample().viewing) invalidateView();
  };
  const inspectBaseline = () => {
    if (!active || preview || lesson.awarded.current || !sample().baselineReady) return;
    baselineRef.current = true; setBaseline(true); setMessage("Baseline inspected · add prism before " + krimskyEye(setupRef.current.method) + ".");
    lesson.setMode("none");
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
    : !setup.monocular ? "Use one examiner eye and confirm monocular viewing."
    : !technique.viewing ? `${Math.round(technique.distanceCm)} cm · hold light about 50 cm, aim between eyes and centre your view.`
    : !baseline ? "Keep prism clear of both eyes; inspect baseline reflexes."
    : message || (!technique.correctionReady ? `Hold the gold-ringed prism cell before ${krimskyEye(setup.method)} and select BI/BO.`
      : technique.neutral ? "Reflexes match · prism-hand trigger captures comparison." : "Reflexes remain asymmetric · adjust prism power and compare.");
  const actions: LessonAction[] = [
    { label: setup.fixation ? "FIXATION GIVEN ✓" : "LOOK AT THE LIGHT", active: setup.fixation, run: () => updateSetup({ ...setupRef.current, fixation: true }) },
    { label: "PRISM / METHOD SETTINGS", run: () => lesson.setMode("settings") },
    { label: setup.monocular ? "MONOCULAR VIEW ✓" : "CONFIRM MONOCULAR VIEW", active: setup.monocular, run: () => updateSetup({ ...setupRef.current, monocular: true }) },
    { label: baseline ? "BASELINE INSPECTED ✓" : "INSPECT BASELINE", disabled: baseline || !technique.baselineReady, run: inspectBaseline },
  ];
  const configuration: LessonAction[] = [
    { label: "STANDARD · OS", active: setup.method === "standard", run: () => changeMethod("standard") },
    { label: "MODIFIED · OD", active: setup.method === "modified", run: () => changeMethod("modified") },
    { label: "BASE IN · BI", active: setup.base === "BI", disabled: !baseline || lesson.recorded, run: () => changePrism("BI", 0) },
    { label: "BASE OUT · BO", active: setup.base === "BO", disabled: !baseline || lesson.recorded, run: () => changePrism("BO", 0) },
    ...[-1, 1, -5, 5].map(step => ({ label: `PRISM ${step > 0 ? "+" : "−"}${Math.abs(step)}Δ`, disabled: !baseline || !setup.base || lesson.recorded,
      run: () => changePrism(setupRef.current.base, setupRef.current.power + step) })),
    { label: "CAPTURE REFLEX COMPARISON", disabled: !technique.correctionReady || Boolean(captured) || lesson.recorded, run: compare },
  ];
  const ready = active && !preview && Boolean(captured);
  useEffect(() => { onMirror?.({ title: setup.method === "modified" ? "Modified Krimsky" : "Krimsky", findingPosition: { current: index + 1, total: krimskyCases.length },
    status: `${status} · selected prism ${setup.power}Δ ${setup.base || "base unselected"}`, ready, entryReady: ready, fields, actions: [...actions, ...configuration], lesson, reset, record, next, cancel }); },
    [onMirror, status, ready, technique.baselineReady, technique.correctionReady, lesson.mode, lesson.entries, lesson.feedback, lesson.recorded, index, setup, baseline]);
  const settings = <XRHeadPanel>
    <Box s={[.78, 1.10, .018]} c="#102329" radius={.012} />
    <XRSign text={["KRIMSKY · METHOD + PRISM", `OD fixating · OS deviating · ${setup.power}Δ ${setup.base || "choose base"}`, captured ? "Completed comparison captured" : "Prism-hand trigger · compare live reflexes"]} p={[0, .40, .012]} size={[.72, .20]} bg="#102329" fg="#eefbf7" />
    {configuration.map((action, i) => <XRPanelButton key={action.label} label={action.label} active={action.active} disabled={action.disabled}
      position={[i === 8 ? 0 : i % 2 ? .18 : -.18, .24 - Math.floor(i / 2) * .085, .025]} width={i === 8 ? .70 : .34} onClick={action.run} />)}
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
    <PracticeLessonUI runtime={runtime} active={active} title={setup.method === "modified" ? "MODIFIED KRIMSKY" : "KRIMSKY"} status={status} tools={["pupils", "prism"]} actions={actions} fields={fields} lesson={lesson}
      entryReady={ready} ready={ready} onRecord={record} onReset={reset} onNext={next} onExit={onExit} settings={settings} onCancel={cancel}
      help={["Ask fixation on the penlight; hold its trigger.", "Use one examiner eye; acknowledge monocular viewing.", "At about 50 cm, inspect baseline without prism.", "Standard: prism before OS; modified: before OD.", "Adjust BI/BO and power until relative reflexes match.", "Prism-hand trigger captures; A/X opens recording."]} />
  </>;
}
