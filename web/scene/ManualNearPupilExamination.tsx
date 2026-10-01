import { Component, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  advanceNearPupilStep,
  nearPupilFixation,
  nearPupilProcedure,
  nearResponseStimulus,
  type NearPupilTarget,
} from "../interaction/pupils";
import type { FixationTarget } from "../interaction/motility";
import { EyeSurface } from "./EyeSurface";

class NearPupilBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() {
    return this.state.failed
      ? <p className="notice">The near-response view is unavailable. Cancel and try again with 3D rendering enabled.</p>
      : this.props.children;
  }
}

function NearPupilScene({
  fixation,
  stimulus,
  ambient,
  movement,
  onReady,
}: {
  fixation: MutableRefObject<FixationTarget>;
  stimulus: MutableRefObject<number>;
  ambient: MutableRefObject<number>;
  movement: MutableRefObject<{ x: number; y: number; used: boolean }>;
  onReady: () => void;
}) {
  const sent = useRef(false);
  useFrame(() => {
    if (!sent.current) {
      sent.current = true;
      onReady();
    }
  });
  return (
    <>
      <color attach="background" args={["#15262b"]} />
      <ambientLight intensity={1.25} />
      <directionalLight position={[-1, 2, 3]} intensity={1.65} />
      {[-0.2, 0.2].map((x) => (
        <EyeSurface
          key={x}
          x={x}
          pupils
          motility={false}
          progress={0}
          movement={movement}
          fixation={fixation}
          tracking
          pupilStimulus={stimulus}
          ambientLevel={ambient}
        />
      ))}
    </>
  );
}

