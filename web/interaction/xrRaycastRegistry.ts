import type { Object3D } from "three";
import { perfCount } from "../perf/perfFlag";

// Include stable markers (not just an enabled action), so disabling/enabling a
// button or entering XR does not require rediscovering the scene.
function interactive(object: Object3D) {
  const data = object.userData;
  return Boolean(data.station || data.xrTeleport || data.xrPreviewPad || data.xrPanel
    || data.xrPracticeResultHUD || data.xrToolControls || data.xrInteractiveSurface
    || data.consultationToolId || data.xrAction || data.xrButton || data.xrInstrumentControl);
}

/** Index topology changes once; poses, visibility and action closures stay live. */
export class XRRaycastRegistry {
  private watched = new Set<Object3D>();
  private discovered = new Set<Object3D>();
  private registered = new Map<Object3D, number>();
  private dirty = true;
  private cached = { roots: [] as Object3D[], buttons: [] as Object3D[] };

  constructor(private scene: Object3D) {}

  private added = (event: { child: Object3D }) => { this.watch(event.child); };
  private removed = (event: { child: Object3D }) => { this.unwatch(event.child); };

  private watch(object: Object3D) {
    if (this.watched.has(object)) return;
    this.watched.add(object);
    this.dirty = true;
    if (interactive(object)) this.discovered.add(object);
    object.addEventListener("childadded", this.added);
    object.addEventListener("childremoved", this.removed);
    for (const child of object.children) this.watch(child);
  }

  private unwatch(object: Object3D) {
    if (!this.watched.delete(object)) return;
    this.dirty = true;
    this.discovered.delete(object);
    object.removeEventListener("childadded", this.added);
    object.removeEventListener("childremoved", this.removed);
    for (const child of object.children) this.unwatch(child);
  }

  start() {
    this.watch(this.scene);
    this.dirty = true;
    perfCount("ray target audit");
    return () => { this.unwatch(this.scene); this.dirty = true; };
  }

  register(object: Object3D) {
    this.registered.set(object, (this.registered.get(object) ?? 0) + 1);
    this.dirty = true;
    let registered = true;
    return () => {
      if (!registered) return;
      registered = false;
      const count = this.registered.get(object) ?? 0;
      if (count <= 1) this.registered.delete(object);
      else this.registered.set(object, count - 1);
      this.dirty = true;
    };
  }

  hasPriorityPanel() {
    // Usually none: avoid walking every button's ancestors on ordinary hover.
    // Priority can change without remounting, so inspect the indexed nodes live.
    for (const object of this.discovered) if (object.userData.xrPriorityPanel) return true;
    for (const object of this.registered.keys()) if (object.userData.xrPriorityPanel) return true;
    return false;
  }

  snapshot() {
    if (!this.dirty) return this.cached;
    const all = new Set([...this.discovered, ...this.registered.keys()]);
    const roots: Object3D[] = [], buttons: Object3D[] = [];
    for (const object of all) {
      let ancestor = object.parent;
      let covered = false;
      while (ancestor && ancestor !== this.scene) {
        covered ||= all.has(ancestor);
        ancestor = ancestor.parent;
      }
      if (ancestor !== this.scene) continue;
      if (!covered) roots.push(object);
      // Priority is checked at hit time: result cards can become actionable
      // without replacing their root or an existing button.
      if (object.userData.xrButton) buttons.push(object);
    }
    this.cached = { roots, buttons };
    this.dirty = false;
    perfCount("ray target registry rebuild");
    perfCount("registered ray targets", roots.length);
    return this.cached;
  }
}
