import { LIBRARY_TITLES, type LibraryKind } from "../../interaction/xrLibraryEquipment";
import { lazy, useState } from "react";
import type { BrucknerScenario } from "../../interaction/brucknerPractice";
import type { MotilityScenarioId } from "../../interaction/motility";
import { PracticeVRClinic } from "./PracticeVRClinic";
import { BatchLessonMirror, type BatchMirror } from "./PracticeLessonUI";
import { perfRender } from "../../perf/perfFlag";
import type { ClinicInputMode } from "../../interaction/useXRClinicRuntime";

const BrucknerPracticeController = lazy(() => import("./BrucknerPracticeController").then(module => ({ default: module.BrucknerPracticeController })));
const MotilityPracticeController = lazy(() => import("./MotilityPracticeController").then(module => ({ default: module.MotilityPracticeController })));
const KrimskyPracticeController = lazy(() => import("./KrimskyPracticeController").then(module => ({ default: module.KrimskyPracticeController })));
const CoverPracticeController = lazy(() => import("./CoverPracticeController").then(module => ({ default: module.CoverPracticeController })));
const WorthPracticeController = lazy(() => import("./WorthPracticeController").then(module => ({ default: module.WorthPracticeController })));
const StereoPracticeController = lazy(() => import("./StereoPracticeController").then(module => ({ default: module.StereoPracticeController })));
const FourPrismPracticeController = lazy(() => import("./FourPrismPracticeController").then(module => ({ default: module.FourPrismPracticeController })));
const PhoriaPracticeController = lazy(() => import("./PhoriaPracticeController").then(module => ({ default: module.PhoriaPracticeController })));
const NPCPracticeController = lazy(() => import("./NPCPracticeController").then(module => ({ default: module.NPCPracticeController })));
const FusionalVergencePracticeController = lazy(() => import("./FusionalVergencePracticeController").then(module => ({ default: module.FusionalVergencePracticeController })));
const VerticalFusionalVergencePracticeController = lazy(() => import("./VerticalFusionalVergencePracticeController").then(module => ({ default: module.VerticalFusionalVergencePracticeController })));
const NearFusionalVergencePracticeController = lazy(() => import("./NearFusionalVergencePracticeController").then(module => ({ default: module.NearFusionalVergencePracticeController })));
const VergencePracticeController = lazy(() => import("./VergencePracticeController").then(module => ({ default: module.VergencePracticeController })));
const PushUpPracticeController = lazy(() => import("./PushUpPracticeController").then(module => ({ default: module.PushUpPracticeController })));
const MinusLensPracticeController = lazy(() => import("./MinusLensPracticeController").then(module => ({ default: module.MinusLensPracticeController })));
const RelativeAccommodationPracticeController = lazy(() => import("./RelativeAccommodationPracticeController").then(module => ({ default: module.RelativeAccommodationPracticeController })));
const AccommodationPracticeController = lazy(() => import("./AccommodationPracticeController").then(module => ({ default: module.AccommodationPracticeController })));

export type BatchKind = LibraryKind | "krimsky" | "bruckner" | "motility" | "cover-uncover" | "alternate-cover" | "worth" | "stereopsis" | "four-prism";
const titles: Record<BatchKind, string> = { ...LIBRARY_TITLES, worth: "Worth four dot", stereopsis: "Stereopsis", "four-prism": "4Δ base-out", krimsky: "Krimsky test", bruckner: "Bruckner test", motility: "Extraocular motilities", "cover-uncover": "Cover–uncover test", "alternate-cover": "Alternating cover + prism neutralisation" };
export type PracticeBatchVRStageProps = {
  kind: BatchKind; scenario?: BrucknerScenario; motilityScenario?: MotilityScenarioId; onClose: () => void; onDesktop?: () => void; onComplete: () => void; onNext?: () => void; inputMode?: ClinicInputMode;
};
export function PracticeBatchVRStage({ kind, scenario = "equal", motilityScenario = "full", onClose, onDesktop, onComplete, onNext = () => undefined, inputMode = "xr" }: PracticeBatchVRStageProps) {
  perfRender("PracticeBatchVRStage");
  const [mirror, setMirror] = useState<BatchMirror | null>(null);
  return <PracticeVRClinic title={kind === "krimsky" ? mirror?.title ?? titles[kind] : titles[kind]} findingPosition={mirror?.findingPosition ?? { current: kind === "bruckner" ? ["equal", "od", "os"].indexOf(scenario) + 1 : 1, total: kind === "bruckner" ? 3 : 1 }}
    onClose={onClose} onDesktop={onDesktop} inputMode={inputMode} mirror={mirror && <BatchLessonMirror mirror={mirror} />}>
    {({ active, preview, exit, inputMode: sessionInputMode }) => {
      const common = { active, preview, onComplete, onExit: exit, onMirror: setMirror };
      return kind === "bruckner" ? <BrucknerPracticeController {...common} inputMode={sessionInputMode} scenario={scenario} onNext={onNext} />
        : kind === "worth" ? <WorthPracticeController {...common} inputMode={sessionInputMode} />
        : kind === "stereopsis" ? <StereoPracticeController {...common} inputMode={sessionInputMode} />
        : kind === "four-prism" ? <FourPrismPracticeController {...common} inputMode={sessionInputMode} />
        : kind === "maddox" || kind === "thorington" ? <PhoriaPracticeController {...common} inputMode={sessionInputMode} kind={kind} />
        : kind === "npc" ? <NPCPracticeController {...common} inputMode={sessionInputMode} />
        : kind === "horizontal-distance" ? <FusionalVergencePracticeController {...common} inputMode={sessionInputMode} />
        : kind === "vertical-distance" ? <VerticalFusionalVergencePracticeController {...common} inputMode={sessionInputMode} />
        : kind === "horizontal-near" ? <NearFusionalVergencePracticeController {...common} inputMode={sessionInputMode} />
        : kind === "facility" ? <VergencePracticeController {...common} inputMode={sessionInputMode} kind={kind} />
        : kind === "push-up" ? <PushUpPracticeController {...common} inputMode={sessionInputMode} />
        : kind === "minus-lens" ? <MinusLensPracticeController {...common} inputMode={sessionInputMode} />
        : kind === "relative" ? <RelativeAccommodationPracticeController {...common} inputMode={sessionInputMode} />
        : kind === "accommodative-facility" ? <AccommodationPracticeController {...common} inputMode={sessionInputMode} kind={kind} />
        : kind === "krimsky" ? <KrimskyPracticeController {...common} inputMode={sessionInputMode} />
        : kind === "motility" ? <MotilityPracticeController {...common} inputMode={sessionInputMode} scenarioId={motilityScenario} onNext={onNext} /> : <CoverPracticeController {...common} inputMode={sessionInputMode} kind={kind} />;
    }}
  </PracticeVRClinic>;
}
