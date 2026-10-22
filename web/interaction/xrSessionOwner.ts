/** Owns asynchronous XR startup independently of React rendering. */
export class XRSessionOwner {
  private generation = 0;
  private mounted = false;
  private starting = false;
  private session: XRSession | null = null;
  private ending = new WeakMap<XRSession, Promise<void>>();

  open() { this.mounted = true; }
  dispose() { this.mounted = false; void this.stop(); }
  private end(session: XRSession) {
    let pending = this.ending.get(session);
    if (!pending) {
      pending = session.end().catch(() => undefined);
      this.ending.set(session, pending);
    }
    return pending;
  }
  async stop() {
    ++this.generation;
    this.starting = false;
    const session = this.session;
    this.session = null;
    if (session) await this.end(session);
  }
  async start(request: () => Promise<XRSession>, attach: (session: XRSession) => Promise<void>,
    onActive: (active: boolean) => void, onError: (error: unknown) => void) {
    if (!this.mounted || this.starting || this.session) return;
    this.starting = true;
    const generation = ++this.generation;
    const current = () => this.mounted && this.generation === generation;
    let session: XRSession | null = null;
    try {
      session = await request();
      if (!current()) { await this.end(session); return; }
      this.session = session;
      const owned = session;
      session.addEventListener("end", () => {
        if (!current() || this.session !== owned) return;
        this.session = null; this.starting = false; ++this.generation;
        onActive(false);
      }, { once: true });
      await attach(session);
      if (!current() || this.session !== session) { await this.end(session); return; }
      onActive(true);
    } catch (error) {
      if (session) {
        if (this.session === session) this.session = null;
        await this.end(session);
      }
      if (current()) onError(error);
    } finally {
      if (current()) this.starting = false;
    }
  }
}
