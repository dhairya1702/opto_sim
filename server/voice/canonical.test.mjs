import { describe, it, expect, vi } from "vitest";
import { CanonicalSpeech } from "./google.mjs";
import { createHash } from "node:crypto";
import { routeDeterministic } from "./router.mjs";
import lessons from "../../shared/practiceVoice.json" with { type: "json" };

describe("canonical voice correctness", () => {
  it("routes every declared phrase in every lesson to its declared action", () => {
    for (const [lessonId, actions] of Object.entries(lessons)) {
      for (const action of actions) for (const phrase of action.phrases) {
        const context = { mode: "practice", lessonId, allowedActions: actions.map(a => a.id) };
        expect(routeDeterministic(phrase, context, "test"), `${lessonId}: ${phrase}`).toMatchObject({ kind: "practice-action", lessonId, actionId: action.id });
      }
    }
  });
  it("does not reuse an asset or runtime cache entry for different text under the same key", async () => {
    const synthesizeSpeech = vi.fn(async ({ input }) => [{ audioContent: Buffer.from(input.text) }]);
    const close = vi.fn(async () => {});
    const speech = new CanonicalSpeech({ voiceName: "Charon" }, async () => ({ TextToSpeechClient: class { synthesizeSpeech = synthesizeSpeech; close = close; } }));
    speech.assetIndex = { shared: { file: "wrong.mp3", voice: "Charon", textHash: createHash("sha256").update("Wrong reply").digest("hex") } };
    for (const text of ["Keep the target single.", "Report sustained blur.", "Keep the target single."]) {
      const audio = await speech.synthesize(text, "shared");
      expect(Buffer.from(audio.data, "base64").toString()).toBe(text);
    }
    expect(synthesizeSpeech).toHaveBeenCalledTimes(2);
    expect(close).not.toHaveBeenCalled();
    await speech.close();
    expect(close).toHaveBeenCalledTimes(1);
  });
  it("reuses one client and deduplicates concurrent synthesis", async () => {
    let release;
    const response = new Promise(resolve => { release = resolve; });
    const synthesizeSpeech = vi.fn(() => response);
    const close = vi.fn(async () => {});
    const Client = vi.fn(function Client() { this.synthesizeSpeech = synthesizeSpeech; this.close = close; });
    const speech = new CanonicalSpeech({ voiceName: "Charon" }, async () => ({ TextToSpeechClient: Client }));
    const first = speech.synthesize("Same reply");
    const duplicate = speech.synthesize("Same reply");
    const other = speech.synthesize("Other reply");
    await vi.waitFor(() => expect(synthesizeSpeech).toHaveBeenCalledTimes(2));
    release([{ audioContent: Buffer.from("audio") }]);
    await Promise.all([first, duplicate, other]);
    expect(Client).toHaveBeenCalledTimes(1);
    await speech.close(); await speech.close();
    expect(close).toHaveBeenCalledTimes(1);
  });
  it("allows retry after a failed synthesis", async () => {
    const synthesizeSpeech = vi.fn().mockRejectedValueOnce(new Error("quota")).mockResolvedValueOnce([{ audioContent: Buffer.from("retry") }]);
    const speech = new CanonicalSpeech({ voiceName: "Charon" }, async () => ({ TextToSpeechClient: class { synthesizeSpeech = synthesizeSpeech; close = vi.fn(); } }));
    await expect(speech.synthesize("Retry me")).rejects.toThrow("quota");
    await expect(speech.synthesize("Retry me")).resolves.toMatchObject({ mimeType: "audio/mpeg" });
    expect(synthesizeSpeech).toHaveBeenCalledTimes(2);
    await speech.close();
  });
});
