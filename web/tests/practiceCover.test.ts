import { describe, expect, it } from "vitest";
import { advancePracticeCoverStep, alternateCoverScenarios, deviationForMovement, prismBaseForDeviation, prismTrialNeutralizes } from "../interaction/practiceCover";

describe("cover practice", () => {
  it("maps eye movement to deviation and neutralising prism base", () => {
    expect(deviationForMovement("in")).toBe("exo");
    expect(deviationForMovement("out")).toBe("eso");
    expect(deviationForMovement("up")).toBe("hypo");
    expect(deviationForMovement("down")).toBe("hyper");
    expect(prismBaseForDeviation("exo")).toBe("base-in");
    expect(prismBaseForDeviation("hyper")).toBe("base-down");
  });

  it("keeps alternate cover continuous without an away step", () => {
    let state = { index: 0, dwell: 0 };
    for (let i = 0; i < 7; i++) state = advancePracticeCoverStep("alternate-cover", state.index, state.dwell, "OD", .1);
    expect(state.index).toBe(1);
    state = advancePracticeCoverStep("alternate-cover", state.index, state.dwell, "away", .1);
    expect(state).toEqual({ index: 1, dwell: 0 });
  });

  it("neutralises only with the authored base and prism amount", () => {
    const scenario = alternateCoverScenarios[0];
    expect(prismTrialNeutralizes(scenario, "base-in", 12)).toBe(true);
    expect(prismTrialNeutralizes(scenario, "base-out", 12)).toBe(false);
    expect(prismTrialNeutralizes(scenario, "base-in", 10)).toBe(false);
  });
});
