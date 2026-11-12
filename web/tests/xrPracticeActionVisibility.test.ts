import { createElement, type ReactNode } from "react";
import { act } from "@react-three/fiber";
import { afterEach, describe, expect, it, vi } from "vitest";
import { clinic } from "./helpers/xrClinicHarness";
import { PracticeAttemptProvider } from "../practice/PracticeAttemptContext";
import { MotilityPracticeController } from "../practice/xr/MotilityPracticeController";
import { BrucknerPracticeController } from "../practice/xr/BrucknerPracticeController";
import { CoverPracticeController } from "../practice/xr/CoverPracticeController";
import { KrimskyPracticeController } from "../practice/xr/KrimskyPracticeController";
import { WorthPracticeController } from "../practice/xr/WorthPracticeController";
import { StereoPracticeController } from "../practice/xr/StereoPracticeController";
import { FourPrismPracticeController } from "../practice/xr/FourPrismPracticeController";
import { PhoriaPracticeController } from "../practice/xr/PhoriaPracticeController";
import { NPCPracticeController } from "../practice/xr/NPCPracticeController";
import { FusionalVergencePracticeController } from "../practice/xr/FusionalVergencePracticeController";
import { VerticalFusionalVergencePracticeController } from "../practice/xr/VerticalFusionalVergencePracticeController";
import { NearFusionalVergencePracticeController } from "../practice/xr/NearFusionalVergencePracticeController";
import { VergencePracticeController } from "../practice/xr/VergencePracticeController";
import { PushUpPracticeController } from "../practice/xr/PushUpPracticeController";
import { MinusLensPracticeController } from "../practice/xr/MinusLensPracticeController";
import { RelativeAccommodationPracticeController } from "../practice/xr/RelativeAccommodationPracticeController";
import { AccommodationPracticeController } from "../practice/xr/AccommodationPracticeController";
import { PracticeLessonUI, usePracticeLesson, type BatchMirror, type PracticeLesson } from "../practice/xr/PracticeLessonUI";
import { useXRClinicRuntime } from "../interaction/useXRClinicRuntime";

type Common = { active: boolean; onComplete: () => void; onExit: () => void; onMirror: (mirror: BatchMirror) => void };
const lessons: [string, (props: Common) => ReactNode, string[]][] = [
  ["motility", p => createElement(MotilityPracticeController, p), []],
  ["bruckner", p => createElement(BrucknerPracticeController, { ...p, scenario: "equal", onNext: vi.fn() }), []],
  ["cover-uncover", p => createElement(CoverPracticeController, { ...p, kind: "cover-uncover" }), []],
  ["alternate-cover", p => createElement(CoverPracticeController, { ...p, kind: "alternate-cover" }), []],
  ["krimsky", p => createElement(KrimskyPracticeController, p), []],
  ["worth", p => createElement(WorthPracticeController, p), []],
  ["stereo", p => createElement(StereoPracticeController, p), []],
  ["four-prism", p => createElement(FourPrismPracticeController, p), []],
  ["maddox", p => createElement(PhoriaPracticeController, { ...p, kind: "maddox" }), ["FIT CORRECTION"]],
  ["thorington", p => createElement(PhoriaPracticeController, { ...p, kind: "thorington" }), ["FIT NEAR CORRECTION"]],
  ["npc", p => createElement(NPCPracticeController, p), ["FIT NEAR CORRECTION"]],
  ["horizontal-distance", p => createElement(FusionalVergencePracticeController, p), ["FIT DISTANCE CORRECTION"]],
  ["vertical-distance", p => createElement(VerticalFusionalVergencePracticeController, p), ["FIT DISTANCE CORRECTION"]],
  ["horizontal-near", p => createElement(NearFusionalVergencePracticeController, p), ["FIT NEAR CORRECTION"]],
  ["vergence-facility", p => createElement(VergencePracticeController, { ...p, kind: "facility" }), ["FIT NEAR CORRECTION"]],
  ["push-up", p => createElement(PushUpPracticeController, p), ["FIT NEAR CORRECTION"]],
  ["minus-lens", p => createElement(MinusLensPracticeController, p), ["FIT NEAR CORRECTION"]],
  ["relative", p => createElement(RelativeAccommodationPracticeController, p), ["FIT NEAR CORRECTION"]],
  ["accommodative-facility", p => createElement(AccommodationPracticeController, { ...p, kind: "accommodative-facility" }), []],
];
let dispose: (() => Promise<void>) | undefined;
afterEach(async () => { await dispose?.(); dispose = undefined; vi.unstubAllGlobals(); });
const utilities = new Set(["HELP", "RESET", "RESET ATTEMPT", "EXIT", "EXIT VR", "EXIT CLINIC", "CLOSE"]);

