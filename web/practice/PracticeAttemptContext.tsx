import type { KrimskyMethod } from "../interaction/krimsky";
import { createContext, useContext, type ReactNode } from "react";

export type PracticeAttemptKind = "guided" | "test";
export type PracticeInteractionMode = "vr" | "desktop";
export type PracticeVoicePreference = "enabled" | "disabled";

export type PracticeAttemptSettings = {
  kind: PracticeAttemptKind;
  krimskyMethod?: KrimskyMethod;
  interaction: PracticeInteractionMode;
  voice: PracticeVoicePreference;
};

type PracticeAttemptContextValue = {
  settings: PracticeAttemptSettings | null;
  setSettings: (settings: PracticeAttemptSettings) => void;
  /** The mounted clinic owns live attempt resources only while it is active. */
  setAttemptActive?: (active: boolean) => void;
};

const PracticeAttemptContext = createContext<PracticeAttemptContextValue | null>(null);
const fallbackAttemptContext: PracticeAttemptContextValue = { settings: null, setSettings: () => undefined };

export function PracticeAttemptProvider({ value, children }: { value: PracticeAttemptContextValue; children: ReactNode }) {
  return <PracticeAttemptContext.Provider value={value}>{children}</PracticeAttemptContext.Provider>;
}

export function usePracticeAttempt() {
  return useContext(PracticeAttemptContext) ?? fallbackAttemptContext;
}
