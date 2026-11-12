import { afterEach, expect, it, vi } from "vitest";
import { createPatientAssetLoader } from "../interaction/patientAssetLoader";
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (error: Error) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { resolve, reject, promise }; };
afterEach(() => vi.useRealTimers());

it("shares a bounded parallel load, deduplicates textures, and caches success", async () => {
  const jobs = [deferred<string>(), deferred<string>(), deferred<string>()];
  const loadResource = vi.fn((_name: string, _signal: AbortSignal) => jobs[loadResource.mock.calls.length - 1].promise);
  const load = createPatientAssetLoader({ loadData: async () => ["a", "b", "c", "a"], names: data => data, loadResource, dispose: vi.fn() });
  const first = load();
  expect(load()).toBe(first);
  await Promise.resolve(); expect(loadResource).toHaveBeenCalledTimes(2);
  jobs[0].resolve("A"); await Promise.resolve(); await Promise.resolve();
  expect(loadResource).toHaveBeenCalledTimes(3);
  jobs[1].resolve("B"); jobs[2].resolve("C");
  const result = await first;
  expect([...result.resources.values()]).toEqual(["A", "B", "C"]);
  expect(await load()).toBe(result); expect(loadResource).toHaveBeenCalledTimes(3);
});

it("aborts failed work, disposes completed and late textures, and allows retry", async () => {
  const late = deferred<string>();
  const dispose = vi.fn();
  let attempt = 0;
  const load = createPatientAssetLoader({
    loadData: async () => { attempt++; return ["a", "b", "c"]; }, names: data => data,
    loadResource: async (name, signal) => {
      if (attempt > 1) return name;
      if (name === "a") return "complete";
      if (name === "b") return late.promise;
      expect(signal.aborted).toBe(false); throw new Error("Download failed");
    }, dispose,
  });
  await expect(load()).rejects.toThrow("Download failed");
  expect(dispose).toHaveBeenCalledWith("complete");
  late.resolve("late"); await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
  expect(dispose).toHaveBeenCalledWith("late");
  expect((await load()).resources.size).toBe(3);
});

it("times out stalled data loading, aborts the request and does not cache stale completion", async () => {
  vi.useFakeTimers();
  const stalled = deferred<string[]>();
  let signal: AbortSignal | undefined;
  const loadResource = vi.fn(async (name: string) => name);
  const load = createPatientAssetLoader({
    loadData: async next => { signal = next; return stalled.promise; },
    names: data => data, loadResource, dispose: vi.fn(), timeoutMs: 100,
  });
  const assertion = expect(load()).rejects.toThrow("timed out");
  await vi.advanceTimersByTimeAsync(100); await assertion;
  expect(signal?.aborted).toBe(true);
  stalled.resolve(["old"]); await Promise.resolve(); await Promise.resolve();
  expect(loadResource).not.toHaveBeenCalled();
});

it("times out texture loading, lets retry succeed, and disposes an obsolete late texture", async () => {
  vi.useFakeTimers();
  const stalled = deferred<string>(), dispose = vi.fn();
  let calls = 0;
  const load = createPatientAssetLoader({
    loadData: async () => ["skin"], names: data => data,
    loadResource: async () => ++calls === 1 ? stalled.promise : "new",
    dispose, timeoutMs: 100,
  });
  const assertion = expect(load()).rejects.toThrow("timed out");
  await vi.advanceTimersByTimeAsync(100); await assertion;
  const result = await load(); expect(result.resources.get("skin")).toBe("new");
  stalled.resolve("old"); await vi.advanceTimersByTimeAsync(0);
  expect(dispose).toHaveBeenCalledWith("old");
  expect(dispose).not.toHaveBeenCalledWith("new");
  expect(await load()).toBe(result);
});
