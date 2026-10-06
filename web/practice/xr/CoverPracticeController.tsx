import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import { useXRClinicRuntime } from "../../interaction/useXRClinicRuntime";
import { consultationToolDefinition } from "../../interaction/xrConsultationTools";
import { coverScenarios, alternateCoverScenarios, practiceCoverProcedures, prismTrialNeutralizes, type PracticeCoverKind } from "../../interaction/practiceCover";
import { advanceXRPracticeCover, emptyPracticeCoverSequence, coverPracticePulse, xrPracticeCoverPosition, xrPracticeEyePlacement, xrPracticeNearFixation, PRACTICE_NEAR_SOCKET } from "../../interaction/xrPracticeBatch";
import { XRClinicRuntimeView } from "../../scene/XRClinicRuntimeView";
import { Box, Cylinder } from "../../scene/Models";
import { XRHeadPanel, XRPanelButton, XRSign } from "../../scene/XRClinicPanels";
import { useClinicEyeMotion } from "./useClinicEyeMotion";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type LessonField, type LessonAction } from "./PracticeLessonUI";

const bases = [["base-in", "Base in"], ["base-out", "Base out"], ["base-up", "Base up"], ["base-down", "Base down"]] as const;
const fieldsFor = (kind: PracticeCoverKind): LessonField[] => kind === "cover-uncover"
  ? [{ id: "pattern", label: "Movement timing", choices: coverScenarios.map(item => [item.id, item.label]) }]
  : [{ id: "movement", label: "Refixation direction", choices: [["in", "In"], ["out", "Out"], ["up", "Up"], ["down", "Down"]] },
    { id: "deviation", label: "Deviation", choices: [["exo", "Exo"], ["eso", "Eso"], ["hypo", "Hypo"], ["hyper", "Hyper"]] }];
