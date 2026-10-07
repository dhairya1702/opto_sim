import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Group, MeshBasicMaterial, Quaternion, Vector3 } from "three";
import { useXRClinicRuntime, type XRClinicInterruption } from "../../interaction/useXRClinicRuntime";
import { CLINIC_EYE_MIDPOINT, CLINIC_PATIENT_EYES } from "../../interaction/clinicPatient";
import { emptyHirschbergTechnique, clinicHirschbergReflex, hirschbergSubmission, type HirschbergPracticeFinding } from "../../interaction/xrHirschbergPractice";
import { xrHirschbergPrompt, xrHirschbergTechnique, type XRHirschbergTechnique } from "../../interaction/xrPractice";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { XRHeadPanel, XRPanelButton, XRSign as Sign } from "../../scene/XRClinicPanels";
import { Box } from "../../scene/Models";
import { XRPracticeFindingsBoard } from "../../scene/XRPracticeFindingsBoard";
import { useXRPracticeResult, XRPracticeResultHUD } from "../../scene/XRPracticeResultHUD";
import type { OpticScenario } from "../ClinicalPracticeStage";

export const HIRSCHBERG_DIRECTIONS = [
  ["none", "No deviation"], ["exotropia", "Exotropia"], ["esotropia", "Esotropia"],
  ["hypertropia", "Hypertropia"], ["hypotropia", "Hypotropia"],
] as const;
export const HIRSCHBERG_LANDMARKS = [
  ["0", "Centred · 0°"], ["15", "Pupil edge · ~15°"], ["30", "Midway · ~30°"], ["45", "Limbus · ~45°"],
] as const;
export type HirschbergPracticeMirror = {
  technique: XRHirschbergTechnique; held: boolean; light: boolean; fixation: boolean;
  direction: string; amount: string; checked: boolean; correct: boolean; help: boolean; recording: boolean;
  giveFixation: () => void; toggleHelp: () => void; openRecording: () => void;
  chooseDirection: (value: string) => void; chooseAmount: (value: string) => void;
  record: () => void; cancel: () => void; reset: () => void;
};
type Visual = { lit: boolean; quality: number };

function HirschbergReflexes({ scenario, visual }: { scenario: OpticScenario; visual: Visual }) {
  const roots = useRef<Partial<Record<"OD" | "OS", Group>>>({});
  useFrame(() => {
    for (const eye of ["OD", "OS"] as const) {
      const root = roots.current[eye];
      if (!root) continue;
      root.visible = visual.lit;
      root.children.forEach(child => {
        if ("material" in child) (child.material as MeshBasicMaterial).opacity = .35 + visual.quality * .65;
      });
    }
  });
  return <>{(["OD", "OS"] as const).map(eye => {
    const offset = clinicHirschbergReflex(scenario[eye === "OD" ? "od" : "os"]);
    const centre = CLINIC_PATIENT_EYES[eye];
    return <group key={eye} ref={object => { if (object) roots.current[eye] = object; else delete roots.current[eye]; }} visible={false}
      position={[centre[0] + offset.x, centre[1] + offset.y, -.568]} userData={{ xrHirschbergReflex: eye, xrIgnoreRay: true }}>
      <mesh><circleGeometry args={[.0013, 20]} /><meshBasicMaterial color="#fff9d8" transparent depthWrite={false} /></mesh>
      <mesh position={[0, 0, -.0003]}><ringGeometry args={[.0015, .0022, 20]} /><meshBasicMaterial color="#ffe6a1" transparent opacity={.3} depthWrite={false} /></mesh>
    </group>;
  })}</>;
}

