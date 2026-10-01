import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { EyeSurface } from "./EyeSurface";
import { gazePositions, observeTarget, targetFromControls, type MotilityCoverage } from "../interaction/motility";

class ViewBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? <p className="notice">The eye view is unavailable. Cancel and try again with 3D rendering enabled.</p> : this.props.children; }
}
function RenderSignal({ onFrame }: { onFrame: () => void }) {
  useFrame(({ camera, size }) => {
    camera.position.z = Math.max(0.78, 0.4 / (Math.tan(43 * Math.PI / 360) * size.width / size.height));
    onFrame();
  });
  return null;
}

export function MotilityExamination({ onComplete, onCancel }: { onComplete: (observation?: string) => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const pose = useRef(targetFromControls(0, 0, 0.5));
  const movement = useRef({ x: 0, y: 0, used: true });
  const [control, setControl] = useState({ x: 0, y: 0, z: 0.5 });
  const [following, setFollowing] = useState(false);
  const [grabbed, setGrabbed] = useState(false);
  const [guides, setGuides] = useState(true);
  const [asked, setAsked] = useState(false);
  const [observation, setObservation] = useState("");
  const [failed, setFailed] = useState(false);
  const renderedAt = useRef(0);
  const [coverage, setCoverage] = useState<MotilityCoverage>({ seen: [], current: null, dwell: 0 });
  const reduced = useRef(matchMedia("(prefers-reduced-motion: reduce)").matches);
  const done = useRef(false);
  const update = (x: number, y: number, z = control.z) => {
    const next = { x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)), z };
    pose.current = targetFromControls(next.x, next.y, next.z);
    setControl(next);
  };
  useEffect(() => {
    const el = dialog.current!;
    el.showModal();
    return () => el.close();
  }, []);
  useEffect(() => {
    let previousFrame = 0;
    const timer = setInterval(() => {
      const frame = renderedAt.current;
      if (!following || failed || document.hidden) {
        setCoverage(s => observeTarget(s, pose.current, 0, false));
        previousFrame = frame;
        return;
      }
      if (frame === previousFrame) return;
      const dt = previousFrame ? (frame - previousFrame) / 1000 : 0;
      previousFrame = frame;
      setCoverage(s => observeTarget(s, pose.current, dt, true));
    }, 50);
    return () => clearInterval(timer);
  }, [following, failed]);
  const ready = coverage.seen.length === gazePositions.length && asked && !!observation && !failed;
  const recordedObservation = observation === "full"
    ? "Full movements; no diplopia reported during the simulated assessment."
    : observation === "limited"
      ? "Restricted or unequal ocular movement suspected; no diplopia reported."
      : observation === "unsure"
        ? "Ocular motility assessment uncertain; repeat examination required."
        : "";
  const movePointer = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    update(((e.clientX - r.left) / r.width - 0.5) / 0.4, (0.5 - (e.clientY - r.top) / r.height) / 0.4);
  };
  return (
    <dialog ref={dialog} className="examination-stage motility-stage" aria-labelledby="motility-title" onCancel={e => { e.preventDefault(); onCancel(); }}>
      <header><div><p className="eyebrow">MANUAL EXAMINATION · BOTH EYES</p><h1 id="motility-title">Ocular motility</h1></div><button className="secondary" onClick={onCancel}>Cancel</button></header>
      <div className="motility-instructions">
        <p>Keep Arun’s head still. Move the target slowly across an H pattern and watch both eyes. Hold each marked position for a moment.</p>
        <button className="primary" disabled={following} onClick={() => setFollowing(true)}>{following ? "Arun is following the target" : "Ask Arun to follow the target, head still"}</button>
        <p className="small" aria-live="polite">{following ? 'Arun: “Okay, I’ll follow it with my eyes.”' : "Explain the examination before moving the target."}</p>
      </div>
      <div ref={viewport} className={`eye-viewport motility-viewport ${grabbed ? "is-grabbed" : ""}`} tabIndex={0} role="application" aria-label="Manual fixation target. Drag to move, arrow keys to adjust, Page Up and Page Down to change distance."
        onPointerDown={e => { if (e.button !== 0) return; e.currentTarget.focus(); e.currentTarget.setPointerCapture(e.pointerId); setGrabbed(true); movePointer(e); }}
        onPointerMove={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) movePointer(e); }}
        onPointerUp={e => { if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId); setGrabbed(false); }}
        onPointerCancel={() => setGrabbed(false)} onLostPointerCapture={() => setGrabbed(false)}
        onKeyDown={e => {
          if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown"].includes(e.key)) return;
          e.preventDefault(); e.stopPropagation();
          update(control.x + (e.key === "ArrowLeft" ? -0.1 : e.key === "ArrowRight" ? 0.1 : 0), control.y + (e.key === "ArrowUp" ? 0.1 : e.key === "ArrowDown" ? -0.1 : 0), Math.max(0.35, Math.min(0.7, control.z + (e.key === "PageUp" ? -0.05 : e.key === "PageDown" ? 0.05 : 0))));
        }}>
        <ViewBoundary onFailure={() => setFailed(true)}>
          <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 1.2], fov: 43 }} fallback={<p className="notice">3D eye view unavailable. This manual examination needs WebGL.</p>}>
            <color attach="background" args={["#16262b"]} />
            <ambientLight intensity={1.6} /><directionalLight position={[-1, 2, 3]} intensity={2} />
            <RenderSignal onFrame={() => { renderedAt.current = performance.now(); }} />
            {[-0.2, 0.2].map(x => <EyeSurface key={x} x={x} pupils={false} motility progress={0} movement={movement} fixation={pose} tracking={following} reducedMotion={reduced.current} />)}
          </Canvas>
        </ViewBoundary>
        <div className="gaze-overlay" aria-hidden="true">
          {guides && <svg className="gaze-path" viewBox="0 0 100 100" preserveAspectRatio="none"><path d="M18 22 V78 M18 50 H82 M82 22 V78" /></svg>}
          {guides && gazePositions.map(p => <span key={p.id} className={`gaze-stop ${coverage.seen.includes(p.id) ? "seen" : ""} ${coverage.current === p.id ? "observing" : ""}`} style={{ left: `${50 + p.x * 40}%`, top: `${50 - p.y * 40}%` }}>{coverage.seen.includes(p.id) ? "✓" : "·"}</span>)}
          <span className="fixation-stick" style={{ left: `${50 + control.x * 40}%`, top: `${50 - control.y * 40}%`, transform: `translate(-50%, -10px) scale(${0.5 / control.z})` }}><i /></span>
        </div>
        <span className="visual-label">Drag to position · arrow keys for fine movement · enlarged eye view</span>
      </div>
      <footer>
        <div className="motility-controls">
          <label>Target distance: {Math.round(control.z * 100)} cm<input aria-label="Target distance" type="range" min="35" max="70" step="5" value={Math.round(control.z * 100)} onChange={e => update(control.x, control.y, Number(e.target.value) / 100)} /></label>
          <label className="check-row"><input type="checkbox" checked={guides} onChange={e => setGuides(e.target.checked)} />Show H-pattern guides</label>
          <button className="secondary" onClick={() => update(0, 0)}>Centre target</button>
        </div>
        <ul className="gaze-checklist" aria-label="Observed gaze positions">{gazePositions.map(p => <li key={p.id} className={coverage.seen.includes(p.id) ? "seen" : ""}>{coverage.seen.includes(p.id) ? "✓" : "○"} {p.label}</li>)}</ul>
        <p role="status">{coverage.seen.length} / 7 positions observed{coverage.current && !coverage.seen.includes(coverage.current) ? " · hold steady…" : ""}</p>
        <div className="motility-review">
          <button className="secondary" disabled={!following || coverage.seen.length < 7} onClick={() => setAsked(true)}>Ask about double vision</button>
          {asked && <p>Arun: “No, I saw one target throughout.”</p>}
          <label>What did you observe?<select value={observation} onChange={e => setObservation(e.target.value)}><option value="">Choose after observing</option><option value="full">Both eyes move together through the tested positions</option><option value="limited">Movement looks restricted or unequal</option><option value="unsure">I’m not sure yet</option></select></label>
          {observation && observation !== "full" && <p className="notice">This case models coordinated movements. Recheck with the target; if uncertain, compare both eyes before recording the authored finding.</p>}
        </div>
        <button className="primary full" disabled={!ready} onClick={() => { if (done.current || !ready) return; done.current = true; onComplete(recordedObservation); }}>Record finding & return to room →</button>
        <p className="small muted">Simplified normal-movement model. Position coverage is a practice aid, not a clinical technique score. Your selected observation is preserved for debrief comparison.</p>
      </footer>
    </dialog>
  );
}
