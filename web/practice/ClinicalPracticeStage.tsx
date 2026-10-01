import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Check, Crosshair, Eye, Flashlight, Hand, MousePointer2, Power, RotateCcw, X } from "lucide-react";
import { DoubleSide, Quaternion, Vector3 } from "three";
import { EyeSurface } from "../scene/EyeSurface";
import { opticTechniqueChecks, opticViewAligned, type OpticPracticeMode } from "../interaction/opticPractice";
import { PracticeWebGLFallback } from "./PracticeWebGLFallback";

export type OpticScenario = {
  id: string;
  od: [number, number];
  os: [number, number];
  brighter?: "od" | "os";
};

type Aim = { x: number; y: number };

class StageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <PracticeWebGLFallback />
      : this.props.children;
  }
}

function HandModel({ aim }: { aim: Aim }) {
  const skin = "#a97453";
  const x = .72 + aim.x * .06;
  const y = -.78 + aim.y * .04;
  return (
    <group position={[x, y, 1.02]} rotation={[.12, 0, -.22]} scale={.7}>
      <mesh scale={[.115, .17, .075]} castShadow>
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial color={skin} roughness={.88} />
      </mesh>
      {[0, 1, 2, 3].map(index => (
        <mesh key={index} position={[(index - 1.5) * .047, .16 + Math.abs(index - 1.5) * -.012, 0]} rotation={[0, 0, (index - 1.5) * -.035]} castShadow>
          <capsuleGeometry args={[.021, .12 + (1 - Math.abs(index - 1.5) / 3) * .025, 5, 10]} />
          <meshStandardMaterial color={skin} roughness={.9} />
        </mesh>
      ))}
      <mesh position={[-.105, .035, .035]} rotation={[.3, 0, .75]} castShadow>
        <capsuleGeometry args={[.025, .115, 5, 10]} />
        <meshStandardMaterial color={skin} roughness={.9} />
      </mesh>
      <mesh position={[0, -.19, -.015]} scale={[.13, .24, .085]} castShadow>
        <capsuleGeometry args={[1, 1.1, 6, 12]} />
        <meshStandardMaterial color="#385f64" roughness={.8} />
      </mesh>
    </group>
  );
}