/** A lesson adapter over the shared clinic, with no consultation case/reducer dependency. */
export function HirschbergPracticeController({ active, preview = false, scenario, finding, findingPosition, onComplete, onNext, onExit, onMirror }: {
  active: boolean; preview?: boolean; scenario: OpticScenario; finding: HirschbergPracticeFinding;
  findingPosition: { current: number; total: number };
  onComplete: () => void; onNext: () => void; onExit: () => void;
  onMirror?: (mirror: HirschbergPracticeMirror) => void;
}) {
  const { gl, camera } = useThree();
  const { result: resultNotice, showResult, clearResult } = useXRPracticeResult();
  const [fixation, setFixation] = useState(false);
  const fixationRef = useRef(fixation); fixationRef.current = fixation;
  const [technique, setTechnique] = useState(emptyHirschbergTechnique);
  const techniqueRef = useRef(technique);
  const [direction, setDirection] = useState("");
  const [amount, setAmount] = useState("");
  const entries = useRef({ direction, amount }); entries.current = { direction, amount };
  const [checked, setChecked] = useState(false);
  const [correct, setCorrect] = useState(false);
  const [recording, setRecording] = useState(false);
  const [menu, setMenu] = useState(false);
  const [help, setHelp] = useState(false);
  const capturedRef = useRef<XRHirschbergTechnique | null>(null);
  const captureArmed = useRef(true);
  const [captured, setCaptured] = useState<XRHirschbergTechnique | null>(null);
  const [submissionMessage, setSubmissionMessage] = useState("");
  const awarded = useRef(false);
  const wasReady = useRef(false);
  const visual = useMemo<Visual>(() => ({ lit: false, quality: 0 }), []);
  const invalidation = useCallback((reason?: XRClinicInterruption) => {
    if (capturedRef.current && reason && ["release", "panel", "pickup", "transfer", "tracking", "procedure"].includes(reason)) return;
    clearResult();
    capturedRef.current = null; captureArmed.current = false; setCaptured(null); setSubmissionMessage("");
    techniqueRef.current = emptyHirschbergTechnique(); wasReady.current = false;
    setTechnique(emptyHirschbergTechnique()); visual.lit = false;
    if (!awarded.current) { entries.current = { direction: "", amount: "" }; setDirection(""); setAmount(""); setChecked(false); }
  }, [visual, clearResult]);
  const runtime = useXRClinicRuntime({ active: active && !preview, editorOpen: recording || menu || help,
    onInterrupt: invalidation,
    onMenu: open => { setMenu(open); if (!open) { setRecording(false); setHelp(false); } },
    onSelection: selection => {
      if (selection.station === "patient" && !selection.examId) setMenu(true);
      else if (selection.examId) runtime.setHandlingMessage("Squeeze the side grip once beside the handle to pick up the instrument.");
    },
  });
  const viewerPosition = useMemo(() => new Vector3(), []);
  const viewerForward = useMemo(() => new Vector3(), []);
  const viewerRotation = useMemo(() => new Quaternion(), []);
  const sample = () => {
    const held = active && runtime.workingPose("pupils");
    if (!held || !runtime.frameValid.current) return emptyHirschbergTechnique();
    const viewer = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    viewer.getWorldPosition(viewerPosition); viewer.getWorldQuaternion(viewerRotation);
    viewerForward.set(0, 0, -1).applyQuaternion(viewerRotation);
    return xrHirschbergTechnique({
      penlightPosition: runtime.origin.toArray() as [number, number, number],
      penlightForward: runtime.direction.toArray() as [number, number, number],
      viewerPosition: viewerPosition.toArray() as [number, number, number],
      viewerForward: viewerForward.toArray() as [number, number, number],
      eyeMidpoint: CLINIC_EYE_MIDPOINT, held, light: runtime.toolsRef.current.pupils.powered, fixation: fixationRef.current,
    });
  };
  const clock = useRef(0);
  useFrame((_state, dt) => {
    const next = sample();
    if (!next.ready) captureArmed.current = true;
    if (next.ready && captureArmed.current && !capturedRef.current) {
      capturedRef.current = { ...next }; setCaptured(capturedRef.current);
    }
    if (wasReady.current && !next.ready && !capturedRef.current && !awarded.current) {
      entries.current = { direction: "", amount: "" }; setDirection(""); setAmount(""); setChecked(false);
    }
    wasReady.current = next.ready; techniqueRef.current = next;
    visual.lit = active && runtime.frameValid.current && runtime.toolsRef.current.pupils.powered && next.aimErrorDeg <= 12 && next.distanceCm >= 3 && next.distanceCm <= 120;
    visual.quality = next.quality;
    clock.current += dt;
    if (clock.current >= .1) { clock.current = 0; setTechnique(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next); }
  });
  const clearAttempt = useCallback(() => {
    clearResult();
    awarded.current = false; wasReady.current = false;
    capturedRef.current = null; captureArmed.current = true; setCaptured(null); setSubmissionMessage("");
    entries.current = { direction: "", amount: "" }; setDirection(""); setAmount(""); setChecked(false); setCorrect(false);
    fixationRef.current = false; setFixation(false); setRecording(false); setMenu(false); setHelp(false);
    runtime.closePanels();
  }, [runtime.closePanels, clearResult]);
  const reset = useCallback(() => { clearAttempt(); runtime.resetClinic(); }, [clearAttempt, runtime.resetClinic]);
  useEffect(() => { clearAttempt(); }, [scenario.id, clearAttempt]);
  useEffect(() => { if (!active) reset(); }, [active, reset]);
  const giveFixation = () => { fixationRef.current = true; setFixation(true); setMenu(false); };
  const chooseDirection = (value: string) => {
    if (awarded.current) return;
    entries.current.direction = value; setDirection(value); setChecked(false); setSubmissionMessage("");
  };
  const chooseAmount = (value: string) => {
    if (awarded.current) return;
    entries.current.amount = value; setAmount(value); setChecked(false); setSubmissionMessage("");
  };
  const record = () => {
    if (awarded.current) return;
    const explain = (message: string) => { setSubmissionMessage(message); showResult("incomplete", message); };
    if (!active || preview || !runtime.frameValid.current) { explain("Restore headset/controller tracking before submitting."); return; }
    const result = hirschbergSubmission(capturedRef.current ?? emptyHirschbergTechnique(), entries.current.direction, entries.current.amount, finding);
    if (result === null) {
      explain(!capturedRef.current ? "First inspect both reflexes: " + prompt : "Choose both a direction and a landmark, then submit.");
      return;
    }
    setSubmissionMessage("");
    setChecked(true); setCorrect(result);
    showResult(result ? "correct" : "retry", result ? finding.feedback : "Incorrect · compare direction and landmark, then try again.");
    if (result) { awarded.current = true; onComplete(); }
  };
  const cancel = () => { invalidation(); setRecording(false); setMenu(false); setHelp(false); };
  const openRecording = () => { setRecording(true); setMenu(false); setHelp(false); };
  const toggleHelp = () => { setHelp(value => !value); setMenu(false); setRecording(false); };
  const held = runtime.tools.pupils.placement.kind === "held";
  const light = runtime.tools.pupils.powered;
  const prompt = xrHirschbergPrompt(technique, { held, light, fixation });
  useEffect(() => { onMirror?.({ technique, held, light, fixation, direction, amount, checked, correct, help, recording,
    giveFixation, toggleHelp, openRecording, chooseDirection, chooseAmount, record, cancel, reset,
  }); }, [technique, held, light, fixation, direction, amount, checked, correct, help, recording, finding, active, captured, onMirror]);
  const nextFinding = () => { if (!awarded.current) return; clearAttempt(); onNext(); };
  const findings = <>
        <Box p={[0, -.03, -.015]} s={[.76, 1.20, .018]} c="#102329" radius={.012} />
        <Sign text={[`HIRSCHBERG · FINDING ${findingPosition.current}/${findingPosition.total}`, checked ? correct ? "Correct · finding recorded" : "Recheck direction and landmark." : captured ? "Observation captured · choose answers and submit." : prompt]} p={[0, .245, 0]} size={[.70, .16]} bg="#102329" fg="#eefbf7" />
        <XRPanelButton label={fixation ? "FIXATION GIVEN ✓" : "LOOK AT THE LIGHT"} position={[0, .49, .02]} width={.70} onClick={giveFixation} />
        <XRPanelButton label="HELP" position={[-.18, .395, .02]} width={.34} onClick={toggleHelp} />
        <XRPanelButton label="EXIT VR" position={[.18, .395, .02]} width={.34} onClick={onExit} />
        {HIRSCHBERG_DIRECTIONS.map(([value, label], index) => <XRPanelButton key={value} label={label.toUpperCase()}
          position={[index % 2 ? .18 : -.18, .10 - Math.floor(index / 2) * .08, .012]} width={.34}
          disabled={checked && correct} active={direction === value} onClick={() => chooseDirection(value)} />)}
        {HIRSCHBERG_LANDMARKS.map(([value, label], index) => <XRPanelButton key={value} label={label.toUpperCase()}
          position={[index % 2 ? .18 : -.18, -.17 - Math.floor(index / 2) * .08, .012]} width={.34}
          disabled={checked && correct} active={amount === value} onClick={() => chooseAmount(value)} />)}
        <XRPanelButton label="CANCEL" position={[-.18, -.335, .012]} width={.34} onClick={cancel} />
        <XRPanelButton label="SUBMIT / CHECK" position={[.18, -.335, .012]} width={.34} disabled={checked && correct} active={Boolean(captured && direction && amount)} onClick={record} />
        {(checked || submissionMessage) && <Sign text={[submissionMessage || (correct ? finding.feedback : "Incorrect · compare direction and landmark, then try again.")]} p={[0, -.425, .012]} size={[.70, .08]} bg="#102329" fg="#eefbf7" />}
        {checked && correct && <XRPanelButton label="NEW PATIENT FINDING" position={[0, -.51, .012]} width={.70} onClick={nextFinding} />}
      </>;
  return <>
    <XRPracticeResultHUD active={active && !preview} result={resultNotice} />
    <XRClinicRuntimeView cleanHands runtime={runtime} active={active && !preview} preview={preview} title="HIRSCHBERG · PRACTICE" instruction="Pick up the penlight · findings on rear wall · trigger to select" />
    {active && <>
      <XRPracticeFindingsBoard runtime={runtime} active={active && !preview} tools={["pupils"]} forceVisible={recording} hidden={menu || help}>{findings}</XRPracticeFindingsBoard>
      <HirschbergReflexes scenario={scenario} visual={visual} />
      {menu && !recording && !help && <XRHeadPanel>
        <Box s={[.66, .54, .018]} c="#102329" radius={.012} />
        <Sign text={["HIRSCHBERG PRACTICE", `Finding ${findingPosition.current}/${findingPosition.total}`]} p={[0, .18, .012]} size={[.60, .12]} bg="#102329" fg="#eefbf7" />
        <XRPanelButton label="LOOK AT THE LIGHT" position={[0, .06, .025]} width={.56} onClick={giveFixation} />
        <XRPanelButton label="HELP" position={[-.145, -.025, .025]} width={.27} onClick={toggleHelp} />
        <XRPanelButton label="RECORD FINDING" position={[.145, -.025, .025]} width={.27} onClick={openRecording} />
        <XRPanelButton label="RESET ATTEMPT" position={[-.145, -.11, .025]} width={.27} onClick={reset} />
        <XRPanelButton label="EXIT VR" position={[.145, -.11, .025]} width={.27} onClick={onExit} />
        <XRPanelButton label="CLOSE" position={[0, -.195, .025]} width={.56} onClick={() => setMenu(false)} />
      </XRHeadPanel>}
      {help && <XRHeadPanel>
        <Box s={[.72, .72, .018]} c="#102329" radius={.012} />
        <Sign text={["HIRSCHBERG · HELP", "Ask the patient to look at the penlight.", "Hold its trigger; position it at about 50 cm.", "Centre your view and compare both reflexes.", "Record direction and approximate landmark.", prompt]} p={[0, .06, .012]} size={[.66, .48]} bg="#102329" fg="#eefbf7" />
        <XRPanelButton label="CLOSE HELP" position={[-.16, -.26, .025]} width={.30} onClick={() => setHelp(false)} />
        <XRPanelButton label="EXIT VR" position={[.16, -.26, .025]} width={.30} onClick={onExit} />
      </XRHeadPanel>}
    </>}
  </>;
}
