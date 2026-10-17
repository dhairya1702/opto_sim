import { describe, expect, it } from "vitest";
import { FrameWindow, SessionAggregate, droppedFrames, expectedIntervalMs, percentile, topEntries, type PerfSecondReport } from "../perf/perfStats";

const second = (overrides: Partial<PerfSecondReport> = {}): PerfSecondReport => ({
  kind: "second", sid: "abcd", t: 1, mode: "xr", hz: 72, frames: 72, fps: 72, dropped: 0, p50: 13.9, p95: 14.2, max: 15,
  js: 6, jsMax: 9, render: 3, longTasks: 0, longMs: 0, draws: 300, tris: 100_000, geometries: 200, textures: 90, programs: 40,
  renders: [], counters: [], events: [], ...overrides,
});

describe("perf frame statistics", () => {
  it("computes nearest-rank percentiles", () => {
    expect(percentile([], 50)).toBe(0);
    expect(percentile([1, 2, 3, 4], 50)).toBe(2);
    expect(percentile([1, 2, 3, 4], 95)).toBe(4);
  });

  it("prefers the XR refresh rate and falls back to a clamped median", () => {
    expect(expectedIntervalMs([20, 20, 20], 72)).toBeCloseTo(1000 / 72);
    expect(expectedIntervalMs([16.7, 16.6, 16.8])).toBeCloseTo(16.7);
    expect(expectedIntervalMs([500, 500])).toBeCloseTo(1000 / 30);
    expect(expectedIntervalMs([])).toBeCloseTo(1000 / 60);
  });

  it("counts missed refreshes from long intervals but not jitter", () => {
    const budget = 1000 / 72;
    expect(droppedFrames([budget, budget * 1.3, budget], budget)).toBe(0);
    expect(droppedFrames([budget * 2], budget)).toBe(1);
    expect(droppedFrames([budget * 4, budget * 1.6], budget)).toBe(4);
  });

  it("summarizes a window and ignores pauses as drops", () => {
    const window = new FrameWindow();
    const budget = 1000 / 72;
    window.push(null, 5, 2);
    for (let i = 0; i < 69; i += 1) window.push(budget, 6, 3);
    window.push(budget * 2, 20, 4);
    window.push(5000, 6, 3); // tab paused: not a drop
    const stats = window.summarize(1000, 72);
    expect(stats.hz).toBe(72);
    expect(stats.frames).toBe(72);
    expect(stats.fps).toBe(72);
    expect(stats.dropped).toBe(1);
    expect(stats.jsMax).toBe(20);
    expect(stats.max).toBeCloseTo(27.8, 1);
    window.reset();
    expect(window.summarize(1000, 72).frames).toBe(0);
  });

  it("ranks the busiest entries", () => {
    expect(topEntries(new Map([["a", 1], ["b", 5], ["c", 0], ["d", 5]]), 2)).toEqual([["b", 5], ["d", 5]]);
  });

  it("aggregates a session with its worst second and resource growth", () => {
    const session = new SessionAggregate("vr");
    expect(session.empty).toBe(true);
    session.add(second({ t: 1, renders: [["Room", 3]] }));
    session.add(second({ t: 2, frames: 0, fps: 0 })); // idle second ignored
    session.add(second({ t: 3, fps: 40, frames: 40, dropped: 32, events: ["pickup penlight"], textures: 120, renders: [["Room", 2]] }));
    const summary = session.summary("abcd");
    expect(summary.duration).toBe(2);
    expect(summary.frames).toBe(112);
    expect(summary.dropped).toBe(32);
    expect(summary.droppedPct).toBeCloseTo(22.2, 1);
    expect(summary.worst).toEqual({ t: 3, fps: 40, dropped: 32, events: ["pickup penlight"] });
    expect(summary.renders).toEqual([["Room", 5]]);
    expect(summary.textures).toEqual([90, 120]);
  });
});
