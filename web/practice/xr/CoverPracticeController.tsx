import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { ALTERNATE_COVER_GUIDED_STEP_COUNT, COVER_UNCOVER_GUIDED_STEP_COUNT, coverGuidedStep } from "../../interaction/alignmentGuidance";
import { useXRClinicRuntime, type ClinicInputMode, type XRClinicInterruption } from "../../interaction/useXRClinicRuntime";
import { desktopPatientFacingPose } from "../../interaction/desktopClinicInput";
import { CONSULTATION_EQUIPMENT } from "../../interaction/xrConsultationTools";
import { ALTERNATE_COVER_ATTEMPTS_PER_PRISM, alternateCoverAttemptNumber, coverScenarios, alternateCoverModel, alternateCoverScenarios, alternateDeviationChoices, alternateDeviationLabel, neutralizingPrismBase, practiceCoverProcedures, prismBaseLabel, prismTrialNeutralizes, prismTrialOutcome, type PracticeCoverKind } from "../../interaction/practiceCover";
import { advanceXRPracticeCover, emptyPracticeCoverSequence, xrCoverGuideAnchors, xrCoverGuideTarget, xrPracticeCoverPosition, xrPracticeEyePlacement } from "../../interaction/xrPracticeBatch";
import { sensorySockets, sensoryTargetCondition } from "../../interaction/xrSensoryEquipment";
import type { CoverEye, CoverPosition } from "../../interaction/cover";
import { coverEyeTargets, coverTeachingIrisOffset, settleCoverEyes, type CoverDeviationModel, type CoverEyePoses, type PrismPlacement } from "../../interaction/coverDeviation";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { XRCoverGuide, XRPrismPlacementGuide } from "../../scene/XRCoverGuide";
import { XRGuidedStepBubble } from "../../scene/XRGuidedStepBubble";
import { Box } from "../../scene/Models";
import { XRHeadPanel, XRPanelButton, XRSign } from "../../scene/XRClinicPanels";
import { useClinicEyeMotion } from "./useClinicEyeMotion";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonField, type LessonAction } from "./PracticeLessonUI";
import { usePracticeAttempt } from "../PracticeAttemptContext";

const bases = [["base-in", "Base in"], ["base-out", "Base out"], ["base-up", "Base up"], ["base-down", "Base down"]] as const;
type CoverEndpoint = "distance" | "near";
type AlternateCapture = { movement: string; deviation: string; power: number; base: string; eye: CoverEye };
const alternatingMovementCue = (movement: string) => movement === "in" ? "OD moved inward on uncovering: an exodeviation."
  : movement === "out" ? "OD moved outward on uncovering: an esodeviation."
    : movement === "up" ? "OD moved upward on uncovering: a right hypodeviation."
      : "OD moved downward on uncovering: a right hyperdeviation.";
const alternatingMovementWord = (movement: string) => movement === "in" ? "Inward" : movement === "out" ? "Outward" : movement === "up" ? "Upward" : "Downward";
const COVER_EQUIPMENT = [...CONSULTATION_EQUIPMENT.filter(id => id !== "near"), "worth" as const];
const COVER_TARGET_SOCKETS = sensorySockets("worth").filter(socket => socket.tool === "worth");
const fieldsFor = (kind: PracticeCoverKind, endpoint: "distance" | "near" = "distance"): LessonField[] => kind === "cover-uncover"
  ? [{ id: "pattern", label: `${endpoint === "distance" ? "Distance" : "Near"} movement timing`, choices: coverScenarios.map(item => [item.id, item.label]) }]
  : [{ id: "movement", label: `${endpoint === "distance" ? "Distance" : "Near"} OD movement on uncovering`, choices: [["in", "In"], ["out", "Out"], ["up", "Up"], ["down", "Down"]] },
    { id: "deviation", label: `${endpoint === "distance" ? "Distance" : "Near"} deviation`, choices: alternateDeviationChoices.map(([id, label]) => [id, label]) }];
const initial = () => ({ sequence: emptyPracticeCoverSequence(), observed: false, trial: false, neutralized: false,
  awaitingPrismChange: false, trialEye: "" as string, pulseKey: "", message: "" });
