import { describe, expect, it } from "vitest";
import { advancePracticeCoverStep, alternateCoverScenarios, deviationForMovement, prismTrialNeutralizes } from "../interaction/practiceCover";

describe("cover practice", () => {
  it("interprets OD's refixation on uncovering", () => {
    expect(deviationForMovement("in")).toBe("exo");
    expect(deviationForMovement("out")).toBe("eso");
    expect(deviationForMovement("up")).toBe("r-hypo");
    expect(deviationForMovement("down")).toBe("r-hyper");
    for (const scenario of alternateCoverScenarios) expect(deviationForMovement(scenario.movement)).toBe(scenario.deviation);
  });

  it("keeps alternate cover continuous without an away step", () => {
    let state = { index: 0, dwell: 0 };
    for (let i = 0; i < 7; i++) state = advancePracticeCoverStep("alternate-cover", state.index, state.dwell, "OD", .1);
    expect(state.index).toBe(1);
    state = advancePracticeCoverStep("alternate-cover", state.index, state.dwell, "away", .1);
    expect(state).toEqual({ index: 1, dwell: 0 });
  });

  it("neutralises horizontal deviations with the right base before either eye", () => {
    const scenario = alternateCoverScenarios[0];
    for (const eye of ["OD", "OS"] as const) {
      expect(prismTrialNeutralizes(scenario, "base-in", 12, eye)).toBe(true);
      expect(prismTrialNeutralizes(scenario, "base-out", 12, eye)).toBe(false);
      expect(prismTrialNeutralizes(scenario, "base-in", 10, eye)).toBe(false);
    }
    expect(prismTrialNeutralizes(scenario, "", 12, "OD")).toBe(false);
  });

  it("neutralises vertical deviations with base up before the hypo eye or base down before the hyper eye", () => {
    const hypo = alternateCoverScenarios.find(item => item.id === "r-hypo8")!;
    expect(prismTrialNeutralizes(hypo, "base-up", 8, "OD")).toBe(true);
    expect(prismTrialNeutralizes(hypo, "base-down", 8, "OS")).toBe(true);
    expect(prismTrialNeutralizes(hypo, "base-up", 8, "OS")).toBe(false);
    expect(prismTrialNeutralizes(hypo, "base-down", 8, "OD")).toBe(false);
    const hyper = alternateCoverScenarios.find(item => item.id === "r-hyper10")!;
    expect(prismTrialNeutralizes(hyper, "base-down", 10, "OD")).toBe(true);
    expect(prismTrialNeutralizes(hyper, "base-up", 10, "OS")).toBe(true);
    expect(prismTrialNeutralizes(hyper, "base-up", 10, "OD")).toBe(false);
  });
});
