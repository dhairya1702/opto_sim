import { Component, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import type { ExamConfig } from "../domain/types";
import {
  accumulateAlignedTime,
  acuityTarget,
  isAcuityToolAligned,
  type AcuityToolPose,
} from "../interaction/acuity";
import { EyeSurface } from "./EyeSurface";
import { Sign } from "./Models";

const eyeName = (eye: ExamConfig["eye"]) => (eye === "OD" ? "right eye (OD)" : "left eye (OS)");

class AcuityViewBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? <p className="notice">The patient view is unavailable. Cancel and try again with 3D rendering enabled.</p> : this.props.children; }
}

function ViewReady({ onReady }: { onReady: () => void }) {
  const sent = useRef(false);
  useFrame(() => {
    if (sent.current) return;
    sent.current = true;
    onReady();
  });
  return null;
}

function AcuityChart({ near }: { near: boolean }) {
  return (
    <aside
      className={`learner-acuity-chart ${near ? "near" : "distance"}`}
      aria-label={near ? "Near-vision reading chart" : "Distance visual-acuity chart"}
    >
      <div className="chart-header">
        <span>{near ? "NEAR VISION" : "DISTANCE VISION"}</span>
        <small>{near ? "Hold at 40 cm" : "Simulated 6 m"}</small>
      </div>
      {near ? (
        <div className="near-reading-lines">
          <div className="near-line n10">
            <b>N10</b>
            <p>Vision helps us notice details in the world around us.</p>
          </div>
          <div className="near-line n8">
            <b>N8</b>
            <p>Please read this sentence clearly from left to right.</p>
          </div>
          <div className="near-line n6">
            <b>N6</b>
            <p>The quick brown fox jumps over the lazy dog.</p>
          </div>
          <div className="near-line n5">
            <b>N5</b>
            <p>Small print requires careful focus and clear vision.</p>
          </div>
        </div>
      ) : (
        <div className="distance-reading-lines">
          <div className="distance-line line-60"><span>E</span><b>6/60</b></div>
          <div className="distance-line line-36"><span>F P</span><b>6/36</b></div>
          <div className="distance-line line-24"><span>T O Z</span><b>6/24</b></div>
          <div className="distance-line line-18"><span>L P E D</span><b>6/18</b></div>
          <div className="distance-line line-12"><span>P E C F D</span><b>6/12</b></div>
          <div className="distance-line line-9"><span>E D F C Z P</span><b>6/9</b></div>
          <div className="distance-line line-6"><span>F E L O P Z D</span><b>6/6</b></div>
          <div className="distance-line line-5"><span>D E F P O T E C</span><b>6/5</b></div>
        </div>
      )}
      <p className="chart-note">Reference chart · patient responses come from the case script</p>
    </aside>
  );
}

type ReadingBeat = { line: string; words: string; struggle?: boolean };
const distanceOptions = ["6/60", "6/36", "6/24", "6/18", "6/12", "6/9", "6/6", "6/5"];
function readingPlan(examId: "distance" | "pinhole" | "near") {
  if (examId === "near")
    return {
      options: ["N10", "N8", "N6", "N5"],
      beats: [
        { line: "N10", words: "Vision helps us notice details in the world around us." },
        { line: "N8", words: "Please read this sentence clearly from left to right." },
        { line: "N6", words: "The quick brown fox jumps over the lazy dog." },
        { line: "N5", words: "Small… print… um—sorry, I can’t make out the rest.", struggle: true },
      ] as ReadingBeat[],
    };
  const clear: ReadingBeat[] = [
    { line: "6/60", words: "E." },
    { line: "6/36", words: "F… P." },
    { line: "6/24", words: "T… O… Z." },
    { line: "6/18", words: "L… P… E… D." },
  ];
  if (examId === "distance")
    return {
      options: distanceOptions,
      beats: [
        ...clear,
        { line: "6/12", words: "P… E… is that C? Um… sorry, I can’t read the rest.", struggle: true },
      ],
    };
  return {
    options: distanceOptions,
    beats: [
      ...clear,
      { line: "6/12", words: "P… E… C… F… D." },
      { line: "6/9", words: "E… D… F… C… Z… P." },
      { line: "6/6", words: "F… E… L… O… P… Z… D." },
      { line: "6/5", words: "D… E… um… no, sorry, I can’t make out the rest.", struggle: true },
    ] as ReadingBeat[],
  };
}

