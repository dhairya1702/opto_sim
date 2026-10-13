import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const safeEqual = (left, right) => {
  const a = Buffer.from(left); const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};

const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
export function issueVoiceToken(secret, ttlSeconds, now = Date.now()) {
  const body = encode({ exp: Math.floor(now / 1000) + ttlSeconds, nonce: randomBytes(12).toString("hex") });
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

export function verifyVoiceToken(token, secret, now = Date.now()) {
  if (typeof token !== "string") return false;
  const [body, signature] = token.split(".");
  if (!body || !signature || !safeEqual(createHmac("sha256", secret).update(body).digest("base64url"), signature)) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    return Number.isFinite(payload.exp) && payload.exp >= Math.floor(now / 1000);
  } catch { return false; }
}

export function parseCookie(header = "") {
  return Object.fromEntries(header.split(";").map(item => item.trim().split("=")).filter(([key, value]) => key && value).map(([key, value]) => [key, decodeURIComponent(value)]));
}

export function voiceCookie(token, ttlSeconds, secure = true) {
  return [`opto_voice=${encodeURIComponent(token)}`, "Path=/api/voice", "HttpOnly", "SameSite=Strict", secure ? "Secure" : "", `Max-Age=${ttlSeconds}`].filter(Boolean).join("; ");
}
