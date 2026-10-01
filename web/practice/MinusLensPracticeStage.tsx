import { useEffect, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Canvas } from "./PracticeWebGLFallback";
import type { Group } from "three";
import { EyeSurface } from "../scene/EyeSurface";
import { canRecordMinusLens, minusLensAmplitude, minusLensBlurPower, minusLensResponseMs, nextMinusLens, type MinusEye } from "../interaction/minusLens";

export function LensScene({ eye, power, pending, correction, occluded, onInsert, binocular = false }: { eye: MinusEye; power: number; pending: boolean; correction: boolean; occluded: boolean; onInsert: () => void; binocular?: boolean }) {
  const movement = useRef({ x: 0, y: 0, used: true });
  const hand = useRef<Group>(null);
  const eyeX = binocular ? 0 : eye === "OD" ? -0.22 : 0.22;
  useFrame((_, delta) => {
    if (!hand.current) return;
    const blend = 1 - Math.exp(-Math.min(delta, 0.1) * 8);
    hand.current.position.x += ((pending ? eyeX : 0.52) - hand.current.position.x) * blend;
    hand.current.position.y += ((pending ? 0.2 : -0.45) - hand.current.position.y) * blend;
  });
  return <>
    <color attach="background" args={["#09161b"]} /><ambientLight intensity={1.4} /><directionalLight position={[-2, 3, 4]} intensity={2} />
    <mesh scale={[0.64, 0.85, 0.48]}><sphereGeometry args={[1, 40, 28]} /><meshStandardMaterial color="#a97453" /></mesh>
    <group position={[0, 0.2, 0.51]} scale={1.3}>
      <EyeSurface x={-0.17} pupils={false} motility={false} progress={0} movement={movement} />
      <EyeSurface x={0.17} pupils={false} motility={false} progress={0} movement={movement} />
    </group>
    {correction && <group position={[0, 0.2, 0.66]}>{[-0.22, 0.22].map(x => <mesh key={x} position={[x, 0, 0]}><torusGeometry args={[0.16, 0.017, 12, 40]} /><meshStandardMaterial color="#293b43" /></mesh>)}<mesh><boxGeometry args={[0.13, 0.02, 0.03]} /><meshStandardMaterial color="#293b43" /></mesh></group>}
    {occluded && <mesh position={[-eyeX, 0.2, 0.69]}><circleGeometry args={[0.15, 32]} /><meshStandardMaterial color="#17262b" /></mesh>}
    {power !== 0 && (binocular ? [-0.22, 0.22] : [eyeX]).map(x => <mesh key={x} position={[x, 0.2, 0.7]}><circleGeometry args={[0.14, 32]} /><meshPhysicalMaterial color="#b6e5de" transparent opacity={0.18} /></mesh>)}
    <group ref={hand} position={[0.52, -0.45, 0.88]} onClick={event => { event.stopPropagation(); onInsert(); }}>
      {(binocular ? [-0.22, 0.22] : [0]).map(x => <group key={x} position={[x, 0, 0]}><mesh><torusGeometry args={[0.14, 0.018, 12, 36]} /><meshStandardMaterial color={power > 0 ? "#418eac" : "#bf5365"} /></mesh><mesh><circleGeometry args={[0.135, 32]} /><meshPhysicalMaterial color="#cbe8e4" transparent opacity={0.3} /></mesh></group>)}
      {binocular && <mesh><boxGeometry args={[0.17, 0.025, 0.03]} /><meshStandardMaterial color="#293b43" /></mesh>}
      <mesh position={[0, -0.2, 0]}><boxGeometry args={[0.025, 0.17, 0.03]} /><meshStandardMaterial color="#bf5365" /></mesh>
      <mesh position={[0.04, -0.36, 0]} scale={[0.1, 0.16, 0.065]}><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color="#a97453" /></mesh>
    </group>
    <group position={[-0.42, -0.52, 0.91]}>
      <mesh><boxGeometry args={[0.5, 0.28, 0.025]} /><meshStandardMaterial color="#f5f0df" /></mesh>
      {[-0.12, 0, 0.12].map(x => <group key={x} position={[x, 0, 0.02]}><mesh position={[-0.03, 0, 0]}><boxGeometry args={[0.012, 0.1, 0.004]} /><meshBasicMaterial color="#213938" /></mesh>{[-0.045, 0, 0.045].map(y => <mesh key={y} position={[0, y, 0]}><boxGeometry args={[0.065, 0.012, 0.004]} /><meshBasicMaterial color="#213938" /></mesh>)}</group>)}
      <mesh position={[0, -0.24, 0]} scale={[0.1, 0.16, 0.065]}><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color="#a97453" /></mesh>
    </group>
  </>;
}

