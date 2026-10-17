import { createElement } from "react";
import { act } from "@react-three/fiber";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clinic } from "./helpers/xrClinicHarness";
import { FourPrismPracticeController } from "../practice/xr/FourPrismPracticeController";
import { PracticeAttemptProvider, type PracticeAttemptKind } from "../practice/PracticeAttemptContext";
import type { BatchMirror } from "../practice/xr/PracticeLessonUI";
import { SENSORY_SOCKETS } from "../interaction/xrSensoryEquipment";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });

async function lesson(kind: PracticeAttemptKind = "guided", preview = false, scenarioSeed = 1) {
  let mirror: BatchMirror;
  const complete = vi.fn(), leave = vi.fn();
  const sim = await clinic({ renderAdapter: ({ active }) => createElement(PracticeAttemptProvider, {
    value: { settings: { kind, interaction: "vr", voice: "enabled" }, setSettings: vi.fn() },
    children: createElement(FourPrismPracticeController, { active, preview, scenarioSeed, onComplete: complete, onExit: leave, onMirror: next => { mirror = next; } }),
  }) });
  dispose = sim.dispose;
  const action = async (label: string) => {
    const item = mirror!.actions.find(candidate => candidate.label === label);
    if (!item) throw new Error(`Missing action ${label}`);
    await act(async () => item.run()); await sim.step(1 / 72, 12);
  };
  const fit = async () => {
    const socket = SENSORY_SOCKETS.find(candidate => candidate.id === "sensory-correction")!;
    await sim.pickup(0, "subjective"); await sim.at(0, socket.position); await sim.putDown(0); await sim.step(1 / 72, 12);
  };
  const orient = async (eye: "OD" | "OS") => { sim.rays[1].rotation.z = eye === "OD" ? Math.PI : 0; await sim.step(); };
  const selectBase = async (eye: "OD" | "OS") => sim.thumbstick(1, eye === "OD" ? -1 : 1, "horizontal");
  const prism = async (eye: "OD" | "OS") => { await sim.at(1, [eye === "OD" ? -.048 : .048, eye === "OD" ? 1.6 : 1.4, -.492]); };
  const prepare = async () => {
    await fit(); await action("LOOK AT THE ISOLATED LETTER");
    sim.viewerCamera.position.set(0, 1.5, .65); await sim.pickup(1, "four-prism"); await orient("OD");
  };
  const bilateral = async () => {
    await orient("OD"); await prism("OD"); await sim.step(1 / 72, 175);
    await sim.at(1, [.4, 1.4, -.492]); await sim.step(1 / 72, 3);
    await orient("OS"); await prism("OS"); await sim.step(1 / 72, 175);
  };
  const observations = async (scenario: "normal" | "suppression") => {
    await act(async () => {
      mirror!.lesson.choose("OD", scenario === "normal" ? "version-with-refixation" : "version-without-refixation");
      mirror!.lesson.choose("OS", scenario === "normal" ? "version-with-refixation" : "no-movement");
      mirror!.record();
    });
    await sim.step(1 / 72, 12);
  };
  return { ...sim, mirror: () => mirror!, complete, leave, action, fit, orient, selectBase, prism, prepare, bilateral, observations };
}

