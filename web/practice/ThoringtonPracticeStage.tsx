import { useEffect, useRef, useState } from "react";
import { thoringtonDirection, thoringtonCoordinate, thoringtonDistanceReady, thoringtonLightAligned } from "../interaction/thorington";

export function ThoringtonPracticeStage({ onClose, onComplete }: { onClose: () => void; onComplete: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [correction, setCorrection] = useState(false);
  const [rod, setRod] = useState(false);
  const [angle, setAngle] = useState(90);
  const [axis, setAxis] = useState<"horizontal" | "vertical">("horizontal");
  const [distance, setDistance] = useState(32);
  const [light, setLight] = useState(false);
  const [aim, setAim] = useState({ x: 0.3, y: 0.2 });
  const [asked, setAsked] = useState(false);
  const [magnitude, setMagnitude] = useState("");
  const [direction, setDirection] = useState("");
  const [feedback, setFeedback] = useState("");
  const [results, setResults] = useState<Partial<Record<"horizontal" | "vertical", string>>>({});
  const [caseIndex, setCaseIndex] = useState(0);
  const ready = correction && rod && thoringtonDistanceReady(distance) && light && thoringtonLightAligned(aim.x, aim.y) && angle === (axis === "horizontal" ? 0 : 90);
  const cardScale = 1.18 - ((distance - 25) / 35) * 0.38;
  const coordinate = thoringtonCoordinate(axis, caseIndex);
  const expected = thoringtonDirection(axis, coordinate);
  const complete = Boolean(results.horizontal && results.vertical);
  useEffect(() => { const node = dialog.current; node?.showModal(); return () => node?.close(); }, []);
  function invalidate() { setAsked(false); setMagnitude(""); setDirection(""); setFeedback(""); }
  function moveDistance(value: number) { setDistance(Math.max(25, Math.min(60, Math.round(value)))); invalidate(); }
  function move(x: number, y: number) { setAim({ x: Math.max(-0.9, Math.min(0.9, x)), y: Math.max(-0.9, Math.min(0.9, y)) }); invalidate(); }
  function pointer(event: React.PointerEvent<SVGSVGElement>) {
    const point = event.currentTarget.createSVGPoint(); point.x = event.clientX; point.y = event.clientY;
    const matrix = event.currentTarget.getScreenCTM();
    if (!matrix) return;
    const local = point.matrixTransform(matrix.inverse()); move(local.x / 180, -local.y / 180);
  }
  function record() {
    if (!ready || !asked || results[axis]) return;
    if (Number(magnitude) !== Math.abs(coordinate) || direction !== expected) { setFeedback("Read the number intersected by the streak, then check its side relative to the central light."); return; }
    const next = { ...results, [axis]: `${magnitude}Δ ${direction}` }; setResults(next);
    setFeedback("Measurement recorded.");
    if (next.horizontal && next.vertical) onComplete();
    else { setAxis("vertical"); invalidate(); }
  }
  return <dialog ref={dialog} className="clinical-practice-dialog" aria-labelledby="thorington-title" onCancel={event => { event.preventDefault(); onClose(); }}>
    <header className="clinical-stage-header"><div><p className="eyebrow">LIVE PRACTICE · LATENT DEVIATION</p><h1 id="thorington-title">Modified Thorington</h1></div><div className="clinical-stage-distance"><span>Card distance</span><strong>{distance} cm · {axis}</strong></div><button className="secondary" onClick={onClose}>Close</button></header>
    <div className="clinical-stage-body"><div className="clinical-viewport-wrap">
      <div className="clinical-viewport" style={{ display: "grid", placeItems: "center", padding: 24 }}>
        <svg viewBox="-230 -230 460 460" style={{ width: "100%", maxHeight: "65vh", touchAction: "none", transform: `scale(${cardScale})` }} tabIndex={0} role="application" aria-label="Thorington card alignment. Drag the light to the centre hole. Arrow keys adjust alignment. Use the wheel or plus and minus keys to change card distance." onPointerDown={event => { if (event.button !== 0) return; event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); pointer(event); }} onPointerMove={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) pointer(event); }} onPointerUp={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onPointerCancel={event => { if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); }} onLostPointerCapture={() => invalidate()} onWheel={event => { event.preventDefault(); moveDistance(distance + event.deltaY / 25); }} onKeyDown={event => { if (event.key === "+" || event.key === "=") { event.preventDefault(); moveDistance(distance - 1); return; } if (event.key === "-" || event.key === "_") { event.preventDefault(); moveDistance(distance + 1); return; } if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return; event.preventDefault(); move(aim.x + (event.key === "ArrowRight" ? 0.02 : event.key === "ArrowLeft" ? -0.02 : 0), aim.y + (event.key === "ArrowUp" ? 0.02 : event.key === "ArrowDown" ? -0.02 : 0)); }}>
          <rect x="-220" y="-220" width="440" height="440" rx="10" fill="#f0eddd" />
          <text x="0" y="-192" textAnchor="middle" fontSize="14" fill="#294a44">{asked && ready ? "PATIENT VIEW · ILLUSTRATED" : "ALIGN LIGHT THROUGH CENTRAL HOLE"}</text>
          <line x1="-180" x2="180" y1="0" y2="0" stroke="#55736a" /><line x1="0" x2="0" y1="-180" y2="180" stroke="#55736a" />
          {Array.from({ length: 21 }, (_, index) => index - 10).filter(n => n !== 0).map(n => <g key={n}>{axis === "horizontal" ? <><line x1={n * 16} x2={n * 16} y1="-7" y2="7" stroke="#294a44" /><text x={n * 16} y="26" textAnchor="middle" fontSize="12" fill="#294a44">{Math.abs(n)}</text></> : <><line x1="-7" x2="7" y1={-n * 16} y2={-n * 16} stroke="#294a44" /><text x="24" y={-n * 16 + 4} textAnchor="middle" fontSize="12" fill="#294a44">{Math.abs(n)}</text></>}</g>)}
          <circle r="9" fill="#071519" />
          {light && <circle cx={aim.x * 180} cy={-aim.y * 180} r="6" fill="#ffcd64" stroke="#ad721f" />}
          {asked && ready && (axis === "horizontal" ? <line x1={coordinate * 16} x2={coordinate * 16} y1="-170" y2="170" stroke="#d63542" strokeWidth="3" /> : <line x1="-170" x2="170" y1={-coordinate * 16} y2={-coordinate * 16} stroke="#d63542" strokeWidth="3" />)}
          <text x="0" y="205" textAnchor="middle" fontSize="12" fill="#294a44">Patient-view orientation · numerical scale applies at 40 cm</text>
        </svg><div className="viewport-controls">Card size follows distance · wheel or +/− changes distance</div>
      </div><div className="clinical-coach" role="status"><p><b>Patient response</b>{!thoringtonDistanceReady(distance) ? `The card visibly changes size, but ${distance} cm is outside the 38–42 cm teaching range.` : asked && ready ? `The streak crosses ${Math.abs(coordinate)}, ${axis === "horizontal" ? coordinate > 0 ? "right" : "left" : coordinate > 0 ? "above" : "below"} of the light.` : "Complete setup, align the light, then ask the patient to read the card."}</p></div>
    </div><aside className="clinical-control-rail">
      <section><button className={`task-button ${correction ? "done" : ""}`} onClick={() => setCorrection(true)}>Fit usual near correction</button><button className={`task-button ${rod ? "done" : ""}`} disabled={!correction} onClick={() => setRod(true)}>Seat Maddox rod before OD</button><button className="secondary full" onClick={() => { setAngle(value => value === 0 ? 90 : 0); invalidate(); }}>Rotate rod · {angle === 0 ? "horizontal" : "vertical"} grooves</button><p>{axis === "horizontal" ? "Use horizontal grooves for a vertical streak." : "Use vertical grooves for a horizontal streak."}</p><label className="distance-control">Card distance · {distance} cm<input type="range" min="25" max="60" value={distance} onChange={event => moveDistance(+event.target.value)} /></label><button className="secondary full" onClick={() => { setLight(value => !value); invalidate(); }}>{light ? "Switch penlight off" : "Switch penlight on"}</button><button className="secondary full" onClick={() => move(0, 0)}>Centre light through hole</button><p>Drag the light on the card or use arrow keys. Use the wheel or +/− for distance. One hand holds the card; the other aims the penlight.</p></section>
      <section><button className="primary full" disabled={!ready || !!results[axis]} onClick={() => setAsked(true)}>Ask number and streak position</button><p className="small">The display is an enlarged teaching diagram, not a physically calibrated test card.</p></section>
      <section className="clinical-observation"><label>Magnitude (Δ)<input type="number" min="0" max="10" disabled={!asked || !ready || !!results[axis]} value={magnitude} onChange={event => setMagnitude(event.target.value)} /></label><label>Direction<select disabled={!asked || !ready || !!results[axis]} value={direction} onChange={event => setDirection(event.target.value)}><option value="">Choose</option>{["orthophoria", "esophoria", "exophoria", "left-hyperphoria", "right-hyperphoria"].map(value => <option key={value}>{value}</option>)}</select></label><button className="primary full" disabled={!ready || !asked || !magnitude || !direction || !!results[axis]} onClick={record}>Record {axis} phoria</button><p role="status">{feedback}</p>{Object.entries(results).map(([key, value]) => <p key={key}>{key}: {value}</p>)}{complete && <p className="neutral-message success">Both axes recorded.</p>}<button className="reset-technique" onClick={() => { setCaseIndex(value => value + 1); setResults({}); setAxis("horizontal"); setAngle(90); setDistance(32); setAim({ x: 0.3, y: 0.2 }); invalidate(); }}>New patient pattern</button></section>
    </aside></div>
  </dialog>;
}
