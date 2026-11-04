import { Group, Scene } from "three";
import { describe, expect, it } from "vitest";
import { XRRaycastRegistry } from "../interaction/xrRaycastRegistry";

function target(data: Record<string, unknown> = { xrButton: true }) {
  const object = new Group();
  object.userData = data;
  return object;
}

describe("XR raycast topology registry", () => {
  it("reuses candidate arrays across poses, visibility and live action changes", () => {
    const scene = new Scene(), button = target();
    scene.add(button);
    const registry = new XRRaycastRegistry(scene), stop = registry.start();
    const initial = registry.snapshot();
    expect(initial.roots).toEqual([button]);
    expect(initial.buttons).toEqual([button]);
    expect(registry.hasPriorityPanel()).toBe(false);
    button.position.x = 2;
    button.visible = false;
    button.userData.xrAction = () => true;
    button.userData.xrPriorityPanel = true;
    expect(registry.hasPriorityPanel()).toBe(true);
    expect(registry.snapshot()).toBe(initial);
    expect(initial.buttons[0].userData.xrAction()).toBe(true);
    stop();
  });

  it("indexes late panels and nested buttons once, then follows reparenting and removal", () => {
    const scene = new Scene(), registry = new XRRaycastRegistry(scene);
    const stop = registry.start();
    expect(registry.snapshot().roots).toEqual([]);
    const panel = target({ xrPanel: true }), button = target();
    panel.add(button);
    scene.add(panel);
    expect(registry.snapshot()).toEqual({ roots: [panel], buttons: [button] });
    scene.add(button);
    expect(registry.snapshot().roots).toEqual([panel, button]);
    scene.remove(panel);
    expect(registry.snapshot().roots).toEqual([button]);
    scene.remove(button);
    expect(registry.snapshot()).toEqual({ roots: [], buttons: [] });
    stop();
  });

  it("supports explicit registration before attachment and independent registration cleanup", () => {
    const scene = new Scene(), parent = new Group(), object = new Group();
    parent.add(object);
    const registry = new XRRaycastRegistry(scene), stop = registry.start();
    const removeOne = registry.register(object), removeTwo = registry.register(object);
    expect(registry.snapshot().roots).toEqual([]);
    scene.add(parent);
    expect(registry.snapshot().roots).toEqual([object]);
    removeOne();
    expect(registry.snapshot().roots).toEqual([object]);
    removeTwo();
    expect(registry.snapshot().roots).toEqual([]);
    stop();
  });

  it("removes topology listeners on cleanup and rediscovers changes after restart", () => {
    const scene = new Scene(), branch = new Group(), button = target();
    branch.add(button); scene.add(branch);
    const registry = new XRRaycastRegistry(scene), stop = registry.start();
    registry.snapshot();
    stop();
    expect(registry.snapshot().roots).toEqual([]);
    const late = target();
    branch.add(late);
    expect(registry.snapshot().roots).toEqual([]);
    const stopAgain = registry.start();
    expect(registry.snapshot().roots).toEqual([button, late]);
    stopAgain();
  });
});
