import { randomUUID } from "node:crypto";
import { routeDeterministic } from "./router.mjs";
import { commandAllowed, validClientMessage } from "./validation.mjs";
import { SpeechBridge, GeminiLiveBridge } from "./google.mjs";

const send = (ws, value) => { if (ws.readyState === 1) ws.send(JSON.stringify(value)); };

export class VoiceSession {
  constructor(ws, config, speech, metadata = {}) {
    this.ws = ws; this.config = config; this.speech = speech; this.metadata = metadata;
    this.startedAt = Date.now(); this.lastAudioAt = Date.now(); this.turn = 0; this.seenUtterances = new Set(); this.routedAt = new Map(); this.closed = false; this.pendingFallback = null;
  }
  async handle(message, isBinary) {
    if (this.closed) return;
    if (isBinary) {
      const data = Buffer.from(message);
      if (!this.context || data.length > this.config.maxAudioFrameBytes) return this.close(1009, "invalid audio frame");
      this.lastAudioAt = Date.now(); this.stt?.write(data); this.gemini?.write(data); return;
    }
    if (Buffer.byteLength(message) > this.config.maxJsonBytes) return this.close(1009, "message too large");
    let body; try { body = JSON.parse(message.toString()); } catch { return this.close(1007, "invalid json"); }
    if (!validClientMessage(body)) return this.close(1008, "invalid message");
    if (body.type === "hello") {
      if (this.context) return this.close(1008, "already initialized");
      this.context = body.context; this.sampleRate = body.sampleRate;
      await this.startBridges(); send(this.ws, { type: "status", status: "listening" }); return;
    }
    if (!this.context) return this.close(1008, "hello required");
    if (body.type === "context") { if (body.context.mode !== this.context.mode || body.context.sessionId !== this.context.sessionId) return this.close(1008, "context mismatch"); this.context = body.context; }
    if (body.type === "command-result") await this.canonical(body);
  }
  async startBridges() {
    this.stt = new SpeechBridge({ projectId: this.config.projectId, onTranscript: (text, final) => this.transcript(text, final), onError: error => { this.log("stt_error", error); send(this.ws, { type: "status", status: "listening", message: "Speech transcription degraded; semantic routing remains available." }); } });
    this.gemini = new GeminiLiveBridge(this.config, { onAudio: (data, mimeType) => send(this.ws, { type: "audio", data, mimeType, output: "gemini", turn: this.turn }), onOutputActivity: () => this.geminiOutputActivity(), onInputTranscript: text => { this.geminiTranscript = text.slice(0, 500); }, onFunction: (call, context) => this.functionCall(call, context), onError: error => { this.log("gemini_error", error); send(this.ws, { type: "status", status: "listening", message: "Semantic conversation is unavailable; deterministic voice commands still work." }); } });
    await Promise.allSettled([this.stt.start(this.sampleRate), this.gemini.start(this.context, this.sampleRate)]);
  }
  transcript(text, final) {
    const utteranceId = final ? randomUUID() : `partial-${this.turn + 1}`;
    send(this.ws, { type: "transcript", text, final, utteranceId });
    if (!final) return;
    this.lastFinalTranscript = text;
    this.turn += 1; this.gemini?.unsuppress();
    const command = routeDeterministic(text, this.context, utteranceId);
    if (!command || !commandAllowed(command, this.context)) { this.scheduleFallback(utteranceId, text); return; }
    this.gemini?.suppress(); this.route(command, "deterministic");
  }
  functionCall(call, context) {
    this.clearFallback();
    const utteranceId = randomUUID(); const transcript = this.lastFinalTranscript || this.geminiTranscript || "Voice request";
    let command = null;
    if (call.name === "route_history") command = { kind: "history", factIds: call.args?.factIds || [], utteranceId, transcript };
    if (call.name === "patient_instruction") command = { kind: "patient-instruction", instructionId: call.args?.instructionId, utteranceId, transcript };
    if (call.name === "encounter_action") command = { kind: "encounter-action", actionId: call.args?.actionId, utteranceId, transcript };
    if (call.name === "practice_action") command = { kind: "practice-action", lessonId: context.lessonId, actionId: call.args?.actionId, utteranceId, transcript };
    if (command && commandAllowed(command, context)) this.route(command, "semantic");
  }
  route(command, routeClass) {
    if (this.seenUtterances.has(command.utteranceId)) return;
    this.seenUtterances.add(command.utteranceId); this.routedAt.set(command.utteranceId, Date.now()); send(this.ws, { type: "command", command, turn: this.turn });
    this.log("route", null, { routeClass });
  }
  scheduleFallback(utteranceId, transcript) {
    this.clearFallback();
    this.log("unmatched_turn", null);
    const timer = setTimeout(() => {
      if (this.closed || this.seenUtterances.has(utteranceId)) return;
      this.pendingFallback = null;
      this.gemini?.suppress();
      this.log("fallback_timeout", null, { fallbackDelayMs: 2000 });
      this.route({ kind: "patient-reply", replyId: "unknown", utteranceId, transcript }, "fallback");
    }, 2000);
    this.pendingFallback = { timer, utteranceId };
  }
  geminiOutputActivity() {
    if (!this.pendingFallback) return;
    this.log("gemini_output_started", null);
    this.clearFallback();
  }
  clearFallback() {
    if (!this.pendingFallback) return;
    clearTimeout(this.pendingFallback.timer);
    this.pendingFallback = null;
  }
  async canonical(body) {
    if (!this.seenUtterances.has(body.utteranceId) || !body.result.accepted || body.result.suppressAudio) { send(this.ws, { type: "status", status: "listening" }); return; }
    const routedAt = this.routedAt.get(body.utteranceId); this.routedAt.delete(body.utteranceId);
    if (body.clientAudio) { this.log("canonical_audio", null, { source: "preloaded", responseLatencyMs: routedAt ? Date.now() - routedAt : undefined }); return; }
    try {
      send(this.ws, { type: "status", status: "speaking" });
      const audio = await this.speech.synthesize(body.result.spokenText, body.result.cacheKey);
      this.log("canonical_audio", null, { source: "runtime", responseLatencyMs: routedAt ? Date.now() - routedAt : undefined });
      send(this.ws, { type: "audio", ...audio, output: "canonical", turn: this.turn });
    } catch (error) { this.log("tts_error", error); send(this.ws, { type: "error", code: "TTS_UNAVAILABLE", message: "Patient audio is unavailable. The transcript and typed interaction remain usable." }); }
  }
  audit() {
    const now = Date.now();
    if (now - this.startedAt >= this.config.sessionLimitMs) this.close(1000, "session limit");
    else if (now - this.lastAudioAt >= this.config.inactivityLimitMs) this.close(1000, "audio inactivity");
  }
  log(event, error, extra = {}) { console.log(JSON.stringify({ component: "voice", event, code: error?.code || error?.name, durationMs: Date.now() - this.startedAt, ...this.metadata, ...extra })); }
  close(code = 1000, reason = "complete") { if (this.closed) return; this.closed = true; this.clearFallback(); this.stt?.close(); this.gemini?.close(); try { this.ws.close(code, reason); } catch {} this.log("session_end", null, { closeCode: code }); }
}
