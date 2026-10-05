import { describe, expect, it } from "vitest";
import { advanceXRPupilObservation, initialXRPupilObservation, xrPupilEyeFromRay } from "../interaction/xrPupils";

const targets = { OD: [-.05, 1.5, -.57], OS: [.05, 1.5, -.57] } as const;

describe("XR pupil assessment", () => {
  it("maps a controller ray to one pupil only inside the working range", () => {
    expect(xrPupilEyeFromRay([-.05, 1.5, 0], [0, 0, -1], targets)).toBe("OD");
    expect(xrPupilEyeFromRay([-.05, 1.5, .5], [0, 0, -1], targets)).toBeNull();
    expect(xrPupilEyeFromRay([-.05, 1.5, 0], [1, 0, 0], targets)).toBeNull();
  });

  it("requires setup, steady illumination, and an off interval between eyes", () => {
    let state = initialXRPupilObservation();
    for (let index = 0; index < 10; index += 1) state = advanceXRPupilObservation(state, { setupReady: false, light: true, aimedEye: "OD", dt: .1 });
    expect(state.seen).toEqual([]);
    for (let index = 0; index < 8; index += 1) state = advanceXRPupilObservation(state, { setupReady: true, light: true, aimedEye: "OD", dt: .1 });
    expect(state.seen).toEqual(["OD"]);
    for (let index = 0; index < 8; index += 1) state = advanceXRPupilObservation(state, { setupReady: true, light: true, aimedEye: "OS", dt: .1 });
    expect(state.seen).toEqual(["OD"]);
    for (let index = 0; index < 4; index += 1) state = advanceXRPupilObservation(state, { setupReady: true, light: false, aimedEye: null, dt: .1 });
    for (let index = 0; index < 8; index += 1) state = advanceXRPupilObservation(state, { setupReady: true, light: true, aimedEye: "OS", dt: .1 });
    expect(state.seen).toEqual(["OD", "OS"]);
  });
});
