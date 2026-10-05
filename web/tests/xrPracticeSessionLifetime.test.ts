import { createElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clinic } from "./helpers/xrClinicHarness";
import { openPracticeXRSessionLifetime, usePracticeXRSessionLifetime } from "../interaction/usePracticeXRSessionLifetime";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });
describe("Practice XR session lifetime in development StrictMode", () => {
  it("reopens the launch guard through StrictMode's setup/cleanup/setup sequence", () => {
    const lifetime = { session: { current: null }, mounted: { current: false }, closing: { current: false } };
    const replayCleanup = openPracticeXRSessionLifetime(lifetime);
    expect(lifetime.closing.current).toBe(false);
    replayCleanup(); expect(lifetime.closing.current).toBe(true);
    const actualCleanup = openPracticeXRSessionLifetime(lifetime);
    expect(lifetime.mounted.current).toBe(true); expect(lifetime.closing.current).toBe(false);
    actualCleanup(); expect(lifetime.mounted.current).toBe(false);
  });
  it("retains session ownership across renders and ends it on actual unmount", async () => {
    let lifetime: ReturnType<typeof usePracticeXRSessionLifetime>;
    const end = vi.fn(async () => undefined);
    function Probe() {
      lifetime = usePracticeXRSessionLifetime();
      return null;
    }
    const sim = await clinic({ renderAdapter: () => createElement(Probe) });
    dispose = sim.dispose;
    expect(lifetime!.mounted.current).toBe(true);
    expect(lifetime!.closing.current).toBe(false);
    lifetime!.session.current = { end } as unknown as XRSession;
    await sim.rerender();
    expect(lifetime!.session.current).not.toBeNull(); expect(end).not.toHaveBeenCalled();
    await sim.dispose(); dispose = undefined;
    expect(lifetime!.mounted.current).toBe(false); expect(lifetime!.closing.current).toBe(true);
    expect(lifetime!.session.current).toBeNull(); expect(end).toHaveBeenCalledTimes(1);
  });
});
