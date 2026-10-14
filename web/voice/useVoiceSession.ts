import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceCommand, VoiceCommandResult, VoiceContext, VoiceStatus } from "./contracts";
import { validVoiceCommand } from "./contracts";
import { VOICE_AVAILABLE } from "./config";
import { VoiceOutputArbiter } from "./outputArbiter";

type ServerMessage =
  | { type: "status"; status: VoiceStatus; message?: string }
  | { type: "transcript"; text: string; final: boolean; utteranceId: string }
  | { type: "command"; command: VoiceCommand; turn: number }
  | { type: "audio"; data: string; mimeType: string; output: "canonical" | "gemini"; turn: number }
  | { type: "error"; code: string; message: string };

type VoiceAssetIndex = Record<string, { file: string; textHash: string; voice: string }>;

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
  const manuallyMuted = useRef(false);
  const contextRef = useRef(context);
  const commandRef = useRef(onCommand);
  const arbiter = useRef(new VoiceOutputArbiter());
  const assetUrls = useRef(new Map<string, string>());
  contextRef.current = context;
  commandRef.current = onCommand;

  const stopPlayback = useCallback(() => {
    arbiter.current.stop();
    document.querySelectorAll<HTMLAudioElement>("audio[data-opto-voice]").forEach((audio) => { audio.pause(); audio.remove(); });
  }, []);

  const play = useCallback((data: string, mimeType: string, output: "canonical" | "gemini", outputTurn: number) => {
    if (!arbiter.current.startTurn(outputTurn)) return;
    const audio = new Audio(`data:${mimeType};base64,${data}`);
    audio.dataset.optoVoice = output;
    const stop = () => { audio.pause(); audio.remove(); };
    if (output === "canonical") arbiter.current.preferCanonical(outputTurn);
    if (!arbiter.current.play(outputTurn, output, stop)) return;
    setStatus("speaking");
    document.body.append(audio);
    audio.addEventListener("ended", () => { audio.remove(); if (!manuallyMuted.current) setStatus("listening"); }, { once: true });
    void audio.play().catch(() => { audio.remove(); setStatus("error"); setMessage("Patient audio could not play. Check browser audio permissions."); });
  }, []);

  const preloadVoiceAssets = useCallback(async () => {
    if (assetUrls.current.size) return;
    try {
      const indexResponse = await fetch("/audio/voice/index.json", { credentials: "same-origin", cache: "force-cache" });
      if (!indexResponse.ok) return;
      const index = await indexResponse.json() as VoiceAssetIndex;
      await Promise.all(Object.entries(index).map(async ([key, asset]) => {
        if (!asset || typeof asset.file !== "string" || !/^[a-zA-Z0-9_-]+\.mp3$/.test(asset.file)) return;
        const response = await fetch(`/audio/voice/${asset.file}`, { credentials: "same-origin", cache: "force-cache" });
        if (!response.ok) return;
        assetUrls.current.set(key, URL.createObjectURL(await response.blob()));
      }));
    } catch { /* Runtime TTS remains the fallback when static audio is unavailable. */ }
  }, []);

  const playPreloaded = useCallback(async (keys: string[], outputTurn: number) => {
    const urls = keys.flatMap(key => {
      const url = assetUrls.current.get(key);
      return url ? [url] : [];
    });
    if (!urls.length || urls.length !== keys.length || !arbiter.current.startTurn(outputTurn)) return false;
    let current: HTMLAudioElement | null = null;
    let stopped = false;
    const stop = () => { stopped = true; current?.pause(); current?.remove(); };
    arbiter.current.preferCanonical(outputTurn);
    if (!arbiter.current.play(outputTurn, "canonical", stop)) return false;
    setStatus("speaking");
    const playAt = async (index: number): Promise<void> => {
      if (stopped || index >= urls.length) {
        if (!stopped && !manuallyMuted.current) setStatus("listening");
        return;
      }
      const audio = new Audio(urls[index]);
      current = audio; audio.dataset.optoVoice = "canonical"; document.body.append(audio);
      audio.addEventListener("ended", () => { audio.remove(); void playAt(index + 1); }, { once: true });
      await audio.play();
    };
    try { await playAt(0); return true; }
    catch { stop(); arbiter.current.stop(); return false; }
  }, []);

  const connect = useCallback(() => {
    if (manuallyMuted.current || !stream.current) return;
    setStatus(attempts.current ? "reconnecting" : "connecting");
    const url = new URL("/api/voice/live", window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(url);
    ws.binaryType = "arraybuffer";
    socket.current = ws;
    ws.addEventListener("open", () => {
      attempts.current = 0;
      ws.send(JSON.stringify({ type: "hello", context: contextRef.current, sampleRate: audioContext.current?.sampleRate ?? 48000 }));
      setStatus("listening"); setMessage("Microphone active. Speaking interrupts patient audio.");
    });
    ws.addEventListener("message", async (event) => {
      if (typeof event.data !== "string") return;
      let data: ServerMessage;
      try { data = JSON.parse(event.data) as ServerMessage; } catch { return; }
      if (data.type === "status") { setStatus(data.status); if (data.message) setMessage(data.message); }
      if (data.type === "transcript") { setPartial(data.final ? "" : data.text); }
      if (data.type === "audio") play(data.data, data.mimeType, data.output, data.turn);
      if (data.type === "error") { setStatus("error"); setMessage(data.message); }
      if (data.type === "command" && validVoiceCommand(data.command)) {
        setStatus("thinking");
        const result = await commandRef.current(data.command);
        const keys = result.cacheKeys?.length ? result.cacheKeys : result.cacheKey ? [result.cacheKey] : [];
        const clientAudio = result.accepted && keys.length > 0 ? await playPreloaded(keys, data.turn) : false;
        if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "command-result", utteranceId: data.command.utteranceId, result, clientAudio }));
      }
    });
    ws.addEventListener("close", (event) => {
      if (socket.current === ws) socket.current = null;
      if (manuallyMuted.current || !stream.current || event.code === 1000) return;
      attempts.current += 1;
      if (attempts.current > 5) { setStatus("error"); setMessage("Voice disconnected. Typed controls remain available; select reconnect to try again."); return; }
      setStatus("reconnecting");
      const delay = Math.min(8000, 500 * 2 ** (attempts.current - 1));
      reconnect.current = window.setTimeout(connect, delay);
    });
  }, [play, playPreloaded]);

  const enable = useCallback(async () => {
    setStatus("connecting");
    try {
      const response = await fetch("/api/voice/access", { method: "POST", credentials: "same-origin", headers: { "content-type": "application/json" }, body: "{}" });
      if (!response.ok) throw new Error("Voice access could not be initialized.");
      const media = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      const audio = new AudioContext({ latencyHint: "interactive" });
      await audio.audioWorklet.addModule("/voice/pcm-worklet.js");
      const node = new AudioWorkletNode(audio, "opto-pcm-capture");
      const input = audio.createMediaStreamSource(media);
      input.connect(node);
      node.port.onmessage = (event: MessageEvent<ArrayBuffer>) => {
        if (socket.current?.readyState !== WebSocket.OPEN || manuallyMuted.current) return;
        const samples = new Int16Array(event.data);
        let energy = 0;
        for (const sample of samples) energy += sample * sample;
        // Local barge-in is intentionally conservative; the server performs
        // the authoritative voice-activity decision.
        if (Math.sqrt(energy / Math.max(1, samples.length)) > 1400) stopPlayback();
        socket.current.send(event.data);
      };
      stream.current = media; audioContext.current = audio; source.current = input; worklet.current = node;
      manuallyMuted.current = false; await preloadVoiceAssets(); connect(); return true;
    } catch (reason) {
      setStatus("error"); setMessage(reason instanceof DOMException && reason.name === "NotAllowedError" ? "Microphone permission was denied. Allow microphone access in browser settings; typed controls remain available." : reason instanceof Error ? reason.message : "Voice could not start. Typed controls remain available.");
      return false;
    }
  }, [connect, preloadVoiceAssets, stopPlayback]);

  const mute = useCallback(() => {
    manuallyMuted.current = true; stopPlayback(); socket.current?.close(1000, "muted"); socket.current = null;
    stream.current?.getTracks().forEach((track) => track.stop()); stream.current = null;
    worklet.current?.disconnect(); source.current?.disconnect(); void audioContext.current?.close(); audioContext.current = null;
    setStatus("muted"); setMessage("Microphone released. Select enable voice to start a new voice session.");
  }, [stopPlayback]);

  useEffect(() => {
    if (socket.current?.readyState === WebSocket.OPEN) socket.current.send(JSON.stringify({ type: "context", context }));
  }, [context]);

  useEffect(() => () => { manuallyMuted.current = true; if (reconnect.current) clearTimeout(reconnect.current); socket.current?.close(1000, "unmount"); stream.current?.getTracks().forEach((track) => track.stop()); worklet.current?.disconnect(); source.current?.disconnect(); void audioContext.current?.close(); stopPlayback(); assetUrls.current.forEach(url => URL.revokeObjectURL(url)); assetUrls.current.clear(); }, [stopPlayback]);
  useEffect(() => {
    const suspend = () => { if (stream.current) mute(); };
    window.addEventListener("pagehide", suspend);
    return () => window.removeEventListener("pagehide", suspend);
  }, [mute]);

  return { enabled: VOICE_AVAILABLE, status, message, partial, enable, mute, reconnect: connect };
}
