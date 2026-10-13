import { createContext, useContext, type ReactNode } from "react";
import type { VoiceStatus } from "./contracts";
import { VoiceControl } from "./VoiceControl";

type TestVoiceControls = {
  enabled: boolean;
  status: VoiceStatus;
  message: string;
  partial: string;
  enable: () => Promise<boolean>;
  mute: () => void;
};

const TestVoiceControlContext = createContext<TestVoiceControls | null>(null);

export function TestVoiceControlProvider({ controls, children }: { controls: TestVoiceControls; children: ReactNode }) {
  return <TestVoiceControlContext.Provider value={controls}>{children}</TestVoiceControlContext.Provider>;
}

export function TestVoiceControl() {
  const controls = useContext(TestVoiceControlContext);
  if (!controls) return null;
  return <VoiceControl enabled={controls.enabled} status={controls.status} message={controls.message} partial={controls.partial} onEnable={controls.enable} onMute={controls.mute} />;
}
