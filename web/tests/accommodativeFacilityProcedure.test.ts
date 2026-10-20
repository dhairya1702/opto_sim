import { describe, expect, it } from "vitest";
import {
  accommodativeFacilityEye, accommodativeFacilityGuidedStep, establishFacilityFixation,
  flipAccommodativeFacility, interruptAccommodativeFacility, newAccommodativeFacilityRun,
  sampleAccommodativeFacility, startAccommodativeFacility, submitAccommodativeFacility,
  type FacilitySpatialSample,
} from "../interaction/accommodativeFacilityProcedure";

const ready = (nowMs: number): FacilitySpatialSample => ({ nowMs, correctionFitted: true, targetReady: true,
  occlusionReady: true, flipperHeld: true, flipperAligned: true, visible: true, tracking: true });

describe("shared accommodative-facility procedure", () => {
  it("guides setup in clinical order", () => {
    const run = newAccommodativeFacilityRun();
    expect(accommodativeFacilityGuidedStep(run, { ...ready(0), correctionFitted: false }).index).toBe(0);
    expect(accommodativeFacilityGuidedStep(run, { ...ready(0), targetReady: false }).index).toBe(1);
    expect(accommodativeFacilityGuidedStep(run, { ...ready(0), occlusionReady: false }).index).toBe(2);
    expect(accommodativeFacilityGuidedStep(run, { ...ready(0), flipperAligned: false }).index).toBe(3);
  });

  it("counts only valid full pairs and freezes an immutable deadline capture", () => {
    let run = establishFacilityFixation(newAccommodativeFacilityRun(), ready(0));
    run = startAccommodativeFacility(run, ready(0));
    expect(flipAccommodativeFacility(run, ready(1499))).toBe(run);
    run = flipAccommodativeFacility(run, ready(1500));
    expect(run.side).toBe("minus"); expect(run.cycles).toBe(0);
    run = flipAccommodativeFacility(run, ready(3300));
    expect(run.side).toBe("plus"); expect(run.cycles).toBe(1);
    run = sampleAccommodativeFacility(run, ready(60_000));
    expect(run.capture).toEqual({ eye: "OD", cycles: 1 });
    const frozen = run;
    expect(sampleAccommodativeFacility(run, { ...ready(61_000), tracking: false })).toBe(frozen);
  });

  it("restarts unfinished timing after invalid input but preserves completed records", () => {
    let run = startAccommodativeFacility(establishFacilityFixation(newAccommodativeFacilityRun(), ready(0)), ready(0));
    run = interruptAccommodativeFacility(run, "Visibility changed.");
    expect(run.startMs).toBeNull(); expect(run.cycles).toBe(0); expect(run.capture).toBeNull();
    run = startAccommodativeFacility(establishFacilityFixation(run, ready(1)), ready(1));
    run = sampleAccommodativeFacility(run, ready(60_001));
    run = submitAccommodativeFacility(run, "0");
    expect(run.records).toHaveLength(1); expect(accommodativeFacilityEye(run)).toBe("OS");
  });

  it("advances OD, OS, OU and awards completion only after all frozen counts", () => {
    let run = newAccommodativeFacilityRun();
    for (const eye of ["OD", "OS", "OU"] as const) {
      expect(accommodativeFacilityEye(run)).toBe(eye);
      run = establishFacilityFixation(run, ready(0));
      run = startAccommodativeFacility(run, ready(0));
      run = sampleAccommodativeFacility(run, ready(60_000));
      run = submitAccommodativeFacility(run, "0");
    }
    expect(run.phase).toBe("complete");
    expect(run.completionAwarded).toBe(true);
    expect(run.records.map(record => record.eye)).toEqual(["OD", "OS", "OU"]);
  });
});