export function CoverPracticeController({ active, preview = false, inputMode = "xr", kind, onComplete, onExit, onMirror }: {
  active: boolean; preview?: boolean; inputMode?: ClinicInputMode; kind: PracticeCoverKind; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const { settings: attemptSettings } = usePracticeAttempt();
  const guided = attemptSettings?.kind === "guided";
  const guideAvailable = attemptSettings?.kind !== "test";
  const [guides, setGuides] = useState(guideAvailable);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const cover = coverScenarios[scenarioIndex % coverScenarios.length], alternate = alternateCoverScenarios[scenarioIndex % alternateCoverScenarios.length];
  const lesson = usePracticeLesson(onComplete);
  const [fixation, setFixation] = useState(false), [base, setBase] = useState<string>(""), [power, setPower] = useState(0);
  const setup = useRef({ fixation, base, power }); setup.current = { fixation, base, power };
  const progress = useRef(initial());
  const coverRecordsRef = useRef<Partial<Record<"distance" | "near", string>>>({});
  const [coverRecords, setCoverRecords] = useState<Partial<Record<"distance" | "near", string>>>({});
  const alternateRecordsRef = useRef<Partial<Record<CoverEndpoint, AlternateCapture>>>({});
  const [alternateRecords, setAlternateRecords] = useState<Partial<Record<CoverEndpoint, AlternateCapture>>>({});
  const [readout, setReadout] = useState({ index: 0, observed: false, neutralized: false, awaitingPrismChange: false,
    mode: "distance" as CoverEndpoint, targetEndpoint: null as CoverEndpoint | null, distance: 0, targetReady: false, held: false, prism: "", trial: false, message: "", at: "", progress: 0 });
  const fields = useMemo(() => fieldsFor(kind, readout.mode), [kind, readout.mode]);
  const lastTarget = useRef({ mode: "distance" as CoverEndpoint, ready: false, position: [0, 0, 0] });
  // Release/pickup interrupts dwell, but must not erase elapsed uncovered time.
  const interrupt = useCallback((reason: XRClinicInterruption) => {
    const current = progress.current;
    current.sequence.dwell = 0;
    if (kind === "alternate-cover" && (!current.observed || current.trial) && (reason === "tracking" || reason === "visibility")) {
      current.sequence = emptyPracticeCoverSequence(); current.pulseKey = "";
      current.message = "Tracking interrupted. Start the alternate sequence again.";
    }
  }, [kind]);
  const runtime = useXRClinicRuntime({ active: active && !preview, inputMode, editorOpen: lesson.mode !== "none", onInterrupt: interrupt,
    equipment: COVER_EQUIPMENT,
    equipmentLabels: { worth: "Target" },
    placementSockets: COVER_TARGET_SOCKETS,
    onThumbstickStep: (id, step, _hand, axis) => id === "prism" && kind === "alternate-cover"
      ? axis === "horizontal" ? stepPrismBase(step) : stepPrismPower(step)
      : false,
    onMenu: open => lesson.setMode(open ? "menu" : "none"), onSelection: selection => { if (selection.station === "patient") lesson.setMode("menu"); },
  });
  const eyes = useClinicEyeMotion(active);
  // Sustained patient eye positions in prism dioptres; see interaction/coverDeviation.ts.
  const scenarioModel = useCallback((): CoverDeviationModel => kind === "cover-uncover" ? cover.model
    : alternateCoverModel(alternate), [kind, cover, alternate]);
  const poses = useRef<CoverEyePoses>(coverEyeTargets(scenarioModel(), "away"));
  const lastCover = useRef<CoverPosition>("away");
  const sample = (forRecording = false) => {
    const frame = active && runtime.frameValid.current;
    const held = frame && runtime.workingPose("cover", forRecording);
    const position = held ? xrPracticeCoverPosition(runtime.origin.toArray() as [number, number, number], runtime.direction.toArray() as [number, number, number]) : null;
    const prismHeld = frame && runtime.workingPose("prism", forRecording);
    const prism = prismHeld ? xrPracticeEyePlacement(runtime.origin.toArray() as [number, number, number], runtime.direction.toArray() as [number, number, number], true) : null;
    const targetPose = runtime.supportedWorkingPose("worth", true);
    const target = targetPose ? sensoryTargetCondition(targetPose, runtime.toolsRef.current) : { distanceCm: 0, endpoint: null, facing: false };
    const targetPlacement = runtime.toolsRef.current.worth.placement;
    const socketEndpoint = targetPlacement.kind === "socket" && targetPlacement.socketId === "sensory-worth-distance" ? "distance"
      : targetPlacement.kind === "socket" && targetPlacement.socketId === "sensory-worth-near" ? "near" : null;
    const targetEndpoint = target.endpoint === socketEndpoint ? target.endpoint : null;
    const distanceRecorded = kind === "cover-uncover" ? coverRecordsRef.current.distance : alternateRecordsRef.current.distance;
    const mode: CoverEndpoint = distanceRecorded ? "near" : "distance";
    return { held, position, prism, mode, targetEndpoint, targetReady: targetEndpoint === mode && target.facing && runtime.toolsRef.current.worth.powered,
      distance: Math.round(target.distanceCm), card: targetPose?.position ?? [0, 0, 0] };
  };
  const clearSequence = useCallback(() => {
    progress.current = initial(); lesson.clearPending();
  }, [lesson.clearPending]);
  const clock = useRef(0);
  useFrame((_, dt) => {
    const spatial = sample();
    const placement = sample(true);
    const targetChanged = lastTarget.current.mode !== spatial.mode || (lastTarget.current.ready && !spatial.targetReady)
      || (spatial.mode === "near" && spatial.targetReady && Math.hypot(...spatial.card.map((v, i) => v - lastTarget.current.position[i])) > .01);
    if (targetChanged) {
      clearSequence();
      setup.current.fixation = false; setFixation(false);
    }
    if (targetChanged || spatial.mode === "distance" || !spatial.targetReady || !lastTarget.current.ready) lastTarget.current.position = [...spatial.card];
    lastTarget.current.mode = spatial.mode; lastTarget.current.ready = spatial.targetReady;
    const current = progress.current;
    const valid = Boolean(spatial.held && spatial.targetReady && setup.current.fixation);
    // There is no separate trigger action in the clinical procedure. Once the
    // initial observation is complete, a configured, aligned prism immediately
    // opens the next paddle-guided repeat. A failed repeat waits for a change in
    // prism base or power before another sequence can begin.
    if (kind === "alternate-cover" && current.observed && !current.trial && !current.neutralized
      && !current.awaitingPrismChange && valid && setup.current.base && setup.current.power > 0 && placement.prism
      && !lesson.awarded.current) {
      current.trial = true; current.trialEye = placement.prism; current.sequence = emptyPracticeCoverSequence(); current.pulseKey = "";
      current.message = "Prism aligned · attempt 1 of 2. Cover OD and OS once.";
    }
    if (current.trial && placement.prism !== current.trialEye) {
      current.sequence = emptyPracticeCoverSequence(); current.neutralized = false; current.pulseKey = "";
      current.message = "Keep the prism aligned before the same eye throughout the repeat.";
    }
    const trialValid = !current.trial || spatial.prism === current.trialEye;
    const sequenceReady = Boolean(active && runtime.frameValid.current && spatial.targetReady && setup.current.fixation && trialValid);
    // Keep sampling alternating cover even with the paddle down. Unknown tracking
    // or invalid setup resets unfinished progress rather than freezing its credit.
    if ((!current.observed || current.trial) && (kind === "alternate-cover" || (valid && trialValid))) {
      const index = current.sequence.index;
      if (valid && trialValid && spatial.position === practiceCoverProcedures[kind][index]?.position && current.pulseKey !== `${index}:${spatial.position}`) {
        current.pulseKey = `${index}:${spatial.position}`;
        if (index === 0 && !current.trial) current.message = "";
      }
      const next = advanceXRPracticeCover(kind, current.sequence, spatial.held ? spatial.position : "away", dt, sequenceReady);
      if (next.index < current.sequence.index) { current.pulseKey = ""; current.message = sequenceReady ? "Both eyes were uncovered too long. Start the alternate sequence again." : "Setup interrupted. Start the alternate sequence again."; }
      current.sequence = next;
      if (next.index === practiceCoverProcedures[kind].length) {
        current.observed = true;
        if (current.trial) {
          const eye = current.trialEye as CoverEye;
          const outcome = prismTrialOutcome(alternate, setup.current.base, setup.current.power, eye);
          current.neutralized = prismTrialNeutralizes(alternate, setup.current.base, setup.current.power, eye);
          if (current.neutralized) current.message = "No refixation movement · record the neutralising prism.";
          else if (!guided) current.message = "STOP · Refixation remains. Change the prism setting, then complete two more attempts.";
          else if (outcome === "change-base") current.message = `STOP · ${alternatingMovementWord(alternate.movement)} movement remains with the wrong base. Change to ${prismBaseLabel(neutralizingPrismBase(alternate, eye))}, then complete two more attempts.`;
          else if (outcome === "increase") current.message = `STOP · ${alternatingMovementWord(alternate.movement)} movement remains at ${setup.current.power}Δ ${prismBaseLabel(setup.current.base)}. Increase prism power, then complete two more attempts.`;
          else current.message = `STOP · Movement reversed at ${setup.current.power}Δ ${prismBaseLabel(setup.current.base)}. Reduce prism power, then complete two more attempts.`;
          current.awaitingPrismChange = !current.neutralized;
          current.trial = false;
        }
      }
    } else current.sequence.dwell = 0;
    // Eyes follow the physical occluder continuously, independent of sequence credit:
    // a tropia is visible before covering and every refixation holds until the next change.
    // Mid-transit (neither on an eye nor clear of the face) keeps the last state, so fusion is not regained.
    if (!spatial.held) lastCover.current = "away";
    else if (spatial.position) lastCover.current = spatial.position;
    // The eye looking through the prism turns toward its apex; the fellow keeps the phoria relation.
    const prism: PrismPlacement = kind === "alternate-cover" && spatial.prism && setup.current.base
      ? { eye: spatial.prism, base: setup.current.base, power: setup.current.power } : null;
    poses.current = settleCoverEyes(scenarioModel(), lastCover.current, poses.current, dt, prism);
    const displayBlend = active ? 1 - Math.exp(-14 * Math.min(dt, .1)) : 1;
    eyes.forEach((eye, id) => {
      const [x, y] = active ? coverTeachingIrisOffset(id, poses.current[id]) : [0, 0];
      eye.position.set(eye.position.x + (x - eye.position.x) * displayBlend, eye.position.y + (y - eye.position.y) * displayBlend, 0);
    });
    clock.current += dt;
    if (clock.current >= .1) {
      clock.current = 0;
      const stepDwell = practiceCoverProcedures[kind][current.sequence.index]?.dwell ?? 1;
      const next = { index: current.sequence.index, observed: current.observed, neutralized: current.neutralized, awaitingPrismChange: current.awaitingPrismChange,
        mode: spatial.mode as "distance" | "near", targetEndpoint: spatial.targetEndpoint, distance: spatial.distance,
        targetReady: spatial.targetReady, held: Boolean(placement.held), prism: placement.prism ?? "", trial: current.trial, message: current.message,
        at: spatial.position ?? "", progress: Math.min(100, Math.round(current.sequence.dwell / stepDwell * 10) * 10) };
      setReadout(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    }
  });
  const repeat = () => {
    clearSequence(); setup.current.fixation = false; setFixation(false);
  };
  const reset = useCallback(() => {
    lesson.reset(); clearSequence(); setup.current = { fixation: false, base: "", power: 0 }; setFixation(false); setBase(""); setPower(0); setGuides(guideAvailable);
    coverRecordsRef.current = {}; setCoverRecords({});
    alternateRecordsRef.current = {}; setAlternateRecords({});
    lastTarget.current = { mode: "distance", ready: false, position: [0, 0, 0] }; runtime.resetClinic();
    lastCover.current = "away"; poses.current = coverEyeTargets(scenarioModel(), "away");
    setReadout({ index: 0, observed: false, neutralized: false, awaitingPrismChange: false, mode: "distance", targetEndpoint: null, distance: 0, targetReady: false, held: false, prism: "", trial: false, message: "", at: "", progress: 0 });
  }, [lesson.reset, clearSequence, runtime.resetClinic, guideAvailable, kind, scenarioModel]);
  useEffect(() => { reset(); }, [kind, scenarioIndex, reset]);
  useEffect(() => { if (!active) reset(); }, [active, reset]);
  const prismHeld = kind === "alternate-cover" && runtime.tools.prism.placement.kind === "held";
  const changePrism = (newBase: string, newPower: number) => {
    if (lesson.awarded.current || !prismHeld || (newBase === setup.current.base && newPower === setup.current.power)) return false;
    setup.current.base = newBase; setup.current.power = newPower; setBase(newBase); setPower(newPower);
    progress.current.neutralized = false; progress.current.trial = false; progress.current.awaitingPrismChange = false;
    progress.current.message = "Align the prism before one eye; the cover repeat starts automatically.";
    progress.current.sequence = emptyPracticeCoverSequence(); progress.current.pulseKey = "";
    return true;
  };
  function stepPrismBase(step: -1 | 1) {
    if (!prismHeld) return false;
    const values = bases.map(([value]) => value);
    const current = values.indexOf(setup.current.base as typeof values[number]);
    const next = current < 0
      ? step < 0 ? "base-in" : "base-out"
      : values[(current + step + values.length) % values.length];
    return changePrism(next, setup.current.power);
  }
  function stepPrismPower(step: -1 | 1) {
    if (!prismHeld) return false;
    return changePrism(setup.current.base, Math.max(0, Math.min(30, setup.current.power + step * 2)));
  }
  const endpointRecords = kind === "cover-uncover" ? coverRecords : alternateRecords;
  const entryReady = readout.observed && readout.targetReady && !endpointRecords[readout.mode];
  // Once the four cover-uncover observations are complete, the evidence is
  // frozen. The learner can return the occluder and use either hand to record.
  // Neutralisation freezes the physical endpoint so both instruments can be
  // placed down before using the findings board.
  const ready = active && entryReady && fixation && (kind === "cover-uncover" || readout.neutralized);
  const status = !readout.targetReady
    ? readout.mode === "distance"
      ? readout.targetEndpoint !== "distance" ? "Pick up the target, then release it into the distance dock behind Arun."
        : !runtime.tools.worth.powered ? "Distance target docked · turn on its POWER switch, then confirm the mirrored target."
          : "Confirm the target is visible through the simulated 6 m mirror."
      : `${readout.distance || "—"} cm · move the same illuminated target to the 40 cm near stand.`
    : !fixation ? `Ask the patient to fixate the ${readout.mode === "distance" ? "mirrored distance" : "near"} target.`
    : !readout.observed || readout.trial ? `${readout.mode.toUpperCase()} · ${readout.trial ? `ATTEMPT ${alternateCoverAttemptNumber(readout.index)} OF ${ALTERNATE_COVER_ATTEMPTS_PER_PRISM} · ` : ""}${practiceCoverProcedures[kind][readout.index]?.label ?? "Sequence observed"}${readout.message ? " · " + readout.message : ""}`
      : kind === "alternate-cover" && !readout.neutralized
        ? !prismHeld ? "Sequence observed · pick up the prism bar from the left-side instrument kit."
          : !readout.prism ? "Place the prism working cell inside either eye placement ring."
            : !base || power <= 0 ? "Prism aligned · thumbstick left/right changes base; up/down changes power."
              : readout.message || "Prism aligned · follow the cover guide with the paddle."
        : readout.message || `${readout.mode.toUpperCase()} · sequence observed; record your finding.`;
  const positionDesktopOccluder = () => {
    const index = progress.current.sequence.index;
    const procedure = practiceCoverProcedures[kind];
    const next = procedure[index];
    if (!next) return;
    const anchors = xrCoverGuideAnchors();
    const previous = procedure[Math.max(0, index - 1)]?.position;
    const point = next.position === "away" ? anchors.away[previous === "OS" ? "OS" : "OD"] : anchors.cover[next.position];
    runtime.setDesktopHeldPose("cover", desktopPatientFacingPose("cover", point));
  };
  const actions = [
    { label: fixation ? `${readout.mode.toUpperCase()} FIXATION GIVEN ✓` : `LOOK AT THE ${readout.mode === "distance" ? "DISTANCE" : "NEAR"} TARGET`,
      run: () => { if (!readout.targetReady) return; setup.current.fixation = true; setFixation(true); },
      active: fixation, disabled: !readout.targetReady },
    ...(inputMode === "desktop" && (!readout.observed || readout.trial) ? [{ label: `POSITION OCCLUDER · ${practiceCoverProcedures[kind][readout.index]?.label ?? "SEQUENCE COMPLETE"}`, run: positionDesktopOccluder }] : []),
    ...(kind === "alternate-cover" ? prismHeld ? [{ label: "PRISM SETTINGS · ACCESSIBILITY", run: () => lesson.setMode("settings") }] : [] : [{ label: "REPEAT SEQUENCE", run: repeat }]),
    { label: "HELP", run: () => lesson.setMode("help") },
    ...(guideAvailable ? [{ label: guides ? "HIDE COVER GUIDE" : "SHOW COVER GUIDE", run: () => setGuides(value => !value), active: guides }] : []),
  ];
  const guideTarget = xrCoverGuideTarget(kind, readout.index);
  const showPrismGuide = active && guideAvailable && guides && kind === "alternate-cover" && readout.observed
    && prismHeld && !readout.neutralized && (!readout.prism || (!readout.trial && !readout.awaitingPrismChange && (!base || power <= 0)));
  const showCoverGuide = active && guideAvailable && guides && readout.targetReady && fixation
    && (!readout.observed || (readout.trial && Boolean(readout.prism))) && guideTarget !== null;
  const guidance = coverGuidedStep({
    kind,
    occluderHeld: runtime.tools.cover.placement.kind === "held",
    targetHeld: runtime.tools.worth.placement.kind === "held",
    targetPowered: runtime.tools.worth.powered,
    targetEndpoint: readout.targetEndpoint,
    targetReady: readout.targetReady,
    distanceRecorded: Boolean(endpointRecords.distance),
    nearRecorded: Boolean(endpointRecords.near),
    fixation,
    sequenceIndex: readout.index,
    sequenceTotal: practiceCoverProcedures[kind].length,
    nextPositionLabel: practiceCoverProcedures[kind][readout.index]?.label,
    sequenceMessage: readout.message,
    observed: readout.observed,
    prismHeld,
    prismAligned: Boolean(readout.prism),
    prismConfigured: Boolean(base) && power > 0,
    neutralized: readout.neutralized,
    prismTrialActive: readout.trial,
    prismAdjustmentRequired: readout.awaitingPrismChange,
    prismTeachingCue: guided ? alternatingMovementCue(alternate.movement) : undefined,
    recommendedPrismBase: guided && readout.prism ? prismBaseLabel(neutralizingPrismBase(alternate, readout.prism as CoverEye)) : undefined,
    observationComplete: fields.every(field => Boolean(lesson.entries[field.id])),
    recorded: lesson.recorded,
  });
  const record = () => {
    const spatial = sample(true), state = progress.current, entries = lesson.entriesRef.current;
    const valid = active && spatial.targetReady && setup.current.fixation && state.observed;
    const correct = kind === "cover-uncover" ? entries.pattern === cover.id : entries.movement === alternate.movement && entries.deviation === alternate.deviation && state.neutralized;
    const entriesComplete = fields.every(field => Boolean(entries[field.id]));
    if (kind === "cover-uncover") {
      const endpoint = spatial.mode as "distance" | "near";
      if (!valid || !entriesComplete || coverRecordsRef.current[endpoint]) return;
      if (!correct) { lesson.submit(true, false, "Repeat and watch which eye moves, in which direction, and when."); return; }
      const records = { ...coverRecordsRef.current, [endpoint]: entries.pattern };
      coverRecordsRef.current = records; setCoverRecords(records);
      if (endpoint === "distance") {
        progress.current = initial(); setup.current.fixation = false; setFixation(false);
        setReadout(previous => ({ ...previous, index: 0, observed: false, neutralized: false, awaitingPrismChange: false, mode: "near", targetReady: false,
          held: false, prism: "", trial: false, message: "", at: "", progress: 0 }));
        lesson.clearPending(); lesson.setMode("none"); runtime.closePanels(); lesson.progress("Distance finding recorded. Move the same illuminated target to the 40 cm near stand, re-establish fixation, and repeat.");
      } else lesson.submit(true, true, `Distance and near cover–uncover findings recorded independently. ${cover.feedback}`);
      return;
    }
    const endpoint = spatial.mode as CoverEndpoint;
    if (!valid || !entriesComplete || !state.neutralized || alternateRecordsRef.current[endpoint]) return;
    if (!correct) { lesson.submit(true, false, "Repeat and watch which eye moves, in which direction, and when."); return; }
    const capture: AlternateCapture = { movement: entries.movement, deviation: entries.deviation, power: setup.current.power,
      base: setup.current.base, eye: state.trialEye as CoverEye };
    const records = { ...alternateRecordsRef.current, [endpoint]: capture };
    alternateRecordsRef.current = records; setAlternateRecords(records);
    const endpointSummary = `${endpoint}: ${capture.power}Δ ${prismBaseLabel(capture.base)} before ${capture.eye} neutralised the ${alternateDeviationLabel(capture.deviation)} deviation.`;
    if (endpoint === "distance") {
      progress.current = initial(); setup.current = { fixation: false, base: "", power: 0 }; setFixation(false); setBase(""); setPower(0);
      setReadout(previous => ({ ...previous, index: 0, observed: false, neutralized: false, awaitingPrismChange: false, mode: "near", targetReady: false,
        held: false, prism: "", trial: false, message: "", at: "", progress: 0 }));
      lesson.clearPending(); lesson.setMode("none"); runtime.closePanels(); lesson.progress(`${endpointSummary} Move the same illuminated target to the 40 cm near stand, re-establish fixation, and repeat.`);
    } else lesson.submit(true, true, `Distance and near prism endpoints recorded independently. ${endpointSummary}`);
  };
  const next = () => { if (!lesson.awarded.current) return; reset(); setScenarioIndex(value => value + 1); };
  const prismActions: LessonAction[] = [...bases.map(([value, label]) => ({ label: label.toUpperCase(), run: () => changePrism(value, setup.current.power), active: base === value, disabled: !prismHeld })),
    { label: "POWER −2Δ", run: () => changePrism(setup.current.base, Math.max(0, setup.current.power - 2)), disabled: !prismHeld },
    { label: "POWER +2Δ", run: () => changePrism(setup.current.base, Math.min(30, setup.current.power + 2)), disabled: !prismHeld },
    { label: "REPEAT SEQUENCE", run: repeat }];
  useEffect(() => { onMirror?.({ title: kind === "cover-uncover" ? "Cover–uncover" : "Alternating cover", findingPosition: { current: scenarioIndex % (kind === "cover-uncover" ? coverScenarios.length : alternateCoverScenarios.length) + 1, total: kind === "cover-uncover" ? coverScenarios.length : alternateCoverScenarios.length },
    status: kind === "alternate-cover" ? `${status} · prism ${power}Δ ${base || "base unselected"}` : status, ready, entryReady, fields,
    actions: kind === "alternate-cover" ? [...actions, ...prismActions] : actions, lesson, reset, record, next,
    reportLines: kind === "cover-uncover"
      ? ([coverRecords.distance ? `Distance: ${cover.label}` : "", coverRecords.near ? `Near 40 cm: ${cover.label}` : ""].filter(Boolean))
      : ([alternateRecords.distance ? `Distance: ${alternateRecords.distance.power}Δ ${prismBaseLabel(alternateRecords.distance.base)} before ${alternateRecords.distance.eye}` : "",
          alternateRecords.near ? `Near 40 cm: ${alternateRecords.near.power}Δ ${prismBaseLabel(alternateRecords.near.base)} before ${alternateRecords.near.eye}` : ""].filter(Boolean)) }); },
    [onMirror, status, ready, entryReady, lesson.mode, lesson.entries, lesson.feedback, lesson.recorded, fixation, base, power, readout.prism, scenarioIndex, guides, coverRecords, alternateRecords, fields]);
  const settings = <XRHeadPanel>
    <Box s={[.76, .90, .018]} c="#102329" radius={.012} />
    <XRSign text={["PRISM · SELECTED WORKING CELL", `${power}Δ · ${base || "choose base"}`, readout.prism ? `Aligned before ${readout.prism}` : "Hold the middle cell before either pupil."]} p={[0, .31, .012]} size={[.70, .20]} bg="#102329" fg="#eefbf7" />
    {prismActions.map((action, index) => <XRPanelButton key={action.label} label={action.label} active={action.active} disabled={lesson.recorded || action.disabled}
      position={[index % 2 ? .18 : -.18, .15 - Math.floor(index / 2) * .085, .025]} width={.34} onClick={action.run} />)}
    <XRPanelButton label="CLOSE SETTINGS" position={[-.18, -.23, .025]} width={.34} onClick={() => lesson.setMode("none")} />
    <XRPanelButton label="EXIT VR" position={[.18, -.23, .025]} width={.34} onClick={onExit} />
  </XRHeadPanel>;
  return <>
    <XRClinicRuntimeView cleanHands runtime={runtime} active={active && !preview} preview={preview}
      title={`${kind === "cover-uncover" ? "COVER–UNCOVER" : "ALTERNATING COVER"} · PRACTICE`}
      sensoryStation="worth" sensoryFixationLetter
      instrumentSettings={{ prism: { power, base }, worth: { fixationLetter: true, onPowerChange: powered => runtime.setToolPower("worth", powered),
        highlightPowerSwitch: guided && readout.targetEndpoint === "distance" && !runtime.tools.worth.powered } }} showWallInstructions={!guided}
      showInstructionalHighlights={false}
      instructionalEquipment={guided && kind === "alternate-cover" && readout.observed && !prismHeld ? ["prism"]
        : guided && !readout.targetReady ? ["worth"] : []} />
    {(active || preview) && guided && <XRGuidedStepBubble stepId={guidance.id} stepNumber={guidance.index + 1}
      total={kind === "cover-uncover" ? COVER_UNCOVER_GUIDED_STEP_COUNT : ALTERNATE_COVER_GUIDED_STEP_COUNT}
      title={guidance.title} lines={guidance.lines} complete={guidance.complete} />}
    {showPrismGuide && <XRPrismPlacementGuide current={(readout.prism || null) as CoverEye | null} />}
    {showCoverGuide && guideTarget && <XRCoverGuide target={guideTarget} current={(readout.at || null) as CoverPosition | null}
      progress={readout.progress / 100} />}
    <PracticeLessonUI runtime={runtime} active={active} title={kind === "cover-uncover" ? "COVER–UNCOVER" : "ALTERNATING COVER"} status={status}
      tools={kind === "cover-uncover" ? ["cover", "worth"] : ["cover", "prism", "worth"]} actions={actions} fields={fields} lesson={lesson} entryReady={entryReady} ready={ready}
      onRecord={record} onReset={reset} onNext={next} onExit={onExit} settings={settings}
      help={kind === "cover-uncover"
        ? ["Pick up the target from the extended instrument kit and release it into the distance dock behind Arun.", "Turn on its POWER switch and confirm the target appears through the simulated 6 m mirror.", "Ask Arun to fixate, then pick up the occluder and cover and uncover each eye in order.", "Classify and record the distance movement timing.", "Move the same illuminated target to the 40 cm near stand, re-establish fixation, repeat the complete sequence, and record the near finding."]
        : ["Set up and illuminate the target in the mirrored 6 m distance dock, then establish fixation.", "Shift the occluder directly between eyes to keep fusion broken.", "At each prism power, complete two attempts. One attempt means covering OD and OS once.", "After attempt 2, stop and follow the result before changing power.", "Eye movement is visually amplified for teaching and is not calibrated.", "Record the distance movement and frozen prism endpoint.", "Move the same illuminated target to the 40 cm stand, re-establish fixation, and repeat the full sequence and neutralisation.", "Completion requires separate distance and near records."]} />
  </>;
}
