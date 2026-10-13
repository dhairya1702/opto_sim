import { Sign } from "./Models";
import type { VoiceStatus } from "../voice/contracts";
import { voiceStatusLabel } from "../voice/contracts";

export function XRVoiceIndicator({ status }: { status?: VoiceStatus }) {
  if (!status || status === "locked" || status === "error") return null;
  const visibleStatus = status === "speaking" ? "speaking" : status === "reconnecting" ? "reconnecting" : status === "muted" ? "muted" : "listening";
  return <Sign text={[voiceStatusLabel(visibleStatus)]} p={[1.06, 1.72, -2.37]} rotation={[0, 0, 0]} size={[.38, .10]} bg="#102329" fg={visibleStatus === "muted" ? "#d6b670" : "#94e0c3"} fit />;
}
