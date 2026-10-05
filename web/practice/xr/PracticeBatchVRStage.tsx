import { useState } from "react";
import type { BrucknerScenario } from "../../interaction/brucknerPractice";
import { PracticeVRClinic } from "./PracticeVRClinic";
import { BrucknerPracticeController } from "./BrucknerPracticeController";
import { MotilityPracticeController } from "./MotilityPracticeController";
import { KrimskyPracticeController } from "./KrimskyPracticeController";
import { CoverPracticeController } from "./CoverPracticeController";
import { BatchLessonMirror, type BatchMirror } from "./PracticeLessonUI";

type BatchKind = "krimsky" | "bruckner" | "motility" | "cover-uncover" | "alternate-cover";
const titles: Record<BatchKind, string> = { krimsky: "Krimsky test", bruckner: "Bruckner test", motility: "Extraocular motilities", "cover-uncover": "Cover–uncover test", "alternate-cover": "Alternating cover + prism neutralisation" };
export function PracticeBatchVRStage({ kind, scenario = "equal", onClose, onDesktop, onComplete, onNext = () => undefined }: {
  kind: BatchKind; scenario?: BrucknerScenario; onClose: () => void; onDesktop: () => void; onComplete: () => void; onNext?: () => void;
}) {
  const [mirror, setMirror] = useState<BatchMirror | null>(null);
  return <PracticeVRClinic title={titles[kind]} findingPosition={mirror?.findingPosition ?? { current: kind === "bruckner" ? ["equal", "od", "os"].indexOf(scenario) + 1 : 1, total: kind === "bruckner" ? 3 : 1 }}
    onClose={onClose} onDesktop={onDesktop} mirror={mirror && <BatchLessonMirror mirror={mirror} />}>
    {({ active, preview, exit }) => {
      const common = { active, preview, onComplete, onExit: exit, onMirror: setMirror };
      return kind === "bruckner" ? <BrucknerPracticeController {...common} scenario={scenario} onNext={onNext} />
        : kind === "krimsky" ? <KrimskyPracticeController {...common} />
        : kind === "motility" ? <MotilityPracticeController {...common} /> : <CoverPracticeController {...common} kind={kind} />;
    }}
  </PracticeVRClinic>;
}
