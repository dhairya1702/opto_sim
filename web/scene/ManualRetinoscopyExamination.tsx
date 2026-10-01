import { Component, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { ExamConfig } from "../domain/types";
import {
  authoredNetSphere,
  formatSignedDioptres,
  reflexMotion,
  reflexQuality,
  retinoscopeAligned,
  retinoscopySweepZone,
  retinoscopyTargets,
  type ReflexMotion,
  type RetinoscopePose,
} from "../interaction/retinoscopy";
import { EyeSurface } from "./EyeSurface";

class RetinoscopyBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() {
    return this.state.failed
      ? <p className="notice">The retinoscopy view is unavailable. Cancel and try again with 3D rendering enabled.</p>
      : this.props.children;
  }
}

function RetinoscopyPatient({ onReady }: { onReady: () => void }) {
  const movement = useRef({ x: 0, y: 0, used: true });
  const sent = useRef(false);
  useFrame(() => {
    if (!sent.current) {
      sent.current = true;
      onReady();
    }
  });
  return (
    <>
      <color attach="background" args={["#0d191c"]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[-1, 2, 3]} intensity={0.8} />
      {[-0.2, 0.2].map((x) => <EyeSurface key={x} x={x} pupils motility={false} progress={0} movement={movement} />)}
    </>
  );
}

const quarterPowers = Array.from({ length: 17 }, (_, index) => -2 + index * 0.25);