export function ManualNearPupilExamination({
  onComplete,
  onCancel,
}: {
  onComplete: (observation?: string) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const movement = useRef({ x: 0, y: 0, used: true });
  const targetRef = useRef<NearPupilTarget>({ x: 0, y: 0, distanceCm: 70 });
  const fixation = useRef(nearPupilFixation(targetRef.current));
  const stimulus = useRef(0);
  const ambient = useRef(0.58);
  const instructedRef = useRef(false);
  const stepRef = useRef(0);
  const dwellRef = useRef(0);
  const done = useRef(false);
  const [target, setTarget] = useState(targetRef.current);
  const [grabbed, setGrabbed] = useState(false);
  const [instructed, setInstructed] = useState(false);
  const [step, setStep] = useState(0);
  const [dwell, setDwell] = useState(0);
  const [viewReady, setViewReady] = useState(false);
  const [viewFailed, setViewFailed] = useState(false);
  const [convergence, setConvergence] = useState("");
  const [constriction, setConstriction] = useState("");
  const [fixationMaintained, setFixationMaintained] = useState("");
  const [interpretation, setInterpretation] = useState("");
  targetRef.current = target;
  instructedRef.current = instructed;
  stepRef.current = step;
  dwellRef.current = dwell;
  fixation.current = nearPupilFixation(target);
  stimulus.current = nearResponseStimulus(target.distanceCm);

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);

  useEffect(() => {
    let previous = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const dt = (now - previous) / 1000;
      previous = now;
      if (!instructedRef.current || !viewReady || viewFailed) {
        if (dwellRef.current) {
          dwellRef.current = 0;
          setDwell(0);
        }
        return;
      }
      const next = advanceNearPupilStep(stepRef.current, dwellRef.current, targetRef.current, dt);
      if (next.index !== stepRef.current) {
        stepRef.current = next.index;
        setStep(next.index);
      }
      dwellRef.current = next.dwell;
      setDwell(next.dwell);
    }, 50);
    return () => clearInterval(timer);
  }, [viewReady, viewFailed]);

  const applyTarget = (next: NearPupilTarget) => {
    targetRef.current = next;
    fixation.current = nearPupilFixation(next);
    stimulus.current = nearResponseStimulus(next.distanceCm);
    dwellRef.current = 0;
    setDwell(0);
    setTarget(next);
  };
  const updatePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    applyTarget({
      ...targetRef.current,
      x: Math.max(-1, Math.min(1, (((event.clientX - bounds.left) / bounds.width) - 0.5) / 0.4)),
      y: Math.max(-1, Math.min(1, (0.5 - (event.clientY - bounds.top) / bounds.height) / 0.4)),
    });
  };
  const procedureComplete = step === nearPupilProcedure.length;
  const completeObservation = convergence && constriction && fixationMaintained && interpretation;
  const normal = convergence === "present" && constriction === "equal" && fixationMaintained === "maintained" && interpretation === "normal";
  const observation = !completeObservation
    ? ""
    : normal
      ? "Convergence and equal pupillary constriction observed to a near target; fixation maintained."
      : `Near response: convergence ${convergence}; pupillary constriction ${constriction}; fixation ${fixationMaintained}; interpretation ${interpretation}.`;
  const ready = procedureComplete && !!observation && viewReady && !viewFailed;
  const current = nearPupilProcedure[step];
  const centred = Math.hypot(target.x, target.y) <= 0.18;

  return (
    <dialog
      ref={dialog}
      className="examination-stage near-pupil-stage"
      aria-labelledby="near-pupil-title"
      onCancel={(event) => { event.preventDefault(); onCancel(); }}
    >
      <header>
        <div>
          <p className="eyebrow">MANUAL PUPIL EXAMINATION · NEAR RESPONSE</p>
          <h1 id="near-pupil-title">Convergence and pupillary constriction</h1>
        </div>
        <button className="secondary" onClick={onCancel}>Cancel</button>
      </header>
      <div className="near-pupil-instructions">
        <p>Begin with distance fixation. Keep the target centred, bring it smoothly toward Arun, and watch both eyes and pupils before returning it to distance.</p>
        <button className="primary" disabled={instructed} onClick={() => setInstructed(true)}>
          {instructed ? "Arun is following the target" : "Ask Arun to follow the target and report double vision"}
        </button>
        {instructed && <p className="small">Arun: “Okay. I’ll keep looking at it and tell you if it becomes double.”</p>}
      </div>
      <div className="near-pupil-workspace">
        <div
          className={`eye-viewport near-pupil-viewport ${grabbed ? "is-grabbed" : ""}`}
          tabIndex={0}
          role="application"
          aria-label="Near-response fixation target. Drag to centre it, use arrow keys to adjust, and change its distance with the slider."
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            event.currentTarget.focus();
            event.currentTarget.setPointerCapture(event.pointerId);
            setGrabbed(true);
            updatePointer(event);
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) updatePointer(event);
          }}
          onPointerUp={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
            setGrabbed(false);
          }}
          onPointerCancel={() => setGrabbed(false)}
          onLostPointerCapture={() => setGrabbed(false)}
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
            event.preventDefault();
            const value = targetRef.current;
            applyTarget({
              ...value,
              x: Math.max(-1, Math.min(1, value.x + (event.key === 'ArrowLeft' ? -0.05 : event.key === 'ArrowRight' ? 0.05 : 0))),
              y: Math.max(-1, Math.min(1, value.y + (event.key === 'ArrowUp' ? 0.05 : event.key === 'ArrowDown' ? -0.05 : 0))),
            });
          }}
        >
          <NearPupilBoundary onFailure={() => setViewFailed(true)}>
            <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.04, 1.24], fov: 43 }}>
              <NearPupilScene fixation={fixation} stimulus={stimulus} ambient={ambient} movement={movement} onReady={() => setViewReady(true)} />
            </Canvas>
          </NearPupilBoundary>
          <div className="near-pupil-overlay" aria-hidden="true">
            <span className={`near-centre-guide ${centred ? "aligned" : ""}`} />
            <span
              className="near-response-target"
              style={{
                left: `${50 + target.x * 40}%`,
                top: `${50 - target.y * 40}%`,
                transform: `translate(-50%, -12%) scale(${1.15 - target.distanceCm / 140})`,
              }}
            ><i>✦</i></span>
          </div>
          <span className="visual-label">Keep centred · move distance slider slowly · observe both eyes</span>
        </div>
        <aside className="near-response-meter" aria-label="Near-target distance guide">
          <strong>TARGET DISTANCE</strong>
          <output>{target.distanceCm} cm</output>
          <div className="distance-zones">
            <span className={target.distanceCm >= 60 ? "active" : ""}>DISTANCE<br /><b>60–70 cm</b></span>
            <span className={Math.abs(target.distanceCm - 40) <= 3 ? "active" : ""}>NEAR<br /><b>40 cm</b></span>
            <span className={target.distanceCm >= 16 && target.distanceCm <= 23 ? "active" : ""}>CLOSE<br /><b>20 cm</b></span>
          </div>
          <p>Watch the pupils constrict and the eyes turn inward as the target approaches.</p>
        </aside>
      </div>
      <footer>
        <label className="near-distance-control">Target distance: {target.distanceCm} cm
          <input aria-label="Near-response target distance" type="range" min="15" max="70" value={target.distanceCm} onChange={(event) => applyTarget({ ...targetRef.current, distanceCm: Number(event.target.value) })} />
        </label>
        <ol className="near-pupil-sequence" aria-label="Near-response procedure sequence">
          {nearPupilProcedure.map((item, index) => (
            <li key={item.id} className={index < step ? "seen" : index === step ? "current" : ""}>{index < step ? "✓" : index + 1}<span>{item.label}</span></li>
          ))}
        </ol>
        <p role="status">
          {viewFailed
            ? "The patient view is unavailable; this finding cannot be recorded."
            : !instructed
              ? "Give Arun the fixation instruction before beginning."
              : procedureComplete
                ? "Near-response sequence complete. Record only what you observed."
                : !centred
                  ? "Centre the target between Arun’s eyes before changing its distance."
                  : current?.label + " · hold steady and observe…"}
        </p>
        <progress value={dwell} max={current?.dwell ?? 1} aria-label="Near-response step progress" />
        {procedureComplete && (
          <section className="near-pupil-observation-form" aria-label="Record near pupil observations">
            <label>Convergence<select aria-label="Observed convergence" value={convergence} onChange={(event) => setConvergence(event.target.value)}><option value="">Select</option><option value="present">Present and symmetrical</option><option value="reduced-OD">Reduced OD</option><option value="reduced-OS">Reduced OS</option><option value="absent">Absent</option><option value="uncertain">Uncertain—repeat</option></select></label>
            <label>Pupillary constriction<select aria-label="Observed pupillary constriction" value={constriction} onChange={(event) => setConstriction(event.target.value)}><option value="">Select</option><option value="equal">Present and equal</option><option value="sluggish">Sluggish</option><option value="unequal">Unequal</option><option value="absent">Absent</option><option value="uncertain">Uncertain—repeat</option></select></label>
            <label>Fixation<select aria-label="Fixation maintenance" value={fixationMaintained} onChange={(event) => setFixationMaintained(event.target.value)}><option value="">Select</option><option value="maintained">Maintained; no diplopia reported</option><option value="lost">Lost or diplopia reported</option><option value="uncertain">Uncertain—repeat</option></select></label>
            <label>Overall interpretation<select aria-label="Near-response interpretation" value={interpretation} onChange={(event) => setInterpretation(event.target.value)}><option value="">Select</option><option value="normal">Near response observed</option><option value="abnormal">Abnormal response suspected</option><option value="repeat">Insufficient—repeat required</option></select></label>
          </section>
        )}
        {procedureComplete && <p className="patient-near-response">Arun: “It stayed single while it came closer.”</p>}
        <button className="primary full" disabled={!ready} onClick={() => { if (done.current || !ready) return; done.current = true; onComplete(observation); }}>
          Record your near-response findings →
        </button>
        <p className="small muted">This fictional response is qualitative. Your selected interpretation is preserved for debrief comparison.</p>
      </footer>
    </dialog>
  );
}
