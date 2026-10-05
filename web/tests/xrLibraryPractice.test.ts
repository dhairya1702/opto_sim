import { describe, expect, it } from "vitest";
import { capturePhoria, phoriaSubmission } from "../interaction/xrPhoriaPractice";
import { maddoxTrials } from "../interaction/maddoxPractice";
import { newNPCRun, markNPCEndpoint, npcPhases, newVergenceRun, markVergenceEndpoint, vergenceBases, newVergenceFacility, flipVergenceFacility, freezeVergenceCapture, numericCaptureSubmission } from "../interaction/xrVergencePractice";
import { vergenceFindings } from "../interaction/vergencePractice";
import { accommodationEyes, pushUpEndpoint, minusLensEndpoint, newAccommodationFacility, flipAccommodationFacility } from "../interaction/xrAccommodationPractice";
import { libraryDistance, libraryOpticPlacement, libraryNear, libraryOcclusion, libraryLightThroughCard, libraryEquipment, librarySockets, LIBRARY_TITLES } from "../interaction/xrLibraryEquipment";
import { initialConsultationTools, grabConsultationTool, releaseConsultationTool } from "../interaction/xrConsultationTools";
import { SENSORY_NEAR_TARGET } from "../interaction/xrSensoryEquipment";
describe("remaining XR library sequences and geometry", () => {
  it("requires starting prism and valid axes for all four Maddox measurements; entries remain independent", () => {
    maddoxTrials.forEach((trial, i) => {
      const input = { kind: "maddox" as const, trial: i, pattern: 0, ready: true, started: true, power: trial.neutral, base: trial.base, angle: trial.axis === "horizontal" ? 0 : 90, distanceCm: trial.site === "near" ? 40 : 600, generation: 0, setup: "fitted" };
      const capture = capturePhoria(input); expect(capture?.power).toBe(trial.neutral); expect(Object.isFrozen(capture)).toBe(true);
      for (const change of [{ ready: false }, { started: false }, { power: 20 }, { angle: 45 }, { base: "BO" }]) expect(capturePhoria({ ...input, ...change })).toBeNull();
      expect(phoriaSubmission(capture, "", undefined, "maddox")).toBeNull(); expect(phoriaSubmission(capture, "20", undefined, "maddox")).toBe(false); expect(phoriaSubmission(capture, String(trial.neutral), undefined, "maddox")).toBe(true);
    });
  });
  it("records both Thorington axes and authored pattern directions", () => {
    for (let pattern = 0; pattern < 2; pattern++) for (let trial = 0; trial < 2; trial++) {
      const capture = capturePhoria({ kind: "thorington", trial, pattern, ready: true, started: false, power: 0, base: "", angle: trial ? 90 : 0, distanceCm: 40, generation: 1, setup: "fit" });
      expect(capture).not.toBeNull(); expect(phoriaSubmission(capture, String(capture!.power), "orthophoria", "thorington")).toBe(false); expect(phoriaSubmission(capture, String(capture!.power), capture!.direction, "thorington")).toBe(true);
    }
  });
  it("orders blur, break and recovery for every prism condition", () => {
    for (const kind of ["horizontal-distance", "vertical-distance", "horizontal-near"] as const) for (const base of vergenceBases(kind)) {
      let run = newVergenceRun(); const endpoints = vergenceFindings[kind][base];
      expect(markVergenceEndpoint(kind, base, endpoints.break, run, true)).toBe(run);
      run.initialized = true;
      for (const phase of ["blur", "break", "recovery"] as const) {
        const power = endpoints[phase]; if (power === null) continue;
        expect(markVergenceEndpoint(kind, base, power, run, false)).toBe(run);
        expect(markVergenceEndpoint(kind, base, power + 1, run, true)).toBe(run);
        run = markVergenceEndpoint(kind, base, power, run, true);
      }
      expect(run.complete).toBe(true); expect(run.values).toMatchObject({ break: endpoints.break, recovery: endpoints.recovery });
    }
  });
  it("retains actual ordered NPC endpoint samples and freezes capture values", () => {
    let run = newNPCRun(); expect(markNPCEndpoint(run, 6, true)).toBe(run); run.initialized = true;
    for (const distance of [5.8, 4.9, 8.3, 9.2]) { expect(markNPCEndpoint(run, distance, false)).toBe(run); run = markNPCEndpoint(run, distance, true); }
    expect(run.index).toBe(4); expect(run.values).toEqual([5.8, 4.9, 8.3, 9.2]);
    const values = Object.fromEntries(npcPhases.map((id, i) => [id, run.values[i]])); const capture = freezeVergenceCapture(1, "fit", "NPC", values, 9.2, ["report"]); values[npcPhases[0]] = 99;
    expect(capture.values[npcPhases[0]]).toBe(5.8); expect(Object.isFrozen(capture.values)).toBe(true); expect(numericCaptureSubmission(capture.values, {})).toBeNull();
  });
  it("counts full timed pairs only after authored responses and before 60 seconds", () => {
    let vergence = newVergenceFacility(0); expect(flipVergenceFacility(vergence, 849, true)).toBe(vergence); expect(flipVergenceFacility(vergence, 850, false)).toBe(vergence);
    vergence = flipVergenceFacility(vergence, 850, true); expect(vergence.cycles).toBe(0); vergence = flipVergenceFacility(vergence, 1500, true); expect(vergence.cycles).toBe(1); expect(flipVergenceFacility(vergence, 60000, true)).toBe(vergence);
    let accommodation = newAccommodationFacility(0); expect(flipAccommodationFacility(accommodation, 1499, true)).toBe(accommodation); accommodation = flipAccommodationFacility(accommodation, 1500, true); expect(accommodation.cycles).toBe(0); accommodation = flipAccommodationFacility(accommodation, 3300, true); expect(accommodation.cycles).toBe(1); expect(flipAccommodationFacility(accommodation, 60000, true)).toBe(accommodation);
  });
  it("keeps actual push-up distance and calculation; gates minus-lens settling and required eyes", () => {
    expect(pushUpEndpoint("OD", 9.8, true, true)).toEqual({ distance: 9.8, amplitude: 10.2 }); expect(pushUpEndpoint("OD", 10.2, true, true)).toBeNull(); expect(pushUpEndpoint("OD", 10, false, true)).toBeNull(); expect(pushUpEndpoint("OS", 10, true, true)).toBeNull();
    expect(minusLensEndpoint(-4, true, true)).toEqual({ amplitude: 6.5 }); expect(minusLensEndpoint(-4, false, true)).toBeNull(); expect(minusLensEndpoint(-3.75, true, true)).toBeNull();
    expect(accommodationEyes("minus-lens")).toEqual(["OD", "OS"]); expect(accommodationEyes("relative")).toEqual(["OU"]); expect(accommodationEyes("push-up")).toEqual(["OD", "OS", "OU"]);
  });
  it("uses spatial facing, spectacle-plane distances, near and optical alignment", () => {
    const pose = { position: [0, 1.5, -.111] as const, forward: [0, 0, -1] as const }; expect(libraryDistance(pose, true)).toEqual({ distanceCm: 40, ready: true }); expect(libraryDistance({ ...pose, forward: [0, 0, 1] }, true).ready).toBe(false);
    expect(libraryNear({ position: SENSORY_NEAR_TARGET, forward: [0, 0, -1] })).toBe(true); expect(libraryOpticPlacement({ position: [0, 1.5, -.46], forward: [0, 0, -1] }, "OU")).toBe(true); expect(libraryOpticPlacement({ position: [0, 1.5, -.46], forward: [0, 0, 1] }, "OU")).toBe(false);
    const card = { position: SENSORY_NEAR_TARGET, forward: [0, 0, -1] as const }; expect(libraryLightThroughCard(card, { position: [0, 1.425, 0], forward: [0, 0, -1] })).toBe(true); expect(libraryLightThroughCard(card, { position: [.1, 1.425, 0], forward: [0, 0, -1] })).toBe(false);
  });
  it("fits correction and opposite-eye occlusion in distinct layers, with only selected kit sockets", () => {
    let tools = initialConsultationTools(); const sockets = librarySockets("push-up");
    for (const id of ["subjective", "cover"] as const) { const socket = sockets.find(s => s.tool === id && (id !== "cover" || s.id.endsWith("OS")))!; tools = releaseConsultationTool(grabConsultationTool(tools, id, "left"), "left", { position: socket.position, rotation: socket.rotation }, undefined, sockets, libraryEquipment("push-up")).state; }
    expect(libraryOcclusion(tools, "OD")).toBe(true); expect(libraryOcclusion(tools, "OS")).toBe(false); expect(libraryOcclusion(tools, "OU")).toBe(false);
    for (const kind of Object.keys(LIBRARY_TITLES) as (keyof typeof LIBRARY_TITLES)[]) expect(librarySockets(kind).every(socket => libraryEquipment(kind).includes(socket.tool))).toBe(true);
  });
});
