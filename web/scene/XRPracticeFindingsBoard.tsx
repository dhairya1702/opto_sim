import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";
import type { XRClinicRuntime } from "../interaction/useXRClinicRuntime";
import type { ConsultationToolId } from "../interaction/xrConsultationTools";

/** Practice findings live on the rear wall, to the right of the seated patient. */
export function XRPracticeFindingsBoard({ runtime, active, tools, hidden = false, forceVisible = false, children }: {
  runtime: XRClinicRuntime; active: boolean; tools: readonly ConsultationToolId[]; hidden?: boolean; forceVisible?: boolean; children: ReactNode;
}) {
  const [shown, setShown] = useState(false);
  const revisions = useRef(new Map<ConsultationToolId, number>());
  const root = useRef<Group | null>(null);
  const key = tools.join("|");
  const register = useCallback((object: Group | null) => {
    if (root.current) runtime.findingsPanels.current.delete(root.current);
    root.current = object;
    if (object) runtime.findingsPanels.current.add(object);
  }, [runtime.findingsPanels]);
  useEffect(() => {
    if (!active || tools.every(id => runtime.tools[id].revision === 0)) { setShown(false); revisions.current.clear(); return; }
    for (const id of tools) {
      const tool = runtime.tools[id];
      if (tool.placement.kind === "held" && revisions.current.get(id) !== tool.revision) {
        setShown(true);
      }
      revisions.current.set(id, tool.revision ?? 0);
    }
  }, [active, runtime.tools, key]);
  useFrame(() => { root.current?.updateMatrixWorld(true); }, -1);
  if (!active || (!shown && !forceVisible) || hidden) return null;
  return <group ref={register} position={[1.2, 1.5, -2.46]} scale={1.35} userData={{ xrPanel: true, xrPersistentFindings: true }}>{children}</group>;
}