describe("mounted shared-clinic 4Δ base-out Practice", () => {
  it("shows the nine-step Guided coach in preview and removes it from independent Test", async () => {
    const guided = await lesson("guided", true);
    expect(guided.labels().join(" ")).toContain("STEP 1 OF 9");
    const model = guided.tool("four-prism");
    expect(model.userData.consultationToolId).toBe("four-prism");
    let dedicated = 0, barCells = 0;
    model.traverse(object => { if (object.userData.xrFourPrism) dedicated += 1; if (object.userData.xrPrismSlidingBar) barCells += 1; });
    expect(dedicated).toBe(1); expect(barCells).toBe(0); expect(guided.labels().join(" ")).toContain("4Δ");
    await guided.dispose(); dispose = undefined;
    const test = await lesson("test", true);
    expect(test.labels().join(" ")).not.toContain("STEP 1 OF 9");
    expect(test.labels().join(" ")).not.toContain("Point the base");
  });

  it("requires opposite physical base orientation, full withdrawal and records exactly once", async () => {
    const sim = await lesson(); await sim.prepare();
    await sim.orient("OS"); await sim.prism("OD"); await sim.step(1 / 72, 180); expect(sim.mirror().ready).toBe(false);
    await sim.orient("OD"); await sim.step(1 / 72, 175); expect(sim.mirror().status).toContain("withdraw");
    const firstPulseCount = sim.haptics[1].mock.calls.length; expect(firstPulseCount).toBeGreaterThanOrEqual(1);
    sim.rays[1].rotation.z = 0; sim.grips[1].position.set(.048, 1.4, -.492); await sim.step(1 / 72, 175); expect(sim.mirror().ready).toBe(false);
    await sim.at(1, [.4, 1.4, -.492]); await sim.step(1 / 72, 3); await sim.prism("OS"); await sim.step(1 / 72, 175);
    expect(sim.mirror().ready).toBe(true); expect(sim.haptics[1].mock.calls.length).toBe(firstPulseCount + 1);
    await sim.putDown(1); await sim.step(1 / 72, 12); expect(sim.mirror().ready).toBe(true);
    await sim.observations("normal"); expect(sim.mirror().fields.map(field => field.id)).toEqual(["interpretation"]);
    await act(async () => { sim.mirror().lesson.choose("interpretation", "suppression"); sim.mirror().record(); });
    expect(sim.complete).not.toHaveBeenCalled(); expect(sim.mirror().lesson.feedback).not.toContain("normal");
    await act(async () => { sim.mirror().lesson.choose("interpretation", "normal"); sim.mirror().record(); sim.mirror().record(); });
    expect(sim.complete).toHaveBeenCalledTimes(1); expect(sim.record).not.toHaveBeenCalled();
  });

  it("switches the fixed prism's base arrow with the held-controller thumbstick", async () => {
    const sim = await lesson(); await sim.fit(); await sim.action("LOOK AT THE ISOLATED LETTER");
    sim.viewerCamera.position.set(0, 1.5, .65); await sim.pickup(1, "four-prism");
    let pill: import("three").Object3D | undefined;
    sim.tool("four-prism").traverse(object => { if (object.userData.xrLabelPill) pill = object; });
    expect(pill?.userData).toMatchObject({ width: .10, height: .026 });
    expect(sim.labels().some(label => label.includes("BASE →"))).toBe(true);
    const haptics = sim.haptics[1].mock.calls.length;
    await sim.selectBase("OD"); expect(sim.labels().some(label => label.includes("← BASE"))).toBe(true);
    expect(sim.haptics[1]).toHaveBeenCalledTimes(haptics + 1);
    sim.rays[1].rotation.z = 0; await sim.step();
    await sim.at(1, [-.048, 1.4, -.492]); await sim.step(1 / 72, 175); expect(sim.mirror().status).toContain("withdraw");
    await sim.at(1, [.4, 1.4, -.492]); await sim.step(1 / 72, 3);
    await sim.selectBase("OS"); expect(sim.labels().some(label => label.includes("BASE →"))).toBe(true);
    await sim.prism("OS"); await sim.step(1 / 72, 175); expect(sim.mirror().ready).toBe(true);
  });

  it("preserves completed OD through tracking loss but requires fresh fixation", async () => {
    const sim = await lesson(); await sim.prepare(); await sim.prism("OD"); await sim.step(1 / 72, 175);
    expect(sim.mirror().status).toContain("withdraw");
    sim.tracked[1] = false; await sim.step(); sim.tracked[1] = true; await sim.step(1 / 72, 12);
    expect(sim.mirror().status).toContain("isolated letter");
    await sim.action("LOOK AT THE ISOLATED LETTER");
    await sim.at(1, [.4, 1.4, -.492]); await sim.step(1 / 72, 3); await sim.orient("OS"); await sim.prism("OS"); await sim.step(1 / 72, 175);
    expect(sim.mirror().ready).toBe(true);
  });

  it("conceals the seeded suppression case, validates both observations, resets fitting changes and ignores late exit", async () => {
    const sim = await lesson("test", false, 1); await sim.prepare(); await sim.bilateral();
    expect(sim.mirror().status).not.toMatch(/suppression|without refixation|no movement/i);
    await act(async () => { sim.mirror().lesson.choose("OD", "version-with-refixation"); sim.mirror().lesson.choose("OS", "version-with-refixation"); sim.mirror().record(); });
    expect(sim.mirror().lesson.feedback).not.toMatch(/without refixation|no movement|suppression/i);
    await sim.observations("suppression"); expect(sim.mirror().reportLines).toEqual(["OD · version without refixation", "OS · no movement"]);
    await sim.pickup(0, "subjective"); await sim.step(1 / 72, 12); expect(sim.mirror().ready).toBe(false); expect(sim.mirror().status).toContain("restarted");
    const eyes = sim.eyes("consultationGaze");
    await sim.exit(); await sim.event(1, "selectstart"); await act(async () => sim.mirror().record());
    expect(sim.complete).not.toHaveBeenCalled(); expect(eyes.map(eye => eye.position.x)).toEqual([0, 0]);
  });
});
