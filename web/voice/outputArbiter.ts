export type VoiceOutputKind = "gemini" | "canonical";

export class VoiceOutputArbiter {
  private generation = 0;
  private active?: { stop: () => void; kind: VoiceOutputKind };

  beginTurn() {
    this.stop();
    return ++this.generation;
  }

  startTurn(generation: number) {
    if (generation < this.generation) return false;
    if (generation > this.generation) {
      this.stop();
      this.generation = generation;
    }
    return true;
  }

  isCurrent(generation: number) { return generation === this.generation; }

  play(generation: number, kind: VoiceOutputKind, stop: () => void) {
    if (!this.isCurrent(generation)) return false;
    if (this.active?.kind === "canonical" && kind === "gemini") return false;
    this.active?.stop();
    this.active = { stop, kind };
    return true;
  }

  preferCanonical(generation: number) {
    if (!this.isCurrent(generation)) return false;
    if (this.active?.kind === "gemini") this.active.stop();
    this.active = undefined;
    return true;
  }

  stop() {
    this.active?.stop();
    this.active = undefined;
  }
}
