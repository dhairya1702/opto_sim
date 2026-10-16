import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import { ALTERNATE_COVER_GUIDED_STEP_COUNT, COVER_UNCOVER_GUIDED_STEP_COUNT, coverGuidedStep } from "../../interaction/alignmentGuidance";
import { useXRClinicRuntime } from "../../interaction/useXRClinicRuntime";
import { CONSULTATION_EQUIPMENT, consultationToolDefinition } from "../../interaction/xrConsultationTools";
import { coverScenarios, alternateCoverModel, alternateCoverScenarios, alternateDeviationChoices, alternateDeviationLabel, practiceCoverProcedures, prismBaseLabel, prismTrialNeutralizes, type PracticeCoverKind } from "../../interaction/practiceCover";
import { advanceXRPracticeCover, emptyPracticeCoverSequence, xrCoverGuideTarget, xrPracticeCoverPosition, xrPracticeEyePlacement, xrPracticeNearFixation, PRACTICE_NEAR_SOCKET } from "../../interaction/xrPracticeBatch";
import type { CoverEye, CoverPosition } from "../../interaction/cover";
import { coverEyeTargets, coverIrisOffset, settleCoverEyes, type CoverDeviationModel, type CoverEyePoses, type PrismPlacement } from "../../interaction/coverDeviation";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { XRCoverGuide } from "../../scene/XRCoverGuide";
import { XRGuidedStepBubble } from "../../scene/XRGuidedStepBubble";
import { Box, Cylinder } from "../../scene/Models";
import { XRHeadPanel, XRPanelButton, XRSign } from "../../scene/XRClinicPanels";
import { useClinicEyeMotion } from "./useClinicEyeMotion";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonField, type LessonAction } from "./PracticeLessonUI";
import { usePracticeAttempt } from "../PracticeAttemptContext";

const bases = [["base-in", "Base in"], ["base-out", "Base out"], ["base-up", "Base up"], ["base-down", "Base down"]] as const;
const COVER_UNCOVER_EQUIPMENT = CONSULTATION_EQUIPMENT.filter(id => id !== "near");
const fieldsFor = (kind: PracticeCoverKind): LessonField[] => kind === "cover-uncover"
  ? [{ id: "pattern", label: "Movement timing", choices: coverScenarios.map(item => [item.id, item.label]) }]
  : [{ id: "movement", label: "OD movement on uncovering", choices: [["in", "In"], ["out", "Out"], ["up", "Up"], ["down", "Down"]] },
    { id: "deviation", label: "Deviation", choices: alternateDeviationChoices.map(([id, label]) => [id, label]) }];
