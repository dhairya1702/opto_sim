/**
 * Opt-in developer performance log endpoint (POST /api/perf).
 *
 * Off unless the server process has PERF_LOG=1. When off, the endpoint answers
 * 404 and logs nothing. When on, it accepts only small numeric reports from
 * loopback/private-network clients, rate-limits them, and prints one line to
 * stdout. Nothing is stored or forwarded.
 */

const MAX_BODY_BYTES = 4096;
const MAX_NAME = 48;

export function perfLogEnabled(env = process.env) {
  return env.PERF_LOG === "1" || env.PERF_LOG === "true";
}

/** Loopback, RFC 1918, CGNAT-free private ranges, IPv6 ULA/link-local, and IPv4-mapped forms. */
export function isPrivateAddress(address) {
  if (typeof address !== "string" || !address) return false;
  let ip = address.toLowerCase();
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  if (ip === "::1" || ip === "localhost") return true;
  if (/^(fc|fd)[0-9a-f]{2}:/.test(ip) || ip.startsWith("fe80:")) return true;
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 127 || a === 10 || (a === 192 && b === 168) || (a === 172 && b >= 16 && b <= 31);
}

const num = (value, max = 1e9) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(0, Math.round(n * 10) / 10)) : 0;
};
// Strip anything that could carry terminal escape sequences or unexpected content.
const name = value => typeof value === "string" ? value.replace(/[^\w .:#/-]/g, "").slice(0, MAX_NAME) : "";
const pairs = (value, limit = 8) => Array.isArray(value)
  ? value.slice(0, limit).filter(Array.isArray).map(([key, count]) => [name(key), num(count)]).filter(([key]) => key)
  : [];
const names = (value, limit = 10) => Array.isArray(value) ? value.slice(0, limit).map(name).filter(Boolean) : [];
const range = value => Array.isArray(value) ? [num(value[0]), num(value[1])] : [0, 0];

/** Whitelist and coerce a client report; returns null for anything unrecognized. */
export function sanitizePerfReport(body) {
  if (!body || typeof body !== "object") return null;
  const sid = name(body.sid).slice(0, 8) || "?";
  if (body.kind === "second") {
    return {
      kind: "second", sid, t: num(body.t), mode: body.mode === "xr" ? "xr" : "desktop",
      hz: num(body.hz, 1000), frames: num(body.frames, 10_000), fps: num(body.fps, 1000), dropped: num(body.dropped, 10_000),
      p50: num(body.p50, 60_000), p95: num(body.p95, 60_000), max: num(body.max, 60_000),
      js: num(body.js, 60_000), jsMax: num(body.jsMax, 60_000), render: num(body.render, 60_000),
      longTasks: num(body.longTasks, 10_000), longMs: num(body.longMs, 600_000),
      draws: num(body.draws), tris: num(body.tris), geometries: num(body.geometries), textures: num(body.textures), programs: num(body.programs),
      renders: pairs(body.renders), counters: pairs(body.counters), events: names(body.events),
    };
  }
  if (body.kind === "summary") {
    const worst = body.worst && typeof body.worst === "object"
      ? { t: num(body.worst.t), fps: num(body.worst.fps, 1000), dropped: num(body.worst.dropped, 10_000), events: names(body.worst.events, 4) }
      : null;
    return {
      kind: "summary", sid, scope: body.scope === "vr" ? "vr" : "page",
      duration: num(body.duration), frames: num(body.frames), avgFps: num(body.avgFps, 1000),
      dropped: num(body.dropped), droppedPct: num(body.droppedPct, 100),
      longTasks: num(body.longTasks), longMs: num(body.longMs), worst,
      renders: pairs(body.renders, 6), textures: range(body.textures), geometries: range(body.geometries), programs: range(body.programs),
    };
  }
  return null;
}

const paint = (enabled, code, text) => enabled ? `\x1b[${code}m${text}\x1b[0m` : text;
const kilo = value => value >= 1000 ? `${Math.round(value / 100) / 10}k` : String(value);
const list = entries => entries.map(([key, count]) => `${key} ${count}`).join(", ");
const clock = seconds => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

/** One terminal line per report. Yellow: some dropped frames; red: ≥10% dropped or long tasks over 100 ms. */
export function formatPerfReport(report, { color = false } = {}) {
  if (report.kind === "summary") {
    const growth = ([start, end]) => end > start ? `${start} → ${end} (+${end - start})` : `${start} → ${end}`;
    const parts = [
      `[perf ${report.sid}] ${report.scope.toUpperCase()} SUMMARY ${clock(report.duration)}`,
      `avg fps ${report.avgFps}`, `dropped ${report.dropped} (${report.droppedPct}%)`,
      `long tasks ${report.longTasks} (${report.longMs}ms)`,
      report.worst ? `worst second @${clock(report.worst.t)}: ${report.worst.fps} fps, ${report.worst.dropped} dropped${report.worst.events.length ? ` [${report.worst.events.join("; ")}]` : ""}` : "",
      report.renders.length ? `top renders: ${list(report.renders)}` : "",
      `textures ${growth(report.textures)}`, `geometries ${growth(report.geometries)}`, `shaders ${growth(report.programs)}`,
    ].filter(Boolean);
    return paint(color, "1;36", parts.join(" | "));
  }
  const expected = report.frames + report.dropped;
  const droppedShare = expected ? report.dropped / expected : 0;
  const severity = droppedShare >= .1 || report.longMs >= 100 ? "31" : report.dropped > 0 || report.longTasks > 0 ? "33" : "32";
  const parts = [
    `[perf ${report.sid} ${clock(report.t)} ${report.mode} ${report.hz}Hz]`,
    `fps ${report.fps} drop ${report.dropped}`,
    `frame p50 ${report.p50} p95 ${report.p95} max ${report.max}ms`,
    `js ${report.js} (render ${report.render}) max ${report.jsMax}ms`,
    report.longTasks ? `long ${report.longTasks}/${report.longMs}ms` : "",
    `draws ${report.draws} tris ${kilo(report.tris)}`,
    `tex ${report.textures} geo ${report.geometries} shaders ${report.programs}`,
    report.renders.length ? `renders: ${list(report.renders)}` : "",
    report.counters.length ? `counts: ${list(report.counters)}` : "",
    report.events.length ? `▶ ${report.events.join("; ")}` : "",
  ].filter(Boolean);
  const [header, ...rest] = parts;
  return paint(color, severity, `${header} ${rest.join(" | ")}`);
}

function readBody(request) {
  if (request.body !== undefined && typeof request.body === "object" && request.body !== null && !Buffer.isBuffer(request.body)) {
    return Promise.resolve(request.body);
  }
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    request.on("data", chunk => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) { reject(new Error("too large")); request.destroy(); return; }
      chunks.push(chunk);
    });
    request.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); } catch (error) { reject(error); }
    });
    request.on("error", reject);
  });
}

