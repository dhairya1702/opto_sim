class OptoPcmCapture extends AudioWorkletProcessor {
  constructor() {
    super();
    this.active = false;
    this.frameSamples = Math.max(128, Math.round(sampleRate * 0.02));
    this.frame = new Int16Array(this.frameSamples);
    this.offset = 0;
    this.energy = 0;
    this.port.onmessage = event => {
      if (event.data?.type !== "active") return;
      this.active = Boolean(event.data.active);
      if (!this.active) {
        this.offset = 0;
        this.energy = 0;
      }
    };
  }

  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (!this.active || !channel || channel.length === 0) return true;
    for (let index = 0; index < channel.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, channel[index]));
      const pcm = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      this.frame[this.offset++] = pcm;
      this.energy += pcm * pcm;
      if (this.offset < this.frameSamples) continue;
      const frame = this.frame;
      const rms = Math.sqrt(this.energy / this.frameSamples);
      this.frame = new Int16Array(this.frameSamples);
      this.offset = 0;
      this.energy = 0;
      this.port.postMessage({ pcm: frame.buffer, rms }, [frame.buffer]);
    }
    return true;
  }
}
registerProcessor("opto-pcm-capture", OptoPcmCapture);
