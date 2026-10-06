import { createElement } from "react";
import { act } from "@react-three/fiber";
import { Quaternion, Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clinic } from "./helpers/xrClinicHarness";
import { PhoriaPracticeController } from "../practice/xr/PhoriaPracticeController";
import { VergencePracticeController } from "../practice/xr/VergencePracticeController";
import { AccommodationPracticeController } from "../practice/xr/AccommodationPracticeController";
import type { BatchMirror } from "../practice/xr/PracticeLessonUI";
import { librarySockets, type LibraryKind } from "../interaction/xrLibraryEquipment";
import { consultationToolDefinition, type ConsultationToolId } from "../interaction/xrConsultationTools";
import { maddoxTrials } from "../interaction/maddoxPractice";
import { vergenceFindings } from "../interaction/vergencePractice";
import { npcPhases } from "../interaction/xrVergencePractice";
let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); });
async function lesson(kind: LibraryKind, preview = false) {
  let mirror: BatchMirror; let now = 0; vi.spyOn(performance, "now").mockImplementation(() => now);
  const complete = vi.fn(), leave = vi.fn();
  const sim = await clinic({ renderAdapter: ({ active }) => {
    const common = { active, preview, onComplete: complete, onExit: leave, onMirror: (next: BatchMirror) => { mirror = next; } };
    return kind === "maddox" || kind === "thorington" ? createElement(PhoriaPracticeController, { ...common, kind }) : kind === "push-up" || kind === "minus-lens" || kind === "relative" || kind === "accommodative-facility" ? createElement(AccommodationPracticeController, { ...common, kind }) : createElement(VergencePracticeController, { ...common, kind });
  } }); dispose = sim.dispose;
  const action = async (label: string) => { const item = mirror!.actions.find(a => a.label === label); if (!item) throw new Error(`Missing ${label}: ${mirror!.actions.map(a => a.label).join(", ")}`); await act(async () => item.run()); await sim.step(1 / 72, 12); };
  const fit = async (id: ConsultationToolId, socketId?: string) => { const socket = librarySockets(kind).find(s => s.tool === id && (!socketId || s.id === socketId))!; await sim.pickup(0, id); sim.grips[0].quaternion.copy(new Quaternion(...socket.rotation).multiply(new Quaternion(...consultationToolDefinition(id).gripRotation).invert())); await sim.at(0, socket.position); await sim.event(0, "squeezeend"); await sim.step(1 / 72, 12); sim.grips[0].quaternion.identity(); };
  const enter = async (values: Record<string, string>) => { await act(async () => { for (const [id, value] of Object.entries(values)) mirror!.lesson.choose(id, value); }); await act(async () => mirror!.record()); await sim.step(1 / 72, 12); };
  const tick = async (ms: number) => { now += ms; await sim.step(1 / 72, 12); };
  const settle = () => sim.step(1 / 72, 90);
  const prepare = async (cover?: "OD" | "OS") => { await fit("subjective"); if (cover) await fit("cover", `sensory-occlude-${cover}`); if (["horizontal-near", "facility", "minus-lens", "relative", "accommodative-facility"].includes(kind)) await fit("near"); await action("ESTABLISH FIXATION"); };
  const noTest = () => { expect(sim.record).not.toHaveBeenCalled(); expect(sim.encounter().results).toHaveLength(0); };
  return { ...sim, mirror: () => mirror!, complete, leave, action, fit, enter, tick, settle, prepare, noTest };
}
describe("mounted remaining shared-clinic XR modules", () => {
  it("completes all four Maddox trials with physical distance/near target, starting prism and independent recording", async () => {
    const sim = await lesson("maddox"); await sim.fit("subjective"); await sim.fit("maddox"); await sim.fit("worth", "sensory-worth-distance"); await sim.action("SWITCH LIGHT ON"); await sim.pickup(1, "prism"); await sim.at(1, [-.048, 1.357, -.481]);
    for (let i = 0; i < 4; i++) {
      const trial = maddoxTrials[i]; if (i === 2) await sim.fit("worth", "sensory-worth-near");
      await sim.action("FIXATE THE LIGHT"); await sim.action(trial.axis === "horizontal" ? "HORIZONTAL GROOVES" : "VERTICAL GROOVES"); await sim.action(`BASE ${trial.base}`); await sim.action("INTRODUCE 20Δ / BEGIN");
      for (let j = 20; j > trial.neutral; j--) await sim.action("PRISM −1Δ"); await sim.action("CAPTURE COINCIDENCE"); expect(sim.mirror().ready).toBe(true); expect(sim.mirror().lesson.entries).toEqual({});
      await sim.enter({ power: "" }); expect(sim.complete).not.toHaveBeenCalled(); await sim.enter({ power: String(trial.neutral) });
    }
    expect(sim.complete).toHaveBeenCalledTimes(1); await act(async () => sim.mirror().record()); expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  });
  it("captures Thorington through the physical centre hole and records both axes after release", async () => {
    const sim = await lesson("thorington"); await sim.fit("subjective"); await sim.fit("maddox"); await sim.fit("thorington"); await sim.pickup(1, "pupils"); await sim.at(1, [0, 1.425, .137]); await sim.event(1, "selectstart");
    for (let i = 0; i < 2; i++) {
      await sim.action("FIXATE THE LIGHT"); await sim.action(i ? "VERTICAL GROOVES" : "HORIZONTAL GROOVES"); await sim.action("ASK NUMBER / STREAK POSITION"); expect(sim.mirror().ready).toBe(true);
      await sim.enter({ power: i ? "4" : "6", direction: i ? "left-hyperphoria" : "esophoria" });
    }
    expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  });
  it("requires Maddox to restart the 20Δ trial after a between-frame light or visibility interruption", async () => {
    const sim = await lesson("maddox"); await sim.fit("subjective"); await sim.fit("maddox"); await sim.fit("worth", "sensory-worth-distance"); await sim.action("SWITCH LIGHT ON"); await sim.pickup(1, "prism"); await sim.at(1, [-.048, 1.357, -.481]);
    await sim.action("FIXATE THE LIGHT"); await sim.action("HORIZONTAL GROOVES"); await sim.action("BASE BI"); await sim.action("INTRODUCE 20Δ / BEGIN");
    await sim.action("PRISM −1Δ");
    // Exercise callbacks without a frame between off and on.
    const off = sim.mirror().actions.find(action => action.label === "SWITCH LIGHT OFF")!;
    await act(async () => { off.run(); off.run(); }); await sim.step(1 / 72, 12);
    expect(sim.mirror().actions.find(action => action.label === "INTRODUCE 20Δ / BEGIN")?.disabled).toBe(false);
    await sim.action("INTRODUCE 20Δ / BEGIN"); await sim.action("PRISM −1Δ");
    sim.session.visibilityState = "hidden";
    await act(async () => sim.session.dispatchEvent(new Event("visibilitychange")));
    sim.session.visibilityState = "visible"; await sim.step(1 / 72, 12);
    expect(sim.mirror().actions.find(action => action.label === "INTRODUCE 20Δ / BEGIN")?.disabled).toBe(false);
    await sim.action("CAPTURE COINCIDENCE"); expect(sim.mirror().ready).toBe(false); expect(sim.complete).not.toHaveBeenCalled();
    await sim.action("INTRODUCE 20Δ / BEGIN"); await sim.action("PRISM −1Δ");
    let pad: typeof sim.state.scene | undefined;
    sim.state.scene.traverse(object => { if (object.userData.xrTeleport?.[2] === .25) pad = object as typeof sim.state.scene; });
    expect(pad).toBeDefined();
    sim.rays[0].position.copy(pad!.getWorldPosition(new Vector3())).y += .6;
    sim.rays[0].rotation.set(-Math.PI / 2, 0, 0);
    const offsets = sim.referenceOffsets.length;
    await sim.event(0, "selectstart"); await sim.event(0, "selectend");
    expect(sim.referenceOffsets).toHaveLength(offsets + 1);
    await sim.step(1 / 72, 12);
    expect(sim.mirror().actions.find(action => action.label === "INTRODUCE 20Δ / BEGIN")?.disabled).toBe(false);
  });
  it.each(["horizontal-distance", "vertical-distance", "horizontal-near"] as const)("records both bases of %s only after ordered physical endpoints", async kind => {
    const sim = await lesson(kind); await sim.prepare(); await sim.pickup(1, "prism"); await sim.at(1, [-.048, 1.357, -.481]);
    for (const [base, finding] of Object.entries(vergenceFindings[kind])) {
      await sim.action(`BASE ${base}`); let power = 0;
      for (const endpoint of [finding.blur, finding.break, finding.recovery]) { if (endpoint === null) continue; while (power !== endpoint) { await sim.action(`PRISM ${power < endpoint ? "+" : "−"}1Δ`); power += power < endpoint ? 1 : -1; } await sim.action("MARK PATIENT ENDPOINT"); }
      expect(sim.mirror().ready).toBe(true); const values = Object.fromEntries(Object.entries(finding).filter(([, v]) => v !== null).map(([k, v]) => [k, String(v)])); await sim.enter(values);
    }
    expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  });
  it("records actual NPC samples in order with a physical target and decimal headset entries", async () => {
    const sim = await lesson("npc"); await sim.prepare(); await sim.pickup(1, "fixation");
    await sim.at(1, [0, 1.4, -.511 + .06]); await sim.action("MARK PATIENT ENDPOINT"); expect(sim.mirror().ready).toBe(false);
    await sim.at(1, [0, 1.4, -.111]); await sim.step(1 / 72, 12);
    for (const cm of [5.8, 4.9, 8.3, 9.2]) { await sim.at(1, [0, 1.4, -.511 + cm / 100]); await sim.action("MARK PATIENT ENDPOINT"); }
    expect(sim.mirror().ready).toBe(true); await sim.event(1, "squeezeend"); await sim.panel(1); await sim.click(1, sim.button("RECORD FINDING"));
    expect(sim.controls().some(b => b.userData.xrLabel === "ENTRY +0.1 cm")).toBe(true); expect(sim.controls().some(b => b.userData.xrLabel === "NEXT ENTRIES")).toBe(true);
    await sim.enter(Object.fromEntries(npcPhases.map((id, i) => [id, String([5.8, 4.9, 8.3, 9.2][i])]))); expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  });
  it.each(["facility", "accommodative-facility"] as const)("times %s with full pairs, invalidation, release recording and all required eyes", async kind => {
    const sim = await lesson(kind); await sim.prepare(kind === "accommodative-facility" ? "OS" : undefined);
    const tool = kind === "facility" ? "prism-flipper" : "lens-flipper", flip = kind === "facility" ? "CLEAR + SINGLE / FLIP" : "CLEAR / FLIP ±2 D";
    for (let eye = 0; eye < (kind === "facility" ? 1 : 3); eye++) {
      if (eye === 1) await sim.fit("cover", "sensory-occlude-OD"); if (eye === 2) { await sim.pickup(0, "cover"); await sim.at(0, [-1.31, .9775, .59]); await sim.event(0, "squeezeend"); }
      await sim.pickup(1, tool); await sim.at(1, [0, 1.4, -.46]); await sim.action("START 60-SECOND RUN"); await sim.action(flip); expect(sim.mirror().status).toContain("0 cycles");
      await sim.tick(kind === "facility" ? 850 : 1500); await sim.action(flip); await sim.tick(kind === "facility" ? 650 : 1800); await sim.action(flip); expect(sim.mirror().status).toContain("1 cycles");
      if (eye === 0) { sim.tracked[1] = false; await sim.step(); sim.tracked[1] = true; await sim.step(1 / 72, 12); expect(sim.mirror().status).toContain("0 cycles"); await sim.action("START 60-SECOND RUN"); }
      await sim.tick(60000); expect(sim.mirror().ready).toBe(true); await sim.event(1, "squeezeend"); await sim.step(1 / 72, 12); expect(sim.mirror().ready).toBe(true); await sim.enter({ cycles: eye === 0 ? "0" : "1" });
    }
    expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  });
  it("completes push-up OD, OS and OU with fitted occlusion and independently calculated amplitudes", async () => {
    const sim = await lesson("push-up"); await sim.prepare("OS"); await sim.pickup(1, "fixation");
    for (let i = 0; i < 3; i++) {
      if (i === 1) await sim.fit("cover", "sensory-occlude-OD"); if (i === 2) { await sim.pickup(0, "cover"); await sim.at(0, [-1.31, .9775, .59]); await sim.event(0, "squeezeend"); }
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
      await sim.event(1, "squeezeend"); await sim.step(1 / 72, 12); expect(sim.mirror().ready).toBe(true); await sim.enter({ amplitude: "6.5" });
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

  it.each(["thorington", "npc", "push-up"] as const)("discards cancelled %s captures, invalidates refitting and ignores stale exit submission", async kind => {
    const sim = await lesson(kind);
    if (kind === "thorington") { await sim.fit("subjective"); await sim.fit("maddox"); await sim.fit("thorington"); await sim.pickup(1, "pupils"); await sim.at(1, [0, 1.425, .137]); await sim.event(1, "selectstart"); await sim.action("FIXATE THE LIGHT"); await sim.action("HORIZONTAL GROOVES"); }
    else { await sim.prepare(kind === "push-up" ? "OS" : undefined); await sim.pickup(1, "fixation"); }
    const observe = async () => {
      if (kind === "thorington") await sim.action("ASK NUMBER / STREAK POSITION");
      else { await sim.at(1, [0, 1.4, -.111]); await sim.step(1 / 72, 12); for (const cm of kind === "npc" ? [6, 5, 8, 9] : [10]) { await sim.at(1, [0, 1.4, -.511 + cm / 100]); await sim.action(kind === "npc" ? "MARK PATIENT ENDPOINT" : "MARK SUSTAINED BLUR"); } }
    };
    await observe(); expect(sim.mirror().ready).toBe(true);
    await act(async () => sim.mirror().cancel?.()); await sim.step(1 / 72, 12); expect(sim.mirror().ready).toBe(false); expect(sim.complete).not.toHaveBeenCalled();
    await observe(); expect(sim.mirror().ready).toBe(true);
    await sim.pickup(0, "subjective"); await sim.step(1 / 72, 12); expect(sim.mirror().ready).toBe(false);
    await act(async () => sim.mirror().record()); expect(sim.complete).not.toHaveBeenCalled(); await sim.event(0, "squeezeend"); await sim.fit("subjective");
    await observe(); expect(sim.mirror().ready).toBe(true); const late = sim.mirror().record;
    await sim.exit(); await act(async () => late()); expect(sim.complete).not.toHaveBeenCalled(); sim.noTest();
  });
  it("preserves Thorington capture when light is released, then refuses a changed rod setup", async () => {
    const sim = await lesson("thorington"); await sim.fit("subjective"); await sim.fit("maddox"); await sim.fit("thorington"); await sim.pickup(1, "pupils"); await sim.at(1, [0, 1.425, .137]); await sim.event(1, "selectstart"); await sim.action("FIXATE THE LIGHT"); await sim.action("HORIZONTAL GROOVES"); await sim.action("ASK NUMBER / STREAK POSITION");
    await sim.event(1, "selectend"); await sim.event(1, "squeezeend"); await sim.step(1 / 72, 12); expect(sim.mirror().ready).toBe(true);
    await sim.enter({ power: "5", direction: "esophoria" }); expect(sim.mirror().lesson.feedback).toContain("Read the captured"); expect(sim.mirror().findingPosition?.current).toBe(1);
    await sim.action("VERTICAL GROOVES"); expect(sim.mirror().ready).toBe(false); expect(sim.mirror().lesson.entries).toEqual({}); sim.noTest();
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
    await sim.event(1, "squeezeend"); await sim.panel(1); await sim.click(1, sim.button("RECORD FINDING"));
    await sim.click(1, sim.button("ENTRY +1 D")); await sim.click(1, sim.button("ENTRY +1 D")); expect(sim.mirror().lesson.entries.nra).toBe("2");
    await sim.click(1, sim.button("NEXT ENTRIES")); await sim.click(1, sim.button("ENTRY −1 D")); await sim.click(1, sim.button("ENTRY −1 D")); await sim.click(1, sim.button("ENTRY −0.25 D"));
    expect(sim.mirror().lesson.entries).toEqual({ nra: "2", pra: "-2.25" }); await sim.click(1, sim.button("SUBMIT / CHECK")); expect(sim.complete).toHaveBeenCalledTimes(1); sim.noTest();
  });
  it.each(["maddox", "npc", "push-up"] as const)("keeps %s preview and late exit callbacks from awarding completion", async kind => {
    const sim = await lesson(kind, true); await act(async () => sim.mirror().record()); expect(sim.mirror().ready).toBe(false); expect(sim.controls()).toHaveLength(0); await sim.exit(); await sim.event(1, "selectstart"); await act(async () => sim.mirror().record()); expect(sim.complete).not.toHaveBeenCalled(); sim.noTest();
  });
});
