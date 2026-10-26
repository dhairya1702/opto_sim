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

export class GeminiLiveBridge {
  constructor(config, callbacks, load = () => import("@google/genai")) { this.config = config; this.callbacks = callbacks; this.load = load; this.closed = false; this.audioChunks = []; this.audioMimeType = "audio/pcm;rate=24000"; }
  async start(context, sampleRate) {
    try {
      const { GoogleGenAI, Modality } = await this.load();
      if (this.closed) return;
      this.ai = new GoogleGenAI({ vertexai: true, project: this.config.projectId, location: this.config.location });
      const encounterActions = context.allowedActions.filter(action => ["dim-room", "restore-room"].includes(action));
      const patientInstructions = context.allowedActions.filter(action => !encounterActions.includes(action));
      const functions = context.mode === "test" ? [
        { name: "route_history", description: "Route an authored history question", parameters: { type: "OBJECT", properties: { factIds: { type: "ARRAY", items: { type: "STRING", enum: context.allowedFacts.map(f => f.id) } } }, required: ["factIds"] } },
        { name: "patient_instruction", description: "Apply the learner's natural spoken instruction to the simulated patient. Use follow-target for requests to follow a light, finger, or target; fixate-target for sustained fixation; look-straight for distant straight-ahead gaze; report-symptoms for questions asked during a procedure; and read-chart for acuity reading requests.", parameters: { type: "OBJECT", properties: { instructionId: { type: "STRING", enum: patientInstructions } }, required: ["instructionId"] } },
        { name: "encounter_action", description: "Apply a permitted physical room action requested by the learner. Use dim-room to lower the room illumination and restore-room to return it to normal.", parameters: { type: "OBJECT", properties: { actionId: { type: "STRING", enum: encounterActions } }, required: ["actionId"] } },
      ] : [{ name: "practice_action", description: "Invoke a permitted lesson action. Never infer or reveal a finding.", parameters: { type: "OBJECT", properties: { actionId: { type: "STRING", enum: context.allowedActions } }, required: ["actionId"] } }];
      const session = await this.ai.live.connect({ model: this.config.liveModel, callbacks: {
        onmessage: message => this.handle(message, context),
        onerror: error => { if (!this.closed) this.callbacks.onError(error); },
        onclose: () => { if (!this.closed) this.callbacks.onClose?.(); },
      }, config: { responseModalities: [Modality.AUDIO], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: this.config.voiceName } } }, systemInstruction: `You are the fictional patient in an educational optometry simulator. Social conversation may be brief and natural. For clinical history, patient instructions, or procedure reports, call one provided function. Never invent clinical facts, examination findings, scores, diagnoses, or technique completion. Allowed identifiers are exhaustive.`, tools: [{ functionDeclarations: functions }] } });
      if (this.closed) { session.close(); return; }
      this.session = session; this.sampleRate = sampleRate;
    } catch (error) { if (!this.closed) this.callbacks.onError(error); this.close(); }
  }
  handle(message, context) {
    if (this.closed) return;
    const calls = message.toolCall?.functionCalls || [];
    for (const call of calls) this.callbacks.onFunction(call, context);
    if (this.closed) { this.audioChunks = []; return; }
    for (const part of message.serverContent?.modelTurn?.parts || []) {
      const data = part.inlineData?.data;
      if (data) { this.audioChunks.push(Buffer.from(data, "base64")); this.audioMimeType = part.inlineData.mimeType || this.audioMimeType; }
    }
    if ((message.serverContent?.turnComplete || message.serverContent?.generationComplete) && this.audioChunks.length) {
      const pcm = Buffer.concat(this.audioChunks); this.audioChunks = [];
      this.callbacks.onAudio(pcmToWav(pcm, this.audioMimeType).toString("base64"), "audio/wav");
    }
  }
  sendText(text) {
    if (this.closed) return;
    this.session?.sendClientContent({ turns: [{ role: "user", parts: [{ text }] }], turnComplete: true });
  }
  close() { this.closed = true; this.audioChunks = []; const session = this.session; this.session = null; try { session?.close?.(); } catch {} }
}

function pcmToWav(pcm, mimeType) {
  const rate = Number(/rate=(\d+)/.exec(mimeType)?.[1] || 24000);
  const header = Buffer.alloc(44); header.write("RIFF", 0); header.writeUInt32LE(36 + pcm.length, 4); header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
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