describe.each(["guided", "test"] as const)("%s Practice stage actions", kind => {
  it.each(lessons)("%s has no future instruction, report or recording buttons in the initial VR menu", async (_name, render, expected) => {
    let mirror: BatchMirror | undefined;
    const sim = await clinic({ renderAdapter: ({ active }) => createElement(PracticeAttemptProvider, {
      value: { settings: { kind, interaction: "vr", voice: "disabled" }, setSettings: vi.fn() },
      children: render({ active, onComplete: vi.fn(), onExit: vi.fn(), onMirror: next => { mirror = next; } }),
    }) }); dispose = sim.dispose;
    expect(mirror).toBeDefined();
    await act(async () => mirror?.lesson.setMode("menu"));
    const labels: string[] = [];
    sim.state.scene.traverse(root => {
      if (!root.userData.xrObservationEditor) return;
      root.traverse(object => {
        if (object.userData.xrButton && !utilities.has(object.userData.xrLabel)) labels.push(object.userData.xrLabel);
      });
    });
    expect(labels.sort()).toEqual([...expected].sort());
    expect(sim.controls().some(object => object.userData.xrLabel === "SUBMIT")).toBe(false);
  });
});

it("clears procedure buttons at recording/completion and restores them after reset", async () => {
  let ready = false;
  let lesson: PracticeLesson;
  function Adapter({ active }: { active: boolean }) {
    const runtime = useXRClinicRuntime({ active });
    lesson = usePracticeLesson(vi.fn());
    return createElement(PracticeLessonUI, { runtime, active, title: "Visibility", status: "", help: [], tools: [],
      actions: [{ label: "CURRENT STEP", run: vi.fn() }, { label: "FUTURE STEP", visible: false, run: vi.fn() }, { label: "BLOCKED STEP", disabled: true, run: vi.fn() }],
      fields: [{ id: "finding", label: "Finding", choices: [["observed", "Observed"]] }], lesson, ready, entryReady: ready, forceBoardVisible: true,
      onRecord: vi.fn(), onReset: lesson.reset, onExit: vi.fn() });
  }
  const sim = await clinic({ renderAdapter: props => createElement(Adapter, props) }); dispose = sim.dispose;
  expect(sim.button("CURRENT STEP")).toBeDefined();
  expect(sim.controls().some(object => /FUTURE STEP|BLOCKED STEP|SUBMIT|OBSERVED/.test(object.userData.xrLabel))).toBe(false);
  await act(async () => lesson.setMode("settings"));
  ready = true; await sim.rerender();
  await act(async () => { expect(lesson.mode).toBe("none"); });
  expect(sim.button("OBSERVED")).toBeDefined();
  expect(sim.controls().some(object => object.userData.xrLabel === "CURRENT STEP")).toBe(false);
  await act(async () => lesson.submit(true, true, "Recorded"));
  expect(sim.controls().some(object => /CURRENT STEP|OBSERVED|SUBMIT/.test(object.userData.xrLabel))).toBe(false);
  ready = false; await act(async () => lesson.reset()); await sim.rerender();
  expect(sim.button("CURRENT STEP")).toBeDefined();
});