const initial = () => ({ sequence: emptyPracticeCoverSequence(), observed: false, trial: false, neutralized: false, trialEye: "" as string, pulseKey: "", message: "" });
export function CoverPracticeController({ active, preview = false, kind, onComplete, onExit, onMirror }: {
  active: boolean; preview?: boolean; kind: PracticeCoverKind; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const { settings: attemptSettings } = usePracticeAttempt();
  const guided = attemptSettings?.kind === "guided";
  const guideAvailable = attemptSettings?.kind !== "test";
  const [guides, setGuides] = useState(guideAvailable);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const cover = coverScenarios[scenarioIndex % coverScenarios.length], alternate = alternateCoverScenarios[scenarioIndex % alternateCoverScenarios.length];
  const fields = useMemo(() => fieldsFor(kind), [kind]);
  const lesson = usePracticeLesson(onComplete);
  const [fixation, setFixation] = useState(false), [base, setBase] = useState<string>(""), [power, setPower] = useState(0);
  const setup = useRef({ fixation, base, power }); setup.current = { fixation, base, power };
  const progress = useRef(initial());
  const [readout, setReadout] = useState({ index: 0, observed: false, neutralized: false, mode: "distance", distance: 0, targetReady: true, held: false, prism: "", trial: false, message: "", at: "", progress: 0 });
  const lastTarget = useRef({ mode: "distance", ready: true, position: [0, 0, 0] });
  const interrupt = useCallback(() => { progress.current.sequence.dwell = 0; progress.current.sequence.transit = 0; }, []);
  const runtime = useXRClinicRuntime({ active: active && !preview, editorOpen: lesson.mode !== "none", onInterrupt: interrupt,
    equipment: kind === "cover-uncover" ? COVER_UNCOVER_EQUIPMENT : CONSULTATION_EQUIPMENT,
    placementSockets: kind === "cover-uncover" ? [] : [PRACTICE_NEAR_SOCKET],
    onMenu: open => lesson.setMode(open ? "menu" : "none"), onSelection: selection => { if (selection.station === "patient") lesson.setMode("menu"); },
  });
  const eyes = useClinicEyeMotion(active);
  // Sustained patient eye positions in prism dioptres; see interaction/coverDeviation.ts.
  const scenarioModel = useCallback((): CoverDeviationModel => kind === "cover-uncover" ? cover.model
    : alternateCoverModel(alternate), [kind, cover, alternate]);
  const poses = useRef<CoverEyePoses>(coverEyeTargets(scenarioModel(), "away"));
  const lastCover = useRef<CoverPosition>("away");
  const cardPoint = useMemo(() => new Vector3(), []);
  const sample = (forRecording = false) => {
    const frame = active && runtime.frameValid.current;
    const held = frame && runtime.workingPose("cover", forRecording);
    const position = held ? xrPracticeCoverPosition(runtime.origin.toArray() as [number, number, number], runtime.direction.toArray() as [number, number, number]) : null;
    const prismHeld = frame && runtime.workingPose("prism", forRecording);
    const prism = prismHeld ? xrPracticeEyePlacement(runtime.origin.toArray() as [number, number, number], runtime.direction.toArray() as [number, number, number], true) : null;
    if (kind === "cover-uncover") return { held, position, prism: null, mode: "distance", targetReady: true, distance: 0, card: [0, 0, 0] };
    const card = runtime.objects.current.get("near");
    const placement = runtime.toolsRef.current.near.placement;
    const home = consultationToolDefinition("near").home;
    const atHome = placement.kind !== "held" && Math.hypot(...placement.position.map((v, i) => v - home[i])) < .08;
    const mode = atHome ? "distance" : "near";
    if (card) { cardPoint.set(0, 0, .005); card.localToWorld(cardPoint); }
    const near = xrPracticeNearFixation(cardPoint.toArray() as [number, number, number]);
    const cardAvailable = placement.kind !== "held" || (frame && runtime.workingPose("near", true));
    return { held, position, prism, mode, targetReady: atHome || Boolean(card && cardAvailable && near.ready), distance: atHome ? 0 : Math.round(near.distanceCm), card: cardPoint.toArray() };
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
    if (targetChanged) clearSequence();
    if (targetChanged || spatial.mode === "distance" || !spatial.targetReady || !lastTarget.current.ready) lastTarget.current.position = spatial.card;
    lastTarget.current.mode = spatial.mode; lastTarget.current.ready = spatial.targetReady;
    const current = progress.current;
    const valid = Boolean(spatial.held && spatial.targetReady && setup.current.fixation);
    if ((current.trial || current.neutralized) && placement.prism !== current.trialEye) {
      current.sequence = emptyPracticeCoverSequence(); current.neutralized = false; current.pulseKey = "";
      current.message = "Keep the prism aligned before the same eye throughout the repeat.";
    }
    const trialValid = !current.trial || spatial.prism === current.trialEye;
    if ((!current.observed || current.trial) && valid && trialValid) {
      const index = current.sequence.index;
      if (spatial.position === practiceCoverProcedures[kind][index]?.position && current.pulseKey !== `${index}:${spatial.position}`) {
        current.pulseKey = `${index}:${spatial.position}`;
        if (index === 0 && !current.trial) current.message = "";
      }
      const next = advanceXRPracticeCover(kind, current.sequence, spatial.position, dt, true);
      if (next.index < current.sequence.index) { current.pulseKey = ""; current.message = "Both eyes were uncovered too long. Start the alternate sequence again."; }
      current.sequence = next;
      if (next.index === practiceCoverProcedures[kind].length) {
        current.observed = true;
        if (current.trial) {
          current.neutralized = prismTrialNeutralizes(alternate, setup.current.base, setup.current.power, current.trialEye as CoverEye);
          current.message = current.neutralized ? "No refixation movement seen · record the neutralising prism." : "Refixation remains · adjust base/power and repeat.";
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
    eyes.forEach((eye, id) => {
      const [x, y] = active ? coverIrisOffset(id, poses.current[id]) : [0, 0];
      eye.position.set(x, y, 0);
    });
    clock.current += dt;
    if (clock.current >= .1) {
      clock.current = 0;
      const stepDwell = practiceCoverProcedures[kind][current.sequence.index]?.dwell ?? 1;
      const next = { index: current.sequence.index, observed: current.observed, neutralized: current.neutralized, mode: spatial.mode, distance: spatial.distance,
        targetReady: spatial.targetReady, held: Boolean(placement.held), prism: placement.prism ?? "", trial: current.trial, message: current.message,
        at: spatial.position ?? "", progress: Math.min(100, Math.round(current.sequence.dwell / stepDwell * 10) * 10) };
      setReadout(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    }
  });
  const repeat = () => { lesson.reset(); clearSequence(); };
  const reset = useCallback(() => {
    lesson.reset(); clearSequence(); setup.current = { fixation: false, base: "", power: 0 }; setFixation(false); setBase(""); setPower(0); setGuides(guideAvailable);
    lastTarget.current = { mode: "distance", ready: true, position: [0, 0, 0] }; runtime.resetClinic();
    lastCover.current = "away"; poses.current = coverEyeTargets(scenarioModel(), "away");
    setReadout({ index: 0, observed: false, neutralized: false, mode: "distance", distance: 0, targetReady: true, held: false, prism: "", trial: false, message: "", at: "", progress: 0 });
  }, [lesson.reset, clearSequence, runtime.resetClinic, guideAvailable, scenarioModel]);
  useEffect(() => { reset(); }, [kind, scenarioIndex, reset]);
  useEffect(() => { if (!active) reset(); }, [active, reset]);
  const prismHeld = kind === "alternate-cover" && runtime.tools.prism.placement.kind === "held";
  const changePrism = (newBase: string, newPower: number) => {
    if (lesson.awarded.current || !prismHeld) return;
    setup.current.base = newBase; setup.current.power = newPower; setBase(newBase); setPower(newPower);
    progress.current.neutralized = false; progress.current.trial = false; progress.current.message = "Align the prism before one eye, then repeat.";
    progress.current.sequence = emptyPracticeCoverSequence(); progress.current.pulseKey = "";
  };
  const startTrial = () => {
    const spatial = sample(), state = progress.current;
    if (!active || !state.observed || !setup.current.base || !spatial.prism || !spatial.targetReady || lesson.awarded.current) return;
    state.trial = true; state.trialEye = spatial.prism; state.neutralized = false; state.sequence = emptyPracticeCoverSequence(); state.pulseKey = "";
    state.message = "A/X back to tool mode; repeat alternate cover with the prism held steady.";
    lesson.setMode("none");
  };
  const entryReady = readout.observed && readout.targetReady;
  // Once the four cover-uncover observations are complete, the evidence is
  // frozen. The learner can return the occluder and use either hand to record.
  // Alternating cover still needs its live held-tool state for neutralisation.
  const toolReady = kind === "cover-uncover" || readout.held;
  const ready = active && entryReady && toolReady && fixation && (kind === "cover-uncover" || readout.neutralized);
  const status = !fixation ? "Ask the patient to fixate the target."
    : !readout.targetReady ? `${readout.distance} cm · position the near card at about 40 cm; release onto its stand.`
    : !readout.observed || readout.trial ? `${readout.mode.toUpperCase()} · ${practiceCoverProcedures[kind][readout.index]?.label ?? "Sequence observed"}${readout.message ? " · " + readout.message : ""}`
      : kind === "alternate-cover" && !readout.neutralized
        ? !prismHeld ? "Sequence observed · pick up the prism bar from the left-side instrument kit."
          : !base || power <= 0 ? "Prism held · open Prism Settings and choose a base and power."
            : !readout.prism ? "Move the gold-ringed prism cell before one eye."
              : readout.message || "Prism aligned · choose Repeat with prism."
        : readout.message || `${readout.mode.toUpperCase()} · sequence observed; record your finding.`;
  const actions = [
    { label: fixation ? "FIXATION GIVEN ✓" : "LOOK AT THE TARGET", run: () => { setup.current.fixation = true; setFixation(true); }, active: fixation },
    ...(kind === "alternate-cover" ? prismHeld ? [{ label: "PRISM SETTINGS", run: () => lesson.setMode("settings") }] : [] : [{ label: "REPEAT SEQUENCE", run: repeat }]),
    { label: "HELP", run: () => lesson.setMode("help") },
    ...(guideAvailable ? [{ label: guides ? "HIDE COVER GUIDE" : "SHOW COVER GUIDE", run: () => setGuides(value => !value), active: guides }] : []),
  ];
  const guideTarget = xrCoverGuideTarget(kind, readout.index);
  const showCoverGuide = active && guideAvailable && guides && readout.held && (!readout.observed || readout.trial) && guideTarget !== null;
  const guidance = coverGuidedStep({
    kind,
    occluderHeld: runtime.tools.cover.placement.kind === "held",
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
    observationComplete: fields.every(field => Boolean(lesson.entries[field.id])),
    recorded: lesson.recorded,
  });
  const record = () => {
    const spatial = sample(true), state = progress.current, entries = lesson.entriesRef.current;
    const toolValid = kind === "cover-uncover" || spatial.held;
    const valid = active && toolValid && spatial.targetReady && setup.current.fixation && state.observed;
    const correct = kind === "cover-uncover" ? entries.pattern === cover.id : entries.movement === alternate.movement && entries.deviation === alternate.deviation && state.neutralized && spatial.prism === state.trialEye;
    const entriesComplete = fields.every(field => Boolean(entries[field.id]));
    lesson.submit(Boolean(valid && entriesComplete && (kind === "cover-uncover" || state.neutralized)), correct,
      correct ? kind === "cover-uncover" ? cover.feedback : `${spatial.mode}: ${setup.current.power}Δ ${prismBaseLabel(setup.current.base)} before ${state.trialEye} neutralised the ${alternateDeviationLabel(alternate.deviation)} deviation.`
        : "Repeat and watch which eye moves, in which direction, and when.");
  };
  const next = () => { if (!lesson.awarded.current) return; reset(); setScenarioIndex(value => value + 1); };
  const prismActions: LessonAction[] = [...bases.map(([value, label]) => ({ label: label.toUpperCase(), run: () => changePrism(value, setup.current.power), active: base === value, disabled: !prismHeld })),
    { label: "POWER −2Δ", run: () => changePrism(setup.current.base, Math.max(0, setup.current.power - 2)), disabled: !prismHeld },
    { label: "POWER +2Δ", run: () => changePrism(setup.current.base, Math.min(30, setup.current.power + 2)), disabled: !prismHeld },
    { label: "REPEAT WITH PRISM", run: startTrial, disabled: !readout.observed || !base || !readout.prism },
    { label: "REPEAT SEQUENCE", run: repeat }];
  useEffect(() => { onMirror?.({ title: kind === "cover-uncover" ? "Cover–uncover" : "Alternating cover", findingPosition: { current: scenarioIndex % (kind === "cover-uncover" ? coverScenarios.length : alternateCoverScenarios.length) + 1, total: kind === "cover-uncover" ? coverScenarios.length : alternateCoverScenarios.length },
    status: kind === "alternate-cover" ? `${status} · prism ${power}Δ ${base || "base unselected"}` : status, ready, entryReady, fields,
    actions: kind === "alternate-cover" ? [...actions, ...prismActions] : actions, lesson, reset, record, next }); },
    [onMirror, status, ready, entryReady, lesson.mode, lesson.entries, lesson.feedback, lesson.recorded, fixation, base, power, readout.prism, scenarioIndex, guides]);
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
      instrumentSettings={{ prism: { power, base } }} showWallInstructions={!guided}
      instructionalEquipment={guided && kind === "alternate-cover" && readout.observed && !prismHeld ? ["prism"] : []} />
    {(active || preview) && guided && <XRGuidedStepBubble stepId={guidance.id} stepNumber={guidance.index + 1}
      total={kind === "cover-uncover" ? COVER_UNCOVER_GUIDED_STEP_COUNT : ALTERNATE_COVER_GUIDED_STEP_COUNT}
      title={guidance.title} lines={guidance.lines} complete={guidance.complete} />}
    {showCoverGuide && guideTarget && <XRCoverGuide target={guideTarget} current={(readout.at || null) as CoverPosition | null}
      progress={readout.progress / 100} />}
    {(active || preview) && kind === "alternate-cover" && <group position={[0, 0, PRACTICE_NEAR_SOCKET.position[2]]} userData={{ xrIgnoreRay: true }}>
      <Cylinder p={[0, .6625, 0]} h={1.325} radius={.009} c="#72908c" />
      <Box p={[0, .02, 0]} s={[.22, .025, .18]} c="#39565b" radius={.008} />
      <Box p={[0, PRACTICE_NEAR_SOCKET.position[1] - .087, 0]} s={[.26, .018, .035]} c="#39565b" radius={.006} />
      <XRSign text={["NEAR CARD · RELEASE HERE", "40 cm · assisted placement"]} p={[.22, 1.29, 0]} size={[.30, .075]} bg="#173a3e" fg="#e8fff9" />
    </group>}
    <PracticeLessonUI runtime={runtime} active={active} title={kind === "cover-uncover" ? "COVER–UNCOVER" : "ALTERNATING COVER"} status={status}
      tools={kind === "cover-uncover" ? ["cover"] : ["cover", "prism"]} actions={actions} fields={fields} lesson={lesson} entryReady={entryReady} ready={ready}
      onRecord={record} onReset={reset} onNext={next} onExit={onExit} settings={settings}
      help={["Pick the cover occluder; establish target fixation.", "Distance target is illustrative in this clinic.", ...(kind === "alternate-cover" ? ["Move the near card to 40 cm; mount it on the stand."] : []), "Cover one pupil, keeping the other eye visible.", kind === "cover-uncover" ? "Watch the visible eye, then uncover immediately." : "Shift directly between eyes; keep fusion broken.",
        kind === "cover-uncover" ? "Repeat with the fellow eye and classify timing." : "Add prism before either eye; repeat until no movement."]} />
  </>;
}
