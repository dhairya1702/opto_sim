import { describe, expect, it } from "vitest";
import {
  NPC_CASES, cancelNPCRun, configureNPCRun, enterNPCRecord, interruptNPCRun, markNPCObjectiveEndpoint, newNPCRun,
  npcCaseOrder, npcDisclosure, npcEyeState, npcGuidedStep, npcPatientReport, npcRecordFieldIds, npcRuleGeometry,
  npcRuleScaleDistance, npcRuleScalePosition, npcVoiceReply, releaseNPCRule, restartNPCTrial, reviseNPCSetup,
  sampleNPC, submitNPCRecord, type NPCRun, type NPCSpatialSample,
} from "../interaction/npcProcedure";

const spatial = (nowMs: number, distanceCm: number, overrides: Partial<NPCSpatialSample> = {}): NPCSpatialSample => ({
  nowMs, distanceCm, correctionFitted: true, ruleHeld: false, ruleDocked: true, patientFacing: true, upright: true,
  midlineOffsetCm: 0, visible: true, tracking: true, ...overrides,
});
const prepared = (caseId: "subjective" | "objective" = "subjective") => {
  let run = newNPCRun(caseId);
  for (const action of ["fit-correction", "pickup-rule", "dock-rule", "give-instruction"] as const) run = configureNPCRun(run, action);
  return run;
};
function move(run: NPCRun, from: number, to: number, now: number) {
  const direction = Math.sign(to - from); let distance = from;
  while (Math.abs(distance - to) > .001) { distance = Math.round((distance + direction * Math.min(.5, Math.abs(to - distance))) * 10) / 10; now += 250; run = sampleNPC(run, spatial(now, distance)); }
  return { run, now };
}
function trial(run: NPCRun, now = 0) {
  run = sampleNPC(run, spatial(now, 40)); run = sampleNPC(run, spatial(now += 250, 40));
  const finding = NPC_CASES[run.caseId]; let result = move(run, 40, finding.breakCm, now); run = result.run; now = result.now;
  run = sampleNPC(run, spatial(now += 250, finding.breakCm)); if (run.caseId === "objective") run = markNPCObjectiveEndpoint(run, spatial(now, finding.breakCm));
  run = sampleNPC(run, spatial(now += 10, finding.breakCm)); result = move(run, finding.breakCm, finding.recoveryCm, now); run = result.run; now = result.now;
  run = sampleNPC(run, spatial(now += 250, finding.recoveryCm)); if (run.caseId === "objective") run = markNPCObjectiveEndpoint(run, spatial(now, finding.recoveryCm));
  return { run, now };
}
function completed(caseId: "subjective" | "objective") {
  let run = prepared(caseId), now = 0;
  for (let i = 0; i < 3; i++) { const result = trial(run, now); run = result.run; now = result.now + 500; }
  return run;
}

