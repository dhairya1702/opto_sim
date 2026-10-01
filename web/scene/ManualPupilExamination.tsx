import { Component, useEffect, useRef, useState, type MutableRefObject, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { AmbientLight, PointLight } from "three";
import type { ExamConfig } from "../domain/types";
import {
  generalResponseLabels,
  pupilEyeAt,
  pupilTargets,
  rapdPattern,
  type PupilEye,
  type PupilToolPose,
} from "../interaction/pupils";
import { EyeSurface } from "./EyeSurface";

class PupilViewBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() {
    return this.state.failed
      ? <p className="notice">The pupil view is unavailable. Cancel and try again with 3D rendering enabled.</p>
      : this.props.children;
  }
}

function PupilScene({
  pose,
  stimulus,
  ambient,
  movement,
  onReady,
}: {
  pose: MutableRefObject<PupilToolPose>;
  stimulus: MutableRefObject<number>;
  ambient: MutableRefObject<number>;
  movement: MutableRefObject<{ x: number; y: number; used: boolean }>;
  onReady: () => void;
}) {
  const point = useRef<PointLight>(null);
  const room = useRef<AmbientLight>(null);
  const sent = useRef(false);
  useFrame(() => {
    if (!sent.current) {
      sent.current = true;
      onReady();
    }
    point.current?.position.set(pose.current.x * 0.38, pose.current.y * 0.2, 0.2);
    if (point.current) point.current.intensity = stimulus.current * 1.8;
    if (room.current) room.current.intensity = 0.35 + ambient.current * 1.3;
  });
  return (
    <>
      <color attach="background" args={["#101d22"]} />
      <ambientLight ref={room} intensity={1.2} />
      <directionalLight position={[-1, 2, 3]} intensity={1.2} />
      <pointLight ref={point} intensity={0} distance={0.85} color="#fff4cf" />
      {[-0.2, 0.2].map((x) => (
        <EyeSurface
          key={x}
          x={x}
          pupils
          motility={false}
          progress={0}
          movement={movement}
          pupilStimulus={stimulus}
          ambientLevel={ambient}
        />
      ))}
    </>
  );
}

const sizeOptions = ["2", "3", "4", "5", "6", "7"];

