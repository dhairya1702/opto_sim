import { createElement, lazy, Suspense } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { act } from "@react-three/fiber";
import { expect, it, vi } from "vitest";
import { LoadRecoveryBoundary } from "../ui/LoadRecoveryBoundary";
import { clinic } from "./helpers/xrClinicHarness";

it("catches a rejected lazy import and exposes honest recovery with a data-loss warning", async () => {
  let fallback = "";
  // Render the fallback as HTML, while mounting the actual boundary lifecycle in
  // the existing React harness (which otherwise accepts Three objects only).
  class Boundary extends LoadRecoveryBoundary {
    render() {
      const result = super.render();
      if (this.state.failed) { fallback = renderToStaticMarkup(result); return null; }
      return result;
    }
  }
  const Broken = lazy(async () => { throw new Error("Chunk unavailable"); });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  let sim: Awaited<ReturnType<typeof clinic>> | undefined;
  try {
    sim = await clinic({ renderAdapter: () => createElement(Boundary, {
      onReturn: vi.fn(),
      children: createElement(Suspense, { fallback: null }, createElement(Broken)),
    }) });
    await act(async () => {});
    expect(fallback).toContain("could not load");
    expect(fallback).toContain("clears your current attempt");
    expect(fallback).toContain("Return to mode selection");
    expect(fallback).toContain("Reload app");
    expect(fallback).not.toContain(">Retry<");
  } finally { await sim?.dispose(); log.mockRestore(); vi.unstubAllGlobals(); }
});
