import { describe, expect, it } from "vitest";
import { fourPrismResponse, interpretWorth, stereopsisEndpoint } from "../interaction/sensory";

describe("sensory status practice", () => {
  it("interprets Worth four-dot reports", () => {
    expect(interpretWorth("fusion")).toBe("flat-fusion");
    expect(interpretWorth("suppress-os")).toBe("left-suppression");
    expect(interpretWorth("exo")).toBe("exo");
  });

  it("records the last correct stereo level before two consecutive errors", () => {
    expect(stereopsisEndpoint([800, 400, 200, 100, 60, 40], [true, true, true, true, false, false])).toBe(100);
  });

  it("distinguishes normal and suppression four-prism responses", () => {
    expect(fourPrismResponse("normal", "OD")).toContain("inward refixation");
    expect(fourPrismResponse("suppression", "OS")).toContain("No movement");
  });
});
