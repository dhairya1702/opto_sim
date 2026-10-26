import express from "express";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { WebSocketServer } from "ws";
import { loadConfig } from "./config.mjs";
import { issueVoiceToken, parseCookie, verifyVoiceToken, voiceCookie } from "./auth.mjs";
import { CanonicalSpeech } from "./voice/google.mjs";
import { VoiceSession } from "./voice/session.mjs";
import { createPerfHandler, perfLogEnabled } from "./perf.mjs";

export function createOptoServer(config = loadConfig(), overrides = {}) {
  const app = express(); const server = createServer(app); const sessions = new Set(); const sessionsByIp = new Map();
  const speech = new CanonicalSpeech(config); const root = dirname(dirname(fileURLToPath(import.meta.url))); const dist = join(root, "dist");
  app.disable("x-powered-by"); app.use(express.json({ limit: "4kb" }));
  app.get("/healthz", (_request, response) => response.status(200).json({ status: "ok" }));
  app.post("/api/voice/access", (request, response) => issueVoiceAccess(request, response, config));
  // Developer-only frame log; 404 and silent unless PERF_LOG=1 (see server/perf.mjs).
  app.use("/api/perf", createPerfHandler({ enabled: perfLogEnabled() }));
  app.use(express.static(dist, { index: false, maxAge: "1h", setHeaders: (response, path) => { if (path.includes("/assets/")) response.setHeader("cache-control", "public, max-age=31536000, immutable"); } }));
  app.use((_request, response) => response.sendFile(join(dist, "index.html")));
  const wss = new WebSocketServer({ noServer: true, maxPayload: config.maxAudioFrameBytes });
  server.on("upgrade", (request, socket, head) => {
    const { reason, ip } = voiceUpgradeDecision({ url: request.url, headers: request.headers, remoteAddress: request.socket.remoteAddress }, config, sessions.size, sessionsByIp);
    if (reason) { socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"); socket.destroy(); return; }
    wss.handleUpgrade(request, socket, head, ws => {
      const session = overrides.sessionFactory ? overrides.sessionFactory(ws, config, speech, { ipClass: createIpClass(ip) }) : new VoiceSession(ws, config, speech, { ipClass: createIpClass(ip) }); sessions.add(session); sessionsByIp.set(ip, (sessionsByIp.get(ip) || 0) + 1);
      ws.on("message", (data, isBinary) => void session.handle(data, isBinary));
      ws.on("close", () => { session.close(); sessions.delete(session); const count = (sessionsByIp.get(ip) || 1) - 1; if (count) sessionsByIp.set(ip, count); else sessionsByIp.delete(ip); });
    });
  });
  const audit = setInterval(() => sessions.forEach(session => session.audit()), 30_000); audit.unref();
  server.on("close", () => { clearInterval(audit); sessions.forEach(session => session.close(1001, "server shutdown")); void speech.close(); });
  return { app, server, sessions, speech };
}

function createIpClass(ip) { return ip.includes(":") ? "ipv6" : "ipv4"; }

export function issueVoiceAccess(request, response, config) {
  const secure = request.secure || request.headers["x-forwarded-proto"] === "https";
  response.setHeader("set-cookie", voiceCookie(issueVoiceToken(config.cookieSecret, config.cookieTtlSeconds), config.cookieTtlSeconds, secure));
  response.status(204).end();
}

export function voiceUpgradeDecision(request, config, sessionCount, sessionsByIp, now = Date.now()) {
  const headers = request.headers || {}; const host = headers.host; const forwardedProtocol = headers["x-forwarded-proto"] || "http";
  const expected = config.publicOrigin || `${forwardedProtocol}://${host}`; const origin = headers.origin;
  const token = parseCookie(headers.cookie).opto_voice; const ip = headers["x-forwarded-for"]?.split(",")[0]?.trim() || request.remoteAddress || "unknown";
  let reason = null;
  if (request.url !== "/api/voice/live") reason = "path";
  else if (!origin || origin !== expected) reason = "origin";
  else if (!verifyVoiceToken(token, config.cookieSecret, now)) reason = "authentication";
  else if (sessionCount >= config.maxSessions) reason = "capacity";
  else if ((sessionsByIp.get(ip) || 0) >= config.maxSessionsPerIp) reason = "ip-capacity";
  return { reason, ip };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const config = loadConfig(); const { server } = createOptoServer(config);
  let shuttingDown = false;
  const shutdown = () => {
    if (shuttingDown) return;
    shuttingDown = true;
    server.close(error => {
      if (error) { console.error(error); process.exitCode = 1; }
    });
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);
  server.listen(config.port, "0.0.0.0", () => {
    console.log(JSON.stringify({ component: "server", event: "listening", port: config.port }));
    if (perfLogEnabled()) console.log("[perf] PERF_LOG=1: printing reports from ?perf=1 clients on this network.");
  });
}
