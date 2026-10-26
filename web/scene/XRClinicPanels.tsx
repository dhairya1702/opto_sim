import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, Quaternion, Shape, ShapeGeometry, Vector3 } from "three";
import { Box, Sign as RoomSign } from "./Models";
import type { ConsultationToolId } from "../interaction/xrConsultationTools";
import type { XRClinicRuntime } from "../interaction/useXRClinicRuntime";

export function XRSign(props: Parameters<typeof RoomSign>[0]) {
  const size = props.size ?? [.7, .23];
  const resolutionTier = props.resolutionTier ?? (size[0] >= .45 || size[1] >= .12 ? "panel" : "compact");
  return <RoomSign {...props} fit resolutionTier={resolutionTier} />;
}

export function XRRoundedPanel({ width, height, radius, color, position = [0, 0, 0], rotation = [0, 0, 0], userData }: {
  width: number;
  height: number;
  radius: number;
  color: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  userData?: Record<string, unknown>;
}) {
  const shape = useMemo(() => {
    const next = new Shape();
    const x = width / 2, y = height / 2, corner = Math.min(radius, x, y);
    next.moveTo(-x + corner, -y);
    next.lineTo(x - corner, -y); next.quadraticCurveTo(x, -y, x, -y + corner);
    next.lineTo(x, y - corner); next.quadraticCurveTo(x, y, x - corner, y);
    next.lineTo(-x + corner, y); next.quadraticCurveTo(-x, y, -x, y - corner);
    next.lineTo(-x, -y + corner); next.quadraticCurveTo(-x, -y, -x + corner, -y);
    return next;
  }, [height, radius, width]);
  const geometry = useMemo(() => new ShapeGeometry(shape, 16), [shape]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <mesh position={position} rotation={rotation} userData={userData}>
    <primitive object={geometry} attach="geometry" />
    <meshBasicMaterial color={color} />
  </mesh>;
}

export function XRLabelPill({ label, position = [0, 0, 0], rotation = [0, 0, 0], width = .18, height = .03, background = "#173a3e", foreground = "#e8fff9", toolId }: {
  label: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  width?: number;
  height?: number;
  background?: string;
  foreground?: string;
  toolId?: ConsultationToolId;
}) {
  return <group position={position} rotation={rotation} userData={{ xrLabelPill: true, xrHeldToolPill: toolId ? true : undefined, xrToolId: toolId, width, height }}>
    <XRRoundedPanel width={width} height={height} radius={height / 2} color={background} />
    <XRSign transparentBackground text={[label]} p={[0, 0, .001]} size={[width - .018, height - .009]} bg={background} fg={foreground} />
  </group>;
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
  const background = disabled ? "#334346" : active ? "#0d725f" : "#214149";
  return <group position={position} userData={{ xrAction: disabled ? undefined : onClick, xrButton: true, xrWidth: width, xrLabel: label, xrRecordTool: recordTool }}>
    <Box s={[width, .065, .018]} c={background} radius={.008} />
    <XRSign text={[label]} p={[0, 0, .011]} size={[width - .018, .052]} bg={background} fg={disabled ? "#82908e" : "#f7fffc"} />
    {active && <mesh position={[-width / 2 + .014, 0, .013]} userData={{ xrSelectedMarker: true }}>
      <planeGeometry args={[.006, .038]} /><meshBasicMaterial color="#a9ffe5" />
    </mesh>}
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
    root.current.updateMatrixWorld(true);
  }, -1); // Position the visible overlay before the runtime samples pointer hits.
  return <group ref={root} userData={{ xrPanel: true, xrObservationEditor: true }}>{children}</group>;
}

export function XRClinicUtilityPanel({ runtime, onHelp, onExit }: {
  runtime: XRClinicRuntime;
  onHelp: () => void;
  onExit: () => void;
}) {
  if (!runtime.utilityOpen) return null;
  return <XRHeadPanel>
    <Box s={[.64, .40, .018]} c="#102329" radius={.012} />
    <XRSign text={["VR CONTROLS", "B/Y on your free hand · close"]} p={[0, .105, .012]} size={[.58, .12]} bg="#102329" fg="#eefbf7" />
    <XRPanelButton label="HELP" position={[0, .005, .025]} width={.56} onClick={() => { runtime.closeUtilityPanel(); onHelp(); }} />
    <XRPanelButton label="RECENTER CLINIC" position={[0, -.075, .025]} width={.56} onClick={() => runtime.recenterClinic()} />
    <XRPanelButton label="EXIT VR" position={[0, -.155, .025]} width={.56} onClick={() => { runtime.closeUtilityPanel(); onExit(); }} />
  </XRHeadPanel>;
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
