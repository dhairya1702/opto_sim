/**
 * Pure frame-timing statistics for the opt-in developer performance logger.
 * No DOM, renderer, or network access: the probe feeds samples and sends the
 * resulting numeric reports. Reports never contain learner, case, or finding data.
 */

export type PerfMode = "xr" | "desktop";

export type PerfSecondReport = {
  kind: "second";
  sid: string;
  /** Seconds since the page probe started. */
  t: number;
  mode: PerfMode;
  hz: number;
  frames: number;
  fps: number;
  dropped: number;
  p50: number;
  p95: number;
  max: number;
  /** Average JS time per frame inside the render loop (useFrame callbacks + render submission). */
  js: number;
  jsMax: number;
  /** Average time inside renderer.render (CPU-side draw submission). */
  render: number;
  longTasks: number;
  longMs: number;
  draws: number;
  tris: number;
  geometries: number;
  textures: number;
  programs: number;
  renders: [string, number][];
  counters: [string, number][];
  events: string[];
};

export type PerfSummaryReport = {
  kind: "summary";
  sid: string;
  scope: "vr" | "page";
  duration: number;
  frames: number;
  avgFps: number;
  dropped: number;
  droppedPct: number;
  longTasks: number;
  longMs: number;
  worst: { t: number; fps: number; dropped: number; events: string[] } | null;
  renders: [string, number][];
  textures: [number, number];
  geometries: [number, number];
  programs: [number, number];
};

export const round1 = (value: number) => Math.round(value * 10) / 10;

/** Nearest-rank percentile of an ascending array; 0 for an empty sample. */
export function percentile(sorted: readonly number[], p: number): number {
  if (!sorted.length) return 0;
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[rank];
}

/**
 * Expected frame interval. Prefer the XR session's declared refresh rate;
 * otherwise use the median observed interval (desktop monitors vary).
 */
export function expectedIntervalMs(deltas: readonly number[], xrFrameRate?: number | null): number {
  if (xrFrameRate && Number.isFinite(xrFrameRate) && xrFrameRate > 0) return 1000 / xrFrameRate;
  if (!deltas.length) return 1000 / 60;
  const median = percentile([...deltas].sort((a, b) => a - b), 50);
  return Math.min(1000 / 30, Math.max(1000 / 240, median));
}

/**
 * Frames missed between rendered frames. A gap of ~2× the budget means one
 * missed display refresh (the headset reprojected the previous frame).
 */
export function droppedFrames(deltas: readonly number[], expectedMs: number): number {
  let dropped = 0;
  for (const delta of deltas) {
    if (delta > expectedMs * 1.5) dropped += Math.max(1, Math.round(delta / expectedMs) - 1);
  }
  return dropped;
}

/** Top-N entries of a count map, descending. */
export function topEntries(counts: ReadonlyMap<string, number>, limit = 8): [string, number][] {
  return [...counts].filter(([, count]) => count > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, limit);
}

/** One reporting interval of frame samples. Gaps longer than `pauseMs` are treated as pauses, not drops. */
export class FrameWindow {
  private deltas: number[] = [];
  private js: number[] = [];
  private renderMs: number[] = [];
  constructor(private readonly pauseMs = 1000) {}

  push(deltaMs: number | null, jsMs: number, renderMs: number) {
    if (deltaMs !== null && deltaMs > 0 && deltaMs < this.pauseMs) this.deltas.push(deltaMs);
    if (Number.isFinite(jsMs) && jsMs >= 0) this.js.push(jsMs);
    if (Number.isFinite(renderMs) && renderMs >= 0) this.renderMs.push(renderMs);
  }

  get frameCount() { return this.js.length; }

  summarize(elapsedMs: number, xrFrameRate?: number | null) {
    const sorted = [...this.deltas].sort((a, b) => a - b);
    const expected = expectedIntervalMs(this.deltas, xrFrameRate);
    const frames = this.js.length;
    const sum = (values: number[]) => values.reduce((total, value) => total + value, 0);
    return {
      hz: Math.round(1000 / expected),
      frames,
      fps: round1(elapsedMs > 0 ? frames / (elapsedMs / 1000) : 0),
      dropped: droppedFrames(this.deltas, expected),
      p50: round1(percentile(sorted, 50)),
      p95: round1(percentile(sorted, 95)),
      max: round1(sorted.at(-1) ?? 0),
      js: round1(frames ? sum(this.js) / frames : 0),
      jsMax: round1(frames ? Math.max(...this.js) : 0),
      render: round1(this.renderMs.length ? sum(this.renderMs) / this.renderMs.length : 0),
    };
  }

  reset() { this.deltas = []; this.js = []; this.renderMs = []; }
}

/** Aggregates per-second reports into an end-of-session summary. */
export class SessionAggregate {
  private seconds = 0;
  private frames = 0;
  private dropped = 0;
  private longTasks = 0;
  private longMs = 0;
  private worst: PerfSummaryReport["worst"] = null;
  private renders = new Map<string, number>();
  private first: PerfSecondReport | null = null;
  private last: PerfSecondReport | null = null;

  constructor(readonly scope: "vr" | "page") {}

  add(report: PerfSecondReport) {
    if (!report.frames) return;
    this.seconds += 1;
    this.frames += report.frames;
    this.dropped += report.dropped;
    this.longTasks += report.longTasks;
    this.longMs += report.longMs;
    report.renders.forEach(([name, count]) => this.renders.set(name, (this.renders.get(name) ?? 0) + count));
    if (!this.worst || report.fps < this.worst.fps || (report.fps === this.worst.fps && report.dropped > this.worst.dropped)) {
      this.worst = { t: report.t, fps: report.fps, dropped: report.dropped, events: report.events.slice(0, 4) };
    }
    this.first ??= report;
    this.last = report;
  }

  get empty() { return this.seconds === 0; }

  summary(sid: string): PerfSummaryReport {
    const pair = (pick: (report: PerfSecondReport) => number): [number, number] => [this.first ? pick(this.first) : 0, this.last ? pick(this.last) : 0];
    const expectedFrames = this.frames + this.dropped;
    return {
      kind: "summary", sid, scope: this.scope,
      duration: this.seconds,
      frames: this.frames,
      avgFps: round1(this.seconds ? this.frames / this.seconds : 0),
      dropped: this.dropped,
      droppedPct: round1(expectedFrames ? (this.dropped / expectedFrames) * 100 : 0),
      longTasks: this.longTasks,
      longMs: Math.round(this.longMs),
      worst: this.worst,
      renders: topEntries(this.renders, 6),
      textures: pair(report => report.textures),
      geometries: pair(report => report.geometries),
      programs: pair(report => report.programs),
    };
  }
}
