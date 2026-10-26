import { lazy, Suspense, useState } from "react";
import { ModeSelection, type ExperienceMode } from "../ui/ModeSelection";

const PracticeMode = lazy(() => import("../practice/PracticeMode").then(module => ({ default: module.PracticeMode })));
const TestEncounter = lazy(() => import("./App").then(module => ({ default: module.TestEncounter })));

function ProductLoading() {
  return <main className="mode-selection"><p className="notice" role="status">Preparing the selected learning environment…</p></main>;
}

export function EntryApp() {
  const [mode, setMode] = useState<ExperienceMode | null>(null);
  if (!mode) return <ModeSelection onSelect={setMode} />;
  return <Suspense fallback={<ProductLoading />}>
    {mode === "practice"
      ? <PracticeMode onExit={() => setMode(null)} />
      : <TestEncounter onExit={() => setMode(null)} />}
  </Suspense>;
}
