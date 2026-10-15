import { describe, expect, it } from "vitest";
import { Quaternion, Vector3 } from "three";
import { newVergenceRun, markVergenceEndpoint, vergenceBases, newVergenceFacility, flipVergenceFacility, freezeVergenceCapture, numericCaptureSubmission } from "../interaction/xrVergencePractice";
import { vergenceFindings } from "../interaction/vergencePractice";
import { accommodationEyes, pushUpEndpoint, minusLensEndpoint, newAccommodationFacility, flipAccommodationFacility } from "../interaction/xrAccommodationPractice";
import { libraryDistance, libraryOpticPlacement, libraryNear, libraryOcclusion, libraryLightThroughCard, libraryEquipment, librarySockets, LIBRARY_TITLES } from "../interaction/xrLibraryEquipment";
import { initialConsultationTools, grabConsultationTool, releaseConsultationTool } from "../interaction/xrConsultationTools";
import { SENSORY_NEAR_TARGET } from "../interaction/xrSensoryEquipment";
describe("remaining XR library sequences and geometry", () => {
  it("orders blur, break and recovery for every prism condition", () => {
    for (const kind of ["horizontal-near"] as const) for (const base of vergenceBases(kind)) {
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
  it("stocks the rotary prism only for 6.3 while preserving 6.4 and 6.5 kits", () => {
    expect(libraryEquipment("vertical-distance")).toEqual(["subjective", "vergence-prism"]);
    expect(libraryEquipment("horizontal-near")).toEqual(["subjective", "near", "prism"]);
    expect(libraryEquipment("facility")).toEqual(["subjective", "near", "prism-flipper"]);
  });
  it("keeps both Maddox socket rotations on the same OD lens centre and rejects an intermediate roll", () => {
    const sockets = librarySockets("maddox").filter(socket => socket.tool === "maddox");
    expect(sockets.map(socket => socket.id)).toEqual(["sensory-maddox-horizontal", "sensory-maddox-vertical"]);
    for (const socket of sockets) {
      const centre = new Vector3(0, .10, 0).applyQuaternion(new Quaternion(...socket.rotation)).add(new Vector3(...socket.position));
      expect(centre.toArray()).toEqual(expect.arrayContaining([expect.closeTo(-.048, 6), expect.closeTo(1.5, 6), expect.closeTo(-.475, 6)]));
    }
    const held = grabConsultationTool(initialConsultationTools(), "maddox", "left");
    const intermediate = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), Math.PI / 4).toArray();
    const release = releaseConsultationTool(held, "left", { position: sockets[0].position, rotation: intermediate }, undefined, sockets, libraryEquipment("maddox"));
    expect(Boolean(release.state.maddox.placement.kind === "socket" && release.state.maddox.placement.socketId?.startsWith("sensory-maddox"))).toBe(false);
  });
});