export function ManualAcuityExamination({
  examId,
  config,
  name,
  onComplete,
  onCancel,
}: {
  examId: "distance" | "pinhole" | "near";
  config: ExamConfig;
  name: string;
  onComplete: (observation?: string) => void;
  onCancel: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const movement = useRef({ x: 0, y: 0, used: true });
  const [pose, setPose] = useState<AcuityToolPose>({ x: 0, y: -0.62 });
  const [grabbed, setGrabbed] = useState(false);
  const [asked, setAsked] = useState(false);
  const [dwell, setDwell] = useState(0);
  const [positioned, setPositioned] = useState(false);
  const [nearDistance, setNearDistance] = useState(40);
  const [viewReady, setViewReady] = useState(false);
  const [viewFailed, setViewFailed] = useState(false);
  const [readingStep, setReadingStep] = useState(0);
  const [observation, setObservation] = useState("");
  const [voice, setVoice] = useState(true);
  const done = useRef(false);
  const poseRef = useRef(pose);
  poseRef.current = pose;
  const selectedEye = config.eye === "OS" ? "OS" : "OD";
  const target = acuityTarget(examId, selectedEye);
  const plan = useMemo(() => readingPlan(examId), [examId]);
  const readingComplete = readingStep === plan.beats.length;
  const aligned = isAcuityToolAligned(examId, selectedEye, pose);
  const correctNearDistance = examId !== "near" || Math.abs(nearDistance - 40) <= 2;
  const ready =
    asked && positioned && aligned && correctNearDistance && readingComplete && !!observation && viewReady && !viewFailed;

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);
  useEffect(() => {
    let previous = performance.now();
    const timer = setInterval(() => {
      const now = performance.now();
      const isAligned = viewReady && !viewFailed && !document.hidden && isAcuityToolAligned(examId, selectedEye, poseRef.current);
      setDwell((value) => {
        const next = accumulateAlignedTime(value, isAligned && asked, (now - previous) / 1000);
        if (next >= 0.8) setPositioned(true);
        return next;
      });
      previous = now;
    }, 50);
    return () => clearInterval(timer);
  }, [asked, examId, selectedEye, viewReady, viewFailed]);

  useEffect(() => {
    if (!asked || !positioned || !aligned || !correctNearDistance || readingComplete || viewFailed)
      return;
    const timer = setTimeout(() => {
      const beat = plan.beats[readingStep];
      setReadingStep((step) => step + 1);
      if (voice && "speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(beat.words.replaceAll("…", ","));
        utterance.rate = beat.struggle ? 0.72 : 0.88;
        utterance.pitch = 0.92;
        speechSynthesis.speak(utterance);
      }
    }, readingStep === 0 ? 350 : 650);
    return () => clearTimeout(timer);
  }, [asked, positioned, aligned, correctNearDistance, readingComplete, readingStep, viewFailed, voice, plan]);

  useEffect(
    () => () => {
      if ("speechSynthesis" in window) speechSynthesis.cancel();
    },
    [],
  );

  const updatePointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setPose({
      x: Math.max(-1, Math.min(1, (((event.clientX - bounds.left) / bounds.width) - 0.5) / 0.4)),
      y: Math.max(-1, Math.min(1, (0.5 - (event.clientY - bounds.top) / bounds.height) / 0.4)),
    });
  };
  const prompt =
    examId === "pinhole"
      ? `Align the small hole with Arun's ${eyeName(selectedEye)}.`
      : `Cover Arun's ${selectedEye === "OD" ? "left eye (OS)" : "right eye (OD)"} while testing the ${eyeName(selectedEye)}.`;
  return (
    <dialog
      ref={dialog}
      className="examination-stage acuity-stage"
      aria-labelledby="acuity-title"
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
    >
      <header>
        <div>
          <p className="eyebrow">MANUAL ACUITY EXAMINATION · {selectedEye}</p>
          <h1 id="acuity-title">{name}</h1>
        </div>
        <button className="secondary" onClick={onCancel}>Cancel</button>
      </header>
      <div className="acuity-instructions">
        <p>{prompt} Drag the paddle by its handle and hold it steady.</p>
        <button className="primary" disabled={asked} onClick={() => setAsked(true)}>
          {asked ? "Arun is ready to read" : examId === "near" ? "Ask Arun to read the near card" : "Ask Arun to read the chart"}
        </button>
        {asked && <p className="small">Arun: “Okay, I’ll keep my head still and read what I can.”</p>}
        <label className="voice-toggle">
          <input type="checkbox" checked={voice} onChange={(event) => setVoice(event.target.checked)} />
          Read Arun’s responses aloud
        </label>
      </div>
      <div className="acuity-workspace">
        <div
          className={`eye-viewport acuity-viewport ${grabbed ? "is-grabbed" : ""}`}
          tabIndex={0}
          role="application"
          aria-label={`${examId === "pinhole" ? "Pinhole paddle" : "Plain occluder"}. Drag to position or use arrow keys.`}
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
          onKeyDown={(event) => {
            if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
            event.preventDefault();
            setPose((value) => ({
              x: Math.max(-1, Math.min(1, value.x + (event.key === "ArrowLeft" ? -0.05 : event.key === "ArrowRight" ? 0.05 : 0))),
              y: Math.max(-1, Math.min(1, value.y + (event.key === "ArrowUp" ? 0.05 : event.key === "ArrowDown" ? -0.05 : 0))),
            }));
          }}
        >
          <AcuityViewBoundary onFailure={() => setViewFailed(true)}>
            <Canvas
              dpr={[1, 1.5]}
              camera={{ position: [0, 0.04, 1.24], fov: 43 }}
              fallback={<p className="notice">3D patient view unavailable. This manual examination needs WebGL.</p>}
            >
              <color attach="background" args={["#16262b"]} />
              <ambientLight intensity={1.45} />
              <directionalLight position={[-1, 2, 3]} intensity={1.8} />
              <ViewReady onReady={() => setViewReady(true)} />
              {[-0.2, 0.2].map((x) => (
                <EyeSurface key={x} x={x} pupils={false} motility={false} progress={0} movement={movement} />
              ))}
              <Sign
                text={examId === "near" ? ["NEAR VISION", "N6  N8  N10", "40 cm"] : ["DISTANCE CHART", "E  F  P", "T  O  Z"]}
                p={[0, 0.18, -0.03]}
                size={[0.3, 0.12]}
                bg="#f6f8ee"
                fg="#213638"
              />
            </Canvas>
          </AcuityViewBoundary>
          <div className="acuity-overlay" aria-hidden="true">
            <span
              className={`acuity-guide ${aligned ? "aligned" : ""}`}
              style={{ left: `${50 + target.x * 32}%`, top: `${50 - target.y * 32}%` }}
            />
            <span
              className={`manual-paddle ${examId === "pinhole" ? "pinhole" : "plain"}`}
              style={{ left: `${50 + pose.x * 32}%`, top: `${50 - pose.y * 32}%` }}
            >
              <i />
            </span>
          </div>
          <span className="visual-label">Drag the handle · arrow keys for fine movement</span>
        </div>
        <AcuityChart near={examId === "near"} />
      </div>
      <footer>
        {examId === "near" && (
          <label className="acuity-distance">
            Near-card distance: {nearDistance} cm
            <input aria-label="Near-card distance" type="range" min="25" max="55" value={nearDistance} onChange={(event) => setNearDistance(Number(event.target.value))} />
          </label>
        )}
        {readingStep > 0 && (
          <section className="patient-reading" aria-label="Arun's chart responses" aria-live="polite">
            <p className="eyebrow">ARUN’S RESPONSES</p>
            {plan.beats.slice(0, readingStep).map((beat) => (
              <p key={beat.line} className={beat.struggle ? "struggle" : ""}>
                <b>{beat.line}</b>
                <span>“{beat.words}”</span>
              </p>
            ))}
          </section>
        )}
        {readingComplete && (
          <label className="recorded-acuity">
            Smallest line read correctly
            <select value={observation} onChange={(event) => setObservation(event.target.value)}>
              <option value="">Choose your observation</option>
              {plan.options.map((value) => (
                <option value={value} key={value}>{value}</option>
              ))}
            </select>
          </label>
        )}
        <p role="status">
          {viewFailed
            ? "The patient view is unavailable; this finding cannot be recorded."
            : !asked
            ? "Ask Arun to read before positioning the tool."
            : !aligned
              ? `Move the ${examId === "pinhole" ? "pinhole" : "occluder"} into the guide.`
              : !positioned
                ? "Hold steady…"
                : !correctNearDistance
                  ? "Set the near card to 40 cm."
                  : !readingComplete
                    ? "Listen to Arun and watch where he begins to struggle…"
                    : !observation
                      ? "Record the smallest line Arun read correctly."
                      : `Your observation: ${selectedEye} · ${observation}.`}
        </p>
        <progress value={Math.min(dwell, 0.8)} max={0.8} aria-label="Steady positioning progress" />
        <button
          className="primary full"
          disabled={!ready}
          onClick={() => {
            if (done.current || !ready) return;
            done.current = true;
            onComplete(observation);
          }}
        >
          Record finding & return to room →
        </button>
        <p className="small muted">Practice aid: positioning unlocks the authored case result; it is not a validated clinical technique score.</p>
      </footer>
    </dialog>
  );
}