export function ManualRetinoscopyExamination({
  config,
  onComplete,
  onCancel,
}: {
  config: ExamConfig;
  onComplete: (observation?: string) => void;
  onCancel: () => void;
}) {
  const eye = config.eye === "OS" ? "OS" : "OD";
  const dialog = useRef<HTMLDialogElement>(null);
  const poseRef = useRef<RetinoscopePose>({ x: 0, y: -0.75 });
  const instructedRef = useRef(false);
  const beamRef = useRef(false);
  const distanceRef = useRef(67);
  const lensRef = useRef(-0.5);
  const axisRef = useRef<90 | 180>(90);
  const lastZone = useRef<"left" | "right" | null>(null);
  const sweepCounts = useRef<Record<string, number>>({});
  const done = useRef(false);
  const [pose, setPose] = useState(poseRef.current);
  const [grabbed, setGrabbed] = useState(false);
  const [instructed, setInstructed] = useState(false);
  const [beamOn, setBeamOn] = useState(false);
  const [workingDistance, setWorkingDistance] = useState(67);
  const [trialLens, setTrialLens] = useState(-0.5);
  const [axis, setAxis] = useState<90 | 180>(90);
  const [observed, setObserved] = useState<string[]>([]);
  const [, setSweepRevision] = useState(0);
  const [viewReady, setViewReady] = useState(false);
  const [viewFailed, setViewFailed] = useState(false);
  const [grossEntry, setGrossEntry] = useState("");
  const [correctionEntry, setCorrectionEntry] = useState("");
  const [netEntry, setNetEntry] = useState("");
  const [cylinderEntry, setCylinderEntry] = useState("");
  const [axisEntry, setAxisEntry] = useState("");
  poseRef.current = pose;
  instructedRef.current = instructed;
  beamRef.current = beamOn;
  distanceRef.current = workingDistance;
  lensRef.current = trialLens;
  axisRef.current = axis;

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);

  const changeLens = (delta: number) => {
    const next = Math.max(-2, Math.min(2, Math.round((lensRef.current + delta) * 4) / 4));
    lensRef.current = next;
    setTrialLens(next);
    lastZone.current = null;
  };
  const changeAxis = (next: 90 | 180) => {
    axisRef.current = next;
    setAxis(next);
    lastZone.current = null;
  };
  const changeBeam = (next: boolean) => {
    beamRef.current = next;
    setBeamOn(next);
    lastZone.current = null;
  };
  const changeWorkingDistance = (next: number) => {
    distanceRef.current = next;
    setWorkingDistance(next);
    lastZone.current = null;
  };
  const applyPose = (nextPose: RetinoscopePose) => {
    poseRef.current = nextPose;
    setPose(nextPose);
    const usable = instructedRef.current && beamRef.current && viewReady && !viewFailed && Math.abs(distanceRef.current - 67) <= 2 && retinoscopeAligned(eye, nextPose);
    if (!usable) {
      lastZone.current = null;
      return;
    }
    const zone = retinoscopySweepZone(eye, nextPose);
    if (zone === "centre") return;
    if (lastZone.current && lastZone.current !== zone) {
      const currentMotion = reflexMotion(eye, distanceRef.current, lensRef.current);
      const key = `${currentMotion}:${currentMotion === "neutral" ? axisRef.current : "any"}`;
      const count = Math.min(2, (sweepCounts.current[key] ?? 0) + 1);
      sweepCounts.current[key] = count;
      setSweepRevision((value) => value + 1);
      if (count >= 2) setObserved((items) => items.includes(key) ? items : [...items, key]);
    }
    lastZone.current = zone;
  };
  const updatePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    applyPose({
      x: Math.max(-1, Math.min(1, (((event.clientX - bounds.left) / bounds.width) - 0.5) / 0.4)),
      y: Math.max(-1, Math.min(1, (0.5 - (event.clientY - bounds.top) / bounds.height) / 0.4)),
    });
  };
  const motion = reflexMotion(eye, workingDistance, trialLens);
  const quality = reflexQuality(eye, workingDistance, trialLens);
  const target = retinoscopyTargets[eye];
  const aligned = retinoscopeAligned(eye, pose);
  const currentZone = aligned ? retinoscopySweepZone(eye, pose) : null;
  const currentSweepKey = `${motion}:${motion === "neutral" ? axis : "any"}`;
  const currentCrossings = Math.min(2, sweepCounts.current[currentSweepKey] ?? 0);
  const dx = Math.max(-0.2, Math.min(0.2, pose.x - target.x));
  const reflexOffset = motion === "neutral" ? 0 : dx * (motion === "with" ? 125 : -125);
  const techniqueComplete = observed.includes("with:any") && observed.includes("against:any") && observed.includes("neutral:90") && observed.includes("neutral:180");
  const atNeutral = motion === "neutral";
  const selectionsComplete = grossEntry && correctionEntry && netEntry && cylinderEntry && axisEntry;
  const cylinderText = cylinderEntry === "uncertain" ? "uncertain" : formatSignedDioptres(Number(cylinderEntry));
  const observation = !selectionsComplete
    ? ""
      : `Gross neutralisation ${formatSignedDioptres(Number(grossEntry))} at 67 cm; working-distance correction ${formatSignedDioptres(Number(correctionEntry))}; sphere ${formatSignedDioptres(Number(netEntry))} · cylinder ${cylinderText} · axis ${axisEntry === "na" ? "not applicable" : axisEntry === "uncertain" ? "uncertain" : `${axisEntry}°`}.`;
  const ready = techniqueComplete && atNeutral && !beamOn && !!observation && viewReady && !viewFailed;

  return (
    <dialog ref={dialog} className="examination-stage retinoscopy-stage" aria-labelledby="retinoscopy-title" onCancel={(event) => { event.preventDefault(); onCancel(); }}>
      <header>
        <div>
          <p className="eyebrow">MANUAL RETINOSCOPY · {eye} · OBJECTIVE REFRACTION</p>
          <h1 id="retinoscopy-title">Neutralise the retinal reflex</h1>
        </div>
        <button className="secondary" onClick={onCancel}>Cancel</button>
      </header>
      <div className="retinoscopy-instructions">
        <p>Work at 67 cm. Sweep the streak through the pupil, bracket neutral with trial lenses, and check both principal meridians before applying the working-distance correction.</p>
        <button className="primary" disabled={instructed} onClick={() => setInstructed(true)}>{instructed ? "Arun is fixating in the distance" : "Ask Arun to look at the distant target"}</button>
        {instructed && <p className="small">Arun: “Okay, I’ll look past you and keep my head still.”</p>}
      </div>
      <div className="retinoscopy-workspace">
        <div
          className={`eye-viewport retinoscopy-viewport ${grabbed ? "is-grabbed" : ""}`}
          tabIndex={0}
          role="application"
          aria-label="Retinoscope. Drag horizontally across the selected pupil to sweep the reflex; use arrow keys for fine positioning."
          onPointerDown={(event) => { if (event.button !== 0) return; event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); setGrabbed(true); updatePointer(event); }}
          onPointerMove={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) updatePointer(event); }}
          onPointerUp={(event) => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); setGrabbed(false); }}
          onPointerCancel={() => setGrabbed(false)}
          onLostPointerCapture={() => setGrabbed(false)}
          onKeyDown={(event) => {
            if (event.key === " ") { event.preventDefault(); changeBeam(!beamRef.current); return; }
            if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
            event.preventDefault();
            const value = poseRef.current;
            applyPose({ x: Math.max(-1, Math.min(1, value.x + (event.key === 'ArrowLeft' ? -0.04 : event.key === 'ArrowRight' ? 0.04 : 0))), y: Math.max(-1, Math.min(1, value.y + (event.key === 'ArrowUp' ? 0.04 : event.key === 'ArrowDown' ? -0.04 : 0))) });
          }}
        >
          <RetinoscopyBoundary onFailure={() => setViewFailed(true)}>
            <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.04, 1.24], fov: 43 }}><RetinoscopyPatient onReady={() => setViewReady(true)} /></Canvas>
          </RetinoscopyBoundary>
          <div className="retinoscopy-overlay" aria-hidden="true">
            <span className="retino-eye-guide" style={{ left: `${50 + target.x * 40}%`, top: "50%" }} />
            <span className="retino-sweep-rail" style={{ left: `${50 + target.x * 40}%`, top: "50%" }} />
            <span className={`retino-sweep-gate left ${currentZone === "left" ? "active" : ""}`} style={{ left: `${50 + (target.x - 0.1) * 40}%`, top: "50%" }}>L</span>
            <span className={`retino-sweep-gate right ${currentZone === "right" ? "active" : ""}`} style={{ left: `${50 + (target.x + 0.1) * 40}%`, top: "50%" }}>R</span>
            {beamOn && aligned && (
              <span className={`retino-reflex ${motion} axis-${axis}`} style={{ left: `${50 + target.x * 40}%`, top: "50%", opacity: quality.brightness, '--reflex-offset': `${reflexOffset}px`, '--reflex-width': `${18 + quality.width * 48}px` } as CSSProperties} />
            )}
            {beamOn && <span className="retino-beam" style={{ left: `${50 + pose.x * 40}%`, top: `${50 - pose.y * 40}%` }} />}
            <span className={`manual-retinoscope ${beamOn ? "on" : ""}`} style={{ left: `${50 + pose.x * 40}%`, top: `${50 - pose.y * 40}%` }}><i /></span>
          </div>
          <span className="visual-label">Drag the retinoscope centre to L → R → L · pause at each marker</span>
        </div>
        <aside className="trial-lens-rack" aria-label="Trial lens rack">
          <strong>TRIAL LENS</strong>
          <output>{formatSignedDioptres(trialLens)}</output>
          <div className="lens-buttons"><button aria-label="Reduce trial lens by 0.25 D" onClick={() => changeLens(-0.25)}>−0.25</button><button aria-label="Increase trial lens by 0.25 D" onClick={() => changeLens(0.25)}>+0.25</button></div>
          <div className="lens-stack">{quarterPowers.filter((power) => Math.abs(power - trialLens) <= 0.5).map((power) => <span key={power} className={power === trialLens ? "selected" : ""}>{formatSignedDioptres(power)}</span>)}</div>
          <p>Bracket the reversal. Neutral should be checked with the streak in both meridians.</p>
        </aside>
      </div>
      <footer>
        <div className="retinoscopy-controls">
          <label>Working distance: {workingDistance} cm<input aria-label="Retinoscopy working distance" type="range" min="45" max="90" value={workingDistance} onChange={(event) => changeWorkingDistance(Number(event.target.value))} /></label>
          <div className="streak-axis" aria-label="Streak orientation"><span>Streak</span><button className={axis === 90 ? "selected" : ""} aria-pressed={axis === 90} onClick={() => changeAxis(90)}>90°</button><button className={axis === 180 ? "selected" : ""} aria-pressed={axis === 180} onClick={() => changeAxis(180)}>180°</button></div>
          <button className={beamOn ? "primary" : "secondary"} aria-pressed={beamOn} onClick={() => changeBeam(!beamRef.current)}>{beamOn ? "Switch retinoscope off" : "Switch retinoscope on"}</button>
        </div>
        <ul className="retinoscopy-checklist" aria-label="Observed retinoscopy states">
          <li className={observed.includes("with:any") ? "seen" : ""}>{observed.includes("with:any") ? "✓" : "○"} With motion</li>
          <li className={observed.includes("neutral:90") ? "seen" : ""}>{observed.includes("neutral:90") ? "✓" : "○"} Neutral · 90°</li>
          <li className={observed.includes("neutral:180") ? "seen" : ""}>{observed.includes("neutral:180") ? "✓" : "○"} Neutral · 180°</li>
          <li className={observed.includes("against:any") ? "seen" : ""}>{observed.includes("against:any") ? "✓" : "○"} Against motion</li>
        </ul>
        {!techniqueComplete && beamOn && aligned && <div className="retino-sweep-progress" aria-label="Current sweep progress"><span>Current reflex crossings</span><b>{currentCrossings}/2</b><progress value={currentCrossings} max={2} /></div>}
        <p role="status">{viewFailed ? "The patient view is unavailable; this finding cannot be recorded." : !instructed ? "Ask Arun to fixate in the distance first." : Math.abs(workingDistance - 67) > 2 ? "Set your working distance to 67 cm." : !beamOn && !techniqueComplete ? "Switch on the retinoscope and align with the selected pupil." : beamOn && !aligned ? `Align the retinoscope centre with the dashed ${eye} guide.` : techniqueComplete && !atNeutral ? "Return to the neutralising lens before recording." : techniqueComplete && beamOn ? "Technique complete. Switch off the retinoscope and calculate the net result." : techniqueComplete ? "Enter the gross neutralisation and apply the working-distance correction." : currentCrossings === 0 ? `${motion.toUpperCase()} reflex · drag to either L or R marker, then cross the pupil and return.` : currentCrossings === 1 ? "First crossing registered. Drag back to the opposite marker once more." : `${motion.toUpperCase()} reflex recorded. Adjust the lens or streak orientation for the next observation.`}</p>
        <p className="retino-quality">Reflex: <b>{motion}</b> · {quality.speed > .8 ? "fast" : quality.speed > .5 ? "moderate" : "slow"} · {quality.brightness > .8 ? "bright" : "dim"} · {quality.width > .8 ? "broad" : "narrow"}</p>
        {techniqueComplete && (
          <section className="retinoscopy-observation-form" aria-label="Record retinoscopy calculation">
            <label>Gross neutralisation<select aria-label="Gross neutralisation" value={grossEntry} onChange={(event) => setGrossEntry(event.target.value)}><option value="">Select</option>{quarterPowers.map((power) => <option key={power} value={power}>{formatSignedDioptres(power)}</option>)}</select></label>
            <label>Working-distance correction<select aria-label="Working-distance correction" value={correctionEntry} onChange={(event) => setCorrectionEntry(event.target.value)}><option value="">Select</option><option value="-1.5">−1.50 D</option><option value="-2">−2.00 D</option><option value="-1">−1.00 D</option></select></label>
            <label>Net sphere<select aria-label="Net sphere" value={netEntry} onChange={(event) => setNetEntry(event.target.value)}><option value="">Select</option>{quarterPowers.map((power) => <option key={power} value={power}>{formatSignedDioptres(power)}</option>)}</select></label>
            <label>Cylinder<select aria-label="Retinoscopy cylinder" value={cylinderEntry} onChange={(event) => setCylinderEntry(event.target.value)}><option value="">Select</option><option value="0">0.00 D</option><option value="-0.25">−0.25 D</option><option value="-0.5">−0.50 D</option><option value="uncertain">Uncertain</option></select></label>
            <label>Axis<select aria-label="Retinoscopy axis" value={axisEntry} onChange={(event) => setAxisEntry(event.target.value)}><option value="">Select</option><option value="na">Not applicable</option><option value="90">90°</option><option value="180">180°</option><option value="uncertain">Uncertain</option></select></label>
            <div className="retino-calculation"><span>Gross</span><b>{grossEntry ? formatSignedDioptres(Number(grossEntry)) : "—"}</b><span>Correction</span><b>{correctionEntry ? formatSignedDioptres(Number(correctionEntry)) : "—"}</b><span>Net</span><b>{netEntry ? formatSignedDioptres(Number(netEntry)) : "—"}</b></div>
          </section>
        )}
        <button className="primary full" disabled={!ready} onClick={() => { if (done.current || !ready) return; done.current = true; onComplete(observation); }}>Record your objective-refraction findings →</button>
        <p className="small muted">Fictional spherical reflex model. The learner’s calculation is stored unchanged and compared with the authored endpoint.</p>
      </footer>
    </dialog>
  );
}
