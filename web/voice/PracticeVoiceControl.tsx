import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { VoiceStatus } from "./contracts";
import { VoiceControl } from "./VoiceControl";

type PracticeVoiceControls = {
  enabled: boolean;
  visible?: boolean;
  status: VoiceStatus;
  message: string;
  partial: string;
  enable: () => Promise<boolean>;
  mute: () => void;
};

const PracticeVoiceControlContext = createContext<PracticeVoiceControls | null>(null);

export function PracticeVoiceControlProvider({ controls, children }: { controls: PracticeVoiceControls; children: ReactNode }) {
  return <PracticeVoiceControlContext.Provider value={controls}>{children}</PracticeVoiceControlContext.Provider>;
}

export function PracticeVoiceControl() {
  const controls = useContext(PracticeVoiceControlContext);
  const mute = controls?.mute;

  useEffect(() => () => mute?.(), [mute]);

  if (!controls || controls.visible === false) return null;
  return <VoiceControl enabled={controls.enabled} status={controls.status} message={controls.message} partial={controls.partial} onEnable={controls.enable} onMute={controls.mute} />;
}
