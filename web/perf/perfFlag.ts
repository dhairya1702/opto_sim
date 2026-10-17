/**
 * Always-bundled, near-zero-cost hooks for the opt-in developer perf logger.
 * Nothing is measured or sent unless the page URL contains `?perf=1`; the probe
 * itself is lazy-loaded and installs the sink. Without it, every call is a
 * single null check.
 */
import type { WebGLRenderer } from "three";

export type PerfSink = {
  count(name: string, amount?: number): void;
  render(component: string): void;
  event(name: string): void;
  frameStart(now: number): void;
  frameEnd(now: number, renderMs: number, renderer: WebGLRenderer): void;
};

function readFlag() {
  try { return new URLSearchParams(globalThis.location?.search ?? "").get("perf") === "1"; }
  catch { return false; }
}

export const perfEnabled = readFlag();

let sink: PerfSink | null = null;
export function setPerfSink(next: PerfSink | null) { sink = next; }
export function getPerfSink() { return sink; }

/** Count a costly operation, e.g. a canvas texture rebuild. */
export function perfCount(name: string, amount = 1) { sink?.count(name, amount); }
/** Count a component render (call in the component body). */
export function perfRender(component: string) { sink?.render(component); }
/** Mark a learner-neutral interaction (tool id or lifecycle name only, never clinical data). */
export function perfEvent(name: string) { sink?.event(name); }
