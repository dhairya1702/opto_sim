import { describe, expect, it, vi } from "vitest";
import { invokePracticeVoiceAction, PRACTICE_LESSON_IDS, PRACTICE_VOICE_ACTIONS } from "../voice/practiceActions";
import { VoiceOutputArbiter } from "../voice/outputArbiter";
import { validVoiceCommand } from "../voice/contracts";
import { SOCIAL_VOICE_REPLIES, socialVoiceReply } from "../voice/socialReplies";
import voiceManifest from "../../voice-assets/manifest.json";
import voiceIndex from "../../public/audio/voice/index.json";
import { TEST_VOICE_INSTRUCTIONS, TEST_VOICE_INSTRUCTION_CONTROLS } from "../voice/testInstructions";
import { PATIENT_VOICE_REPLIES, patientVoiceReply } from "../voice/patientReplies";
import { VOICE_AVAILABLE } from "../voice/config";

describe("voice contracts and Practice allowlists", () => {
  it("includes voice controls in every build", () => {
    expect(VOICE_AVAILABLE).toBe(true);
  });
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
    expect(validVoiceCommand({ kind: "encounter-action", actionId: "dim-room", utteranceId: "u3", transcript: "Dim the lights" })).toBe(true);
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
      for (const action of actions) if (action.id !== "target-on" && action.id !== "target-off") acknowledgements.set(action.id, action.acknowledgement);
    for (const [actionId, text] of acknowledgements)
      expect(manifest.get(`practice:ack:${actionId}`)).toBe(text);
    expect(manifest.get("practice:motility:report-symptoms")).toBe("No double vision, pain, or discomfort in any direction.");
    expect(voiceIndex["practice:motility:report-symptoms"]).toMatchObject({ voice: "Charon" });
  });
  it("returns the completed motility symptom report as canonical patient audio", async () => {
    const click = vi.fn();
    const button = {
      disabled: false, offsetParent: {}, innerText: "ASK ABOUT SYMPTOMS", click,
      getAttribute: () => null,
    } as unknown as HTMLButtonElement;
    const root = {
      querySelectorAll: () => [button],
      querySelector: () => null,
    } as unknown as ParentNode;
    await expect(invokePracticeVoiceAction("motility", "report-symptoms", root)).resolves.toEqual({
      accepted: true,
      spokenText: "No double vision, pain, or discomfort in any direction.",
      cacheKey: "practice:motility:report-symptoms",
    });
    expect(click).toHaveBeenCalledTimes(1);
  });
  it("keeps Krimsky examiner-eye declarations silent while applying the control", async () => {
    const click = vi.fn();
    const button = {
      disabled: false, offsetParent: {}, innerText: "CLOSE RIGHT EYE · LEFT VIEW", click,
      getAttribute: () => null,
    } as unknown as HTMLButtonElement;
    const root = { querySelectorAll: () => [button] } as unknown as ParentNode;
    await expect(invokePracticeVoiceAction("krimsky", "examiner-close-right-eye", root)).resolves.toEqual({
      accepted: true,
      spokenText: "Left examiner-eye view active.",
      suppressAudio: true,
    });
    expect(click).toHaveBeenCalledTimes(1);
  });
  it("applies explicit Worth power commands silently and never toggles through the opposite control", async () => {
    const click = vi.fn();
    const button = { disabled: false, offsetParent: {}, innerText: "SWITCH TARGET ON", click, getAttribute: () => null } as unknown as HTMLButtonElement;
    const root = { querySelectorAll: () => [button] } as unknown as ParentNode;
    await expect(invokePracticeVoiceAction("worth", "target-on", root)).resolves.toMatchObject({ accepted: true, suppressAudio: true });
    expect(click).toHaveBeenCalledTimes(1);
    await expect(invokePracticeVoiceAction("worth", "target-off", root)).resolves.toMatchObject({ accepted: false, errorCode: "TECHNIQUE_GATE" });
    expect(click).toHaveBeenCalledTimes(1);
  });
  it("speaks only the current Worth report and rejects a report request before its gate", async () => {
    let current = false;
    const button = { disabled: false, offsetParent: {}, innerText: "ASK COUNT, COLOURS AND POSITIONS", click: () => { current = true; }, getAttribute: () => null } as unknown as HTMLButtonElement;
    const root = {
      querySelectorAll: () => [button],
      querySelector: (selector: string) => selector === "[data-voice-report]" && current ? { innerText: "I see four dots: one red, two green, and one mixed or white." } : selector === "[data-voice-status]" ? { innerText: "Near recorded · distance pending" } : null,
    } as unknown as ParentNode;
    await expect(invokePracticeVoiceAction("worth", "request-report", root)).resolves.toEqual({
      accepted: true, spokenText: "I see four dots: one red, two green, and one mixed or white.",
    });
    const gated = { querySelectorAll: () => [], querySelector: () => null } as unknown as ParentNode;
    await expect(invokePracticeVoiceAction("worth", "request-report", gated)).resolves.toMatchObject({ accepted: false, errorCode: "TECHNIQUE_GATE" });
  });
  it("waits only for the engine-owned Thorington capture and repeats an existing report without clicking", async () => {
    let report = "";
    const click = vi.fn(() => { setTimeout(() => { report = "Arun reports 6, right."; }, 260); });
    const button = { disabled: false, offsetParent: {}, innerText: "ASK NUMBER AND SIDE", click, getAttribute: () => null } as unknown as HTMLButtonElement;
    const root = {
      querySelectorAll: () => [button],
      querySelector: (selector: string) => selector === "[data-voice-report]" && report ? { innerText: report } : null,
    } as unknown as ParentNode;
    await expect(invokePracticeVoiceAction("thorington", "request-report", root)).resolves.toEqual({ accepted: true, spokenText: "Arun reports 6, right." });
    expect(click).toHaveBeenCalledTimes(1);
    await expect(invokePracticeVoiceAction("thorington", "request-report", root)).resolves.toEqual({ accepted: true, spokenText: "Arun reports 6, right." });
    expect(click).toHaveBeenCalledTimes(1);
  });
  it("repeats the engine-owned NRA/PRA report without advancing its procedure control", async () => {
    const click = vi.fn();
    const button = { disabled: false, offsetParent: {}, innerText: "PATIENT REPORT · WHAT DO YOU SEE?", click, getAttribute: () => null } as unknown as HTMLButtonElement;
    const root = {
      querySelectorAll: () => [button],
      querySelector: (selector: string) => selector === "[data-voice-report]" ? { innerText: "The letters are clear and single." } : null,
    } as unknown as ParentNode;
    await expect(invokePracticeVoiceAction("relative", "request-report", root)).resolves.toEqual({ accepted: true, spokenText: "The letters are clear and single." });
    expect(click).not.toHaveBeenCalled();
  });
  it("bounds a Thorington report wait without inventing evidence", async () => {
    vi.useFakeTimers();
    try {
      const click = vi.fn();
      const button = { disabled: false, offsetParent: {}, innerText: "ASK NUMBER AND SIDE", click, getAttribute: () => null } as unknown as HTMLButtonElement;
      const root = { querySelectorAll: () => [button], querySelector: () => null } as unknown as ParentNode;
      const result = invokePracticeVoiceAction("thorington", "request-report", root);
      await vi.advanceTimersByTimeAsync(420);
      await expect(result).resolves.toMatchObject({ accepted: false, errorCode: "TECHNIQUE_GATE" });
      expect(click).toHaveBeenCalledTimes(1);
    } finally { vi.useRealTimers(); }
  });
  it("arms the full horizontal-vergence instruction and replays the current engine report without endpoint clicks", async () => {
    const instructionClick = vi.fn();
    const instruction = { disabled: false, offsetParent: {}, innerText: "GIVE BLUR / DOUBLE / RECOVERY INSTRUCTION", click: instructionClick, getAttribute: () => null } as unknown as HTMLButtonElement;
    const instructionRoot = { querySelectorAll: () => [instruction], querySelector: () => null } as unknown as ParentNode;
    await expect(invokePracticeVoiceAction("horizontal-distance", "fixate-target", instructionRoot)).resolves.toMatchObject({ accepted: true });
    expect(instructionClick).toHaveBeenCalledTimes(1);

    const reportClick = vi.fn();
    const report = { disabled: false, offsetParent: {}, innerText: "PATIENT REPORT · WHAT DO YOU SEE?", click: reportClick, getAttribute: () => null } as unknown as HTMLButtonElement;
    const reportRoot = {
      querySelectorAll: () => [report],
      querySelector: (selector: string) => selector === "[data-voice-report]" ? { innerText: "The target is double and stays double." } : null,
    } as unknown as ParentNode;
    await expect(invokePracticeVoiceAction("horizontal-distance", "request-report", reportRoot)).resolves.toEqual({ accepted: true, spokenText: "The target is double and stays double." });
    expect(reportClick).not.toHaveBeenCalled();
  });
  it("arms vertical diplopia/recovery only and replays the engine report without creating evidence", async () => {
    const instructionClick = vi.fn();
    const instruction = { disabled: false, offsetParent: {}, innerText: "GIVE DOUBLE / RECOVERY INSTRUCTION", click: instructionClick, getAttribute: () => null } as unknown as HTMLButtonElement;
    const instructionRoot = { querySelectorAll: () => [instruction], querySelector: () => null } as unknown as ParentNode;
    await expect(invokePracticeVoiceAction("vertical-distance", "fixate-target", instructionRoot)).resolves.toMatchObject({ accepted: true });
    expect(instructionClick).toHaveBeenCalledTimes(1);
    expect(PRACTICE_VOICE_ACTIONS["vertical-distance"][0].phrases.join(" ")).not.toContain("blur");

    const reportClick = vi.fn();
    const report = { disabled: false, offsetParent: {}, innerText: "PATIENT REPORT · WHAT DO YOU SEE?", click: reportClick, getAttribute: () => null } as unknown as HTMLButtonElement;
    const reportRoot = { querySelectorAll: () => [report],
      querySelector: (selector: string) => selector === "[data-voice-report]" ? { innerText: "It is single again." } : null } as unknown as ParentNode;
    await expect(invokePracticeVoiceAction("vertical-distance", "request-report", reportRoot)).resolves.toEqual({ accepted: true, spokenText: "It is single again." });
    expect(reportClick).not.toHaveBeenCalled();
  });
  it("arms the near blur/diplopia/recovery instruction and reads the engine report without endpoint evidence", async () => {
    const instructionClick = vi.fn();
    const instruction = { disabled: false, offsetParent: {}, innerText: "GIVE BLUR / DOUBLE / RECOVERY INSTRUCTION", click: instructionClick, getAttribute: () => null } as unknown as HTMLButtonElement;
    const instructionRoot = { querySelectorAll: () => [instruction], querySelector: () => null } as unknown as ParentNode;
    await expect(invokePracticeVoiceAction("horizontal-near", "fixate-target", instructionRoot)).resolves.toMatchObject({ accepted: true });
    expect(instructionClick).toHaveBeenCalledTimes(1);

    const evidenceClick = vi.fn();
    const report = { disabled: false, offsetParent: {}, innerText: "MARK PATIENT ENDPOINT", click: evidenceClick, getAttribute: () => null } as unknown as HTMLButtonElement;
    const reportRoot = { querySelectorAll: () => [report],
      querySelector: (selector: string) => selector === "[data-voice-report]" ? { innerText: "The target has become blurred and stays blurred." } : null } as unknown as ParentNode;
    await expect(invokePracticeVoiceAction("horizontal-near", "request-report", reportRoot)).resolves.toEqual({ accepted: true, spokenText: "The target has become blurred and stays blurred." });
    expect(evidenceClick).not.toHaveBeenCalled();
    expect(PRACTICE_VOICE_ACTIONS["horizontal-near"][0].phrases.join(" ")).toContain("blur");
  });
  it("arms the minus-lens blur instruction and replays its engine-owned report without capturing", async () => {
    const instructionClick = vi.fn();
    const instruction = { disabled: false, offsetParent: {}, innerText: "GIVE FIRST SUSTAINED BLUR INSTRUCTION", click: instructionClick, getAttribute: () => null } as unknown as HTMLButtonElement;
    const instructionRoot = { querySelectorAll: () => [instruction], querySelector: () => null } as unknown as ParentNode;
    await expect(invokePracticeVoiceAction("minus-lens", "fixate-target", instructionRoot)).resolves.toMatchObject({ accepted: true });
    expect(instructionClick).toHaveBeenCalledTimes(1);

    const reportClick = vi.fn();
    const report = { disabled: false, offsetParent: {}, innerText: "PATIENT REPORT · WHAT DO YOU SEE?", click: reportClick, getAttribute: () => null } as unknown as HTMLButtonElement;
    const reportRoot = { querySelectorAll: () => [report],
      querySelector: (selector: string) => selector === "[data-voice-report]" ? { innerText: "The letters remain blurred; I cannot clear them." } : null } as unknown as ParentNode;
    await expect(invokePracticeVoiceAction("minus-lens", "request-report", reportRoot)).resolves.toEqual({ accepted: true, spokenText: "The letters remain blurred; I cannot clear them." });
    expect(reportClick).not.toHaveBeenCalled();
  });
  it("routes stereopsis fixation and speaks only the synchronous current-page reply", async () => {
    const fixationClick = vi.fn();
    const fixation = { disabled: false, offsetParent: {}, innerText: "LOOK AT THE CIRCLES", click: fixationClick, getAttribute: () => null } as unknown as HTMLButtonElement;
    const fixationRoot = { querySelectorAll: () => [fixation], querySelector: () => null } as unknown as ParentNode;
    await expect(invokePracticeVoiceAction("stereopsis", "fixate-target", fixationRoot)).resolves.toEqual({
      accepted: true, spokenText: "Okay, I’m looking at the circles.",
    });
    expect(fixationClick).toHaveBeenCalledTimes(1);

    let current = false;
    const ask = { disabled: false, offsetParent: {}, innerText: "ASK WHICH CIRCLE IS RAISED", click: () => { current = true; }, getAttribute: () => null } as unknown as HTMLButtonElement;
    const root = {
      querySelectorAll: () => [ask],
      querySelector: (selector: string) => selector === "[data-voice-report]" && current
        ? { innerText: "The middle circle looks raised." }
        : selector === "[data-voice-status]" ? { innerText: "800 arcsec · patient middle · classified correct" } : null,
    } as unknown as ParentNode;
    await expect(invokePracticeVoiceAction("stereopsis", "request-report", root)).resolves.toEqual({
      accepted: true, spokenText: "The middle circle looks raised.",
    });
    expect(PRACTICE_VOICE_ACTIONS.stereopsis.find(action => action.id === "request-report")?.phrases).toEqual(expect.arrayContaining([
      "which circle appears raised", "which circle is closer", "does one circle stand out", "what do you see",
    ]));
  });
  it("routes the Four-prism letter instruction through the setup gate without inventing observations", async () => {
    const click = vi.fn();
    const button = { disabled: false, offsetParent: {}, innerText: "LOOK AT THE ISOLATED LETTER", click, getAttribute: () => null } as unknown as HTMLButtonElement;
    const root = { querySelectorAll: () => [button], querySelector: () => null } as unknown as ParentNode;
    await expect(invokePracticeVoiceAction("four-prism", "fixate-target", root)).resolves.toEqual({
      accepted: true, spokenText: "Okay, I’m looking at the letter and keeping it single.",
    });
    expect(click).toHaveBeenCalledTimes(1);
    expect(PRACTICE_VOICE_ACTIONS["four-prism"][0].phrases).toEqual(expect.arrayContaining([
      "look at the isolated letter", "keep looking at the letter", "keep the letter single",
    ]));
    const gated = { querySelectorAll: () => [], querySelector: () => ({ innerText: "Fit best distance correction." }) } as unknown as ParentNode;
    await expect(invokePracticeVoiceAction("four-prism", "fixate-target", gated)).resolves.toEqual({
      accepted: false, spokenText: "Before fixation: Fit best distance correction.", errorCode: "TECHNIQUE_GATE",
    });
  });
  it("gives a stereopsis-specific gate without speaking historical page records", async () => {
    const gated = {
      querySelectorAll: () => [],
      querySelector: (selector: string) => selector === "[data-voice-status]" ? { innerText: "Polarised glasses are not fitted over the correction." } : null,
    } as unknown as ParentNode;
    await expect(invokePracticeVoiceAction("stereopsis", "request-report", gated)).resolves.toEqual({
      accepted: false,
      spokenText: "Before asking: Polarised glasses are not fitted over the correction.",
      errorCode: "TECHNIQUE_GATE",
    });
  });
  it("speaks the active abnormal motility finding instead of the normal cached reply", async () => {
    let shown = false;
    const button = {
      disabled: false, offsetParent: {}, innerText: "ASK ABOUT SYMPTOMS", click: () => { shown = true; },
      getAttribute: () => null,
    } as unknown as HTMLButtonElement;
    const root = {
      querySelectorAll: () => [button],
      querySelector: () => shown ? { innerText: "I see two images when I look to my right. I do not have pain or discomfort." } : null,
    } as unknown as ParentNode;
    await expect(invokePracticeVoiceAction("motility", "report-symptoms", root)).resolves.toEqual({
      accepted: true,
      spokenText: "I see two images when I look to my right. I do not have pain or discomfort.",
    });
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
