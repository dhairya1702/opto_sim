import { describe, expect, it } from "vitest";
import { clinicalCase } from "../cases/adultDistanceBlur";
import { advanceScopeInspection, advanceScopeSweep, initialScopeInspection, initialScopeSweep, pauseScopeSweep, scopeCaseSphere, scopeReflex, scopeSweepComplete, xrScopeAim, scopeCaseFundus } from "../interaction/xrScopes";
const eyes = { OD: [-.048, 1.5, -.573] as const, OS: [.048, 1.5, -.573] as const };
describe("patient-relative XR scopes", () => {
  it("intersects the patient plane, chooses the correct eye, and rejects misses and backwards beams", () => {
    expect(xrScopeAim([-.048, 1.5, .097], [0, 0, -1], eyes)?.eye).toBe("OD");
    expect(xrScopeAim([.048, 1.5, .097], [0, 0, -1], eyes)?.distanceCm).toBeCloseTo(67);
    expect(xrScopeAim([0, 1.5, .097], [0, 0, -1], eyes)).toBeNull();
    expect(xrScopeAim([-.048, 1.5, .097], [0, 0, 1], eyes)).toBeNull();
    expect(xrScopeAim([-.048, 1.5, -.6], [0, 0, -1], eyes)).toBeNull();
  });
  it("derives both endpoints from case data and uses the shared reflex reversal math", () => {
    const aim = { eye: "OD" as const, distanceCm: 67, x: .006, y: 0 };
    expect(scopeCaseSphere(clinicalCase, "OD")).toBe(-1.25);
    expect(scopeReflex(aim, clinicalCase, 0)?.motion).toBe("with");
    expect(scopeReflex(aim, clinicalCase, .25)?.motion).toBe("neutral");
    expect(scopeReflex(aim, clinicalCase, .5)?.offset).toBeLessThan(0);
    expect(scopeReflex(aim, { ...clinicalCase, exams: [] }, 0)).toBeNull();
  });
  it("requires two uninterrupted crossings for each bracket state and both neutral meridians", () => {
    let state = initialScopeSweep();
    for (const [motion, lens, axis] of [["with", 0, 90], ["neutral", .25, 90], ["neutral", .25, 180], ["against", .5, 180]] as const) {
      for (const x of [-.006, .006, -.006]) state = advanceScopeSweep(state, { aim: { eye: "OD", distanceCm: 67, x, y: 0 }, motion, lens, axis, ready: true });
    }
    expect(scopeSweepComplete(state)).toBe(true);
    expect(pauseScopeSweep(state).observed).toEqual(state.observed);
    let interrupted = initialScopeSweep();
    for (const x of [-.006, .006]) interrupted = advanceScopeSweep(interrupted, { aim: { eye: "OD", distanceCm: 67, x, y: 0 }, motion: "with", lens: 0, axis: 90, ready: true });
    interrupted = pauseScopeSweep(interrupted);
    interrupted = advanceScopeSweep(interrupted, { aim: { eye: "OD", distanceCm: 67, x: -.006, y: 0 }, motion: "with", lens: 0, axis: 90, ready: true });
    expect(interrupted.observed).toEqual([]);
  });
  it("reads each authored eye independently and never substitutes a normal view for missing content", () => {
    expect(scopeCaseFundus(clinicalCase, "OD")).toBe("schematic-within-normal-limits");
    expect(scopeCaseFundus(clinicalCase, "OS")).toBe("schematic-within-normal-limits");
    const fundus = clinicalCase.exams.find(exam => exam.id === "fundus")!;
    const caseData = { ...clinicalCase, exams: [{ ...fundus, findings: { "OD:default": fundus.findings["OD:default"] } }] };
    expect(scopeCaseFundus(caseData, "OD")).toBe("schematic-within-normal-limits");
    expect(scopeCaseFundus(caseData, "OS")).toBeNull();
    expect(scopeCaseFundus({ ...clinicalCase, exams: [] }, "OD")).toBeNull();
    expect(scopeCaseFundus({ ...clinicalCase, exams: [{ ...fundus, findings: { "OD:default": { ...fundus.findings["OD:default"], posteriorPole: undefined } } }] }, "OD")).toBeNull();
  });
  it("pauses unfinished fundus inspection rather than completing it across a tracking gap", () => {
    let state = initialScopeInspection();
    for (let i = 0; i < 7; i++) state = advanceScopeInspection(state, true, .1);
    state = advanceScopeInspection(state, false, 5);
    for (let i = 0; i < 7; i++) state = advanceScopeInspection(state, true, .1);
    expect(state.seen).toBe(false);
    for (let i = 0; i < 7; i++) state = advanceScopeInspection(state, true, .1);
    expect(state.seen).toBe(true);
  });
});
