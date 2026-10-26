import { describe, expect, it, vi } from "vitest";
import { bindControllerPointerCancellation } from "../interaction/Controller";

describe("room camera pointer cancellation", () => {
  it("clears dragging for pointer cancellation and lost capture, then removes both listeners", () => {
    const target = new EventTarget();
    const cancel = vi.fn();
    const remove = bindControllerPointerCancellation(target, cancel);

    target.dispatchEvent(new Event("pointercancel"));
    target.dispatchEvent(new Event("lostpointercapture"));
    expect(cancel).toHaveBeenCalledTimes(2);

    remove();
    target.dispatchEvent(new Event("pointercancel"));
    target.dispatchEvent(new Event("lostpointercapture"));
    expect(cancel).toHaveBeenCalledTimes(2);
  });
});
