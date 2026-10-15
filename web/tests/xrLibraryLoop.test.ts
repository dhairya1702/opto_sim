import { createElement } from "react";
import { act } from "@react-three/fiber";
import { Quaternion, Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clinic } from "./helpers/xrClinicHarness";
import { PhoriaPracticeController } from "../practice/xr/PhoriaPracticeController";
import { VergencePracticeController } from "../practice/xr/VergencePracticeController";
import { NPCPracticeController } from "../practice/xr/NPCPracticeController";
import { FusionalVergencePracticeController } from "../practice/xr/FusionalVergencePracticeController";
import { VerticalFusionalVergencePracticeController } from "../practice/xr/VerticalFusionalVergencePracticeController";
import { AccommodationPracticeController } from "../practice/xr/AccommodationPracticeController";
import type { BatchMirror } from "../practice/xr/PracticeLessonUI";
import { librarySockets, type LibraryKind } from "../interaction/xrLibraryEquipment";
import { consultationToolDefinition, type ConsultationToolId } from "../interaction/xrConsultationTools";
import { maddoxTrials } from "../interaction/maddoxPractice";
import { MADDOX_PRISM_CELLS, MADDOX_PRISM_CELL_Y } from "../interaction/maddoxProcedure";
import { vergenceFindings } from "../interaction/vergencePractice";
import { PracticeAttemptProvider, type PracticeAttemptKind } from "../practice/PracticeAttemptContext";
let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function lesson(kind: LibraryKind, preview = false, attemptKind?: PracticeAttemptKind) {
  let mirror: BatchMirror; let now = 0; vi.spyOn(performance, "now").mockImplementation(() => now);
  const complete = vi.fn(), leave = vi.fn();
  const sim = await clinic({ renderAdapter: ({ active }) => {
    const common = { active, preview, onComplete: complete, onExit: leave, onMirror: (next: BatchMirror) => { mirror = next; } };
    const controller = kind === "maddox" || kind === "thorington" ? createElement(PhoriaPracticeController, { ...common, kind }) : kind === "npc" ? createElement(NPCPracticeController, common) : kind === "horizontal-distance" ? createElement(FusionalVergencePracticeController, common) : kind === "vertical-distance" ? createElement(VerticalFusionalVergencePracticeController, common) : kind === "push-up" || kind === "minus-lens" || kind === "relative" || kind === "accommodative-facility" ? createElement(AccommodationPracticeController, { ...common, kind }) : createElement(VergencePracticeController, { ...common, kind });
    return attemptKind ? createElement(PracticeAttemptProvider, { value: { settings: { kind: attemptKind, interaction: "vr", voice: "enabled" }, setSettings: vi.fn() }, children: controller }) : controller;
  } }); dispose = sim.dispose;
  const action = async (label: string) => { const item = mirror!.actions.find(a => a.label === label); if (!item) throw new Error(`Missing ${label}: ${mirror!.actions.map(a => a.label).join(", ")}`); await act(async () => item.run()); await sim.step(1 / 72, 12); };
  const fit = async (id: ConsultationToolId, socketId?: string) => { const socket = librarySockets(kind).find(s => s.tool === id && (!socketId || s.id === socketId))!; await sim.pickup(0, id); sim.grips[0].quaternion.copy(new Quaternion(...socket.rotation).multiply(new Quaternion(...consultationToolDefinition(id).gripRotation).invert())); await sim.at(0, socket.position); await sim.putDown(0); await sim.step(1 / 72, 12); sim.grips[0].quaternion.identity(); };
  const enter = async (values: Record<string, string>) => { await act(async () => { for (const [id, value] of Object.entries(values)) mirror!.lesson.choose(id, value); }); await act(async () => mirror!.record()); await sim.step(1 / 72, 12); };
  const tick = async (ms: number) => { now += ms; await sim.step(1 / 72, 12); };
  const settle = () => sim.step(1 / 72, 90);
  const targetSwitch = () => { let control: typeof sim.state.scene | undefined; sim.tool("worth").traverse(object => { if (object.userData.xrInstrumentControl === "worth") control = object as typeof sim.state.scene; }); if (!control) throw new Error("Missing point-target switch"); return control; };
  const physicalTargetSwitch = async () => { const control = targetSwitch(), point = control.getWorldPosition(new Vector3()); await sim.at(0, [point.x, point.y, point.z + .025]); await sim.click(0, control); };
  const prismCell = async (power: number, base: "BI" | "BO" | "BU" | "BD") => { const index = MADDOX_PRISM_CELLS.indexOf(power as typeof MADDOX_PRISM_CELLS[number]); const angle = ({ BI: 0, BU: Math.PI / 2, BO: Math.PI, BD: -Math.PI / 2 } as const)[base], y = MADDOX_PRISM_CELL_Y[index]; sim.rays[1].rotation.set(0, 0, angle); sim.grips[1].rotation.set(0, 0, angle); await sim.at(1, [-.048 + Math.sin(angle) * y, 1.5 - Math.cos(angle) * y, -.481]); await tick(1); await tick(260); };
  const holdNearPenlight = async () => { await sim.pickup(0, "pupils"); sim.rays[0].rotation.set(0, 0, 0); sim.grips[0].rotation.set(0, 0, 0); await sim.at(0, [0, 1.5, .026]); await sim.event(0, "selectstart"); await sim.step(1 / 72, 12); };
  const prepare = async (cover?: "OD" | "OS") => { await fit("subjective"); if (cover) await fit("cover", `sensory-occlude-${cover}`); if (["horizontal-near", "facility", "minus-lens", "relative", "accommodative-facility"].includes(kind)) await fit("near"); await action("ESTABLISH FIXATION"); };
  const noTest = () => { expect(sim.record).not.toHaveBeenCalled(); expect(sim.encounter().results).toHaveLength(0); };
  return { ...sim, mirror: () => mirror!, complete, leave, action, fit, enter, tick, settle, prepare, noTest, physicalTargetSwitch, prismCell, holdNearPenlight };
}
describe("mounted remaining shared-clinic XR modules", () => {
  it("shows the ten-step Maddox coach and fitting highlights only in Guided preview", async () => {
    const guided = await lesson("maddox", true, "guided");
    expect(guided.labels()).toContain("GUIDED · STEP 1 OF 10");
    let highlights = 0; guided.state.scene.traverse(object => { if (object.userData.xrInstructionalHighlight) highlights++; });
    expect(highlights).toBeGreaterThan(0);
  });
  it("keeps independent Maddox Test preview free of coach and instructional highlights", async () => {
    const test = await lesson("maddox", true, "test");
    expect(test.labels().join(" ")).not.toContain("GUIDED · STEP");
    let highlights = 0; test.state.scene.traverse(object => { if (object.userData.xrInstructionalHighlight) highlights++; });
    expect(highlights).toBe(0);
  });
  it("shows Thorington coaching and fitting guides only in Guided preview", async () => {
    const guided = await lesson("thorington", true, "guided");
    expect(guided.labels()).toContain("GUIDED · STEP 1 OF 10");
    let guidedHighlights = 0; guided.state.scene.traverse(object => { if (object.userData.xrInstructionalHighlight) guidedHighlights++; });
    expect(guidedHighlights).toBeGreaterThan(0);
    await dispose?.(); dispose = undefined;
    const test = await lesson("thorington", true, "test");
    expect(test.labels().join(" ")).not.toContain("GUIDED · STEP");
    let testHighlights = 0; test.state.scene.traverse(object => { if (object.userData.xrInstructionalHighlight) testHighlights++; });
    expect(testHighlights).toBe(0);
  });
  it("completes all four Maddox trials with physical distance/near target, starting prism and independent recording", async () => {
    const sim = await lesson("maddox"); await sim.fit("subjective"); await sim.fit("maddox", "sensory-maddox-horizontal"); await sim.fit("worth", "sensory-worth-distance"); await sim.physicalTargetSwitch(); await sim.pickup(1, "prism");
    for (let i = 0; i < 4; i++) {
      const trial = maddoxTrials[i];
      if (i > 0) await sim.fit("maddox", trial.axis === "horizontal" ? "sensory-maddox-horizontal" : "sensory-maddox-vertical");
      if (trial.site === "near") await sim.holdNearPenlight();
      await sim.action("ASK STREAK / LIGHT RELATION"); expect(sim.mirror().actions[0].active, sim.mirror().status).toBe(true); await sim.prismCell(20, trial.base); expect(sim.mirror().actions[0].active, sim.mirror().status).toBe(true); await sim.prismCell(trial.neutral, trial.base);
      expect(sim.mirror().voiceReport, sim.mirror().status).toContain("passes through");
      await sim.event(1, "selectstart"); await sim.event(1, "selectend"); await sim.putDown(1);
      if (trial.site === "near") { await sim.event(0, "selectend"); await sim.putDown(0); }
      expect(sim.mirror().ready, sim.mirror().status).toBe(true); expect(sim.mirror().lesson.entries).toEqual({});
      await sim.enter({ power: "", base: "" }); expect(sim.complete).not.toHaveBeenCalled(); await sim.enter({ power: String(trial.neutral), base: trial.base });
      if (i < 3) await sim.pickup(1, "prism");
    }
    expect(sim.complete).toHaveBeenCalledTimes(1); await act(async () => sim.mirror().record()); expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  });
  it("captures Thorington through the physical centre hole and records both axes after release", async () => {
    const sim = await lesson("thorington"); await sim.fit("subjective"); await sim.fit("maddox", "sensory-maddox-horizontal"); await sim.fit("thorington");
    for (let i = 0; i < 2; i++) {
      if (i) await sim.fit("maddox", "sensory-maddox-vertical");
      await sim.pickup(1, "pupils"); await sim.at(1, [0, 1.425, .137]); await sim.event(1, "selectstart");
      await sim.action("ASK NUMBER AND SIDE"); await sim.tick(1); await sim.tick(260);
      expect(sim.mirror().voiceReport, sim.mirror().status).toContain(i ? "4, above" : "6, right");
      await sim.event(1, "selectend"); await sim.putDown(1); await sim.step(1 / 72, 12); expect(sim.mirror().ready, sim.mirror().status).toBe(true);
      await sim.enter({ magnitude: i ? "4" : "6", side: i ? "above" : "right", interpretation: i ? "left-hyperphoria" : "esophoria" });
    }
    expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  });
  it("accepts a physically held Thorington card and preserves its immutable capture after support release", async () => {
    const sim = await lesson("thorington"); await sim.fit("subjective"); await sim.fit("maddox", "sensory-maddox-horizontal"); await sim.fit("thorington");
    const socket = librarySockets("thorington").find(value => value.id === "library-thorington-near")!;
    await sim.pickup(0, "thorington"); await sim.at(0, socket.position);
    await sim.pickup(1, "pupils"); await sim.at(1, [0, 1.425, .137]); await sim.event(1, "selectstart");
    await sim.action("ASK NUMBER AND SIDE"); await sim.tick(1); await sim.tick(260); expect(sim.mirror().voiceReport).toContain("6, right");
    await sim.putDown(0); await sim.event(1, "selectend"); await sim.putDown(1); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready, sim.mirror().status).toBe(true); sim.noTest();
  });
  it("rejects invalid Thorington aperture geometry and restarts reporting after tracking recovery", async () => {
    const sim = await lesson("thorington"); await sim.fit("subjective"); await sim.fit("maddox", "sensory-maddox-horizontal"); await sim.fit("thorington");
    await sim.pickup(1, "pupils"); await sim.at(1, [.05, 1.425, .137]); await sim.event(1, "selectstart");
    await sim.action("ASK NUMBER AND SIDE"); expect(sim.mirror().voiceReport).toBeUndefined(); expect(sim.mirror().status).toContain("aperture");
    await sim.at(1, [0, 1.425, .137]); await sim.action("ASK NUMBER AND SIDE"); await sim.tick(100);
    sim.tracked[1] = false; await sim.step(); sim.tracked[1] = true; await sim.step(1 / 72, 12);
    expect(sim.mirror().actions[0].active).toBe(false); expect(sim.mirror().voiceReport).toBeUndefined();
    await sim.event(1, "selectend"); await sim.event(1, "selectstart"); await sim.step(1 / 72, 12);
    await sim.action("ASK NUMBER AND SIDE"); await sim.tick(1); await sim.tick(260); expect(sim.mirror().voiceReport).toContain("6, right"); sim.noTest();
  });
  it("runs the other authored Thorington case through 8Δ without awarding Practice twice", async () => {
    const sim = await lesson("thorington");
    const completeCase = async (values: readonly [string, string, string][]) => {
      await sim.fit("subjective"); await sim.fit("maddox", "sensory-maddox-horizontal"); await sim.fit("thorington");
      for (let i = 0; i < 2; i++) {
        if (i) await sim.fit("maddox", "sensory-maddox-vertical");
        await sim.pickup(1, "pupils"); await sim.at(1, [0, 1.425, .137]); await sim.event(1, "selectstart"); await sim.action("ASK NUMBER AND SIDE"); await sim.tick(1); await sim.tick(260);
        await sim.event(1, "selectend"); await sim.putDown(1); await sim.enter({ magnitude: values[i][0], side: values[i][1], interpretation: values[i][2] });
      }
    };
    await completeCase([["6", "right", "esophoria"], ["4", "above", "left-hyperphoria"]]);
    expect(sim.complete).toHaveBeenCalledTimes(1); await act(async () => sim.mirror().next?.()); await sim.step(1 / 72, 12);
    await completeCase([["8", "left", "exophoria"], ["3", "below", "right-hyperphoria"]]);
    expect(sim.mirror().reportLines?.some(line => line.includes("signed -8"))).toBe(true);
    expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  });
  it("requires Maddox to restart the 20Δ trial after a between-frame light or visibility interruption", async () => {
    const sim = await lesson("maddox"); await sim.fit("subjective"); await sim.fit("maddox", "sensory-maddox-horizontal"); await sim.fit("worth", "sensory-worth-distance"); await sim.physicalTargetSwitch(); await sim.pickup(1, "prism");
    await sim.action("ASK STREAK / LIGHT RELATION"); await sim.prismCell(20, "BI");
    await sim.physicalTargetSwitch(); await sim.physicalTargetSwitch(); await sim.step(1 / 72, 12);
    expect(sim.mirror().actions[0].active).toBe(false);
    await sim.action("ASK STREAK / LIGHT RELATION"); await sim.prismCell(20, "BI");
    sim.session.visibilityState = "hidden";
    await act(async () => sim.session.dispatchEvent(new Event("visibilitychange")));
    sim.session.visibilityState = "visible"; await sim.step(1 / 72, 12);
    expect(sim.mirror().actions[0].active).toBe(false);
    await sim.event(1, "selectstart"); await sim.event(1, "selectend"); expect(sim.mirror().ready).toBe(false); expect(sim.complete).not.toHaveBeenCalled();
    await sim.action("ASK STREAK / LIGHT RELATION"); await sim.prismCell(20, "BI");
    let pad: typeof sim.state.scene | undefined;
    sim.state.scene.traverse(object => { if (object.userData.xrTeleport?.[2] === .25) pad = object as typeof sim.state.scene; });
    expect(pad).toBeDefined();
    sim.rays[0].position.copy(pad!.getWorldPosition(new Vector3())).y += .6;
    sim.rays[0].rotation.set(-Math.PI / 2, 0, 0);
    const offsets = sim.referenceOffsets.length;
    await sim.event(0, "selectstart"); await sim.event(0, "selectend");
    expect(sim.referenceOffsets).toHaveLength(offsets + 1);
    await sim.step(1 / 72, 12);
    expect(sim.mirror().actions[0].active).toBe(false);
  });
  it("stocks the dedicated rotary prism and keeps its ten-step coach out of independent Test", async () => {
    const guided = await lesson("horizontal-distance", true, "guided");
    expect(guided.tool("vergence-prism")).toBeDefined();
    expect(guided.labels().join(" ")).toContain("GUIDED STEP 1 / 10");
    expect(guided.labels().join(" ")).toContain("0–30 ROTARY");
    await dispose?.(); dispose = undefined;
    const test = await lesson("horizontal-distance", true, "test");
    expect(test.labels().join(" ")).not.toContain("GUIDED STEP");
    expect(test.mirror().status).not.toMatch(/7Δ|19Δ|9Δ|12Δ/);
  });
  it("uses the free-hand trigger beside the rotary dial and pulses haptics at integer demand", async () => {
    const sim = await lesson("horizontal-distance", false, "guided");
    await sim.fit("subjective"); await sim.action("ESTABLISH MIRRORED DISTANCE TARGET"); await sim.action("GIVE BLUR / DOUBLE / RECOVERY INSTRUCTION");
    await sim.pickup(1, "vergence-prism"); await sim.at(1, [-.048, 1.4, -.481]); await sim.tick(260);
    expect(sim.mirror().fields).toEqual([]);
    const prism = sim.tool("vergence-prism");
    const start = prism.localToWorld(new Vector3(.065, .105, .006));
    await sim.at(0, start.toArray() as [number, number, number]); await sim.event(0, "selectstart"); await sim.step();
    const turn = prism.localToWorld(new Vector3(.073, .104, .006));
    await sim.at(0, turn.toArray() as [number, number, number]); await sim.step(1 / 72, 12);
    expect(sim.mirror().status).toMatch(/scale (0\.[1-9]|1\.0)Δ/);
    expect(sim.haptics[0]).toHaveBeenCalled();
    await sim.event(0, "selectend"); sim.noTest();
  });
  it("resets unfinished rotary motion on tracking, teleportation, transfer, and correction revision without evidence", async () => {
    const sim = await lesson("horizontal-distance", false, "guided");
    await sim.fit("subjective"); await sim.action("ESTABLISH MIRRORED DISTANCE TARGET"); await sim.action("GIVE BLUR / DOUBLE / RECOVERY INSTRUCTION");
    await sim.pickup(1, "vergence-prism"); await sim.at(1, [-.048, 1.4, -.481]); await sim.tick(260);
    const plus = sim.mirror().actions.find(action => action.label === "DIAL +0.1Δ · ACCESSIBILITY")!;
    await act(async () => { for (let i = 0; i < 5; i++) plus.run(); }); await sim.tick(500);
    sim.tracked[1] = false; await sim.step(); sim.tracked[1] = true; await sim.step(1 / 72, 12);
    expect(sim.mirror().status).toContain("zero"); expect(sim.mirror().reportLines).toEqual([]);

    let pad: typeof sim.state.scene | undefined;
    sim.state.scene.traverse(object => { if (object.userData.xrTeleport?.[2] === .25) pad = object as typeof sim.state.scene; });
    sim.rays[0].position.copy(pad!.getWorldPosition(new Vector3())).y += .6; sim.rays[0].rotation.set(-Math.PI / 2, 0, 0);
    await sim.event(0, "selectstart"); await sim.event(0, "selectend"); await sim.step(1 / 72, 12);
    expect(sim.mirror().reportLines).toEqual([]);

    const prismPosition = sim.tool("vergence-prism").getWorldPosition(new Vector3());
    await sim.at(0, prismPosition.toArray() as [number, number, number]); await sim.grip(0);
    expect(sim.mirror().reportLines).toEqual([]);
    await sim.pickup(1, "subjective"); await sim.step(1 / 72, 12);
    expect(sim.mirror().status).toContain("distance correction");
    await sim.putDown(1); await sim.step(1 / 72, 12);
    expect(sim.mirror().actions.find(action => action.label === "FIT DISTANCE CORRECTION")?.active).toBe(true); sim.noTest();
  });
  it("completes subjective BI then BO automatically, survives panel use, releases, and records six blank fields once", async () => {
    const sim = await lesson("horizontal-distance", false, "guided");
    await sim.fit("subjective"); await sim.action("ESTABLISH MIRRORED DISTANCE TARGET"); await sim.action("GIVE BLUR / DOUBLE / RECOVERY INSTRUCTION");
    await sim.pickup(1, "vergence-prism"); await sim.at(1, [-.048, 1.4, -.481]); await sim.tick(260);
    let current = 0;
    const moveTo = async (target: number) => {
      while (Math.abs(current - target) > .01) {
        const direction = current < target ? 1 : -1;
        const dialAction = sim.mirror().actions.find(action => action.label === `DIAL ${direction > 0 ? "+" : "−"}0.1Δ · ACCESSIBILITY`)!;
        await act(async () => { for (let i = 0; i < 5; i++) dialAction.run(); });
        current = Math.round((current + direction * .5) * 10) / 10;
        await sim.tick(500);
      }
      await sim.tick(260);
    };
    await moveTo(7); expect(sim.mirror().voiceReport).toContain("double");
    await moveTo(4); expect(sim.mirror().reportLines).toEqual(["BI: X / 7 / 4Δ"]);
    await moveTo(0); await sim.tick(260);
    sim.rays[1].rotation.z = Math.PI; sim.grips[1].rotation.z = Math.PI;
    await sim.at(1, [-.048, 1.6, -.481]); await sim.tick(260);
    await moveTo(9); expect(sim.mirror().voiceReport).toContain("blurred");
    await moveTo(19); expect(sim.mirror().voiceReport).toContain("double");
    await moveTo(12); expect(sim.mirror().reportLines).toHaveLength(2);
    await sim.panel(0); await sim.panel(0); expect(sim.mirror().reportLines).toHaveLength(2);
    await sim.putDown(1); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready, sim.mirror().status).toBe(true);
    expect(sim.mirror().fields).toHaveLength(6);
    expect(sim.mirror().lesson.entries).toEqual({});
    await sim.enter({ "bi-blur": "X", "bi-break": "7", "bi-recovery": "4", "bo-blur": "9", "bo-break": "19", "bo-recovery": "12" });
    expect(sim.complete).toHaveBeenCalledTimes(1); await act(async () => sim.mirror().record()); expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  }, 15000);
  it.each(["horizontal-near"] as const)("records both bases of %s only after ordered physical endpoints", async kind => {
    const sim = await lesson(kind); await sim.prepare(); await sim.pickup(1, "prism"); await sim.at(1, [-.048, 1.357, -.481]);
    for (const [base, finding] of Object.entries(vergenceFindings[kind])) {
      await sim.action(`BASE ${base}`); let power = 0;
      for (const endpoint of [finding.blur, finding.break, finding.recovery]) { if (endpoint === null) continue; while (power !== endpoint) { await sim.action(`PRISM ${power < endpoint ? "+" : "−"}1Δ`); power += power < endpoint ? 1 : -1; } await sim.action("MARK PATIENT ENDPOINT"); }
      expect(sim.mirror().ready).toBe(true); const values = Object.fromEntries(Object.entries(finding).filter(([, v]) => v !== null).map(([k, v]) => [k, String(v)])); await sim.enter(values);
    }
    expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  });
  it("stocks the rotary prism for vertical distance and conceals coaching in Test", async () => {
    const guided = await lesson("vertical-distance", true, "guided");
    expect(guided.tool("vergence-prism")).toBeDefined(); expect(() => guided.tool("prism")).toThrow();
    expect(guided.labels().join(" ")).toContain("GUIDED STEP 1 / 10");
    expect(guided.labels().join(" ")).toContain("BI · BU · BO · BD");
    await dispose?.(); dispose = undefined;
    const test = await lesson("vertical-distance", true, "test");
    expect(test.labels().join(" ")).not.toContain("GUIDED STEP"); expect(test.mirror().status).not.toMatch(/4Δ|2Δ/);
    let highlights = 0; test.state.scene.traverse(object => { if (object.userData.xrInstructionalHighlight) highlights++; });
    expect(highlights).toBe(0);
  });
  it("uses vertical physical roll plus the free-hand rotary dial and integer haptics", async () => {
    const sim = await lesson("vertical-distance", false, "guided");
    await sim.fit("subjective"); await sim.action("ESTABLISH PREPARED MIRRORED TARGET"); await sim.action("GIVE DOUBLE / RECOVERY INSTRUCTION");
    await sim.pickup(1, "vergence-prism"); await sim.at(1, [.052, 1.5, -.481]); await sim.tick(260);
    expect(sim.mirror().status).toContain("physically roll BU/BD");
    sim.rays[1].rotation.z = Math.PI / 2; sim.grips[1].rotation.z = Math.PI / 2; await sim.at(1, [.052, 1.5, -.481]); await sim.tick(260);
    const prism = sim.tool("vergence-prism"), start = prism.localToWorld(new Vector3(.065, .105, .006));
    await sim.at(0, start.toArray() as [number, number, number]); await sim.event(0, "selectstart"); await sim.step();
    const turn = prism.localToWorld(new Vector3(.073, .104, .006));
    await sim.at(0, turn.toArray() as [number, number, number]); await sim.step(1 / 72, 12);
    expect(sim.mirror().status).toMatch(/scale (0\.[1-9]|1\.0)Δ/); expect(sim.haptics[0]).toHaveBeenCalled();
    await sim.event(0, "selectend"); sim.noTest();
  });
  it("completes automatic BU then BD runs, survives panel use, releases, and records four blank fields once", async () => {
    const sim = await lesson("vertical-distance", false, "guided");
    await sim.fit("subjective"); await sim.action("ESTABLISH PREPARED MIRRORED TARGET"); await sim.action("GIVE DOUBLE / RECOVERY INSTRUCTION");
    sim.rays[1].rotation.z = Math.PI / 2; sim.grips[1].rotation.z = Math.PI / 2;
    await sim.pickup(1, "vergence-prism"); await sim.at(1, [.052, 1.5, -.481]); await sim.tick(260);
    let current = 0;
    const moveTo = async (target: number) => {
      while (Math.abs(current - target) > .01) {
        const direction = current < target ? 1 : -1;
        const dialAction = sim.mirror().actions.find(action => action.label === `DIAL ${direction > 0 ? "+" : "−"}0.1Δ · ACCESSIBILITY`)!;
        await act(async () => { for (let i = 0; i < 5; i++) dialAction.run(); });
        current = Math.round((current + direction * .5) * 10) / 10; await sim.tick(500);
      }
      await sim.tick(260);
    };
    await moveTo(4); expect(sim.mirror().voiceReport).toContain("double");
    await moveTo(2); expect(sim.mirror().reportLines).toEqual(["BU: 4 / 2Δ"]);
    await moveTo(0); await sim.tick(260);
    sim.rays[1].rotation.z = -Math.PI / 2; sim.grips[1].rotation.z = -Math.PI / 2;
    await sim.at(1, [-.148, 1.5, -.481]); await sim.tick(260);
    await moveTo(4); await moveTo(2); expect(sim.mirror().reportLines).toEqual(["BU: 4 / 2Δ", "BD: 4 / 2Δ"]);
    await sim.panel(0); await sim.panel(0); expect(sim.mirror().reportLines).toHaveLength(2);
    expect(sim.mirror().fields).toEqual([]); await sim.putDown(1); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready, sim.mirror().status).toBe(true); expect(sim.mirror().fields).toHaveLength(4); expect(sim.mirror().lesson.entries).toEqual({});
    await sim.enter({ "bu-break": "4", "bu-recovery": "2", "bd-break": "4", "bd-recovery": "2" });
    expect(sim.complete).toHaveBeenCalledTimes(1); await act(async () => sim.mirror().record()); expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  });
  it("resets unfinished vertical motion on tracking, early release, teleportation, transfer, and correction revision", async () => {
    const preview = await lesson("vertical-distance", true, "guided"); expect(preview.mirror().reportLines).toEqual([]); preview.noTest();
    await dispose?.(); dispose = undefined;
    const sim = await lesson("vertical-distance", false, "guided");
    await sim.fit("subjective"); await sim.action("ESTABLISH PREPARED MIRRORED TARGET"); await sim.action("GIVE DOUBLE / RECOVERY INSTRUCTION");
    sim.rays[1].rotation.z = Math.PI / 2; sim.grips[1].rotation.z = Math.PI / 2;
    await sim.pickup(1, "vergence-prism"); await sim.at(1, [.052, 1.5, -.481]); await sim.tick(260);
    const plus = sim.mirror().actions.find(action => action.label === "DIAL +0.1Δ · ACCESSIBILITY")!;
    await act(async () => { for (let i = 0; i < 5; i++) plus.run(); }); await sim.tick(500);
    sim.tracked[1] = false; await sim.step(); sim.tracked[1] = true; await sim.step(1 / 72, 12);
    expect(sim.mirror().status).toContain("zero"); expect(sim.mirror().reportLines).toEqual([]);
    await sim.putDown(1); await sim.step(1 / 72, 12); expect(sim.mirror().fields).toEqual([]);
    sim.rays[1].rotation.z = Math.PI / 2; sim.grips[1].rotation.z = Math.PI / 2;
    await sim.pickup(1, "vergence-prism"); await sim.at(1, [.052, 1.5, -.481]); await sim.tick(260);
    let pad: typeof sim.state.scene | undefined;
    sim.state.scene.traverse(object => { if (object.userData.xrTeleport?.[2] === .25) pad = object as typeof sim.state.scene; });
    sim.rays[0].position.copy(pad!.getWorldPosition(new Vector3())).y += .6; sim.rays[0].rotation.set(-Math.PI / 2, 0, 0);
    await sim.event(0, "selectstart"); await sim.event(0, "selectend"); await sim.step(1 / 72, 12); expect(sim.mirror().reportLines).toEqual([]);
    const prismPosition = sim.tool("vergence-prism").getWorldPosition(new Vector3());
    await sim.at(0, prismPosition.toArray() as [number, number, number]); await sim.grip(0); expect(sim.mirror().reportLines).toEqual([]);
    await sim.pickup(1, "subjective"); await sim.step(1 / 72, 12); expect(sim.mirror().status).toContain("distance correction");
    await sim.putDown(1); await sim.step(1 / 72, 12); await sim.action("FIT DISTANCE CORRECTION");
    expect(sim.mirror().actions.find(action => action.label === "FIT DISTANCE CORRECTION")?.active).toBe(true); sim.noTest();
  });
  it("stocks, docks and exposes the dedicated NPC rule with guided carriage controls", async () => {
    const sim = await lesson("npc", false, "guided"); await sim.fit("subjective");
    expect(sim.tool("npc-rule")).toBeDefined(); await sim.fit("npc-rule", "library-npc-spectacle");
    expect(sim.mirror().actions.map(action => action.label)).toContain("GIVE CLEAR / SINGLE INSTRUCTION");
    await sim.action("GIVE CLEAR / SINGLE INSTRUCTION"); expect(sim.mirror().status).toContain("40.0 cm");
    expect(sim.labels().join(" ")).toContain("GUIDED STEP"); sim.noTest();
  });
  it("keeps NPC Test free of coaching and fitting highlights", async () => {
    const sim = await lesson("npc", true, "test");
    expect(sim.labels().join(" ")).not.toContain("GUIDED STEP");
    let highlights = 0; sim.state.scene.traverse(object => { if (object.userData.xrInstructionalHighlight) highlights++; });
    expect(highlights).toBe(0); expect(sim.mirror().status).not.toContain("objective"); sim.noTest();
  });
  it("completes three subjective NPC trials by moving the docked carriage and records after physical release", async () => {
    const sim = await lesson("npc", false, "guided"); await sim.fit("subjective"); await sim.fit("npc-rule", "library-npc-spectacle"); await sim.action("GIVE CLEAR / SINGLE INSTRUCTION");
    const carriage = async (cm: number) => { await sim.at(1, [0, 1.545, -.511 + cm / 100]); await sim.tick(250); };
    await sim.at(1, [0, 1.545, -.111]); await sim.event(1, "selectstart"); await sim.tick(260);
    for (let trial = 0; trial < 3; trial++) {
      for (let cm = 39.5; cm >= 6; cm -= .5) await carriage(cm);
      await sim.tick(260);
      for (let cm = 6.5; cm <= 8; cm += .5) await carriage(cm);
      await sim.tick(260);
      if (trial < 2) { await sim.at(1, [0, 1.545, -.111]); await sim.tick(260); }
    }
    expect(sim.mirror().reportLines, sim.mirror().status).toHaveLength(3); await sim.event(1, "selectend");
    await sim.pickup(0, "npc-rule"); const home = consultationToolDefinition("npc-rule").home; await sim.at(0, home); await sim.putDown(0); await sim.step(1 / 72, 12);
    if (!sim.mirror().ready) await sim.action("REMOVE / RELEASE RULE");
    expect(sim.mirror().ready, sim.mirror().status).toBe(true);
    await sim.enter({ "trial-1-break": "6", "trial-1-recovery": "8", "trial-2-break": "6", "trial-2-recovery": "8", "trial-3-break": "6", "trial-3-recovery": "8", "detection-method": "patient-report", "breaking-eye": "OS" });
    expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  });
  it("completes the concealed objective-first NPC Test with explicit OS endpoint marks", async () => {
    const sim = await lesson("npc", false, "test"); await sim.fit("subjective"); await sim.fit("npc-rule", "library-npc-spectacle"); await sim.action("GIVE CLEAR / SINGLE INSTRUCTION");
    const carriage = async (cm: number) => { await sim.at(1, [0, 1.545, -.511 + cm / 100]); await sim.tick(250); };
    await sim.at(1, [0, 1.545, -.111]); await sim.event(1, "selectstart"); await sim.tick(260);
    for (let trial = 0; trial < 3; trial++) {
      for (let cm = 39.5; cm >= 5; cm -= .5) await carriage(cm);
      await sim.tick(260); expect(sim.mirror().voiceReport).toContain("single"); await sim.action("MARK OBSERVED ENDPOINT");
      for (let cm = 5.5; cm <= 9; cm += .5) await carriage(cm);
      await sim.tick(260); await sim.action("MARK OBSERVED ENDPOINT");
      if (trial < 2) { await sim.at(1, [0, 1.545, -.111]); await sim.tick(260); }
    }
    expect(sim.mirror().reportLines, sim.mirror().status).toHaveLength(3); expect(sim.mirror().status).not.toContain("objective");
    await sim.event(1, "selectend"); await sim.action("REMOVE / RELEASE RULE");
    await sim.enter({ "trial-1-break": "5", "trial-1-recovery": "9", "trial-2-break": "5", "trial-2-recovery": "9", "trial-3-break": "5", "trial-3-recovery": "9", "detection-method": "objective-observation", "breaking-eye": "OS" });
    expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  });
  it.each(["facility", "accommodative-facility"] as const)("times %s with full pairs, invalidation, release recording and all required eyes", async kind => {
    const sim = await lesson(kind); await sim.prepare(kind === "accommodative-facility" ? "OS" : undefined);
    const tool = kind === "facility" ? "prism-flipper" : "lens-flipper", flip = kind === "facility" ? "CLEAR + SINGLE / FLIP" : "CLEAR / FLIP ±2 D";
    for (let eye = 0; eye < (kind === "facility" ? 1 : 3); eye++) {
      if (eye === 1) await sim.fit("cover", "sensory-occlude-OD"); if (eye === 2) { await sim.pickup(0, "cover"); await sim.at(0, [-1.31, .9775, .59]); await sim.putDown(0); }
      await sim.pickup(1, tool); await sim.at(1, [0, 1.4, -.46]); await sim.action("START 60-SECOND RUN"); await sim.action(flip); expect(sim.mirror().status).toContain("0 cycles");
      await sim.tick(kind === "facility" ? 850 : 1500); await sim.action(flip); await sim.tick(kind === "facility" ? 650 : 1800); await sim.action(flip); expect(sim.mirror().status).toContain("1 cycles");
      if (eye === 0) { sim.tracked[1] = false; await sim.step(); sim.tracked[1] = true; await sim.step(1 / 72, 12); expect(sim.mirror().status).toContain("0 cycles"); await sim.action("START 60-SECOND RUN"); }
      await sim.tick(60000); expect(sim.mirror().ready).toBe(true); await sim.putDown(1); await sim.step(1 / 72, 12); expect(sim.mirror().ready).toBe(true); await sim.enter({ cycles: eye === 0 ? "0" : "1" });
    }
    expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  });
  it("completes push-up OD, OS and OU with fitted occlusion and independently calculated amplitudes", async () => {
    const sim = await lesson("push-up"); await sim.prepare("OS"); await sim.pickup(1, "fixation");
    for (let i = 0; i < 3; i++) {
      if (i === 1) await sim.fit("cover", "sensory-occlude-OD"); if (i === 2) { await sim.pickup(0, "cover"); await sim.at(0, [-1.31, .9775, .59]); await sim.putDown(0); }
      await sim.at(1, [0, 1.4, -.111]); await sim.step(1 / 72, 12); const cm = [10, 11, 12][i]; await sim.at(1, [0, 1.4, -.511 + cm / 100]); await sim.action("MARK SUSTAINED BLUR"); expect(sim.mirror().ready).toBe(true);
      await sim.enter({ distance: String(cm), amplitude: (100 / cm).toFixed(2) });
    }
    expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  });
  it("settles quarter-dioptre minus lenses and records each monocular amplitude after release", async () => {
    const sim = await lesson("minus-lens"); await sim.prepare("OS");
    for (let i = 0; i < 2; i++) {
      if (i) await sim.fit("cover", "sensory-occlude-OD"); await sim.pickup(1, "trial-lens"); await sim.at(1, [0, 1.4, -.46]);
      for (let step = 0; step < 16; step++) { await sim.settle(); await sim.action("ADD −0.25 D"); }
      await sim.action("MARK SUSTAINED BLUR"); expect(sim.mirror().ready).toBe(false); await sim.settle(); await sim.action("MARK SUSTAINED BLUR"); expect(sim.mirror().ready).toBe(true);
      await sim.putDown(1); await sim.step(1 / 72, 12); expect(sim.mirror().ready).toBe(true); await sim.enter({ amplitude: "6.5" });
    }
    expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  });
  it("requires NRA, restored clear baseline and PRA in order", async () => {
    const sim = await lesson("relative"); await sim.prepare(); await sim.pickup(1, "trial-lens"); await sim.at(1, [0, 1.4, -.46]);
    for (let i = 0; i < 8; i++) { await sim.settle(); await sim.action("ADD +0.25 D"); } await sim.settle(); await sim.action("MARK SUSTAINED BLUR"); expect(sim.mirror().ready).toBe(false);
    await sim.action("CONFIRM CLEAR BASELINE"); expect(sim.mirror().status).toContain("baseline");
    for (let i = 0; i < 8; i++) { await sim.settle(); await sim.action("REMOVE +0.25 D"); } await sim.settle(); await sim.action("CONFIRM CLEAR BASELINE");
    for (let i = 0; i < 9; i++) { await sim.settle(); await sim.action("ADD −0.25 D"); } await sim.settle(); await sim.action("MARK SUSTAINED BLUR"); expect(sim.mirror().ready).toBe(true);
    await sim.enter({ nra: "2", pra: "-2.25" }); expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  });

  it.each(["thorington", "push-up"] as const)("discards cancelled %s captures, invalidates refitting and ignores stale exit submission", async kind => {
    const sim = await lesson(kind);
    if (kind === "thorington") { await sim.fit("subjective"); await sim.fit("maddox", "sensory-maddox-horizontal"); await sim.fit("thorington"); await sim.pickup(1, "pupils"); await sim.at(1, [0, 1.425, .137]); await sim.event(1, "selectstart"); }
    else { await sim.prepare(kind === "push-up" ? "OS" : undefined); await sim.pickup(1, "fixation"); }
    const observe = async () => {
      if (kind === "thorington") { await sim.action("ASK NUMBER AND SIDE"); await sim.tick(1); await sim.tick(260); await sim.event(1, "selectend"); await sim.putDown(1); await sim.step(1 / 72, 12); }
      else { await sim.at(1, [0, 1.4, -.111]); await sim.step(1 / 72, 12); await sim.at(1, [0, 1.4, -.411]); await sim.action("MARK SUSTAINED BLUR"); }
    };
    await observe(); expect(sim.mirror().ready, sim.mirror().status).toBe(true);
    await act(async () => sim.mirror().cancel?.()); await sim.step(1 / 72, 12); expect(sim.mirror().ready).toBe(false); expect(sim.complete).not.toHaveBeenCalled();
    if (kind === "thorington") { await sim.pickup(1, "pupils"); await sim.at(1, [0, 1.425, .137]); await sim.event(1, "selectstart"); }
    await observe(); expect(sim.mirror().ready).toBe(true);
    await sim.pickup(0, "subjective"); await sim.step(1 / 72, 12); expect(sim.mirror().ready).toBe(false);
    await act(async () => sim.mirror().record()); expect(sim.complete).not.toHaveBeenCalled(); await sim.putDown(0); await sim.fit("subjective");
    if (kind === "thorington") { await sim.pickup(1, "pupils"); await sim.at(1, [0, 1.425, .137]); await sim.event(1, "selectstart"); }
    await observe(); expect(sim.mirror().ready).toBe(true); const late = sim.mirror().record;
    await sim.exit(); await act(async () => late()); expect(sim.complete).not.toHaveBeenCalled(); sim.noTest();
  });
  it("preserves Thorington capture when light is released, then refuses a changed rod setup", async () => {
    const sim = await lesson("thorington"); await sim.fit("subjective"); await sim.fit("maddox", "sensory-maddox-horizontal"); await sim.fit("thorington"); await sim.pickup(1, "pupils"); await sim.at(1, [0, 1.425, .137]); await sim.event(1, "selectstart"); await sim.action("ASK NUMBER AND SIDE"); await sim.tick(1); await sim.tick(260);
    await sim.event(1, "selectend"); await sim.putDown(1); await sim.step(1 / 72, 12); expect(sim.mirror().ready).toBe(true);
    await sim.enter({ magnitude: "5", side: "right", interpretation: "esophoria" }); expect(sim.mirror().lesson.feedback).toContain("immutable report"); expect(sim.mirror().findingPosition?.current).toBe(1);
    await sim.fit("maddox", "sensory-maddox-vertical"); expect(sim.mirror().ready).toBe(false); expect(sim.mirror().lesson.entries).toEqual({}); sim.noTest();
  });
  it("resets a hidden timed run and rejects rotated optics without credit", async () => {
    const sim = await lesson("facility"); await sim.prepare(); await sim.pickup(1, "prism-flipper"); await sim.at(1, [0, 1.4, -.46]);
    sim.grips[1].rotation.y = Math.PI; await sim.step(1 / 72, 12); await sim.action("START 60-SECOND RUN"); await sim.tick(60000); expect(sim.mirror().ready).toBe(false);
    sim.grips[1].rotation.y = 0; await sim.step(1 / 72, 12); await sim.action("START 60-SECOND RUN");
    await act(async () => { sim.session.visibilityState = "hidden"; sim.session.dispatchEvent(new Event("visibilitychange")); }); await sim.tick(60000);
    await act(async () => { sim.session.visibilityState = "visible"; sim.session.dispatchEvent(new Event("visibilitychange")); }); await sim.step(1 / 72, 12); expect(sim.mirror().ready).toBe(false); expect(sim.mirror().status).toContain("60s"); sim.noTest();
  });
  it("uses paged signed decimal entries through real headset rays for NRA/PRA", async () => {
    const sim = await lesson("relative"); await sim.prepare(); await sim.pickup(1, "trial-lens"); await sim.at(1, [0, 1.4, -.46]);
    for (let i = 0; i < 8; i++) { await sim.settle(); await sim.action("ADD +0.25 D"); } await sim.settle(); await sim.action("MARK SUSTAINED BLUR");
    for (let i = 0; i < 8; i++) { await sim.settle(); await sim.action("REMOVE +0.25 D"); } await sim.settle(); await sim.action("CONFIRM CLEAR BASELINE");
    for (let i = 0; i < 9; i++) { await sim.settle(); await sim.action("ADD −0.25 D"); } await sim.settle(); await sim.action("MARK SUSTAINED BLUR");
    await sim.putDown(1); await sim.panel(1); await sim.click(1, sim.button("RECORD FINDING"));
    await sim.click(1, sim.button("ENTRY +1 D")); await sim.click(1, sim.button("ENTRY +1 D")); expect(sim.mirror().lesson.entries.nra).toBe("2");
    await sim.click(1, sim.button("NEXT ENTRIES")); await sim.click(1, sim.button("ENTRY −1 D")); await sim.click(1, sim.button("ENTRY −1 D")); await sim.click(1, sim.button("ENTRY −0.25 D"));
    expect(sim.mirror().lesson.entries).toEqual({ nra: "2", pra: "-2.25" }); await sim.click(1, sim.button("SUBMIT / CHECK")); expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  });
  it.each(["maddox", "thorington", "npc", "push-up"] as const)("keeps %s preview and late exit callbacks from awarding completion", async kind => {
    const sim = await lesson(kind, true); await act(async () => sim.mirror().record()); expect(sim.mirror().ready).toBe(false); expect(sim.controls()).toHaveLength(0); await sim.exit(); await sim.event(1, "selectstart"); await act(async () => sim.mirror().record()); expect(sim.complete).not.toHaveBeenCalled(); sim.noTest();
  });
});
