import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { worthCases, worthDots } from "../../interaction/worth";
import { captureWorthReport, recordWorthEndpoint, WORTH_GUIDED_STEP_COUNT, worthCaptureSubmission, worthComparisonComplete, worthGuidedStep, xrWorthTechnique,
  type WorthCapture, type WorthEndpoint, type WorthRecords } from "../../interaction/xrWorthPractice";
import { useXRClinicRuntime, type ClinicInputMode } from "../../interaction/useXRClinicRuntime";
import type { ConsultationToolId } from "../../interaction/xrConsultationTools";
import { isPatientFitted, sensoryEquipment, sensoryFittingSignature, sensorySockets, sensoryTargetCondition } from "../../interaction/xrSensoryEquipment";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { XRGuidedStepBubble } from "../../scene/XRGuidedStepBubble";
import { XRSign } from "../../scene/XRClinicPanels";
import { Box } from "../../scene/Models";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonAction, type LessonField } from "./PracticeLessonUI";
import { usePracticeAttempt } from "../PracticeAttemptContext";

const fields: LessonField[] = [
  { id: "count", label: "Number of reported dots", choices: [2, 3, 4, 5].map(value => [String(value), `${value} dots`] as const) },
  { id: "interpretation", label: "Interpretation", choices: [["flat-fusion", "Flat fusion"], ["left-suppression", "Left-eye suppression"],
    ["right-suppression", "Right-eye suppression"], ["eso", "Eso · uncrossed"], ["exo", "Exo · crossed"], ["left-hyper", "Left hyper"], ["right-hyper", "Right hyper"]] },
];
function ReportDots({ finding }: { finding: WorthCapture["finding"] }) {
  return <group userData={{ xrIgnoreRay: true }}>{worthDots(finding).map((dot, i) => <mesh key={i} position={[dot.x * .001, -dot.y * .001, .018]}>
    <circleGeometry args={[.008, 24]} /><meshBasicMaterial color={dot.color} />
  </mesh>)}</group>;
}

