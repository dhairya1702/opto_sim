import type { RelativeAccommodationRun } from "./relativeAccommodationProcedure";
import type { MinusLensRun } from "./minusLensProcedure";
import type { PushUpRun } from "./pushUpProcedure";
import type { AccommodativeFacilityRun } from "./accommodativeFacilityProcedure";

/** Stage-specific shortcuts; the complete action menu remains available. */
export function relativeAccommodationBoardActions(run: RelativeAccommodationRun): readonly ("instruction" | "initialClear" | "report" | "plus" | "minus" | "baseline")[] {
  if (run.praCapture || run.phase === "complete") return [];
  if (!run.instructionArmed) return ["instruction"];
  if (!run.initialClearConfirmed) return ["initialClear"];
  if (!run.nraCapture) return ["report", "plus"];
  if (!run.baselineConfirmed) return run.powerD === 0 ? ["baseline"] : ["minus"];
  return ["report", "minus"];
}

export function minusLensBoardActions(run: MinusLensRun): readonly ("instruction" | "initialClear" | "report" | "add" | "remove")[] {
  if (run.capture || run.phase === "complete") return [];
  if (!run.instructionArmed) return ["instruction"];
  if (!run.initialClearConfirmed) return ["initialClear"];
  return ["report", "add", "remove"];
}

export function pushUpBoardActions(run: PushUpRun): readonly ("instruction" | "report")[] {
  if (run.capture || run.phase === "complete") return [];
  return run.instructionArmed ? ["report"] : ["instruction"];
}

export function accommodativeFacilityBoardActions(run: AccommodativeFacilityRun, inputMode: "desktop" | "xr"): readonly ("fixation" | "start" | "flip")[] {
  if (run.capture || run.phase === "complete") return [];
  if (!run.fixation) return ["fixation"];
  if (run.phase === "running") return inputMode === "desktop" ? ["flip"] : [];
  return ["start"];
}
