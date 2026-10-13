import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { CanonicalSpeech } from "../voice/google.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const manifestPath = resolve(root, "voice-assets/manifest.json");
const output = resolve(root, "public/audio/voice");
const indexPath = resolve(output, "index.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
const voice = process.env.GOOGLE_VOICE_NAME || "Charon";
const speech = new CanonicalSpeech({ voiceName: voice });
await mkdir(output, { recursive: true });
const index = await readIndex();
for (const item of manifest.items) {
  const file = `${Buffer.from(item.key).toString("base64url")}.mp3`;
  const textHash = await sha(item.text);
  const path = resolve(output, file);
  const current = index[item.key];
  if (current?.file === file && current.textHash === textHash && current.voice === voice && await nonEmpty(path)) {
    console.log(`Reusing ${item.key}`);
    continue;
  }
  if (process.env.VOICE_ASSET_ADOPT_EXISTING === "true" && !current && await nonEmpty(path)) {
    index[item.key] = { file, textHash, voice, generatedBy: "Google Gemini TTS" };
    await saveIndex(index);
    console.log(`Indexed existing ${item.key}`);
    continue;
  }
  const audio = await synthesizeWithRetry(item.text, item.key);
  await writeFile(path, Buffer.from(audio.data, "base64"));
  index[item.key] = { file, textHash, voice, generatedBy: "Google Gemini TTS" };
  await saveIndex(index);
  console.log(`Generated ${item.key}`);
  await delay(7000);
}
await saveIndex(index);

async function readIndex() {
  try { return JSON.parse(await readFile(indexPath, "utf8")); }
  catch { return {}; }
}
async function saveIndex(value) { await writeFile(indexPath, `${JSON.stringify(value, null, 2)}\n`); }
async function nonEmpty(path) {
  try { return (await stat(path)).size > 0; }
  catch { return false; }
}
async function synthesizeWithRetry(text, key) {
  for (let attempt = 0; ; attempt += 1) {
    try { return await speech.synthesize(text, key); }
    catch (error) {
      if (error?.code !== 8 || attempt >= 5) throw error;
      const waitMs = 15_000 * (attempt + 1);
      console.warn(`Quota limited while generating ${key}; retrying in ${waitMs / 1000}s.`);
      await delay(waitMs);
    }
  }
}
function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function sha(value) { const data = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)); return Buffer.from(data).toString("hex"); }
