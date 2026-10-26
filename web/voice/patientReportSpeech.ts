import thoringtonReportAudio from "../../shared/thoringtonReportAudio.json";
import reportAudio from "../../shared/maddoxReportAudio.json";
import worthReportAudio from "../../shared/worthReportAudio.json";
import { voiceAssetMatches, type VoiceAsset } from "./audioAssets";

export async function patientReportAudioUrl(text: string) {
  const asset = ({ ...reportAudio, ...thoringtonReportAudio, ...worthReportAudio } as Record<string, VoiceAsset>)[text];
  return await voiceAssetMatches(asset, text, "Charon") ? `/audio/voice/${asset.file}` : null;
}

/** File playback is independent of microphone permission and browser TTS. */
export function createPatientReportSpeaker(
  resolveAudio: (text: string) => Promise<string | null>,
  makeAudio: (url: string) => HTMLAudioElement,
  beforePlay: () => void = () => undefined,
) {
  let lastKey = "";
  let generation = 0;
  let owned: HTMLAudioElement | undefined;
  const stop = () => {
    generation++;
    if (owned) {
      owned.onended = null; owned.onerror = null;
      owned.pause(); owned.remove(); owned = undefined;
    }
  };
  return {
    async update(key: string, text: string, onError: () => void) {
      if (!key || !text) { lastKey = ""; stop(); return; }
      if (key === lastKey) return;
      lastKey = key;
      stop();
      const request = generation;
      try {
        const url = await resolveAudio(text);
        if (request !== generation) return;
        if (!url) { lastKey = ""; onError(); return; }
        const audio = makeAudio(url);
        owned = audio;
        audio.onended = () => { if (owned === audio) { owned = undefined; audio.remove(); } };
        audio.onerror = () => { if (owned === audio) { lastKey = ""; stop(); onError(); } };
        beforePlay();
        await audio.play();
      } catch {
        if (request === generation) { lastKey = ""; stop(); onError(); }
      }
    },
    stop,
  };
}
