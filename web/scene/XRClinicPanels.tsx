import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, Quaternion, Vector3 } from "three";
import { Box, Sign as RoomSign } from "./Models";
import type { ConsultationToolId } from "../interaction/xrConsultationTools";
import type { XRClinicRuntime } from "../interaction/useXRClinicRuntime";

export function XRSign(props: Parameters<typeof RoomSign>[0]) {
  return <RoomSign {...props} fit />;
}

export function XRToolControls({ runtime, id, children }: { runtime: XRClinicRuntime; id: ConsultationToolId; children: React.ReactNode }) {
  const root = useRef<Group>(null);
  useEffect(() => {
    root.current?.traverse(object => {
      if (!(object instanceof Mesh)) return;
      object.renderOrder = 900;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => { material.depthTest = false; material.depthWrite = false; });
    });
  });
  if (runtime.tools[id].placement.kind !== "held") return null;
  return <group ref={object => { root.current = object; if (object) runtime.toolControls.current.set(id, object); else runtime.toolControls.current.delete(id); }}
    userData={{ xrToolControls: id, xrPanel: true }}>{children}</group>;
}

export function XRPanelButton({ label, position, width = .5, active = false, disabled = false, recordTool, onClick }: {
  label: string;
  position: [number, number, number];
  width?: number;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  recordTool?: ConsultationToolId;
}) {
  return <group position={position} userData={{ xrAction: disabled ? undefined : onClick, xrButton: true, xrWidth: width, xrLabel: label, xrRecordTool: recordTool }}>
    <Box s={[width, .065, .018]} c={disabled ? "#334346" : active ? "#176b5e" : "#214149"} radius={.008} />
    <XRSign text={[label]} p={[0, 0, .011]} size={[width - .018, .052]} bg={disabled ? "#334346" : active ? "#176b5e" : "#214149"} fg={disabled ? "#82908e" : "#f7fffc"} />
  </group>;
}

export function XRHeadPanel({ children }: { children: React.ReactNode }) {
  const root = useRef<Group>(null);
  const point = useMemo(() => new Vector3(), []);
  const rotation = useMemo(() => new Quaternion(), []);
  useEffect(() => {
    // An explicitly opened editor is a headset overlay; the patient must not occlude it.
    root.current?.traverse(object => {
      if (!(object instanceof Mesh)) return;
      object.renderOrder = 1000;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach(material => { material.depthTest = false; material.depthWrite = false; });
    });
  });
  useFrame(({ gl, camera }) => {
    if (!root.current) return;
    const viewer = gl.xr.isPresenting ? gl.xr.getCamera() : camera;
    viewer.getWorldPosition(point); viewer.getWorldQuaternion(rotation);
    root.current.position.copy(point);
    point.set(0, -.04, -.85).applyQuaternion(rotation); root.current.position.add(point);
    root.current.quaternion.copy(rotation);
  });
  return <group ref={root} userData={{ xrPanel: true, xrObservationEditor: true }}>{children}</group>;
}

export function XRObservationPanel({ tool, status, fields, ready, onRecord, onCancel, extra }: {
  tool: string;
  status: string;
  fields: { label: string; value: string; enabled: boolean; onChange: () => void }[];
  ready: boolean;
  onRecord: () => void;
  onCancel: () => void;
  extra?: { label: string; enabled: boolean; onClick: () => void };
}) {
  const rows = Math.ceil(fields.length / 2);
  const bottom = -.02 - rows * .09 - (extra ? .09 : 0);
  return <XRHeadPanel>
    <Box p={[0, -.05, -.015]} s={[.64, .78, .018]} c="#102329" radius={.012} />
    <XRSign text={["MY OBSERVATIONS", tool, status]} p={[0, .205, 0]} size={[.59, .23]} bg="#102329" fg="#eefbf7" />
    {fields.map((field, index) => <XRPanelButton key={field.label}
      label={`${field.label} · ${(field.value || "CHOOSE").toUpperCase()}`}
      position={[index % 2 ? .145 : -.145, .035 - Math.floor(index / 2) * .09, .012]}
      width={.27} disabled={!field.enabled} onClick={field.onChange} />)}
    {extra && <XRPanelButton label={extra.label} position={[0, .025 - rows * .09, .012]} width={.56} disabled={!extra.enabled} onClick={extra.onClick} />}
    <XRPanelButton label="CANCEL" position={[-.145, bottom, .012]} width={.27} onClick={onCancel} />
    <XRPanelButton label="SAVE TO NOTEBOOK" position={[.145, bottom, .012]} width={.27} disabled={!ready} active={ready} onClick={onRecord} />
  </XRHeadPanel>;
}
