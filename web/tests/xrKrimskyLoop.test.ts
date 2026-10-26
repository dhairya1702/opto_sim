import { createElement } from "react";
import { act } from "@react-three/fiber";
import { Object3D, Vector3 } from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clinic } from "./helpers/xrClinicHarness";
import { KrimskyPracticeController } from "../practice/xr/KrimskyPracticeController";
import type { BatchMirror } from "../practice/xr/PracticeLessonUI";
import { PRISM_BAR_WORKING_Y, consultationToolDefinition } from "../interaction/xrConsultationTools";
import { krimskyPrismCellY, KRIMSKY_PRISM_POWERS } from "../interaction/xrKrimskyPractice";
import { PracticeAttemptProvider, type PracticeAttemptKind } from "../practice/PracticeAttemptContext";

let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });
async function lesson(attemptKind?: PracticeAttemptKind, krimskyMethod: "standard" | "modified" = "standard") {
  let mirror: BatchMirror;
  const onMirror = (next: BatchMirror) => { mirror = next; };
  const complete = vi.fn(), leave = vi.fn();
  const sim = await clinic({ renderAdapter: ({ active }) => {
    const controller = createElement(KrimskyPracticeController, { active, onComplete: complete, onExit: leave, onMirror });
    return attemptKind ? createElement(PracticeAttemptProvider, {
      value: { settings: { kind: attemptKind, interaction: "vr", voice: "disabled", krimskyMethod }, setSettings: vi.fn() }, children: controller,
    }) : controller;
  } });
  dispose = sim.dispose;
  const action = async (label: string) => {
    const item = mirror!.actions.find(candidate => candidate.label === label);
    if (!item) throw new Error(`Missing mirror action: ${label}`);
    await act(async () => item.run()); await sim.step(1 / 72, 12);
  };
  const reflex = (eye: "OD" | "OS") => {
    let found: { position: Vector3; visible: boolean } | undefined;
    sim.state.scene.traverse(object => { if (object.userData.xrKrimskyReflex === eye) found = object; });
    if (!found) throw new Error(`Missing reflex ${eye}`);
    return found;
  };
  const light = async () => {
    await sim.pickup(0, "pupils"); sim.viewerCamera.position.set(0, 1.5, .65); sim.rays[0].rotation.set(0, 0, 0);
    await sim.at(0, [0, 1.5, .064]); await sim.event(0, "selectstart"); await sim.step(1 / 72, 12);
    await action("LOOK AT THE LIGHT");
    await action("CLOSE RIGHT EYE · LEFT VIEW");
    await sim.step(1 / 72, 72);
  };
  const prismAt = async (eye: "OD" | "OS") => {
    sim.state.scene.updateMatrixWorld(true);
    let aperture: Object3D | undefined;
    sim.tool("prism").traverse(object => { if (object.userData.xrPrismWorkingCell) aperture = object; });
    const localY = aperture ? sim.tool("prism").worldToLocal(aperture.getWorldPosition(new Vector3())).y
      : krimskyPrismCellY(Number(mirror!.status.match(/selected prism (\d+)Δ/)?.[1] ?? 0));
    await sim.at(1, [eye === "OD" ? -.048 : .048, 1.5 - localY, -.481]); await sim.step(1 / 72, 12);
  };
  const setBase = async (base: "BI" | "BO") => {
    sim.axes[1][2] = base === "BI" ? -.8 : .8;
    await sim.step(1 / 72, 6);
    sim.axes[1][2] = 0;
    await sim.step();
  };
  const setPrism = async (base: "BI" | "BO", power: number) => {
    await setBase(base);
    const target = KRIMSKY_PRISM_POWERS.indexOf(power as typeof KRIMSKY_PRISM_POWERS[number]);
    if (target < 0) throw new Error(`Power ${power} is not a prism-bar cell`);
    const currentPower = Number(mirror!.status.match(/selected prism (\d+)Δ/)?.[1] ?? 0);
    const current = KRIMSKY_PRISM_POWERS.indexOf(currentPower as typeof KRIMSKY_PRISM_POWERS[number]);
    const direction = target >= current ? 1 : -1;
    for (let i = 0; i < Math.abs(target - current); i++) await sim.thumbstick(1, direction);
  };
  const compare = async () => { await sim.event(1, "selectstart"); await sim.event(1, "selectend"); await sim.step(1 / 72, 12); };
  const enterPower = async (power: number, controller = 1) => {
    await sim.click(controller, sim.button(`${power}Δ`));
  };
  return { ...sim, mirror: () => mirror!, action, reflex, light, prismAt, setBase, setPrism, compare, enterPower, complete, leave };
}
describe("mounted Krimsky Practice in the shared clinic", () => {
  it("advances the Guided coach through the physical comparison and explicit recording", async () => {
    const sim = await lesson("guided");
    expect(sim.guidedStep()).toBe("tool");
    expect(sim.labels()).toContain("Pick up the penlight");
    await sim.pickup(0, "pupils");
    expect(sim.guidedStep()).toBe("instruct");
    await sim.action("LOOK AT THE LIGHT");
    expect(sim.guidedStep()).toBe("view");
    expect(sim.labels()).toContain("Select the examiner-eye view");
    await sim.action("CLOSE RIGHT EYE · LEFT VIEW");
    expect(sim.guidedStep()).toBe("setup");
    expect(sim.labels()).toContain("Keep the penlight on");
    sim.viewerCamera.position.set(0, 1.5, .65); sim.rays[0].rotation.set(0, 0, 0);
    await sim.at(0, [0, 1.5, .064]); await sim.event(0, "selectstart"); await sim.step(1 / 72, 72);
    expect(sim.guidedStep()).toBe("prism");
    await sim.pickup(1, "prism");
    expect(sim.guidedStep()).toBe("neutralise");
    expect(sim.labels()).toContain("Align the selected prism cell");
    await sim.prismAt("OS");
    expect(sim.labels()).toContain("Select the prism direction");
    expect(sim.labels().join(" ")).toContain("thumbstick left selects BI; right selects BO.");
    await sim.setPrism("BI", 20);
    expect(sim.mirror().status).toContain("Reflexes match");
    expect(sim.guidedStep()).toBe("capture");
    expect(sim.labels()).toContain("Capture the comparison");
    await sim.compare();
    expect(sim.guidedStep()).toBe("record");
    expect(sim.labels()).toContain("Record power and base");
    await sim.event(0, "selectend"); await sim.putDown(1); await sim.putDown(0);
    await sim.panel(1); await sim.click(1, sim.button("OBSERVATION"));
    expect(sim.labels()).toContain("Prism power");
    expect(KRIMSKY_PRISM_POWERS.every(power => sim.labels().includes(`${power}Δ`))).toBe(true);
    expect(sim.labels().some(label => label.startsWith("ENTRY +") || label.startsWith("ENTRY −"))).toBe(false);
    await sim.enterPower(20); await sim.click(1, sim.button("BASE IN · BI")); await sim.click(1, sim.button("SUBMIT"));
    expect(sim.complete).toHaveBeenCalledTimes(1);
    expect(sim.labels()).toContain("Technique complete");
  });

  it("does not show the Krimsky coach during independent Test", async () => {
    const sim = await lesson("test");
    expect(sim.guidedStep()).toBeUndefined();
  });

  it("changes examiner-eye state without adding a synthetic ocular view", async () => {
    const sim = await lesson(); await sim.light();
    const monocularViews = () => {
      const views: string[] = [];
      sim.state.scene.traverse(object => { if (object.userData.xrKrimskyMonocularView) views.push(object.userData.xrKrimskyMonocularView); });
      return views;
    };
    expect(monocularViews()).toEqual([]);
    await sim.action("CLOSE LEFT EYE · RIGHT VIEW"); expect(monocularViews()).toEqual([]);
    await sim.action("OPEN BOTH EYES"); expect(monocularViews()).toEqual([]);
    await sim.action("CLOSE RIGHT EYE · LEFT VIEW"); await sim.step(1 / 72, 72);
  });
  it("uses the prism-hand thumbstick to move one physical cell per gesture with haptics", async () => {
    const sim = await lesson(); await sim.light();
    await sim.thumbstick(0, 1);
    expect(sim.haptics[0]).not.toHaveBeenCalled();
    await sim.pickup(1, "prism"); sim.haptics[1].mockClear();
    sim.axes[1][2] = -.8; await sim.step(1 / 72, 6);
    expect(sim.mirror().status).toContain("selected prism 0Δ BI");
    expect(sim.labels()).toContain("← BASE IN · BI");
    expect(sim.haptics[1]).toHaveBeenCalledTimes(1);
    await sim.step(1 / 72, 6); expect(sim.haptics[1]).toHaveBeenCalledTimes(1);
    sim.axes[1][2] = 0; await sim.step();
    sim.axes[1][2] = .8; await sim.step(1 / 72, 6);
    expect(sim.mirror().status).toContain("selected prism 0Δ BO");
    expect(sim.labels()).toContain("BASE OUT · BO →");
    sim.axes[1][2] = 0; await sim.step(); await sim.setBase("BI");
    sim.axes[1][3] = -.8; await sim.step(1 / 72, 6);
    expect(sim.mirror().status).toContain("selected prism 5Δ BI");
    expect(sim.haptics[1]).toHaveBeenCalledTimes(4);
    sim.axes[1][3] = 0; await sim.step();
    sim.state.scene.updateMatrixWorld(true);
    const selected: number[] = [];
    sim.tool("prism").traverse(object => { if (object.userData.xrPrismCellSelected) selected.push(object.userData.xrPrismCell); });
    expect(selected).toEqual([1]);
  });
  it("soft-locks the aperture, slides the bar behind it, and releases when the prism moves away", async () => {
    const sim = await lesson(); await sim.light(); await sim.pickup(1, "prism");
    const part = (key: "xrPrismWorkingCell" | "xrPrismSlidingBar" | "xrPrismReflexWindow") => {
      let found: Object3D | undefined;
      sim.tool("prism").traverse(object => { if (object.userData[key]) found = object; });
      return found;
    };
    sim.haptics[1].mockClear();
    await sim.prismAt("OS");
    const alignedAperture = part("xrPrismWorkingCell");
    expect(alignedAperture?.userData.xrPrismAligned).toBe(true);
    expect(alignedAperture?.position.y).toBe(PRISM_BAR_WORKING_Y);
    expect(sim.haptics[1]).toHaveBeenCalledTimes(1);
    await sim.step(1 / 72, 12);
    expect(sim.haptics[1]).toHaveBeenCalledTimes(1);

    const apertureBefore = part("xrPrismWorkingCell")!.getWorldPosition(new Vector3());
    const barBefore = part("xrPrismSlidingBar")!.position.y;
    await sim.setPrism("BI", 40);
    const apertureAfter = part("xrPrismWorkingCell")!.getWorldPosition(new Vector3());
    expect(apertureAfter.distanceTo(apertureBefore)).toBeLessThan(.0001);
    expect(part("xrPrismSlidingBar")!.position.y).toBeLessThan(barBefore);
    expect(part("xrPrismReflexWindow")).toBeUndefined();

    await sim.at(1, [.35, 1.2, -.481]); await sim.step(1 / 72, 12);
    const releasedAperture = part("xrPrismWorkingCell");
    expect(releasedAperture?.userData.xrPrismAligned).toBe(false);
    expect(releasedAperture?.position.y).toBe(PRISM_BAR_WORKING_Y);
    expect(part("xrPrismReflexWindow")).toBeUndefined();
  });
  it("standard Krimsky moves visible reflexes, captures with the prism trigger and permits independent recording after release", async () => {
    const sim = await lesson(); await sim.light();
    const baseline = sim.reflex("OS").position.x;
    expect(baseline).toBeLessThan(.048); expect(sim.mirror().ready).toBe(false);
    await sim.pickup(1, "prism"); await sim.setPrism("BI", 10); await sim.prismAt("OS");
    const under = sim.reflex("OS").position.x;
    expect(under).toBeGreaterThan(baseline); expect(under).toBeLessThan(.048);
    await sim.compare(); expect(sim.mirror().ready).toBe(false);
    await sim.setPrism("BO", 20); await sim.prismAt("OS"); expect(sim.reflex("OS").position.x).toBeLessThan(baseline);
    await sim.compare(); expect(sim.mirror().ready).toBe(false);
    await sim.setPrism("BI", 25); await sim.prismAt("OS"); expect(sim.reflex("OS").position.x).toBeGreaterThan(.048);
    await sim.setPrism("BI", 20); await sim.prismAt("OS"); expect(sim.reflex("OS").position.x).toBeCloseTo(.048, 5);
    expect(sim.mirror().ready).toBe(false); // Matching alone records/captures nothing.
    await sim.compare(); expect(sim.mirror().ready).toBe(true); expect(sim.complete).not.toHaveBeenCalled();
    await sim.event(0, "selectend"); await sim.at(1, [.3, 1.2, .1]); await sim.putDown(1); await sim.putDown(0); await sim.step(1 / 72, 12);
    expect(sim.mirror().ready).toBe(true);
    await sim.panel(1); await sim.click(1, sim.button("OBSERVATION")); expect(sim.mirror().lesson.entries.power).toBeUndefined();
    await sim.click(1, sim.button("SUBMIT")); expect(sim.complete).not.toHaveBeenCalled();
    await sim.enterPower(20); await sim.click(1, sim.button("SUBMIT"));
    expect(sim.complete).not.toHaveBeenCalled(); // Power alone is incomplete.
    await sim.click(1, sim.button("BASE OUT · BO")); await sim.click(1, sim.button("SUBMIT"));
    expect(sim.complete).not.toHaveBeenCalled(); // Correct power with the wrong base is incorrect.
    await sim.enterPower(15); await sim.click(1, sim.button("BASE IN · BI")); await sim.click(1, sim.button("SUBMIT"));
    expect(sim.complete).not.toHaveBeenCalled(); expect(sim.mirror().lesson.feedback).toContain("Record both the prism power");
    await sim.enterPower(20); await sim.click(1, sim.button("BASE IN · BI")); await sim.click(1, sim.button("SUBMIT"));
    expect(sim.complete).toHaveBeenCalledTimes(1); expect(sim.mirror().lesson.feedback).toContain("20Δ BI, prism before OS");
    sim.mirror().record(); expect(sim.complete).toHaveBeenCalledTimes(1);
    expect(sim.record).not.toHaveBeenCalled(); expect(sim.encounter().results).toHaveLength(0);
  });
  it.each(["standard", "modified"] as const)("preserves selected %s method through both findings and wraparound", async method => {
    const sim = await lesson("guided", method);
    for (const [base, power] of [["BI", 20], ["BO", 15], ["BI", 20]] as const) {
      const eye = method === "standard" ? "OS" : "OD";
      const wrongEye = eye === "OS" ? "OD" : "OS";
      await sim.light();
      await sim.pickup(1, "prism"); await sim.setPrism(base, power); await sim.prismAt(wrongEye);
      expect(sim.reflex("OS").position.x).not.toBeCloseTo(.048, 5);
      await sim.compare(); expect(sim.mirror().ready).toBe(false);
      await sim.prismAt(eye); expect(sim.reflex("OS").position.x).toBeCloseTo(.048, 5);
      if (power === 15) { await sim.action("PRISM CELL DOWN"); await sim.prismAt(eye); expect(sim.reflex("OS").position.x).not.toBe(.048); await sim.action("PRISM CELL UP"); await sim.prismAt(eye); }
      await sim.compare(); expect(sim.mirror().ready).toBe(true);
      await sim.panel(1); await sim.click(1, sim.button("OBSERVATION")); await sim.enterPower(power); await sim.click(1, sim.button(base === "BI" ? "BASE IN · BI" : "BASE OUT · BO"));
      await sim.click(1, sim.button("SUBMIT")); expect(sim.mirror().lesson.feedback).toContain(`${method === "modified" ? "Modified Krimsky" : "Krimsky"}: ${power}Δ ${base}, prism before ${eye}`);
      await sim.click(1, sim.button("NEW PATIENT FINDING"));
      expect(sim.mirror().ready).toBe(false); expect(sim.mirror().lesson.entries).toEqual({});
      await sim.event(0, "selectend"); await sim.putDown(0); await sim.putDown(1);
    }
    expect(sim.complete).toHaveBeenCalledTimes(3); expect(sim.record).not.toHaveBeenCalled();
  });
  it("requires the penlight and physically held prism without any timed baseline gate", async () => {
    const sim = await lesson(); await sim.pickup(0, "objective"); await sim.at(0, [0, 1.33, -.041]); await sim.event(0, "selectstart");
    await sim.action("LOOK AT THE LIGHT"); await sim.action("CLOSE RIGHT EYE · LEFT VIEW"); await sim.step(1 / 72, 72);
    expect(sim.mirror().ready).toBe(false); expect(sim.mirror().status).toContain("Pick up the penlight");
    await sim.event(0, "selectend"); await sim.at(0, consultationToolDefinition("objective").home); await sim.putDown(0);
    await sim.pickup(0, "pupils"); sim.viewerCamera.position.set(0, 1.5, .65); await sim.at(0, [0, 1.5, .064]); await sim.event(0, "selectstart"); await sim.step(1 / 72, 72);
    expect(sim.mirror().status).toContain("Observe the initial reflex positions, then pick up the prism bar");
    await sim.pickup(1, "prism"); await sim.setPrism("BI", 20); await sim.prismAt("OS");
    sim.rays[1].rotation.y = Math.PI / 2; await sim.step(1 / 72, 12); await sim.compare(); expect(sim.mirror().ready).toBe(false);
    sim.rays[1].rotation.y = 0; await sim.prismAt("OD"); await sim.compare(); expect(sim.mirror().ready).toBe(false);
    await sim.prismAt("OS"); await sim.compare(); expect(sim.mirror().ready).toBe(true);
  });
  it("uses live physical readiness without a timed recapture and clears completed comparisons on parameter changes", async () => {
    const sim = await lesson(); await sim.light(); await sim.pickup(1, "prism"); await sim.setPrism("BI", 20); await sim.prismAt("OS");
    await sim.at(0, [0, 1.5, .264]); await sim.step(1 / 72, 12); await sim.compare(); expect(sim.mirror().ready).toBe(false);
    await sim.at(0, [0, 1.5, .064]); await sim.step(1 / 72, 12); await sim.prismAt("OS");
    await sim.event(0, "selectend"); await sim.step(1 / 72, 12); await sim.compare(); expect(sim.mirror().ready).toBe(false);
    await sim.event(0, "selectstart"); await sim.step(1 / 72, 12); await sim.compare(); expect(sim.mirror().ready).toBe(true);
    await sim.action("PRISM CELL UP"); expect(sim.mirror().ready).toBe(false); expect(sim.mirror().lesson.entries).toEqual({});
    await sim.action("PRISM CELL DOWN"); await sim.prismAt("OS");
    sim.tracked[0] = false; await sim.step(1 / 72, 12);
    await sim.compare(); expect(sim.mirror().ready).toBe(false);
    sim.tracked[0] = true; await sim.event(0, "selectend"); await sim.at(0, [0, 1.5, .064]); await sim.event(0, "selectstart"); await sim.step(1 / 72, 12);
    await sim.compare(); expect(sim.mirror().ready).toBe(true);
    await sim.action("BASE OUT · BO"); expect(sim.mirror().ready).toBe(false); expect(sim.mirror().lesson.entries).toEqual({});
    expect(sim.complete).not.toHaveBeenCalled();
  });
  it("cancel discards comparison without completion, reset recalls tools and exit ignores late actions", async () => {
    const sim = await lesson(); await sim.light(); await sim.pickup(1, "prism"); await sim.setPrism("BI", 20); await sim.prismAt("OS"); await sim.compare();
    await sim.panel(1); await sim.click(1, sim.button("OBSERVATION")); await sim.enterPower(20); await sim.click(1, sim.button("CANCEL"));
    expect(sim.mirror().ready).toBe(false); expect(sim.mirror().lesson.entries).toEqual({}); expect(sim.complete).not.toHaveBeenCalled();
    await act(async () => sim.mirror().reset()); await sim.step(1 / 72, 12);
    expect(sim.tool("prism").position.toArray()).toEqual(consultationToolDefinition("prism").home);
    expect(sim.tool("pupils").getObjectByProperty("type", "SpotLight")).toBeUndefined();
    await sim.panel(1); await sim.click(1, sim.button("EXIT VR")); expect(sim.leave).toHaveBeenCalledTimes(1);
    await sim.exit(); await sim.event(1, "selectstart"); sim.mirror().record(); expect(sim.complete).not.toHaveBeenCalled();
  });
  it("rejects a saved recording callback during visibility loss and after a session ends, even before the parent exits", async () => {
    const sim = await lesson(); await sim.light(); await sim.pickup(1, "prism"); await sim.setPrism("BI", 20); await sim.prismAt("OS"); await sim.compare();
    await act(async () => { sim.mirror().lesson.choose("power", "20"); sim.mirror().lesson.choose("base", "BI"); });
    const savedRecord = sim.mirror().record;
    sim.session.visibilityState = "hidden";
    await act(async () => { sim.session.dispatchEvent(new Event("visibilitychange")); savedRecord(); });
    expect(sim.complete).not.toHaveBeenCalled();
    sim.session.visibilityState = "visible"; await sim.step();
    await act(async () => sim.session.dispatchEvent(new Event("end")));
    await sim.rerender(); await sim.step(1 / 72, 12);
    await act(async () => savedRecord()); expect(sim.complete).not.toHaveBeenCalled();
  });
});