export function ManualPupilExamination({
  config,
  onComplete,
  onCancel,
}: {
  config: ExamConfig;
  onComplete: (observation?: string) => void;
  onCancel: () => void;
}) {
  const mode = config.mode === "rapd" ? "rapd" : "general";
  const dialog = useRef<HTMLDialogElement>(null);
  const poseRef = useRef<PupilToolPose>({ x: 0, y: -0.72 });
  const torchRef = useRef(false);
  const ambientRef = useRef(0.7);
  const instructedRef = useRef(false);
  const stimulus = useRef(0);
  const movement = useRef({ x: 0, y: 0, used: true });
  const sequenceRef = useRef<PupilEye[]>([]);
  const interactionRevision = useRef(0);
  const done = useRef(false);
  const [pose, setPose] = useState(poseRef.current);
  const [grabbed, setGrabbed] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [ambient, setAmbient] = useState(70);
  const [instructed, setInstructed] = useState(false);
  const [activeEye, setActiveEye] = useState<PupilEye | null>(null);
  const [dwell, setDwell] = useState(0);
  const [generalSeen, setGeneralSeen] = useState<string[]>([]);
  const [sequence, setSequence] = useState<PupilEye[]>([]);
  const [viewReady, setViewReady] = useState(false);
  const [viewFailed, setViewFailed] = useState(false);
  const [odSize, setOdSize] = useState("");
  const [osSize, setOsSize] = useState("");
  const [equality, setEquality] = useState("");
  const [odDirect, setOdDirect] = useState("");
  const [osDirect, setOsDirect] = useState("");
  const [consensual, setConsensual] = useState("");
  const [rapd, setRapd] = useState("");
  poseRef.current = pose;
  torchRef.current = torchOn;
  ambientRef.current = ambient / 100;
  instructedRef.current = instructed;
  sequenceRef.current = sequence;

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);

  useEffect(() => {
    let previous = performance.now();
    let current: PupilEye | null = null;
    let held = 0;
    let off = 0;
    let armed = true;
    let revision = interactionRevision.current;
    const timer = setInterval(() => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - previous) / 1000);
      previous = now;
      if (revision !== interactionRevision.current) {
        revision = interactionRevision.current;
        current = null;
        held = 0;
        setDwell(0);
      }
      const usable = viewReady && !viewFailed && instructedRef.current && ambientRef.current <= 0.45;
      const eye = usable && torchRef.current ? pupilEyeAt(poseRef.current) : null;
      stimulus.current = eye ? 1 : 0;
      setActiveEye(eye);
      if (!eye) {
        current = null;
        held = 0;
        setDwell(0);
        off += dt;
        if (off >= 0.35) armed = true;
        return;
      }
      off = 0;
      if (mode === "general" && !armed) return;
      const expected = mode === "rapd" ? rapdPattern[sequenceRef.current.length] : eye;
      if (eye !== expected) {
        current = eye;
        held = 0;
        setDwell(0);
        return;
      }
      if (current !== eye) {
        current = eye;
        held = 0;
      }
      held += dt;
      setDwell(held);
      const threshold = mode === "rapd" ? 0.7 : 0.8;
      if (held < threshold) return;
      if (mode === "general") {
        setGeneralSeen((seen) => [...new Set([...seen, ...generalResponseLabels(eye)])]);
        armed = false;
      } else if (sequenceRef.current.length < rapdPattern.length) {
        const next = [...sequenceRef.current, eye];
        sequenceRef.current = next;
        setSequence(next);
      }
      held = 0;
      setDwell(0);
    }, 50);
    return () => clearInterval(timer);
  }, [mode, viewReady, viewFailed]);

  const changeTorch = (next: boolean) => {
    interactionRevision.current += 1;
    torchRef.current = next;
    if (!next) {
      stimulus.current = 0;
      setActiveEye(null);
      setDwell(0);
    }
    setTorchOn(next);
  };

  const changeAmbient = (next: number) => {
    interactionRevision.current += 1;
    ambientRef.current = next / 100;
    if (next > 45) {
      stimulus.current = 0;
      setActiveEye(null);
      setDwell(0);
    }
    setAmbient(next);
  };

  const updatePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setPose({
      x: Math.max(-1, Math.min(1, (((event.clientX - bounds.left) / bounds.width) - 0.5) / 0.4)),
      y: Math.max(-1, Math.min(1, (0.5 - (event.clientY - bounds.top) / bounds.height) / 0.4)),
    });
  };
  const directSummary =
    odDirect && osDirect
      ? odDirect === osDirect
        ? `direct responses ${odDirect} OU`
        : `direct response ${odDirect} OD and ${osDirect} OS`
      : "";
  const generalObservation =
    odSize && osSize && equality && directSummary && consensual
      ? `OD ${odSize} mm, OS ${osSize} mm in dim illumination; pupils ${equality}; ${directSummary}; consensual responses ${consensual} OU.`
      : "";
  const rapdObservation =
    rapd === "none"
      ? "No relative afferent pupillary defect in this authored assessment."
      : rapd === "OD"
        ? "Relative afferent pupillary defect suspected in OD."
        : rapd === "OS"
          ? "Relative afferent pupillary defect suspected in OS."
          : rapd === "uncertain"
            ? "RAPD assessment uncertain; repeat examination required."
            : "";
  const procedureComplete = mode === "general" ? generalSeen.length === 4 : sequence.length === rapdPattern.length;
  const observation = mode === "general" ? generalObservation : rapdObservation;
  const ready = procedureComplete && !!observation && !torchOn && viewReady && !viewFailed;
  const requiredEye = mode === "rapd" ? rapdPattern[sequence.length] : null;

  return (
    <dialog
      ref={dialog}
      className="examination-stage pupil-stage"
      aria-labelledby="pupil-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <header>
        <div>
          <p className="eyebrow">MANUAL PUPIL EXAMINATION · BOTH EYES</p>
          <h1 id="pupil-title">{mode === "rapd" ? "Swinging-flashlight RAPD assessment" : "Pupil size and light responses"}</h1>
        </div>
        <button className="secondary" onClick={onCancel}>Cancel</button>
      </header>
      <div className="pupil-instructions">
        <p>
          {mode === "rapd"
            ? "Ask Arun to look beyond the torch. Alternate the beam OD → OS → OD → OS without lighting both eyes at once."
            : "Estimate both pupils, dim the room, then illuminate each eye separately. Move the beam away briefly before testing the other eye."}
        </p>
        <button className="primary" disabled={instructed} onClick={() => setInstructed(true)}>
          {instructed ? "Arun is fixating in the distance" : "Ask Arun to look at a distant target"}
        </button>
        {instructed && <p className="small">Arun: “Okay, I’ll keep looking at the target behind you.”</p>}
      </div>
      <div className="pupil-workspace">
        <div
          className={`eye-viewport pupil-viewport ${grabbed ? "is-grabbed" : ""}`}
          tabIndex={0}
          role="application"
          aria-label="Pen torch. Drag to aim, use arrow keys to adjust, and press Space to switch the beam."
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
            if (event.key === " ") {
              event.preventDefault();
              changeTorch(!torchRef.current);
              return;
            }
            if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
            event.preventDefault();
            setPose((value) => ({
              x: Math.max(-1, Math.min(1, value.x + (event.key === "ArrowLeft" ? -0.05 : event.key === "ArrowRight" ? 0.05 : 0))),
              y: Math.max(-1, Math.min(1, value.y + (event.key === "ArrowUp" ? 0.05 : event.key === "ArrowDown" ? -0.05 : 0))),
            }));
          }}
        >
          <PupilViewBoundary onFailure={() => setViewFailed(true)}>
            <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0.04, 1.2], fov: 43 }}>
              <PupilScene
                pose={poseRef}
                stimulus={stimulus}
                ambient={ambientRef}
                movement={movement}
                onReady={() => setViewReady(true)}
              />
            </Canvas>
          </PupilViewBoundary>
          <div className="pupil-overlay" aria-hidden="true">
            <span className="distant-fixation">+</span>
            {(["OD", "OS"] as PupilEye[]).map((eye) => (
              <span
                key={eye}
                className={`pupil-target ${activeEye === eye ? "active" : ""}`}
                style={{ left: `${50 + pupilTargets[eye].x * 40}%`, top: "50%" }}
              ><b>{eye}</b></span>
            ))}
            {torchOn && <span className="torch-beam" style={{ left: `${50 + pose.x * 40}%`, top: `${50 - pose.y * 40}%` }} />}
            <span className={`pen-torch ${torchOn ? "on" : ""}`} style={{ left: `${50 + pose.x * 40}%`, top: `${50 - pose.y * 40}%` }}><i /></span>
          </div>
          <span className="visual-label">Drag torch · Space toggles beam · aim at one pupil</span>
        </div>
        <aside className="pupil-gauge" aria-label="Pupil-size reference gauge">
          <div><strong>PUPIL GAUGE</strong><small>Visual estimate · mm</small></div>
          {[2, 3, 4, 5, 6, 7].map((size) => (
            <span key={size}><i style={{ width: size * 3.2, height: size * 3.2 }} />{size} mm</span>
          ))}
          <p>Compare in steady room illumination before interpreting the light response.</p>
        </aside>
      </div>
      <footer>
        <div className="pupil-controls">
          <label>
            Room illumination: {ambient}%
            <input aria-label="Room illumination" type="range" min="10" max="100" value={ambient} onChange={(event) => changeAmbient(Number(event.target.value))} />
          </label>
          <button className={torchOn ? "primary" : "secondary"} aria-pressed={torchOn} onClick={() => changeTorch(!torchRef.current)}>
            {torchOn ? "Switch torch off" : "Switch torch on"}
          </button>
        </div>
        {mode === "general" ? (
          <ul className="pupil-checklist" aria-label="Observed pupil responses">
            {["OD direct", "OS consensual", "OS direct", "OD consensual"].map((item) => (
              <li key={item} className={generalSeen.includes(item) ? "seen" : ""}>{generalSeen.includes(item) ? "✓" : "○"} {item}</li>
            ))}
          </ul>
        ) : (
          <ol className="rapd-sequence" aria-label="Swinging-light sequence">
            {rapdPattern.map((eye, index) => <li key={index} className={sequence[index] === eye ? "seen" : index === sequence.length ? "current" : ""}>{sequence[index] === eye ? "✓" : index + 1} {eye}</li>)}
          </ol>
        )}
        <p role="status">
          {viewFailed
            ? "The pupil view is unavailable; this finding cannot be recorded."
            : procedureComplete && torchOn
              ? "Examination sequence complete. Switch the torch off, then record your observations."
              : procedureComplete
                ? "Examination sequence complete. Record what you observed below."
            : !instructed
              ? "Give Arun a distant fixation instruction first."
              : ambient > 45
                ? "Dim the room illumination to 45% or below."
                : !torchOn
                  ? "Switch on the pen torch."
                  : mode === "rapd" && requiredEye
                    ? `Move the beam to ${requiredEye} and hold it steady.`
                    : activeEye
                      ? `Illuminating ${activeEye}${dwell ? " · hold steady…" : ""}`
                      : "Aim the beam at one pupil without spilling onto both eyes."}
        </p>
        <progress value={Math.min(dwell, mode === "rapd" ? 0.7 : 0.8)} max={mode === "rapd" ? 0.7 : 0.8} aria-label="Light observation progress" />
        {mode === "general" && procedureComplete && (
          <section className="pupil-observation-form" aria-label="Record general pupil observations">
            <label>OD size<select value={odSize} onChange={(event) => setOdSize(event.target.value)}><option value="">Select</option>{sizeOptions.map((size) => <option key={size}>{size}</option>)}</select></label>
            <label>OS size<select value={osSize} onChange={(event) => setOsSize(event.target.value)}><option value="">Select</option>{sizeOptions.map((size) => <option key={size}>{size}</option>)}</select></label>
            <label>Equality<select value={equality} onChange={(event) => setEquality(event.target.value)}><option value="">Select</option><option value="equal">Equal</option><option value="unequal">Unequal</option></select></label>
            <label>OD direct<select value={odDirect} onChange={(event) => setOdDirect(event.target.value)}><option value="">Select</option><option value="brisk">Brisk</option><option value="sluggish">Sluggish</option><option value="absent">Absent</option></select></label>
            <label>OS direct<select value={osDirect} onChange={(event) => setOsDirect(event.target.value)}><option value="">Select</option><option value="brisk">Brisk</option><option value="sluggish">Sluggish</option><option value="absent">Absent</option></select></label>
            <label>Consensual OU<select value={consensual} onChange={(event) => setConsensual(event.target.value)}><option value="">Select</option><option value="present">Present</option><option value="absent">Absent</option></select></label>
          </section>
        )}
        {mode === "rapd" && procedureComplete && (
          <label className="rapd-observation">
            Your RAPD observation
            <select value={rapd} onChange={(event) => setRapd(event.target.value)}>
              <option value="">Choose after observing</option>
              <option value="none">No RAPD observed</option>
              <option value="OD">RAPD suspected in OD</option>
              <option value="OS">RAPD suspected in OS</option>
              <option value="uncertain">Uncertain—repeat required</option>
            </select>
          </label>
        )}
        <button
          className="primary full"
          disabled={!ready}
          onClick={() => {
            if (done.current || !ready) return;
            done.current = true;
            onComplete(observation);
          }}
        >
          Record your pupil findings →
        </button>
        <p className="small muted">The response model is authored for this fictional normal case. Your selected observations are preserved for debrief comparison.</p>
      </footer>
    </dialog>
  );
}
