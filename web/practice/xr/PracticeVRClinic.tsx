import { Component, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { X } from "lucide-react";
import type { WebGLRenderer } from "three";
import { ConsultationInterior } from "../../scene/Room";
import { Controller } from "../../interaction/Controller";
import type { StationId } from "../../domain/types";
import { PracticeWebGLFallback } from "../PracticeWebGLFallback";
import { usePracticeXRSessionLifetime } from "../../interaction/usePracticeXRSessionLifetime";
import { XRVoiceIndicator } from "../../scene/XRVoiceIndicator";
import { useVoiceStatus } from "../../voice/VoiceStatusContext";
import { PracticeVoiceControl } from "../../voice/PracticeVoiceControl";
import { usePracticeAttempt } from "../PracticeAttemptContext";
import { perfEnabled, perfEvent, perfRender } from "../../perf/perfFlag";
import { PerfFrameProbe } from "../../perf/PerfFrameProbe";
import type { ClinicInputMode } from "../../interaction/useXRClinicRuntime";

class PracticeSceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? <PracticeWebGLFallback /> : this.props.children; }
}
export type PracticeClinicSession = { active: boolean; preview: boolean; inputMode: ClinicInputMode; exit: () => void };

/** Practice session shell around the canonical clinic, independent of any lesson/case. */
export function PracticeVRClinic({ title, findingPosition, onClose, onDesktop, inputMode = "xr", children, mirror }: {
  title: string; findingPosition: { current: number; total: number };
  onClose: () => void; onDesktop?: () => void; inputMode?: ClinicInputMode;
  children: (session: PracticeClinicSession) => ReactNode;
  mirror?: ReactNode;
}) {
  perfRender("PracticeVRClinic");
  const { settings, setAttemptActive } = usePracticeAttempt();
  useEffect(() => { perfEvent(`lesson ${title}`); }, [title]);
  const guided = settings?.kind !== "test";
  const voiceStatus = useVoiceStatus();
  const dialog = useRef<HTMLDialogElement>(null);
  const renderer = useRef<WebGLRenderer | null>(null);
  const { session, mounted, closing, generation } = usePracticeXRSessionLifetime();
  const startingRef = useRef(false);
  const [starting, setStarting] = useState(false);
  const [active, setActive] = useState(inputMode === "desktop");
  const [failed, setFailed] = useState(false);
  const [error, setError] = useState("");
  const [visit, setVisit] = useState<{ id: StationId; seq: number } | null>(null);
  const end = useCallback(async () => {
    if (closing.current) return;
    closing.current = true;
    setAttemptActive?.(false);
    setActive(false);
    const current = session.current; session.current = null;
    try { await current?.end(); } catch { /* already ended by the headset */ }
    finally { if (mounted.current) { setActive(false); onClose(); } }
  }, [onClose, setAttemptActive]);
  useEffect(() => {
    setAttemptActive?.(active);
    return () => setAttemptActive?.(false);
  }, [active, setAttemptActive]);
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement as HTMLElement | null;
    node?.showModal();
    return () => {
      node?.close(); previous?.focus();
    };
  }, []);
  useEffect(() => {
    const canvas = renderer.current?.domElement;
    const lost = (event: Event) => { event.preventDefault(); setAttemptActive?.(false); setActive(false); setFailed(true); void session.current?.end(); };
    canvas?.addEventListener("webglcontextlost", lost);
    return () => canvas?.removeEventListener("webglcontextlost", lost);
  }, [active, setAttemptActive, starting]);
  const enter = async () => {
    if (startingRef.current || session.current || closing.current) return;
    startingRef.current = true; setStarting(true); setError("");
    const attempt = generation.current;
    const current = () => mounted.current && !closing.current && generation.current === attempt;
    let next: XRSession | null = null;
    try {
      if (!navigator.xr) throw new Error("VR is unavailable in this browser. Open this page in your headset browser over HTTPS, or close and choose Keyboard + mouse.");
      if (!renderer.current || failed) throw new Error("The 3D clinic is unavailable. Close and choose Keyboard + mouse.");
      next = await navigator.xr.requestSession("immersive-vr", { requiredFeatures: ["local-floor"] });
      if (!current()) { await next.end(); return; }
      session.current = next;
      next.addEventListener("end", () => {
        if (!current() || session.current !== next) return;
        session.current = null; setAttemptActive?.(false); setActive(false);
      }, { once: true });
      renderer.current.xr.setReferenceSpaceType("local-floor");
      await renderer.current.xr.setSession(next);
      if (!current() || session.current !== next) { await next.end().catch(() => undefined); return; }
      renderer.current.xr.setFoveation(.6); setActive(true);
    } catch (reason) {
      if (next) { if (session.current === next) session.current = null; await next.end().catch(() => undefined); }
      if (current()) setError(reason instanceof Error ? reason.message : "VR could not start. Try again, or close and choose Keyboard + mouse.");
    } finally {
      startingRef.current = false; if (mounted.current) setStarting(false);
    }
  };
  return <dialog ref={dialog} className="clinical-practice-dialog xr-practice-dialog" aria-labelledby="practice-vr-title"
    onCancel={event => { event.preventDefault(); void end(); }}>
    <header className="clinical-stage-header">
      <div>{active && <p className="eyebrow">SHARED CLINIC · {inputMode === "desktop" ? "DESKTOP" : "VR"} · {guided ? "GUIDED PRACTICE" : "TEST"}</p>}<h1 id="practice-vr-title">{title}{active && ` · ${inputMode === "desktop" ? "Desktop" : "VR"}`}</h1></div>
      {active && <div className="clinical-stage-distance"><span>Finding</span><strong>{findingPosition.current}/{findingPosition.total}</strong></div>}
      {active && <PracticeVoiceControl />}
      <button className="secondary" onClick={() => void end()}><X size={16} /> Close</button>
    </header>
    <div className={`xr-practice-body${active ? " xr-practice-body-with-controls" : ""}`}>
      <div className="xr-canvas-wrap">
        <PracticeSceneBoundary onFailure={() => { setAttemptActive?.(false); setActive(false); setFailed(true); void session.current?.end(); }}>
          <Suspense fallback={<PracticeWebGLFallback />}>
            <Canvas shadows={active} frameloop={active ? "always" : "demand"} dpr={[1, 1.35]} camera={{ position: [0, 1.6, 1.65], fov: 66, near: .01, far: 20 }}
              onCreated={({ gl }) => { renderer.current = gl; gl.xr.enabled = true; gl.domElement.tabIndex = 0; gl.domElement.setAttribute("aria-label", "Practice clinic"); }} fallback={<PracticeWebGLFallback />}>
              {active && <>
                {perfEnabled && <PerfFrameProbe />}
                <ConsultationInterior xr={inputMode === "xr"} />
                <XRVoiceIndicator status={voiceStatus} />
                <Controller active={inputMode === "desktop"} clinicControls={inputMode === "desktop"} pointerLock={inputMode === "desktop"} onTarget={() => undefined}
                  onInteract={id => setVisit(previous => ({ id, seq: (previous?.seq ?? 0) + 1 }))} visit={visit} />
                {children({ active: true, preview: false, inputMode, exit: () => void end() })}
              </>}
            </Canvas>
          </Suspense>
        </PracticeSceneBoundary>
        {inputMode === "xr" && !active && <div className="xr-preflight">
          <h2>{title}</h2>
          <button className="primary" disabled={starting || failed} aria-busy={starting} onClick={() => void enter()}>Enter</button>
          {error && <p className="notice" role="alert">{error}</p>}
          {failed && <p className="notice" role="alert">The 3D clinic is unavailable. Close and choose Keyboard + mouse.</p>}
          {(error || failed) && onDesktop && <button className="secondary" onClick={onDesktop}>Use keyboard + mouse</button>}
        </div>}
        {inputMode === "desktop" && active && <p className="viewport-controls">Click clinic to restore controls · Escape releases pointer lock · Tab keeps native navigation</p>}
      </div>
      {active && <aside className="xr-mirror-panel" aria-label="Practice clinic controls">
        {mirror}
        <button className="secondary full" onClick={() => void end()}>Exit clinic</button>
      </aside>}
    </div>
  </dialog>;
}
