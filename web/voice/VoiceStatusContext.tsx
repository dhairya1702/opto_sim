import { createContext, useContext } from "react";
import type { VoiceStatus } from "./contracts";

export const VoiceStatusContext = createContext<VoiceStatus | undefined>(undefined);
export const useVoiceStatus = () => useContext(VoiceStatusContext);
