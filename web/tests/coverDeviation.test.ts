import { describe, expect, it } from "vitest";
import {
  CLINIC_COVER_ROTATION_ARM, alternateCoverMovements, alternateCoverNeutralized, coverEyeTargets, coverIrisOffset,
  deviationFromLabel, prismFixationShift, settleCoverEyes, straightPoses,
  type CoverDeviationModel, type CoverEyePoses, type PrismPlacement,
} from "../interaction/coverDeviation";
import { CLINIC_IRIS_RADIUS } from "../interaction/clinicPatient";
import { EYE_SURFACE_IRIS_RADIUS } from "../scene/EyeSurface";
import { alternateCoverModel, alternateCoverScenarios, coverScenarios, deviationForMovement } from "../interaction/practiceCover";
import type { CoverPosition } from "../interaction/cover";

const model = (id: string) => coverScenarios.find(item => item.id === id)!.model as CoverDeviationModel;
const alternate = (id: string) => alternateCoverModel(alternateCoverScenarios.find(item => item.id === id)!);
const settle = (m: CoverDeviationModel, cover: CoverPosition, poses: CoverEyePoses, seconds: number, prism: PrismPlacement = null) => {
  let next = poses;
  for (let t = 0; t < seconds; t += 1 / 72) next = settleCoverEyes(m, cover, next, 1 / 72, prism);
  return next;
};
/** Runs a full alternating sequence with a hold per position, returning each uncovered eye's observed movement. */
const alternateRun = (m: CoverDeviationModel, hold: number, prism: PrismPlacement = null) => {
  let poses = coverEyeTargets(m, "away", prism);
  const seen: { eye: "OD" | "OS"; h: number; v: number }[] = [];
  for (const cover of ["OD", "OS", "OD", "OS"] as const) {
    const uncovered = cover === "OD" ? "OS" : "OD";
    const before = poses[uncovered];
    poses = settle(m, cover, poses, hold, prism);
    seen.push({ eye: uncovered, h: poses[uncovered].h - before.h, v: poses[uncovered].v - before.v });
  }
  // [0] is the first cover from binocular viewing (nothing visible moves); [1] is the first shift, after only a
  // partial first dissociation; from [2] on the deviation is fully dissociated.
  return seen;
};

