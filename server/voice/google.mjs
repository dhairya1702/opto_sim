import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export class SpeechBridge {
  constructor({ projectId, onTranscript, onError }, load = () => import("@google-cloud/speech")) { this.projectId = projectId; this.onTranscript = onTranscript; this.onError = onError; this.load = load; this.closed = false; }
  async start(sampleRate) {
    try {
      const speech = await this.load();
      if (this.closed) return;
      const Client = speech.v2?.SpeechClient || speech.default?.v2?.SpeechClient;
      if (!Client) throw new Error("Speech-to-Text V2 client unavailable");
      this.client = new Client();
      this.stream = this.client._streamingRecognize().on("data", data => {
        for (const result of data.results || []) {
          const transcript = result.alternatives?.[0]?.transcript?.trim();
          const offset = result.resultEndOffset;
          const endNs = offset ? Number(offset.seconds || 0) * 1e9 + Number(offset.nanos || 0) : null;
          if (result.isFinal && endNs !== null && Number.isFinite(endNs)) {
            if (this.lastFinalEndNs !== undefined && endNs <= this.lastFinalEndNs) continue;
            this.lastFinalEndNs = endNs;
          }
          if (!this.closed && transcript) this.onTranscript(transcript, Boolean(result.isFinal));
        }
      }).on("error", error => { if (!this.closed) this.onError(error); });
      this.stream.write({ recognizer: `projects/${this.projectId}/locations/global/recognizers/_`, streamingConfig: { config: { explicitDecodingConfig: { encoding: "LINEAR16", sampleRateHertz: sampleRate, audioChannelCount: 1 }, languageCodes: ["en-US"], model: "long" }, streamingFeatures: { interimResults: true } } });
    } catch (error) { if (!this.closed) this.onError(error); this.close(); }
  }
  write(buffer) { if (!this.closed && this.stream && !this.stream.destroyed) this.stream.write({ audio: buffer }); }
  close() { this.closed = true; const stream = this.stream; this.stream = null; const client = this.client; this.client = null; try { stream?.end(); } catch {} void client?.close?.().catch(() => undefined); }
}

export class CanonicalSpeech {
  constructor(config, load = () => import("@google-cloud/text-to-speech")) {
    this.config = config; this.cache = new Map(); this.inflight = new Map(); this.load = load; this.clientPromise = null; this.closed = false;
  }
  async getClient() {
    if (this.closed) throw new Error("Canonical speech client is closed");
    if (!this.clientPromise) {
      const loading = this.load().then(tts => {
        const Client = tts.TextToSpeechClient || tts.default?.TextToSpeechClient;
        if (!Client) throw new Error("Text-to-Speech client unavailable");
        return new Client();
      });
      this.clientPromise = loading;
      loading.catch(() => { if (this.clientPromise === loading) this.clientPromise = null; });
    }
    return this.clientPromise;
  }
  async synthesize(text, cacheKey) {
    if (this.closed) throw new Error("Canonical speech client is closed");
    const textHash = createHash("sha256").update(text).digest("hex");
    const key = `${textHash}:${this.config.voiceName}`;
    if (this.cache.has(key)) return this.cache.get(key);
    if (cacheKey) {
      try {
        this.assetIndex ||= JSON.parse(await readFile(resolve(repositoryRoot, "public/audio/voice/index.json"), "utf8"));
        const asset = this.assetIndex[cacheKey];
        if (asset?.file && asset.textHash === textHash && asset.voice === this.config.voiceName) {
          const result = { data: (await readFile(resolve(repositoryRoot, "public/audio/voice", asset.file))).toString("base64"), mimeType: "audio/mpeg" };
          this.cache.set(key, result); return result;
        }
      } catch { /* Generated assets are optional; use ephemeral runtime TTS. */ }
    }
    if (this.inflight.has(key)) return this.inflight.get(key);
    const pending = (async () => {
      const client = await this.getClient();
      const [response] = await client.synthesizeSpeech({ input: { text }, voice: { languageCode: "en-US", name: this.config.voiceName, modelName: "gemini-2.5-flash-tts" }, audioConfig: { audioEncoding: "MP3", speakingRate: 1 } });
      const result = { data: Buffer.from(response.audioContent || "").toString("base64"), mimeType: "audio/mpeg" };
      if (!this.closed) {
        this.cache.set(key, result);
        if (this.cache.size > 256) {
          const oldest = this.cache.keys().next().value;
          if (oldest) this.cache.delete(oldest);
        }
      }
      return result;
    })();
    this.inflight.set(key, pending);
    try { return await pending; }
    finally { if (this.inflight.get(key) === pending) this.inflight.delete(key); }
  }
  async close() {
    if (this.closed) return;
    this.closed = true;
    const inflight = [...this.inflight.values()];
    if (inflight.length) await Promise.allSettled(inflight);
    this.inflight.clear();
    const pending = this.clientPromise; this.clientPromise = null;
    if (!pending) return;
    try { const client = await pending; await client.close?.(); } catch { /* Startup failures and shutdown are already terminal. */ }
  }
}
