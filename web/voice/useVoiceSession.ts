import { voiceAssetMatches, type VoiceAsset } from "./audioAssets";
import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceCommand, VoiceCommandResult, VoiceContext, VoiceStatus } from "./contracts";
import { validVoiceCommand } from "./contracts";
import { VOICE_AVAILABLE } from "./config";
import { VoiceOutputArbiter } from "./outputArbiter";
import { announcePatientAudio, PATIENT_AUDIO_START } from "./patientAudioChannel";
import { perfCount } from "../perf/perfFlag";

type ServerMessage =
  | { type: "status"; status: VoiceStatus; message?: string; voiceName?: string }
  | { type: "transcript"; text: string; final: boolean; utteranceId: string; turn: number }
  | { type: "turn"; turn: number }
  | { type: "command"; command: VoiceCommand; turn: number }
  | { type: "audio"; data: string; mimeType: string; output: "canonical" | "gemini"; turn: number }
  | { type: "error"; code: string; message: string };

type VoiceAssetIndex = Record<string, VoiceAsset>;
type VoiceAssetIndexRequest = { signal?: AbortSignal; promise: Promise<VoiceAssetIndex | null> };

const VOICE_ASSET_FILE = /^[a-zA-Z0-9_-]+\.mp3$/;
const VOICE_ASSET_HASH = /^[a-f0-9]{64}$/;
const VOICE_SOCKET_BACKPRESSURE_BYTES = 256 * 1024;
type PcmWorkletFrame = { pcm: ArrayBuffer; rms: number };

function validatedVoiceAssetIndex(value: unknown): VoiceAssetIndex | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const index: VoiceAssetIndex = {};
  for (const [key, candidate] of Object.entries(value)) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const asset = candidate as Partial<VoiceAsset>;
    if (typeof asset.file !== "string" || !VOICE_ASSET_FILE.test(asset.file)
      || typeof asset.textHash !== "string" || !VOICE_ASSET_HASH.test(asset.textHash)
      || typeof asset.voice !== "string" || !asset.voice) continue;
    index[key] = { file: asset.file, textHash: asset.textHash, voice: asset.voice };
  }
  return Object.keys(index).length ? index : null;
}

function voiceAssetUrl(asset: VoiceAsset) {
  return `/audio/voice/${encodeURIComponent(asset.file)}?v=${asset.textHash.slice(0, 16)}`;
}

