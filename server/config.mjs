export function loadConfig(env = process.env) {
  const required = (name) => {
    const value = env[name];
    if (!value) throw new Error(`Missing required environment variable: ${name}`);
    return value;
  };
  return {
    port: Number(env.PORT || 8080),
    projectId: env.GOOGLE_CLOUD_PROJECT || env.GCLOUD_PROJECT || "",
    location: env.VERTEX_LOCATION || "global",
    liveModel: env.VERTEX_LIVE_MODEL || "gemini-live-2.5-flash-native-audio",
    voiceName: env.GOOGLE_VOICE_NAME || "Charon",
    cookieSecret: required("VOICE_COOKIE_SECRET"),
    publicOrigin: env.PUBLIC_ORIGIN || "",
    cookieTtlSeconds: Number(env.VOICE_COOKIE_TTL_SECONDS || 3600),
    maxSessions: Number(env.VOICE_MAX_SESSIONS || 25),
    maxSessionsPerIp: Number(env.VOICE_MAX_SESSIONS_PER_IP || 2),
    sessionLimitMs: Number(env.VOICE_SESSION_LIMIT_MS || 30 * 60_000),
    inactivityLimitMs: Number(env.VOICE_INACTIVITY_LIMIT_MS || 5 * 60_000),
    maxJsonBytes: Number(env.VOICE_MAX_JSON_BYTES || 16_384),
    maxAudioFrameBytes: Number(env.VOICE_MAX_AUDIO_FRAME_BYTES || 131_072),
  };
}
