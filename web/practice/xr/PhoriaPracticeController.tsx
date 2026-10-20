import type { BatchMirror } from "./PracticeLessonUI";
import type { ClinicInputMode } from "../../interaction/useXRClinicRuntime";
import { MaddoxPracticeController } from "./MaddoxPracticeController";
import { ThoringtonPracticeController } from "./ThoringtonPracticeController";

export function PhoriaPracticeController({ kind, ...props }: {
  kind: "maddox" | "thorington";
  active: boolean;
  preview?: boolean;
  inputMode?: ClinicInputMode;
  onComplete: () => void;
  onExit: () => void;
  onMirror?: (mirror: BatchMirror) => void;
}) {
  return kind === "maddox" ? <MaddoxPracticeController {...props} /> : <ThoringtonPracticeController {...props} />;
}
