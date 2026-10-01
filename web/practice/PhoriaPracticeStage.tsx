import { MaddoxPracticeStage } from "./MaddoxPracticeStage";
import { ThoringtonPracticeStage } from "./ThoringtonPracticeStage";

export type PhoriaMode = "maddox" | "thorington";

export function PhoriaPracticeStage({ mode, onClose, onComplete }: { mode: PhoriaMode; onClose: () => void; onComplete: () => void }) {
  if (mode === "maddox") return <MaddoxPracticeStage onClose={onClose} onComplete={onComplete} />;
  return <ThoringtonPracticeStage onClose={onClose} onComplete={onComplete} />;
}
