import { FourPrismPracticeStage } from "./FourPrismPracticeStage";
import { StereopsisPracticeStage } from "./StereopsisPracticeStage";
import { WorthPracticeStage } from "./WorthPracticeStage";

export type SensoryMode = "worth" | "stereopsis" | "four-prism";

export function SensoryPracticeStage({ mode, onClose, onComplete }: { mode: SensoryMode; onClose: () => void; onComplete: () => void }) {
  if (mode === "worth") return <WorthPracticeStage onClose={onClose} onComplete={onComplete} />;
  if (mode === "stereopsis") return <StereopsisPracticeStage onClose={onClose} onComplete={onComplete} />;
  return <FourPrismPracticeStage onClose={onClose} onComplete={onComplete} />;
}
