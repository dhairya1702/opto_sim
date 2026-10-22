export type VoiceAsset = { file: string; textHash: string; voice: string };

export async function voiceAssetMatches(asset: VoiceAsset | undefined, text: string, voice: string | undefined) {
  if (!asset || !voice || asset.voice !== voice || !globalThis.crypto?.subtle) return false;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  const hash = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, "0")).join("");
  return asset.textHash === hash;
}
