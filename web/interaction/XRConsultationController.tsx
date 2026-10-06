import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { DoubleSide, Object3D, Quaternion, Vector3 } from "three";
import type { ClinicalCase, Eye, StationId } from "../domain/types";
import { Box } from "../scene/Models";
import { XRSign as Sign, XRPanelButton, XRHeadPanel, XRObservationPanel, XRToolControls } from "../scene/XRClinicPanels";
import { useXRClinicRuntime, type XRClinicInterruption } from "./useXRClinicRuntime";
import { XRClinicRuntimeView } from "../scene/XRClinicRuntimeView";
import { pauseConsultationTechnique } from "./xrConsultationProcedure";
import { CONSULTATION_TOOLS, consultationToolDefinition, consultationToolReady, toolInHand } from "./xrConsultationTools";
import {
  advanceXRPupilObservation,
  initialXRPupilObservation,
  xrPupilEyeFromRay,
  type XRPupilEye,
} from "./xrPupils";
import { coverProcedure, type CoverPosition } from "./cover";
import { advanceXRCoverState, initialXRCoverState, xrCoverComplete, xrCoverFixationMode, xrCoverPositionAt } from "./xrCover";
import { gazePositions, observeTarget, type FixationTarget, type MotilityCoverage } from "./motility";
import { xrMotilityTarget } from "./xrMotility";

import { formatSignedDioptres, reflexMotion } from "./retinoscopy";
import { advanceScopeInspection, advanceScopeSweep, initialScopeInspection, initialScopeSweep, pauseScopeSweep, scopeCaseSphere, scopeReflex, scopeSweepComplete, xrScopeAim, xrScopeViewer, type ScopeAim } from "./xrScopes";
import { XRRetinoscopyReflex, type RetinoReflexVisual } from "../scene/XRRetinoscopyReflex";
import type { FundusScopeView } from "../scene/XRScopeOptics";
import { CLINIC_PATIENT_EYES as PUPIL_EYES, CLINIC_EYE_MIDPOINT as EYE_MIDPOINT } from "./clinicPatient";

export type ConsultationExam = "pupils" | "cover" | "motility" | "objective" | "fundus";
export type ConsultationPanel = "interview" | "notes" | "submission";
const isConsultationExam = (id?: string): id is ConsultationExam => id === "pupils" || id === "cover" || id === "motility" || id === "objective" || id === "fundus";


function cycle(current: string, values: string[], update: (value: string) => void) {
  update(values[(values.indexOf(current) + 1) % values.length]);
}

function XRPupilPanel({ recordingOnly = false, fixation, dimmed, light, seen, activeEye, odSize, osSize, equality, odDirect, osDirect, consensual, onFixation, onDimmed, onOdSize, onOsSize, onEquality, onOdDirect, onOsDirect, onConsensual, onRecord, onCancel }: {
  recordingOnly?: boolean;
  fixation: boolean;
  dimmed: boolean;
  light: boolean;
  seen: XRPupilEye[];
  activeEye: XRPupilEye | null;
  odSize: string;
  osSize: string;
  equality: string;
  odDirect: string;
  osDirect: string;
  consensual: string;
  onFixation: () => void;
  onDimmed: () => void;
  onOdSize: () => void;
  onOsSize: () => void;
  onEquality: () => void;
  onOdDirect: () => void;
  onOsDirect: () => void;
  onConsensual: () => void;
  onRecord: () => void;
  onCancel: () => void;
}) {
  const inspected = seen.length === 2;
  const complete = Boolean(odSize && osSize && equality && odDirect && osDirect && consensual);
  const status = !fixation
    ? "Ask Arun to fixate in the distance."
    : !dimmed
      ? "Dim the room before using the light."
      : !inspected
        ? light && activeEye ? `Hold steady on ${activeEye}.` : `Trigger light · inspect ${seen.includes("OD") ? "OS" : "OD"}.`
        : light ? "Release trigger before recording." : "Sequence complete · enter observations.";
  if (recordingOnly) return <XRObservationPanel tool="Penlight · both eyes" status={
    !fixation ? "Ask the patient to look straight ahead first." : !dimmed ? "Dim the room and inspect both eyes." : !inspected ? "Inspect both eyes at ~20–80 cm; move light clear between eyes." : light ? "Release the light trigger before saving." : "Enter what you observed."
  } fields={[
    { label: "OD SIZE", value: odSize, enabled: inspected, onChange: onOdSize },
    { label: "OS SIZE", value: osSize, enabled: inspected, onChange: onOsSize },
    { label: "EQUALITY", value: equality, enabled: inspected, onChange: onEquality },
    { label: "CONSENSUAL", value: consensual, enabled: inspected, onChange: onConsensual },
    { label: "OD DIRECT", value: odDirect, enabled: inspected, onChange: onOdDirect },
    { label: "OS DIRECT", value: osDirect, enabled: inspected, onChange: onOsDirect },
  ]} ready={inspected && complete && !light} onRecord={onRecord} onCancel={onCancel} />;
  return <group position={[.74, 1.55, -.82]} rotation={[0, -.55, 0]} userData={{ xrPanel: true }}>
    <mesh position={[0, -.12, -.012]}>
      <planeGeometry args={[.62, 1.02]} />
      <meshBasicMaterial color="#102329" side={DoubleSide} />
    </mesh>
    <Sign text={["PUPIL ASSESSMENT · OU", `${seen.includes("OD") ? "✓" : "○"} OD direct / OS consensual`, `${seen.includes("OS") ? "✓" : "○"} OS direct / OD consensual`, status]} p={[0, .245, 0]} size={[.58, .31]} bg="#102329" fg="#eefbf7" />
    <XRPanelButton label={fixation ? "FIXATION GIVEN ✓" : "GIVE DISTANT FIXATION"} position={[0, .045, .012]} width={.56} active={fixation} onClick={onFixation} />
    <XRPanelButton label={dimmed ? "RESTORE ROOM LIGHTS" : "DIM ROOM"} position={[0, -.035, .012]} width={.56} active={dimmed} onClick={onDimmed} />
    <XRPanelButton label={`OD SIZE · ${odSize || "CHOOSE"}`} position={[-.145, -.145, .012]} width={.27} disabled={!inspected} onClick={onOdSize} />
    <XRPanelButton label={`OS SIZE · ${osSize || "CHOOSE"}`} position={[.145, -.145, .012]} width={.27} disabled={!inspected} onClick={onOsSize} />
    <XRPanelButton label={`EQUALITY · ${(equality || "CHOOSE").toUpperCase()}`} position={[0, -.225, .012]} width={.56} disabled={!inspected} onClick={onEquality} />
    <XRPanelButton label={`OD DIRECT · ${(odDirect || "CHOOSE").toUpperCase()}`} position={[-.145, -.305, .012]} width={.27} disabled={!inspected} onClick={onOdDirect} />
    <XRPanelButton label={`OS DIRECT · ${(osDirect || "CHOOSE").toUpperCase()}`} position={[.145, -.305, .012]} width={.27} disabled={!inspected} onClick={onOsDirect} />
    <XRPanelButton label={`CONSENSUAL · ${(consensual || "CHOOSE").toUpperCase()}`} position={[0, -.385, .012]} width={.56} disabled={!inspected} onClick={onConsensual} />
    <XRPanelButton label="CANCEL" position={[-.145, -.47, .012]} width={.27} onClick={onCancel} />
    <XRPanelButton label="RECORD FINDING" position={[.145, -.47, .012]} width={.27} active={inspected && complete && !light} disabled={!inspected || !complete || light} onClick={onRecord} />
  </group>;
}

