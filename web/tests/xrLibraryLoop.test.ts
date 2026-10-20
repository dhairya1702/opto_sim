import { createElement } from "react";
import { act } from "@react-three/fiber";
import { Mesh, Quaternion, Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clinic } from "./helpers/xrClinicHarness";
import { PhoriaPracticeController } from "../practice/xr/PhoriaPracticeController";
import { VergencePracticeController } from "../practice/xr/VergencePracticeController";
import { NPCPracticeController } from "../practice/xr/NPCPracticeController";
import { FusionalVergencePracticeController } from "../practice/xr/FusionalVergencePracticeController";
import { VerticalFusionalVergencePracticeController } from "../practice/xr/VerticalFusionalVergencePracticeController";
import { NearFusionalVergencePracticeController } from "../practice/xr/NearFusionalVergencePracticeController";
import { AccommodationPracticeController } from "../practice/xr/AccommodationPracticeController";
import { PushUpPracticeController } from "../practice/xr/PushUpPracticeController";
import { MinusLensPracticeController } from "../practice/xr/MinusLensPracticeController";
import { RelativeAccommodationPracticeController } from "../practice/xr/RelativeAccommodationPracticeController";
import type { BatchMirror } from "../practice/xr/PracticeLessonUI";
import { librarySockets, type LibraryKind } from "../interaction/xrLibraryEquipment";
import { consultationToolDefinition, type ConsultationToolId } from "../interaction/xrConsultationTools";
import { maddoxTrials } from "../interaction/maddoxPractice";
import { MADDOX_PRISM_CELLS } from "../interaction/maddoxProcedure";
import { PracticeAttemptProvider, type PracticeAttemptKind } from "../practice/PracticeAttemptContext";

