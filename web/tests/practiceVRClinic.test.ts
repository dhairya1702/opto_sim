import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PracticeVRClinic } from "../practice/xr/PracticeVRClinic";

vi.mock("@react-three/fiber", () => ({ Canvas: () => null, useFrame: vi.fn(), useThree: vi.fn() }));

describe("shared Practice clinic launch", () => {
  it.each(["Stereopsis", "Cover–uncover", "Standard Krimsky"])("launches %s with one Enter action and no empty controls column", title => {
    const renderScene = vi.fn(() => null);
    const markup = renderToStaticMarkup(createElement(PracticeVRClinic, {
      title, findingPosition: { current: 1, total: 1 }, onClose: vi.fn(), onDesktop: vi.fn(),
      children: renderScene,
    }));
    expect(markup).toContain(`<h2>${title}</h2>`);
    expect(markup).toMatch(/<button[^>]*>Enter<\/button>/);
    for (const removed of ["THE SAME CLINIC AS CONSULTATION", "Squeeze the side grip", "VR headset unavailable",
      "Preview clinic layout", "Desktop clinical view", "Use Quest Browser over HTTPS", "xr-practice-body-with-controls", "xr-mirror-panel"]) {
      expect(markup).not.toContain(removed);
    }
    expect(renderScene).not.toHaveBeenCalled();
  });
  it("retains the active desktop controls", () => {
    const renderScene = vi.fn(() => null);
    const markup = renderToStaticMarkup(createElement(PracticeVRClinic, {
      title: "Stereopsis", findingPosition: { current: 1, total: 1 }, onClose: vi.fn(), inputMode: "desktop",
      children: renderScene, mirror: createElement("button", null, "Record finding"),
    }));
    expect(markup).toContain("xr-practice-body-with-controls");
    expect(markup).toContain("Record finding");
    expect(markup).not.toContain("xr-preflight");
    expect(renderScene).toHaveBeenCalledOnce();
  });
});
