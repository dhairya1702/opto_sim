import { createElement } from "react";
import { act } from "@react-three/fiber";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clinic } from "./helpers/xrClinicHarness";
import { useVoiceSession } from "../voice/useVoiceSession";
import type { VoiceCommand, VoiceCommandResult, VoiceContext } from "../voice/contracts";
const deferred = <T,>() => { let resolve!: (value: T) => void; let reject!: (error: unknown) => void; const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { vi.useRealTimers(); await dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });
async function setup() {
  const media = { getTracks: () => [track] }, track = { stop: vi.fn() };
  const getUserMedia = vi.fn(async () => media);
  const addModule = vi.fn(async () => {}), audioClose = vi.fn(async () => {});
  const disconnect = vi.fn(), port = { onmessage: null as ((event: MessageEvent) => void) | null, postMessage: vi.fn() };
  const windowMock = Object.assign(new EventTarget(), { location: { href: "https://opto.test" }, setTimeout: globalThis.setTimeout });
  vi.stubGlobal("window", windowMock);
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  const fetchMock = vi.fn(async (url: string) => ({ ok: url === "/api/voice/access", json: async () => ({}) }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("AudioContext", class {
    sampleRate = 48000; audioWorklet = { addModule }; close = audioClose;
    createMediaStreamSource() { return { connect: vi.fn(), disconnect }; }
  });
  vi.stubGlobal("AudioWorkletNode", class { port = port; disconnect = disconnect; });
  const sockets: Socket[] = [];
  class Socket extends EventTarget {
    static OPEN = 1; readyState = 0; binaryType = ""; bufferedAmount = 0; send = vi.fn();
    constructor(_url: URL) { super(); sockets.push(this); }
    close = vi.fn(() => { this.readyState = 3; });
    open() { this.readyState = 1; this.dispatchEvent(new Event("open")); }
    message(value: unknown) { this.dispatchEvent(new MessageEvent("message", { data: JSON.stringify(value) })); }
  }
  vi.stubGlobal("WebSocket", Socket);
  const play = vi.fn(async () => {}), pause = vi.fn(), audioSources: string[] = [];
  vi.stubGlobal("Audio", class extends EventTarget {
    dataset = {}; play = play; pause = pause; remove = vi.fn();
    constructor(source: string) { super(); audioSources.push(source); }
  });
  let context: VoiceContext = { mode: "practice", sessionId: "session-1", lessonId: "npc", allowedActions: ["fixate-target"] };
  const command = vi.fn<(command: VoiceCommand) => VoiceCommandResult | Promise<VoiceCommandResult>>(() => ({ accepted: true, spokenText: "Okay." }));
  let voice!: ReturnType<typeof useVoiceSession>;
  function Probe() { voice = useVoiceSession(context, command); return null; }
  const sim = await clinic({ renderAdapter: () => createElement(Probe) });
  dispose = sim.dispose;
  Object.assign(document, { querySelectorAll: () => [], body: { append() {} } });
  const enable = async () => { await act(async () => { await voice.enable(); }); await act(async () => sockets.at(-1)?.open()); };
  return { voice: () => voice, command, enable, sockets, track, media, getUserMedia, addModule, audioClose, fetchMock, play, pause, audioSources, windowMock, port,
    unmount: async () => { await sim.dispose(); dispose = undefined; },
    switchLesson: async () => { context = { ...context, lessonId: "worth" }; await sim.rerender(); },
  };
}
const reply = (turn: number) => ({ type: "audio", turn, data: "reply", mimeType: "audio/mpeg", output: "canonical" });
const commandMessage = (turn: number, utteranceId = "u1") => ({ type: "command", turn, command: { kind: "practice-action", lessonId: "npc", actionId: "fixate-target", utteranceId, transcript: "Look at the target" } });

describe("mounted voice session lifecycle", () => {
  it.each(["mute", "unmount", "pagehide"] as const)("releases a microphone permission grant arriving after %s", async action => {
    const sim = await setup(), permission = deferred<typeof sim.media>(); sim.getUserMedia.mockImplementation(() => permission.promise);
    let pending!: Promise<boolean>;
    await act(async () => { pending = sim.voice().enable(); });
    expect(sim.getUserMedia).toHaveBeenCalledTimes(1);
    if (action === "unmount") await sim.unmount();
    else await act(async () => { if (action === "mute") sim.voice().mute(); else sim.windowMock.dispatchEvent(new Event("pagehide")); });
    await act(async () => { permission.resolve(sim.media); expect(await pending).toBe(false); });
    expect(sim.track.stop).toHaveBeenCalledTimes(1); expect(sim.addModule).not.toHaveBeenCalled(); expect(sim.sockets).toHaveLength(0);
  });
  it("releases adopted media immediately when muted during worklet setup", async () => {
    const sim = await setup(), worklet = deferred<void>(); sim.addModule.mockImplementation(() => worklet.promise);
    let pending!: Promise<boolean>; await act(async () => { pending = sim.voice().enable(); });
    await act(async () => sim.voice().mute());
    expect(sim.track.stop).toHaveBeenCalledTimes(1); expect(sim.audioClose).toHaveBeenCalledTimes(1);
    await act(async () => { worklet.resolve(); expect(await pending).toBe(false); });
    expect(sim.sockets).toHaveLength(0);
  });
  it("does not request microphone access after a cancelled access request", async () => {
    const sim = await setup(), access = deferred<{ ok: boolean; json: () => Promise<{}> }>(); sim.fetchMock.mockImplementation(() => access.promise);
    let pending!: Promise<boolean>; await act(async () => { pending = sim.voice().enable(); });
    await act(async () => sim.voice().mute());
    await act(async () => { access.resolve({ ok: true, json: async () => ({}) }); expect(await pending).toBe(false); });
    expect(sim.getUserMedia).not.toHaveBeenCalled(); expect(sim.sockets).toHaveLength(0);
  });
  it("does not publish a pending action result after mute", async () => {
    const sim = await setup(), result = deferred<VoiceCommandResult>(); sim.command.mockImplementation(() => result.promise);
    await sim.enable(); const ws = sim.sockets[0];
    await act(async () => ws.message(commandMessage(1)));
    await act(async () => sim.voice().mute());
    await act(async () => { result.resolve({ accepted: true, spokenText: "old" }); ws.message(reply(1)); });
    expect(sim.play).not.toHaveBeenCalled();
    expect(ws.send.mock.calls.some(([value]) => String(value).includes("command-result"))).toBe(false);
    expect(sim.voice().status).toBe("muted");
  });
  it("cleans up failed worklet startup and permits a fresh retry", async () => {
    const sim = await setup(); sim.addModule.mockRejectedValueOnce(new Error("worklet failed"));
    await act(async () => { expect(await sim.voice().enable()).toBe(false); });
    expect(sim.track.stop).toHaveBeenCalledTimes(1); expect(sim.audioClose).toHaveBeenCalledTimes(1);
    await sim.enable(); expect(sim.voice().status).toBe("listening"); expect(sim.sockets).toHaveLength(1);
  });
  it("activates capture only while the socket is ready and disables it on mute", async () => {
    const sim = await setup();
    await act(async () => { await sim.voice().enable(); });
    expect(sim.port.postMessage).toHaveBeenLastCalledWith({ type: "active", active: false });
    await act(async () => sim.sockets[0].open());
    expect(sim.port.postMessage).toHaveBeenLastCalledWith({ type: "active", active: true });
    await act(async () => sim.voice().mute());
    expect(sim.port.postMessage).toHaveBeenLastCalledWith({ type: "active", active: false });
  });
  it("sends aggregated worklet frames and drops them under socket backpressure", async () => {
    const sim = await setup(); await sim.enable(); const ws = sim.sockets[0];
    const first = new ArrayBuffer(32);
    await act(async () => sim.port.onmessage?.(new MessageEvent("message", { data: { pcm: first, rms: 900 } })));
    expect(ws.send).toHaveBeenLastCalledWith(first);
    const sentBeforeBackpressure = ws.send.mock.calls.length;
    ws.bufferedAmount = 256 * 1024 + 1;
    const second = new ArrayBuffer(32);
    await act(async () => sim.port.onmessage?.(new MessageEvent("message", { data: { pcm: second, rms: 900 } })));
    expect(ws.send).toHaveBeenCalledTimes(sentBeforeBackpressure);
  });
  it("does not create parallel startup attempts", async () => {
    const sim = await setup(), permission = deferred<typeof sim.media>(); sim.getUserMedia.mockImplementation(() => permission.promise);
    let pending!: Promise<boolean>;
    await act(async () => { pending = sim.voice().enable(); expect(await sim.voice().enable()).toBe(false); });
    await act(async () => { permission.resolve(sim.media); await pending; });
    expect(sim.getUserMedia).toHaveBeenCalledTimes(1); expect(sim.sockets).toHaveLength(1);
  });
  it("resets turn numbering on reconnect and rejects every old socket callback", async () => {
    const sim = await setup(); await sim.enable(); const old = sim.sockets[0];
    await act(async () => old.message(reply(10))); expect(sim.play).toHaveBeenCalledTimes(1);
    await act(async () => sim.voice().reconnect()); const fresh = sim.sockets[1];
    await act(async () => { fresh.open(); old.message(reply(99)); old.message(commandMessage(99)); old.open(); old.dispatchEvent(new Event("close")); fresh.message(reply(1)); });
    expect(sim.play).toHaveBeenCalledTimes(2); expect(sim.command).not.toHaveBeenCalled(); expect(sim.sockets).toHaveLength(2);
  });
  it("deduplicates commands and discards async command results after a new turn", async () => {
    const sim = await setup(), result = deferred<VoiceCommandResult>(); sim.command.mockImplementation(() => result.promise);
    await sim.enable(); const ws = sim.sockets[0];
    await act(async () => { ws.message(commandMessage(1)); ws.message(commandMessage(1)); });
    expect(sim.command).toHaveBeenCalledTimes(1);
    await act(async () => { ws.message({ type: "turn", turn: 2 }); result.resolve({ accepted: true, spokenText: "old" }); });
    expect(ws.send.mock.calls.some(([value]) => String(value).includes("command-result"))).toBe(false);
    await act(async () => ws.message(reply(1))); expect(sim.play).not.toHaveBeenCalled();
  });
  it("ignores a failed action from an earlier turn", async () => {
    const sim = await setup(), result = deferred<VoiceCommandResult>(); sim.command.mockImplementation(() => result.promise);
    await sim.enable(); const ws = sim.sockets[0];
    await act(async () => ws.message(commandMessage(1)));
    await act(async () => { ws.message({ type: "turn", turn: 2 }); result.reject(new Error("old failure")); });
    expect(sim.voice().status).toBe("listening");
  });
  it("switches lessons with a fresh connection and rejects prior lesson commands", async () => {
    const sim = await setup(); await sim.enable(); const old = sim.sockets[0];
    await sim.switchLesson(); expect(sim.sockets).toHaveLength(2);
    await act(async () => { old.message(commandMessage(1)); sim.sockets[1].open(); });
    expect(sim.command).not.toHaveBeenCalled();
    expect(JSON.parse(sim.sockets[1].send.mock.calls[0][0]).context.lessonId).toBe("worth");
  });
  it("cancels a pending reconnect timer when muted", async () => {
    const sim = await setup(); await sim.enable(); vi.useFakeTimers();
    sim.windowMock.setTimeout = globalThis.setTimeout;
    await act(async () => sim.sockets[0].dispatchEvent(Object.assign(new Event("close"), { code: 1006 })));
    await act(async () => sim.voice().mute());
    await act(async () => { vi.advanceTimersByTime(10000); });
    expect(sim.sockets).toHaveLength(1);
  });
  it("loads only the voice index and plays a matching asset from its cacheable URL", async () => {
    const sim = await setup();
    const spokenText = "Okay, I am looking at the target.";
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(spokenText));
    const textHash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
    sim.fetchMock.mockImplementation(async (url: string) => url === "/api/voice/access"
      ? { ok: true, json: async () => ({}) }
      : { ok: true, json: async () => ({ "practice:ack:fixate-target": { file: "fixate-target.mp3", textHash, voice: "Charon" } }) });
    sim.command.mockReturnValue({ accepted: true, spokenText, cacheKey: "practice:ack:fixate-target" });
    await sim.enable();
    const ws = sim.sockets[0];
    await act(async () => {
      ws.message({ type: "status", status: "listening", voiceName: "Charon" });
      ws.message(commandMessage(1));
    });
    await vi.waitFor(() => expect(ws.send.mock.calls.some(([value]) => String(value).includes('"clientAudio":true'))).toBe(true));
    expect(sim.fetchMock.mock.calls.map(([url]) => url)).toEqual(["/api/voice/access", "/audio/voice/index.json"]);
    expect(sim.audioSources).toEqual([`/audio/voice/fixate-target.mp3?v=${textHash.slice(0, 16)}`]);
  });
  it("retries a failed voice-index request on the next activation", async () => {
    const sim = await setup(); let indexRequests = 0;
    sim.fetchMock.mockImplementation(async (url: string) => {
      if (url === "/api/voice/access") return { ok: true, json: async () => ({}) };
      indexRequests += 1;
      return { ok: indexRequests > 1, json: async () => ({}) };
    });
    await sim.enable();
    await vi.waitFor(() => expect(indexRequests).toBe(1));
    await act(async () => sim.voice().mute());
    await sim.enable();
    await vi.waitFor(() => expect(indexRequests).toBe(2));
  });
});