describe("sustained cover-test deviations", () => {
  it("keeps orthophoria straight in every occluder position", () => {
    for (const cover of ["away", "OD", "OS"] as const) expect(coverEyeTargets(model("orthophoria"), cover)).toEqual(straightPoses());
  });

  it("shows a constant left esotropia that refixates on covering OD and holds until uncovered", () => {
    const et = model("left-esotropia");
    expect(coverEyeTargets(et, "away")).toEqual({ OD: { h: 0, v: 0 }, OS: { h: -20, v: 0 } });
    expect(coverEyeTargets(et, "OD")).toEqual({ OD: { h: -20, v: 0 }, OS: { h: 0, v: 0 } });
    expect(coverEyeTargets(et, "OS")).toEqual(coverEyeTargets(et, "away"));
    let poses = coverEyeTargets(et, "away");
    poses = settle(et, "OD", poses, .1);
    expect(Math.abs(poses.OS.h)).toBeLessThan(.5); // fast refixation: >97% within 100 ms
    poses = settle(et, "OD", poses, 1);
    expect(Math.abs(poses.OS.h)).toBeLessThan(.01); // sustained, not a returning twitch
    poses = settle(et, "away", poses, .15);
    expect(poses.OS.h).toBeCloseTo(-20, 0); // unilateral: OS returns in when OD is uncovered
  });

  it("lets an exophoric eye drift out slowly behind the cover and recover on uncovering", () => {
    const xp = model("exophoria");
    expect(coverEyeTargets(xp, "away")).toEqual(straightPoses());
    expect(coverEyeTargets(xp, "OS")).toEqual({ OD: { h: 0, v: 0 }, OS: { h: 10, v: 0 } });
    let poses = settle(xp, "OS", straightPoses(), .1);
    expect(poses.OS.h).toBeGreaterThan(1); expect(poses.OS.h).toBeLessThan(5); // gradual first dissociation
    poses = settle(xp, "OS", poses, 2);
    expect(poses.OS.h).toBeCloseTo(10, 1);
    const recovering = settle(xp, "away", poses, .1);
    expect(recovering.OS.h).toBeGreaterThan(3); // fusional recovery is slower than a saccade
    expect(settle(xp, "away", poses, .6).OS.h).toBeCloseTo(0, 0);
  });

  it("yokes the covered eye to the refixation so every alternating shift shows the full deviation", () => {
    const exo = alternate("exo12");
    // Even with brisk 0.3 s holds, each shift after the first shows the whole 12Δ (Hering's law).
    const moves = alternateRun(exo, .3);
    expect(moves[1].h).toBeLessThan(0); expect(moves[1].h).toBeGreaterThan(-12); // first shift: partial dissociation
    for (const move of moves.slice(2)) expect(move.h).toBeCloseTo(-12, 0);
    // The covered eye moves together with the refixation, not by a slow drift.
    let poses = settle(exo, "OD", straightPoses(), 2);
    poses = settle(exo, "OS", poses, .08);
    expect(poses.OS.h).toBeGreaterThan(10);
  });

  it("moves the two eyes in opposite directions for a vertical deviation", () => {
    const hypo = alternate("r-hypo8");
    const moves = alternateRun(hypo, .5).slice(2);
    for (const move of moves) expect(Math.abs(move.v)).toBeCloseTo(8, 0);
    expect(moves.find(move => move.eye === "OD")!.v).toBeGreaterThan(0); // R hypo: OD moves up when uncovered
    expect(moves.find(move => move.eye === "OS")!.v).toBeLessThan(0); // and OS moves down
    const hyper = alternateCoverMovements(alternate("r-hyper10"));
    expect(hyper.OD.v).toBe(-10); expect(hyper.OS.v).toBe(10);
  });

  it("matches each authored OD movement and size to the eye model", () => {
    for (const scenario of alternateCoverScenarios) {
      const od = alternateCoverMovements(alternateCoverModel(scenario)).OD;
      const direction = od.h < 0 ? "in" : od.h > 0 ? "out" : od.v > 0 ? "up" : "down";
      expect(direction, scenario.id).toBe(scenario.movement);
      expect(deviationForMovement(direction)).toBe(scenario.deviation);
      expect(Math.hypot(od.h, od.v)).toBe(scenario.amount);
    }
  });

  it("turns the eye behind a prism toward the apex and leaves no movement at the endpoint", () => {
    expect(prismFixationShift("base-in", 6)).toEqual({ h: 6, v: 0 });
    expect(prismFixationShift("base-up", 6)).toEqual({ h: 0, v: -6 });
    const exo = alternate("exo12");
    const prism = { eye: "OD" as const, base: "base-in", power: 12 };
    expect(coverEyeTargets(exo, "OS", prism).OD).toEqual({ h: 12, v: 0 }); // fixating through the prism
    expect(coverEyeTargets(exo, "OD", prism).OD).toEqual({ h: 12, v: 0 }); // and it stays there when covered
    for (const move of alternateRun(exo, .5, prism).slice(1)) expect(Math.abs(move.h)).toBeLessThan(.3);
  });

  it("reduces movement with partial prism, reverses on overcorrection, and grows with the wrong base", () => {
    const exo = alternate("exo12");
    const move = (base: string, power: number) => alternateCoverMovements(exo, { eye: "OS", base, power }).OS.h;
    expect(move("base-in", 8)).toBe(-4);
    expect(move("base-in", 16)).toBe(4);
    expect(move("base-out", 4)).toBe(-16);
    const hypo = alternate("r-hypo8");
    expect(alternateCoverNeutralized(hypo, { eye: "OD", base: "base-up", power: 8 })).toBe(true);
    expect(alternateCoverNeutralized(hypo, { eye: "OS", base: "base-down", power: 8 })).toBe(true);
    expect(alternateCoverMovements(hypo, { eye: "OS", base: "base-up", power: 8 }).OS.v).toBe(-16);
  });

  it("keeps the phoria relation in its documented convention", () => {
    expect(deviationFromLabel("exo", 12)).toEqual({ h: 12, v: 0 });
    expect(deviationFromLabel("r-hypo", 8)).toEqual({ h: 0, v: -8 });
    expect(coverEyeTargets(alternate("r-hypo8"), "OD").OD.v).toBe(-8); // OD lower when dissociated
    expect(coverEyeTargets(alternate("r-hypo8"), "OS").OS.v).toBe(8); // so OS is higher when it is dissociated
  });

  it("scales iris shift with prism dioptres in proportion to the rendered iris", () => {
    const [x12] = coverIrisOffset("OS", { h: 12, v: 0 });
    const [x18] = coverIrisOffset("OS", { h: 18, v: 0 });
    expect(x12 / CLINIC_IRIS_RADIUS).toBeCloseTo(11 * Math.sin(Math.atan(.12)) / 5.9, 5);
    expect(x18).toBeGreaterThan(x12 * 1.45);
    expect(CLINIC_COVER_ROTATION_ARM).toBeGreaterThan(CLINIC_IRIS_RADIUS);
    expect(coverIrisOffset("OD", { h: 10, v: 0 })[0]).toBeLessThan(0);
    expect(coverIrisOffset("OS", { h: 10, v: 0 })[0]).toBeGreaterThan(0);
    expect(coverIrisOffset("OD", { h: 0, v: 8 })[1]).toBeGreaterThan(0);
  });

  it("gives the desktop eye the same proportional shift in its own units", () => {
    const desktop = coverIrisOffset("OS", { h: 12, v: 0 }, EYE_SURFACE_IRIS_RADIUS)[0] / EYE_SURFACE_IRIS_RADIUS;
    const xr = coverIrisOffset("OS", { h: 12, v: 0 })[0] / CLINIC_IRIS_RADIUS;
    expect(desktop).toBeCloseTo(xr, 10);
  });
});