function Instrument({ mode, aim, light, distance }: { mode: OpticPracticeMode; aim: Aim; light: boolean; distance: number }) {
  const x = .68 + aim.x * .07;
  const y = -.52 + aim.y * .05;
  const scale = .64 + (distance - (mode === "bruckner" ? 100 : 50)) * .001;
  return (
    <group position={[x, y, 1]} scale={scale} rotation={[0, 0, -.13]}>
      <mesh position={[0, -.14, 0]} castShadow>
        <cylinderGeometry args={[.035, .043, .31, 24]} />
        <meshStandardMaterial color="#202b30" metalness={.45} roughness={.35} />
      </mesh>
      {mode === "bruckner" ? (
        <>
          <mesh position={[0, .075, 0]} castShadow>
            <boxGeometry args={[.13, .14, .065]} />
            <meshStandardMaterial color="#26343a" metalness={.35} roughness={.3} />
          </mesh>
          <mesh position={[-.05, .07, .04]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[.031, .031, .02, 24]} />
            <meshStandardMaterial color="#789295" metalness={.5} roughness={.25} />
          </mesh>
          <mesh position={[.07, .065, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[.034, .034, .025, 24]} />
            <meshStandardMaterial color="#89999a" metalness={.55} roughness={.28} />
          </mesh>
        </>
      ) : (
        <mesh position={[0, .055, 0]} castShadow>
          <cylinderGeometry args={[.025, .035, .1, 24]} />
          <meshStandardMaterial color="#aebcbc" metalness={.62} roughness={.22} />
        </mesh>
      )}
      <mesh position={[0, .12, -.018]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[.018, .018, .018, 20]} />
        <meshStandardMaterial color={light ? "#fff0bd" : "#5a6a6c"} emissive={light ? "#ffc85a" : "#000000"} emissiveIntensity={light ? 4 : 0} />
      </mesh>
    </group>
  );
}

function PatientHead({ mode, scenario, reveal }: { mode: OpticPracticeMode; scenario: OpticScenario; reveal: boolean }) {
  const movement = useRef({ x: 0, y: 0, used: true });
  const blank = useRef({ x: 0, y: 0, z: 1 });
  const reflexPosition = (eye: "od" | "os", position: [number, number]) => {
    const baseX = eye === "od" ? -.22 : .22;
    return [baseX + (position[0] - 50) * .0037, .115 - (position[1] - 50) * .0025, .532] as [number, number, number];
  };
  return (
    <group position={[0, .07, 0]}>
      <mesh scale={[.65, .86, .48]} receiveShadow>
        <sphereGeometry args={[1, 48, 32]} />
        <meshStandardMaterial color="#a97453" roughness={.88} />
      </mesh>
      <mesh position={[0, -.42, .39]} scale={[.34, .12, .12]}>
        <sphereGeometry args={[1, 24, 14]} />
        <meshStandardMaterial color="#734936" roughness={.82} />
      </mesh>
      <mesh position={[0, .17, .44]} scale={[.13, .25, .12]}>
        <sphereGeometry args={[1, 24, 16]} />
        <meshStandardMaterial color="#9b684a" roughness={.9} />
      </mesh>
      <group position={[0, .12, .505]} scale={1.3}>
        {[-.17, .17].map(x => <EyeSurface key={x} x={x} pupils={false} motility={false} progress={0} movement={movement} fixation={blank} reflectionStrength={0} />)}
      </group>
      {reveal && mode === "bruckner" && (["od", "os"] as const).map(eye => {
        const brighter = scenario.brighter === eye;
        const x = eye === "od" ? -.22 : .22;
        return <group key={eye} position={[x, .115, .64]}>
          <mesh renderOrder={3}>
            <circleGeometry args={[.068, 40]} />
            <meshBasicMaterial color={brighter ? "#ffe0aa" : "#e55227"} transparent opacity={brighter ? 1 : .94} side={DoubleSide} depthTest={false} />
          </mesh>
          <mesh position={[0, 0, -.002]} renderOrder={2}>
            <ringGeometry args={[.07, .102, 40]} />
            <meshBasicMaterial color={brighter ? "#ffc56e" : "#f07443"} transparent opacity={brighter ? .5 : .32} side={DoubleSide} depthTest={false} />
          </mesh>
          <pointLight color={brighter ? "#ffcb80" : "#f05b32"} intensity={brighter ? 1.5 : .85} distance={.75} />
        </group>;
      })}
      {reveal && mode === "hirschberg" && (["od", "os"] as const).map(eye => (
        <mesh key={eye} position={reflexPosition(eye, scenario[eye])}>
          <sphereGeometry args={[.014, 18, 12]} />
          <meshBasicMaterial color="#fff8d8" />
          <pointLight color="#ffdfa1" intensity={1.7} distance={.45} />
        </mesh>
      ))}
      <mesh position={[0, -1.02, -.05]} scale={[.82, .42, .44]}>
        <sphereGeometry args={[1, 32, 20]} />
        <meshStandardMaterial color="#567685" roughness={.86} />
      </mesh>
    </group>
  );
}

function LightBeam({ mode, aim, light, distance, largeSpot }: { mode: OpticPracticeMode; aim: Aim; light: boolean; distance: number; largeSpot: boolean }) {
  const source = new Vector3(.68 + aim.x * .07, -.36 + aim.y * .05, .98);
  const target = new Vector3(aim.x * .36, aim.y * .25 + .115, .54);
  const direction = target.clone().sub(source);
  const length = direction.length();
  const midpoint = source.clone().add(target).multiplyScalar(.5);
  const radius = mode === "bruckner" ? (largeSpot ? .37 : .1) * distance / 100 : .085 * distance / 50;
  const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), direction.clone().normalize());
  if (!light) return null;
  return <>
    <mesh position={midpoint} quaternion={quaternion}>
      <coneGeometry args={[radius, length, 32, 1, true]} />
      <meshBasicMaterial color="#ffd36e" transparent opacity={mode === "bruckner" ? .09 : .13} side={DoubleSide} depthWrite={false} />
    </mesh>
    {mode === "bruckner" && <mesh position={[target.x, target.y, .59]} renderOrder={1}>
      <circleGeometry args={[radius, 48]} />
      <meshBasicMaterial color="#ffb95d" transparent opacity={largeSpot ? .13 : .18} side={DoubleSide} depthWrite={false} depthTest={false} />
    </mesh>}
  </>;
}

