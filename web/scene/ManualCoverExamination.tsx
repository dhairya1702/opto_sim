import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { ExamConfig } from "../domain/types";
import {
  advanceCoverStep,
  coverFixationTarget,
  coverPositionAt,
  coverProcedure,
  coverTargets,
  type CoverEye,
  type CoverToolPose,
} from "../interaction/cover";
import type { FixationTarget } from "../interaction/motility";
import { EyeSurface } from "./EyeSurface";

class CoverViewBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() {
    return this.state.failed
      ? <p className="notice">The cover-test view is unavailable. Cancel and try again with 3D rendering enabled.</p>
      : this.props.children;
  }
}

function CoverPatientView({
  fixation,
  movement,
  onReady,
}: {
  fixation: React.MutableRefObject<FixationTarget>;
  movement: React.MutableRefObject<{ x: number; y: number; used: boolean }>;
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
      <color attach="background" args={["#16262b"]} />
      <ambientLight intensity={1.45} />
      <directionalLight position={[-1, 2, 3]} intensity={1.8} />
      {[-0.2, 0.2].map((x) => (
        <EyeSurface
          key={x}
          x={x}
          pupils={false}
          motility={false}
          progress={0}
          movement={movement}
          fixation={fixation}
          tracking
        />
      ))}
    </>
  );
}

const movementOptions = [
  ["none", "No refixation movement"],
  ["inward", "Inward refixation"],
  ["outward", "Outward refixation"],
  ["vertical", "Vertical refixation"],
  ["uncertain", "Uncertain—repeat"],
];

