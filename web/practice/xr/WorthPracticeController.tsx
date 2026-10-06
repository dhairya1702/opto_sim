import { useCallback, useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { worthCases, worthDots } from "../../interaction/worth";
import { captureWorthReport, recordWorthEndpoint, worthCaptureSubmission, worthComparisonComplete, xrWorthTechnique,
  type WorthCapture, type WorthFilter, type WorthRecords } from "../../interaction/xrWorthPractice";
import { useXRClinicRuntime } from "../../interaction/useXRClinicRuntime";
import { isPatientFitted, sensoryEquipment, sensoryFittingSignature, sensorySockets, sensoryTargetCondition } from "../../interaction/xrSensoryEquipment";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { XRHeadPanel, XRPanelButton, XRSign } from "../../scene/XRClinicPanels";
import { Box } from "../../scene/Models";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonAction, type LessonField } from "./PracticeLessonUI";

const fields: LessonField[] = [
  { id: "count", label: "Number of reported dots", choices: [2, 3, 4, 5].map(value => [String(value), `${value} dots`] as const) },
  { id: "interpretation", label: "Interpretation", choices: [["flat-fusion", "Flat fusion"], ["left-suppression", "Left-eye suppression"],
    ["right-suppression", "Right-eye suppression"], ["eso", "Eso · uncrossed"], ["exo", "Exo · crossed"], ["left-hyper", "Left hyper"], ["right-hyper", "Right hyper"]] },
];
const noChecks = () => ({ red: false, green: false });
function ReportDots({ finding }: { finding: WorthCapture["finding"] }) {
  return <group userData={{ xrIgnoreRay: true }}>{worthDots(finding).map((dot, i) => <mesh key={i} position={[dot.x * .001, -dot.y * .001, .018]}>
    <circleGeometry args={[.008, 24]} /><meshBasicMaterial color={dot.color} />
  </mesh>)}</group>;
}

