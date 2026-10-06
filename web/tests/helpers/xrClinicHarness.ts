import { createElement, Fragment, type ComponentProps, type ReactNode } from "react";
import { act, advance, createRoot, extend, type RootState } from "@react-three/fiber";
import * as THREE from "three";
import { afterEach, describe, expect, it, vi } from "vitest";
import { XRConsultationController } from "../../interaction/XRConsultationController";
import { ConsultationInterior } from "../../scene/Room";
import { consultationXRArrival } from "../../interaction/xrConsultationNavigation";
import { stations, walkable } from "../../interaction/navigation";
import { CONSULTATION_TOOLS, consultationToolDefinition, type ConsultationToolId } from "../../interaction/xrConsultationTools";
import { coverProcedure } from "../../interaction/cover";
import { clinicalCase } from "../../cases/adultDistanceBlur";
import { newSession, reduceSession } from "../../domain/engine";
import type { ConsultationExam } from "../../interaction/XRConsultationController";
import { gazePositions } from "../../interaction/motility";

extend({
  Color: THREE.Color,
  Group: THREE.Group, Mesh: THREE.Mesh,
  BoxGeometry: THREE.BoxGeometry, SphereGeometry: THREE.SphereGeometry,
  CylinderGeometry: THREE.CylinderGeometry, TorusGeometry: THREE.TorusGeometry,
  CircleGeometry: THREE.CircleGeometry, PlaneGeometry: THREE.PlaneGeometry,
  RingGeometry: THREE.RingGeometry, ConeGeometry: THREE.ConeGeometry,
  CapsuleGeometry: THREE.CapsuleGeometry,
  ExtrudeGeometry: THREE.ExtrudeGeometry,
  MeshPhysicalMaterial: THREE.MeshPhysicalMaterial, MeshBasicMaterial: THREE.MeshBasicMaterial, MeshStandardMaterial: THREE.MeshStandardMaterial, ShaderMaterial: THREE.ShaderMaterial,
  AmbientLight: THREE.AmbientLight, HemisphereLight: THREE.HemisphereLight,
  DirectionalLight: THREE.DirectionalLight, PointLight: THREE.PointLight, SpotLight: THREE.SpotLight,
});

