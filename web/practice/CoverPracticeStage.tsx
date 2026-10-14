import { Component, useEffect, useMemo, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Check, Hand, MoveHorizontal, RotateCcw, Ruler, Target, X } from "lucide-react";
import { EYE_SURFACE_IRIS_RADIUS, EyeSurface } from "../scene/EyeSurface";
import { PracticeVoiceControl } from "../voice/PracticeVoiceControl";
import { coverPositionAt, coverTargets, type CoverEye, type CoverPosition, type CoverToolPose } from "../interaction/cover";
import { coverEyeTargets, coverIrisOffset, settleCoverEyes, type CoverDeviationModel, type CoverEyePoses, type PrismPlacement } from "../interaction/coverDeviation";
import { advanceXRPracticeCover } from "../interaction/xrPracticeBatch";
import {
  coverScenarios,
  alternateCoverModel,
  alternateCoverScenarios,
  alternateDeviationChoices,
  practiceCoverProcedures,
  prismTrialNeutralizes,
  type PracticeCoverKind,
} from "../interaction/practiceCover";
import { Canvas, PracticeWebGLFallback } from "./PracticeWebGLFallback";

type CoverEyeInputs = {
  model: MutableRefObject<CoverDeviationModel>;
  pose: MutableRefObject<CoverToolPose>;
  prism: MutableRefObject<{ inPlace: boolean; eye: CoverEye | ""; base: string; power: number }>;
};

class CoverPracticeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <PracticeWebGLFallback /> : this.props.children; }
}

/** Sustained eye positions shared with the XR lesson (interaction/coverDeviation.ts). */
function EyeMotion({ inputs }: { inputs: CoverEyeInputs }) {
  const movement = useRef({ x: 0, y: 0, used: true });
  const od = useRef({ x: 0, y: 0 });
  const os = useRef({ x: 0, y: 0 });
  const poses = useRef<CoverEyePoses>(coverEyeTargets(inputs.model.current, "away"));
  const lastCover = useRef<CoverPosition>("away");
  const lastModel = useRef(inputs.model.current);
  useFrame((_, delta) => {
    const base = inputs.model.current;
    // A new patient finding starts from its own resting position rather than animating from the last one.
    if (base !== lastModel.current) { lastModel.current = base; lastCover.current = "away"; poses.current = coverEyeTargets(base, "away"); }
    // Mid-transit (neither over an eye nor clear of the face) keeps the last state, so fusion is not regained.
    const position = coverPositionAt(inputs.pose.current);
    if (position) lastCover.current = position;
    const held = inputs.prism.current;
    // The eye looking through the prism turns toward its apex; the fellow keeps the phoria relation.
    const prism: PrismPlacement = held.inPlace && held.eye && held.base ? { eye: held.eye, base: held.base, power: held.power } : null;
    poses.current = settleCoverEyes(base, lastCover.current, poses.current, delta, prism);
    for (const [eye, offset] of [["OD", od], ["OS", os]] as const) {
      const [x, y] = coverIrisOffset(eye, poses.current[eye], EYE_SURFACE_IRIS_RADIUS);
      offset.current.x = x; offset.current.y = y;
    }
  });
  return <group position={[0, .12, .505]} scale={1.3}>
    <EyeSurface x={-.17} pupils={false} motility={false} progress={0} movement={movement} gazeOffset={od} />
    <EyeSurface x={.17} pupils={false} motility={false} progress={0} movement={movement} gazeOffset={os} />
  </group>;
}