export function WorthPracticeController({ active, preview = false, inputMode = "xr", onComplete, onExit, onMirror }: {
  active: boolean; preview?: boolean; inputMode?: ClinicInputMode; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const { settings: attemptSettings } = usePracticeAttempt();
  const guided = attemptSettings?.kind === "guided";
  const [index, setIndex] = useState(0);
  const lesson = usePracticeLesson(onComplete);
  const attempt = useRef(0), revision = useRef(0);
  const capturedRef = useRef<WorthCapture | null>(null), recordsRef = useRef<WorthRecords>({});
  const [captured, setCaptured] = useState<WorthCapture | null>(null), [records, setRecords] = useState<WorthRecords>({});
  const fixationRef = useRef<WorthEndpoint | null>(null);
  const [fixationEndpoint, setFixationEndpoint] = useState<WorthEndpoint | null>(null);
  const [restartNotice, setRestartNotice] = useState("");
  const clearPending = lesson.clearPending;
  const interrupt = useCallback(() => { if (!capturedRef.current) clearPending(); }, [clearPending]);
  const runtime = useXRClinicRuntime({ active, inputMode, equipment: sensoryEquipment("worth"), placementSockets: sensorySockets("worth"),
    editorOpen: lesson.mode !== "none", onInterrupt: interrupt,
    onToolUsed: (id, action) => { if (id === "worth" && action === "activate") askFresh(); },
    onMenu: open => lesson.setMode(open ? "menu" : "none"),
    onSelection: selection => { if (selection.station === "patient") lesson.setMode("menu"); },
  });
  const sample = () => {
    const pose = runtime.supportedWorkingPose("worth", true);
    return { active: active && !preview && runtime.frameValid.current,
    correction: isPatientFitted(runtime.toolsRef.current, "subjective"), glasses: isPatientFitted(runtime.toolsRef.current, "red-green"),
    light: runtime.toolsRef.current.worth.powered,
    fixationEndpoint: fixationRef.current,
    condition: pose ? sensoryTargetCondition(pose, runtime.toolsRef.current) : { distanceCm: 0, endpoint: null, facing: false },
  }; };
  const [technique, setTechnique] = useState(() => xrWorthTechnique(sample()));
  const fittedKey = useRef("");
  const clearCapture = () => { capturedRef.current = null; setCaptured(null); clearPending(); };
  const resetComparison = () => {
    revision.current++; clearCapture(); recordsRef.current = {}; setRecords({}); lesson.reset();
    fixationRef.current = null; setFixationEndpoint(null);
  };
  const clock = useRef(0);
  const fixationCondition = useRef("");
  useFrame((_, dt) => {
    const input = sample();
    const key = sensoryFittingSignature(runtime.toolsRef.current, ["subjective", "red-green"]);
    if (fittedKey.current !== key) {
      const revised = Boolean(capturedRef.current || recordsRef.current.near || recordsRef.current.distance
        || fixationRef.current);
      fittedKey.current = key; resetComparison();
      if (revised) setRestartNotice("Correction or filters changed—the comparison has restarted.");
    }
    const endpointKey = `${input.correction}:${input.glasses}:${input.light}:${input.condition.endpoint}:${input.condition.facing}`;
    if (fixationCondition.current && fixationCondition.current !== endpointKey && fixationRef.current) {
      fixationRef.current = null; setFixationEndpoint(null);
    }
    fixationCondition.current = endpointKey;
    // Completed elicited reports survive ordinary movement, release and panel use.
    // Fresh questions always sample the current target geometry.
    clock.current += dt;
    if (clock.current >= .1) { clock.current = 0; const next = xrWorthTechnique(input);
      setTechnique(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    }
  });
  const reset = useCallback(() => {
    attempt.current++; revision.current++; capturedRef.current = null; setCaptured(null); recordsRef.current = {}; setRecords({});
    fittedKey.current = "";
    fixationRef.current = null; setFixationEndpoint(null); fixationCondition.current = "";
    setRestartNotice("");
    lesson.reset(); runtime.resetClinic();
  }, [lesson.reset, runtime.resetClinic]);
  useEffect(() => { reset(); }, [index, reset]);
  useEffect(() => { if (!active) reset(); }, [active, reset]);
  const setPower = (powered: boolean) => {
    if (!active || preview || lesson.awarded.current) return;
    if (runtime.toolsRef.current.worth.powered === powered) return;
    clearCapture();
    fixationRef.current = null; setFixationEndpoint(null);
    runtime.setToolPower("worth", powered);
  };
  function ask() {
    if (lesson.awarded.current || capturedRef.current || !active || preview) return;
    const capture = captureWorthReport(sample(), worthCases[index], attempt.current, revision.current);
    if (!capture) return;
    clearPending(); capturedRef.current = capture; setCaptured(capture);
  }
  const fixate = () => {
    if (!active || preview || lesson.awarded.current) return;
    const live = sample();
    const setupReady = xrWorthTechnique({ ...live, fixationEndpoint: live.condition.endpoint }).setupReady;
    if (!live.condition.endpoint || !setupReady) return;
    fixationRef.current = live.condition.endpoint; setFixationEndpoint(live.condition.endpoint);
  };
  const askFresh = () => {
    if (!xrWorthTechnique(sample()).ready || lesson.awarded.current) return;
    const condition = sample().condition, existing = capturedRef.current;
    if (existing && existing.endpoint === condition.endpoint && Math.abs(existing.actualDistanceCm - condition.distanceCm) < .001) return;
    clearCapture(); ask();
  };
  const cancel = () => { if (!lesson.awarded.current) clearCapture(); lesson.setMode("none"); };
  const record = () => {
    if (!active || preview || !runtime.frameValid.current || lesson.awarded.current) return;
    if (sensoryFittingSignature(runtime.toolsRef.current, ["subjective", "red-green"]) !== fittedKey.current) { resetComparison(); return; }
    const capture = capturedRef.current, { count = "", interpretation = "" } = lesson.entriesRef.current;
    const correct = worthCaptureSubmission(capture, count, interpretation, attempt.current, revision.current);
    if (correct === null || !capture?.endpoint) return;
    if (!correct) { lesson.submit(true, false, "Recheck the reported dot count, colours and relative positions."); return; }
    const nextRecords = recordWorthEndpoint(recordsRef.current, capture, count, interpretation, attempt.current, revision.current);
    if (nextRecords === recordsRef.current) return;
    recordsRef.current = nextRecords; setRecords(nextRecords); clearCapture();
    if (worthComparisonComplete(nextRecords)) lesson.submit(true, true, "Near 40 cm and mirrored distance 6 m independently recorded.");
    else lesson.progress(`${capture.endpoint === "near" ? "Near recorded—now test distance." : "Distance recorded—now test near."}`);
  };
  const next = () => { if (active && !preview) { reset(); setIndex(value => (value + 1) % worthCases.length); } };
  const history = `Near ${records.near ? "recorded" : "pending"} · distance ${records.distance ? "recorded" : "pending"}`;
  const conditionLabel = technique.endpoint === "distance" ? "simulated mirrored 6 m path" : `${Math.round(technique.distanceCm)} cm`;
  const status = (captured ? `${captured.report} · captured ${captured.endpoint ?? "intermediate"} at ${Math.round(captured.actualDistanceCm)} cm`
    : !isPatientFitted(runtime.tools, "subjective") ? "Fit the trial frame with correction to the patient."
    : !isPatientFitted(runtime.tools, "red-green") ? "Fit red OD / green OS glasses to the patient."
    : !runtime.tools.worth.powered ? "Turn on the Worth target."
    : !technique.facing ? "Aim either illuminated face toward the patient or seat it in the distance dock."
    : !technique.endpoint ? `Reposition the target from ${Math.round(technique.distanceCm)} cm to the 40 cm stand or the tagged distance dock.`
    : technique.endpoint && fixationEndpoint !== technique.endpoint ? `Ask Arun to look at the ${technique.endpoint === "near" ? "near" : "mirrored distance"} target.`
    : `${conditionLabel} · ask count, colours and positions`) + ` · ${history}${restartNotice ? ` · ${restartNotice}` : ""}`;
  const requestedPower = !runtime.tools.worth.powered;
  const powerAction: LessonAction = { label: requestedPower ? "SWITCH TARGET ON" : "SWITCH TARGET OFF", active: runtime.tools.worth.powered, disabled: lesson.recorded,
    run: () => setPower(requestedPower) };
  const placeAtSocket = (id: ConsultationToolId, socketId: string) => {
    const socket = sensorySockets("worth").find(candidate => candidate.tool === id && candidate.id === socketId);
    if (!socket) return;
    const tool = runtime.toolsRef.current[id];
    runtime.updateTools({ ...runtime.toolsRef.current, [id]: { ...tool,
      placement: { kind: "socket", position: socket.position, rotation: socket.rotation, socketId: socket.id, fittingLayer: socket.fittingLayer },
      revision: (tool.revision ?? 0) + 1 } });
  };
  const fixationAction: LessonAction = { label: fixationEndpoint === technique.endpoint && fixationEndpoint !== null ? "LOOKING AT TARGET ✓" : "LOOK AT THE TARGET",
    active: fixationEndpoint === technique.endpoint && fixationEndpoint !== null,
    disabled: !technique.setupReady || !technique.endpoint || lesson.recorded, run: fixate };
  const reportAction: LessonAction = { label: "ASK COUNT, COLOURS AND POSITIONS", disabled: !technique.ready || lesson.recorded, run: askFresh };
  const actions: LessonAction[] = [
    powerAction,
    fixationAction,
    reportAction,
    { label: "NEW PATIENT PATTERN", run: next },
    ...(inputMode === "desktop" ? [
      { label: "FIT CORRECTION", active: isPatientFitted(runtime.tools, "subjective"), run: () => placeAtSocket("subjective", "sensory-correction") },
      { label: "FIT RED / GREEN GLASSES", active: isPatientFitted(runtime.tools, "red-green"), run: () => placeAtSocket("red-green", "sensory-red-green") },
      { label: "PLACE TARGET · NEAR 40 CM", active: technique.endpoint === "near", run: () => placeAtSocket("worth", "sensory-worth-near") },
      { label: "PLACE TARGET · MIRRORED DISTANCE", active: technique.endpoint === "distance", run: () => placeAtSocket("worth", "sensory-worth-distance") },
    ] : []),
  ];
  const ready = active && !preview && Boolean(captured?.endpoint && !records[captured.endpoint]);
  const guidance = worthGuidedStep({ correctionFitted: isPatientFitted(runtime.tools, "subjective"), filtersFitted: isPatientFitted(runtime.tools, "red-green"),
    targetHandled: (runtime.tools.worth.revision ?? 0) > 0, targetHeld: runtime.tools.worth.placement.kind === "held", powered: runtime.tools.worth.powered,
    condition: { endpoint: technique.endpoint, facing: technique.facing, distanceCm: technique.distanceCm },
    fixationEndpoint, captureEndpoint: captured?.endpoint ?? null, nearRecorded: Boolean(records.near), distanceRecorded: Boolean(records.distance) });
  const directActions = !runtime.tools.worth.powered ? [powerAction]
    : technique.endpoint && fixationEndpoint !== technique.endpoint ? [fixationAction]
      : technique.endpoint && !captured ? [reportAction] : [];
  const voiceReport = captured ? `I see ${captured.report.charAt(0).toLowerCase()}${captured.report.slice(1)}` : undefined;
  useEffect(() => { onMirror?.({ title: "Worth four dot", voiceReport, reportLines: Object.values(records).map(record => `${record.capture.endpoint}: ${record.capture.report} Entered ${record.submittedCount} dots · ${record.submittedInterpretation}`), findingPosition: { current: index + 1, total: worthCases.length }, status, ready,
    entryReady: ready, fields, actions, lesson, reset, record, next, cancel }); },
    [onMirror, status, ready, technique.ready, technique.setupReady, lesson.mode, lesson.entries, lesson.feedback, lesson.recorded, index, runtime.tools, voiceReport]);
  return <>
    <XRClinicRuntimeView cleanHands runtime={runtime} active={active} preview={preview} sensoryStation="worth" title="WORTH FOUR DOT · PRACTICE"
      instruction="Fit frames · move target · ask and record each endpoint" showWallInstructions={!guided}
      showInstructionalHighlights={guided}
      instrumentSettings={{ worth: { powered: runtime.tools.worth.powered, onPowerChange: setPower } }} />
    {(active || preview) && guided && <XRGuidedStepBubble stepId={guidance.id} stepNumber={guidance.index + 1}
      total={WORTH_GUIDED_STEP_COUNT} title={guidance.title} lines={guidance.lines} complete={guidance.complete} />}
    {active && captured && <group position={[.62, 1.65, -.15]} userData={{ xrIgnoreRay: true }}>
      <Box s={[.47, .34, .012]} c="#07151b" />
      <XRSign text={["FICTIONAL PATIENT-REPORTED VIEW", captured.report, "Enlarged illustration; not calibrated optics."]} p={[0, .10, .012]} size={[.45, .13]} bg="#07151b" fg="#eefbf7" />
      <group position={[0, -.05, .015]}><ReportDots finding={captured.finding} /></group>
    </group>}
    <PracticeLessonUI runtime={runtime} active={active} title="WORTH FOUR DOT" status={status} tools={["subjective", "red-green", "worth"]} actions={actions} directActions={directActions} fields={fields}
      lesson={lesson} entryReady={ready} ready={ready} onRecord={record} onReset={reset} onNext={next} onExit={onExit} onCancel={cancel}
      forceBoardVisible={Boolean(captured)}
      help={["Fit correction, then the fixed red OD / green OS glasses.", "Use the free controller to press the target switch on either face.", "Near: aim either illuminated face toward the patient at about 40 cm or use the stand.", "Distance: seat either face in the simulated mirrored 6 m dock.", "Ask for count, colours and positions at each condition.", "Report captures survive release. Enter your own count and interpretation."]} />
  </>;
}
