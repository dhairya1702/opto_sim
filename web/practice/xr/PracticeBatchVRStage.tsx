import { PhoriaPracticeController } from "./PhoriaPracticeController";
import { VergencePracticeController } from "./VergencePracticeController";
import { AccommodationPracticeController } from "./AccommodationPracticeController";
import { LIBRARY_TITLES, type LibraryKind } from "../../interaction/xrLibraryEquipment";
import { useState } from "react";
import type { BrucknerScenario } from "../../interaction/brucknerPractice";
import { PracticeVRClinic } from "./PracticeVRClinic";
import { BrucknerPracticeController } from "./BrucknerPracticeController";
import { MotilityPracticeController } from "./MotilityPracticeController";
import { KrimskyPracticeController } from "./KrimskyPracticeController";
import { CoverPracticeController } from "./CoverPracticeController";
import { WorthPracticeController } from "./WorthPracticeController";
import { StereoPracticeController } from "./StereoPracticeController";
import { FourPrismPracticeController } from "./FourPrismPracticeController";
import { BatchLessonMirror, type BatchMirror } from "./PracticeLessonUI";

type BatchKind = LibraryKind | "krimsky" | "bruckner" | "motility" | "cover-uncover" | "alternate-cover" | "worth" | "stereopsis" | "four-prism";
const titles: Record<BatchKind, string> = { ...LIBRARY_TITLES, worth: "Worth four dot", stereopsis: "Stereopsis", "four-prism": "4Δ base-out", krimsky: "Krimsky test", bruckner: "Bruckner test", motility: "Extraocular motilities", "cover-uncover": "Cover–uncover test", "alternate-cover": "Alternating cover + prism neutralisation" };
export function PracticeBatchVRStage({ kind, scenario = "equal", onClose, onDesktop, onComplete, onNext = () => undefined }: {
  kind: BatchKind; scenario?: BrucknerScenario; onClose: () => void; onDesktop: () => void; onComplete: () => void; onNext?: () => void;
}) {
  const [mirror, setMirror] = useState<BatchMirror | null>(null);
  return <PracticeVRClinic title={titles[kind]} findingPosition={mirror?.findingPosition ?? { current: kind === "bruckner" ? ["equal", "od", "os"].indexOf(scenario) + 1 : 1, total: kind === "bruckner" ? 3 : 1 }}
    onClose={onClose} onDesktop={onDesktop} mirror={mirror && <BatchLessonMirror mirror={mirror} />}>
    {({ active, preview, exit }) => {
      const common = { active, preview, onComplete, onExit: exit, onMirror: setMirror };
      return kind === "bruckner" ? <BrucknerPracticeController {...common} scenario={scenario} onNext={onNext} />
        : kind === "worth" ? <WorthPracticeController {...common} />
        : kind === "stereopsis" ? <StereoPracticeController {...common} />
        : kind === "four-prism" ? <FourPrismPracticeController {...common} />
        : kind === "maddox" || kind === "thorington" ? <PhoriaPracticeController {...common} kind={kind} />
        : kind === "npc" || kind === "horizontal-distance" || kind === "vertical-distance" || kind === "horizontal-near" || kind === "facility" ? <VergencePracticeController {...common} kind={kind} />
        : kind === "push-up" || kind === "minus-lens" || kind === "relative" || kind === "accommodative-facility" ? <AccommodationPracticeController {...common} kind={kind} />
        : kind === "krimsky" ? <KrimskyPracticeController {...common} />
        : kind === "motility" ? <MotilityPracticeController {...common} /> : <CoverPracticeController {...common} kind={kind} />;
    }}
  </PracticeVRClinic>;
}
