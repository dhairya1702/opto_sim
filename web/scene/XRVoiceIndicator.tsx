import { Sign } from "./Models";
import type { VoiceStatus } from "../voice/contracts";
import { voiceStatusLabel } from "../voice/contracts";

export function XRVoiceIndicator({ status }: { status?: VoiceStatus }) {
  if (!status || status === "locked" || status === "error") return null;
  const visibleStatus = status === "speaking" ? "speaking" : status === "reconnecting" ? "reconnecting" : status === "muted" ? "muted" : "listening";
  return <group position={[0, 2.76, -2.47]} userData={{ xrVoiceIndicator: true }}>
    <Sign text={[voiceStatusLabel(visibleStatus)]} p={[0, 0, 0]} rotation={[0, 0, 0]} size={[.38, .10]}
      bg="#102329" fg={visibleStatus === "muted" ? "#d6b670" : "#94e0c3"} fit />
  </group>;
}
