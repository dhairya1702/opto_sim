import { describe, expect, it, vi } from "vitest";
import lessons from "../../shared/practiceVoice.json" with { type: "json" };
import { GeminiIntentBridge, parseSemanticCall, semanticRequest } from "./semantic.mjs";

const context = { mode: "practice", lessonId: "motility", allowedActions: ["follow-target", "report-symptoms"] };
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
const encode = (intent, factIds = []) => JSON.stringify({ intent, factIds });
const parse = (text, ctx = context) => parseSemanticCall(text, semanticRequest(ctx), ctx);
const clarify = { name: "patient_reply", args: { replyId: "rephrase" } };

describe("structured intent classification boundaries", () => {
  it.each(Object.entries(lessons))("exposes only the active allowlisted lesson actions for %s", (lessonId, actions) => {
    const ctx = { mode: "practice", lessonId, allowedActions: actions.map(a => a.id) };
    const request = semanticRequest(ctx);
    expect(request.responseJsonSchema.properties.intent.enum.filter(id => id.startsWith("action:"))).toEqual(actions.map(a => `action:${a.id}`));
    for (const action of actions) {
      expect(request.systemInstruction).toContain(action.description);
      expect(parse(encode(`action:${action.id}`), ctx)).toEqual({ name: "practice_action", args: { actionId: action.id } });
      expect(parse(encode(`action:${action.id}`), { ...ctx, allowedActions: [] })).toEqual(clarify);
    }
  });
  it.each([
    "not JSON", "[]", "null", "true", "x".repeat(4097),
    encode("action:submit"), encode("action:target-on"), encode("follow-target"),
    JSON.stringify({ intent: "action:follow-target" }),
    JSON.stringify({ intent: "action:follow-target", factIds: [], answer: "invented finding" }),
    encode("action:follow-target", ["onset"]), encode("clarify", ["onset"]),
    JSON.stringify({ intent: ["action:follow-target"], factIds: [] }),
  ])("clarifies malformed, invented or mismatched model output: %s", output => expect(parse(output)).toEqual(clarify));
  it("routes unsupported and ambiguous speech to canonical replies, never generated patient speech", () => {
    expect(parse(encode("clarify"))).toEqual(clarify);
    expect(parse(encode("unsupported"))).toEqual({ name: "patient_reply", args: { replyId: "unknown" } });
  });
  it("excludes following after an explicit correction to steady fixation", () => {
    const request = semanticRequest(context, "Follow my finger, sorry, look at the light instead");
    expect(request.routes.has("action:follow-target")).toBe(false);
    expect(parseSemanticCall(encode("action:follow-target"), request, context)).toEqual(clarify);
    const test = { mode: "test", allowedFacts: [], allowedActions: ["follow-target", "fixate-target"] };
    const corrected = semanticRequest(test, "Follow the light, actually no, keep looking at the stationary letter");
    expect(corrected.routes.has("action:fixate-target")).toBe(true);
    expect(corrected.routes.has("action:follow-target")).toBe(false);
  });
  it.each(["Close your left eye please", "Shut the patient's right eye", "Open Arun's eyes"])("excludes examiner-eye actions for explicit patient-eye requests: %s", transcript => {
    const ctx = { mode: "practice", lessonId: "krimsky", allowedActions: lessons.krimsky.map(a => a.id) };
    const request = semanticRequest(ctx, transcript);
    expect([...request.routes.keys()].some(id => id.startsWith("action:examiner-"))).toBe(false);
    expect(parseSemanticCall(encode("action:examiner-close-left-eye"), request, ctx)).toEqual(clarify);
  });
  it("excludes Test room-light actions when the request explicitly refers to an instrument light", () => {
    const ctx = { mode: "test", allowedFacts: [], allowedActions: ["dim-room", "restore-room"] };
    const request = semanticRequest(ctx, "Turn the penlight off please");
    expect(request.routes.has("action:dim-room")).toBe(false);
    expect(request.routes.has("action:restore-room")).toBe(false);
    expect(semanticRequest(ctx, "Turn the room lights off please").routes.has("action:dim-room")).toBe(true);
  });
  it("maps only relevant case history identifiers and rejects empty, duplicated or invented IDs", () => {
    const ctx = { mode: "test", allowedActions: ["read-chart", "dim-room"], allowedFacts: [{ id: "onset", patterns: ["when did it start"] }, { id: "laterality", patterns: ["one or both eyes"] }] };
    const request = semanticRequest(ctx);
    expect(request.systemInstruction).toContain("when did it start");
    expect(parse(encode("history", ["onset", "laterality"]), ctx)).toEqual({ name: "route_history", args: { factIds: ["onset", "laterality"] } });
    for (const ids of [[], ["onset", "onset"], ["answer-key"], [null]]) expect(parse(encode("history", ids), ctx)).toEqual(clarify);
    expect(parse(encode("action:read-chart"), ctx)).toEqual({ name: "patient_instruction", args: { instructionId: "read-chart" } });
    expect(parse(encode("action:dim-room"), ctx)).toEqual({ name: "encounter_action", args: { actionId: "dim-room" } });
  });
});