export function WorthPracticeController({ active, preview = false, onComplete, onExit, onMirror }: {
  active: boolean; preview?: boolean; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const [index, setIndex] = useState(0);
  const lesson = usePracticeLesson(onComplete);
  const attempt = useRef(0), revision = useRef(0);
  const verifiedRef = useRef(noChecks()), filterRef = useRef<WorthFilter | null>(null);
  const [verified, setVerified] = useState(noChecks), [filter, setFilter] = useState<WorthFilter | null>(null);
  const capturedRef = useRef<WorthCapture | null>(null), recordsRef = useRef<WorthRecords>({});
  const [captured, setCaptured] = useState<WorthCapture | null>(null), [records, setRecords] = useState<WorthRecords>({});
  const clearPending = lesson.clearPending;
  const interrupt = useCallback(() => { if (!capturedRef.current) clearPending(); }, [clearPending]);
  const runtime = useXRClinicRuntime({ active, equipment: sensoryEquipment("worth"), placementSockets: sensorySockets("worth"),
    editorOpen: lesson.mode !== "none", onInterrupt: interrupt,
    onToolUsed: (id, action) => { if (id === "worth" && action === "activate") askFresh(); },
    onMenu: open => lesson.setMode(open ? "menu" : "none"),
    onSelection: selection => { if (selection.station === "patient") lesson.setMode("menu"); },
  });
  const sample = () => {
    const pose = runtime.supportedWorkingPose("worth", true);
    return { active: active && !preview && runtime.frameValid.current,
    correction: isPatientFitted(runtime.toolsRef.current, "subjective"), glasses: isPatientFitted(runtime.toolsRef.current, "red-green"),
    light: runtime.toolsRef.current.worth.powered, verified: verifiedRef.current, filter: filterRef.current,
    condition: pose ? sensoryTargetCondition(pose, runtime.toolsRef.current) : { distanceCm: 0, endpoint: null, facing: false },
  }; };
  const [technique, setTechnique] = useState(() => xrWorthTechnique(sample()));
  const fittedKey = useRef("");
  const clearCapture = () => { capturedRef.current = null; setCaptured(null); clearPending(); };
  const resetComparison = () => {
    revision.current++; clearCapture(); recordsRef.current = {}; setRecords({}); lesson.reset();
    verifiedRef.current = noChecks(); setVerified(noChecks()); filterRef.current = null; setFilter(null);
  };
  const clock = useRef(0);
  useFrame((_, dt) => {
    const input = sample();
    const key = sensoryFittingSignature(runtime.toolsRef.current, ["subjective", "red-green"]);
    if (fittedKey.current !== key) { fittedKey.current = key; resetComparison(); }
    // Completed elicited reports survive ordinary movement, release and panel use.
    // Fresh questions always sample the current target geometry.
    clock.current += dt;
    if (clock.current >= .1) { clock.current = 0; const next = xrWorthTechnique(input);
      setTechnique(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    }
  });
  const reset = useCallback(() => {
    attempt.current++; revision.current++; capturedRef.current = null; setCaptured(null); recordsRef.current = {}; setRecords({});
    verifiedRef.current = noChecks(); setVerified(noChecks()); filterRef.current = null; setFilter(null); fittedKey.current = "";
    lesson.reset(); runtime.resetClinic();
  }, [lesson.reset, runtime.resetClinic]);
  useEffect(() => { reset(); }, [index, reset]);
  useEffect(() => { if (!active) reset(); }, [active, reset]);
  const power = () => {
    if (!active || preview || lesson.awarded.current) return;
    clearCapture(); filterRef.current = null; setFilter(null);
    runtime.setToolPower("worth", !runtime.toolsRef.current.worth.powered);
  };
  const check = (value: WorthFilter) => {
    if (lesson.awarded.current || !xrWorthTechnique(sample()).filterReady) return;
    // Rechecking a filter explicitly begins a new comparison.
    revision.current++; clearCapture(); recordsRef.current = {}; setRecords({});
    verifiedRef.current = { ...verifiedRef.current, [value]: false }; setVerified(verifiedRef.current);
    filterRef.current = value; setFilter(value); lesson.setMode("settings");
  };
  const confirm = () => {
    const value = filterRef.current;
    if (!value || !xrWorthTechnique(sample()).filterReady) return;
    verifiedRef.current = { ...verifiedRef.current, [value]: true }; setVerified(verifiedRef.current);
    filterRef.current = null; setFilter(null); lesson.setMode("none");
  };
  function ask() {
    if (lesson.awarded.current || capturedRef.current || !active || preview) return;
    const capture = captureWorthReport(sample(), worthCases[index], attempt.current, revision.current);
    if (!capture) return;
    clearPending(); capturedRef.current = capture; setCaptured(capture);
  }
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
    lesson.submit(true, worthComparisonComplete(nextRecords), worthComparisonComplete(nextRecords)
      ? "Near 40 cm and mirrored distance 6 m independently recorded."
      : `${capture.endpoint === "near" ? "Near 40 cm" : "Mirrored distance 6 m"} recorded · move the target and request the other report.`);
  };
  const next = () => { if (active && !preview) { reset(); setIndex(value => (value + 1) % worthCases.length); } };
  const history = `Near ${records.near ? "recorded" : "pending"} · distance ${records.distance ? "recorded" : "pending"}`;
  const conditionLabel = technique.endpoint === "distance" ? "simulated mirrored 6 m path" : `${Math.round(technique.distanceCm)} cm`;
  const status = (filter ? `${filter === "red" ? "Red OD: green blocked, two red visible" : "Green OS: red blocked, three green visible"} · illustrative isolated-filter view; confirm then return to binocular viewing.`
    : captured ? `${captured.report} · captured ${captured.endpoint ?? "intermediate"} at ${Math.round(captured.actualDistanceCm)} cm`
    : !isPatientFitted(runtime.tools, "subjective") ? "Fit the trial frame with correction to the patient."
    : !isPatientFitted(runtime.tools, "red-green") ? "Fit red OD / green OS glasses to the patient."
    : !runtime.tools.worth.powered ? "Turn on the Worth target."
    : !verified.red || !verified.green ? "Inspect and confirm each isolated filter view."
    : !technique.facing ? "Face the illuminated target toward the patient or seat it in the distance dock."
    : `${conditionLabel} · ask count, colours and positions`) + ` · ${history}`;
  const actions: LessonAction[] = [
    { label: runtime.tools.worth.powered ? "SWITCH TARGET OFF" : "SWITCH TARGET ON", active: runtime.tools.worth.powered, disabled: lesson.recorded, run: power },
    { label: "ASK COUNT, COLOURS AND POSITIONS", disabled: !technique.ready || lesson.recorded, run: askFresh },
    { label: verified.red ? "RED FILTER CHECK ✓" : "CHECK RED FILTER", disabled: !technique.filterReady || lesson.recorded, run: () => check("red") },
    { label: verified.green ? "GREEN FILTER CHECK ✓" : "CHECK GREEN FILTER", disabled: !technique.filterReady || lesson.recorded, run: () => check("green") },
    ...(filter ? [{ label: "CONFIRM ISOLATED FILTER VIEW", disabled: !technique.filterReady, run: confirm }] : []),
    { label: "NEW PATIENT PATTERN", run: next },
  ];
  const ready = active && !preview && Boolean(captured?.endpoint && !records[captured.endpoint]);
  useEffect(() => { onMirror?.({ title: "Worth four dot", reportLines: Object.values(records).map(record => `${record.capture.endpoint}: ${record.capture.report} Entered ${record.submittedCount} dots · ${record.submittedInterpretation}`), findingPosition: { current: index + 1, total: worthCases.length }, status, ready,
    entryReady: ready, fields, actions, lesson, reset, record, next, cancel }); },
    [onMirror, status, ready, technique.ready, technique.filterReady, lesson.mode, lesson.entries, lesson.feedback, lesson.recorded, index, verified, filter, runtime.tools]);
  const settings = <XRHeadPanel>
    <Box s={[.76, .76, .018]} c="#102329" radius={.012} />
    <XRSign text={[`${filter === "red" ? "RED OD" : "GREEN OS"} · ISOLATED FILTER CHECK`, "Illustrative cancellation; not measured through the headset.",
      filter === "red" ? "Green blocked · two red dots visible" : "Red blocked · three green dots visible"]} p={[0, .23, .012]} size={[.70, .23]} bg="#102329" fg="#eefbf7" />
    {filter && <ReportDots finding={filter === "red" ? "suppress-os" : "suppress-od"} />}
    <XRPanelButton label="CONFIRM ISOLATED FILTER VIEW" position={[0, -.16, .025]} width={.70} disabled={!technique.filterReady || !filter} onClick={confirm} />
    <XRPanelButton label="CANCEL FILTER CHECK" position={[-.18, -.25, .025]} width={.34} onClick={() => { filterRef.current = null; setFilter(null); lesson.setMode("none"); }} />
    <XRPanelButton label="EXIT VR" position={[.18, -.25, .025]} width={.34} onClick={onExit} />
  </XRHeadPanel>;
  return <>
    <XRClinicRuntimeView cleanHands runtime={runtime} active={active} preview={preview} sensoryStation="worth" title="WORTH FOUR DOT · PRACTICE" instruction="Fit frames · check filters · move target · ask and record each endpoint" />
    {active && captured && <group position={[.62, 1.65, -.15]} userData={{ xrIgnoreRay: true }}>
      <Box s={[.47, .34, .012]} c="#07151b" />
      <XRSign text={["FICTIONAL PATIENT-REPORTED VIEW", captured.report, "Enlarged illustration; not calibrated optics."]} p={[0, .10, .012]} size={[.45, .13]} bg="#07151b" fg="#eefbf7" />
      <group position={[0, -.05, .015]}><ReportDots finding={captured.finding} /></group>
    </group>}
    <PracticeLessonUI runtime={runtime} active={active} title="WORTH FOUR DOT" status={status} tools={["worth", "red-green"]} actions={actions} directActions={actions.slice(0, 4)} fields={fields}
      lesson={lesson} entryReady={ready} ready={ready} onRecord={record} onReset={reset} onNext={next} onExit={onExit} onCancel={cancel} settings={settings}
      help={["Fit correction, then red OD / green OS glasses.", "Turn target on; inspect and confirm each isolated filter.", "Near: face target to patient at about 40 cm or use stand.", "Distance: seat target in the simulated mirrored 6 m dock.", "Ask for count, colours and positions at each condition.", "Report captures survive release. Enter your own count and interpretation."]} />
  </>;
}
