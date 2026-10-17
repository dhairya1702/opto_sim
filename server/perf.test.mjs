import { describe, expect, it } from "vitest";
import { createPerfHandler, formatPerfReport, isPrivateAddress, perfLogEnabled, sanitizePerfReport } from "./perf.mjs";

const report = {
  kind: "second", sid: "ab12", t: 12, mode: "xr", hz: 72, frames: 61, fps: 61, dropped: 11, p50: 13.9, p95: 31, max: 48,
  js: 9.8, jsMax: 22, render: 4.1, longTasks: 2, longMs: 84, draws: 412, tris: 210_000, geometries: 300, textures: 96, programs: 41,
  renders: [["XRConsultationController", 22]], counters: [["sign texture", 6]], events: ["pickup penlight"],
};

function call(handler, { method = "POST", ip = "192.168.1.20", body = report } = {}) {
  const response = { statusCode: 200, ended: false, end() { this.ended = true; } };
  return Promise.resolve(handler({ method, socket: { remoteAddress: ip }, body }, response)).then(() => response);
}

describe("opt-in perf log endpoint", () => {
  it("is enabled only by PERF_LOG", () => {
    expect(perfLogEnabled({})).toBe(false);
    expect(perfLogEnabled({ PERF_LOG: "0" })).toBe(false);
    expect(perfLogEnabled({ PERF_LOG: "1" })).toBe(true);
  });

  it("returns 404 and logs nothing when disabled", async () => {
    const lines = [];
    const response = await call(createPerfHandler({ enabled: false, log: line => lines.push(line) }));
    expect(response.statusCode).toBe(404);
    expect(lines).toEqual([]);
  });

  it("logs a private-network report once when enabled", async () => {
    const lines = [];
    const response = await call(createPerfHandler({ enabled: true, color: false, log: line => lines.push(line) }));
    expect(response.statusCode).toBe(204);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("fps 61 drop 11");
    expect(lines[0]).toContain("XRConsultationController 22");
    expect(lines[0]).toContain("▶ pickup penlight");
  });

  it("rejects public addresses, wrong methods, junk bodies, and floods", async () => {
    const lines = [];
    const handler = createPerfHandler({ enabled: true, log: line => lines.push(line), now: () => 5000, maxPerSecond: 2 });
    expect((await call(handler, { ip: "8.8.8.8" })).statusCode).toBe(403);
    expect((await call(handler, { method: "GET" })).statusCode).toBe(405);
    expect((await call(handler, { body: { kind: "nope" } })).statusCode).toBe(400);
    expect((await call(handler)).statusCode).toBe(204);
    expect((await call(handler)).statusCode).toBe(429);
    expect(lines).toHaveLength(1);
  });

  it("classifies private addresses", () => {
    ["127.0.0.1", "::1", "::ffff:192.168.0.4", "10.1.2.3", "172.20.0.1", "fd12:3456::1", "fe80::1"].forEach(ip => expect(isPrivateAddress(ip)).toBe(true));
    ["8.8.8.8", "172.32.0.1", "", undefined, "not-an-ip"].forEach(ip => expect(isPrivateAddress(ip)).toBe(false));
  });

  it("strips terminal escapes and unknown fields", () => {
    const clean = sanitizePerfReport({ ...report, sid: "\x1b[31mevil", events: ["\x1b]0;pwn\x07ok"], secret: "learner answer", fps: "NaN" });
    expect(clean.sid).not.toContain("\x1b");
    expect(clean.events[0]).not.toMatch(/[\x00-\x1f]/);
    expect(clean).not.toHaveProperty("secret");
    expect(clean.fps).toBe(0);
  });

  it("formats session summaries", () => {
    const line = formatPerfReport(sanitizePerfReport({
      kind: "summary", sid: "ab12", scope: "vr", duration: 252, frames: 17000, avgFps: 68, dropped: 312, droppedPct: 6,
      longTasks: 4, longMs: 300, worst: { t: 151, fps: 41, dropped: 31, events: ["pickup retinoscope"] },
      renders: [["XRConsultationController", 9100]], textures: [96, 141], geometries: [300, 300], programs: [41, 47],
    }));
    expect(line).toContain("VR SUMMARY 4:12");
    expect(line).toContain("worst second @2:31: 41 fps");
    expect(line).toContain("textures 96 → 141 (+45)");
  });
});
