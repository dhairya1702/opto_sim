import { NEAR_FUSIONAL_CASE } from "./nearFusionalVergenceProcedure";

/** Existing desktop Practice findings; fictional teaching examples, not clinical norms. */
export type VergenceEndpoint = { blur: number | null; break: number; recovery: number };
export const vergenceFindings: Record<string, Record<string, VergenceEndpoint>> = {
  "horizontal-near": NEAR_FUSIONAL_CASE.endpoints,
};
export const vergenceFacilityDelay = { BO: 850, BI: 650 } as const;

/** Existing authored illustrative gaze offsets, shared by desktop and XR renderers. */
export function prismVergenceGaze(power: number, base: string, near: boolean, vertical: boolean, broken: boolean) {
  const convergence = near ? .012 : 0, vergence = Math.min(.027, power * .00135), inward = base === "BO", direction = base === "BU" ? -1 : 1;
  return { OD: { x: vertical ? 0 : broken ? -.045 : convergence + (inward ? vergence : -vergence), y: vertical ? (broken ? .04 : vergence) * direction : 0 },
    OS: { x: vertical ? 0 : broken ? .045 : -convergence + (inward ? -vergence : vergence), y: vertical ? -(broken ? .04 : vergence) * direction : 0 } };
}
export function facilityVergenceGaze(side: string) {
  const demand = side === "BO" ? .024 : -.007;
  return { OD: { x: .012 + demand, y: 0 }, OS: { x: -.012 - demand, y: 0 } };
}
