import { describe, expect, it } from "vitest";
import { signTextureDimensions } from "../scene/Models";

describe("XR sign texture budgets", () => {
  it("uses adaptive widths and keeps thin labels legible", () => {
    expect(signTextureDimensions([.3, .03], "compact", true)).toEqual({ width: 512, height: 64 });
    expect(signTextureDimensions([.6, .3], "panel", true)).toEqual({ width: 1024, height: 512 });
    expect(signTextureDimensions([.6, .3], "detail", true)).toEqual({ width: 1536, height: 768 });
  });
  it("preserves the established non-fitted texture size", () => {
    expect(signTextureDimensions([.7, .23], "compact", false)).toEqual({ width: 1024, height: 640 });
  });
});
