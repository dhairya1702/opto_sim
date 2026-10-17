/**
 * Opt-in developer performance probe (lazy-loaded only with `?perf=1`).
 * Sends one numeric report per second to the same-origin `/api/perf`
 * endpoint, which only exists when the server runs with PERF_LOG=1.
 * No learner input, case data, findings, audio, or identifiers are sent.
 */
import type { WebGLRenderer } from "three";
import { setPerfSink, type PerfSink } from "./perfFlag";
import { FrameWindow, SessionAggregate, topEntries, type PerfSecondReport, type PerfSummaryReport } from "./perfStats";

const ENDPOINT = "/api/perf";
const MAX_EVENTS = 10;
const cleanName = (name: string) => name.replace(/[^\w .:#/-]/g, "").slice(0, 48);

export function startPerfProbe() {
  const sid = Math.random().toString(36).slice(2, 6);
  const startedAt = performance.now();
  const frames = new FrameWindow();
  const counters = new Map<string, number>();
  const renders = new Map<string, number>();
  let events: string[] = [];
  let longTasks = 0;
  let longMs = 0;
  let frameStartAt: number | null = null;
  let lastFrameStart: number | null = null;
  let windowStart = performance.now();
  let renderer: WebGLRenderer | null = null;
  let info = { draws: 0, tris: 0 };
  let presenting = false;
  let sending = true;
  const page = new SessionAggregate("page");
  let vr: SessionAggregate | null = null;

  const pushEvent = (name: string) => { if (events.length < MAX_EVENTS) events.push(cleanName(name)); };

  const sink: PerfSink = {
    count(name, amount = 1) { counters.set(name, (counters.get(name) ?? 0) + amount); },
    render(component) { renders.set(component, (renders.get(component) ?? 0) + 1); },
    event: pushEvent,
    frameStart(now) { frameStartAt = now; },
    frameEnd(now, renderMs, gl) {
      renderer = gl;
      const start = frameStartAt ?? now - renderMs;
      const delta = lastFrameStart === null ? null : start - lastFrameStart;
      lastFrameStart = start;
      frameStartAt = null;
      frames.push(delta, now - start, renderMs);
      info = { draws: gl.info.render.calls, tris: gl.info.render.triangles };
    },
  };
  setPerfSink(sink);

  let observer: PerformanceObserver | null = null;
  try {
    observer = new PerformanceObserver(list => {
      for (const entry of list.getEntries()) { longTasks += 1; longMs += entry.duration; }
    });
    observer.observe({ type: "longtask", buffered: false });
  } catch { observer = null; /* longtask timing unsupported */ }

  const send = (report: PerfSecondReport | PerfSummaryReport, beacon = false) => {
    if (!sending) return;
    const body = JSON.stringify(report);
    if (beacon && navigator.sendBeacon) {
      navigator.sendBeacon(ENDPOINT, new Blob([body], { type: "application/json" }));
      return;
    }
    void fetch(ENDPOINT, { method: "POST", headers: { "content-type": "application/json" }, body, keepalive: true })
      .then(response => {
        if (response.status === 404) {
          sending = false;
          console.info("[perf] Server logging is off. Restart the server with PERF_LOG=1 to receive reports.");
        }
      })
      .catch(() => undefined);
  };

  const tick = () => {
    const now = performance.now();
    const isPresenting = Boolean(renderer?.xr.isPresenting);
    if (isPresenting !== presenting) {
      presenting = isPresenting;
      pushEvent(isPresenting ? "vr enter" : "vr exit");
      if (isPresenting) vr = new SessionAggregate("vr");
    }
    const xrRate = isPresenting ? renderer?.xr.getSession()?.frameRate ?? null : null;
    const stats = frames.summarize(now - windowStart, xrRate);
    const memory = renderer?.info.memory;
    const report: PerfSecondReport = {
      kind: "second", sid, t: Math.round((now - startedAt) / 1000),
      mode: isPresenting ? "xr" : "desktop",
      ...stats,
      longTasks, longMs: Math.round(longMs),
      draws: info.draws, tris: info.tris,
      geometries: memory?.geometries ?? 0, textures: memory?.textures ?? 0,
      programs: renderer?.info.programs?.length ?? 0,
      renders: topEntries(renders, 8), counters: topEntries(counters, 8), events,
    };
    frames.reset(); renders.clear(); counters.clear(); events = []; longTasks = 0; longMs = 0; windowStart = now;
    if (report.frames || report.events.length) {
      page.add(report);
      vr?.add(report);
      send(report);
    }
    if (!isPresenting && vr) {
      if (!vr.empty) send(vr.summary(sid));
      vr = null;
    }
  };
  const interval = window.setInterval(tick, 1000);

  const finish = () => {
    if (vr && !vr.empty) send(vr.summary(sid), true);
    if (!page.empty) send(page.summary(sid), true);
    vr = null;
  };
  window.addEventListener("pagehide", finish, { once: true });
  console.info(`[perf] Probe ${sid} running; reports go to ${ENDPOINT} once per second.`);

  return () => {
    window.clearInterval(interval);
    window.removeEventListener("pagehide", finish);
    observer?.disconnect();
    setPerfSink(null);
  };
}