export function useVoiceSession(context: VoiceContext, onCommand: (command: VoiceCommand) => VoiceCommandResult | Promise<VoiceCommandResult>) {
  const [status, setStatus] = useState<VoiceStatus>("locked");
  const [message, setMessage] = useState("Select enable voice, then allow microphone access.");
  const [partial, setPartial] = useState("");
  const socket = useRef<WebSocket | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const audioContext = useRef<AudioContext | null>(null);
  const source = useRef<MediaStreamAudioSourceNode | null>(null);
  const worklet = useRef<AudioWorkletNode | null>(null);
  const reconnect = useRef<number | undefined>(undefined);
  const attempts = useRef(0);
  const manuallyMuted = useRef(true);
  const mounted = useRef(false);
  const generation = useRef(0);
  const starting = useRef<number | null>(null);
  const startupAbort = useRef<AbortController | null>(null);
  const contextKey = JSON.stringify(context);
  const contextKeyRef = useRef(contextKey);
  contextKeyRef.current = contextKey;
  const contextRef = useRef(context);
  const commandRef = useRef(onCommand);
  const arbiter = useRef(new VoiceOutputArbiter());
  const assetIndex = useRef<VoiceAssetIndex | null>(null);
  const assetIndexRequest = useRef<VoiceAssetIndexRequest | null>(null);
  const voiceName = useRef<string | undefined>(undefined);
  contextRef.current = context;
  commandRef.current = onCommand;

  const stopPlayback = useCallback(() => {
    arbiter.current.stop();
    document.querySelectorAll<HTMLAudioElement>("audio[data-opto-voice]").forEach((audio) => { audio.pause(); audio.remove(); });
  }, []);

  const setCaptureActive = useCallback((active: boolean) => {
    worklet.current?.port.postMessage({ type: "active", active });
  }, []);

  useEffect(() => {
    const onPatientAudio = (event: Event) => { if ((event as CustomEvent).detail === "report") stopPlayback(); };
    window.addEventListener(PATIENT_AUDIO_START, onPatientAudio);
    return () => window.removeEventListener(PATIENT_AUDIO_START, onPatientAudio);
  }, [stopPlayback]);

  const play = useCallback((data: string, mimeType: string, output: "canonical" | "gemini", outputTurn: number) => {
    const outputArbiter = arbiter.current;
    if (!outputArbiter.startTurn(outputTurn)) return;
    const current = () => mounted.current && !manuallyMuted.current && arbiter.current === outputArbiter && outputArbiter.isCurrent(outputTurn);
    const audio = new Audio(`data:${mimeType};base64,${data}`);
    audio.dataset.optoVoice = output;
    const stop = () => { audio.pause(); audio.remove(); };
    if (output === "canonical") arbiter.current.preferCanonical(outputTurn);
    if (!arbiter.current.play(outputTurn, output, stop)) return;
    announcePatientAudio("voice");
    setStatus("speaking");
    document.body.append(audio);
    audio.addEventListener("ended", () => { audio.remove(); if (current()) setStatus("listening"); }, { once: true });
    void audio.play().catch(() => { audio.remove(); if (current()) { setStatus("error"); setMessage("Patient audio could not play. Check browser audio permissions."); } });
  }, []);

  const loadVoiceAssetIndex = useCallback((signal?: AbortSignal): Promise<VoiceAssetIndex | null> => {
    if (assetIndex.current) return Promise.resolve(assetIndex.current);
    const pending = assetIndexRequest.current;
    if (pending && !pending.signal?.aborted) return pending.promise;
    let request!: VoiceAssetIndexRequest;
    const promise = (async () => {
      try {
        const response = await fetch("/audio/voice/index.json", { credentials: "same-origin", cache: "force-cache", signal });
        if (!response.ok || signal?.aborted) return null;
        const index = validatedVoiceAssetIndex(await response.json());
        if (!index || signal?.aborted || !mounted.current) return null;
        assetIndex.current = index;
        return index;
      } catch {
        return null;
      } finally {
        if (assetIndexRequest.current === request) assetIndexRequest.current = null;
      }
    })();
    request = { signal, promise };
    assetIndexRequest.current = request;
    return promise;
  }, []);

  const playIndexedAsset = useCallback(async (keys: string[], outputTurn: number, spokenText: string) => {
    // Compound replies use runtime TTS; a cache identifier alone never proves text identity.
    if (keys.length !== 1) return false;
    const sessionGeneration = generation.current;
    const outputArbiter = arbiter.current;
    const current = () => mounted.current && !manuallyMuted.current && generation.current === sessionGeneration
      && arbiter.current === outputArbiter && outputArbiter.isCurrent(outputTurn);
    const index = assetIndex.current ?? await loadVoiceAssetIndex(startupAbort.current?.signal);
    const asset = index?.[keys[0]];
    if (!current() || !asset || !await voiceAssetMatches(asset, spokenText, voiceName.current) || !current()) return false;
    if (!outputArbiter.startTurn(outputTurn)) return false;
    const audio = new Audio(voiceAssetUrl(asset));
    audio.dataset.optoVoice = "canonical";
    let stopped = false;
    const stop = () => { stopped = true; audio.pause(); audio.remove(); };
    outputArbiter.preferCanonical(outputTurn);
    if (!outputArbiter.play(outputTurn, "canonical", stop)) return false;
    announcePatientAudio("voice");
    setStatus("speaking");
    document.body.append(audio);
    audio.addEventListener("ended", () => { audio.remove(); if (!stopped && current()) setStatus("listening"); }, { once: true });
    try { await audio.play(); return current(); }
    catch { stop(); if (outputArbiter.isCurrent(outputTurn)) outputArbiter.stop(); return false; }
  }, [loadVoiceAssetIndex]);

  const connect = useCallback(() => {
    if (!mounted.current || manuallyMuted.current || !stream.current) return;
    setCaptureActive(false);
    if (reconnect.current !== undefined) clearTimeout(reconnect.current);
    reconnect.current = undefined;
    const previous = socket.current;
    socket.current = null;
    previous?.close(1000, "replaced");
    stopPlayback(); arbiter.current = new VoiceOutputArbiter();
    setStatus(attempts.current ? "reconnecting" : "connecting");
    const url = new URL("/api/voice/live", window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    socket.current = ws;
    const connectionContext = contextKeyRef.current;
    const valid = () => mounted.current && !manuallyMuted.current && socket.current === ws && contextKeyRef.current === connectionContext;
    const seenCommands = new Set<string>();
    ws.addEventListener("open", () => {
      if (!valid()) { ws.close(1000, "obsolete"); return; }
      attempts.current = 0;
      ws.send(JSON.stringify({ type: "hello", context: contextRef.current, sampleRate: audioContext.current?.sampleRate ?? 48000 }));
      setCaptureActive(true);
      setStatus("listening"); setMessage("Microphone active. Speaking interrupts patient audio.");
    });
    ws.addEventListener("message", async (event) => {
      if (!valid() || typeof event.data !== "string") return;
      let data: ServerMessage;
      try { data = JSON.parse(event.data) as ServerMessage; } catch { return; }
      if (data.type === "turn" && arbiter.current.startTurn(data.turn)) setStatus("listening");
      if (data.type === "status") { if (data.voiceName) voiceName.current = data.voiceName; setStatus(data.status); if (data.message) setMessage(data.message); }
      if (data.type === "transcript") { arbiter.current.startTurn(data.turn); setPartial(data.final ? "" : data.text); }
      if (data.type === "audio") play(data.data, data.mimeType, data.output, data.turn);
      if (data.type === "error") { setStatus("error"); setMessage(data.message); }
      if (data.type === "command" && validVoiceCommand(data.command)) {
        if (seenCommands.has(data.command.utteranceId) || !arbiter.current.startTurn(data.turn)) return;
        seenCommands.add(data.command.utteranceId);
        setStatus("thinking");
        try {
          const result = await commandRef.current(data.command);
          if (!valid() || !arbiter.current.isCurrent(data.turn)) return;
          const keys = result.cacheKeys?.length ? result.cacheKeys : result.cacheKey ? [result.cacheKey] : [];
          const clientAudio = !result.suppressAudio && keys.length > 0 ? await playIndexedAsset(keys, data.turn, result.spokenText) : false;
          if (!valid() || !arbiter.current.isCurrent(data.turn)) return;
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "command-result", utteranceId: data.command.utteranceId, result, clientAudio }));
        } catch {
          if (valid() && arbiter.current.isCurrent(data.turn)) { setStatus("error"); setMessage("Voice action failed. Use the clinical controls or enable voice again."); }
        }
      }
    });
    ws.addEventListener("close", (event) => {
      if (!valid()) return;
      setCaptureActive(false);
      socket.current = null; stopPlayback();
      if (event.code === 1000) { setStatus("error"); setMessage("Voice session ended. Select enable voice to reconnect."); return; }
      if (!stream.current) return;
      attempts.current += 1;
      if (attempts.current > 5) { setStatus("error"); setMessage("Voice disconnected. Typed controls remain available; select reconnect to try again."); return; }
      setStatus("reconnecting");
      const delay = Math.min(8000, 500 * 2 ** (attempts.current - 1));
      reconnect.current = window.setTimeout(connect, delay);
    });
  }, [play, playIndexedAsset, setCaptureActive, stopPlayback]);

  const release = useCallback(() => {
    ++generation.current; starting.current = null; manuallyMuted.current = true;
    setCaptureActive(false);
    startupAbort.current?.abort(); startupAbort.current = null;
    if (reconnect.current !== undefined) clearTimeout(reconnect.current);
    reconnect.current = undefined;
    const ws = socket.current; socket.current = null; ws?.close(1000, "released");
    stream.current?.getTracks().forEach(track => track.stop()); stream.current = null;
    if (worklet.current) { worklet.current.port.onmessage = null; worklet.current.disconnect(); }
    worklet.current = null; source.current?.disconnect(); source.current = null;
    const audio = audioContext.current; audioContext.current = null;
    if (audio) void audio.close().catch(() => undefined);
    stopPlayback();
  }, [setCaptureActive, stopPlayback]);

  const enable = useCallback(async () => {
    if (!mounted.current || starting.current !== null) return false;
    release();
    const token = generation.current;
    starting.current = token; manuallyMuted.current = false;
    const abort = new AbortController(); startupAbort.current = abort;
    const valid = () => mounted.current && generation.current === token && !abort.signal.aborted;
    setStatus("connecting"); setPartial(""); attempts.current = 0;
    let media: MediaStream | null = null;
    let audio: AudioContext | null = null;
    let adopted = false;
    try {
      const response = await fetch("/api/voice/access", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: "{}", signal: abort.signal });
      if (!valid()) return false;
      if (!response.ok) throw new Error("Voice access could not be initialized.");
      media = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      if (!valid()) return false;
      audio = new AudioContext({ latencyHint: "interactive" });
      // Adopt immediately so mute releases the microphone while worklet loading is pending.
      stream.current = media; audioContext.current = audio; adopted = true;
      await audio.audioWorklet.addModule("/voice/pcm-worklet.js");
      if (!valid()) return false;
      const node = new AudioWorkletNode(audio, "opto-pcm-capture"); worklet.current = node;
      const input = audio.createMediaStreamSource(media); source.current = input;
      input.connect(node);
      node.port.onmessage = (event: MessageEvent<PcmWorkletFrame>) => {
        if (!valid() || socket.current?.readyState !== WebSocket.OPEN || manuallyMuted.current) return;
        const { pcm, rms } = event.data;
        if (!(pcm instanceof ArrayBuffer) || !Number.isFinite(rms)) return;
        if (rms > 1400) stopPlayback();
        if (socket.current.bufferedAmount > VOICE_SOCKET_BACKPRESSURE_BYTES) { perfCount("PCM frames dropped"); return; }
        perfCount("PCM frames emitted");
        socket.current.send(pcm);
      };
      connect(); void loadVoiceAssetIndex(abort.signal); return true;
    } catch (reason) {
      if (valid()) {
        release();
        setStatus("error"); setMessage(reason instanceof DOMException && reason.name === "NotAllowedError" ? "Microphone permission was denied. Allow microphone access in browser settings; typed controls remain available." : reason instanceof Error ? reason.message : "Voice could not start. Typed controls remain available.");
      }
      return false;
    } finally {
      if (!adopted) {
        media?.getTracks().forEach(track => track.stop());
        if (audio) void audio.close().catch(() => undefined);
      }
      if (starting.current === token) starting.current = null;
    }
  }, [connect, loadVoiceAssetIndex, release, stopPlayback]);

  const mute = useCallback(() => {
    release(); setPartial("");
    setStatus("muted"); setMessage("Microphone released. Select enable voice to start a new voice session.");
  }, [release]);

  useEffect(() => {
    // A new lesson/case gets a fresh connection and server turn namespace.
    if (stream.current && starting.current === null) connect();
  }, [contextKey, connect]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false; release();
    };
  }, [release]);
  useEffect(() => {
    const suspend = () => mute();
    window.addEventListener("pagehide", suspend);
    return () => window.removeEventListener("pagehide", suspend);
  }, [mute]);

  return { enabled: VOICE_AVAILABLE, status, message, partial, enable, mute, reconnect: connect };
}
