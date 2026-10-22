import { randomUUID } from "node:crypto";
import { routeDeterministic } from "./router.mjs";
import { commandAllowed, validClientMessage } from "./validation.mjs";
import { SpeechBridge, GeminiLiveBridge } from "./google.mjs";

const send = (ws, value) => { if (ws.readyState === 1) ws.send(JSON.stringify(value)); };

export class VoiceSession {
  constructor(ws, config, speech, metadata = {}, bridges = {}) {
    this.ws = ws; this.config = config; this.speech = speech; this.metadata = metadata;
    this.startedAt = Date.now(); this.lastAudioAt = Date.now(); this.turn = 0; this.seenUtterances = new Set(); this.routedAt = new Map(); this.closed = false; this.pendingFallback = null;
    this.bridges = { speech: options => new SpeechBridge(options), semantic: (config, callbacks) => new GeminiLiveBridge(config, callbacks), ...bridges };
    this.inSpeech = false; this.currentUtterance = null; this.resolvedTurn = null;
  }
  async handle(message, isBinary) {
    if (this.closed) return;
    if (isBinary) {
      const data = Buffer.from(message);
      if (!this.context || data.length > this.config.maxAudioFrameBytes) return this.close(1009, "invalid audio frame");
      this.lastAudioAt = Date.now(); this.stt?.write(data); return;
    }
    if (Buffer.byteLength(message) > this.config.maxJsonBytes) return this.close(1009, "message too large");
    let body; try { body = JSON.parse(message.toString()); } catch { return this.close(1007, "invalid json"); }
    if (!validClientMessage(body)) return this.close(1008, "invalid message");
    if (body.type === "hello") {
      if (this.context) return this.close(1008, "already initialized");
      this.context = body.context; this.sampleRate = body.sampleRate;
      await this.startBridges(); if (!this.closed && !this.stt?.closed) send(this.ws, { type: "status", status: "listening", voiceName: this.config.voiceName }); return;
    }
    if (!this.context) return this.close(1008, "hello required");
    if (body.type === "context") { if (body.context.mode !== this.context.mode || body.context.sessionId !== this.context.sessionId) return this.close(1008, "context mismatch"); this.context = body.context; this.invalidateTurn(); }
    if (body.type === "command-result") await this.canonical(body);
  }
  async startBridges() {
    this.stt = this.bridges.speech({ projectId: this.config.projectId,
      onTranscript: (text, final) => this.transcript(text, final),
      onError: error => { if (!this.closed) { this.log("stt_error", error); send(this.ws, { type: "error", code: "STT_UNAVAILABLE", message: "Speech transcription is unavailable. Use typed controls or enable voice again." }); } },
    });
    await this.stt.start(this.sampleRate);
    if (this.closed) this.stt.close();
  }
  invalidateTurn() {
    this.clearFallback(); this.gemini?.close(); this.gemini = null;
    this.routedAt.clear(); this.seenUtterances.clear();
    ++this.turn; this.inSpeech = false; this.currentUtterance = null; this.resolvedTurn = null;
    if (!this.closed) send(this.ws, { type: "turn", turn: this.turn });
  }
  transcript(text, final) {
    if (this.closed || !this.context || !text.trim()) return;
    if (!this.inSpeech) {
      this.invalidateTurn(); this.inSpeech = true; this.currentUtterance = randomUUID();
    }
    const utteranceId = this.currentUtterance;
    send(this.ws, { type: "transcript", text, final, utteranceId, turn: this.turn });
    if (!final) return;
    this.inSpeech = false;
    const command = routeDeterministic(text, this.context, utteranceId);
    if (command && commandAllowed(command, this.context)) { this.route(command, "deterministic"); return; }
    // One finalized STT utterance owns one semantic request; no second audio router.
    const turn = this.turn;
    this.scheduleFallback(utteranceId, text, turn);
    void this.startSemantic(text, utteranceId, turn);
  }
  async startSemantic(text, utteranceId, turn) {
    const context = this.context;
    const valid = () => !this.closed && this.turn === turn && this.resolvedTurn !== turn;
    const bridge = this.bridges.semantic(this.config, {
      onFunction: call => { if (valid()) this.functionCall(call, context, utteranceId, text, turn); },
      onAudio: (data, mimeType) => {
        if (!valid()) return;
        this.resolvedTurn = turn; this.clearFallback();
        send(this.ws, { type: "audio", data, mimeType, output: "gemini", turn });
        bridge.close();
      },
      onError: error => { if (valid()) this.log("gemini_error", error); },
    });
    this.gemini = bridge;
    try {
      await bridge.start(context, this.sampleRate);
      if (!valid()) { bridge.close(); return; }
      bridge.sendText(text);
    } catch (error) { bridge.close(); if (valid()) this.log("gemini_error", error); }
  }
  functionCall(call, context, utteranceId, transcript, turn) {
    if (this.closed || turn !== this.turn || context !== this.context || this.resolvedTurn === turn) return;
    let command = null;
    if (call.name === "route_history") command = { kind: "history", factIds: call.args?.factIds || [], utteranceId, transcript };
    if (call.name === "patient_instruction") command = { kind: "patient-instruction", instructionId: call.args?.instructionId, utteranceId, transcript };
    if (call.name === "encounter_action") command = { kind: "encounter-action", actionId: call.args?.actionId, utteranceId, transcript };
    if (call.name === "practice_action") command = { kind: "practice-action", lessonId: context.lessonId, actionId: call.args?.actionId, utteranceId, transcript };
    if (command && commandAllowed(command, this.context)) this.route(command, "semantic");
  }
  route(command, routeClass) {
    if (this.closed || this.resolvedTurn === this.turn || this.seenUtterances.has(command.utteranceId)) return;
    this.resolvedTurn = this.turn; this.clearFallback(); this.gemini?.close();
    this.seenUtterances.add(command.utteranceId);
    this.routedAt.set(command.utteranceId, { at: Date.now(), turn: this.turn });
    send(this.ws, { type: "command", command, turn: this.turn });
    this.log("route", null, { routeClass });
  }
  scheduleFallback(utteranceId, transcript, turn = this.turn) {
    this.clearFallback();
    this.log("unmatched_turn", null);
    const deadlineMs = this.config.semanticResponseLimitMs ?? 8000;
    const timer = setTimeout(() => {
      if (this.closed || this.turn !== turn || this.resolvedTurn === turn) return;
      this.pendingFallback = null;
      this.log("fallback_timeout", null, { fallbackDelayMs: deadlineMs });
      this.route({ kind: "patient-reply", replyId: "unknown", utteranceId, transcript }, "fallback");
    }, deadlineMs);
    this.pendingFallback = { timer, utteranceId };
  }
  clearFallback() {
    if (!this.pendingFallback) return;
    clearTimeout(this.pendingFallback.timer);
    this.pendingFallback = null;
  }
  async canonical(body) {
    const routed = this.routedAt.get(body.utteranceId);
    if (this.closed || !routed || routed.turn !== this.turn) return;
    // Consume before awaiting: replayed acknowledgements cannot synthesize twice.
    this.routedAt.delete(body.utteranceId);
    const current = () => !this.closed && this.turn === routed.turn;
    if (body.result.suppressAudio) { send(this.ws, { type: "status", status: "listening" }); return; }
    if (body.clientAudio) { this.log("canonical_audio", null, { source: "preloaded", responseLatencyMs: Date.now() - routed.at }); return; }
    try {
      send(this.ws, { type: "status", status: "speaking" });
      const audio = await this.speech.synthesize(body.result.spokenText, body.result.cacheKey);
      if (!current()) return;
      this.log("canonical_audio", null, { source: "runtime", responseLatencyMs: Date.now() - routed.at });
      send(this.ws, { type: "audio", ...audio, output: "canonical", turn: routed.turn });
    } catch (error) {
      if (!current()) return;
      this.log("tts_error", error); send(this.ws, { type: "error", code: "TTS_UNAVAILABLE", message: "Patient audio is unavailable. The transcript and typed interaction remain usable." });
    }
  }
  audit() {
    const now = Date.now();
    if (now - this.startedAt >= this.config.sessionLimitMs) this.close(1000, "session limit");
    else if (now - this.lastAudioAt >= this.config.inactivityLimitMs) this.close(1000, "audio inactivity");
  }
  log(event, error, extra = {}) { console.log(JSON.stringify({ component: "voice", event, code: error?.code || error?.name, durationMs: Date.now() - this.startedAt, ...this.metadata, ...extra })); }
  close(code = 1000, reason = "complete") { if (this.closed) return; this.closed = true; this.invalidateTurn(); this.stt?.close(); try { this.ws.close(code, reason); } catch {} this.log("session_end", null, { closeCode: code }); }
}
