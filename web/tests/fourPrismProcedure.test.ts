import { describe, expect, it } from "vitest";
import {
  FOUR_PRISM_BO_ROLL_TOLERANCE_RAD, FOUR_PRISM_GUIDED_STEP_COUNT, advanceFourPrismSample,
  authoredFourPrismObservation, cancelFourPrismRun, clearFourPrismFixation, confirmFourPrismWithdrawal,
  establishFourPrismFixation, exitFourPrismRun, finalizeFourPrismRun, fourPrismBaseAlignmentError,
  fourPrismGuidedStep, handleFourPrismTool, initialFourPrismRun, interruptFourPrismEye,
  markFourPrismObservation, repeatFourPrismComparison, resetFourPrismRun, reviseFourPrismFitting,
  seededFourPrismDeck, submitFourPrismInterpretation, type FourPrismRunState, type FourPrismSample,
} from "../interaction/xrFourPrismPractice";

const position = { OD: [-.048, 1.5, -.48], OS: [.048, 1.5, -.48] } as const;
function prepared(scenario: "normal" | "suppression" = "normal") {
  let state = initialFourPrismRun(scenario);
  state = reviseFourPrismFitting(state, true, 1);
  state = establishFourPrismFixation(state);
  return handleFourPrismTool(state, true, 1);
}
function sample(state: FourPrismRunState, eye = state.expectedEye, patch: Partial<FourPrismSample> = {}): FourPrismSample {
  const baseAxis = eye === "OD" ? [-1, 0, 0] as const : [1, 0, 0] as const;
  return { trackingValid: true, examinerViewValid: true, correctionRevision: state.correctionRevision,
    fixationRevision: state.fixationRevision, prismToolRevision: 1, prismHeld: true, position: [...position[eye]],
    forward: [0, 0, -1], baseAxis: [...baseAxis], detectedEye: eye,
    boAlignmentErrorRad: fourPrismBaseAlignmentError([...baseAxis], eye), sampledDurationMs: 100, ...patch };
}
function capture(state: FourPrismRunState, eye = state.expectedEye) {
  for (let index = 0; index < 24; index++) state = advanceFourPrismSample(state, sample(state, eye));
  return state;
}
function bilateral(scenario: "normal" | "suppression" = "normal") {
  let state = capture(prepared(scenario));
  state = confirmFourPrismWithdrawal(state, [.4, 1.5, -.48], [0, 0, -1]);
  return capture(state);
}

