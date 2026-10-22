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
  });
});