/**
 * Framework-neutral (Express or Connect/Vite) handler. Mount at /api/perf.
 * Uses the socket address, not X-Forwarded-For, so the private-network check cannot be spoofed by headers.
 */
export function createPerfHandler({
  enabled = perfLogEnabled(),
  log = line => process.stdout.write(`${line}\n`),
  color = Boolean(process.stdout.isTTY),
  now = Date.now,
  maxPerSecond = 4,
} = {}) {
  const windows = new Map();
  const end = (response, status) => { response.statusCode = status; response.end(); };
  return async (request, response) => {
    if (!enabled) return end(response, 404);
    if (request.method !== "POST") return end(response, 405);
    const ip = request.socket?.remoteAddress ?? "";
    if (!isPrivateAddress(ip)) return end(response, 403);
    const second = Math.floor(now() / 1000);
    const window = windows.get(ip);
    if (window && window.second === second) {
      if (window.count >= maxPerSecond) return end(response, 429);
      window.count += 1;
    } else {
      windows.set(ip, { second, count: 1 });
      if (windows.size > 256) windows.clear();
    }
    let report;
    try { report = sanitizePerfReport(await readBody(request)); } catch { return end(response, 400); }
    if (!report) return end(response, 400);
    log(formatPerfReport(report, { color }));
    end(response, 204);
  };
}