export function MinusLensPracticeStage({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [eye, setEye] = useState<MinusEye>("OD");
  const [correction, setCorrection] = useState(false);
  const [occluded, setOccluded] = useState(false);
  const [fixated, setFixated] = useState(false);
  const [power, setPower] = useState(0);
  const [pending, setPending] = useState(false);
  const [results, setResults] = useState<Partial<Record<MinusEye, number>>>({});
  const changeLock = useRef(false);
  const ready = correction && occluded && fixated;
  const done = results.OD !== undefined && results.OS !== undefined;
  const blur = power === minusLensBlurPower && !pending;
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  useEffect(() => {
    if (!pending) return;
    const timer = window.setTimeout(() => { changeLock.current = false; setPending(false); }, minusLensResponseMs);
    return () => window.clearTimeout(timer);
  }, [pending, power]);
  function changeLens(direction: "add" | "remove") {
    if (!ready || done || pending || changeLock.current) return;
    const next = nextMinusLens(power, direction);
    if (next === power) return;
    changeLock.current = true;
    setPower(next);
    setPending(true);
  }
  function resetRun() {
    changeLock.current = false;
    setPending(false); setPower(0); setOccluded(false); setFixated(false);
  }
  function record() {
    if (done || !canRecordMinusLens(power, !pending, ready)) return;
    const next = { ...results, [eye]: minusLensAmplitude(power) };
    setResults(next);
    if (next.OD !== undefined && next.OS !== undefined) onComplete();
    else { setEye("OS"); resetRun(); }
  }
  return <dialog ref={dialog} className="clinical-practice-dialog" aria-labelledby="minus-lens-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="clinical-stage-header"><div><p className="eyebrow">LIVE PRACTICE · ACCOMMODATION</p><h1 id="minus-lens-title">Amplitude · minus lens</h1></div><div className="clinical-stage-distance"><span>Near target</span><strong>40 cm · {eye}</strong></div><button className="secondary" onClick={onClose}>Close</button></header>
    <div className="clinical-stage-body"><div className="clinical-viewport-wrap">
      <div className="clinical-viewport" tabIndex={0} aria-label="Minus lens examination. Click the red trial lens or press minus to insert the next lens. Press plus to remove one step." onKeyDown={event => { if (event.repeat || !["-", "+", "="].includes(event.key)) return; event.preventDefault(); changeLens(event.key === "-" ? "add" : "remove"); }}>
        <Canvas dpr={[1, 1.5]} camera={{ position: [0, 0, 2.5], fov: 40 }}><LensScene eye={eye} power={power} pending={pending} correction={correction} occluded={occluded} onInsert={() => changeLens("add")} /></Canvas>
        <div className="facility-hud"><span>ADDED OVER DISTANCE RX</span><strong>{power.toFixed(2)} D · {eye}</strong><small>{pending ? "Patient attempting to clear…" : "Click red lens to add −0.25 D"}</small></div>
        <div className="hand-readout"><span><b>R</b>Replace trial lens · −0.25 D steps</span><span><b>L</b>Hold target at 40 cm · fellow eye occluded in frame</span></div>
      </div>
      <div className={`clinical-coach ${blur && ready ? "ready" : ""}`} role="status"><p><b>Patient response</b>{done ? "Both monocular amplitudes recorded." : !ready ? "Fit distance correction, occlude the fellow eye, and establish fixation." : pending ? "Give me a moment to bring the letters into focus…" : blur ? "The letters stay blurred. I cannot make them clear." : "The letters are clear."}</p></div>
    </div><aside className="clinical-control-rail">
      <section><p className="eyebrow">SETUP · {eye}</p><button className={`task-button ${correction ? "done" : ""}`} onClick={() => setCorrection(true)} disabled={done}>Fit distance correction</button><button className={`task-button ${occluded ? "done" : ""}`} onClick={() => setOccluded(true)} disabled={!correction || done}>Occlude {eye === "OD" ? "OS" : "OD"} in trial frame</button><button className={`task-button ${fixated ? "done" : ""}`} onClick={() => setFixated(true)} disabled={!occluded || done}>Present appropriate near line at 40 cm</button></section>
      <section><p>Click the red trial lens to insert the next power. Wait for the patient’s response after each −0.25 D step.</p><button className="primary full" disabled={!ready || pending || blur || done} onClick={() => changeLens("add")}>Insert next lens · {(power - 0.25).toFixed(2)} D</button><button className="secondary full" disabled={!ready || pending || power === 0 || done} onClick={() => changeLens("remove")}>Remove −0.25 D</button><p className="neutral-message">Target stays at 40 cm. The examiner’s card remains sharp; blur is reported by the patient.</p><button className="primary full" disabled={done || !canRecordMinusLens(power, !pending, ready)} onClick={record}>Record {eye}: {Math.abs(power).toFixed(2)} + 2.50 = {minusLensAmplitude(power).toFixed(2)} D</button></section>
      <section aria-live="polite">{(["OD", "OS"] as const).map(value => <p key={value}>{value}: {results[value] === undefined ? "Not recorded" : `${results[value]?.toFixed(2)} D`}</p>)}{done && <p className="neutral-message success">Practice complete · both eyes tested.</p>}</section>
      {!done && <button className="reset-technique" onClick={resetRun}>Reset current eye</button>}
    </aside></div>
  </dialog>;
}
