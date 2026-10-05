import { useState } from "react";
import { PracticeVRClinic } from "./xr/PracticeVRClinic";
import { HirschbergPracticeController, HIRSCHBERG_DIRECTIONS, HIRSCHBERG_LANDMARKS, type HirschbergPracticeMirror } from "./xr/HirschbergPracticeController";
import type { HirschbergPracticeFinding } from "../interaction/xrHirschbergPractice";
import type { OpticScenario } from "./ClinicalPracticeStage";
import { xrHirschbergPrompt } from "../interaction/xrPractice";

export function HirschbergVRStage({ scenario, finding, findingPosition, onClose, onDesktop, onComplete, onNext }: {
  scenario: OpticScenario; finding: HirschbergPracticeFinding;
  findingPosition: { current: number; total: number };
  onClose: () => void; onDesktop: () => void; onComplete: () => void; onNext: () => void;
}) {
  const [mirror, setMirror] = useState<HirschbergPracticeMirror | null>(null);
  return <PracticeVRClinic title="Hirschberg test" findingPosition={findingPosition} onClose={onClose} onDesktop={onDesktop}
    mirror={mirror && <>
      <p className="eyebrow">HIRSCHBERG · LIVE MIRROR</p>
      <div className="xr-technique-grid"><span className={mirror.held ? "ready" : ""}>{mirror.held ? "Penlight held" : "Find the penlight"}</span>
        <span className={mirror.light ? "ready" : ""}>Light {mirror.light ? "on" : "off"}</span>
        <span className={mirror.technique.distanceReady ? "ready" : ""}>{Math.round(mirror.technique.distanceCm)} cm</span>
        <span className={mirror.technique.ready ? "ready" : ""}>{mirror.technique.ready ? "View ready" : "Adjust technique"}</span></div>
      <button className="secondary full" onClick={mirror.giveFixation}>Ask the patient to look at the light</button>
      <button className="secondary full" onClick={mirror.toggleHelp}>{mirror.help ? "Close help" : "Help"}</button>
      {mirror.help && <p role="status">{xrHirschbergPrompt(mirror.technique, mirror)}</p>}
      <button className="primary full" onClick={mirror.openRecording}>Record finding</button>
      {mirror.recording && <>
        <label>Interpretation<select value={mirror.direction} disabled={!mirror.technique.ready || (mirror.checked && mirror.correct)} onChange={event => mirror.chooseDirection(event.target.value)}>
          <option value="">Choose after inspecting</option>{HIRSCHBERG_DIRECTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label>Approximate landmark<select value={mirror.amount} disabled={!mirror.technique.ready || (mirror.checked && mirror.correct)} onChange={event => mirror.chooseAmount(event.target.value)}>
          <option value="">Choose after inspecting</option>{HIRSCHBERG_LANDMARKS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <button className="primary full" disabled={!mirror.technique.ready || !mirror.direction || !mirror.amount || (mirror.checked && mirror.correct)} onClick={mirror.record}>Record interpretation</button>
        <button className="secondary full" onClick={mirror.cancel}>Cancel recording</button>
      </>}
      {mirror.checked && <p role="status">{mirror.correct ? finding.feedback : "Recheck the reflex position, direction rule, and landmark."}</p>}
      {mirror.checked && mirror.correct && <button className="secondary full" onClick={() => { mirror.reset(); onNext(); }}>New patient finding</button>}
      <button className="secondary full" onClick={mirror.reset}>Reset attempt / return tools</button>
    </>}>
    {({ active, preview, exit }) => <HirschbergPracticeController active={active} preview={preview} scenario={scenario} finding={finding}
      findingPosition={findingPosition} onComplete={onComplete} onNext={onNext} onExit={exit} onMirror={setMirror} />}
  </PracticeVRClinic>;
}
