import { afterEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { VoiceSession } from "./session.mjs";
import { SpeechBridge, GeminiLiveBridge } from "./google.mjs";
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const context = { mode: "test", sessionId: "test-1", caseId: "case", caseVersion: "draft", allowedFacts: [], allowedActions: ["look-straight"] };
const config = { maxJsonBytes: 20000, semanticResponseLimitMs: 8000 };
const sessions = [];
function setup(synthesize = vi.fn(async () => ({ data: "reply", mimeType: "audio/mpeg" }))) {
  const sent = [], semantics = [];
  const semantic = vi.fn((_config, callbacks) => {
    const bridge = { callbacks, start: vi.fn(async () => {}), sendText: vi.fn(), close: vi.fn() };
    semantics.push(bridge); return bridge;
  });
  const ws = { readyState: 1, send: value => sent.push(JSON.parse(value)), close: vi.fn() };
  const session = new VoiceSession(ws, config, { synthesize }, {}, { semantic });
  session.context = context; sessions.push(session);
  return { session, sent, semantics, semantic, synthesize };
}
afterEach(() => { sessions.splice(0).forEach(session => session.close()); vi.useRealTimers(); });
describe("voice utterance ownership", () => {
  it("speaks rejected setup clarifications but keeps intentionally silent actions silent", async () => {
    const { session, sent, synthesize } = setup();
    session.transcript("hello", true);
    await session.canonical({ utteranceId: sent.find(m => m.type === "command").command.utteranceId,
      result: { accepted: false, spokenText: "Please present the target first." } });
    expect(synthesize).toHaveBeenCalledWith("Please present the target first.", undefined);
    session.transcript("hello", true);
    await session.canonical({ utteranceId: sent.filter(m => m.type === "command").at(-1).command.utteranceId,
      result: { accepted: true, spokenText: "Lights dimmed.", suppressAudio: true } });
    expect(synthesize).toHaveBeenCalledTimes(1);
  });
  it("routes recognized speech once without starting a competing semantic router", () => {
    const { session, sent, semantic } = setup();
    session.transcript("hello", false); session.transcript("hello", true);
    expect(sent.filter(m => m.type === "command")).toHaveLength(1);
    expect(semantic).not.toHaveBeenCalled();
  });
  it("uses one ID for semantic calls and ignores repeated function calls", async () => {
    const { session, sent, semantics } = setup();
    session.transcript("Please direct your gaze toward the ceiling fixture", true);
    await Promise.resolve();
    const bridge = semantics[0]; expect(bridge.sendText).toHaveBeenCalledTimes(1);
    const call = { name: "patient_instruction", args: { instructionId: "look-straight" } };
    bridge.callbacks.onFunction(call); bridge.callbacks.onFunction(call);
    expect(sent.filter(m => m.type === "command")).toHaveLength(1);
    expect(sent.find(m => m.type === "command").command.utteranceId).toBe(sent.find(m => m.type === "transcript").utteranceId);
    expect(bridge.close).toHaveBeenCalled();
  });
  it("drops old semantic callbacks after a new utterance and permits deliberate repeated instructions", () => {
    const { session, sent, semantics } = setup();
    session.transcript("Please direct your gaze toward the ceiling fixture", true);
    const old = semantics[0];
    session.transcript("hello", true);
    old.callbacks.onFunction({ name: "patient_instruction", args: { instructionId: "look-straight" } });
    old.callbacks.onAudio("old", "audio/wav");
    session.transcript("hello", true);
    expect(sent.filter(m => m.type === "command")).toHaveLength(2);
    expect(sent.filter(m => m.type === "audio")).toHaveLength(0);
  });
  it("uses a bounded fallback even if semantic output never completes", () => {
    vi.useFakeTimers(); const { session, sent, semantics } = setup();
    session.transcript("Please direct your gaze toward the ceiling fixture", true);
    vi.advanceTimersByTime(8000);
    expect(sent.filter(m => m.type === "command")).toHaveLength(1);
    semantics[0].callbacks.onFunction({ name: "patient_instruction", args: { instructionId: "look-straight" } });
    expect(sent.filter(m => m.type === "command")).toHaveLength(1);
  });
  it.each(["new speech", "closed", "context"])("discards pending TTS after %s and consumes acknowledgements once", async reason => {
    const audio = deferred(); const synthesize = vi.fn(() => audio.promise);
    const { session, sent } = setup(synthesize);
    session.transcript("hello", true);
    const command = sent.find(m => m.type === "command").command;
    const result = { utteranceId: command.utteranceId, result: { accepted: true, spokenText: "Hello." } };
    const pending = session.canonical(result); await session.canonical(result);
    expect(synthesize).toHaveBeenCalledTimes(1);
    if (reason === "new speech") session.transcript("a new question", false);
    else if (reason === "closed") session.close();
    else await session.handle(JSON.stringify({ type: "context", context: { ...context, allowedActions: [] } }), false);
    audio.resolve({ data: "old", mimeType: "audio/mpeg" }); await pending;
    expect(sent.filter(m => m.type === "audio")).toHaveLength(0);
  });
  it("retains the originating turn for a current canonical response", async () => {
    const { session, sent } = setup(); session.transcript("hello", true);
    const command = sent.find(m => m.type === "command");
    await session.canonical({ utteranceId: command.command.utteranceId, result: { accepted: true, spokenText: "Hello." } });
    expect(sent.at(-1)).toMatchObject({ type: "audio", turn: command.turn });
  });
  it("closes an STT start that completes after WebSocket closure", async () => {
    const pending = deferred(), bridge = { start: () => pending.promise, close: vi.fn() };
    const { session, sent } = setup(); session.context = undefined;
    session.bridges.speech = () => bridge;
    const hello = session.handle(JSON.stringify({ type: "hello", context, sampleRate: 48000 }), false);
    session.close(); pending.resolve(); await hello;
    expect(bridge.close).toHaveBeenCalled();
    expect(sent.some(message => message.type === "status" && message.status === "listening")).toBe(false);
  });
  it("rejects old lesson callbacks after context changes", async () => {
    const { session, semantics, sent } = setup();
    session.context = { mode: "practice", sessionId: "p1", lessonId: "npc", allowedActions: ["fixate-target"] };
    session.transcript("Please direct your gaze toward the ceiling fixture", true);
    const old = semantics[0];
    await session.handle(JSON.stringify({ type: "context", context: { ...session.context, lessonId: "worth" } }), false);
    old.callbacks.onFunction({ name: "practice_action", args: { actionId: "fixate-target" } });
    expect(sent.filter(m => m.type === "command")).toHaveLength(0);
    expect(old.close).toHaveBeenCalled();
  });
  it("closes semantic startup that resolves after the session has closed", async () => {
    const pending = deferred(); const { session, semantics } = setup();
    session.bridges.semantic = (_config, callbacks) => { const bridge = { callbacks, start: () => pending.promise, close: vi.fn(), sendText: vi.fn() }; semantics.push(bridge); return bridge; };
    session.transcript("Please direct your gaze toward the ceiling fixture", true); session.close();
    pending.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(semantics[0].sendText).not.toHaveBeenCalled(); expect(semantics[0].close).toHaveBeenCalled();
  });
});
describe("provider bridge cancellation", () => {
  it("deduplicates final STT segments by provider offset, not by repeated words", async () => {
    const stream = Object.assign(new EventEmitter(), { write: vi.fn(), end: vi.fn() });
    const onTranscript = vi.fn();
    class Client { _streamingRecognize() { return stream; } close = async () => {}; }
    const bridge = new SpeechBridge({ projectId: "test", onTranscript, onError: vi.fn() }, async () => ({ v2: { SpeechClient: Client } }));
    await bridge.start(48000);
    const result = seconds => ({ results: [{ alternatives: [{ transcript: "look straight" }], isFinal: true, resultEndOffset: { seconds, nanos: 0 } }] });
    stream.emit("data", result(1)); stream.emit("data", result(1)); stream.emit("data", result(2));
    expect(onTranscript).toHaveBeenCalledTimes(2);
    bridge.close(); stream.emit("data", result(3)); expect(onTranscript).toHaveBeenCalledTimes(2);
  });

  it("does not create an STT client after delayed import resolves on a closed bridge", async () => {
    const load = deferred(), Client = vi.fn();
    const bridge = new SpeechBridge({ projectId: "test", onTranscript: vi.fn(), onError: vi.fn() }, () => load.promise);
    const pending = bridge.start(48000); bridge.close(); load.resolve({ v2: { SpeechClient: Client } }); await pending;
    expect(Client).not.toHaveBeenCalled();
  });
  it("closes a Gemini connection resolving after close, and ignores its callbacks", async () => {
    const connection = deferred(), remote = { close: vi.fn() }; let events;
    const callbacks = { onFunction: vi.fn(), onAudio: vi.fn(), onError: vi.fn() };
    class Client { live = { connect: options => { events = options.callbacks; return connection.promise; } }; }
    const bridge = new GeminiLiveBridge({}, callbacks, async () => ({ GoogleGenAI: Client, Modality: { AUDIO: "AUDIO" } }));
    const pending = bridge.start(context, 48000); await Promise.resolve(); bridge.close(); connection.resolve(remote); await pending;
    expect(remote.close).toHaveBeenCalledTimes(1);
    events.onmessage({ toolCall: { functionCalls: [{ name: "patient_instruction" }] } });
    expect(callbacks.onFunction).not.toHaveBeenCalled();
  });
});
