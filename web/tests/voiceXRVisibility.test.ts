import { act } from "@react-three/fiber";
import { expect, it, vi } from "vitest";
import { clinic } from "./helpers/xrClinicHarness";
import { VOICE_SESSION_HIDDEN } from "../voice/voiceVisibility";

it("announces XR visibility loss, not normal visibility, and cleans up the listener", async () => {
  const windowMock = new EventTarget();
  vi.stubGlobal("window", windowMock);
  const hidden = vi.fn(); windowMock.addEventListener(VOICE_SESSION_HIDDEN, hidden);
  const sim = await clinic();
  try {
    await act(async () => sim.session.dispatchEvent(new Event("visibilitychange")));
    expect(hidden).not.toHaveBeenCalled();
    await act(async () => {
      sim.session.visibilityState = "visible-blurred";
      sim.session.dispatchEvent(new Event("visibilitychange"));
    });
    expect(hidden).toHaveBeenCalledTimes(1);
    await act(async () => {
      sim.session.visibilityState = "visible";
      sim.session.dispatchEvent(new Event("visibilitychange"));
    });
    expect(hidden).toHaveBeenCalledTimes(1);
  } finally { await sim.dispose(); }
  sim.session.visibilityState = "hidden";
  sim.session.dispatchEvent(new Event("visibilitychange"));
  expect(hidden).toHaveBeenCalledTimes(1);
  vi.unstubAllGlobals();
});
