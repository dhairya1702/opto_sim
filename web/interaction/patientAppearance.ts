import { useSyncExternalStore } from "react";

export type PatientAppearance = "current" | "detailed";
let appearance: PatientAppearance = "current";
const listeners = new Set<() => void>();
export function setPatientAppearance(value: PatientAppearance) {
  appearance = value;
  listeners.forEach(listener => listener());
}
export function usePatientAppearance() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => { listeners.delete(listener); }; },
    () => appearance, () => "current" as PatientAppearance);
}
