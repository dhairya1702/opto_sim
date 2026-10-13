import { describe, expect, it, vi } from "vitest";
import { issueVoiceToken } from "./auth.mjs";
import { issueVoiceAccess, voiceUpgradeDecision } from "./index.mjs";
import { VoiceSession } from "./voice/session.mjs";
import { validClientMessage } from "./voice/validation.mjs";

const config = {
  cookieSecret: "test-cookie-secret", publicOrigin: "https://allowed.test",
  maxSessions: 2, maxSessionsPerIp: 1, sessionLimitMs: 1000, inactivityLimitMs: 500,
  maxJsonBytes: 1024, maxAudioFrameBytes: 2048,
};
const request = (overrides = {}) => ({
  url: "/api/voice/live", remoteAddress: "127.0.0.1",
  headers: { host: "allowed.test", origin: "https://allowed.test", cookie: `opto_voice=${issueVoiceToken(config.cookieSecret, 60, 1000)}`, ...overrides },
});
const requestContext = {
  mode: "test", sessionId: "session-1", caseId: "case-1", caseVersion: "0.1-draft",
  allowedFacts: [{ id: "onset", patterns: ["when"] }], allowedActions: ["look-straight"],
};

describe("same-origin WebSocket admission", () => {
  it("issues a signed session cookie without requiring an access code", () => {
    const headers = new Map();
    const response = {
      setHeader: (name, value) => headers.set(name, value),
      status: (status) => { response.statusCode = status; return response; },
      end: () => { response.ended = true; },
    };
    issueVoiceAccess({ secure: true, headers: {} }, response, { ...config, cookieTtlSeconds: 60 });
    expect(response.statusCode).toBe(204);
    expect(response.ended).toBe(true);
    expect(headers.get("set-cookie")).toMatch(/^opto_voice=.*HttpOnly; SameSite=Strict; Secure;/);
  });
  it("accepts a valid signed session and rejects origin, expiry, path, and capacity violations", () => {
    const counts = new Map(); const now = 10_000;
    expect(voiceUpgradeDecision(request(), config, 0, counts, now)).toEqual({ reason: null, ip: "127.0.0.1" });
    expect(voiceUpgradeDecision(request({ origin: "https://wrong.test" }), config, 0, counts, now).reason).toBe("origin");
    expect(voiceUpgradeDecision(request(), config, 0, counts, 62_000).reason).toBe("authentication");
    expect(voiceUpgradeDecision({ ...request(), url: "/wrong" }, config, 0, counts, now).reason).toBe("path");
    expect(voiceUpgradeDecision(request(), config, 2, counts, now).reason).toBe("capacity");
    counts.set("127.0.0.1", 1);
    expect(voiceUpgradeDecision(request(), config, 0, counts, now).reason).toBe("ip-capacity");
  });
  it("closes mocked sessions at the application duration and inactivity limits", () => {
    const closed = [];
    const ws = { readyState: 1, close: (code, reason) => closed.push([code, reason]) };
    const session = new VoiceSession(ws, config, { synthesize: async () => ({}) });
    session.startedAt = Date.now() - config.sessionLimitMs - 1; session.audit();
    expect(closed).toContainEqual([1000, "session limit"]);
    const idle = new VoiceSession(ws, config, { synthesize: async () => ({}) });
    idle.lastAudioAt = Date.now() - config.inactivityLimitMs - 1; idle.audit();
    expect(closed).toContainEqual([1000, "audio inactivity"]);
  });
  it("validates sequential cache keys and the browser playback acknowledgement", () => {
    const result = { accepted: true, spokenText: "First. Second.", cacheKeys: ["history:first", "history:second"] };
    expect(validClientMessage({ type: "command-result", utteranceId: "u1", result, clientAudio: true })).toBe(true);
    expect(validClientMessage({ type: "command-result", utteranceId: "u1", result, clientAudio: "yes" })).toBe(false);
  });
  it("includes the turn on commands and skips runtime synthesis after preloaded playback", async () => {
    const sent = []; const synthesize = vi.fn();
    const ws = { readyState: 1, send: value => sent.push(JSON.parse(value)), close: vi.fn() };
    const session = new VoiceSession(ws, config, { synthesize });
    session.context = requestContext;
    session.turn = 3;
    session.route({ kind: "social", socialId: "greeting", utteranceId: "u1", transcript: "Hi" }, "deterministic");
    expect(sent.at(-1)).toMatchObject({ type: "command", turn: 3, command: { utteranceId: "u1" } });
    await session.canonical({ utteranceId: "u1", result: { accepted: true, spokenText: "Hi." }, clientAudio: true });
    expect(synthesize).not.toHaveBeenCalled();
  });
  it("routes an unmatched final transcript to a guaranteed patient fallback after the live deadline", () => {
    vi.useFakeTimers();
    try {
      const sent = [];
      const ws = { readyState: 1, send: value => sent.push(JSON.parse(value)), close: vi.fn() };
      const session = new VoiceSession(ws, config, { synthesize: vi.fn() });
      session.context = requestContext;
      session.gemini = { unsuppress: vi.fn(), suppress: vi.fn(), close: vi.fn() };
      session.transcript("What is your shoe size?", true);
      expect(sent.some(message => message.type === "command")).toBe(false);
      vi.advanceTimersByTime(2000);
      expect(sent.at(-1)).toMatchObject({ type: "command", command: { kind: "patient-reply", replyId: "unknown" } });
      expect(session.gemini.suppress).toHaveBeenCalled();
      session.close();
    } finally { vi.useRealTimers(); }
  });
});