describe("shared 4Δ base-out procedure", () => {
  it("exposes all nine guided phases without revealing a case answer", () => {
    expect(FOUR_PRISM_GUIDED_STEP_COUNT).toBe(9);
    let state = initialFourPrismRun();
    expect(fourPrismGuidedStep(state)).toMatchObject({ index: 0, id: "fit" });
    state = reviseFourPrismFitting(state, true, 1); expect(fourPrismGuidedStep(state).index).toBe(1);
    state = establishFourPrismFixation(state); expect(fourPrismGuidedStep(state).index).toBe(2);
    state = handleFourPrismTool(state, true, 1); expect(fourPrismGuidedStep(state).index).toBe(3);
    state = advanceFourPrismSample(state, sample(state)); expect(fourPrismGuidedStep(state).index).toBe(4);
    state = capture(state); expect(fourPrismGuidedStep(state).index).toBe(5);
    state = confirmFourPrismWithdrawal(state, [.4, 1.5, -.48], [0, 0, -1]); expect(fourPrismGuidedStep(state).index).toBe(6);
    state = capture(state); expect(fourPrismGuidedStep(state).index).toBe(7);
    state = markFourPrismObservation(state, "OD", "version-with-refixation");
    state = markFourPrismObservation(state, "OS", "version-with-refixation"); state = finalizeFourPrismRun(state);
    expect(fourPrismGuidedStep(state).index).toBe(8);
    state = submitFourPrismInterpretation(state, "normal"); expect(fourPrismGuidedStep(state)).toMatchObject({ index: 8, complete: true });
  });

  it("uses opposite physical temporal base axes with an inclusive authored tolerance", () => {
    expect(fourPrismBaseAlignmentError([-1, 0, 0], "OD")).toBe(0);
    expect(fourPrismBaseAlignmentError([1, 0, 0], "OS")).toBe(0);
    expect(fourPrismBaseAlignmentError([1, 0, 0], "OD")).toBeCloseTo(Math.PI);
    const boundary: [number, number, number] = [-Math.cos(FOUR_PRISM_BO_ROLL_TOLERANCE_RAD), Math.sin(FOUR_PRISM_BO_ROLL_TOLERANCE_RAD), 0];
    let state = prepared(); state = advanceFourPrismSample(state, sample(state, "OD", { baseAxis: boundary, boAlignmentErrorRad: FOUR_PRISM_BO_ROLL_TOLERANCE_RAD }));
    expect(state.dwellMs).toBe(100);
    state = advanceFourPrismSample(state, sample(state, "OD", { boAlignmentErrorRad: FOUR_PRISM_BO_ROLL_TOLERANCE_RAD + 1e-6 }));
    expect(state.dwellMs).toBe(0);
  });

  it("requires exact uninterrupted rendered sampling, OD first and full withdrawal", () => {
    let state = prepared();
    state = advanceFourPrismSample(state, sample(state, "OS")); expect(state.dwellMs).toBe(0);
    for (let index = 0; index < 23; index++) state = advanceFourPrismSample(state, sample(state));
    expect(state.eyeCaptures.OD).toBeUndefined(); expect(state.dwellMs).toBe(2300);
    state = advanceFourPrismSample(state, sample(state, "OD", { sampledDurationMs: 1000 }));
    expect(state.eyeCaptures.OD?.observedDurationMs).toBe(2400);
    const od = state.eyeCaptures.OD;
    state = advanceFourPrismSample(state, sample(state, "OS")); expect(state.eyeCaptures.OS).toBeUndefined();
    state = confirmFourPrismWithdrawal(state, [.4, 1.5, -.48], [0, 0, -1]);
    state = capture(state); expect(state.eyeCaptures.OD).toBe(od); expect(state.eyeCaptures.OS).toBeDefined();
  });

  it("cancels only unfinished dwell and preserves completed OD through release/tracking recovery", () => {
    let state = prepared(); state = advanceFourPrismSample(state, sample(state));
    state = interruptFourPrismEye(state, false); expect(state.dwellMs).toBe(0);
    state = capture(state); const od = state.eyeCaptures.OD;
    state = confirmFourPrismWithdrawal(state, [.4, 1.5, -.48], [0, 0, -1]);
    state = advanceFourPrismSample(state, sample(state));
    state = interruptFourPrismEye(state, true); expect(state.eyeCaptures.OD).toBe(od); expect(state.dwellMs).toBe(0); expect(state.fixationSetupRevision).toBeNull();
    state = establishFourPrismFixation(state); expect(state.phase).toBe("orient-os");
    state = capture(state); state = interruptFourPrismEye(state, true); expect(state.eyeCaptures.OS).toBeDefined();
    state = establishFourPrismFixation(state); expect(state.phase).toBe("record");
  });

  it("restarts on correction or explicit fixation revision while repeat retains fitting and scenario", () => {
    let state = capture(prepared("suppression"));
    state = reviseFourPrismFitting(state, false, 2); expect(state.eyeCaptures).toEqual({}); expect(state.fitted).toBe(false); expect(state.notice).toContain("restarted");
    state = reviseFourPrismFitting(state, true, 3); state = establishFourPrismFixation(state); state = handleFourPrismTool(state, true, 2);
    state = clearFourPrismFixation(state); expect(state.eyeCaptures).toEqual({}); expect(state.phase).toBe("fixation");
    state = bilateral("suppression"); const repeat = repeatFourPrismComparison(state);
    expect(repeat.scenario).toBe("suppression"); expect(repeat.fitted).toBe(true); expect(repeat.eyeCaptures).toEqual({}); expect(repeat.fixationSetupRevision).toBeNull();
  });

  it("maps all authored observations and freezes accurate bilateral evidence before interpretation", () => {
    expect(authoredFourPrismObservation("normal", "OD")).toBe("version-with-refixation");
    expect(authoredFourPrismObservation("normal", "OS")).toBe("version-with-refixation");
    expect(authoredFourPrismObservation("suppression", "OD")).toBe("version-without-refixation");
    expect(authoredFourPrismObservation("suppression", "OS")).toBe("no-movement");
    let state = bilateral("suppression"); const odCapture = state.eyeCaptures.OD;
    state = markFourPrismObservation(state, "OD", "version-with-refixation"); expect(state.eyeRecords.OD).toBeUndefined(); expect(state.notice).not.toContain("without");
    state = markFourPrismObservation(state, "OD", "version-without-refixation"); state = markFourPrismObservation(state, "OS", "no-movement");
    state = finalizeFourPrismRun(state); expect(Object.isFrozen(state.completedRun)).toBe(true); expect(state.completedRun?.records[0].capture).toBe(odCapture);
    const retry = submitFourPrismInterpretation(state, "normal"); expect(retry.recorded).toBe(false); expect(retry.completedRun).toBe(state.completedRun);
    const done = submitFourPrismInterpretation(retry, "suppression"); expect(done.recorded).toBe(true); expect(submitFourPrismInterpretation(done, "suppression")).toBe(done);
  });

  it("cleans cancellation, reset and exit generations without late completion", () => {
    const state = bilateral();
    const cancelled = cancelFourPrismRun(state); expect(cancelled.eyeCaptures).toEqual({}); expect(cancelled.fitted).toBe(true);
    const reset = resetFourPrismRun(state); expect(reset.fitted).toBe(false); expect(reset.generation).toBe(state.generation + 1);
    const exited = exitFourPrismRun(state); expect(exited.active).toBe(false); expect(exited.phase).toBe("inactive");
    expect(advanceFourPrismSample(exited, sample(state))).toBe(exited);
  });

  it("builds balanced reproducible concealed decks that are not strict alternation", () => {
    const a = seededFourPrismDeck(1234, 8), b = seededFourPrismDeck(1234, 8);
    expect(a).toEqual(b); expect(a.filter(value => value === "normal")).toHaveLength(4);
    expect(a.some((value, index) => index > 0 && value === a[index - 1])).toBe(true);
    expect(seededFourPrismDeck(5678, 8)).not.toEqual(a);
  });
});
