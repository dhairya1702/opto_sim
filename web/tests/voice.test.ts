import { describe, expect, it, vi } from "vitest";
import { PRACTICE_LESSON_IDS, PRACTICE_VOICE_ACTIONS } from "../voice/practiceActions";
import { VoiceOutputArbiter } from "../voice/outputArbiter";
import { validVoiceCommand } from "../voice/contracts";
import { SOCIAL_VOICE_REPLIES, socialVoiceReply } from "../voice/socialReplies";
import voiceManifest from "../../voice-assets/manifest.json";
import { TEST_VOICE_INSTRUCTIONS, TEST_VOICE_INSTRUCTION_CONTROLS } from "../voice/testInstructions";
import { PATIENT_VOICE_REPLIES, patientVoiceReply } from "../voice/patientReplies";

describe("voice contracts and Practice allowlists", () => {
  it("publishes a non-empty, unique action allowlist for every Practice module", () => {
    expect(PRACTICE_LESSON_IDS).toHaveLength(20);
    for (const lessonId of PRACTICE_LESSON_IDS) {
      const actions = PRACTICE_VOICE_ACTIONS[lessonId];
      expect(actions.length).toBeGreaterThan(0);
      expect(new Set(actions.map(action => action.id)).size).toBe(actions.length);
      for (const action of actions) {
        expect(action.controls.length).toBeGreaterThan(0);
        expect(action.acknowledgement).not.toMatch(/6\/|diopt|diagnos|answer key/i);
      }
    }
  });
  it("rejects malformed and oversized router commands", () => {
    expect(validVoiceCommand({ kind: "history", factIds: ["onset"], utteranceId: "u1", transcript: "When?" })).toBe(true);
    expect(validVoiceCommand({ kind: "history", factIds: "onset", utteranceId: "u1", transcript: "When?" })).toBe(false);
    expect(validVoiceCommand({ kind: "practice-action", lessonId: "worth", actionId: "request-report", utteranceId: "u2", transcript: "x".repeat(501) })).toBe(false);
  });
  it("accepts only well-formed social commands and maps each fixed reply to a cache key", () => {
    expect(validVoiceCommand({ kind: "social", socialId: "greeting", utteranceId: "u3", transcript: "Hi" })).toBe(true);
    expect(validVoiceCommand({ kind: "patient-reply", replyId: "age", utteranceId: "u5", transcript: "How old are you?" })).toBe(true);
    expect(validVoiceCommand({ kind: "social", socialId: "", utteranceId: "u4", transcript: "Hi" })).toBe(false);
    for (const [socialId, spokenText] of Object.entries(SOCIAL_VOICE_REPLIES))
      expect(socialVoiceReply(socialId)).toEqual({ accepted: true, spokenText, cacheKey: `social:${socialId}` });
  });
  it("keeps every fixed social, instruction, and Practice acknowledgement in the generated-audio manifest", () => {
    const manifest = new Map(voiceManifest.items.map(item => [item.key, item.text]));
    for (const [socialId, text] of Object.entries(SOCIAL_VOICE_REPLIES))
      expect(manifest.get(`social:${socialId}`)).toBe(text);
    for (const [replyId, reply] of Object.entries(PATIENT_VOICE_REPLIES)) {
      expect(patientVoiceReply(replyId)).toMatchObject({ accepted: true, spokenText: reply.text, cacheKey: `patient:${replyId}` });
      expect(manifest.get(`patient:${replyId}`)).toBe(reply.text);
    }
    expect(manifest.get("instruction:fixate-target")).toBe("Okay, I am looking where you asked.");
    expect(manifest.get("instruction:follow-target")).toBe("Okay, I will follow the target with my eyes.");
    expect(manifest.get("instruction:report-symptoms")).toBe("I will tell you if I notice double vision, pain, or discomfort.");
    expect(manifest.get("instruction:read-chart")).toBe("Okay, I will read what I can.");
    const acknowledgements = new Map<string, string>();
    for (const actions of Object.values(PRACTICE_VOICE_ACTIONS))
      for (const action of actions) acknowledgements.set(action.id, action.acknowledgement);
    for (const [actionId, text] of acknowledgements)
      expect(manifest.get(`practice:ack:${actionId}`)).toBe(text);
  });
  it("maps every Test patient instruction to a desktop examination control", () => {
    expect(TEST_VOICE_INSTRUCTIONS).toContain("read-chart");
    for (const instruction of TEST_VOICE_INSTRUCTIONS)
      expect(TEST_VOICE_INSTRUCTION_CONTROLS[instruction].length).toBeGreaterThan(0);
  });
});

describe("voice output arbiter", () => {
  it("gives canonical output precedence, drops late frames, and supports barge-in", () => {
    const arbiter = new VoiceOutputArbiter(); const geminiStop = vi.fn(); const canonicalStop = vi.fn();
    const first = arbiter.beginTurn();
    expect(arbiter.play(first, "gemini", geminiStop)).toBe(true);
    expect(arbiter.preferCanonical(first)).toBe(true); expect(geminiStop).toHaveBeenCalledTimes(1);
    expect(arbiter.play(first, "canonical", canonicalStop)).toBe(true);
    expect(arbiter.play(first, "gemini", vi.fn())).toBe(false);
    const second = arbiter.beginTurn(); expect(canonicalStop).toHaveBeenCalledTimes(1);
    expect(arbiter.play(first, "canonical", vi.fn())).toBe(false);
    const secondStop = vi.fn(); expect(arbiter.play(second, "gemini", secondStop)).toBe(true);
    arbiter.stop(); expect(secondStop).toHaveBeenCalledTimes(1);
  });
});