/** Mount the actual R3F controller and geometry; only the device/GPU/canvas are simulated. */
export async function clinic({ guided = false, selectedExamId, renderAdapter }: { guided?: boolean; selectedExamId?: string; renderAdapter?: (props: ComponentProps<typeof XRConsultationController>) => ReactNode } = {}) {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("requestAnimationFrame", () => 1);
  vi.stubGlobal("cancelAnimationFrame", () => undefined);
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
  vi.stubGlobal("document", { createElement: () => {
    const canvas = { width: 0, height: 0, renderedText: [] as string[], getContext: () => ({
      fillRect() { canvas.renderedText = []; },
      fillText(text: string) { canvas.renderedText.push(text); },
      measureText: (text: string) => ({ width: text.length * 20 }),
    }) };
    return canvas;
  } });
  const viewerCamera = new THREE.PerspectiveCamera();
  viewerCamera.position.set(0, 1.6, .65);
  const rays = [new THREE.Group(), new THREE.Group()];
  const grips = [new THREE.Group(), new THREE.Group()];
  const tracked = [true, true];
  const rayTracked = [true, true];
  const buttons = [Array.from({ length: 6 }, () => ({ pressed: false })), Array.from({ length: 6 }, () => ({ pressed: false }))];
  const sources = (["left", "right"] as const).map((hand, index) => ({ handedness: hand, gripSpace: { index }, targetRaySpace: { index, ray: true }, gamepad: { buttons: buttons[index] } }));
  const session = new EventTarget() as EventTarget & { visibilityState: string };
  session.visibilityState = "visible";
  const physicalViewer = { x: 0, y: 1.6, z: 0 };
  const referenceOffsets: { x: number; y: number; z: number }[] = [];
  const baseReference = { getOffsetReferenceSpace: (transform: { position: { x: number; y: number; z: number } }) => {
    referenceOffsets.push(transform.position); return { baseReference, transform };
  } };
  let reference: unknown = baseReference;
  vi.stubGlobal("XRRigidTransform", class { position: { x: number; y: number; z: number }; constructor(position: { x: number; y: number; z: number }) { this.position = position; } });
  const xr = Object.assign(new THREE.EventDispatcher(), {
    isPresenting: true,
    getCamera: () => viewerCamera,
    getController: (index: number) => rays[index],
    getControllerGrip: (index: number) => grips[index],
    getSession: () => session,
    getReferenceSpace: () => reference,
    setReferenceSpace: (next: unknown) => { reference = next; },
    setAnimationLoop() {},
  });
  const renderer = { xr, render() {}, setPixelRatio() {}, setSize() {} } as unknown as THREE.WebGLRenderer;
  const root = createRoot({} as HTMLCanvasElement);
  await root.configure({ gl: renderer, frameloop: "never", size: { width: 800, height: 600, top: 0, left: 0 }, dpr: 1 });
  const interact = vi.fn();
  let encounter = reduceSession(clinicalCase, newSession(clinicalCase, "xr-test"), { type: "start", at: 1 });
  let recordId = 0;
  const record = vi.fn((exam: ConsultationExam, mode: string, observation: string, eye: "OU" | "OD" | "OS" = "OU") => {
    encounter = reduceSession(clinicalCase, encounter, { type: "performExam", examId: exam, config: { eye, mode }, observation, at: 2 + recordId, requestId: `xr-record-${recordId++}` });
    return true;
  });
  const exitVR = vi.fn();
  const openPanel = vi.fn();
  let active = true;
  let state: RootState;
  const render = async () => {
    await act(async () => {
      const props = {
        caseData: clinicalCase, active, guided, selectedExamId, patientName: "Arun", onInteract: interact,
        onProcedureComplete: record, onOpenPanel: openPanel, onExitVR: exitVR,
      };
      state = root.render(createElement(Fragment, null, createElement(ConsultationInterior, { xr: active }),
        renderAdapter ? renderAdapter(props) : createElement(XRConsultationController, props))).getState();
    });
  };
  await render();
  async function event(index: number, type: string, data?: unknown) {
    await act(async () => {
      (rays[index] as unknown as THREE.EventDispatcher<Record<string, { data?: unknown }>>).dispatchEvent({ type, data });
    });
  }
  await event(0, "connected", sources[0]);
  await event(1, "connected", sources[1]);
  let time = 0;
  const viewerTracked = { current: true };
  const frame = { getPose: (space: { index: number; ray?: boolean }) => tracked[space.index] && (!space.ray || rayTracked[space.index]) ? {} : null,
    getViewerPose: () => viewerTracked.current ? { transform: { position: physicalViewer } } : null } as unknown as XRFrame;
  async function step(dt = 1 / 72, count = 1) {
    for (let i = 0; i < count; i++) {
      await act(async () => {
        state.scene.updateMatrixWorld(true);
        advance(time += dt, false, state, frame);
        state.scene.updateMatrixWorld(true);
      });
    }
  }
  const tool = (id: ConsultationToolId) => {
    const matches: THREE.Object3D[] = [];
    state.scene.traverse(object => { if (object.userData.consultationToolId === id) matches.push(object); });
    expect(matches, `${id} must have exactly one scene instance`).toHaveLength(1);
    return matches[0];
  };
  const at = async (index: number, position: readonly [number, number, number]) => {
    grips[index].position.set(...position);
    await step();
  };
  const pickup = async (index: number, id: ConsultationToolId) => {
    const position = tool(id).getWorldPosition(new THREE.Vector3());
    await at(index, position.toArray() as [number, number, number]);
    await event(index, "squeezestart");
    await step();
  };
  const panel = async (index: number) => {
    buttons[index][4].pressed = true;
    await step();
    buttons[index][4].pressed = false;
    await step();
  };
  const controls = () => {
    const controls: THREE.Object3D[] = [];
    state.scene.traverse(object => {
      if (!object.userData.xrButton || !object.userData.xrAction) return;
      let ancestor: THREE.Object3D | null = object;
      while (ancestor) { if (!ancestor.visible) return; ancestor = ancestor.parent; }
      controls.push(object);
    });
    return controls;
  };
  const labels = () => {
    const rows: string[] = [];
    state.scene.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => {
        const image = (material as THREE.MeshBasicMaterial).map?.image as { renderedText?: string[] } | undefined;
        rows.push(...(image?.renderedText ?? []));
      });
    });
    return rows;
  };
  const click = async (index: number, button: THREE.Object3D) => {
    const rotation = button.getWorldQuaternion(new THREE.Quaternion());
    const position = button.getWorldPosition(new THREE.Vector3());
    rays[index].position.copy(position).add(new THREE.Vector3(0, 0, .6).applyQuaternion(rotation));
    rays[index].quaternion.copy(rotation);
    await step();
    await event(index, "selectstart");
    await event(index, "selectend");
    await step();
  };
  const apertureWheel = () => {
    let wheel: THREE.Object3D | undefined;
    tool("fundus").traverse(object => { if (object.userData.xrInstrumentControl === "fundus") wheel = object; });
    if (!wheel) throw new Error("Missing ophthalmoscope aperture wheel");
    return wheel;
  };
  const cycleAperture = async (index: number) => {
    const wheel = apertureWheel();
    const rotation = wheel.getWorldQuaternion(new THREE.Quaternion());
    const point = wheel.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, 0, .09).applyQuaternion(rotation));
    grips[index].position.copy(point); rays[index].position.copy(point); rays[index].quaternion.copy(rotation);
    await step(); await event(index, "selectstart"); await event(index, "selectend"); await step();
  };
  await step();
  return {
    state: state!, rerender: render, viewerCamera, physicalViewer, viewerTracked, referenceOffsets, grips, rays, tool, at, pickup, event, step, panel, controls, click, labels, apertureWheel, cycleAperture, tracked, rayTracked, session,
    interact, record, openPanel, exitVR, encounter: () => encounter,
    directRecord: (id: ConsultationToolId) => {
      const button = controls().find(object => object.userData.xrRecordTool === id);
      if (!button) throw new Error(`Direct record button missing: ${id}`);
      return button;
    },
    button: (label: string) => {
      const button = controls().find(object => object.userData.xrLabel === label);
      if (!button) throw new Error(`Enabled button missing: ${label}`);
      return button;
    },
    eyes: (kind: "consultationPupil" | "consultationGaze") => {
      const eyes: THREE.Object3D[] = [];
      state.scene.traverse(object => { if (object.userData[kind]) eyes.push(object); });
      expect(eyes).toHaveLength(2);
      return eyes;
    },
    exit: async () => { active = false; await render(); },
    enter: async () => { reference = baseReference; active = true; await render(); await step(); },
    dispose: async () => { await act(async () => root.unmount()); },
  };
}
