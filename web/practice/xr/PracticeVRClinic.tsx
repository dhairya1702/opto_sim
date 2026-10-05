import { Component, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Glasses, X } from "lucide-react";
import type { WebGLRenderer } from "three";
import { ConsultationInterior } from "../../scene/Room";
import { Controller } from "../../interaction/Controller";
import type { StationId } from "../../domain/types";
import { PracticeWebGLFallback } from "../PracticeWebGLFallback";

class PracticeSceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? <PracticeWebGLFallback /> : this.props.children; }
}
export type PracticeClinicSession = { active: boolean; preview: boolean; exit: () => void };

/** Practice session shell around the canonical clinic, independent of any lesson/case. */
export function PracticeVRClinic({ title, findingPosition, onClose, onDesktop, children, mirror }: {
  title: string; findingPosition: { current: number; total: number };
  onClose: () => void; onDesktop: () => void;
  children: (session: PracticeClinicSession) => ReactNode;
  mirror?: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const renderer = useRef<WebGLRenderer | null>(null);
  const session = useRef<XRSession | null>(null);
  const mounted = useRef(true);
  const startingRef = useRef(false);
  const closing = useRef(false);
  const [support, setSupport] = useState<"checking" | "supported" | "unavailable">("checking");
  const [starting, setStarting] = useState(false);
  const [active, setActive] = useState(false);
  const [preview, setPreview] = useState(false);
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState("");
  const [visit, setVisit] = useState<{ id: StationId; seq: number } | null>(null);
  const end = useCallback(async () => {
    if (closing.current) return;
    closing.current = true;
    const current = session.current; session.current = null;
    try { await current?.end(); } catch { /* already ended by the headset */ }
    finally { if (mounted.current) { setActive(false); onClose(); } }
  }, [onClose]);
  useEffect(() => {
    mounted.current = true;
    const node = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    node?.showModal();
    return () => {
      mounted.current = false; closing.current = true;
      const current = session.current; session.current = null;
      void current?.end().catch(() => undefined);
      node?.close(); previous?.focus();
    };
  }, []);
  useEffect(() => {
    let cancelled = false;
    void navigator.xr?.isSessionSupported("immersive-vr").then(available => {
      if (!cancelled) setSupport(available ? "supported" : "unavailable");
    }).catch(() => { if (!cancelled) setSupport("unavailable"); });
    if (!navigator.xr) setSupport("unavailable");
    return () => { cancelled = true; };
  }, []);
  useEffect(() => {
    const canvas = renderer.current?.domElement;
    const lost = (event: Event) => { event.preventDefault(); setFailed(true); void session.current?.end(); };
    canvas?.addEventListener("webglcontextlost", lost);
    return () => canvas?.removeEventListener("webglcontextlost", lost);
  }, [active, preview, starting]);
  const enter = async () => {
    if (startingRef.current || session.current || closing.current) return;
    startingRef.current = true; setStarting(true); setError(""); setPreview(false);
    let next: XRSession | null = null;
    try {
      if (!navigator.xr || !renderer.current || failed) throw new Error("The VR renderer is unavailable. Use the desktop clinical view.");
      next = await navigator.xr.requestSession("immersive-vr", { requiredFeatures: ["local-floor"] });
      if (!mounted.current || closing.current) { await next.end(); return; }
      session.current = next;
      next.addEventListener("end", () => {
        if (!mounted.current || session.current !== next) return;
        session.current = null; setActive(false);
      }, { once: true });
      renderer.current.xr.setReferenceSpaceType("local-floor");
      await renderer.current.xr.setSession(next);
      if (!mounted.current || closing.current || session.current !== next) { await next.end().catch(() => undefined); return; }
      renderer.current.xr.setFoveation(.6); setActive(true);
    } catch (reason) {
      if (next) { if (session.current === next) session.current = null; await next.end().catch(() => undefined); }
      if (mounted.current) setError(reason instanceof Error ? reason.message : "VR could not start. Try again or use the desktop clinical view.");
    } finally {
      startingRef.current = false; if (mounted.current) setStarting(false);
    }
  };
  return <dialog ref={dialog} className="clinical-practice-dialog xr-practice-dialog" aria-labelledby="practice-vr-title"
    onCancel={event => { event.preventDefault(); void end(); }}>
    <header className="clinical-stage-header">
      <div><p className="eyebrow">SHARED VR CLINIC · PRACTICE</p><h1 id="practice-vr-title">{title} · VR</h1></div>
      <div className="clinical-stage-distance"><span>Finding</span><strong>{findingPosition.current}/{findingPosition.total}</strong></div>
      <button className="secondary" onClick={() => void end()}><X size={16} /> Close</button>
    </header>
    <div className="xr-practice-body">
      <div className="xr-canvas-wrap">
        <PracticeSceneBoundary onFailure={() => { setFailed(true); void session.current?.end(); }}>
          <Suspense fallback={<PracticeWebGLFallback />}>
            <Canvas shadows dpr={[1, 1.35]} camera={{ position: [0, 1.6, 1.65], fov: 66, near: .01, far: 20 }}
              onCreated={({ gl }) => { renderer.current = gl; gl.xr.enabled = true; gl.domElement.tabIndex = 0; gl.domElement.setAttribute("aria-label", "Practice clinic layout; drag to look and use WASD to move in preview"); }} fallback={<PracticeWebGLFallback />}>
              <ConsultationInterior xr />
              <Controller active={preview && !active} onTarget={() => undefined}
                onInteract={id => setVisit(previous => ({ id, seq: (previous?.seq ?? 0) + 1 }))} visit={visit} />
              {children({ active, preview, exit: () => void end() })}
            </Canvas>
          </Suspense>
        </PracticeSceneBoundary>
        {!active && !preview && <div className="xr-preflight">
          <Glasses size={34} />
          <div><p className="eyebrow">THE SAME CLINIC AS CONSULTATION</p><h2>{title} in the shared VR clinic</h2>
            <p>Identify the instrument, hold its side grip to carry it, and use the trigger. Lesson help and recording are available inside the clinic.</p></div>
          <div className="xr-preflight-actions">
            <button className="primary" disabled={support !== "supported" || starting || failed} onClick={() => void enter()}>{starting ? "Starting VR…" : support === "checking" ? "Checking headset…" : support === "supported" ? "Enter VR" : "VR headset unavailable"} <Glasses size={17} /></button>
            <button className="secondary" disabled={failed} onClick={() => setPreview(true)}>Preview clinic layout</button>
            <button className="secondary" onClick={onDesktop}>Desktop clinical view</button>
          </div>
          <p className="small">Use Quest Browser over HTTPS. The layout preview does not emulate tracked hands or record Practice completion.</p>
          {error && <p className="notice" role="alert">{error}</p>}
          {failed && <p className="notice" role="alert">The 3D clinic is unavailable. Continue with the desktop clinical view.</p>}
        </div>}
        {preview && <p className="viewport-controls">Clinic layout preview · WASD + mouse · E / click to visit stations · tracked tools require a headset</p>}
      </div>
      {(active || preview) && <aside className="xr-mirror-panel" aria-label="Practice clinic controls">
        {preview ? <><p className="eyebrow">CLINIC LAYOUT PREVIEW</p><p>Inspect the shared clinic. Use the desktop clinical view for a mouse/keyboard attempt.</p>
          <div className="xr-station-controls"><button onClick={() => setVisit(previous => ({ id: "trolley", seq: (previous?.seq ?? 0) + 1 }))}>Instrument trolley</button><button onClick={() => setVisit(previous => ({ id: "patient", seq: (previous?.seq ?? 0) + 1 }))}>Patient</button></div>
          <button className="primary full" disabled={support !== "supported" || starting || failed} onClick={() => void enter()}>Enter VR</button>
          <button className="secondary full" onClick={onDesktop}>Desktop clinical view</button></> : mirror}
        <button className="secondary full" onClick={() => void end()}>Exit VR / close lesson</button>
      </aside>}
    </div>
  </dialog>;
}