function OccluderAndHands({ pose, kind, site, prismAmount, targetDistance, prismBefore }: { pose: CoverToolPose; kind: PracticeCoverKind; site: "distance" | "near"; prismAmount: number; targetDistance: number; prismBefore: CoverEye | null }) {
  const x = pose.x * .5;
  const y = pose.y * .34 - .02;
  const skin = "#a97453";
  const nearTargetScale = Math.max(.72, Math.min(1.35, 40 / targetDistance));
  const nearTargetZ = (40 - targetDistance) * .012;
  return <>
    <group position={[x, y, 1]} rotation={[0, 0, -.1]}>
      <mesh position={[0, -.18, 0]}><boxGeometry args={[.035, .36, .025]} /><meshStandardMaterial color="#27363b" roughness={.45} /></mesh>
      <mesh position={[0, .06, 0]} scale={[.15, .19, .035]}><sphereGeometry args={[1, 30, 20]} /><meshStandardMaterial color="#1c2b30" roughness={.38} /></mesh>
      <mesh position={[.025, -.35, .025]} scale={[.1, .16, .065]}><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color={skin} roughness={.9} /></mesh>
    </group>
    {/* Once a prism repeat starts, the prism bar is held before the chosen eye (eyes sit at ±0.221, 0.17). */}
    <group position={prismBefore ? [prismBefore === "OD" ? -.221 : .221, -.06, .95] : [-.48, -.34, .94]} rotation={[0, 0, prismBefore ? 0 : -.38]}>
      <mesh scale={[.09, .14, .06]}><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color={skin} roughness={.9} /></mesh>
      {kind === "alternate-cover" ? <group position={[.03, .18, 0]}>
        <mesh><boxGeometry args={[.14, .42, .035]} /><meshPhysicalMaterial color="#b6d7d0" transparent opacity={.5} roughness={.18} /></mesh>
        {Array.from({ length: 6 }, (_, index) => <mesh key={index} position={[0, -.15 + index * .06, .022]}><boxGeometry args={[.12, .006, .006]} /><meshBasicMaterial color="#466e68" /></mesh>)}
        <mesh position={[0, .25, 0]}><boxGeometry args={[.16, .055, .04]} /><meshStandardMaterial color="#426a65" /></mesh>
      </group> : site === "near" ? <group position={[.03, .19, nearTargetZ]} scale={nearTargetScale}>
        <mesh><boxGeometry args={[.24, .17, .025]} /><meshStandardMaterial color="#f4f1df" roughness={.7} /></mesh>
        <mesh position={[0, 0, .016]}><circleGeometry args={[.035, 24]} /><meshBasicMaterial color="#28695f" /></mesh>
      </group> : null}
      {kind === "alternate-cover" && <mesh position={[.14, .34, .03]}><sphereGeometry args={[.035, 16, 10]} /><meshBasicMaterial color={prismAmount ? "#9fe0d2" : "#6f8581"} /></mesh>}
    </group>
  </>;
}

function CoverPracticeScene({ pose, eyeInputs, kind, site, prismAmount, targetDistance, prismBefore }: { pose: CoverToolPose; eyeInputs: CoverEyeInputs; kind: PracticeCoverKind; site: "distance" | "near"; prismAmount: number; targetDistance: number; prismBefore: CoverEye | null }) {
  return <>
    <color attach="background" args={["#0b171c"]} />
    <ambientLight intensity={1.35} />
    <directionalLight position={[-2, 3, 4]} intensity={2.1} />
    <group position={[0, .05, 0]}>
      <mesh scale={[.65, .86, .48]}><sphereGeometry args={[1, 48, 32]} /><meshStandardMaterial color="#a97453" roughness={.88} /></mesh>
      <mesh position={[0, .17, .44]} scale={[.13, .25, .12]}><sphereGeometry args={[1, 24, 16]} /><meshStandardMaterial color="#9b684a" roughness={.9} /></mesh>
      <mesh position={[0, -.42, .39]} scale={[.34, .12, .12]}><sphereGeometry args={[1, 24, 14]} /><meshStandardMaterial color="#734936" roughness={.82} /></mesh>
      <EyeMotion inputs={eyeInputs} />
      <mesh position={[0, -1.02, -.05]} scale={[.82, .42, .44]}><sphereGeometry args={[1, 32, 20]} /><meshStandardMaterial color="#567685" roughness={.86} /></mesh>
    </group>
    <OccluderAndHands pose={pose} kind={kind} site={site} prismAmount={prismAmount} targetDistance={targetDistance} prismBefore={prismBefore} />
  </>;
}

