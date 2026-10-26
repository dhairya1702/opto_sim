import { readFile, stat } from "node:fs/promises";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { createPatientReportSpeaker, patientReportAudioUrl } from "../voice/patientReportSpeech";
import { MADDOX_PRISM_CELLS, MADDOX_TRIALS, maddoxPatientReport } from "../interaction/maddoxProcedure";
import { THORINGTON_CASES, thoringtonPatientReport } from "../interaction/thoringtonProcedure";
import { worthReports, worthPatientReport } from "../interaction/sensory";
import { worthAtDistance, worthCases } from "../interaction/worth";
import thoringtonAudio from "../../shared/thoringtonReportAudio.json";
import reportAudio from "../../shared/maddoxReportAudio.json";
import worthAudio from "../../shared/worthReportAudio.json";

function output(resolveAudio: (text: string) => Promise<string | null> = async () => "/reply.mp3") {
  const clips: HTMLAudioElement[] = [];
  const makeAudio = vi.fn(() => {
    const clip = { play: vi.fn(async () => undefined), pause: vi.fn(), remove: vi.fn() } as unknown as HTMLAudioElement;
    clips.push(clip);
    return clip;
  });
  const beforePlay = vi.fn();
  return { clips, makeAudio, beforePlay, speaker: createPatientReportSpeaker(resolveAudio, makeAudio, beforePlay) };
}
describe("automatic patient report MP3 playback", () => {
  it("plays each settled setting even when wording is unchanged, without repeating frame updates", async () => {
    const { clips, speaker, beforePlay } = output();
    const error = vi.fn();
    await speaker.update("trial:20:BI", "The streak is right of the light.", error);
    await speaker.update("trial:20:BI", "The streak is right of the light.", error);
    expect(clips).toHaveLength(1);
    await speaker.update("trial:15:BI", "The streak is right of the light.", error);
    expect(clips[0].pause).toHaveBeenCalledOnce();
    expect(clips).toHaveLength(2);
    expect(clips[1].play).toHaveBeenCalledOnce();
    expect(beforePlay).toHaveBeenCalledTimes(2);
    expect(error).not.toHaveBeenCalled();
  });
  it("stops invalidated responses and permits the same setting after a new valid dwell", async () => {
    const { clips, speaker } = output();
    await speaker.update("trial:6:BI", "The streak passes through the light.", vi.fn());
    await speaker.update("", "", vi.fn());
    expect(clips[0].pause).toHaveBeenCalledOnce();
    expect(clips[0].onerror).toBeNull();
    await speaker.update("trial:6:BI", "The streak passes through the light.", vi.fn());
    speaker.stop();
    expect(clips[1].pause).toHaveBeenCalledOnce();
  });
  it("rejects late asset resolution after exit or setting changes", async () => {
    let resolve!: (url: string | null) => void;
    const { speaker, makeAudio } = output(() => new Promise(done => { resolve = done; }));
    const pending = speaker.update("old", "Old report", vi.fn());
    speaker.stop();
    resolve("/old.mp3");
    await pending;
    expect(makeAudio).not.toHaveBeenCalled();
  });
  it("retries the same report after a missing clip or rejected browser playback", async () => {
    const error = vi.fn(), resolveMissing = vi.fn(async () => null);
    const missing = output(resolveMissing);
    await missing.speaker.update("missing", "Unknown reply", error);
    await missing.speaker.update("missing", "Unknown reply", error);
    expect(resolveMissing).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(2);
    const audio = output();
    audio.makeAudio.mockImplementationOnce(() => ({ play: vi.fn(async () => { throw new Error("blocked"); }), pause: vi.fn(), remove: vi.fn() }) as unknown as HTMLAudioElement);
    await audio.speaker.update("blocked", "Report", error);
    await audio.speaker.update("blocked", "Report", error);
    expect(audio.makeAudio).toHaveBeenCalledTimes(2);
    expect(audio.clips[0].play).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledTimes(3);
  });
  it("ships exact Charon audio for both axes of every authored Thorington case", async () => {
    const index = JSON.parse(await readFile("public/audio/voice/index.json", "utf8"));
    const reports = THORINGTON_CASES.flatMap(value => value.trials.map(thoringtonPatientReport));
    expect(Object.keys(thoringtonAudio).sort()).toEqual([...reports].sort());
    for (const text of reports) {
      const asset = thoringtonAudio[text as keyof typeof thoringtonAudio];
      expect(asset.textHash).toBe(createHash("sha256").update(text).digest("hex"));
      expect(asset.voice).toBe("Charon");
      expect(await patientReportAudioUrl(text)).toBe(`/audio/voice/${asset.file}`);
      expect(Object.values(index)).toContainEqual(expect.objectContaining(asset));
      expect((await stat(`public/audio/voice/${asset.file}`)).size).toBeGreaterThan(1000);
    }
  });
  it("ships exact Charon audio for every authored Worth patient response", async () => {
    const index = JSON.parse(await readFile("public/audio/voice/index.json", "utf8"));
    const reports = Object.keys(worthReports).map(finding => worthPatientReport(finding as keyof typeof worthReports));
    const allScenarioReports = worthCases.flatMap(scenario => [40, 600].map(distance => worthPatientReport(worthAtDistance(scenario, distance))));
    expect(Object.keys(worthAudio).sort()).toEqual([...reports].sort());
    expect(allScenarioReports).toHaveLength(16);
    expect(allScenarioReports.every(text => text in worthAudio)).toBe(true);
    for (const text of reports) {
      const asset = worthAudio[text as keyof typeof worthAudio];
      expect(asset.textHash).toBe(createHash("sha256").update(text).digest("hex"));
      expect(asset.voice).toBe("Charon");
      expect(await patientReportAudioUrl(text)).toBe(`/audio/voice/${asset.file}`);
      expect(Object.values(index)).toContainEqual(expect.objectContaining(asset));
      expect((await stat(`public/audio/voice/${asset.file}`)).size).toBeGreaterThan(1000);
    }
  });
  it("ships a matching Charon MP3 for every possible engine report, including non-coincidence and wrong-axis reports", async () => {
    const index = JSON.parse(await readFile("public/audio/voice/index.json", "utf8"));
    const reports = new Set(MADDOX_TRIALS.flatMap(trial => MADDOX_PRISM_CELLS.flatMap(power =>
      (["BI", "BO", "BU", "BD"] as const).map(base => maddoxPatientReport(trial, power, base)))));
    expect(Object.keys(reportAudio).sort()).toEqual([...reports].sort());
    for (const text of reports) {
      const asset = reportAudio[text as keyof typeof reportAudio];
      expect(asset.textHash).toBe(createHash("sha256").update(text).digest("hex"));
      expect(asset.voice).toBe("Charon");
      expect(await patientReportAudioUrl(text)).toBe(`/audio/voice/${asset.file}`);
      expect(Object.values(index)).toContainEqual(expect.objectContaining(asset));
      expect((await stat(`public/audio/voice/${asset.file}`)).size).toBeGreaterThan(1000);
    }
    expect(await patientReportAudioUrl("Invented response")).toBeNull();
  });
});