export function ManualCoverExamination({
  config,
  onComplete,
  onCancel,
}: {
  config: ExamConfig;
  onComplete: (observation?: string) => void;
  onCancel: () => void;
}) {
  const mode = config.mode === "near" ? "near" : "distance";
  const dialog = useRef<HTMLDialogElement>(null);
  const movement = useRef({ x: 0, y: 0, used: true });
  const fixation = useRef(coverFixationTarget(mode === "near" ? 40 : 600));
  const poseRef = useRef<CoverToolPose>({ x: 0, y: -0.72 });
  const askedRef = useRef(false);
  const distanceRef = useRef(mode === "near" ? 40 : 600);
  const stepRef = useRef(0);
  const dwellRef = useRef(0);
  const done = useRef(false);
  const [pose, setPose] = useState(poseRef.current);
  const [grabbed, setGrabbed] = useState(false);
  const [asked, setAsked] = useState(false);
  const [targetDistance, setTargetDistance] = useState(mode === "near" ? 40 : 600);
  const [step, setStep] = useState(0);
  const [dwell, setDwell] = useState(0);
  const [viewReady, setViewReady] = useState(false);
  const [viewFailed, setViewFailed] = useState(false);
  const [odMovement, setOdMovement] = useState("");
  const [osMovement, setOsMovement] = useState("");
  const [alternateMovement, setAlternateMovement] = useState("");
  const [interpretation, setInterpretation] = useState("");
  poseRef.current = pose;
  askedRef.current = asked;
  distanceRef.current = targetDistance;
  stepRef.current = step;
  dwellRef.current = dwell;
  fixation.current = coverFixationTarget(targetDistance);

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
      const correctDistance = mode === "distance" || Math.abs(distanceRef.current - 40) <= 2;
      if (!askedRef.current || !correctDistance || !viewReady || viewFailed) {
        if (dwellRef.current) {
          dwellRef.current = 0;
          setDwell(0);
        }
        return;
      }
      const next = advanceCoverStep(
        stepRef.current,
        dwellRef.current,
        coverPositionAt(poseRef.current),
        dt,
      );
      if (next.index !== stepRef.current) {
        stepRef.current = next.index;
        setStep(next.index);
      }
      dwellRef.current = next.dwell;
      setDwell(next.dwell);
    }, 50);
    return () => clearInterval(timer);
  }, [mode, viewReady, viewFailed]);

  const updatePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setPose({
      x: Math.max(-1, Math.min(1, (((event.clientX - bounds.left) / bounds.width) - 0.5) / 0.4)),
      y: Math.max(-1, Math.min(1, (0.5 - (event.clientY - bounds.top) / bounds.height) / 0.4)),
    });
  };
  const changeTargetDistance = (next: number) => {
    distanceRef.current = next;
    dwellRef.current = 0;
    setDwell(0);
    setTargetDistance(next);
  };
  const procedureComplete = step === coverProcedure.length;
  const site = mode === "near" ? "near" : "distance";
  const fullyObserved = odMovement && osMovement && alternateMovement && interpretation;
  const normal = odMovement === "none" && osMovement === "none" && alternateMovement === "none" && interpretation === "none";
  const labels = Object.fromEntries(movementOptions);
  const observation = !fullyObserved
    ? ""
    : normal
      ? `No refixation movement observed during cover–uncover or alternating cover testing at ${site}.`
      : `Cover–uncover: OD ${labels[odMovement].toLowerCase()}, OS ${labels[osMovement].toLowerCase()}; alternating cover: ${labels[alternateMovement].toLowerCase()}; ${interpretation === "tropia" ? "tropia suspected" : interpretation === "phoria" ? "phoria suspected" : interpretation === "none" ? "no deviation suspected" : "interpretation uncertain"} at ${site}.`;
  const ready = procedureComplete && !!observation && viewReady && !viewFailed;
  const current = coverProcedure[step];
  const activePosition = coverPositionAt(pose);
  const occludedEye = activePosition === "OD" || activePosition === "OS" ? activePosition : null;

  return (
    <dialog
      ref={dialog}
      className="examination-stage cover-stage"
      aria-labelledby="cover-title"
      onCancel={(event) => { event.preventDefault(); onCancel(); }}
    >
      <header>
        <div>
          <p className="eyebrow">MANUAL COVER TEST · BOTH EYES · {site.toUpperCase()}</p>
          <h1 id="cover-title">Cover–uncover and alternating cover test</h1>
        </div>
        <button className="secondary" onClick={onCancel}>Cancel</button>
      </header>
      <div className="cover-instructions">
        <p>Keep Arun’s attention on the fixation target. Cover and uncover each eye, then alternate without allowing binocular fusion between sides.</p>
        <button className="primary" disabled={asked} onClick={() => setAsked(true)}>
          {asked ? `Arun is fixating at ${site}` : `Ask Arun to fixate at ${site}`}
        </button>
        {asked && <p className="small">Arun: “Okay, I’ll keep looking at the target and keep my head still.”</p>}
      </div>
      <div className="cover-workspace">
        <div
          className={`eye-viewport cover-viewport ${grabbed ? "is-grabbed" : ""}`}
          tabIndex={0}
          role="application"
          aria-label="Cover-test occluder. Drag to cover either eye or move it below the face; arrow keys adjust position."
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
            setPose((value) => ({
              x: Math.max(-1, Math.min(1, value.x + (event.key === 'ArrowLeft' ? -0.05 : event.key === 'ArrowRight' ? 0.05 : 0))),
              y: Math.max(-1, Math.min(1, value.y + (event.key === 'ArrowUp' ? 0.05 : event.key === 'ArrowDown' ? -0.05 : 0))),
            }));
          }}
        >
          <CoverViewBoundary onFailure={() => setViewFailed(true)}>
            <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.04, 1.24], fov: 43 }}>
              <CoverPatientView fixation={fixation} movement={movement} onReady={() => setViewReady(true)} />
            </Canvas>
          </CoverViewBoundary>
          <div className="cover-overlay" aria-hidden="true">
            {(["OD", "OS"] as CoverEye[]).map((eye) => (
              <span
                key={eye}
                className={`cover-eye-guide ${occludedEye === eye ? "covered" : ""}`}
                style={{ left: `${50 + coverTargets[eye].x * 40}%`, top: "50%" }}
              ><b>{eye}</b></span>
            ))}
            <span
              className="manual-paddle cover-paddle"
              style={{ left: `${50 + pose.x * 40}%`, top: `${50 - pose.y * 40}%` }}
            ><i /></span>
          </div>
          <span className="visual-label">Drag the occluder · hold steady · watch the eye that becomes visible</span>
        </div>
        <aside className={`cover-fixation-card ${mode}`} aria-label={`${site} fixation target`}>
          <strong>{site.toUpperCase()} FIXATION</strong>
          {mode === "distance" ? <span className="distance-fixation">E</span> : <span className="near-fixation">✦</span>}
          <p>{mode === "distance" ? "Simulated target at 6 m" : "Keep the target centred at 40 cm"}</p>
          {mode === "near" && (
            <label>Target distance: {targetDistance} cm
              <input aria-label="Near fixation distance" type="range" min="25" max="60" value={targetDistance} onChange={(event) => changeTargetDistance(Number(event.target.value))} />
            </label>
          )}
        </aside>
      </div>
      <footer>
        <div className="cover-phase-heading">
          <span>{step < 4 ? "1 · COVER–UNCOVER" : step < coverProcedure.length ? "2 · ALTERNATING COVER" : "PROCEDURE COMPLETE"}</span>
          <b>{current?.label ?? "Occluder removed · record your observations"}</b>
        </div>
        <ol className="cover-sequence" aria-label="Cover-test procedure sequence">
          {coverProcedure.map((item, index) => (
            <li key={index} className={index < step ? "seen" : index === step ? "current" : ""}>
              {index < step ? "✓" : index + 1} <span>{item.label}</span>
            </li>
          ))}
        </ol>
        <p role="status">
          {viewFailed
            ? "The patient view is unavailable; this finding cannot be recorded."
            : !asked
              ? `Ask Arun to fixate at ${site} before beginning.`
              : mode === "near" && Math.abs(targetDistance - 40) > 2
                ? "Set the near fixation target to 40 cm."
                : procedureComplete
                  ? "Technique sequence complete. Record only the movements you observed."
                  : activePosition === current?.position
                    ? `${current.label} · hold steady and observe…`
                    : current?.position === "away"
                      ? "Move the occluder fully below the eyes and observe the uncovered eye."
                      : `Move the occluder over ${current?.position} and watch the other eye.`}
        </p>
        <progress value={dwell} max={current?.dwell ?? 1} aria-label="Cover-test step progress" />
        {procedureComplete && (
          <section className="cover-observation-form" aria-label="Record cover-test observations">
            <label>OD on cover–uncover<select value={odMovement} onChange={(event) => setOdMovement(event.target.value)}><option value="">Select observed movement</option>{movementOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>OS on cover–uncover<select value={osMovement} onChange={(event) => setOsMovement(event.target.value)}><option value="">Select observed movement</option>{movementOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Alternating cover<select aria-label="Alternating cover observation" value={alternateMovement} onChange={(event) => setAlternateMovement(event.target.value)}><option value="">Select observed movement</option>{movementOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
            <label>Overall interpretation<select value={interpretation} onChange={(event) => setInterpretation(event.target.value)}><option value="">Select your interpretation</option><option value="none">No deviation observed</option><option value="tropia">Tropia suspected</option><option value="phoria">Phoria suspected</option><option value="uncertain">Uncertain—repeat required</option></select></label>
          </section>
        )}
        <button className="primary full" disabled={!ready} onClick={() => { if (done.current || !ready) return; done.current = true; onComplete(observation); }}>
          Record your cover-test findings →
        </button>
        <p className="small muted">The eye behavior is authored for this fictional case. Your interpretation is saved unchanged for debrief comparison.</p>
      </footer>
    </dialog>
  );
}