const COVER_MOVEMENTS = ["", "none", "inward", "outward", "vertical", "uncertain"];

function XRCoverPanel({ recordingOnly = false, mode, targetDistanceCm, setupValid, asked, step, position, odMovement, osMovement, alternateMovement, interpretation, onAsked, onOdMovement, onOsMovement, onAlternateMovement, onInterpretation, onRecord, onCancel }: {
  recordingOnly?: boolean;
  mode: "distance" | "near";
  targetDistanceCm: number;
  setupValid: boolean;
  asked: boolean;
  step: number;
  position: CoverPosition | null;
  odMovement: string;
  osMovement: string;
  alternateMovement: string;
  interpretation: string;
  onAsked: () => void;
  onOdMovement: () => void;
  onOsMovement: () => void;
  onAlternateMovement: () => void;
  onInterpretation: () => void;
  onRecord: () => void;
  onCancel: () => void;
}) {
  const complete = step === coverProcedure.length;
  const observationComplete = Boolean(odMovement && osMovement && alternateMovement && interpretation);
  const current = coverProcedure[step];
  const status = !asked
    ? !setupValid
      ? "Move the target to 35–50 cm or beyond 70 cm."
      : `Target detected at ${Math.round(targetDistanceCm)} cm · give fixation.`
    : complete
      ? "Sequence complete · record observed movements."
      : position === current?.position
        ? `${current.label} · hold steady.`
        : current?.position === "away"
          ? "Move the occluder clear of both eyes."
          : `Place the occluder over ${current?.position}.`;
  if (recordingOnly) return <XRObservationPanel tool={`Occluder · ${mode}`} status={complete ? "Enter the movements you observed." : !asked ? "Ask the patient to look at the target first." : "The examination is incomplete; check both eyes and alternate coverage."} fields={[
    { label: "OD", value: odMovement, enabled: complete, onChange: onOdMovement },
    { label: "OS", value: osMovement, enabled: complete, onChange: onOsMovement },
    { label: "ALTERNATE", value: alternateMovement, enabled: complete, onChange: onAlternateMovement },
    { label: "INTERPRET", value: interpretation, enabled: complete, onChange: onInterpretation },
  ]} ready={complete && observationComplete} onRecord={onRecord} onCancel={onCancel} />;
  return <group position={[.74, 1.55, -.82]} rotation={[0, -.55, 0]} userData={{ xrPanel: true }}>
    <mesh position={[0, -.08, -.012]}><planeGeometry args={[.62, .94]} /><meshBasicMaterial color="#102329" side={DoubleSide} /></mesh>
    <Sign text={[`COVER TEST · ${mode.toUpperCase()}`, `${Math.min(step, coverProcedure.length)} / ${coverProcedure.length} technique steps`, step < 4 ? "Cover–uncover" : step < coverProcedure.length ? "Alternating cover" : "Technique complete", status]} p={[0, .245, 0]} size={[.58, .31]} bg="#102329" fg="#eefbf7" />
    <XRPanelButton label={`${mode.toUpperCase()} · ${Math.round(targetDistanceCm)} CM`} position={[-.145, .045, .012]} width={.27} disabled onClick={() => undefined} />
    <XRPanelButton label={asked ? "FIXATION ✓" : "GIVE FIXATION"} position={[.145, .045, .012]} width={.27} active={asked} disabled={!setupValid} onClick={onAsked} />
    <XRPanelButton label={`OD · ${(odMovement || "CHOOSE").toUpperCase()}`} position={[-.145, -.075, .012]} width={.27} disabled={!complete} onClick={onOdMovement} />
    <XRPanelButton label={`OS · ${(osMovement || "CHOOSE").toUpperCase()}`} position={[.145, -.075, .012]} width={.27} disabled={!complete} onClick={onOsMovement} />
    <XRPanelButton label={`ALTERNATE · ${(alternateMovement || "CHOOSE").toUpperCase()}`} position={[0, -.155, .012]} width={.56} disabled={!complete} onClick={onAlternateMovement} />
    <XRPanelButton label={`INTERPRET · ${(interpretation || "CHOOSE").toUpperCase()}`} position={[0, -.235, .012]} width={.56} disabled={!complete} onClick={onInterpretation} />
    <XRPanelButton label="CANCEL" position={[-.145, -.34, .012]} width={.27} onClick={onCancel} />
    <XRPanelButton label="RECORD FINDING" position={[.145, -.34, .012]} width={.27} active={observationComplete} disabled={!complete || !observationComplete} onClick={onRecord} />
  </group>;
}

function XRMotilityPanel({ recordingOnly = false, following, light, distanceCm, distanceReady, coverage, symptomsAsked, observation, onFollowing, onSymptoms, onObservation, onRecord, onCancel }: {
  recordingOnly?: boolean;
  following: boolean;
  light: boolean;
  distanceCm: number;
  distanceReady: boolean;
  coverage: MotilityCoverage;
  symptomsAsked: boolean;
  observation: string;
  onFollowing: () => void;
  onSymptoms: () => void;
  onObservation: () => void;
  onRecord: () => void;
  onCancel: () => void;
}) {
  const complete = coverage.seen.length === gazePositions.length;
  const current = gazePositions.find(position => position.id === coverage.current);
  const status = !following
    ? "Ask Arun to follow the light with his eyes."
    : !distanceReady
      ? "Move the target into the 28–45 cm working zone."
      : !light
        ? "Hold the target trigger to illuminate it."
        : complete
          ? "H-pattern complete · ask about symptoms."
          : current ? `${current.label} · hold steady.` : "Move through centre and eight gaze positions.";
  const ready = complete && symptomsAsked && Boolean(observation) && !light;
  if (recordingOnly) return <XRObservationPanel tool="Fixation target · both eyes" status={complete ? "Enter what you observed and ask about symptoms." : !following ? "Ask the patient to follow the target first." : "Movement observation is incomplete."} fields={[
    { label: "OBSERVATION", value: observation, enabled: complete && symptomsAsked, onChange: onObservation },
  ]} extra={{ label: symptomsAsked ? "SYMPTOMS ASKED ✓" : "ASK DIPLOPIA / PAIN", enabled: complete, onClick: onSymptoms }} ready={ready} onRecord={onRecord} onCancel={onCancel} />;
  return <group position={[.74, 1.55, -.82]} rotation={[0, -.55, 0]} userData={{ xrPanel: true }}>
    <mesh position={[0, -.05, -.012]}><planeGeometry args={[.62, .86]} /><meshBasicMaterial color="#102329" side={DoubleSide} /></mesh>
    <Sign text={["OCULAR MOTILITY · OU", `${coverage.seen.length} / ${gazePositions.length} gaze positions`, `${Math.round(distanceCm)} cm · ${light ? "light on" : "trigger light"}`, status]} p={[0, .245, 0]} size={[.58, .31]} bg="#102329" fg="#eefbf7" />
    <XRPanelButton label={following ? "STOP FOLLOWING" : "GIVE FOLLOWING INSTRUCTION"} position={[0, .04, .012]} width={.56} active={following} onClick={onFollowing} />
    <XRPanelButton label={symptomsAsked ? "SYMPTOMS ASKED ✓" : "ASK DIPLOPIA / PAIN"} position={[0, -.06, .012]} width={.56} active={symptomsAsked} disabled={!complete} onClick={onSymptoms} />
    <XRPanelButton label={`OBSERVATION · ${(observation || "CHOOSE").toUpperCase()}`} position={[0, -.14, .012]} width={.56} disabled={!symptomsAsked} onClick={onObservation} />
    <XRPanelButton label="CANCEL" position={[-.145, -.255, .012]} width={.27} onClick={onCancel} />
    <XRPanelButton label="RECORD FINDING" position={[.145, -.255, .012]} width={.27} active={ready} disabled={!ready} onClick={onRecord} />
  </group>;
}

