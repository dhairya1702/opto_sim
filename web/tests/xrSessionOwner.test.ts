import { describe, expect, it, vi } from "vitest";
import { XRSessionOwner } from "../interaction/xrSessionOwner";
const deferred = <T,>() => { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; };
function session() {
  const events = new EventTarget();
  const end = vi.fn(async () => { events.dispatchEvent(new Event("end")); });
  return Object.assign(events, { end }) as unknown as XRSession & { end: typeof end };
}
describe("XR asynchronous session ownership", () => {
  it("ends a request resolving after exit, including effect cleanup/reopen", async () => {
    const owner = new XRSessionOwner(); owner.open();
    const pending = deferred<XRSession>(), next = session(), attach = vi.fn(), active = vi.fn();
    const start = owner.start(() => pending.promise, attach, active, vi.fn());
    owner.dispose(); owner.open(); pending.resolve(next); await start;
    expect(next.end).toHaveBeenCalledTimes(1); expect(attach).not.toHaveBeenCalled(); expect(active).not.toHaveBeenCalled();
  });
  it("does not activate a session ended during renderer setup", async () => {
    const owner = new XRSessionOwner(); owner.open();
    const pending = deferred<void>(), next = session(), active = vi.fn();
    const start = owner.start(async () => next, () => pending.promise, active, vi.fn());
    await Promise.resolve(); await next.end(); pending.resolve(); await start;
    expect(active.mock.calls).toEqual([[false]]);
  });
  it("ignores old end events and prevents concurrent startup requests", async () => {
    const owner = new XRSessionOwner(); owner.open();
    const pending = deferred<void>(), old = session(), fresh = session(), active = vi.fn();
    const start = owner.start(async () => old, () => pending.promise, active, vi.fn());
    await Promise.resolve();
    const duplicate = vi.fn(); await owner.start(duplicate, vi.fn(), active, vi.fn()); expect(duplicate).not.toHaveBeenCalled();
    await owner.stop();
    await owner.start(async () => fresh, async () => {}, active, vi.fn());
    pending.resolve(); await start;
    old.dispatchEvent(new Event("end"));
    expect(active.mock.calls).toEqual([[true]]);
    await owner.stop(); expect(fresh.end).toHaveBeenCalledTimes(1);
  });
  it("closes failed attachments and permits a retry", async () => {
    const owner = new XRSessionOwner(); owner.open(); const next = session(), error = vi.fn();
    await owner.start(async () => next, async () => { throw new Error("attach"); }, vi.fn(), error);
    expect(next.end).toHaveBeenCalledTimes(1); expect(error).toHaveBeenCalledTimes(1);
    const active = vi.fn(); await owner.start(async () => session(), async () => {}, active, error);
    expect(active).toHaveBeenCalledWith(true); owner.dispose();
  });
});