describe("shared NPC procedure", () => {
  it("preserves both fictional patterns and concealed case order", () => {
    expect(NPC_CASES.subjective).toMatchObject({ breakCm: 6, recoveryCm: 8, method: "patient-report", breakingEye: "OS" });
    expect(NPC_CASES.objective).toMatchObject({ breakCm: 5, recoveryCm: 9, method: "objective-observation", breakingEye: "OS" });
    expect(npcCaseOrder("guided")).toEqual(["subjective", "objective"]); expect(npcCaseOrder("test")).toEqual(["objective", "subjective"]);
    expect(npcDisclosure("test")).toMatchObject({ showCoach: false, showHighlights: false, revealCaseIdentity: false, revealThresholds: false });
  });
  it("models a spectacle-plane 2–42 cm rule and classifies its geometry", () => {
    expect([npcRuleScalePosition(2), npcRuleScalePosition(42), npcRuleScaleDistance(.06)]).toEqual([.02, .42, 6]);
    expect(npcRuleGeometry(spatial(0, 40))).toBe(""); expect(npcRuleGeometry({ ...spatial(0, 40), ruleDocked: false })).toContain("spectacle plane");
    expect(npcRuleGeometry({ ...spatial(0, 40), patientFacing: false })).toContain("toward Arun"); expect(npcRuleGeometry({ ...spatial(0, 40), midlineOffsetCm: 2.01 })).toContain("midline");
  });
  it("accepts inclusive 38 and 42 cm starts only after 250 ms", () => {
    for (const value of [38, 42]) { let run = prepared(); run = sampleNPC(run, spatial(0, value)); run = sampleNPC(run, spatial(249, value)); expect(run.phase).toBe("start"); run = sampleNPC(run, spatial(250, value)); expect(run.phase).toBe("approach"); }
    let run = prepared(); run = sampleNPC(run, spatial(0, 37.9)); run = sampleNPC(run, spatial(500, 37.9)); expect(run.phase).toBe("start");
  });
  it("captures three subjective trials automatically and immutably", () => {
    const run = completed("subjective"); expect(run.phase).toBe("captured"); expect(run.captures).toHaveLength(3);
    expect(run.captures.map(c => [c.break.actualCm, c.recovery.actualCm])).toEqual([[6, 8], [6, 8], [6, 8]]);
    expect(run.captures.every(c => c.break.automatic && c.recovery.automatic && c.motionValid)).toBe(true); expect(Object.isFrozen(run.captures[0].break)).toBe(true);
  });
  it("requires explicit objective marking and holds OS drift until recovery", () => {
    let run = prepared("objective"); run = sampleNPC(run, spatial(0, 40)); run = sampleNPC(run, spatial(250, 40)); const result = move(run, 40, 5, 250); run = sampleNPC(result.run, spatial(result.now + 250, 5));
    expect(run.breakCapture).toBeNull(); expect(npcEyeState(run, 5).osDrifted).toBe(true); expect(npcPatientReport(run, 5)).toContain("single");
    run = markNPCObjectiveEndpoint(run, spatial(result.now + 250, 5)); expect(run.breakCapture?.automatic).toBe(false); expect(npcEyeState(run, 8.9).osDrifted).toBe(true); expect(npcEyeState(run, 9).osDrifted).toBe(false);
  });
  it("uses inclusive half-centimetre endpoint windows and rejects stale marks", () => {
    let run = prepared("objective"); run = sampleNPC(run, spatial(0, 40)); run = sampleNPC(run, spatial(250, 40));
    let result = move(run, 40, 5.5, 250); run = sampleNPC(result.run, spatial(result.now + 250, 5.5));
    expect(markNPCObjectiveEndpoint(run, spatial(result.now + 250, 5.5)).breakCapture?.actualCm).toBe(5.5);
    const stale = run.eventNonce; run = restartNPCTrial(run); expect(markNPCObjectiveEndpoint(run, spatial(result.now + 500, 5), stale)).toBe(run);
    run = prepared("objective"); run = sampleNPC(run, spatial(0, 40)); run = sampleNPC(run, spatial(250, 40)); result = move(run, 40, 5.6, 250); run = sampleNPC(result.run, spatial(result.now + 250, 5.6));
    expect(markNPCObjectiveEndpoint(run, spatial(result.now + 250, 5.6)).breakCapture).toBeNull();
  });
  it("handles jitter and resets reversal, jumps, long pauses, and invalid geometry", () => {
    let run = prepared(); run = sampleNPC(run, spatial(0, 40)); run = sampleNPC(run, spatial(250, 40)); run = sampleNPC(run, spatial(1250, 39.5)); run = sampleNPC(run, spatial(1500, 39.4)); expect(run.phase).toBe("approach");
    run = sampleNPC(run, spatial(1750, 38.4)); run = sampleNPC(run, spatial(2000, 39)); expect(run.feedback).toContain("reversed");
    run = prepared(); run = sampleNPC(run, spatial(0, 40)); run = sampleNPC(run, spatial(250, 40)); run = sampleNPC(run, spatial(500, 30)); expect(run.feedback).toContain("quickly");
    run = prepared(); run = sampleNPC(run, spatial(0, 40)); run = sampleNPC(run, spatial(250, 40)); run = sampleNPC(run, spatial(1250, 39.6)); expect(run.feedback).toContain("too slow");
    run = prepared(); run = sampleNPC(run, spatial(0, 40)); run = sampleNPC(run, spatial(250, 40)); run = sampleNPC(run, spatial(1501, 40)); expect(run.feedback).toContain("paused");
    run = prepared(); run = sampleNPC(run, spatial(0, 40)); run = sampleNPC(run, spatial(250, 40)); run = sampleNPC(run, spatial(500, 39.5, { upright: false })); expect(run.phase).toBe("start");
  });
  it("preserves captured break on interruption and completed trials on restart", () => {
    let run = prepared("objective"); run = sampleNPC(run, spatial(0, 40)); run = sampleNPC(run, spatial(250, 40)); const result = move(run, 40, 5, 250); run = sampleNPC(result.run, spatial(result.now + 250, 5)); run = markNPCObjectiveEndpoint(run, spatial(result.now + 250, 5));
    expect(interruptNPCRun(run, "Tracking lost.").breakCapture).not.toBeNull(); const one = trial(prepared()).run; expect(restartNPCTrial(one).captures).toHaveLength(1);
  });
  it("clears an unrecorded case on revision or cancellation", () => {
    const one = trial(prepared()).run; expect(reviseNPCSetup(one, "Correction changed.").captures).toHaveLength(0); expect(cancelNPCRun(one).trialNumber).toBe(1);
  });
  it("grades six blank decimal entries, method, and eye and completes once", () => {
    let run = releaseNPCRule(completed("subjective")); [6, 8, 6, 8, 6, 8].forEach((value, index) => { run = enterNPCRecord(run, npcRecordFieldIds[index], String(value)); });
    run = enterNPCRecord(run, "detection-method", "objective-observation"); run = enterNPCRecord(run, "breaking-eye", "OS"); expect(submitNPCRecord(run).record).toBeNull();
    run = enterNPCRecord(run, "detection-method", "patient-report"); run = submitNPCRecord(run); expect(run.record?.submittedBreaksCm).toEqual([6, 6, 6]); expect(submitNPCRecord(run)).toBe(run);
  });
  it.each(["subjective", "objective"] as const)("guides each %s trial by its active phase, not the live start distance or earlier captures", caseId => {
    let run = prepared(caseId), now = 0;
    const finding = NPC_CASES[caseId];
    for (let number = 1; number <= 3; number++) {
      expect(npcGuidedStep(run, spatial(now, 35)).id).toBe("start");
      expect(npcGuidedStep(run, spatial(now, 40)).id).toBe("stability");
      run = sampleNPC(run, spatial(now, 40));
      run = sampleNPC(run, spatial(now += 250, 40));
      let result = move(run, 40, 35, now); run = result.run; now = result.now;
      expect(run.phase).toBe("approach");
      expect(npcGuidedStep(run, spatial(now, 35))).toMatchObject({ id: "approach", lines: expect.arrayContaining([`Trial ${number} of 3.`]) });
      result = move(run, 35, finding.breakCm, now); run = result.run; now = result.now;
      expect(npcGuidedStep(run, spatial(now, finding.breakCm)).id).toBe("break");
      run = sampleNPC(run, spatial(now += 250, finding.breakCm));
      if (caseId === "objective") run = markNPCObjectiveEndpoint(run, spatial(now, finding.breakCm));
      expect(npcGuidedStep(run, spatial(now, finding.breakCm)).id).toBe("recovery");
      run = sampleNPC(run, spatial(now += 10, finding.breakCm));
      result = move(run, finding.breakCm, finding.recoveryCm, now); run = result.run; now = result.now;
      expect(npcGuidedStep(run, spatial(now, finding.recoveryCm)).id).toBe("recovery");
      run = sampleNPC(run, spatial(now += 250, finding.recoveryCm));
      if (caseId === "objective") run = markNPCObjectiveEndpoint(run, spatial(now, finding.recoveryCm));
      expect(run.captures).toHaveLength(number);
      now += 500;
    }
    const releasedSample = spatial(now, finding.recoveryCm, { ruleDocked: false, ruleHeld: false });
    expect(npcGuidedStep(run, releasedSample).id).toBe("record");
    run = releaseNPCRule(run);
    expect(npcGuidedStep(run, releasedSample).id).toBe("record");
  });

  it("requires the start distance again when an interrupted approach genuinely restarts", () => {
    let run = prepared();
    run = sampleNPC(run, spatial(0, 40)); run = sampleNPC(run, spatial(250, 40));
    run = move(run, 40, 35, 250).run;
    run = interruptNPCRun(run, "Tracking lost.");
    expect(run.phase).toBe("start");
    expect(npcGuidedStep(run, spatial(3000, 35)).id).toBe("start");
  });

  it("derives one of ten guided steps and voice cannot create evidence", () => {
    const run = prepared("objective"), step = npcGuidedStep(run, spatial(0, 40)); expect(step.index).toBeGreaterThanOrEqual(0); expect(step.index).toBeLessThan(10);
    expect(npcVoiceReply(run, 5)).toContain("single"); expect(run.captures).toHaveLength(0);
    let subjective = prepared(); subjective = sampleNPC(subjective, spatial(0, 40)); subjective = sampleNPC(subjective, spatial(250, 40));
    expect(npcVoiceReply(subjective, 6)).toContain("double");
  });
});