export function XRConsultationController({ active, preview = false, guided = false, patientName = "Patient", selectedExamId, onInteract, onProcedureComplete, onOpenPanel, onExitVR, caseData }: {
  active: boolean;
  caseData: ClinicalCase;
  preview?: boolean;
  /** Optional technique UI is retained for later work; the consultation defaults to free exploration. */
  guided?: boolean;
  patientName?: string;
  onOpenPanel?: (panel: ConsultationPanel) => void;
  onExitVR?: () => void;
  selectedExamId?: string;
  onInteract: (id: StationId, examId?: string) => void;
  onProcedureComplete?: (exam: ConsultationExam, mode: string, observation: string, eye?: Eye) => boolean | void;
}) {
  const { gl, scene } = useThree();
  const [menuOpen, setMenuOpen] = useState(false);
  const [recordingExam, setRecordingExam] = useState<ConsultationExam | null>(null);
  const lastUsedExam = useRef<ConsultationExam | null>(null);
  const [panelExam, setPanelExam] = useState<ConsultationExam | null>(null);
  useEffect(() => {
    if (guided && isConsultationExam(selectedExamId)) setPanelExam(selectedExamId);
  }, [guided, selectedExamId]);
  const [fixation, setFixation] = useState(false);
  const [dimmed, setDimmed] = useState(false);
  const [seen, setSeen] = useState<XRPupilEye[]>([]);
  const [activeEye, setActiveEye] = useState<XRPupilEye | null>(null);
  const [odSize, setOdSize] = useState("");
  const [osSize, setOsSize] = useState("");
  const [equality, setEquality] = useState("");
  const [odDirect, setOdDirect] = useState("");
  const [osDirect, setOsDirect] = useState("");
  const [consensual, setConsensual] = useState("");
  const pupilDwell = useRef(initialXRPupilObservation());
  const procedureActive = active && guided && panelExam === "pupils";
  const coverProcedureActive = active && guided && panelExam === "cover";
  const [coverMode, setCoverMode] = useState<"distance" | "near">("distance");
  const [coverAsked, setCoverAsked] = useState(false);
  const [coverState, setCoverState] = useState(initialXRCoverState);
  const coverStateRef = useRef(coverState);
  const [coverPosition, setCoverPosition] = useState<CoverPosition | null>("away");
  const [coverOdMovement, setCoverOdMovement] = useState("");
  const [coverOsMovement, setCoverOsMovement] = useState("");
  const [coverAlternateMovement, setCoverAlternateMovement] = useState("");
  const [coverInterpretation, setCoverInterpretation] = useState("");
  const [coverTargetDistance, setCoverTargetDistance] = useState(0);
  const [coverSetupValid, setCoverSetupValid] = useState(false);
  const coverModeRef = useRef<"distance" | "near">(coverMode);
  coverModeRef.current = coverMode;
  const motilityProcedureActive = active && guided && panelExam === "motility";
  const [motilityFollowing, setMotilityFollowing] = useState(false);
  const [motilityCoverage, setMotilityCoverage] = useState<MotilityCoverage>({ seen: [], current: null, dwell: 0 });
  const motilityCoverageRef = useRef(motilityCoverage);
  const [motilityTarget, setMotilityTarget] = useState<FixationTarget>({ x: 0, y: 0, z: .35 });
  const [motilityDistance, setMotilityDistance] = useState(0);
  const [motilityDistanceReady, setMotilityDistanceReady] = useState(false);
  const [motilitySymptomsAsked, setMotilitySymptomsAsked] = useState(false);
  const [motilityObservation, setMotilityObservation] = useState("");

  const [recordEye, setRecordEye] = useState<XRPupilEye>("OD");
  const [, setScopeRevision] = useState(0);
  const scopeClock = useRef(0);
  const [trialLens, setTrialLens] = useState(-.5);
  const trialLensRef = useRef(trialLens); trialLensRef.current = trialLens;
  const [streakAxis, setStreakAxis] = useState<90 | 180>(90);
  const streakAxisRef = useRef(streakAxis); streakAxisRef.current = streakAxis;
  const retinoAim = useRef<ScopeAim | null>(null);
  const lastScopeEye = useRef<Record<"objective" | "fundus", XRPupilEye>>({ objective: "OD", fundus: "OD" });
  const retinoSweeps = useRef({ OD: initialScopeSweep(), OS: initialScopeSweep() });
  const fundusInspections = useRef({ OD: initialScopeInspection(), OS: initialScopeInspection() });
  const fundusView = useMemo<FundusScopeView>(() => ({ visible: false, x: 0, y: 0 }), []);
  const reflexVisual = useMemo<RetinoReflexVisual>(() => ({ eye: null, offset: 0, brightness: 0, width: 0, axis: 90 }), []);
  const [grossEntry, setGrossEntry] = useState("");
  const [correctionEntry, setCorrectionEntry] = useState("");
  const [netEntry, setNetEntry] = useState("");
  const [cylinderEntry, setCylinderEntry] = useState("");
  const [axisEntry, setAxisEntry] = useState("");
  const [discEntry, setDiscEntry] = useState("");
  const [maculaEntry, setMaculaEntry] = useState("");
  const [poleEntry, setPoleEntry] = useState("");
  const [extentEntry, setExtentEntry] = useState("");
  const scopeFieldsReset = () => {
    setGrossEntry(""); setCorrectionEntry(""); setNetEntry(""); setCylinderEntry(""); setAxisEntry("");
    setDiscEntry(""); setMaculaEntry(""); setPoleEntry(""); setExtentEntry("");
  };
  const requestRecording = (exam: ConsultationExam) => {
    setRecordingExam(exam); scopeFieldsReset();
    if (exam === "objective" || exam === "fundus") setRecordEye(lastScopeEye.current[exam]);
  };
  const changeTrialLens = (delta: number) => {
    const value = Math.max(-2, Math.min(2, Math.round((trialLensRef.current + delta) * 4) / 4));
    trialLensRef.current = value; setTrialLens(value);
    retinoSweeps.current.OD = pauseScopeSweep(retinoSweeps.current.OD);
    retinoSweeps.current.OS = pauseScopeSweep(retinoSweeps.current.OS);
  };
  const changeStreak = () => {
    const axis = streakAxisRef.current === 90 ? 180 : 90;
    streakAxisRef.current = axis; setStreakAxis(axis);
    retinoSweeps.current.OD = pauseScopeSweep(retinoSweeps.current.OD);
    retinoSweeps.current.OS = pauseScopeSweep(retinoSweeps.current.OS);
  };

  const pauseTechnique = useCallback((reason?: XRClinicInterruption) => {
    if (reason === "configuration") {
      fundusInspections.current = { OD: initialScopeInspection(), OS: initialScopeInspection() };
      setDiscEntry(""); setMaculaEntry(""); setPoleEntry(""); setExtentEntry("");
    }
    const paused = pauseConsultationTechnique({ pupils: pupilDwell.current, cover: coverStateRef.current, motility: motilityCoverageRef.current });
    pupilDwell.current = paused.pupils;
    setActiveEye(null);
    retinoSweeps.current.OD = pauseScopeSweep(retinoSweeps.current.OD);
    retinoSweeps.current.OS = pauseScopeSweep(retinoSweeps.current.OS);
    fundusInspections.current.OD.dwell = 0; fundusInspections.current.OS.dwell = 0;
    fundusView.visible = false; reflexVisual.eye = null;
    coverStateRef.current = paused.cover;
    setCoverState(paused.cover);
    motilityCoverageRef.current = paused.motility;
    setMotilityCoverage(paused.motility);
  }, [fundusView, reflexVisual]);
  const runtime = useXRClinicRuntime({ active, editorOpen: Boolean(recordingExam), onInterrupt: pauseTechnique,
    onMenu: open => { setMenuOpen(open); if (!open) setRecordingExam(null); },
    onToolUsed: (id, action) => {
      if (isConsultationExam(id)) lastUsedExam.current = id;
      if (action === "pickup" && guided && isConsultationExam(id) && !(id === "motility" && runtime.toolsRef.current.cover.placement.kind === "held")) setPanelExam(id);
    },
    onSelection: data => {
      if (guided && isConsultationExam(data.examId)) setPanelExam(data.examId);
      else if (!guided && data.examId && CONSULTATION_TOOLS.some(tool => tool.id === data.examId)) runtime.setHandlingMessage("Bring your hand beside the handle and hold the side grip to pick it up.");
      else if (!guided && data.station === "patient") setMenuOpen(true);
      else if (!guided && (data.station === "trolley" || data.station === "refraction" || data.station === "fundus")) return;
      else if (data.station) onInteract(data.station, data.examId);
    },
  });
  const { tools, toolsRef, slots, objects, frameValid, setHandlingMessage, origin, direction, quaternion, workingPose, handStatus } = runtime;
  const pupilLight = tools.pupils.powered;
  const motilityLight = tools.motility.powered;
  const selectedPlacement = tools.cover.placement;
  const heldHand = selectedPlacement.kind === "held" ? selectedPlacement.hand : null;
  const resetPupil = useCallback(() => {
    setSeen([]);
    setOdSize(""); setOsSize(""); setEquality(""); setOdDirect(""); setOsDirect(""); setConsensual("");
    pupilDwell.current = initialXRPupilObservation();
  }, []);

  const resetCover = useCallback(() => {
    const initial = initialXRCoverState();
    coverStateRef.current = initial;
    setCoverState(initial);
    setCoverAsked(false); setCoverPosition("away"); setCoverTargetDistance(0); setCoverSetupValid(false);
    setCoverOdMovement(""); setCoverOsMovement(""); setCoverAlternateMovement(""); setCoverInterpretation("");
  }, []);


  const resetMotility = useCallback(() => {
    const coverage = { seen: [], current: null, dwell: 0 };
    motilityCoverageRef.current = coverage;
    setMotilityCoverage(coverage);
    setMotilityTarget({ x: 0, y: 0, z: .35 }); setMotilityDistance(0); setMotilityDistanceReady(false);
    setMotilitySymptomsAsked(false); setMotilityObservation("");
  }, []);

  useEffect(() => {
    if (active) return;
    resetPupil(); resetCover(); resetMotility();
    setFixation(false); setDimmed(false); setMotilityFollowing(false); setPanelExam(null); setMenuOpen(false); setRecordingExam(null); lastUsedExam.current = null;
    retinoSweeps.current = { OD: initialScopeSweep(), OS: initialScopeSweep() };
    fundusInspections.current = { OD: initialScopeInspection(), OS: initialScopeInspection() };
    fundusView.visible = false; reflexVisual.eye = null;
    trialLensRef.current = -.5; setTrialLens(-.5); setStreakAxis(90); streakAxisRef.current = 90;
  }, [active, resetPupil, resetCover, resetMotility]);

  useEffect(() => {
    if (!active || !dimmed) return;
    const previous = new Map<Object3D, number>();
    scene.traverse(object => {
      const lightObject = object as Object3D & { isLight?: boolean; intensity?: number };
      if (!lightObject.isLight || object.userData.instrumentLight || typeof lightObject.intensity !== "number") return;
      previous.set(object, lightObject.intensity);
      lightObject.intensity *= .38;
    });
    return () => previous.forEach((intensity, object) => {
      (object as Object3D & { intensity: number }).intensity = intensity;
    });
  }, [dimmed, active, scene]);

  useFrame((_, dt) => {
    if (!active) return;
    let eye: XRPupilEye | null = null;
    const ready = workingPose("pupils");
    const powered = ready && toolsRef.current.pupils.powered;
    if (powered) {
      eye = xrPupilEyeFromRay(
        origin.toArray() as [number, number, number],
        direction.toArray() as [number, number, number],
        PUPIL_EYES, 12, [.03, 1.2],
      );
    }
    // Visible response is immediate; observation credit retains the technique working zone.
    const techniqueEye = powered ? xrPupilEyeFromRay(origin.toArray() as [number, number, number], direction.toArray() as [number, number, number], PUPIL_EYES) : null;
    const previous = pupilDwell.current;
    const next = advanceXRPupilObservation(previous, { setupReady: ready && fixation && dimmed, light: powered, aimedEye: techniqueEye, dt: frameValid.current ? dt : 0 });
    pupilDwell.current = next;
    if (activeEye !== eye) setActiveEye(eye);
    if (next.seen.length !== previous.seen.length) setSeen(next.seen);
  });

  useFrame((_, dt) => {
    if (!active) return;
    if (!workingPose("motility") || !motilityFollowing || !toolsRef.current.motility.powered) {
      setMotilityTarget(current => current.x || current.y || current.z !== .35 ? { x: 0, y: 0, z: .35 } : current);
      const previous = motilityCoverageRef.current;
      if (previous.dwell || previous.current) {
        const paused = { ...previous, current: null, dwell: 0 };
        motilityCoverageRef.current = paused;
        setMotilityCoverage(paused);
      }
      setMotilityDistanceReady(current => current ? false : current);
      return;
    }
    const spatial = xrMotilityTarget(origin.toArray() as [number, number, number], EYE_MIDPOINT);
    setMotilityDistance(current => Math.abs(current - spatial.distanceCm) < 1 ? current : spatial.distanceCm);
    setMotilityDistanceReady(current => current === spatial.distanceReady ? current : spatial.distanceReady);
    setMotilityTarget(current => Math.hypot(current.x - spatial.target.x, current.y - spatial.target.y, current.z - spatial.target.z) < .006 ? current : spatial.target);
    const next = observeTarget(motilityCoverageRef.current, spatial.target, dt, motilityFollowing && toolsRef.current.motility.powered && spatial.distanceReady);
    const previous = motilityCoverageRef.current;
    motilityCoverageRef.current = next;
    if (next.current !== previous.current || next.seen.length !== previous.seen.length || Math.abs(next.dwell - previous.dwell) > .04) setMotilityCoverage(next);
  });

  useFrame((_, dt) => {
    if (!active) return;
    const placement = toolsRef.current.cover.placement;
    const targetSlot = placement.kind === "held" ? slots.find(candidate => candidate.hand && candidate.hand !== placement.hand) : undefined;
    let targetReady = false;
    const targetTool = targetSlot?.hand ? toolInHand(toolsRef.current, targetSlot.hand) : null;
    if (targetSlot?.tracked && !targetSlot.panel && frameValid.current && (!targetTool || targetTool === "motility")) {
      if (targetTool) workingPose(targetTool);
      else {
        targetSlot.grip.getWorldPosition(origin);
        targetSlot.grip.getWorldQuaternion(quaternion);
        direction.set(0, 0, -1).applyQuaternion(quaternion).normalize();
        origin.addScaledVector(direction, .1);
      }
      const fixation = xrCoverFixationMode(origin.toArray() as [number, number, number], PUPIL_EYES);
      const { distanceCm: targetDistanceCm, centred, mode: inferredMode } = fixation;
      setCoverTargetDistance(current => Math.abs(current - targetDistanceCm) < 1 ? current : targetDistanceCm);
      const rangeLocked = coverAsked && (coverStateRef.current.index > 0 || coverStateRef.current.dwell > 0);
      if (!rangeLocked && inferredMode && inferredMode !== coverModeRef.current) {
        coverModeRef.current = inferredMode;
        setCoverMode(inferredMode);
      }
      const lockedMode = !rangeLocked && inferredMode ? inferredMode : coverModeRef.current;
      targetReady = centred && (lockedMode === "near"
        ? targetDistanceCm >= 32 && targetDistanceCm <= 52
        : targetDistanceCm >= 70);
    }
    setCoverSetupValid(current => current === targetReady ? current : targetReady);
    const ready = workingPose("cover");
    const position = ready ? xrCoverPositionAt(origin.toArray() as [number, number, number], PUPIL_EYES) : null;
    setCoverPosition(current => current === position ? current : position);
    if (!coverAsked || !targetReady || !ready) {
      if (coverStateRef.current.dwell) {
        const reset = advanceXRCoverState(coverStateRef.current, null, dt);
        coverStateRef.current = reset;
        setCoverState(reset);
      }
      return;
    }
    const next = advanceXRCoverState(coverStateRef.current, position, dt);
    if (next.index !== coverStateRef.current.index || Math.abs(next.dwell - coverStateRef.current.dwell) > .04) {
      coverStateRef.current = next;
      setCoverState(next);
    } else coverStateRef.current = next;
  });

  const apertureOrigin = useMemo(() => new Vector3(), []);
  const viewerOrigin = useMemo(() => new Vector3(), []);
  const viewerDirection = useMemo(() => new Vector3(), []);
  const viewerRotation = useMemo(() => new Quaternion(), []);
  useFrame(({ camera }, dt) => {
    reflexVisual.eye = null; fundusView.visible = false; retinoAim.current = null;
    if (!active) return;
    const retinoReady = workingPose("objective") && toolsRef.current.objective.powered;
    const aim = retinoReady ? xrScopeAim(origin.toArray() as [number, number, number], direction.toArray() as [number, number, number], PUPIL_EYES) : null;
    retinoAim.current = aim;
    const reflex = aim ? scopeReflex(aim, caseData, trialLensRef.current) : null;
    if (aim && reflex) {
      lastScopeEye.current.objective = aim.eye;
      Object.assign(reflexVisual, { eye: aim.eye, offset: reflex.offset, brightness: reflex.brightness, width: reflex.width, axis: streakAxisRef.current });
    }
    for (const eye of ["OD", "OS"] as const) {
      retinoSweeps.current[eye] = advanceScopeSweep(retinoSweeps.current[eye], {
        aim: aim?.eye === eye ? aim : null, motion: reflex?.motion ?? null,
        lens: trialLensRef.current, axis: streakAxisRef.current,
        ready: frameValid.current && fixation && Boolean(aim && aim.eye === eye && Math.abs(aim.distanceCm - 67) <= 2 && reflex),
      });
    }
    const fundusReady = workingPose("fundus") && toolsRef.current.fundus.powered;
    const fieldAim = fundusReady ? xrScopeAim(origin.toArray() as [number, number, number], direction.toArray() as [number, number, number], PUPIL_EYES) : null;
    const object = objects.current.get("fundus");
    let viewerAligned = false;
    if (fieldAim && object && fieldAim.distanceCm <= 25 && caseData.exams.find(exam => exam.id === "fundus")?.findings[`${fieldAim.eye}:default`]) {
      apertureOrigin.set(0, .17, -.032); object.localToWorld(apertureOrigin);
      const viewer = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
      const cameras = "cameras" in viewer ? (viewer as import("three").ArrayCamera).cameras : [viewer];
      viewerAligned = cameras.some(eyeCamera => {
        eyeCamera.getWorldPosition(viewerOrigin); eyeCamera.getWorldQuaternion(viewerRotation);
        viewerDirection.set(0, 0, -1).applyQuaternion(viewerRotation);
        return xrScopeViewer(viewerOrigin.toArray() as [number, number, number], viewerDirection.toArray() as [number, number, number], apertureOrigin.toArray() as [number, number, number], direction.toArray() as [number, number, number]);
      });
      if (viewerAligned) {
        fundusView.visible = frameValid.current;
        fundusView.x = Math.max(-1, Math.min(1, fieldAim.x / .025)); fundusView.y = Math.max(-1, Math.min(1, fieldAim.y / .025));
        lastScopeEye.current.fundus = fieldAim.eye;
      }
    }
    for (const eye of ["OD", "OS"] as const) fundusInspections.current[eye] = advanceScopeInspection(fundusInspections.current[eye], Boolean(frameValid.current && viewerAligned && fieldAim?.eye === eye), dt);
    scopeClock.current += dt;
    if (scopeClock.current >= .1) { scopeClock.current = 0; if (toolsRef.current.objective.placement.kind === "held" || toolsRef.current.fundus.placement.kind === "held" || recordingExam === "objective" || recordingExam === "fundus") setScopeRevision(revision => revision + 1); }
  });

  const recordPupil = useCallback(() => {
    if (seen.length !== 2 || !odSize || !osSize || !equality || !odDirect || !osDirect || !consensual || pupilLight) return;
    const directSummary = odDirect === osDirect ? `direct responses ${odDirect} OU` : `direct response ${odDirect} OD and ${osDirect} OS`;
    if (!onProcedureComplete || onProcedureComplete("pupils", "general", `OD ${odSize} mm, OS ${osSize} mm in dim illumination; pupils ${equality}; ${directSummary}; consensual responses ${consensual} OU.`) === false) return;
    resetPupil(); setRecordingExam(null); setHandlingMessage("Saved to your notebook.");
  }, [consensual, equality, pupilLight, odDirect, odSize, onProcedureComplete, osDirect, osSize, resetPupil, seen.length]);

  const recordCover = useCallback(() => {
    if (!xrCoverComplete(coverState) || !coverOdMovement || !coverOsMovement || !coverAlternateMovement || !coverInterpretation) return;
    const site = coverMode === "near" ? "near" : "distance";
    const normal = coverOdMovement === "none" && coverOsMovement === "none" && coverAlternateMovement === "none" && coverInterpretation === "none";
    const movementLabel = (value: string) => value === "none" ? "no refixation movement" : value === "inward" ? "inward refixation" : value === "outward" ? "outward refixation" : value === "vertical" ? "vertical refixation" : "uncertain—repeat";
    const observation = normal
      ? `No refixation movement observed during cover–uncover or alternating cover testing at ${site}.`
      : `Cover–uncover: OD ${movementLabel(coverOdMovement)}, OS ${movementLabel(coverOsMovement)}; alternating cover: ${movementLabel(coverAlternateMovement)}; ${coverInterpretation === "tropia" ? "tropia suspected" : coverInterpretation === "phoria" ? "phoria suspected" : coverInterpretation === "none" ? "no deviation suspected" : "interpretation uncertain"} at ${site}.`;
    if (!onProcedureComplete || onProcedureComplete("cover", coverMode, observation) === false) return;
    resetCover(); setRecordingExam(null); setHandlingMessage("Saved to your notebook.");
  }, [coverAlternateMovement, coverInterpretation, coverMode, coverOdMovement, coverOsMovement, coverState, onProcedureComplete, resetCover]);

  const recordMotility = useCallback(() => {
    if (motilityCoverage.seen.length !== gazePositions.length || !motilitySymptomsAsked || !motilityObservation || motilityLight) return;
    const observation = motilityObservation === "full"
      ? "Full movements; no diplopia reported during the simulated assessment."
      : motilityObservation === "limited"
        ? "Restricted or unequal ocular movement suspected; no diplopia reported."
        : "Ocular motility assessment uncertain; repeat examination required.";
    if (!onProcedureComplete || onProcedureComplete("motility", "default", observation) === false) return;
    resetMotility(); setRecordingExam(null); setHandlingMessage("Saved to your notebook.");
  }, [motilityLight, motilityCoverage.seen.length, motilityObservation, motilitySymptomsAsked, onProcedureComplete, resetMotility]);

  const scopePowers = ["", ...Array.from({ length: 17 }, (_, index) => String(-2 + index * .25))];
  const scopeReady = scopeSweepComplete(retinoSweeps.current[recordEye]);
  const referenceSphere = scopeCaseSphere(caseData, recordEye);
  const lensNeutral = referenceSphere !== null && reflexMotion(recordEye, 67, trialLens, referenceSphere) === "neutral";
  const retinoEntriesComplete = Boolean(grossEntry && correctionEntry && netEntry && cylinderEntry && axisEntry);
  const fundusReady = fundusInspections.current[recordEye].seen;
  const fundusEntriesComplete = Boolean(discEntry && maculaEntry && poleEntry && extentEntry);
  const resetScopes = () => {
    retinoSweeps.current = { OD: initialScopeSweep(), OS: initialScopeSweep() };
    fundusInspections.current = { OD: initialScopeInspection(), OS: initialScopeInspection() };
    scopeFieldsReset();
  };
  const recordRetinoscopy = () => {
    if (!active || !scopeReady || !lensNeutral || !retinoEntriesComplete || toolsRef.current.objective.powered || !onProcedureComplete) return;
    const cylinder = cylinderEntry === "uncertain" ? "uncertain" : formatSignedDioptres(Number(cylinderEntry));
    const axis = axisEntry === "na" ? "not applicable" : axisEntry === "uncertain" ? "uncertain" : `${axisEntry}°`;
    const observation = `Gross neutralisation ${formatSignedDioptres(Number(grossEntry))} at 67 cm; working-distance correction ${formatSignedDioptres(Number(correctionEntry))}; sphere ${formatSignedDioptres(Number(netEntry))} · cylinder ${cylinder} · axis ${axis}.`;
    if (onProcedureComplete("objective", "default", observation, recordEye) === false) return;
    retinoSweeps.current[recordEye] = initialScopeSweep(); scopeFieldsReset(); setRecordingExam(null); setHandlingMessage("Saved to your notebook.");
  };
  const recordFundus = () => {
    if (!active || !fundusReady || !fundusEntriesComplete || toolsRef.current.fundus.powered || !onProcedureComplete) return;
    const normal = discEntry === "within normal limits" && maculaEntry === "within normal limits" && poleEntry === "within normal limits" && extentEntry === "limited undilated";
    const observation = normal ? caseData.exams.find(exam => exam.id === "fundus")?.findings[`${recordEye}:default`]?.value
      : `Disc: ${discEntry}; macula: ${maculaEntry}; visible posterior pole: ${poleEntry}; view: ${extentEntry}. Peripheral retina not fully assessed.`;
    if (!observation || onProcedureComplete("fundus", "default", observation, recordEye) === false) return;
    fundusInspections.current[recordEye] = initialScopeInspection(); scopeFieldsReset(); setRecordingExam(null); setHandlingMessage("Saved to your notebook.");
  };

  const patientEyes = useMemo(() => ({ gaze: [] as Object3D[], pupils: [] as Object3D[] }), []);
  useEffect(() => {
    patientEyes.gaze = []; patientEyes.pupils = [];
    scene.traverse(object => {
      if (object.userData.consultationGaze) patientEyes.gaze.push(object);
      if (object.userData.consultationPupil) patientEyes.pupils.push(object);
    });
    return () => {
      patientEyes.gaze.forEach(object => object.position.set(0, 0, 0));
      patientEyes.pupils.forEach(object => object.scale.set(1, 1, 1));
    };
  }, [active, patientEyes, scene]);
  useFrame(() => {
    const follow = active && motilityFollowing && toolsRef.current.motility.powered && consultationToolReady(toolsRef.current, "motility", handStatus()) && motilityTarget.z > .05;
    const x = follow ? Math.max(-1, Math.min(1, motilityTarget.x / (motilityTarget.z * .65))) * .009 : 0;
    const y = follow ? Math.max(-1, Math.min(1, motilityTarget.y / (motilityTarget.z * .45))) * .006 : 0;
    patientEyes.gaze.forEach(object => object.position.set(x, y, 0));
    const constricted = active && activeEye && toolsRef.current.pupils.powered && consultationToolReady(toolsRef.current, "pupils", handStatus());
    patientEyes.pupils.forEach(object => object.scale.set(constricted ? .56 : 1, constricted ? .56 : 1, 1));
  });

  let pauseReason = "";
  if (guided && panelExam && active) {
    const id = panelExam;
    const placement = tools[id].placement;
    if (placement.kind !== "held") pauseReason = `Pick up the ${consultationToolDefinition(id).label.toLowerCase()} to resume.`;
    else {
      const slot = slots.find(candidate => candidate.hand === placement.hand);
      if (!slot?.tracked) pauseReason = "Waiting for instrument controller tracking.";
      else if (slot.panel) pauseReason = "Press A/X to return the instrument to tool mode.";
      else if (coverProcedureActive) {
        const other = slots.find(candidate => candidate.hand && candidate.hand !== placement.hand);
        const targetTool = other?.hand ? toolInHand(tools, other.hand) : null;
        if (!other?.tracked) pauseReason = "Waiting for the other controller's tracking.";
        else if (other.panel) pauseReason = "Return the target hand to tool mode with A/X.";
        else if (targetTool && targetTool !== "motility") pauseReason = "Free the other hand or hold the motility target.";
      }
    }
  }
  return <>
    {active && <XRRetinoscopyReflex visual={reflexVisual} />}
    <XRClinicRuntimeView runtime={runtime} active={active} preview={preview} helperHand={heldHand} helperReady={coverSetupValid} fundusView={fundusView} />
    {(procedureActive || recordingExam === "pupils") && <>
      <XRPupilPanel recordingOnly={!guided} fixation={fixation} dimmed={dimmed} light={pupilLight} seen={seen} activeEye={activeEye} odSize={odSize} osSize={osSize} equality={equality} odDirect={odDirect} osDirect={osDirect} consensual={consensual}
        onFixation={() => { setFixation(true); setMotilityFollowing(false); resetMotility(); resetCover(); }}
        onDimmed={() => { setDimmed(value => !value); resetPupil(); }}
        onOdSize={() => cycle(odSize, ["", "2", "3", "4", "5", "6", "7"], setOdSize)}
        onOsSize={() => cycle(osSize, ["", "2", "3", "4", "5", "6", "7"], setOsSize)}
        onEquality={() => cycle(equality, ["", "equal", "unequal"], setEquality)}
        onOdDirect={() => cycle(odDirect, ["", "brisk", "sluggish", "absent"], setOdDirect)}
        onOsDirect={() => cycle(osDirect, ["", "brisk", "sluggish", "absent"], setOsDirect)}
        onConsensual={() => cycle(consensual, ["", "present", "absent"], setConsensual)}
        onRecord={recordPupil} onCancel={() => { resetPupil(); setPanelExam(null); setRecordingExam(null); }} />

    </>}
    {(coverProcedureActive || recordingExam === "cover") && <>
      <XRCoverPanel recordingOnly={!guided} mode={coverMode} targetDistanceCm={coverTargetDistance} setupValid={coverSetupValid} asked={coverAsked} step={coverState.index} position={coverPosition} odMovement={coverOdMovement} osMovement={coverOsMovement} alternateMovement={coverAlternateMovement} interpretation={coverInterpretation}
        onAsked={() => { setCoverAsked(true); setFixation(false); setMotilityFollowing(false); resetPupil(); resetMotility(); }}
        onOdMovement={() => cycle(coverOdMovement, COVER_MOVEMENTS, setCoverOdMovement)}
        onOsMovement={() => cycle(coverOsMovement, COVER_MOVEMENTS, setCoverOsMovement)}
        onAlternateMovement={() => cycle(coverAlternateMovement, COVER_MOVEMENTS, setCoverAlternateMovement)}
        onInterpretation={() => cycle(coverInterpretation, ["", "none", "tropia", "phoria", "uncertain"], setCoverInterpretation)}
        onRecord={recordCover} onCancel={() => { resetCover(); setPanelExam(null); setRecordingExam(null); }} />
      {guided && (coverPosition === "OD" || coverPosition === "OS") && <mesh position={[PUPIL_EYES[coverPosition][0], PUPIL_EYES[coverPosition][1], PUPIL_EYES[coverPosition][2] + .006]}>
        <ringGeometry args={[.03, .042, 24]} /><meshBasicMaterial color="#76d5c3" transparent opacity={.7} side={DoubleSide} />
      </mesh>}
    </>}
    {(motilityProcedureActive || recordingExam === "motility") && <>
      <XRMotilityPanel recordingOnly={!guided} following={motilityFollowing} light={motilityLight} distanceCm={motilityDistance} distanceReady={motilityDistanceReady} coverage={motilityCoverage} symptomsAsked={motilitySymptomsAsked} observation={motilityObservation}
        onFollowing={() => { setMotilityFollowing(value => !value); setFixation(false); resetPupil(); resetCover(); resetMotility(); }}
        onSymptoms={() => setMotilitySymptomsAsked(true)}
        onObservation={() => cycle(motilityObservation, ["", "full", "limited", "unsure"], setMotilityObservation)}
        onRecord={recordMotility} onCancel={() => { resetMotility(); setPanelExam(null); setRecordingExam(null); }} />
      {guided && gazePositions.map(position => {
        const z = Math.max(.3, Math.min(.4, motilityTarget.z));
        const point: [number, number, number] = [position.x * z * .65, 1.5 + position.y * z * .45, EYE_MIDPOINT[2] + z];
        const seenPosition = motilityCoverage.seen.includes(position.id);
        return <mesh key={position.id} position={point}>
          <ringGeometry args={[.014, .02, 20]} />
          <meshBasicMaterial color={seenPosition ? "#65c9b6" : "#8da8a3"} transparent opacity={seenPosition ? .78 : .36} side={DoubleSide} />
        </mesh>;
      })}

    </>}
    {active && recordingExam === "objective" && <XRObservationPanel tool={`Retinoscope · ${recordEye}`} status={
      referenceSphere === null ? "Case refraction is unavailable." : !fixation ? "Ask the patient to look straight ahead." : !scopeReady ? "Bracket the reflex at ~67 cm in both streak orientations." : !lensNeutral ? "Return the lens to neutral before saving." : tools.objective.powered ? "Release the light trigger." : "Enter your gross and net findings."
    } fields={[
      { label: "GROSS", value: grossEntry ? formatSignedDioptres(Number(grossEntry)) : "", enabled: scopeReady, onChange: () => cycle(grossEntry, scopePowers, setGrossEntry) },
      { label: "CORRECTION", value: correctionEntry ? formatSignedDioptres(Number(correctionEntry)) : "", enabled: scopeReady, onChange: () => cycle(correctionEntry, ["", "-1.5", "-2", "-1"], setCorrectionEntry) },
      { label: "NET SPHERE", value: netEntry ? formatSignedDioptres(Number(netEntry)) : "", enabled: scopeReady, onChange: () => cycle(netEntry, scopePowers, setNetEntry) },
      { label: "CYLINDER", value: cylinderEntry ? cylinderEntry === "uncertain" ? cylinderEntry : formatSignedDioptres(Number(cylinderEntry)) : "", enabled: scopeReady, onChange: () => cycle(cylinderEntry, ["", "0", "-.25", "-.5", "uncertain"], setCylinderEntry) },
      { label: "AXIS", value: axisEntry, enabled: scopeReady, onChange: () => cycle(axisEntry, ["", "na", "90", "180", "uncertain"], setAxisEntry) },
    ]} extra={{ label: `EYE · ${recordEye}`, enabled: true, onClick: () => { setRecordEye(eye => eye === "OD" ? "OS" : "OD"); scopeFieldsReset(); } }}
      ready={scopeReady && lensNeutral && retinoEntriesComplete && !tools.objective.powered} onRecord={recordRetinoscopy} onCancel={() => { retinoSweeps.current[recordEye] = initialScopeSweep(); scopeFieldsReset(); setRecordingExam(null); }} />}
    {active && recordingExam === "fundus" && <XRObservationPanel tool={`Ophthalmoscope · ${recordEye}`} status={
      !fundusReady ? "Illuminate the eye, then look through the rear aperture." : tools.fundus.powered ? "Release the light trigger before saving." : "Record the limited posterior-pole view."
    } fields={[
      { label: "DISC", value: discEntry, enabled: fundusReady, onChange: () => cycle(discEntry, ["", "within normal limits", "abnormal suspected", "uncertain"], setDiscEntry) },
      { label: "MACULA", value: maculaEntry, enabled: fundusReady, onChange: () => cycle(maculaEntry, ["", "within normal limits", "abnormal suspected", "uncertain"], setMaculaEntry) },
      { label: "POSTERIOR POLE", value: poleEntry, enabled: fundusReady, onChange: () => cycle(poleEntry, ["", "within normal limits", "abnormal suspected", "uncertain"], setPoleEntry) },
      { label: "VIEW", value: extentEntry, enabled: fundusReady, onChange: () => cycle(extentEntry, ["", "limited undilated", "uncertain"], setExtentEntry) },
    ]} extra={{ label: `EYE · ${recordEye}`, enabled: true, onClick: () => { setRecordEye(eye => eye === "OD" ? "OS" : "OD"); scopeFieldsReset(); } }}
      ready={fundusReady && fundusEntriesComplete && !tools.fundus.powered} onRecord={recordFundus} onCancel={() => { fundusInspections.current[recordEye] = initialScopeInspection(); scopeFieldsReset(); setRecordingExam(null); }} />}
    {active && <>
      {pauseReason && <Sign text={["TECHNIQUE PAUSED", pauseReason]} p={[.74, 2.04, -.82]} rotation={[0, -.55, 0]} size={[.62, .14]} bg="#173a3e" fg="#e8fff9" />}
      {guided && <group position={[-.62, 1.36, .35]} rotation={[0, .4, 0]} userData={{ xrPanel: true }}>
        <Box s={[.60, .46, .018]} c="#102329" radius={.012} />
        <Sign text={["CONSULTATION", "Pick up tools and use them on Arun"]} p={[0, .15, .013]} size={[.56, .10]} bg="#102329" fg="#eefbf7" />
        <XRPanelButton label="PUPILS" position={[-.15, .05, .025]} width={.27} active={panelExam === "pupils"} onClick={() => setPanelExam("pupils")} />
        <XRPanelButton label="COVER TEST" position={[.15, .05, .025]} width={.27} active={panelExam === "cover"} onClick={() => setPanelExam("cover")} />
        <XRPanelButton label="MOTILITY" position={[0, -.035, .025]} width={.56} active={panelExam === "motility"} onClick={() => setPanelExam("motility")} />
        <Sign text={["Panels · instructions and recording", "A/X · panel ray · trigger to select"]} p={[0, -.145, .025]} size={[.56, .10]} bg="#102329" fg="#eefbf7" />
      </group>}
      {!guided && menuOpen && !recordingExam && <group position={[-.62, 1.46, .35]} rotation={[0, .4, 0]} userData={{ xrPanel: true }}>
        <Box s={[.62, .86, .018]} c="#102329" radius={.012} />
        <Sign text={[patientName.toUpperCase(), "Patient instructions"]} p={[-.09, .335, .013]} size={[.38, .10]} bg="#102329" fg="#eefbf7" />
        {onExitVR && <XRPanelButton label="EXIT VR" position={[.22, .34, .025]} width={.15} onClick={onExitVR} />}
        <XRPanelButton label="LOOK STRAIGHT AHEAD" position={[0, .235, .025]} width={.56} active={fixation} onClick={() => {
          setMotilityFollowing(false); setFixation(true); resetMotility(); resetPupil(); resetCover(); resetScopes();
        }} />
        <XRPanelButton label="LOOK AT THIS TARGET" position={[0, .15, .025]} width={.56} active={coverAsked} onClick={() => {
          setMotilityFollowing(false); setFixation(false); resetPupil(); resetMotility(); resetCover(); resetScopes(); setCoverAsked(true);
        }} />
        <XRPanelButton label="FOLLOW THIS TARGET" position={[0, .065, .025]} width={.56} active={motilityFollowing} onClick={() => {
          setMotilityFollowing(true); setFixation(false); resetMotility(); resetPupil(); resetCover(); resetScopes();
        }} />
        <XRPanelButton label={dimmed ? "RESTORE ROOM LIGHTS" : "DIM ROOM LIGHTS"} position={[0, -.02, .025]} width={.56} onClick={() => { setDimmed(value => !value); resetPupil(); }} />
        <XRPanelButton label="RECORD OBSERVATION" position={[0, -.105, .025]} width={.56} onClick={() => {
          if (lastUsedExam.current) requestRecording(lastUsedExam.current);
          else setHandlingMessage("Use an instrument first, then record what you observed.");
        }} />
        {onOpenPanel && <>
          <XRPanelButton label="HISTORY" position={[-.145, -.19, .025]} width={.27} onClick={() => onOpenPanel("interview")} />
          <XRPanelButton label="NOTEBOOK" position={[.145, -.19, .025]} width={.27} onClick={() => onOpenPanel("notes")} />
          <XRPanelButton label="MY ASSESSMENT" position={[0, -.275, .025]} width={.56} onClick={() => onOpenPanel("submission")} />
        </>}
        <XRPanelButton label="CLOSE MENU" position={[0, -.365, .025]} width={.56} onClick={() => setMenuOpen(false)} />
      </group>}
      {!guided && recordingExam && onExitVR && <XRHeadPanel><XRPanelButton label="EXIT VR" position={[.26, .37, .02]} width={.15} onClick={onExitVR} /></XRHeadPanel>}
      {!guided && CONSULTATION_TOOLS.filter(tool => isConsultationExam(tool.id)).map(tool => <XRToolControls key={`controls-${tool.id}`} runtime={runtime} id={tool.id}>
        <XRPanelButton label="RECORD FINDING" position={[0, 0, 0]} width={.30} recordTool={tool.id} onClick={() => { if (isConsultationExam(tool.id)) requestRecording(tool.id); }} />
        {tool.id === "objective" && <>
          <Sign text={[`LENS ${formatSignedDioptres(trialLens)}`, retinoAim.current ? `${Math.round(retinoAim.current.distanceCm)} CM · ${retinoAim.current.eye}` : "Aim the light at a pupil"]} p={[0, .075, 0]} size={[.30, .07]} bg="#173a3e" fg="#e8fff9" />
          <XRPanelButton label="−0.25 D" position={[-.08, -.085, 0]} width={.14} onClick={() => changeTrialLens(-.25)} />
          <XRPanelButton label="+0.25 D" position={[.08, -.085, 0]} width={.14} onClick={() => changeTrialLens(.25)} />
          <XRPanelButton label={`STREAK ${streakAxis}°`} position={[0, -.17, 0]} width={.30} onClick={changeStreak} />
        </>}
      </XRToolControls>)}
    </>}
  </>;
}
