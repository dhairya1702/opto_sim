/** One shared cache; a UI consumer leaving does not cancel another consumer's load. */
export function createPatientAssetLoader<Data, Resource>(options: {
  loadData: (signal: AbortSignal) => Promise<Data>;
  names: (data: Data) => string[];
  loadResource: (name: string, signal: AbortSignal) => Promise<Resource>;
  dispose: (resource: Resource) => void;
  timeoutMs?: number;
}) {
  let cached: { data: Data; resources: Map<string, Resource> } | undefined;
  let pending: Promise<NonNullable<typeof cached>> | undefined;
  return () => {
    if (cached) return Promise.resolve(cached);
    if (pending) return pending;
    const controller = new AbortController();
    const resources = new Map<string, Resource>();
    let rejectAbort: (error: unknown) => void = () => {};
    const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
    const onAbort = () => rejectAbort(controller.signal.reason);
    controller.signal.addEventListener("abort", onAbort, { once: true });
    const timer = setTimeout(() => controller.abort(new Error("Patient loading timed out. Try again or use the current patient.")), options.timeoutMs ?? 30000);
    const work = (async () => {
      const data = await options.loadData(controller.signal);
      controller.signal.throwIfAborted();
      const names = [...new Set(options.names(data))];
      let cursor = 0;
      const worker = async () => {
        while (cursor < names.length) {
          controller.signal.throwIfAborted();
          const name = names[cursor++];
          const resource = await options.loadResource(name, controller.signal);
          if (controller.signal.aborted) { options.dispose(resource); controller.signal.throwIfAborted(); }
          resources.set(name, resource);
        }
      };
      await Promise.all(Array.from({ length: Math.min(2, names.length) }, worker));
      controller.signal.throwIfAborted();
      return { data, resources };
    })();
    const attempt = Promise.race([work, aborted]).then(result => {
      cached = result;
      return result;
    }).catch(error => {
      controller.abort(error);
      resources.forEach(resource => options.dispose(resource)); resources.clear();
      throw error;
    }).finally(() => {
      clearTimeout(timer);
      controller.signal.removeEventListener("abort", onAbort);
      if (pending === attempt) pending = undefined;
    });
    pending = attempt;
    return attempt;
  };
}
