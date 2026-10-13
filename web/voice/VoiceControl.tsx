import { Mic, MicOff } from "lucide-react";
import type { VoiceStatus } from "./contracts";
import { voiceStatusLabel } from "./contracts";

export function VoiceControl({ enabled, status, message, partial, onEnable, onMute }: {
  enabled: boolean; status: VoiceStatus; message: string; partial?: string;
  onEnable: () => Promise<boolean>; onMute: () => void;
}) {
  const active = !["locked", "muted", "error"].includes(status);
  return <div className="voice-control">
    <button type="button" className={active ? "voice-button active" : "voice-button"} disabled={!enabled} title={message} onClick={() => active ? onMute() : void onEnable()}>
      {active ? <Mic size={16} /> : <MicOff size={16} />} {active ? voiceStatusLabel(status) : "Enable voice"}
    </button>
    {!active && status === "error" && <span className="voice-error" role="status">{message}</span>}
    {active && partial && <span className="voice-partial" aria-live="polite">Hearing speech…</span>}
  </div>;
}