/** Check actual rendered mesh vertices and ancestor transforms, not procedure values. */
function expectNearEyesWithinSclera(sim: Awaited<ReturnType<typeof lesson>>, osOutward = false, converging = true) {
  sim.state.scene.updateMatrixWorld(true);
  for (const gaze of sim.eyes("consultationGaze")) {
    const eye = gaze.userData.consultationGaze;
    expect(Math.sign(gaze.position.x)).toBe(converging ? (eye === "OD" || osOutward ? 1 : -1) : 0);
    if (converging) expect(Math.abs(gaze.position.x)).toBeGreaterThan(.005);
    if (!gaze.parent) throw new Error("Canonical eye is missing its anchor");
    const anchor = gaze.parent.getWorldPosition(new Vector3());
    const sclera: Mesh[] = [];
    sim.state.scene.traverse(object => {
      if (object instanceof Mesh && object.geometry.type === "SphereGeometry"
        && object.scale.x === .025 && object.scale.y === .011 && object.scale.z === .013
        && Math.abs(object.getWorldPosition(new Vector3()).x - anchor.x) < .001) sclera.push(object);
    });
    expect(sclera).toHaveLength(1);
    gaze.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const vertices = object.geometry.getAttribute("position");
      for (let index = 0; index < vertices.count; index++) {
        const point = sclera[0].worldToLocal(object.localToWorld(new Vector3().fromBufferAttribute(vertices, index)));
        expect(point.x ** 2 + point.y ** 2).toBeLessThanOrEqual(1);
      }
    });
  }
}

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function lesson(kind: LibraryKind, preview = false, attemptKind?: PracticeAttemptKind) {
  let mirror: BatchMirror; let now = 0; vi.spyOn(performance, "now").mockImplementation(() => now);
  const complete = vi.fn(), leave = vi.fn();
  const sim = await clinic({ renderAdapter: ({ active }) => {
    const common = { active, preview, onComplete: complete, onExit: leave, onMirror: (next: BatchMirror) => { mirror = next; } };
    const controller = kind === "maddox" || kind === "thorington" ? createElement(PhoriaPracticeController, { ...common, kind }) : kind === "npc" ? createElement(NPCPracticeController, common) : kind === "push-up" ? createElement(PushUpPracticeController, common) : kind === "minus-lens" ? createElement(MinusLensPracticeController, common) : kind === "relative" ? createElement(RelativeAccommodationPracticeController, common) : kind === "horizontal-distance" ? createElement(FusionalVergencePracticeController, common) : kind === "vertical-distance" ? createElement(VerticalFusionalVergencePracticeController, common) : kind === "horizontal-near" ? createElement(NearFusionalVergencePracticeController, common) : kind === "accommodative-facility" ? createElement(AccommodationPracticeController, { ...common, kind }) : createElement(VergencePracticeController, { ...common, kind });
    return attemptKind ? createElement(PracticeAttemptProvider, { value: { settings: { kind: attemptKind, interaction: "vr", voice: "enabled" }, setSettings: vi.fn() }, children: controller }) : controller;
  } }); dispose = sim.dispose;
  const boardActionLabels = () => {
    const labels: string[] = [];
    sim.state.scene.traverse(root => {
      if (!root.userData.xrPersistentFindings) return;
      root.traverse(object => {
        if (object.userData.xrButton && object.position.y >= .565) labels.push(object.userData.xrLabel as string);
      });
    });
    return labels;
  };
  const action = async (label: string) => { const item = mirror!.actions.find(a => a.label === label); if (!item) throw new Error(`Missing ${label}: ${mirror!.actions.map(a => a.label).join(", ")}`); await act(async () => item.run()); await sim.step(1 / 72, 12); };
  const fit = async (id: ConsultationToolId, socketId?: string) => { const socket = librarySockets(kind).find(s => s.tool === id && (!socketId || s.id === socketId))!; await sim.pickup(0, id); const rotation = new Quaternion(...socket.rotation).multiply(new Quaternion(...consultationToolDefinition(id).gripRotation).invert()); sim.grips[0].quaternion.copy(rotation); sim.rays[0].quaternion.copy(rotation); await sim.at(0, socket.position); await sim.putDown(0); await sim.step(1 / 72, 12); sim.grips[0].quaternion.identity(); sim.rays[0].quaternion.identity(); };
  const enter = async (values: Record<string, string>) => { await act(async () => { for (const [id, value] of Object.entries(values)) mirror!.lesson.choose(id, value); }); await act(async () => mirror!.record()); await sim.step(1 / 72, 12); };
  const tick = async (ms: number) => { now += ms; await sim.step(1 / 72, 12); };
  const settle = () => sim.step(1 / 72, 90);
  const targetSwitch = () => { let control: typeof sim.state.scene | undefined; sim.tool("worth").traverse(object => { if (object.userData.xrInstrumentControl === "worth") control = object as typeof sim.state.scene; }); if (!control) throw new Error("Missing point-target switch"); return control; };
  const physicalTargetSwitch = async () => { const control = targetSwitch(), point = control.getWorldPosition(new Vector3()); await sim.at(0, [point.x, point.y, point.z + .025]); await sim.click(0, control); };
  const prismTurnControl = () => { let control: typeof sim.state.scene | undefined; sim.tool("prism-flipper").traverse(object => { if (object.userData.xrLabel === "PRISM FLIP TURN") control = object as typeof sim.state.scene; }); if (!control) throw new Error("Missing prism-flipper turn control"); return control; };
  const physicalPrismFlip = async () => { const control = prismTurnControl(), point = control.getWorldPosition(new Vector3()); await sim.at(0, point.toArray() as [number, number, number]); await sim.click(0, control); };
  const lensTurnControl = () => { let control: typeof sim.state.scene | undefined; sim.tool("lens-flipper").traverse(object => { if (object.userData.xrLabel === "LENS FLIP TURN") control = object as typeof sim.state.scene; }); if (!control) throw new Error("Missing lens-flipper turn control"); return control; };
  const physicalLensFlip = async () => { const control = lensTurnControl(), point = control.getWorldPosition(new Vector3()); await sim.at(0, point.toArray() as [number, number, number]); await sim.click(0, control); };
  const prismCell = async (power: number, base: "BI" | "BO" | "BU" | "BD") => {
    const match = mirror!.status.match(/prism (\d+)Δ/); const current = Number(match?.[1] ?? 20);
    let index = MADDOX_PRISM_CELLS.indexOf(current as typeof MADDOX_PRISM_CELLS[number]);
    const target = MADDOX_PRISM_CELLS.indexOf(power as typeof MADDOX_PRISM_CELLS[number]);
    await sim.thumbstick(1, base === "BI" || base === "BU" ? -1 : 1, "horizontal");
    while (index < target) { await sim.thumbstick(1, 1); index++; }
    while (index > target) { await sim.thumbstick(1, -1); index--; }
    sim.rays[1].rotation.set(0, 0, 0); sim.grips[1].rotation.set(0, 0, 0);
    await sim.at(1, [-.048, 1.357, -.481]); await tick(1); await tick(260);
  };
  const holdNearPenlight = async () => { await sim.pickup(0, "pupils"); sim.rays[0].rotation.set(0, 0, 0); sim.grips[0].rotation.set(0, 0, 0); await sim.at(0, [0, 1.5, .026]); await sim.event(0, "selectstart"); await sim.step(1 / 72, 12); };
  const prepare = async (cover?: "OD" | "OS") => { await fit("subjective"); if (cover) await fit("cover", `sensory-occlude-${cover}`); if (kind === "push-up") { await fit("push-up-rule", "library-push-up-spectacle"); await action("GIVE FIRST SUSTAINED BLUR INSTRUCTION"); return; } if (["horizontal-near", "facility", "minus-lens", "relative", "accommodative-facility"].includes(kind)) await fit("near"); if (kind === "horizontal-near") { await action("CONFIRM PREPARED NEAR TARGET AT 40 CM"); await action("GIVE BLUR / DOUBLE / RECOVERY INSTRUCTION"); } else if (kind !== "minus-lens" && kind !== "relative") await action("ESTABLISH FIXATION"); };
  const noTest = () => { expect(sim.record).not.toHaveBeenCalled(); expect(sim.encounter().results).toHaveLength(0); };
  return { ...sim, boardActionLabels, mirror: () => mirror!, complete, leave, action, fit, enter, tick, settle, prepare, noTest, physicalTargetSwitch, physicalPrismFlip, prismTurnControl, physicalLensFlip, lensTurnControl, prismCell, holdNearPenlight };
}
describe("mounted remaining shared-clinic XR modules", () => {
  it("shows the seven-step Push-up coach and highlights only in Guided mode", async () => {
    const guided = await lesson("push-up", false, "guided");
    expect(guided.labels().join(" ")).toContain("GUIDED STEP 1 / 7");
    let guidedHighlights = 0; guided.state.scene.traverse(object => { if (object.userData.xrInstructionalHighlight) guidedHighlights++; });
    expect(guidedHighlights).toBeGreaterThan(0);
    await dispose?.(); dispose = undefined;
    const test = await lesson("push-up", false, "test");
    expect(test.labels().join(" ")).not.toContain("GUIDED STEP");
    let testHighlights = 0; test.state.scene.traverse(object => { if (object.userData.xrInstructionalHighlight) testHighlights++; });
    expect(testHighlights).toBe(0);
  });
  it("stocks the monocular minus-lens holder and keeps its eight-step coach out of Test", async () => {
    const guided = await lesson("minus-lens", true, "guided");
    expect(guided.tool("minus-lens-holder")).toBeDefined();
    expect(guided.labels().join(" ")).toContain("GUIDED STEP 1 / 8");
    expect(guided.labels().join(" ")).toContain("C D H N O");
    await dispose?.(); dispose = undefined;
    const test = await lesson("minus-lens", true, "test");
    expect(test.labels().join(" ")).not.toContain("GUIDED STEP");
    expect(test.mirror().status).not.toContain("−4.00 D");
  });
  it("stocks the face-on binocular NRA/PRA holder and keeps its ten-step coach out of Test", async () => {
    const guided = await lesson("relative", true, "guided");
    expect(guided.tool("trial-lens")).toBeDefined();
    expect(guided.labels().join(" ")).toContain("GUIDED STEP 1 / 10");
    expect(guided.labels().join(" ")).toContain("C D H N O");
    let apertures = 0; guided.tool("trial-lens").traverse(object => { if (object.userData.xrRelativeAccommodationAperture) apertures++; });
    expect(apertures).toBe(2);
    await dispose?.(); dispose = undefined;
    const test = await lesson("relative", true, "test");
    expect(test.labels().join(" ")).not.toContain("GUIDED STEP");
    let highlights = 0; test.state.scene.traverse(object => { if (object.userData.xrInstructionalHighlight) highlights++; });
    expect(highlights).toBe(0);
  });
  it("shows the nine-step Maddox coach and only the current fitting guide in Guided preview", async () => {
    const guided = await lesson("maddox", true, "guided");
    expect(guided.labels()).toContain("GUIDED · STEP 1 OF 9");
    let highlights = 0; guided.state.scene.traverse(object => { if (object.userData.xrInstructionalHighlight) highlights++; });
    expect(highlights).toBeGreaterThan(0);
    const fittingGuides: string[] = [];
    guided.state.scene.traverse(object => { if (object.userData.xrFittingGuideSocket) fittingGuides.push(object.userData.xrFittingGuideSocket as string); });
    expect(fittingGuides).toEqual(["sensory-correction"]);
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
  it.each(["guided", "test"] as const)("keeps wrong-base Maddox feedback appropriate for %s attempts", async kind => {
    const sim = await lesson("maddox", false, kind);
    await sim.fit("subjective"); await sim.fit("maddox", "sensory-maddox-horizontal");
    await sim.fit("worth", "sensory-worth-distance"); await sim.physicalTargetSwitch();
    await sim.pickup(1, "prism"); await sim.prismCell(20, "BO");
    const expected = kind === "guided" ? "Change the physical base from BO to BI." : "Reassess the base direction";
    await sim.action("ASK STREAK / LIGHT RELATION"); await sim.tick(260);
    expect(sim.mirror().status).toContain(expected);
    await sim.action("PRISM TRIGGER · CAPTURE");
    expect(JSON.stringify(sim.mirror().lesson.feedback)).toContain(expected);
    if (kind === "test") {
      expect(JSON.stringify(sim.mirror().lesson.feedback)).not.toMatch(/\b(BI|BO|BU|BD)\b/);
      expect(sim.mirror().status).not.toContain("to BI");
    }
    expect(sim.mirror().ready).toBe(false); expect(sim.complete).not.toHaveBeenCalled(); sim.noTest();
  });
  it("completes all four Maddox trials with physical distance/near target, starting prism and independent recording", async () => {
    const sim = await lesson("maddox"); await sim.fit("subjective"); await sim.fit("maddox", "sensory-maddox-horizontal"); await sim.fit("worth", "sensory-worth-distance");
    expect(sim.labels()).toContain("TRIAL 1/4 · DISTANCE · HORIZONTAL");
    expect(sim.labels()).toContain("Turn on the distance target");
    expect(sim.labels()).toContain("POWER"); expect(sim.labels()).toContain("OFF");
    let switchHighlights = 0; sim.tool("worth").traverse(object => { if (object.userData.xrInstructionalHighlight) switchHighlights++; });
    expect(switchHighlights).toBe(2);
    await sim.physicalTargetSwitch(); expect(sim.labels()).toContain("ON"); await sim.pickup(1, "prism");
    expect(sim.labels()).toContain("20Δ · BI");
    expect(MADDOX_PRISM_CELLS.some(power => sim.labels().includes(`${power}Δ`))).toBe(false);
    await sim.thumbstick(1, -1); expect(sim.mirror().status).toContain("prism 15Δ BI");
    await sim.thumbstick(1, 1); expect(sim.mirror().status).toContain("prism 20Δ BI");
    await sim.thumbstick(1, 1, "horizontal"); expect(sim.mirror().status).toContain("prism 20Δ BO");
    await sim.thumbstick(1, -1, "horizontal"); expect(sim.mirror().status).toContain("prism 20Δ BI");
    for (let i = 0; i < 4; i++) {
      const trial = maddoxTrials[i];
      if (i > 0) await sim.fit("maddox", trial.axis === "horizontal" ? "sensory-maddox-horizontal" : "sensory-maddox-vertical");
      if (trial.site === "near") await sim.holdNearPenlight();
      await sim.action("ASK STREAK / LIGHT RELATION"); expect(sim.mirror().actions[0].active, sim.mirror().status).toBe(true); await sim.prismCell(20, trial.base); expect(sim.mirror().actions[0].active, sim.mirror().status).toBe(true); await sim.prismCell(trial.neutral, trial.base);
      expect(sim.mirror().voiceReport, sim.mirror().status).toContain("passes through");
      await sim.event(1, "selectstart"); await sim.event(1, "selectend"); await sim.putDown(1);
      if (trial.site === "near") { await sim.event(0, "selectend"); await sim.putDown(0); }
      expect(sim.mirror().ready, sim.mirror().status).toBe(true); expect(sim.mirror().lesson.entries).toEqual({});
      expect(sim.labels().join(" ")).toContain("Record independently");
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
      expect(sim.labels().join(" ")).toContain("Transcribe and interpret");
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
  it.each(["horizontal-distance", "vertical-distance"] as const)("requires a powered, docked mirrored target for %s and clears unfinished work when it is lost", async kind => {
    const sim = await lesson(kind, false, "guided");
    const establish = kind === "horizontal-distance" ? "ESTABLISH MIRRORED DISTANCE TARGET" : "ESTABLISH PREPARED MIRRORED TARGET";
    const instruction = kind === "horizontal-distance" ? "GIVE BLUR / DOUBLE / RECOVERY INSTRUCTION" : "GIVE DOUBLE / RECOVERY INSTRUCTION";
    const targetAction = () => sim.mirror().actions.find(action => action.label === establish)!;
    let image: typeof sim.state.scene | undefined;
    sim.state.scene.traverse(object => { if (object.userData.xrWorthFace === "mirror") image = object.parent as typeof sim.state.scene; });
    expect(image).toBeDefined();
    expect(image!.visible).toBe(false);
    await sim.fit("subjective");
    expect(targetAction().disabled).toBe(true);
    await sim.action(establish); // A direct callback cannot bypass physical setup.
    expect(targetAction().active).toBe(false);
    await sim.fit("worth", "sensory-worth-near"); await sim.physicalTargetSwitch();
    expect(targetAction().disabled).toBe(true);
    expect(image!.visible).toBe(false);
    await sim.fit("worth", "sensory-worth-distance");
    expect(image!.visible).toBe(true);
    expect(targetAction().disabled).toBe(false);
    await sim.action(establish); await sim.action(instruction);
    expect(targetAction().active).toBe(true);
    await sim.action("TOGGLE DISTANCE TARGET POWER");
    expect(image!.visible).toBe(false);
    expect(targetAction().active).toBe(false);
    expect(targetAction().disabled).toBe(true);
    expect(sim.mirror().status).toContain("switch it on");
    expect(sim.mirror().reportLines).toEqual([]);
    expect(sim.mirror().ready).toBe(false);
    await sim.physicalTargetSwitch(); await sim.action(establish);
    expect(image!.visible).toBe(true);
    expect(targetAction().active).toBe(true);
    await sim.pickup(0, "worth"); await sim.step(1 / 72, 12);
    expect(image!.visible).toBe(false);
    expect(targetAction().active).toBe(false);
    expect(sim.mirror().ready).toBe(false);
    sim.noTest();
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
    await sim.fit("subjective"); await sim.fit("worth", "sensory-worth-distance"); await sim.physicalTargetSwitch(); await sim.action("ESTABLISH MIRRORED DISTANCE TARGET"); await sim.action("GIVE BLUR / DOUBLE / RECOVERY INSTRUCTION");
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
    await sim.fit("subjective"); await sim.fit("worth", "sensory-worth-distance"); await sim.physicalTargetSwitch(); await sim.action("ESTABLISH MIRRORED DISTANCE TARGET"); await sim.action("GIVE BLUR / DOUBLE / RECOVERY INSTRUCTION");
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
    await sim.fit("subjective"); await sim.fit("worth", "sensory-worth-distance"); await sim.physicalTargetSwitch(); await sim.action("ESTABLISH MIRRORED DISTANCE TARGET"); await sim.action("GIVE BLUR / DOUBLE / RECOVERY INSTRUCTION");
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
    expect(sim.labels().join(" ")).toContain("Increase BI demand");
    await moveTo(7); expect(sim.mirror().voiceReport).toContain("double");
    expect(sim.labels().join(" ")).toContain("Reduce BI to recovery");
    expect(sim.labels().join(" ")).not.toContain("Increase BI demand");
    await moveTo(5);
    expect(sim.mirror().reportLines).toEqual([]);
    expect(sim.labels().join(" ")).toContain("Reduce BI to recovery");
    await moveTo(4); expect(sim.mirror().reportLines).toEqual(["BI: X / 7 / 4Δ"]);
    expect(sim.labels().join(" ")).toContain("Reset and complete BO");
    await sim.action("TOGGLE DISTANCE TARGET POWER");
    expect(sim.mirror().reportLines).toEqual(["BI: X / 7 / 4Δ"]);
    await sim.physicalTargetSwitch(); await sim.action("ESTABLISH MIRRORED DISTANCE TARGET");
    await moveTo(0); await sim.tick(260);
    sim.rays[1].rotation.z = Math.PI; sim.grips[1].rotation.z = Math.PI;
    await sim.at(1, [-.048, 1.6, -.481]); await sim.tick(260);
    await moveTo(9); expect(sim.mirror().voiceReport).toContain("blurred");
    await moveTo(19); expect(sim.mirror().voiceReport).toContain("double");
    await moveTo(12); expect(sim.mirror().reportLines).toHaveLength(2);
    expect(sim.labels().join(" ")).toContain("Release and record");
    await sim.action("TOGGLE DISTANCE TARGET POWER");
    expect(sim.mirror().reportLines).toHaveLength(2);
    await sim.panel(0); await sim.panel(0); expect(sim.mirror().reportLines).toHaveLength(2);
    await sim.putDown(1); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready, sim.mirror().status).toBe(true);
    expect(sim.mirror().fields).toHaveLength(6);
    expect(sim.mirror().lesson.entries).toEqual({});
    expect(sim.labels().join(" ")).toContain("Release and record");
    await sim.enter({ "bi-blur": "X", "bi-break": "7", "bi-recovery": "4", "bo-blur": "9", "bo-break": "19", "bo-recovery": "12" });
    expect(sim.complete).toHaveBeenCalledTimes(1); await act(async () => sim.mirror().record()); expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  }, 15000);
  it("stocks the near target and rotary prism, with Guided coaching concealed in Test", async () => {
    const guided = await lesson("horizontal-near", true, "guided");
    expect(guided.tool("near")).toBeDefined(); expect(guided.tool("vergence-prism")).toBeDefined(); expect(() => guided.tool("prism")).toThrow();
    expect(guided.labels().join(" ")).toContain("GUIDED STEP 1 / 10");
    let isolated = 0; guided.tool("near").traverse(object => { if (object.userData.xrPreparedIsolatedNearTarget) isolated++; });
    expect(isolated).toBeGreaterThan(0);
    await dispose?.(); dispose = undefined;
    const test = await lesson("horizontal-near", true, "test");
    expect(test.labels().join(" ")).not.toContain("GUIDED STEP"); expect(test.mirror().status).not.toMatch(/13Δ|17Δ|21Δ|11Δ/);
  });
  it("requires the prepared near target to be released onto its stand", async () => {
    const sim = await lesson("horizontal-near", false, "guided"); await sim.fit("subjective");
    const socket = librarySockets("horizontal-near").find(value => value.id === "practice-near-stand")!;
    await sim.pickup(0, "near"); await sim.at(0, socket.position); await sim.step(1 / 72, 12);
    expect(sim.mirror().actions.find(action => action.label === "CONFIRM PREPARED NEAR TARGET AT 40 CM")?.disabled).toBe(true);
    await sim.putDown(0); await sim.step(1 / 72, 12);
    expect(sim.mirror().actions.find(action => action.label === "CONFIRM PREPARED NEAR TARGET AT 40 CM")?.disabled).toBe(false); sim.noTest();
  });
  it("completes automatic near BI then BO, preserves panel capture, releases, and records six blank fields once", async () => {
    const sim = await lesson("horizontal-near", false, "guided"); await sim.prepare();
    await sim.pickup(1, "vergence-prism"); await sim.at(1, [-.048, 1.4, -.481]); await sim.tick(260);
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
    await moveTo(13); expect(sim.mirror().voiceReport).toContain("blurred");
    await moveTo(21); expect(sim.mirror().voiceReport).toContain("double");
    await moveTo(13); expect(sim.mirror().reportLines).toEqual([expect.stringContaining("BI: 13 / 21 / 13Δ")]);
    await moveTo(0); await sim.tick(260);
    sim.rays[1].rotation.z = Math.PI; sim.grips[1].rotation.z = Math.PI;
    await sim.at(1, [-.048, 1.6, -.481]); await sim.tick(260);
    await moveTo(17); await moveTo(21); await moveTo(11);
    expect(sim.mirror().reportLines).toHaveLength(2);
    await sim.panel(0); await sim.panel(0); expect(sim.mirror().reportLines).toHaveLength(2);
    expect(sim.mirror().fields).toEqual([]); await sim.putDown(1); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready, sim.mirror().status).toBe(true); expect(sim.mirror().fields).toHaveLength(6); expect(sim.mirror().lesson.entries).toEqual({});
    expect(sim.labels().join(" ")).toContain("Release and record");
    await sim.enter({ "bi-blur": "13", "bi-break": "21", "bi-recovery": "13", "bo-blur": "17", "bo-break": "21", "bo-recovery": "11" });
    expect(sim.complete).toHaveBeenCalledTimes(1); await act(async () => sim.mirror().record()); expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  }, 20000);
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
    await sim.fit("subjective"); await sim.fit("worth", "sensory-worth-distance"); await sim.physicalTargetSwitch(); await sim.action("ESTABLISH PREPARED MIRRORED TARGET"); await sim.action("GIVE DOUBLE / RECOVERY INSTRUCTION");
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
    await sim.fit("subjective"); await sim.fit("worth", "sensory-worth-distance"); await sim.physicalTargetSwitch(); await sim.action("ESTABLISH PREPARED MIRRORED TARGET"); await sim.action("GIVE DOUBLE / RECOVERY INSTRUCTION");
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
    await sim.action("TOGGLE DISTANCE TARGET POWER");
    expect(sim.mirror().reportLines).toEqual(["BU: 4 / 2Δ"]);
    await sim.physicalTargetSwitch(); await sim.action("ESTABLISH PREPARED MIRRORED TARGET");
    await moveTo(0); await sim.tick(260);
    sim.rays[1].rotation.z = -Math.PI / 2; sim.grips[1].rotation.z = -Math.PI / 2;
    await sim.at(1, [-.148, 1.5, -.481]); await sim.tick(260);
    await moveTo(4); await moveTo(2); expect(sim.mirror().reportLines).toEqual(["BU: 4 / 2Δ", "BD: 4 / 2Δ"]);
    await sim.action("TOGGLE DISTANCE TARGET POWER");
    expect(sim.mirror().reportLines).toHaveLength(2);
    await sim.panel(0); await sim.panel(0); expect(sim.mirror().reportLines).toHaveLength(2);
    expect(sim.mirror().fields).toEqual([]); await sim.putDown(1); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready, sim.mirror().status).toBe(true); expect(sim.mirror().fields).toHaveLength(4); expect(sim.mirror().lesson.entries).toEqual({});
    expect(sim.labels().join(" ")).toContain("Release and record");
    await sim.enter({ "bu-break": "4", "bu-recovery": "2", "bd-break": "4", "bd-recovery": "2" });
    expect(sim.complete).toHaveBeenCalledTimes(1); await act(async () => sim.mirror().record()); expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  });
  it("resets unfinished vertical motion on tracking, early release, teleportation, transfer, and correction revision", async () => {
    const preview = await lesson("vertical-distance", true, "guided"); expect(preview.mirror().reportLines).toEqual([]); preview.noTest();
    await dispose?.(); dispose = undefined;
    const sim = await lesson("vertical-distance", false, "guided");
    await sim.fit("subjective"); await sim.fit("worth", "sensory-worth-distance"); await sim.physicalTargetSwitch(); await sim.action("ESTABLISH PREPARED MIRRORED TARGET"); await sim.action("GIVE DOUBLE / RECOVERY INSTRUCTION");
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
    await sim.at(1, [0, 1.545, -.111]); await sim.event(1, "selectstart"); await sim.tick(260);
    for (let cm = 39.5; cm >= 35; cm -= .5) {
      await sim.at(1, [0, 1.545, -.511 + cm / 100]); await sim.tick(250);
    }
    expect(sim.mirror().status).toContain("approach");
    expect(sim.labels().join(" ")).toContain("GUIDED STEP 7 / 10 · Move inward");
    expect(sim.labels().join(" ")).not.toContain("Set the start distance");
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
    expectNearEyesWithinSclera(sim, false, false);
    const carriage = async (cm: number) => { await sim.at(1, [0, 1.545, -.511 + cm / 100]); await sim.tick(250); };
    await sim.at(1, [0, 1.545, -.111]); await sim.event(1, "selectstart"); await sim.tick(260);
    for (let trial = 0; trial < 3; trial++) {
      for (let cm = 39.5; cm >= 5; cm -= .5) {
        await carriage(cm);
        if (cm === 10) { await sim.settle(); expectNearEyesWithinSclera(sim); }
      }
      await sim.tick(260); await sim.settle(); expectNearEyesWithinSclera(sim, true);
      expect(sim.mirror().voiceReport).toContain("single"); await sim.action("MARK OBSERVED ENDPOINT");
      for (let cm = 5.5; cm <= 9; cm += .5) await carriage(cm);
      await sim.tick(260); await sim.settle(); expectNearEyesWithinSclera(sim);
      await sim.action("MARK OBSERVED ENDPOINT");
      if (trial < 2) { await sim.at(1, [0, 1.545, -.111]); await sim.tick(260); }
    }
    expect(sim.mirror().reportLines, sim.mirror().status).toHaveLength(3); expect(sim.mirror().status).not.toContain("objective");
    await sim.event(1, "selectend"); await sim.action("REMOVE / RELEASE RULE");
    await sim.enter({ "trial-1-break": "5", "trial-1-recovery": "9", "trial-2-break": "5", "trial-2-recovery": "9", "trial-3-break": "5", "trial-3-recovery": "9", "detection-method": "objective-observation", "breaking-eye": "OS" });
    expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  }, 15000);
  it("times vergence facility with physical full pairs, invalidation and release recording", async () => {
    const sim = await lesson("facility"); await sim.prepare();
    await sim.pickup(1, "prism-flipper"); await sim.at(1, [0, 1.4, -.46]); await sim.action("START 60-SECOND RUN");
    expect(sim.mirror().actions.map(action => action.label)).not.toContain("CLEAR + SINGLE / FLIP");
    const control = sim.prismTurnControl(), heldPosition = sim.tool("prism-flipper").getWorldPosition(new Vector3()).clone();
    await sim.at(0, [1, 1, 1]); await sim.click(0, control);
    expect(sim.mirror().status).toContain("BO"); expect(sim.haptics[0]).not.toHaveBeenCalled();
    await sim.physicalPrismFlip();
    expect(sim.mirror().status).toContain("BI"); expect(sim.mirror().status).toContain("0 cycles");
    expect(sim.mirror().status).toContain("still double"); expect(sim.haptics[0]).toHaveBeenCalledTimes(1);
    expect(sim.tool("prism-flipper").getWorldPosition(new Vector3()).distanceTo(heldPosition)).toBeLessThan(.001);
    await sim.tick(650); await sim.physicalPrismFlip(); expect(sim.mirror().status).toContain("0 cycles");
    await sim.tick(850); await sim.physicalPrismFlip(); await sim.tick(650); await sim.physicalPrismFlip(); expect(sim.mirror().status).toContain("1 cycles");
    sim.tracked[1] = false; await sim.step(); sim.tracked[1] = true; await sim.step(1 / 72, 12);
    expect(sim.mirror().status).toContain("0 cycles"); await sim.action("START 60-SECOND RUN");
    await sim.tick(60000); expect(sim.mirror().ready).toBe(true); await sim.putDown(1); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready).toBe(true); await sim.enter({ cycles: "0" });
    expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  });

  it("performs accommodative facility physically for OD, OS and OU with free-hand turns", async () => {
    const sim = await lesson("accommodative-facility", false, "guided");
    expect(sim.mirror().actions.map(action => action.label)).toEqual([
      "ESTABLISH FIXATION", "START 60-SECOND RUN", "RESTART CURRENT RUN",
    ]);
    await sim.fit("subjective"); await sim.fit("near"); await sim.fit("cover", "sensory-occlude-OS");
    await sim.action("ESTABLISH FIXATION");
    await sim.pickup(1, "lens-flipper"); await sim.at(1, [0, 1.4, -.46]);
    const control = sim.lensTurnControl();
    expect(sim.boardActionLabels()).toEqual(["START 60-SECOND RUN"]);
    await sim.action("START 60-SECOND RUN");
    expect(sim.boardActionLabels()).toEqual([]);
    const heldPosition = sim.tool("lens-flipper").getWorldPosition(new Vector3()).clone();
    await sim.at(0, [1, 1, 1]); await sim.click(0, control);
    await sim.click(1, control);
    expect(sim.mirror().status).toContain("plus"); expect(sim.haptics[0]).not.toHaveBeenCalled(); expect(sim.haptics[1]).not.toHaveBeenCalled();
    await sim.physicalLensFlip();
    expect(sim.mirror().status).toContain("minus"); expect(sim.mirror().status).toContain("before the patient cleared");
    expect(sim.haptics[0]).toHaveBeenCalledTimes(1);
    expect(sim.tool("lens-flipper").getWorldPosition(new Vector3()).distanceTo(heldPosition)).toBeLessThan(.001);
    let head: typeof sim.state.scene | undefined;
    sim.tool("lens-flipper").traverse(object => { if (object.userData.xrFlipperHead === "lens-flipper") head = object as typeof sim.state.scene; });
    expect(head?.rotation.y).toBeCloseTo(Math.PI);
    await sim.tick(1800); await sim.physicalLensFlip();
    expect(sim.mirror().status).toContain("not credited"); expect(sim.mirror().status).toContain("0 cycles");
    await sim.tick(1500); await sim.physicalLensFlip(); await sim.tick(1800); await sim.physicalLensFlip();
    expect(sim.mirror().status).toContain("1 cycles"); expect(sim.haptics[0]).toHaveBeenCalledTimes(4);
    await sim.tick(60000); expect(sim.mirror().ready).toBe(true);
    await sim.putDown(1); await sim.step(1 / 72, 12);
    expect(sim.labels().join(" ")).toContain("Record the frozen count");
    expect(sim.boardActionLabels()).toEqual([]);
    await sim.enter({ cycles: "1" }); await sim.pickup(1, "lens-flipper");

    await sim.fit("cover", "sensory-occlude-OD");
    expect(sim.mirror().status).toContain("OS"); expect(sim.mirror().status).toContain("60s");
    expect(sim.boardActionLabels()).toEqual(["ESTABLISH FIXATION"]);
    await sim.action("ESTABLISH FIXATION"); await sim.at(1, [0, 1.4, -.46]); await sim.action("START 60-SECOND RUN");
    await sim.tick(1500); await sim.physicalLensFlip(); await sim.tick(1800); await sim.physicalLensFlip();
    await sim.tick(60000); await sim.enter({ cycles: "1" });

    await sim.pickup(0, "cover");
    const coverHome = consultationToolDefinition("cover").home;
    await sim.at(0, coverHome); await sim.putDown(0); await sim.step(1 / 72, 12);
    expect(sim.mirror().status).toContain("OU");
    await sim.action("ESTABLISH FIXATION"); await sim.at(1, [0, 1.4, -.46]); await sim.action("START 60-SECOND RUN");
    await sim.tick(1500); await sim.physicalLensFlip(); await sim.tick(1800); await sim.physicalLensFlip();
    await sim.tick(60000); await sim.enter({ cycles: "1" });
    expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  });

  it("keeps accommodative-facility setup and flip shortcuts only in desktop mode", async () => {
    const xr = await lesson("accommodative-facility");
    expect(xr.mirror().actions.map(action => action.label)).toEqual(["ESTABLISH FIXATION", "START 60-SECOND RUN", "RESTART CURRENT RUN"]);
    xr.noTest();
  });
  it("requires physical near-target placement for vergence facility", async () => {
    const sim = await lesson("facility");
    expect(sim.mirror().actions.map(action => action.label)).not.toContain("SUPPORT NEAR TARGET AT 40 CM");
    await sim.fit("subjective"); await sim.action("ESTABLISH FIXATION");
    await sim.pickup(1, "prism-flipper"); await sim.at(1, [0, 1.4, -.46]);
    expect(sim.mirror().actions.find(action => action.label === "START 60-SECOND RUN")?.disabled).toBe(true);
    await sim.action("START 60-SECOND RUN"); await sim.tick(1000);
    expect(sim.mirror().status).toContain("60s");
    await sim.fit("near");
    expect(sim.mirror().actions.find(action => action.label === "START 60-SECOND RUN")?.disabled).toBe(false);
    await sim.action("START 60-SECOND RUN"); await sim.tick(1000);
    expect(sim.mirror().status).toContain("59s");
    sim.noTest();
  });
  it("completes push-up OD, OS and OU with fitted occlusion and independently calculated amplitudes", async () => {
    const sim = await lesson("push-up", false, "guided"); await sim.prepare("OS");
    for (let i = 0; i < 3; i++) {
      if (i === 1) { await sim.fit("cover", "sensory-occlude-OD"); await sim.action("GIVE FIRST SUSTAINED BLUR INSTRUCTION"); }
      if (i === 2) { await sim.action("REMOVE COVER · TEST OU"); await sim.action("GIVE FIRST SUSTAINED BLUR INSTRUCTION"); }
      expect(sim.boardActionLabels()).toEqual(["PATIENT REPORT · WHAT DO YOU SEE?"]);
      const cm = [10, 11, 12][i];
      await sim.event(1, "selectstart"); await sim.at(1, [0, 1.545, -.111]); await sim.tick(260);
      for (let distance = 38; distance > cm; distance -= 2) await sim.at(1, [0, 1.545, -.511 + Math.max(cm, distance) / 100]);
      await sim.at(1, [0, 1.545, -.511 + cm / 100]); await sim.tick(500); await sim.event(1, "selectend");
      expect(sim.mirror().ready, sim.mirror().status).toBe(true);
      await sim.settle(); expectNearEyesWithinSclera(sim, false, i === 2);
      expect(sim.labels().join(" ")).toContain(`Record ${["OD", "OS", "OU"][i]}`);
      expect(sim.boardActionLabels()).toEqual([]);
      await sim.enter({ distance: String(cm), amplitude: (100 / cm).toFixed(2) });
    }
    expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  });
  it("automatically freezes each monocular minus-lens endpoint and records raw power plus amplitude after release", async () => {
    const sim = await lesson("minus-lens", false, "guided"); await sim.prepare("OS");
    for (let i = 0; i < 2; i++) {
      if (i) await sim.fit("cover", "sensory-occlude-OD");
      if (!i) await sim.pickup(1, "minus-lens-holder");
      await sim.at(1, [i ? .048 : -.048, 1.4, -.46]);
      expect(sim.boardActionLabels()).toEqual(["GIVE FIRST SUSTAINED BLUR INSTRUCTION"]);
      await sim.action("GIVE FIRST SUSTAINED BLUR INSTRUCTION");
      expect(sim.boardActionLabels()).toEqual(["CONFIRM LINE CLEAR AT 0.00 D"]);
      await sim.action("CONFIRM LINE CLEAR AT 0.00 D");
      expect(sim.boardActionLabels()).toEqual(["PATIENT REPORT · WHAT DO YOU SEE?", "DIAL ADD −0.25 D · ACCESSIBILITY", "DIAL REMOVE 0.25 D · ACCESSIBILITY"]);
      for (let step = 0; step < 16; step++) await sim.action("DIAL ADD −0.25 D · ACCESSIBILITY");
      expect(sim.mirror().ready).toBe(false); await sim.tick(1200); expect(sim.mirror().ready, sim.mirror().status).toBe(true);
      await sim.putDown(1); await sim.step(1 / 72, 12); expect(sim.mirror().ready).toBe(true);
      expect(sim.labels().join(" ")).toContain(`Record ${i ? "OS" : "OD"}`);
      expect(sim.boardActionLabels()).toEqual([]);
      await sim.enter({ power: "-4", amplitude: "6.5" });
      if (i === 0) await sim.pickup(1, "minus-lens-holder");
    }
    expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  });
  it("operates the minus-lens power dial with the free controller while the other hand holds the aperture", async () => {
    const sim = await lesson("minus-lens", false, "guided"); await sim.prepare("OS");
    await sim.pickup(1, "minus-lens-holder"); await sim.at(1, [-.048, 1.4, -.46]);
    await sim.action("GIVE FIRST SUSTAINED BLUR INSTRUCTION"); await sim.action("CONFIRM LINE CLEAR AT 0.00 D");
    const holder = sim.tool("minus-lens-holder");
    const start = holder.localToWorld(new Vector3(.065, .095, .006));
    await sim.at(0, start.toArray() as [number, number, number]); await sim.event(0, "selectstart"); await sim.step();
    const turn = holder.localToWorld(new Vector3(.035, .085, .006));
    await sim.at(0, turn.toArray() as [number, number, number]); await sim.step(1 / 72, 12);
    expect(sim.mirror().status).toMatch(/scale -0\.(25|50|75) D/); expect(sim.haptics[0]).toHaveBeenCalled();
    await sim.event(0, "selectend"); sim.noTest();
  });
  it("requires NRA, restored clear baseline and PRA in order", async () => {
    const sim = await lesson("relative", false, "guided"); await sim.prepare(); await sim.pickup(1, "trial-lens"); await sim.at(1, [0, 1.4, -.46]);
    expect(sim.boardActionLabels()).toEqual(["GIVE CLEAR / SINGLE / SUSTAINED BLUR INSTRUCTION"]);
    expect(sim.mirror().actions).toHaveLength(9);
    await sim.action("GIVE CLEAR / SINGLE / SUSTAINED BLUR INSTRUCTION");
    expect(sim.boardActionLabels()).toEqual(["CONFIRM INITIAL CLEAR AT 0.00 D"]);
    await sim.action("CONFIRM INITIAL CLEAR AT 0.00 D");
    expect(sim.boardActionLabels()).toEqual(["PATIENT REPORT · WHAT DO YOU SEE?", "DIAL +0.25 D · ACCESSIBILITY"]);
    for (let i = 0; i < 8; i++) await sim.action("DIAL +0.25 D · ACCESSIBILITY");
    await sim.tick(1200); expect(sim.mirror().ready).toBe(false);
    expect(sim.boardActionLabels()).toEqual(["DIAL −0.25 D · ACCESSIBILITY"]);
    await sim.action("CONFIRM CLEAR BASELINE AT 0.00 D"); expect(sim.mirror().status).toContain("Remove all plus");
    for (let i = 0; i < 8; i++) await sim.action("DIAL −0.25 D · ACCESSIBILITY");
    expect(sim.boardActionLabels()).toEqual(["CONFIRM CLEAR BASELINE AT 0.00 D"]);
    await sim.action("CONFIRM CLEAR BASELINE AT 0.00 D");
    expect(sim.boardActionLabels()).toEqual(["PATIENT REPORT · WHAT DO YOU SEE?", "DIAL −0.25 D · ACCESSIBILITY"]);
    for (let i = 0; i < 9; i++) {
      await sim.action("DIAL −0.25 D · ACCESSIBILITY");
      expect(sim.labels().join(" ")).toContain("GUIDED STEP 9 / 10 · Measure PRA");
      expect(sim.labels().join(" ")).not.toContain("Return to baseline");
    }
    expect(sim.labels().join(" ")).toContain("Hold the power steady");
    await sim.tick(1200); expect(sim.mirror().ready).toBe(true);
    await sim.putDown(1); await sim.step(1 / 72, 12); expect(sim.mirror().ready).toBe(true);
    expect(sim.labels().join(" ")).toContain("GUIDED STEP 10 / 10 · Record NRA and PRA");
    expect(sim.boardActionLabels()).toEqual([]);
    await sim.enter({ nra: "2", pra: "-2.25" }); expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  });
  it.each(["guided", "test"] as const)("keeps the NRA/PRA dial and rendered scale beyond patient endpoints in %s", async kind => {
    const sim = await lesson("relative", false, kind); await sim.prepare();
    await sim.pickup(1, "trial-lens"); await sim.at(1, [0, 1.4, -.46]);
    expect(sim.labels().join(" ")).not.toContain("+2.00 → 0.00 → −2.25");
    expect(sim.boardActionLabels()).toEqual(["GIVE CLEAR / SINGLE / SUSTAINED BLUR INSTRUCTION"]);
    await sim.action("GIVE CLEAR / SINGLE / SUSTAINED BLUR INSTRUCTION"); await sim.action("CONFIRM INITIAL CLEAR AT 0.00 D");
    expect(sim.boardActionLabels()).toEqual(["PATIENT REPORT · WHAT DO YOU SEE?", "DIAL +0.25 D · ACCESSIBILITY"]);
    for (let i = 0; i < 8; i++) await sim.action("DIAL +0.25 D · ACCESSIBILITY");
    expect(sim.mirror().actions.find(action => action.label === "DIAL +0.25 D · ACCESSIBILITY")?.disabled).toBe(false);
    await sim.action("DIAL +0.25 D · ACCESSIBILITY");
    expect(sim.labels()).toContain("+2.25 D"); expect(sim.mirror().voiceReport).toContain("blurred");
    await sim.tick(1200);
    for (let i = 0; i < 9; i++) await sim.action("DIAL −0.25 D · ACCESSIBILITY");
    await sim.action("CONFIRM CLEAR BASELINE AT 0.00 D");
    for (let i = 0; i < 9; i++) await sim.action("DIAL −0.25 D · ACCESSIBILITY");
    expect(sim.mirror().actions.find(action => action.label === "DIAL −0.25 D · ACCESSIBILITY")?.disabled).toBe(false);
    await sim.action("DIAL −0.25 D · ACCESSIBILITY");
    expect(sim.labels()).toContain("-2.50 D"); expect(sim.mirror().voiceReport).toContain("blurred");
    await sim.tick(1200); expect(sim.mirror().ready).toBe(true);
    await sim.enter({ nra: "2.25", pra: "-2.5" }); expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  });
  it("operates the NRA/PRA power dial with the free controller while the holder remains face-on", async () => {
    const sim = await lesson("relative", false, "guided"); await sim.prepare(); await sim.pickup(1, "trial-lens"); await sim.at(1, [0, 1.4, -.46]);
    await sim.action("GIVE CLEAR / SINGLE / SUSTAINED BLUR INSTRUCTION"); await sim.action("CONFIRM INITIAL CLEAR AT 0.00 D");
    const holder = sim.tool("trial-lens");
    const start = holder.localToWorld(new Vector3(.075, .085, .006));
    await sim.at(0, start.toArray() as [number, number, number]); await sim.event(0, "selectstart"); await sim.step();
    const turn = holder.localToWorld(new Vector3(.045, .075, .006));
    await sim.at(0, turn.toArray() as [number, number, number]); await sim.step(1 / 72, 12);
    expect(sim.mirror().status).toMatch(/scale \+1\.(00|25|50) D/); expect(sim.haptics[0]).toHaveBeenCalled();
    await sim.event(0, "selectend"); sim.noTest();
  });

  it.each(["thorington", "push-up"] as const)("discards cancelled %s captures, invalidates refitting and ignores stale exit submission", async kind => {
    const sim = await lesson(kind);
    if (kind === "thorington") { await sim.fit("subjective"); await sim.fit("maddox", "sensory-maddox-horizontal"); await sim.fit("thorington"); await sim.pickup(1, "pupils"); await sim.at(1, [0, 1.425, .137]); await sim.event(1, "selectstart"); }
    else await sim.prepare("OS");
    const observe = async () => {
      if (kind === "thorington") { await sim.action("ASK NUMBER AND SIDE"); await sim.tick(1); await sim.tick(260); await sim.event(1, "selectend"); await sim.putDown(1); await sim.step(1 / 72, 12); }
      else {
        await sim.action("GIVE FIRST SUSTAINED BLUR INSTRUCTION"); await sim.event(1, "selectstart"); await sim.at(1, [0, 1.545, -.111]); await sim.tick(260);
        for (let cm = 38; cm >= 10; cm -= 2) await sim.at(1, [0, 1.545, -.511 + cm / 100]);
        await sim.tick(500); await sim.event(1, "selectend");
      }
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
    await sim.action("GIVE CLEAR / SINGLE / SUSTAINED BLUR INSTRUCTION"); await sim.action("CONFIRM INITIAL CLEAR AT 0.00 D");
    for (let i = 0; i < 8; i++) await sim.action("DIAL +0.25 D · ACCESSIBILITY"); await sim.tick(1200);
    for (let i = 0; i < 8; i++) await sim.action("DIAL −0.25 D · ACCESSIBILITY"); await sim.action("CONFIRM CLEAR BASELINE AT 0.00 D");
    for (let i = 0; i < 9; i++) await sim.action("DIAL −0.25 D · ACCESSIBILITY"); await sim.tick(1200);
    await sim.putDown(1); await sim.panel(1); await sim.click(1, sim.button("RECORD FINDING"));
    await sim.click(1, sim.button("ENTRY +1 D")); await sim.click(1, sim.button("ENTRY +1 D")); expect(sim.mirror().lesson.entries.nra).toBe("2");
    await sim.click(1, sim.button("NEXT ENTRIES")); await sim.click(1, sim.button("ENTRY −1 D")); await sim.click(1, sim.button("ENTRY −1 D")); await sim.click(1, sim.button("ENTRY −0.25 D"));
    expect(sim.mirror().lesson.entries).toEqual({ nra: "2", pra: "-2.25" }); await sim.click(1, sim.button("SUBMIT / CHECK")); expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  });
  it.each(["maddox", "thorington", "npc", "push-up"] as const)("keeps %s preview and late exit callbacks from awarding completion", async kind => {
    const sim = await lesson(kind, true); await act(async () => sim.mirror().record()); expect(sim.mirror().ready).toBe(false); expect(sim.controls()).toHaveLength(0); await sim.exit(); await sim.event(1, "selectstart"); await act(async () => sim.mirror().record()); expect(sim.complete).not.toHaveBeenCalled(); sim.noTest();
  });
});
