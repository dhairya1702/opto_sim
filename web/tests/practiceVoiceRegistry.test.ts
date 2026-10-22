import lessons from "../../shared/practiceVoice.json";
import { voiceAssetMatches } from "../voice/audioAssets";
import { createHash } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { registerPracticeVoice, invokeRegisteredPracticeVoice } from "../voice/practiceRegistry";
import { requestedChart } from "../voice/testInstructions";
let owner: ReturnType<typeof registerPracticeVoice> | undefined;
afterEach(() => { owner?.dispose(); owner = undefined; vi.useRealTimers(); });
describe("procedure-owned voice", () => {
  it("requires exact response text and configured voice before playing a browser asset", async () => {
    const asset = { file: "reply.mp3", voice: "Charon", textHash: createHash("sha256").update("Look at the target.").digest("hex") };
    expect(await voiceAssetMatches(asset, "Look at the target.", "Charon")).toBe(true);
    expect(await voiceAssetMatches(asset, "Look at the near target.", "Charon")).toBe(false);
    expect(await voiceAssetMatches(asset, "Look at the target.", "Other")).toBe(false);
    expect(await voiceAssetMatches(asset, "Look at the target.", undefined)).toBe(false);
  });
  it("invokes an explicitly registered push-up instruction regardless of labels or DOM", async () => {
    const run = vi.fn();
    owner = registerPracticeVoice("push-up", { actions: [{ voiceIds: ["fixate-target"], run }] });
    expect(await invokeRegisteredPracticeVoice("push-up", "fixate-target")).toMatchObject({ accepted: true, spokenText: expect.stringContaining("blur") });
    expect(run).toHaveBeenCalledTimes(1);
    owner.update({ actions: [{ voiceIds: ["fixate-target"], run, disabled: true }] });
    expect(await invokeRegisteredPracticeVoice("push-up", "fixate-target")).toMatchObject({ accepted: false });
    expect(run).toHaveBeenCalledTimes(1);
  });
  it("reads the current scenario reply without controls or coaching and never flips on a report", async () => {
    const run = vi.fn();
    owner = registerPracticeVoice("accommodative-facility", { voiceReport: "It is still blurred.", actions: [{ voiceIds: ["report-clear"], run }] });
    expect(await invokeRegisteredPracticeVoice("accommodative-facility", "report-clear")).toEqual({ accepted: true, spokenText: "It is still blurred." });
    owner.update({ actions: [{ voiceIds: ["report-clear"], run }] });
    expect(await invokeRegisteredPracticeVoice("accommodative-facility", "report-clear")).toMatchObject({ accepted: false });
    expect(run).not.toHaveBeenCalled();
  });
  it("waits for a procedure publication and repeats it without recapturing", async () => {
    const run = vi.fn();
    owner = registerPracticeVoice("thorington", { actions: [{ voiceIds: ["request-report"], run }] });
    const pending = invokeRegisteredPracticeVoice("thorington", "request-report");
    owner.update({ actions: [], voiceReport: "The line is on the right." });
    expect(await pending).toEqual({ accepted: true, spokenText: "The line is on the right." });
    expect(await invokeRegisteredPracticeVoice("thorington", "request-report")).toEqual({ accepted: true, spokenText: "The line is on the right." });
    expect(run).toHaveBeenCalledTimes(1);
  });
  it("cancels a pending response on exit and prevents a previous owner removing a new lesson", async () => {
    owner = registerPracticeVoice("motility", { actions: [{ voiceIds: ["report-symptoms"], run: vi.fn() }] });
    const pending = invokeRegisteredPracticeVoice("motility", "report-symptoms");
    const old = owner;
    owner = registerPracticeVoice("worth", { actions: [], voiceReport: "I see four dots." });
    old.dispose();
    expect(await pending).toMatchObject({ accepted: false });
    expect(await invokeRegisteredPracticeVoice("motility", "report-symptoms")).toMatchObject({ accepted: false });
    expect(await invokeRegisteredPracticeVoice("worth", "request-report")).toMatchObject({ spokenText: "I see four dots." });
    owner.dispose();
    expect(await invokeRegisteredPracticeVoice("worth", "request-report")).toMatchObject({ accepted: false });
  });
  it("bounds missing reports without inventing a normal result", async () => {
    vi.useFakeTimers();
    owner = registerPracticeVoice("motility", { actions: [{ voiceIds: ["report-symptoms"], run: vi.fn() }] });
    const pending = invokeRegisteredPracticeVoice("motility", "report-symptoms");
    await vi.advanceTimersByTimeAsync(1000);
    expect(await pending).toMatchObject({ accepted: false, errorCode: "TECHNIQUE_GATE" });
  });
  it.each([["Read the near card", "near"], ["Read through the pin hole", "pinhole"], ["Read the distance chart", "distance"], ["Read this line", undefined]])("resolves explicit chart request %s", (text, chart) => {
    expect(requestedChart(text)).toBe(chart);
  });
});

describe("all lesson action contracts", () => {
  it.each(Object.entries(lessons))("dispatches declared actions for %s with gates and patient-only reports", async (lessonId, definitions) => {
    for (const definition of definitions) {
      const run = vi.fn();
      const reportAction = ["request-report", "report-clear", "report-symptoms"].includes(definition.id);
      owner?.dispose();
      owner = registerPracticeVoice(lessonId, { actions: [{ voiceIds: [definition.id], run, disabled: true }] });
      expect(await invokeRegisteredPracticeVoice(lessonId, definition.id)).toMatchObject({ accepted: false });
      expect(run).not.toHaveBeenCalled();
      owner.update({ actions: [{ voiceIds: [definition.id], run }], voiceReport: reportAction ? "My current patient response." : undefined });
      const result = await invokeRegisteredPracticeVoice(lessonId, definition.id);
      expect(result).toMatchObject({ accepted: true, spokenText: reportAction ? "My current patient response." : definition.acknowledgement });
      expect(run).toHaveBeenCalledTimes(reportAction ? 0 : 1);
      if (definition.id.startsWith("target-") || definition.id.startsWith("examiner-")) expect(result.suppressAudio).toBe(true);
    }
  });
  it("keeps repeated target power requests idempotent", async () => {
    const off = vi.fn();
    owner = registerPracticeVoice("worth", { actions: [{ voiceIds: ["target-off"], run: off }] });
    expect(await invokeRegisteredPracticeVoice("worth", "target-on")).toMatchObject({ accepted: true, suppressAudio: true });
    expect(off).not.toHaveBeenCalled();
  });
  it("uses an abnormal motility reply verbatim without a generic audio key", async () => {
    owner = registerPracticeVoice("motility", { actions: [], voiceReport: "I see double when looking to my right." });
    expect(await invokeRegisteredPracticeVoice("motility", "report-symptoms")).toEqual({ accepted: true, spokenText: "I see double when looking to my right." });
  });
});
