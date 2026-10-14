import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export class SpeechBridge {
  constructor({ projectId, onTranscript, onError }) { this.projectId = projectId; this.onTranscript = onTranscript; this.onError = onError; }
  async start(sampleRate) {
    try {
      const speech = await import("@google-cloud/speech");
      const Client = speech.v2?.SpeechClient || speech.default?.v2?.SpeechClient;
      if (!Client) throw new Error("Speech-to-Text V2 client unavailable");
      this.client = new Client();
      this.stream = this.client._streamingRecognize().on("data", data => {
        for (const result of data.results || []) {
          const transcript = result.alternatives?.[0]?.transcript?.trim();
          if (transcript) this.onTranscript(transcript, Boolean(result.isFinal));
        }
      }).on("error", this.onError);
      this.stream.write({ recognizer: `projects/${this.projectId}/locations/global/recognizers/_`, streamingConfig: { config: { explicitDecodingConfig: { encoding: "LINEAR16", sampleRateHertz: sampleRate, audioChannelCount: 1 }, languageCodes: ["en-US"], model: "long" }, streamingFeatures: { interimResults: true } } });
    } catch (error) { this.onError(error); }
  }
  write(buffer) { if (this.stream && !this.stream.destroyed) this.stream.write({ audio: buffer }); }
  close() { try { this.stream?.end(); } catch {} void this.client?.close?.(); }
}

export class GeminiLiveBridge {
  constructor(config, callbacks) { this.config = config; this.callbacks = callbacks; this.suppressed = false; this.audioChunks = []; this.audioMimeType = "audio/pcm;rate=24000"; }
  async start(context, sampleRate) {
    try {
      const { GoogleGenAI, Modality } = await import("@google/genai");
      this.ai = new GoogleGenAI({ vertexai: true, project: this.config.projectId, location: this.config.location });
      const encounterActions = context.allowedActions.filter(action => ["dim-room", "restore-room"].includes(action));
      const patientInstructions = context.allowedActions.filter(action => !encounterActions.includes(action));
      const functions = context.mode === "test" ? [
        { name: "route_history", description: "Route an authored history question", parameters: { type: "OBJECT", properties: { factIds: { type: "ARRAY", items: { type: "STRING", enum: context.allowedFacts.map(f => f.id) } } }, required: ["factIds"] } },
        { name: "patient_instruction", description: "Apply the learner's natural spoken instruction to the simulated patient. Use follow-target for requests to follow a light, finger, or target; fixate-target for sustained fixation; look-straight for distant straight-ahead gaze; report-symptoms for questions asked during a procedure; and read-chart for acuity reading requests.", parameters: { type: "OBJECT", properties: { instructionId: { type: "STRING", enum: patientInstructions } }, required: ["instructionId"] } },
        { name: "encounter_action", description: "Apply a permitted physical room action requested by the learner. Use dim-room to lower the room illumination and restore-room to return it to normal.", parameters: { type: "OBJECT", properties: { actionId: { type: "STRING", enum: encounterActions } }, required: ["actionId"] } },
      ] : [{ name: "practice_action", description: "Invoke a permitted lesson action. Never infer or reveal a finding.", parameters: { type: "OBJECT", properties: { actionId: { type: "STRING", enum: context.allowedActions } }, required: ["actionId"] } }];
      this.session = await this.ai.live.connect({ model: this.config.liveModel, callbacks: {
        onmessage: message => this.handle(message, context),
        onerror: error => this.callbacks.onError(error),
        onclose: () => this.callbacks.onClose?.(),
      }, config: { responseModalities: [Modality.AUDIO], inputAudioTranscription: {}, speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: this.config.voiceName } } }, systemInstruction: `You are the fictional patient in an educational optometry simulator. Social conversation may be brief and natural. For clinical history, patient instructions, or procedure reports, call one provided function. Never invent clinical facts, examination findings, scores, diagnoses, or technique completion. Allowed identifiers are exhaustive.`, tools: [{ functionDeclarations: functions }] } });
      this.sampleRate = sampleRate;
    } catch (error) { this.callbacks.onError(error); }
  }
  handle(message, context) {
    const inputTranscript = message.serverContent?.inputTranscription?.text;
    if (inputTranscript) this.callbacks.onInputTranscript?.(inputTranscript);
    const calls = message.toolCall?.functionCalls || [];
    for (const call of calls) this.callbacks.onFunction(call, context);
    if (this.suppressed) { this.audioChunks = []; return; }
    for (const part of message.serverContent?.modelTurn?.parts || []) {
      const data = part.inlineData?.data;
      if (data) { if (!this.audioChunks.length) this.callbacks.onOutputActivity?.(); this.audioChunks.push(Buffer.from(data, "base64")); this.audioMimeType = part.inlineData.mimeType || this.audioMimeType; }
    }
    if ((message.serverContent?.turnComplete || message.serverContent?.generationComplete) && this.audioChunks.length) {
      const pcm = Buffer.concat(this.audioChunks); this.audioChunks = [];
      this.callbacks.onAudio(pcmToWav(pcm, this.audioMimeType).toString("base64"), "audio/wav");
    }
  }
  write(buffer) { void this.session?.sendRealtimeInput?.({ audio: { data: buffer.toString("base64"), mimeType: `audio/pcm;rate=${this.sampleRate || 48000}` } }); }
  suppress() { this.suppressed = true; this.audioChunks = []; }
  unsuppress() { this.suppressed = false; this.audioChunks = []; }
  close() { try { this.session?.close?.(); } catch {} }
}

function pcmToWav(pcm, mimeType) {
  const rate = Number(/rate=(\d+)/.exec(mimeType)?.[1] || 24000);
  const header = Buffer.alloc(44); header.write("RIFF", 0); header.writeUInt32LE(36 + pcm.length, 4); header.write("WAVEfmt ", 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22); header.writeUInt32LE(rate, 24);
  header.writeUInt32LE(rate * 2, 28); header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34); header.write("data", 36); header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

export class CanonicalSpeech {
  constructor(config) { this.config = config; this.cache = new Map(); }
  async synthesize(text, cacheKey) {
    const key = `${cacheKey || createHash("sha256").update(text).digest("hex")}:${this.config.voiceName}`;
    if (this.cache.has(key)) return this.cache.get(key);
    if (cacheKey) {
      try {
        this.assetIndex ||= JSON.parse(await readFile(resolve(repositoryRoot, "public/audio/voice/index.json"), "utf8"));
        const asset = this.assetIndex[cacheKey];
        if (asset?.file && asset.voice === this.config.voiceName) {
          const result = { data: (await readFile(resolve(repositoryRoot, "public/audio/voice", asset.file))).toString("base64"), mimeType: "audio/mpeg" };
          this.cache.set(key, result); return result;
        }
      } catch { /* Generated assets are optional; use ephemeral runtime TTS. */ }
    }
    const tts = await import("@google-cloud/text-to-speech");
    const Client = tts.TextToSpeechClient || tts.default?.TextToSpeechClient;
    const client = new Client();
    const [response] = await client.synthesizeSpeech({ input: { text }, voice: { languageCode: "en-US", name: this.config.voiceName, modelName: "gemini-2.5-flash-tts" }, audioConfig: { audioEncoding: "MP3", speakingRate: 1 } });
    await client.close();
    const result = { data: Buffer.from(response.audioContent || "").toString("base64"), mimeType: "audio/mpeg" };
    this.cache.set(key, result);
    if (this.cache.size > 256) {
      const oldest = this.cache.keys().next().value;
      if (oldest) this.cache.delete(oldest);
    }
    return result;
  }
}