function PracticeScene(props: {
  mode: OpticPracticeMode;
  scenario: OpticScenario;
  aim: Aim;
  distance: number;
  light: boolean;
  largeSpot: boolean;
  viewOffset: Aim;
  reveal: boolean;
}) {
  useFrame(({ camera }) => {
    camera.position.x += (props.viewOffset.x * .13 - camera.position.x) * .12;
    camera.position.y += ((.04 + props.viewOffset.y * .09) - camera.position.y) * .12;
    camera.lookAt(0, .02, 0);
  });
  return (
    <>
      <color attach="background" args={["#0b171c"]} />
      <ambientLight intensity={1.25} />
      <directionalLight position={[-2, 3, 4]} intensity={2.2} castShadow />
      <pointLight position={[1.8, 1.5, 2]} intensity={1.1} color="#d5edf0" />
      <PatientHead mode={props.mode} scenario={props.scenario} reveal={props.reveal} />
      <LightBeam mode={props.mode} aim={props.aim} light={props.light} distance={props.distance} largeSpot={props.largeSpot} />
      <Instrument mode={props.mode} aim={props.aim} light={props.light} distance={props.distance} />
      <HandModel aim={props.aim} />
    </>
  );
}

export function ClinicalPracticeStage({
  mode,
  scenario,
  onClose,
  onObserved,
  children,
}: {
  mode: OpticPracticeMode;
  scenario: OpticScenario;
  onClose: () => void;
  onObserved: () => void;
  children: (ready: boolean) => ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [aim, setAim] = useState<Aim>({ x: 0, y: 0 });
  const [distance, setDistance] = useState(mode === "bruckner" ? 78 : 38);
  const [light, setLight] = useState(false);
  const [fixation, setFixation] = useState(false);
  const [largeSpot, setLargeSpot] = useState(mode === "hirschberg");
  const [viewOffset, setViewOffset] = useState<Aim>({ x: .62, y: -.48 });
  const [grabbed, setGrabbed] = useState(false);
  const [observed, setObserved] = useState(false);
  const viewAligned = opticViewAligned(viewOffset.x, viewOffset.y);
  useEffect(() => {
    dialog.current?.showModal();
    return () => dialog.current?.close();
  }, []);
  const { targetDistance, distanceReady, aimReady, ready } = opticTechniqueChecks(mode, {
    aimX: aim.x,
    aimY: aim.y,
    distanceCm: distance,
    light,
    fixation,
    largeSpot,
    viewAligned,
  });
  useEffect(() => {
    if (ready && !observed) {
      setObserved(true);
      onObserved();
    }
    if (!ready && observed) setObserved(false);
  }, [ready, observed, onObserved]);
  const updateAim = (x: number, y: number) => setAim({ x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) });
  const updateViewOffset = (x: number, y: number) => setViewOffset({ x: Math.max(-1, Math.min(1, x)), y: Math.max(-1, Math.min(1, y)) });
  const alignViewFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    updateViewOffset(((event.clientX - rect.left) / rect.width - .5) * 2, ((event.clientY - rect.top) / rect.height - .5) * 2);
  };
  const aimFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    updateAim(((event.clientX - rect.left) / rect.width - .5) * 2, (.5 - (event.clientY - rect.top) / rect.height) * 2);
  };
  const reset = () => {
    setAim({ x: 0, y: 0 });
    setDistance(mode === "bruckner" ? 78 : 38);
    setLight(false);
    setFixation(false);
    setLargeSpot(mode === "hirschberg");
    setViewOffset({ x: .62, y: -.48 });
    setObserved(false);
  };
  const prompt = !fixation
    ? "Explain the test and ask the patient to look at the light."
    : !light
      ? `Switch on the ${mode === "bruckner" ? "ophthalmoscope" : "penlight"}.`
      : mode === "bruckner" && !largeSpot
        ? "Use your other hand to select the large illumination spot."
        : !distanceReady
          ? `Move to approximately ${targetDistance} cm.`
          : !aimReady
            ? "Aim the beam at the midpoint between both eyes."
            : !viewAligned
              ? mode === "bruckner" ? "Drag the examiner-view marker into the peephole target." : "Drag the observer marker into the centre target."
              : "Technique aligned. Inspect the reflexes before recording.";
  return (
    <dialog ref={dialog} className="clinical-practice-dialog" aria-labelledby={`${mode}-practice-title`} onCancel={event => { event.preventDefault(); onClose(); }}>
      <header className="clinical-stage-header">
        <div><p className="eyebrow">LIVE PRACTICE · BOTH EYES</p><h1 id={`${mode}-practice-title`}>{mode === "bruckner" ? "Bruckner test" : "Hirschberg test"}</h1></div>
        <div className="clinical-stage-distance"><span>Working distance</span><strong className={distanceReady ? "ready" : ""}>{distance} cm</strong></div>
        <button className="secondary" onClick={onClose}><X size={16} /> Close</button>
      </header>
      <div className="clinical-stage-body">
        <div className="clinical-viewport-wrap">
          <div
            ref={viewport}
            className={`clinical-viewport ${grabbed ? "is-grabbed" : ""}`}
            tabIndex={0}
            role="application"
            aria-label="First-person clinical practice. Drag to aim the instrument, use arrow keys for fine movement, and use Page Up or Page Down to change distance."
            onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); setGrabbed(true); aimFromPointer(event); }}
            onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) aimFromPointer(event); }}
            onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); setGrabbed(false); }}
            onPointerCancel={() => setGrabbed(false)}
            onLostPointerCapture={() => setGrabbed(false)}
            onWheel={event => { event.preventDefault(); setDistance(value => Math.max(mode === "bruckner" ? 60 : 30, Math.min(mode === "bruckner" ? 140 : 70, value + Math.sign(event.deltaY) * 2))); }}
            onKeyDown={event => {
              if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "PageUp", "PageDown", " "].includes(event.key)) event.preventDefault();
              if (event.key === "ArrowLeft") updateAim(aim.x - .06, aim.y);
              if (event.key === "ArrowRight") updateAim(aim.x + .06, aim.y);
              if (event.key === "ArrowUp") updateAim(aim.x, aim.y + .06);
              if (event.key === "ArrowDown") updateAim(aim.x, aim.y - .06);
              if (event.key === "PageUp") setDistance(value => Math.max(mode === "bruckner" ? 60 : 30, value - 2));
              if (event.key === "PageDown") setDistance(value => Math.min(mode === "bruckner" ? 140 : 70, value + 2));
              if (event.key === " ") setLight(value => !value);
            }}
          >
            <StageBoundary>
              <Canvas dpr={[1, 1.5]} shadows camera={{ position: [0, .04, 2.55], fov: 39 }} fallback={<PracticeWebGLFallback />}>
                <PracticeScene mode={mode} scenario={scenario} aim={aim} distance={distance} light={light} largeSpot={largeSpot} viewOffset={viewOffset} reveal={ready} />
              </Canvas>
            </StageBoundary>
            <div className={`beam-reticle ${aimReady ? "aligned" : ""}`} aria-hidden="true"><Crosshair /></div>
            <div className="hand-readout" aria-hidden="true">
              <span><b>R</b>{mode === "bruckner" ? "Hold + aim ophthalmoscope" : "Hold + aim penlight"}</span>
              <span className={mode === "bruckner" && !largeSpot ? "attention" : ""}><b>L</b>{mode === "bruckner" ? (largeSpot ? "Aperture set · hand removed" : "Adjust aperture wheel") : "Resting clear of patient"}</span>
            </div>
            <p className="viewport-controls"><MousePointer2 size={14} /> Drag to aim · wheel changes distance · Space toggles light</p>
          </div>
          <div className={`clinical-coach ${ready ? "ready" : ""}`} role="status">
            <span>{ready ? <Check size={18} /> : <Crosshair size={18} />}</span><p><b>{ready ? "View acquired" : "Next action"}</b>{prompt}</p>
          </div>
        </div>
        <aside className="clinical-control-rail">
          <section><p className="eyebrow">PATIENT</p><button className={fixation ? "task-button done" : "task-button"} onClick={() => setFixation(true)}><Eye size={18} /><span><b>{fixation ? "Fixation instructed" : "Give fixation instruction"}</b><small>{fixation ? "Patient is looking at the light" : "Ask the patient to look directly at the light"}</small></span>{fixation && <Check size={16} />}</button></section>
          <section><p className="eyebrow">RIGHT HAND · INSTRUMENT</p><button className={light ? "task-button active" : "task-button"} onClick={() => setLight(value => !value)}><Power size={18} /><span><b>{light ? "Light on" : "Light off"}</b><small>Spacebar also toggles power</small></span></button><label className="distance-control">Distance · {distance} cm<input type="range" min={mode === "bruckner" ? 60 : 30} max={mode === "bruckner" ? 140 : 70} value={distance} onChange={event => setDistance(Number(event.target.value))} /></label></section>
          <section><p className="eyebrow">LEFT HAND · SETUP</p>{mode === "bruckner" ? <button className={largeSpot ? "task-button done" : "task-button"} onClick={() => setLargeSpot(true)}><Hand size={18} /><span><b>{largeSpot ? "Large spot selected" : "Adjust aperture wheel"}</b><small>{largeSpot ? "Left hand can lower and stay clear" : "Select the large illumination aperture"}</small></span>{largeSpot && <Check size={16} />}</button> : <div className="offhand-note"><Hand size={18} /><span><b>Keep the other hand clear</b><small>No patient contact is needed for this test.</small></span></div>}</section>
          <section><p className="eyebrow">VIEWING POSITION</p><div
            className={`view-alignment-pad ${viewAligned ? "aligned" : ""}`}
            tabIndex={0}
            role="application"
            aria-label={`${mode === "bruckner" ? "Peephole" : "Observer"} alignment pad. Drag the marker to the centre or use the arrow keys.`}
            onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); alignViewFromPointer(event); }}
            onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) alignViewFromPointer(event); }}
            onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
            onPointerCancel={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }}
            onKeyDown={event => {
              if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home"].includes(event.key)) return;
              event.preventDefault();
              if (event.key === "Home") updateViewOffset(0, 0);
              if (event.key === "ArrowLeft") updateViewOffset(viewOffset.x - .08, viewOffset.y);
              if (event.key === "ArrowRight") updateViewOffset(viewOffset.x + .08, viewOffset.y);
              if (event.key === "ArrowUp") updateViewOffset(viewOffset.x, viewOffset.y - .08);
              if (event.key === "ArrowDown") updateViewOffset(viewOffset.x, viewOffset.y + .08);
            }}
          >
            <span className="view-alignment-target" aria-hidden="true"><Eye size={18} /></span>
            <i className="view-alignment-marker" aria-hidden="true" style={{ left: `${(viewOffset.x + 1) * 50}%`, top: `${(viewOffset.y + 1) * 50}%` }} />
          </div><p className={viewAligned ? "view-alignment-status ready" : "view-alignment-status"}>{viewAligned ? <><Check size={14} /> Aligned with the visual axis</> : `Drag the marker into the ${mode === "bruckner" ? "peephole" : "centre"}`}</p></section>
          <section className="clinical-observation"><p className="eyebrow">OBSERVATION</p>{children(ready)}</section>
          <button className="reset-technique" onClick={reset}><RotateCcw size={15} /> Reset technique</button>
        </aside>
      </div>
    </dialog>
  );
}
