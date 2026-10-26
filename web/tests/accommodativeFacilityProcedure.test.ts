import { describe, expect, it } from "vitest";
import { accommodativeFacilityBoardActions } from "../interaction/practiceBoardActions";
import {
  accommodativeFacilityEye, accommodativeFacilityGuidedStep, establishFacilityFixation,
  facilityUsesAccessibilityShortcuts, flipAccommodativeFacility, interruptAccommodativeFacility, newAccommodativeFacilityRun,
  sampleAccommodativeFacility, startAccommodativeFacility, submitAccommodativeFacility,
  type FacilitySpatialSample,
} from "../interaction/accommodativeFacilityProcedure";

const ready = (nowMs: number): FacilitySpatialSample => ({ nowMs, correctionFitted: true, targetReady: true,
  occlusionReady: true, flipperHeld: true, flipperAligned: true, visible: true, tracking: true });

describe("shared accommodative-facility procedure", () => {
  it("keeps frozen counts on recording after release but requires setup for each next eye", () => {
    const released = { ...ready(61000), correctionFitted: false, targetReady: false, occlusionReady: false, flipperHeld: false, flipperAligned: false };
    let run = newAccommodativeFacilityRun();
    for (let index = 0; index < 3; index++) {
      run = startAccommodativeFacility(establishFacilityFixation(run, ready(0)), ready(0));
      run = sampleAccommodativeFacility(run, ready(60000));
      expect(accommodativeFacilityGuidedStep(run, released)).toMatchObject({ index: 7, title: "Record the frozen count" });
      run = submitAccommodativeFacility(run, "0");
      expect(accommodativeFacilityGuidedStep(run, released).index).toBe(index === 2 ? 7 : 0);
    }
    expect(accommodativeFacilityGuidedStep(run, released).title).toBe("Series complete");
  });
  it("reserves automatic setup and flip shortcuts for desktop accessibility", () => {
    expect(facilityUsesAccessibilityShortcuts("xr")).toBe(false);
    expect(facilityUsesAccessibilityShortcuts("desktop")).toBe(true);
  });
  it("offers desktop flipping only during a live run and restores fixation after interruption", () => {
    let run = newAccommodativeFacilityRun();
    run = establishFacilityFixation(run, ready(0));
    expect(accommodativeFacilityBoardActions(run, "desktop")).toEqual(["start"]);
    run = startAccommodativeFacility(run, ready(0));
    expect(accommodativeFacilityBoardActions(run, "desktop")).toEqual(["flip"]);
    expect(accommodativeFacilityBoardActions(run, "xr")).toEqual([]);
    const interrupted = interruptAccommodativeFacility(run, "Tracking lost.");
    expect(accommodativeFacilityBoardActions(interrupted, "desktop")).toEqual(["fixation"]);
    run = sampleAccommodativeFacility(run, ready(60000));
    expect(accommodativeFacilityBoardActions(run, "desktop")).toEqual([]);
    run = submitAccommodativeFacility(run, "0");
    expect(accommodativeFacilityBoardActions(run, "desktop")).toEqual(["fixation"]);
  });

  it("guides setup in clinical order", () => {
    const run = newAccommodativeFacilityRun();
    expect(accommodativeFacilityGuidedStep(run, { ...ready(0), correctionFitted: false }).index).toBe(0);
    expect(accommodativeFacilityGuidedStep(run, { ...ready(0), targetReady: false }).index).toBe(1);
    expect(accommodativeFacilityGuidedStep(run, { ...ready(0), occlusionReady: false }).index).toBe(2);
    expect(accommodativeFacilityGuidedStep(run, { ...ready(0), flipperAligned: false }).index).toBe(3);
    const fixed = establishFacilityFixation(run, ready(0));
    expect(accommodativeFacilityGuidedStep(fixed, { ...ready(0), flipperAligned: false }).index).toBe(4);
  });

  it("starts every timed eye on plus with no armed half-cycle", () => {
    let run = establishFacilityFixation(newAccommodativeFacilityRun(), ready(0));
    run = startAccommodativeFacility(run, ready(0));
    expect(run).toMatchObject({ phase: "running", side: "plus", cycles: 0, plusHalfArmed: false, lastTurn: "none" });
  });

  it("turns on premature and unpaired reports but counts only a cleared plus/minus pair", () => {
    let run = startAccommodativeFacility(establishFacilityFixation(newAccommodativeFacilityRun(), ready(0)), ready(0));
    run = flipAccommodativeFacility(run, ready(1499));
    expect(run).toMatchObject({ side: "minus", cycles: 0, plusHalfArmed: false, lastTurn: "premature" });
    run = sampleAccommodativeFacility(run, ready(2000));
    expect(run.feedback).toContain("before the patient cleared");
    run = flipAccommodativeFacility(run, ready(3299));
    expect(run).toMatchObject({ side: "plus", cycles: 0, plusHalfArmed: false, lastTurn: "unpaired" });
    run = flipAccommodativeFacility(run, ready(4799));
    expect(run).toMatchObject({ side: "minus", cycles: 0, plusHalfArmed: true, lastTurn: "valid" });
    run = flipAccommodativeFacility(run, ready(6599));
    expect(run).toMatchObject({ side: "plus", cycles: 1, plusHalfArmed: false, lastTurn: "valid" });
  });

  it("freezes an immutable deadline capture and ignores later turns", () => {
    let run = startAccommodativeFacility(establishFacilityFixation(newAccommodativeFacilityRun(), ready(0)), ready(0));
    run = flipAccommodativeFacility(run, ready(1500));
    run = flipAccommodativeFacility(run, ready(3300));
    run = sampleAccommodativeFacility(run, ready(60_000));
    expect(run.capture).toEqual({ eye: "OD", cycles: 1 });
    const frozen = run;
    expect(sampleAccommodativeFacility(run, { ...ready(61_000), tracking: false })).toBe(frozen);
    expect(flipAccommodativeFacility(run, ready(61_000))).toBe(frozen);
  });

  it("clears fixation when prepared setup becomes invalid before timing", () => {
    const run = establishFacilityFixation(newAccommodativeFacilityRun(), ready(0));
    const invalid = sampleAccommodativeFacility(run, { ...ready(1), targetReady: false });
    expect(invalid).toMatchObject({ phase: "setup", fixation: false, startMs: null, cycles: 0 });
    expect(invalid.feedback).toContain("Re-establish fixation");
  });

  it("restarts unfinished timing and fixation after interruption but preserves completed records", () => {
    let run = startAccommodativeFacility(establishFacilityFixation(newAccommodativeFacilityRun(), ready(0)), ready(0));
    run = interruptAccommodativeFacility(run, "Visibility changed.");
    expect(run).toMatchObject({ phase: "setup", fixation: false, startMs: null, cycles: 0, plusHalfArmed: false });
    expect(run.capture).toBeNull();
    run = startAccommodativeFacility(establishFacilityFixation(run, ready(1)), ready(1));
    run = sampleAccommodativeFacility(run, ready(60_001));
    run = submitAccommodativeFacility(run, "0");
    expect(run.records).toHaveLength(1); expect(accommodativeFacilityEye(run)).toBe("OS");
    expect(run).toMatchObject({ phase: "setup", fixation: false });
    const interrupted = interruptAccommodativeFacility(establishFacilityFixation(run, ready(60_002)), "Tracking changed.");
    expect(interrupted.records).toHaveLength(1);
    expect(interrupted).toMatchObject({ phase: "setup", fixation: false });
  });

  it("advances OD, OS, OU and awards completion only after all frozen counts", () => {
    let run = newAccommodativeFacilityRun();
    for (const eye of ["OD", "OS", "OU"] as const) {
      expect(accommodativeFacilityEye(run)).toBe(eye);
      run = establishFacilityFixation(run, ready(0));
      run = startAccommodativeFacility(run, ready(0));
      run = sampleAccommodativeFacility(run, ready(60_000));
      run = submitAccommodativeFacility(run, "0");
      if (eye !== "OU") expect(run).toMatchObject({ phase: "setup", fixation: false });
    }
    expect(run.phase).toBe("complete");
    expect(run.completionAwarded).toBe(true);
    expect(run.records.map(record => record.eye)).toEqual(["OD", "OS", "OU"]);
  });
});

it("keeps repeated fixation and start commands harmless during a timed run", () => {
  let run = startAccommodativeFacility(establishFacilityFixation(newAccommodativeFacilityRun(), ready(0)), ready(0));
  run = flipAccommodativeFacility(run, ready(1500));
  expect(establishFacilityFixation(run, ready(1600))).toBe(run);
  expect(startAccommodativeFacility(run, ready(1600))).toBe(run);
  run = flipAccommodativeFacility(run, ready(3300));
  run = sampleAccommodativeFacility(run, ready(60000));
  expect(run.capture).toEqual({ eye: "OD", cycles: 1 });
  expect(establishFacilityFixation(run, ready(60001))).toBe(run);
});

it("rejects a blank entry when the frozen facility count is zero", () => {
  let run = startAccommodativeFacility(establishFacilityFixation(newAccommodativeFacilityRun(), ready(0)), ready(0));
  run = sampleAccommodativeFacility(run, ready(60_000));
  expect(run.capture).toEqual({ eye: "OD", cycles: 0 });
  const blank = submitAccommodativeFacility(run, "   ");
  expect(blank).toMatchObject({ phase: "captured", records: [], feedback: "Enter the frozen full-cycle count." });
});