describe("text-only semantic provider", () => {
  it.each(["Don't follow the light", "If I said follow the light, what would you do?", "I can't follow the light", 'Please say the phrase "follow the light"'])("clarifies non-executable speech without a model request: %s", async text => {
    const generateContent = vi.fn(), onFunction = vi.fn();
    class Client { models = { generateContent }; }
    const bridge = new GeminiIntentBridge({}, { onFunction, onError: vi.fn() }, async () => ({ GoogleGenAI: Client }));
    await bridge.start(context); await bridge.sendText(text);
    expect(generateContent).not.toHaveBeenCalled();
    expect(onFunction).toHaveBeenCalledWith(clarify, context);
    bridge.close();
  });
  it("sends one structured text request per bridge and no audio or case answers", async () => {
    const generateContent = vi.fn(async () => ({ text: encode("action:follow-target") }));
    const onFunction = vi.fn();
    class Client { models = { generateContent }; }
    const bridge = new GeminiIntentBridge({ routerModel: "test-router" }, { onFunction, onError: vi.fn() }, async () => ({ GoogleGenAI: Client }));
    await bridge.start(context);
    await bridge.sendText("Keep watching this wherever I move it");
    await bridge.sendText("repeat must not start another request");
    expect(generateContent).toHaveBeenCalledTimes(1);
    const request = generateContent.mock.calls[0][0];
    expect(request.model).toBe("test-router");
    expect(request.config.responseMimeType).toBe("application/json");
    expect(request.config.responseJsonSchema.additionalProperties).toBe(false);
    expect(request.config.systemInstruction).toContain("final explicitly stated intent");
    expect(request.config.systemInstruction).toContain("Negative percept QUESTIONS");
    expect(request.contents).toEqual([{ role: "user", parts: [{ text: "Keep watching this wherever I move it" }] }]);
    expect(onFunction).toHaveBeenCalledWith({ name: "practice_action", args: { actionId: "follow-target" } }, context);
    bridge.close();
    expect(request.config.abortSignal.aborted).toBe(true);
  });
  it("drops a response arriving after cancellation and aborts the client request", async () => {
    const response = deferred();
    const onFunction = vi.fn(), onError = vi.fn();
    let signal;
    class Client { models = { generateContent: request => { signal = request.config.abortSignal; return response.promise; } }; }
    const bridge = new GeminiIntentBridge({}, { onFunction, onError }, async () => ({ GoogleGenAI: Client }));
    await bridge.start(context);
    const pending = bridge.sendText("Unfamiliar wording");
    bridge.close();
    response.resolve({ text: encode("action:follow-target") });
    await pending;
    expect(signal.aborted).toBe(true);
    expect(onFunction).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });
  it("does not create a provider client after cancellation during import", async () => {
    const loading = deferred(), Client = vi.fn();
    const bridge = new GeminiIntentBridge({}, {}, () => loading.promise);
    const pending = bridge.start(context);
    bridge.close(); loading.resolve({ GoogleGenAI: Client }); await pending;
    expect(Client).not.toHaveBeenCalled();
  });
  it("reports provider failures without exposing transcript or generating speech", async () => {
    const error = new Error("unavailable"), onError = vi.fn(), onFunction = vi.fn();
    class Client { models = { generateContent: async () => { throw error; } }; }
    const bridge = new GeminiIntentBridge({}, { onFunction, onError }, async () => ({ GoogleGenAI: Client }));
    await bridge.start(context); await bridge.sendText("Unfamiliar wording");
    expect(onError).toHaveBeenCalledWith(error);
    expect(onFunction).not.toHaveBeenCalled();
    bridge.close();
  });
});