export function CoverPracticeStage({ kind, onClose, onComplete }: { kind: PracticeCoverKind; onClose: () => void; onComplete: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const poseRef = useRef<CoverToolPose>({ x: 0, y: -.75 });
  const fixationRef = useRef(false);
  const stepRef = useRef(0);
  const dwellRef = useRef(0);
  const siteRef = useRef<"distance" | "near">("distance");
  const targetDistanceRef = useRef(40);
  const trialActiveRef = useRef(false);
  const transitRef = useRef(0);
  const lastPositionRef = useRef<CoverPosition>("away");
  const [pose, setPose] = useState(poseRef.current);
  const [grabbed, setGrabbed] = useState(false);
  const [fixation, setFixation] = useState(false);
  const [site, setSite] = useState<"distance" | "near">("distance");
  const [targetDistance, setTargetDistance] = useState(40);
  const [step, setStep] = useState(0);
  const [dwell, setDwell] = useState(0);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const [observed, setObserved] = useState(false);
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const [movement, setMovement] = useState("");
  const [deviation, setDeviation] = useState("");
  const [prismBase, setPrismBase] = useState("");
  const [prismAmount, setPrismAmount] = useState(0);
  const [prismEye, setPrismEye] = useState<CoverEye | "">("");
  const [prismInPlace, setPrismInPlace] = useState(false);
  const [sequenceMessage, setSequenceMessage] = useState("");
  const [trialMessage, setTrialMessage] = useState("");
  const [neutralized, setNeutralized] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const procedure = practiceCoverProcedures[kind];
  const coverScenario = coverScenarios[scenarioIndex % coverScenarios.length];
  const alternateScenario = alternateCoverScenarios[scenarioIndex % alternateCoverScenarios.length];
  const alternateScenarioRef = useRef(alternateScenario);
  alternateScenarioRef.current = alternateScenario;
  const eyeModel = useMemo((): CoverDeviationModel => kind === "cover-uncover" ? coverScenario.model
    : alternateCoverModel(alternateScenario), [kind, coverScenario, alternateScenario]);
  const eyeModelRef = useRef(eyeModel);
  eyeModelRef.current = eyeModel;
  // The prism stays before the eye from the first prism repeat until the sequence is reset.
  const prismRef = useRef<{ inPlace: boolean; eye: CoverEye | ""; base: string; power: number }>({ inPlace: false, eye: "", base: "", power: 0 });
  prismRef.current.base = prismBase; prismRef.current.power = prismAmount; prismRef.current.eye = prismEye; prismRef.current.inPlace = prismInPlace;
  const eyeInputs = useMemo<CoverEyeInputs>(() => ({ model: eyeModelRef, pose: poseRef, prism: prismRef }), []);
  poseRef.current = pose;
  fixationRef.current = fixation;
  // stepRef/dwellRef are owned by the sequence timer and explicit resets. Copying state back on render
  // let a keypress render with a not-yet-applied step overwrite newer progress and move the sequence backwards.
  siteRef.current = site;
  targetDistanceRef.current = targetDistance;

  useEffect(() => { dialog.current?.showModal(); return () => dialog.current?.close(); }, []);
  useEffect(() => {
    let previous = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const dt = (now - previous) / 1000;
      previous = now;
      const nearReady = siteRef.current === "distance" || Math.abs(targetDistanceRef.current - 40) <= 2;
      if (!fixationRef.current || !nearReady) return;
      const previousIndex = stepRef.current;
      // Shared with XR: alternating cover restarts if both eyes are left uncovered for more than 0.35 s.
      // On desktop only lowering the occluder clear of the face counts: crossing the nose takes several
      // key presses, so mid-face passage after covering an eye earns no hold time but is not timed as exposure.
      const measured = coverPositionAt(poseRef.current);
      const crossingNose = measured === null && lastPositionRef.current !== "away";
      if (measured) lastPositionRef.current = measured;
      const next = advanceXRPracticeCover(kind, { index: previousIndex, dwell: dwellRef.current, transit: crossingNose ? 0 : transitRef.current }, measured, dt, true);
      if (crossingNose) next.transit = 0;
      transitRef.current = next.transit;
      if (next.index < previousIndex) setSequenceMessage("Both eyes were uncovered too long, so fusion recovered. Start the alternating sequence again and shift directly between eyes.");
      else if (next.index > previousIndex) setSequenceMessage("");
      if (next.index !== previousIndex) {
        stepRef.current = next.index;
        setStep(next.index);
        if (next.index === procedure.length) {
          if (kind === "alternate-cover" && trialActiveRef.current) {
            const prism = prismRef.current;
            const success = Boolean(prism.eye) && prismTrialNeutralizes(alternateScenarioRef.current, prism.base, prism.power, prism.eye as CoverEye);
            setNeutralized(success);
            setTrialMessage(success ? "No refixation movement remains: prism neutralisation reached." : "Refixation movement remains. Adjust the prism base or power and repeat.");
            trialActiveRef.current = false;
          } else setObserved(true);
        }
      }
      dwellRef.current = next.dwell;
      setDwell(next.dwell);
    }, 50);
    return () => clearInterval(timer);
  }, [kind, procedure]);

  const setToolPose = (next: CoverToolPose) => setPose({ x: Math.max(-1, Math.min(1, next.x)), y: Math.max(-1, Math.min(1, next.y)) });
  // Functional update: repeated key presses before the canvas re-renders must each move the occluder.
  const nudgeToolPose = (dx: number, dy: number) => setPose(previous => ({ x: Math.max(-1, Math.min(1, previous.x + dx)), y: Math.max(-1, Math.min(1, previous.y + dy)) }));
  const updatePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setToolPose({ x: (((event.clientX - bounds.left) / bounds.width) - .5) / .4, y: (.5 - (event.clientY - bounds.top) / bounds.height) / .4 });
  };
  const resetSequence = () => {
    stepRef.current = 0;
    dwellRef.current = 0;
    trialActiveRef.current = false;
    transitRef.current = 0;
    prismRef.current.inPlace = false;
    setPrismInPlace(false);
    setSequenceMessage("");
    setStep(0);
    setDwell(0);
    setPose({ x: 0, y: -.75 });
    setObserved(false);
    setAnswer("");
    setMovement("");
    setDeviation("");
    setNeutralized(false);
    setChecked(false);
    setTrialMessage("");
    setRecorded(false);
  };
  const newScenario = () => {
    if (!recorded) return;
    setScenarioIndex(value => value + 1);
    setAnswer("");
    setMovement("");
    setDeviation("");
    setPrismBase("");
    setPrismAmount(0);
    setPrismEye("");
    setNeutralized(false);
    resetSequence();
  };
  const testPrism = () => {
    if (!prismBase || !prismEye) return;
    trialActiveRef.current = true;
    prismRef.current.inPlace = true;
    setPrismInPlace(true);
    setNeutralized(false);
    setTrialMessage("");
    setSequenceMessage("");
    stepRef.current = 0; dwellRef.current = 0; transitRef.current = 0; setStep(0); setDwell(0); setPose({ x: 0, y: -.75 });
  };
  /** Changing the prism invalidates an unfinished repeat, as in XR. */
  const prismChanged = () => {
    setNeutralized(false);
    if (!trialActiveRef.current) return;
    stepRef.current = 0; dwellRef.current = 0; transitRef.current = 0; setStep(0); setDwell(0);
    setSequenceMessage("Prism changed · repeat the alternating sequence from the start.");
  };
  const coverCorrect = answer === coverScenario.id;
  const alternateCorrect = movement === alternateScenario.movement && deviation === alternateScenario.deviation && neutralized;
  const recordFinding = () => {
    if (recorded || (kind === "cover-uncover" ? !coverCorrect : !alternateCorrect)) return;
    setRecorded(true); setChecked(true); onComplete();
  };
  const current = procedure[step];
  const activePosition = coverPositionAt(pose);
  return <dialog ref={dialog} className="clinical-practice-dialog cover-practice-dialog" aria-labelledby="cover-practice-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="clinical-stage-header"><div><p className="eyebrow">LIVE PRACTICE · BINOCULAR VISION</p><h1 id="cover-practice-title">{kind === "cover-uncover" ? "Cover–uncover test" : "Alternating cover + prism neutralisation"}</h1></div><div className="clinical-stage-distance"><span>Fixation</span><strong className={fixation ? "ready" : ""}>{site === "near" ? `${targetDistance} cm` : "Distance"}</strong></div><PracticeVoiceControl /><button className="secondary" onClick={onClose}><X size={16} /> Close</button></header>
    <div className="clinical-stage-body">
      <div className="clinical-viewport-wrap">
        <div className={`clinical-viewport cover-practice-viewport ${grabbed ? "is-grabbed" : ""}`} tabIndex={0} role="application" aria-label="Cover test. Drag the occluder over either eye or below the face. Arrow keys provide fine movement."
          onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); setGrabbed(true); updatePointer(event); }}
          onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) updatePointer(event); }}
          onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); setGrabbed(false); }}
          onPointerCancel={() => setGrabbed(false)} onLostPointerCapture={() => setGrabbed(false)}
          onKeyDown={event => { if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return; event.preventDefault(); const dx = event.key === "ArrowLeft" ? -.06 : event.key === "ArrowRight" ? .06 : 0, dy = event.key === "ArrowUp" ? .06 : event.key === "ArrowDown" ? -.06 : 0; nudgeToolPose(dx, dy); }}>
          <CoverPracticeBoundary><Canvas dpr={[1, 1.5]} camera={{ position: [0, .04, 2.55], fov: 39 }}><CoverPracticeScene pose={pose} eyeInputs={eyeInputs} kind={kind} site={site} prismAmount={prismAmount} targetDistance={targetDistance} prismBefore={prismInPlace && prismEye ? prismEye : null} /></Canvas></CoverPracticeBoundary>
          <div className="cover-practice-guides" aria-hidden="true">{(["OD", "OS"] as CoverEye[]).map(eye => <span key={eye} className={activePosition === eye ? "covered" : ""} style={{ left: `${50 + coverTargets[eye].x * 40}%` }}>{eye}</span>)}</div>
          <div className="hand-readout" aria-hidden="true"><span><b>R</b>Hold + move occluder</span><span><b>L</b>{kind === "alternate-cover" ? "Hold prism bar" : site === "near" ? "Hold near fixation target" : "Resting clear of patient"}</span></div>
        </div>
        <div className={`clinical-coach ${observed ? "ready" : ""}`} role="status"><span>{observed ? <Check size={18} /> : <MoveHorizontal size={18} />}</span><p><b>{observed ? "Sequence observed" : "Next action"}</b>{sequenceMessage ? `${sequenceMessage} ` : ""}{!fixation ? "Give the fixation instruction before using the occluder." : site === "near" && Math.abs(targetDistance - 40) > 2 ? "Set the near target to 40 cm." : current ? activePosition === current.position ? `${current.label} · hold steady and watch the visible eye.` : current.position === "away" ? "Lower the occluder fully and watch immediately on uncovering." : `Move directly over ${current.position}.` : trialMessage || "Record what moved and when."}</p></div>
      </div>
      <aside className="clinical-control-rail cover-practice-rail">
        <section><p className="eyebrow">PATIENT + TARGET</p><button className={fixation ? "task-button done" : "task-button"} onClick={() => setFixation(true)}><Target size={18} /><span><b>{fixation ? "Fixation established" : "Give fixation instruction"}</b><small>{site === "distance" ? "Patient fixates an isolated distance line" : "Patient fixates the accommodative near target"}</small></span>{fixation && <Check size={16} />}</button><div className="site-switch"><button className={site === "distance" ? "selected" : ""} onClick={() => { setSite("distance"); resetSequence(); }}>Distance</button><button className={site === "near" ? "selected" : ""} onClick={() => { setSite("near"); resetSequence(); }}>Near</button></div>{site === "near" && <label className="distance-control">Near target · {targetDistance} cm<input type="range" min="25" max="60" value={targetDistance} onChange={event => { setTargetDistance(Number(event.target.value)); resetSequence(); }} /></label>}</section>
        <section><p className="eyebrow">RIGHT HAND · OCCLUDER</p><div className="sequence-compact">{procedure.map((item, index) => <span key={index} className={index < step ? "done" : index === step ? "current" : ""}><b>{index < step ? "✓" : index + 1}</b>{item.label}</span>)}</div><progress value={dwell} max={current?.dwell ?? 1} /></section>
        {kind === "cover-uncover" ? <section className="clinical-observation"><p className="eyebrow">INTERPRET THE TIMING</p><label>What pattern did you observe?<select disabled={!observed || recorded} value={answer} onChange={event => { setAnswer(event.target.value); setChecked(false); }}><option value="">Choose after completing the sequence</option>{coverScenarios.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><button className="primary full" disabled={!answer || recorded} onClick={() => { setChecked(true); if (coverCorrect) recordFinding(); }}>Check interpretation</button>{checked && <div className={coverCorrect ? "trainer-feedback correct" : "trainer-feedback incorrect"}><b>{coverCorrect ? "Correct" : "Repeat and watch the timing"}</b><p>{coverCorrect ? coverScenario.feedback : "Movement of the uncovered eye while its fellow is covered indicates tropia; movement immediately after uncovering reveals phoria."}</p>{coverCorrect && recorded && <button className="secondary" onClick={newScenario}>New patient pattern <RotateCcw size={15} /></button>}</div>}</section> : <section className="clinical-observation"><p className="eyebrow">OBSERVE + NEUTRALISE</p><label>OD movement on uncovering<select disabled={!observed || recorded} value={movement} onChange={event => setMovement(event.target.value)}><option value="">Choose movement</option><option value="in">In</option><option value="out">Out</option><option value="up">Up</option><option value="down">Down</option></select></label><label>Deviation<select disabled={!observed || recorded} value={deviation} onChange={event => setDeviation(event.target.value)}><option value="">Choose deviation</option>{alternateDeviationChoices.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label><label>Prism before<select disabled={!observed || recorded} value={prismEye} onChange={event => { setPrismEye(event.target.value as CoverEye | ""); prismChanged(); }}><option value="">Choose eye</option><option value="OD">OD</option><option value="OS">OS</option></select></label><label>Prism base<select disabled={!observed || recorded} value={prismBase} onChange={event => { setPrismBase(event.target.value); prismChanged(); }}><option value="">Choose base</option><option value="base-in">Base in</option><option value="base-out">Base out</option><option value="base-up">Base up</option><option value="base-down">Base down</option></select></label><label className="distance-control"><Ruler size={14} /> Prism power · {prismAmount}Δ<input disabled={!observed || recorded} type="range" min="0" max="30" step="2" value={prismAmount} onChange={event => { setPrismAmount(Number(event.target.value)); prismChanged(); }} /></label><button className="secondary full" disabled={!observed || !prismBase || !prismEye || recorded} onClick={testPrism}><Hand size={16} /> Repeat alternate cover with prism</button>{trialMessage && <p className={neutralized ? "neutral-message success" : "neutral-message"}>{trialMessage}</p>}<button className="primary full" disabled={!alternateCorrect || recorded} onClick={recordFinding}>Record neutralised deviation</button>{recorded && <p className="neutral-message success">Neutralised deviation recorded.</p>}{alternateCorrect && recorded && <button className="secondary full" onClick={newScenario}>New deviation <RotateCcw size={15} /></button>}</section>}
        <button className="reset-technique" onClick={resetSequence}><RotateCcw size={15} /> Reset sequence</button>
      </aside>
    </div>
  </dialog>;
}
