import { createElement } from "react";
import { act } from "@react-three/fiber";
import { expect, it, vi } from "vitest";
import { clinic } from "./helpers/xrClinicHarness";
import { useEncounterTime } from "../ui/EncounterTimer";

it("ticks only the clock, freezes at completion, and cleans up its interval", async () => {
  let startedAt: number | undefined, endedAt: number | undefined, active = false;
  let text = "", parentRenders = 0;
  function Clock() { text = useEncounterTime(startedAt, endedAt, active); return null; }
  function Parent() { parentRenders++; return createElement(Clock); }
  const sim = await clinic({ renderAdapter: () => createElement(Parent) });
  vi.useFakeTimers(); vi.setSystemTime(0);
  const interval = vi.spyOn(globalThis, "setInterval"), clear = vi.spyOn(globalThis, "clearInterval");
  try {
    expect(text).toBe("00:00");
    await act(async () => { vi.advanceTimersByTime(2000); });
    expect(interval).not.toHaveBeenCalled();
    active = true; startedAt = 0; await sim.rerender();
    const renders = parentRenders;
    await act(async () => { vi.advanceTimersByTime(62000); });
    expect(text).toBe("01:04"); expect(parentRenders).toBe(renders);
    active = false; endedAt = 63500; await sim.rerender();
    expect(text).toBe("01:03"); expect(clear).toHaveBeenCalledTimes(1);
    await act(async () => { vi.advanceTimersByTime(60000); });
    expect(text).toBe("01:03");
    startedAt = undefined; endedAt = undefined; await sim.rerender();
    expect(text).toBe("00:00");
    active = true; startedAt = Date.now(); await sim.rerender();
    await sim.dispose(); expect(clear).toHaveBeenCalledTimes(2);
  } finally { interval.mockRestore(); clear.mockRestore(); vi.useRealTimers(); vi.unstubAllGlobals(); }
});