const initial = () => ({ sequence: emptyPracticeCoverSequence(), observed: false, trial: false, neutralized: false, trialEye: "" as string, pulseKey: "", message: "" });
export function CoverPracticeController({ active, preview = false, kind, onComplete, onExit, onMirror }: {
  active: boolean; preview?: boolean; kind: PracticeCoverKind; onComplete: () => void; onExit: () => void; onMirror?: (mirror: BatchMirror) => void;
}) {
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const cover = coverScenarios[scenarioIndex % coverScenarios.length], alternate = alternateCoverScenarios[scenarioIndex % alternateCoverScenarios.length];
  const fields = useMemo(() => fieldsFor(kind), [kind]);
  const lesson = usePracticeLesson(onComplete);
  const [fixation, setFixation] = useState(false), [base, setBase] = useState<string>(""), [power, setPower] = useState(0);
  const setup = useRef({ fixation, base, power }); setup.current = { fixation, base, power };
  const progress = useRef(initial());
  const [readout, setReadout] = useState({ index: 0, observed: false, neutralized: false, mode: "distance", distance: 0, targetReady: true, held: false, prism: "", trial: false, message: "" });
  const lastTarget = useRef({ mode: "distance", ready: true, position: [0, 0, 0] });
  const interrupt = useCallback(() => { progress.current.sequence.dwell = 0; progress.current.sequence.transit = 0; }, []);
  const runtime = useXRClinicRuntime({ active: active && !preview, editorOpen: lesson.mode !== "none", onInterrupt: interrupt, placementSockets: [PRACTICE_NEAR_SOCKET],
    onMenu: open => lesson.setMode(open ? "menu" : "none"), onSelection: selection => { if (selection.station === "patient") lesson.setMode("menu"); },
  });
  const eyes = useClinicEyeMotion(active);
  const offsets = useRef({ OD: { x: 0, y: 0 }, OS: { x: 0, y: 0 } });
  const cardPoint = useMemo(() => new Vector3(), []);
  const sample = (forRecording = false) => {
    const frame = active && runtime.frameValid.current;
    const held = frame && runtime.workingPose("cover", forRecording);
    const position = held ? xrPracticeCoverPosition(runtime.origin.toArray() as [number, number, number], runtime.direction.toArray() as [number, number, number]) : null;
    const prismHeld = frame && runtime.workingPose("prism", forRecording);
    const prism = prismHeld ? xrPracticeEyePlacement(runtime.origin.toArray() as [number, number, number], runtime.direction.toArray() as [number, number, number], true) : null;
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
    offsets.current = { OD: { x: 0, y: 0 }, OS: { x: 0, y: 0 } };
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
        const neutral = current.trial && prismTrialNeutralizes(alternate, setup.current.base, setup.current.power);
        const pulse = coverPracticePulse(kind, cover.id, index, neutral ? "none" : alternate.movement);
        if (pulse && pulse.direction !== "none") {
          const inward = pulse.eye === "OD" ? 1 : -1;
          offsets.current[pulse.eye] = {
            x: -(pulse.direction === "in" ? inward : pulse.direction === "out" ? -inward : 0) * .004,
            y: -(pulse.direction === "up" ? 1 : pulse.direction === "down" ? -1 : 0) * .003,
          };
        }
      }
      const next = advanceXRPracticeCover(kind, current.sequence, spatial.position, dt, true);
      if (next.index < current.sequence.index) { current.pulseKey = ""; current.message = "Both eyes were uncovered too long. Start the alternate sequence again."; }
      current.sequence = next;
      if (next.index === practiceCoverProcedures[kind].length) {
        current.observed = true;
        if (current.trial) {
          current.neutralized = prismTrialNeutralizes(alternate, setup.current.base, setup.current.power);
          current.message = current.neutralized ? "No refixation movement seen · record the neutralising prism." : "Refixation remains · adjust base/power and repeat.";
          current.trial = false;
        }
      }
    } else current.sequence.dwell = 0;
    // Motion begins on actual cover/uncover, before the step's observation dwell ends.
    const blend = 1 - Math.exp(-Math.min(dt, .1) * 6.5);
    eyes.forEach((eye, id) => {
      const offset = offsets.current[id];
      eye.position.set(active ? offset.x : 0, active ? offset.y : 0, 0);
      offset.x *= 1 - blend; offset.y *= 1 - blend;
    });
    clock.current += dt;
    if (clock.current >= .1) {
      clock.current = 0;
      const next = { index: current.sequence.index, observed: current.observed, neutralized: current.neutralized, mode: spatial.mode, distance: spatial.distance,
        targetReady: spatial.targetReady, held: Boolean(placement.held), prism: placement.prism ?? "", trial: current.trial, message: current.message };
      setReadout(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    }
  });
  const repeat = () => { lesson.reset(); clearSequence(); };
  const reset = useCallback(() => {
    lesson.reset(); clearSequence(); setup.current = { fixation: false, base: "", power: 0 }; setFixation(false); setBase(""); setPower(0);
    lastTarget.current = { mode: "distance", ready: true, position: [0, 0, 0] }; runtime.resetClinic();
    setReadout({ index: 0, observed: false, neutralized: false, mode: "distance", distance: 0, targetReady: true, held: false, prism: "", trial: false, message: "" });
  }, [lesson.reset, clearSequence, runtime.resetClinic]);
  useEffect(() => { reset(); }, [kind, scenarioIndex, reset]);
  useEffect(() => { if (!active) reset(); }, [active, reset]);
  const changePrism = (newBase: string, newPower: number) => {
    if (lesson.awarded.current) return;
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
  const ready = active && entryReady && readout.held && fixation && (kind === "cover-uncover" || readout.neutralized);
  const status = !fixation ? "Ask the patient to fixate the target."
    : !readout.targetReady ? `${readout.distance} cm · position the near card at about 40 cm; release onto its stand.`
    : !readout.observed || readout.trial ? `${readout.mode.toUpperCase()} · ${practiceCoverProcedures[kind][readout.index]?.label ?? "Sequence observed"}${readout.message ? " · " + readout.message : ""}`
      : readout.message || (kind === "alternate-cover" && !readout.neutralized ? "Observe movement, add prism, then repeat to neutralise." : `${readout.mode.toUpperCase()} · sequence observed; record your finding.`);
  const actions = [
    { label: fixation ? "FIXATION GIVEN ✓" : "LOOK AT THE TARGET", run: () => { setup.current.fixation = true; setFixation(true); }, active: fixation },
    kind === "alternate-cover" ? { label: "PRISM SETTINGS", run: () => lesson.setMode("settings") } : { label: "REPEAT SEQUENCE", run: repeat },
    { label: "HELP", run: () => lesson.setMode("help") },
  ];
  const record = () => {
    const spatial = sample(true), state = progress.current, entries = lesson.entriesRef.current;
    const valid = active && spatial.held && spatial.targetReady && setup.current.fixation && state.observed;
    const correct = kind === "cover-uncover" ? entries.pattern === cover.id : entries.movement === alternate.movement && entries.deviation === alternate.deviation && state.neutralized && spatial.prism === state.trialEye;
    const entriesComplete = fields.every(field => Boolean(entries[field.id]));
    lesson.submit(Boolean(valid && entriesComplete && (kind === "cover-uncover" || state.neutralized)), correct,
      correct ? kind === "cover-uncover" ? cover.feedback : `${spatial.mode}: ${setup.current.power}Δ ${setup.current.base.replace("-", " ")} neutralised the ${entries.deviation} deviation.`
        : "Repeat and watch which eye moves, in which direction, and when.");
  };
  const next = () => { if (!lesson.awarded.current) return; reset(); setScenarioIndex(value => value + 1); };
  const prismActions: LessonAction[] = [...bases.map(([value, label]) => ({ label: label.toUpperCase(), run: () => changePrism(value, setup.current.power), active: base === value })),
    { label: "POWER −2Δ", run: () => changePrism(setup.current.base, Math.max(0, setup.current.power - 2)) },
    { label: "POWER +2Δ", run: () => changePrism(setup.current.base, Math.min(30, setup.current.power + 2)) },
    { label: "REPEAT WITH PRISM", run: startTrial, disabled: !readout.observed || !base || !readout.prism },
    { label: "REPEAT SEQUENCE", run: repeat }];
  useEffect(() => { onMirror?.({ title: kind === "cover-uncover" ? "Cover–uncover" : "Alternating cover", findingPosition: { current: scenarioIndex % (kind === "cover-uncover" ? coverScenarios.length : alternateCoverScenarios.length) + 1, total: kind === "cover-uncover" ? coverScenarios.length : alternateCoverScenarios.length },
    status: kind === "alternate-cover" ? `${status} · prism ${power}Δ ${base || "base unselected"}` : status, ready, entryReady, fields,
    actions: kind === "alternate-cover" ? [...actions, ...prismActions] : actions, lesson, reset, record, next }); },
    [onMirror, status, ready, entryReady, lesson.mode, lesson.entries, lesson.feedback, lesson.recorded, fixation, base, power, readout.prism, scenarioIndex]);
  const settings = <XRHeadPanel>
    <Box s={[.76, .90, .018]} c="#102329" radius={.012} />
    <XRSign text={["PRISM · SELECTED WORKING CELL", `${power}Δ · ${base || "choose base"}`, readout.prism ? `Aligned before ${readout.prism}` : "Hold the middle cell before either pupil."]} p={[0, .31, .012]} size={[.70, .20]} bg="#102329" fg="#eefbf7" />
    {prismActions.map((action, index) => <XRPanelButton key={action.label} label={action.label} active={action.active} disabled={lesson.recorded || action.disabled}
      position={[index % 2 ? .18 : -.18, .15 - Math.floor(index / 2) * .085, .025]} width={.34} onClick={action.run} />)}
    <XRPanelButton label="CLOSE SETTINGS" position={[-.18, -.23, .025]} width={.34} onClick={() => lesson.setMode("none")} />
    <XRPanelButton label="EXIT VR" position={[.18, -.23, .025]} width={.34} onClick={onExit} />
  </XRHeadPanel>;
  return <>
    <XRClinicRuntimeView cleanHands runtime={runtime} active={active && !preview} preview={preview} title={`${kind === "cover-uncover" ? "COVER–UNCOVER" : "ALTERNATING COVER"} · PRACTICE`} instrumentSettings={{ prism: { power, base } }} />
    {(active || preview) && <group position={[0, 0, PRACTICE_NEAR_SOCKET.position[2]]} userData={{ xrIgnoreRay: true }}>
      <Cylinder p={[0, .6625, 0]} h={1.325} radius={.009} c="#72908c" />
      <Box p={[0, .02, 0]} s={[.22, .025, .18]} c="#39565b" radius={.008} />
      <Box p={[0, PRACTICE_NEAR_SOCKET.position[1] - .087, 0]} s={[.26, .018, .035]} c="#39565b" radius={.006} />
      <XRSign text={["NEAR CARD · RELEASE HERE", "40 cm · assisted placement"]} p={[.22, 1.29, 0]} size={[.30, .075]} bg="#173a3e" fg="#e8fff9" />
    </group>}
    {active && kind === "alternate-cover" && <XRSign text={[`${power}Δ · ${base || "choose base"}`, "Middle cell · aim before one eye"]} p={[-.35, 1.82, -.1]} size={[.34, .09]} bg="#173a3e" fg="#e8fff9" />}
    <PracticeLessonUI runtime={runtime} active={active} title={kind === "cover-uncover" ? "COVER–UNCOVER" : "ALTERNATING COVER"} status={status}
      tools={kind === "cover-uncover" ? ["cover"] : ["cover", "prism"]} actions={actions} fields={fields} lesson={lesson} entryReady={entryReady} ready={ready}
      onRecord={record} onReset={reset} onNext={next} onExit={onExit} settings={settings}
      help={["Pick the cover occluder; establish target fixation.", "Distance target is illustrative in this clinic.", "Move the near card to 40 cm; mount it on the stand.", "Cover one pupil, keeping the other eye visible.", kind === "cover-uncover" ? "Watch the visible eye, then uncover immediately." : "Shift directly between eyes; keep fusion broken.",
        kind === "cover-uncover" ? "Repeat with the fellow eye and classify timing." : "Add prism before either eye; repeat until no movement."]} />
  </>;
}
