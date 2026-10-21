import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  BookOpenCheck,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Eye,
  Flashlight,
  Glasses,
  GraduationCap,
  Hand,
  Headset,
  Keyboard,
  LockKeyhole,
  Mic,
  MicOff,
  Ruler,
} from "lucide-react";
import type { BrucknerScenario } from "../interaction/brucknerPractice";
import { motilityScenarios } from "../interaction/motility";
import { PracticeBatchVRStage } from "./xr/PracticeBatchVRStage";
import { HirschbergVRStage } from "./HirschbergVRStage";
import { useVoiceSession } from "../voice/useVoiceSession";
import { VoiceStatusContext } from "../voice/VoiceStatusContext";
import { PracticeVoiceControlProvider } from "../voice/PracticeVoiceControl";
import { PRACTICE_VOICE_ACTIONS, invokePracticeVoiceAction, type PracticeLessonId } from "../voice/practiceActions";
import type { VoiceCommand } from "../voice/contracts";
import type { ClinicInputMode } from "../interaction/useXRClinicRuntime";
import { socialVoiceReply } from "../voice/socialReplies";
import { patientVoiceReply } from "../voice/patientReplies";
import {
  PracticeAttemptProvider,
  usePracticeAttempt,
  type PracticeAttemptSettings,
  type PracticeAttemptKind,
  type PracticeInteractionMode,
  type PracticeVoicePreference,
} from "./PracticeAttemptContext";

export type AccommodationMode = "push-up" | "minus-lens" | "relative" | "accommodative-facility";
export type SensoryMode = "worth" | "stereopsis" | "four-prism";
export type PhoriaMode = "maddox" | "thorington";
export type VergenceMode = "npc" | "horizontal-distance" | "vertical-distance" | "horizontal-near" | "facility";
type SkillId = "motility" | "bruckner" | "hirschberg" | "krimsky" | "cover-uncover" | "alternate-cover" | "worth" | "stereopsis" | "four-prism" | "maddox" | "thorington" | VergenceMode | AccommodationMode;
type Skill = {
  id: SkillId;
  index: string;
  name: string;
  equipment: string;
  duration: string;
  available: boolean;
};

const skills: Skill[] = [
  { id: "motility", index: "1.1", name: "Extraocular motilities", equipment: "Penlight", duration: "6–8 min", available: true },
  { id: "bruckner", index: "1.2", name: "Bruckner test", equipment: "Direct ophthalmoscope", duration: "4–6 min", available: true },
  { id: "hirschberg", index: "1.3", name: "Hirschberg test", equipment: "Penlight", duration: "5–7 min", available: true },
  { id: "krimsky", index: "1.4", name: "Krimsky test", equipment: "Penlight + prism bar", duration: "6–8 min", available: true },
  { id: "cover-uncover", index: "1.5", name: "Cover–uncover test", equipment: "Occluder + targets", duration: "7–9 min", available: true },
  { id: "alternate-cover", index: "1.6", name: "Alternating cover test", equipment: "Occluder + prism bar", duration: "8–10 min", available: true },
  { id: "worth", index: "2.1", name: "Worth four dot", equipment: "Red–green glasses + target", duration: "6–8 min", available: true },
  { id: "stereopsis", index: "2.2", name: "Stereopsis", equipment: "Stereo booklet + glasses", duration: "6–8 min", available: true },
  { id: "four-prism", index: "2.3", name: "4Δ base-out test", equipment: "4Δ prism", duration: "6–8 min", available: true },
  { id: "maddox", index: "3.1", name: "Maddox rod method", equipment: "Maddox rod + prism", duration: "8–10 min", available: true },
  { id: "thorington", index: "3.2", name: "Modified Thorington", equipment: "Thorington card + Maddox rod", duration: "6–8 min", available: true },
  { id: "npc", index: "4.1", name: "Near point of convergence", equipment: "Near target + ruler", duration: "6–8 min", available: true },
  { id: "horizontal-distance", index: "4.2", name: "Horizontal vergence · distance", equipment: "Rotary prism", duration: "8–10 min", available: true },
  { id: "vertical-distance", index: "4.3", name: "Vertical vergence · distance", equipment: "Continuous rotary prism", duration: "6–8 min", available: true },
  { id: "horizontal-near", index: "4.4", name: "Horizontal vergence · near", equipment: "Prepared near target + continuous rotary prism", duration: "8–10 min", available: true },
  { id: "facility", index: "4.5", name: "Vergence facility · near", equipment: "12Δ BO / 3Δ BI flipper", duration: "2 min", available: true },
  {id:"push-up",index:"5.1",name:"Amplitude · push-up",equipment:"Near card + ruler",duration:"6–8 min",available:true},{id:"minus-lens",index:"5.2",name:"Amplitude · minus lens",equipment:"Near card + lenses",duration:"7–9 min",available:true},{id:"relative",index:"5.3",name:"NRA / PRA",equipment:"Near card + trial lenses",duration:"8–10 min",available:true},{id:"accommodative-facility",index:"5.4",name:"Accommodative facility",equipment:"±2.00 D flipper",duration:"2 min",available:true},
];

const practiceSection = (index: string) => ({ "1": "Motor alignment", "2": "Sensory status", "3": "Latent deviation", "4": "Vergence", "5": "Accommodation" })[index[0]] ?? "Clinical skills";

function PracticeAttemptSetup({ onDesktop, onVR }: { onDesktop: () => void; onVR: () => void; repeat?: boolean }) {
  const { setSettings } = usePracticeAttempt();
  const [kind, setKind] = useState<PracticeAttemptKind | null>(null);
  const [interaction, setInteraction] = useState<PracticeInteractionMode | null>(null);
  const [voice, setVoice] = useState<PracticeVoicePreference | null>(null);

  const start = () => {
    if (!kind || !interaction || !voice) return;
    setSettings({ kind, interaction, voice });
    if (interaction === "vr") onVR();
    else onDesktop();
  };

  return (
    <div className="practice-attempt-launcher">
      <div className="practice-action-buttons attempt-kind-buttons" aria-label="Attempt type">
        <button className={kind === "guided" ? "primary selected" : "primary"} onClick={() => { setKind("guided"); setInteraction(null); setVoice(null); }}>
          <GraduationCap size={17} /> Guided Practice
        </button>
        <button className={kind === "test" ? "secondary selected" : "secondary"} onClick={() => { setKind("test"); setInteraction(null); setVoice(null); }}>
          <BookOpenCheck size={17} /> Test
        </button>
      </div>
      {kind && (
        <div className="attempt-setup" role="group" aria-label={`${kind === "guided" ? "Guided Practice" : "Test"} setup`}>
          <div>
            <p className="eyebrow">1 · CONTROLS</p>
            <div className="attempt-option-row">
              <button className={interaction === "desktop" ? "selected" : ""} aria-pressed={interaction === "desktop"} onClick={() => setInteraction("desktop")}><Keyboard size={17} /> Keyboard + mouse</button>
              <button className={interaction === "vr" ? "selected" : ""} aria-pressed={interaction === "vr"} onClick={() => setInteraction("vr")}><Headset size={17} /> VR mode</button>
            </div>
          </div>
          <div>
            <p className="eyebrow">2 · VOICE</p>
            <div className="attempt-option-row">
              <button className={voice === "enabled" ? "selected" : ""} aria-pressed={voice === "enabled"} onClick={() => setVoice("enabled")}><Mic size={17} /> Enable voice</button>
              <button className={voice === "disabled" ? "selected" : ""} aria-pressed={voice === "disabled"} onClick={() => setVoice("disabled")}><MicOff size={17} /> Disable voice</button>
            </div>
          </div>
          <button className="primary attempt-start" disabled={!interaction || !voice} onClick={start}>
            Start {kind === "guided" ? "Guided Practice" : "Test"} <ChevronRight size={17} />
          </button>
        </div>
      )}
    </div>
  );
}

const PracticeLaunchButton = PracticeAttemptSetup;

const steps = (items: string[]) => (
  <ol className="practice-steps">
    {items.map((item, index) => <li key={item}><b>{index + 1}</b><span>{item}</span></li>)}
  </ol>
);

function TeachingBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="teaching-block"><h3>{title}</h3>{children}</section>;
}

function MotilityModule({ onComplete }: { onComplete: () => void }) {
  const [clinicMode, setClinicMode] = useState<ClinicInputMode | null>(null);
  const [complete, setComplete] = useState(false);
  const [scenarioIndex, setScenarioIndex] = useState(0);
  const scenario = motilityScenarios[scenarioIndex];
  const nextScenario = () => setScenarioIndex(index => (index + 1) % motilityScenarios.length);
  return (
    <>
      <div className="practice-lesson-head">
        <div><p className="eyebrow">BINOCULAR VISION · 1.1</p><h1>Extraocular motilities</h1><p>Assess conjugate eye movements through primary position and the eight cardinal directions of gaze.</p></div>
        <span className="lesson-equipment"><Flashlight size={18} /> Penlight · 30–40 cm</span>
      </div>
      <div className="lesson-columns">
        <div>
          <TeachingBlock title="Why this test is performed"><p>Check whether both eyes move together with a full, smooth, accurate range. Observe the corneal reflex and ask about diplopia, pain, or discomfort in every direction.</p></TeachingBlock>
          <TeachingBlock title="Procedure">
            {steps([
              "Explain the test. Ask the patient to follow the light with the eyes only, keep the head still, and report double vision, pain, or discomfort.",
              "Hold the penlight directly in front of the eyes at 30–40 cm to establish primary position.",
              "Move the target slowly through the eight cardinal directions in an H pattern with a central vertical path.",
              "Compare both eyes for the corneal reflex, smoothness, accuracy, extent, jerky movement, and nystagmus.",
              "Record FROM when movements are full, smooth, and accurate. Otherwise record the eye, direction, and observed deficit.",
            ])}
          </TeachingBlock>
          <TeachingBlock title="Escalate the finding"><p>If diplopia is reported, record the exact gaze direction and continue with diplopia charting. Do not record only “diplopia present.”</p></TeachingBlock>
        </div>
        <aside className="practice-checklist">
          <p className="eyebrow">OBSERVE THROUGHOUT</p>
          {["Head remains still", "Eyes move together", "Corneal reflexes", "Smooth pursuit", "Full extent", "Accuracy", "Diplopia", "Pain or discomfort"].map(item => <span key={item}><Check size={14} /> {item}</span>)}
          <div className="record-example"><b>Normal record</b><p>FROM; smooth and accurate OU; no diplopia, pain, or discomfort reported.</p></div>
        </aside>
      </div>
      <div className="practice-action-panel">
        <div><p className="eyebrow">FIRST-PERSON ATTEMPT</p><h2>Complete all nine gaze positions</h2><p>Choose guidance or independent testing, then select controls and voice for this motility attempt.</p></div>
        <PracticeAttemptSetup onDesktop={() => setClinicMode("desktop")} onVR={() => setClinicMode("xr")} />
      </div>
      {complete && <div className="practice-success"><CheckCircle2 size={22} /><div><b>Technique sequence complete</b><p>You covered primary position and all eight cardinal directions, asked about diplopia, and recorded an observation.</p></div></div>}
      {clinicMode && <PracticeBatchVRStage key={clinicMode} kind="motility" inputMode={clinicMode} motilityScenario={scenario.id} onNext={nextScenario} onClose={() => setClinicMode(null)} onDesktop={clinicMode === "xr" ? () => setClinicMode("desktop") : undefined} onComplete={() => { setComplete(true); onComplete(); }} />}
    </>
  );
}

function BrucknerModule({ onComplete }: { onComplete: () => void }) {
  const [clinicMode, setClinicMode] = useState<ClinicInputMode | null>(null);
  const [scenario, setScenario] = useState<BrucknerScenario>("equal");
  const next = () => {
    const order: BrucknerScenario[] = ["equal", "od", "os"];
    setScenario(order[(order.indexOf(scenario) + 1) % order.length]);
  };
  return (
    <>
      <div className="practice-lesson-head"><div><p className="eyebrow">BINOCULAR VISION · 1.2</p><h1>Bruckner test</h1><p>Compare both red reflexes simultaneously as a screening observation, especially in infants and preverbal children.</p></div><span className="lesson-equipment"><Eye size={18} /> Direct ophthalmoscope · large spot</span></div>
      <div className="lesson-columns">
        <div>
          <TeachingBlock title="Set up the test">{steps(["Ask the patient to look directly at the ophthalmoscope light.", "Use the large illumination spot from approximately 1 metre so both pupils are illuminated together.", "View both red reflexes simultaneously through the peephole.", "Compare brightness and record equal or unequal; if unequal, identify the brighter eye."])}</TeachingBlock>
          <TeachingBlock title="Interpret carefully"><p>Equal brightness supports binocular fixation in this screening observation. An unequal reflex is not a diagnosis by itself; possible explanations include strabismus, anisometropia, anisocoria, or media opacity and require further assessment.</p></TeachingBlock>
        </div>
        <aside className="practice-checklist"><p className="eyebrow">TECHNIQUE POINTS</p>{["Large illumination spot", "Approximately 1 metre", "Patient fixates the light", "Both pupils viewed together", "Name the brighter eye"].map(item => <span key={item}><Check size={14} /> {item}</span>)}</aside>
      </div>
      <div className="practice-action-panel immersive"><div><p className="eyebrow">FIRST-PERSON ATTEMPT</p><h2>Pick up the ophthalmoscope</h2><p>Choose guidance or independent testing, then select controls and voice for this Bruckner attempt.</p></div><PracticeAttemptSetup onDesktop={() => setClinicMode("desktop")} onVR={() => setClinicMode("xr")} /></div>
      {clinicMode && <PracticeBatchVRStage key={clinicMode} kind="bruckner" inputMode={clinicMode} scenario={scenario} onNext={next} onClose={() => setClinicMode(null)} onDesktop={clinicMode === "xr" ? () => setClinicMode("desktop") : undefined} onComplete={onComplete} />}
    </>
  );
}

type HirschbergScenario = { id: string; label: string; direction: string; amount: string; od: [number, number]; os: [number, number]; feedback: string };
const hirschbergScenarios: HirschbergScenario[] = [
  { id: "normal", label: "Centred OU", direction: "none", amount: "0", od: [50, 50], os: [50, 50], feedback: "Corneal reflexes are centred and symmetrical in this example." },
  { id: "exo15", label: "OD nasal reflex", direction: "exotropia", amount: "15", od: [63, 50], os: [50, 50], feedback: "The OD reflex is nasal to the pupil centre, indicating approximate exotropia. At the pupil edge, the landmark estimate is about 15°." },
  { id: "eso30", label: "OS temporal reflex", direction: "esotropia", amount: "30", od: [50, 50], os: [66, 50], feedback: "The OS reflex is temporal to the pupil centre, indicating approximate esotropia. Midway between pupil edge and limbus is about 30°." },
  { id: "hyper45", label: "OD inferior reflex", direction: "hypertropia", amount: "45", od: [50, 78], os: [50, 50], feedback: "The OD reflex is below the pupil centre, indicating hypertropia relative to the fixating eye. A reflex at the limbus is approximately 45°." },
];

function HirschbergModule({ onComplete }: { onComplete: () => void }) {
  const [index, setIndex] = useState(0);
  const [clinicMode, setClinicMode] = useState<ClinicInputMode | null>(null);
  const scenario = hirschbergScenarios[index];
  const next = () => setIndex((index + 1) % hirschbergScenarios.length);
  return (
    <>
      <div className="practice-lesson-head"><div><p className="eyebrow">BINOCULAR VISION · 1.3</p><h1>Hirschberg test</h1><p>Inspect the relative location of the corneal light reflexes to identify and approximately quantify a manifest deviation at near.</p></div><span className="lesson-equipment"><CircleDot size={18} /> Penlight · about 50 cm</span></div>
      <div className="lesson-columns">
        <div>
          <TeachingBlock title="Procedure">{steps(["Position the penlight at approximately 50 cm and ask the patient to look directly at it.", "Observe the corneal reflex in both eyes from a centred viewing position.", "Compare each reflex with the pupil centre.", "If displaced, record the deviating eye, reflex direction, inferred deviation, and approximate landmark size."])}</TeachingBlock>
          <TeachingBlock title="Direction rule"><div className="direction-grid"><span><b>Nasal reflex</b>Exotropia</span><span><b>Temporal reflex</b>Esotropia</span><span><b>Reflex above centre</b>Hypotropia</span><span><b>Reflex below centre</b>Hypertropia</span></div></TeachingBlock>
        </div>
        <aside className="practice-checklist"><p className="eyebrow">LANDMARK ESTIMATES</p><span><Ruler size={14} /> Pupil edge · ~15°</span><span><Ruler size={14} /> Midway to limbus · ~30°</span><span><Ruler size={14} /> At limbus · ~45°</span><div className="record-example"><b>Quantification note</b><p>These are approximate screening landmarks. Prism neutralisation is used when measurement is required.</p></div></aside>
      </div>
      <div className="practice-action-panel immersive"><div><p className="eyebrow">FIRST-PERSON ATTEMPT</p><h2>Perform the Hirschberg test</h2><p>Choose guidance or independent testing, then select controls and voice for this Hirschberg attempt.</p></div><PracticeAttemptSetup onDesktop={() => setClinicMode("desktop")} onVR={() => setClinicMode("xr")} /></div>
      {clinicMode && <HirschbergVRStage key={clinicMode} inputMode={clinicMode} scenario={scenario} finding={{ direction: scenario.direction, amount: scenario.amount, feedback: scenario.feedback }} findingPosition={{ current: index + 1, total: hirschbergScenarios.length }} onClose={() => setClinicMode(null)} onDesktop={clinicMode === "xr" ? () => setClinicMode("desktop") : undefined} onComplete={onComplete} onNext={next} />}
    </>
  );
}

function CoverUncoverModule({ onComplete }: { onComplete: () => void }) {
  const [clinicMode, setClinicMode] = useState<ClinicInputMode | null>(null);
  return <>
    <div className="practice-lesson-head"><div><p className="eyebrow">BINOCULAR VISION · 1.5</p><h1>Cover–uncover test</h1><p>Differentiate tropia, phoria, and orthophoria by observing exactly when an eye takes up fixation.</p></div><span className="lesson-equipment"><Hand size={18} /> Occluder · distance and near</span></div>
    <div className="lesson-columns"><div>
      <TeachingBlock title="What the movement means"><p>Watch the eye that remains visible while its fellow eye is covered. Movement of that uncovered eye to take fixation indicates a tropia. Then watch immediately as the cover is removed: movement on uncovering reveals a phoria that had been controlled by fusion. No movement on covering or uncovering supports orthophoria.</p></TeachingBlock>
      <TeachingBlock title="Procedure">{steps(["Use the patient’s best refractive correction and establish fixation on an isolated distance target.", "Cover the fixating eye for a few seconds and watch the uncovered eye for movement.", "Remove the occluder and immediately watch the eye that has just been uncovered.", "Repeat the same cover and uncover observations with the fellow eye.", "Classify the timing of movement as tropia, phoria, or no observed deviation.", "Repeat the full procedure using an accommodative near target at 40 cm."])}</TeachingBlock>
      <TeachingBlock title="Unilateral versus alternating tropia"><p>If the uncovered eye takes fixation but returns to its deviated position when the habitual fixating eye is uncovered, the tropia is unilateral in that deviating eye. If the newly fixating eye retains fixation and the fellow eye assumes the deviated position, the tropia is alternating.</p></TeachingBlock>
    </div><aside className="practice-checklist"><p className="eyebrow">WATCH THE TIMING</p>{["Patient maintains fixation", "Observe the eye not covered", "Observe immediately on uncovering", "Cover each eye separately", "Repeat at near · 40 cm", "Keep the occluder clear between trials"].map(item => <span key={item}><Check size={14} /> {item}</span>)}<div className="record-example"><b>Core distinction</b><p>Movement on cover → tropia. Movement on uncover → phoria. No movement → orthophoria.</p></div></aside></div>
    <div className="practice-action-panel immersive"><div><p className="eyebrow">FIRST-PERSON ATTEMPT</p><h2>Control the occluder and watch the eyes</h2><p>Choose guidance or independent testing, then select controls and voice for this cover-test attempt.</p></div><PracticeAttemptSetup onDesktop={() => setClinicMode("desktop")} onVR={() => setClinicMode("xr")} /></div>
    {clinicMode && <PracticeBatchVRStage key={clinicMode} kind="cover-uncover" inputMode={clinicMode} onClose={() => setClinicMode(null)} onDesktop={clinicMode === "xr" ? () => setClinicMode("desktop") : undefined} onComplete={onComplete} />}
  </>;
}

function AlternateCoverModule({ onComplete }: { onComplete: () => void }) {
  const [clinicMode, setClinicMode] = useState<ClinicInputMode | null>(null);
  return <>
    <div className="practice-lesson-head"><div><p className="eyebrow">BINOCULAR VISION · 1.6</p><h1>Alternating cover test</h1><p>Break fusion, determine the direction of deviation, and measure its magnitude by prism neutralisation.</p></div><span className="lesson-equipment"><Hand size={18} /> Occluder + prism bar</span></div>
    <div className="lesson-columns"><div>
      <TeachingBlock title="Procedure">{steps(["Use the same fixation setup as the cover test and ask the patient to maintain fixation.", "Cover one eye, then shift the occluder directly to the fellow eye after a few seconds.", "Continue alternating several times without leaving both eyes uncovered, so fusion remains disrupted.", "Observe the direction of refixation movement and infer the direction of deviation.", "Place a prism bar before either eye with the appropriate base direction.", "Increase prism power gradually and repeat alternating cover until no refixation movement is seen.", "Record the neutralising prism as the magnitude of deviation and repeat for near."])}</TeachingBlock>
      <TeachingBlock title="Movement, deviation, and prism"><div className="direction-grid"><span><b>Eye moves in</b>Exo · base-in prism</span><span><b>Eye moves out</b>Eso · base-out prism</span><span><b>Eye moves up</b>Hypo · base-up prism</span><span><b>Eye moves down</b>Hyper · base-down prism</span></div><p>Horizontal deviations move both eyes the same way. A vertical deviation moves the eyes in opposite directions: in a right hypo, OD moves up and OS moves down when each is uncovered. Record it by eye (R hypo is the same as L hyper) and neutralise with base up before the hypo eye or base down before the hyper eye. In this trainer, record OD’s movement.</p></TeachingBlock>
    </div><aside className="practice-checklist"><p className="eyebrow">TECHNIQUE POINTS</p>{["Never expose both eyes between shifts", "Alternate several times", "Name movement direction first", "Prism can be placed before either eye", "Increase power gradually", "Endpoint is no movement", "Repeat with a near target"].map(item => <span key={item}><Check size={14} /> {item}</span>)}</aside></div>
    <div className="practice-action-panel immersive"><div><p className="eyebrow">FIRST-PERSON ATTEMPT</p><h2>Alternate, add prism, and neutralise</h2><p>Choose guidance or independent testing, then select controls and voice for this alternating-cover attempt.</p></div><PracticeAttemptSetup onDesktop={() => setClinicMode("desktop")} onVR={() => setClinicMode("xr")} /></div>
    {clinicMode && <PracticeBatchVRStage key={clinicMode} kind="alternate-cover" inputMode={clinicMode} onClose={() => setClinicMode(null)} onDesktop={clinicMode === "xr" ? () => setClinicMode("desktop") : undefined} onComplete={onComplete} />}
  </>;
}

function SensoryModule({ mode, onComplete }: { mode: SensoryMode; onComplete: () => void }) {
  const [clinicMode, setClinicMode] = useState<ClinicInputMode | null>(null);
  const data = mode === "worth" ? {
    index: "2.1", title: "Worth four dot test", intro: "Assess fusion, suppression, and diplopia at different viewing distances.", equipment: "Red OD · green OS · four-dot target",
    procedure: ["Place red–green glasses over habitual correction: red before OD and green before OS.", "Check that the filters correctly cancel the target colours.", "Present the diamond target at different distances and maintain fixation.", "Ask how many dots are seen, their colours, and their relative positions.", "Interpret fusion, suppression, or diplopia from the full response and record the test distance."],
    note: "Four dots indicate flat fusion. Two red dots indicate OS suppression; three green indicate OD suppression. Five dots indicate diplopia: red right of green is eso/uncrossed, red left is exo/crossed, red above is left hyper, and red below is right hyper.",
  } : mode === "stereopsis" ? {
    index: "2.2", title: "Stereopsis", intro: "Measure the finest binocular depth discrimination the patient can identify.", equipment: "Stereo booklet · near correction · 40 cm",
    procedure: ["Place Polaroid or red–green glasses over the near correction.", "Hold the stereo booklet at 40 cm.", "Begin with the largest disparity and ask which circle floats above the booklet plane.", "Continue to progressively finer target sets.", "Stop after two consecutive incorrect responses.", "Record seconds of arc for the last correct response before those two errors."],
    note: "Stereopsis is the final grade of binocular vision after simultaneous perception and fusion. Smaller seconds-of-arc values represent finer stereoscopic discrimination.",
  } : {
    index: "2.3", title: "Four prism diopter base-out test", intro: "Look for a small central suppression scotoma by observing version and refixation responses.", equipment: "4Δ base-out prism · distance target",
    procedure: ["Use best distance correction and isolate a letter one acuity line above the poorer eye’s best acuity.", "Ask the patient to keep the letter single.", "Place a 4Δ base-out prism before the better eye and watch the fellow eye.", "Keep the prism in place long enough to observe whether inward refixation follows the outward movement.", "Shift the prism to the fellow eye and again watch carefully.", "Record the response from both prism placements."],
    note: "Normal: the fellow eye moves outward and then inward to refixate with prism before either eye. Suppression: prism before the better eye produces outward movement without inward refixation; prism before the suppressing eye produces no movement.",
  };
  return <><div className="practice-lesson-head"><div><p className="eyebrow">SENSORY STATUS · {data.index}</p><h1>{data.title}</h1><p>{data.intro}</p></div><span className="lesson-equipment"><Eye size={18}/>{data.equipment}</span></div><div className="lesson-columns"><div><TeachingBlock title="Procedure">{steps(data.procedure)}</TeachingBlock><TeachingBlock title="Interpretation"><p>{data.note}</p></TeachingBlock></div><aside className="practice-checklist"><p className="eyebrow">SENSORY SEQUENCE</p>{["Best/habitual correction", "Correct viewing equipment", "Fixation maintained", "Response elicited precisely", "Finding recorded with test conditions"].map(item=><span key={item}><Check size={14}/>{item}</span>)}</aside></div><div className="practice-action-panel immersive"><div><p className="eyebrow">FIRST-PERSON ATTEMPT</p><h2>Perform the sensory assessment</h2><p>Choose guidance or independent testing, then select controls and voice for this sensory-test attempt.</p></div><div className="practice-action-buttons"><PracticeLaunchButton onDesktop={()=>setClinicMode("desktop")} onVR={() => setClinicMode("xr")} /></div></div>{clinicMode&&<PracticeBatchVRStage key={clinicMode} kind={mode} inputMode={clinicMode} onClose={()=>setClinicMode(null)} onDesktop={clinicMode==="xr"?()=>setClinicMode("desktop"):undefined} onComplete={onComplete}/>}</>;
}

function PhoriaModule({ mode, onComplete }: { mode: PhoriaMode; onComplete: () => void }) {
  const [clinicMode,setClinicMode]=useState<ClinicInputMode|null>(null); const maddox=mode==="maddox";
  return <><div className="practice-lesson-head"><div><p className="eyebrow">LATENT DEVIATION · {maddox?"3.1":"3.2"}</p><h1>{maddox?"Maddox rod method":"Modified Thorington method"}</h1><p>{maddox?"Measure horizontal and vertical phoria at distance and near by prism neutralisation.":"Measure horizontal and vertical near phoria directly from a numbered card at 40 cm."}</p></div><span className="lesson-equipment"><Glasses size={18}/>{maddox?"Maddox rod + stepped prism bar":"Maddox rod + Thorington card"}</span></div><div className="lesson-columns"><div><TeachingBlock title="Procedure">{steps(maddox?["Fit habitual correction, then physically orient and fit the Maddox rod before OD.","Remove, roll and refit the rod: horizontal grooves create the vertical streak for lateral measurement; vertical grooves create the horizontal streak for vertical measurement.","At distance, place the point target on the Distance Target Dock beside Arun, switch it on and confirm the point in the mirror. At near, hold the lit penlight at 38–42 cm with one hand and the prism bar with the other.","Ask Arun to report the streak/light relationship. Centre the 20Δ cell first, then slide through the stepped cells while preserving the required base arrow.","Use the prism-hand trigger to capture coincidence, put the tools down and independently record prism power plus BI/BO/BU/BD."]:["Place usual near correction and a Maddox rod before OD.","Use horizontal grooves for lateral measurement or vertical grooves for vertical measurement.","Hold the Thorington card at 40 cm with the penlight through its centre.","Ask which numbered line the streak passes through and its position relative to the light.","Record magnitude and direction; repeat with the vertically oriented card for vertical phoria."])}</TeachingBlock><TeachingBlock title="Interpretation"><p>{maddox?"The neutralising prism value and base orientation are the phoria measurement. This draft uses the stepped 2, 4, 6, 8, 10, 12, 15 and 20Δ teaching cells; its optical responses and handling tolerances are illustrative.":"Horizontal: streak right of light indicates esophoria; left indicates exophoria. Vertical: through the light is orthophoria; above indicates left hyperphoria and below indicates right hyperphoria. Each numbered interval at 40 cm represents one prism dioptre."}</p></TeachingBlock></div><aside className="practice-checklist"><p className="eyebrow">TECHNIQUE POINTS</p>{["Correction worn","Maddox rod before OD","Remove, roll and refit grooves",maddox?"Mirrored distance + held near penlight":"Card exactly 40 cm",maddox?"20Δ then stepped reduction":"Read number and direction","Record prism dioptres + direction"].map(i=><span key={i}><Check size={14}/>{i}</span>)}</aside></div><div className="practice-action-panel immersive"><div><p className="eyebrow">FIRST-PERSON ATTEMPT</p><h2>{maddox?"Neutralise the streak and spot":"Measure directly from the card"}</h2><p>Choose guidance or independent testing, then select controls and voice for this phoria attempt.</p></div><div className="practice-action-buttons"><PracticeLaunchButton onDesktop={()=>setClinicMode("desktop")} onVR={() => setClinicMode("xr")} /></div></div>{clinicMode&&<PracticeBatchVRStage key={clinicMode} kind={mode} inputMode={clinicMode} onClose={()=>setClinicMode(null)} onDesktop={clinicMode==="xr"?()=>setClinicMode("desktop"):undefined} onComplete={onComplete}/>}</>;
}

function VergenceModule({mode,onComplete}:{mode:VergenceMode;onComplete:()=>void}) {
  const [clinicMode,setClinicMode]=useState<ClinicInputMode|null>(null);
  const d:{[K in VergenceMode]:[string,string,string,string]}={
    npc:["4.1","Near point of convergence","Dock a RAF-style rule at the spectacle plane; complete three inward break and outward recovery trials.","Endpoints depend on the observation method and full measurement context. This draft teaches documentation without assigning a diagnosis."],
    "horizontal-distance":["4.2","Horizontal fusional vergences at distance","Use a continuous rotary prism before OD; test BI before BO and independently record blur, break, and recovery.","Record X when no blur is reported before break. Endpoint powers remain concealed until acquired."],
    "vertical-distance":["4.3","Vertical fusional vergences at distance","Use a continuous rotary prism before OD; complete one BU run followed by one BD run and independently record break and recovery.","The four endpoint powers remain concealed until acquired. This fictional pattern is not a reference range or diagnosis."],
    "horizontal-near":["4.4","Horizontal fusional vergences at near","Use a continuous rotary prism before OD with a supported prepared near target; test BI before BO and independently record blur, break, and recovery.","Endpoint powers remain concealed until acquired. This fictional pattern is not a reference range or diagnosis."],
    facility:["4.5","Fusional vergence facility at near","Flip 12Δ BO and 3Δ BI after each clear-and-single response.","Reference: 15 full cycles per minute"]};
  const x=d[mode], npc=mode==="npc", horizontalDistance=mode==="horizontal-distance", verticalDistance=mode==="vertical-distance", horizontalNear=mode==="horizontal-near", rotary=horizontalDistance||verticalDistance||horizontalNear;
  const procedure=npc?"Fit the appropriate near correction, align the patient-facing target on the binocular midline at 38–42 cm, give the clear-and-single instruction, then move at about 1–2 cm/s. Capture one break and one recovery per trial and independently record all three pairs."
    :horizontalDistance?"Fit distance correction, establish the illustrative mirrored 6 m target, explain sustained blur, diplopia, and recovery reporting, hold zero-demand fixation, then change demand smoothly at about 1–2Δ/s. Reports capture automatically; return to zero and confirm re-fusion before BO."
    :verticalDistance?"Fit distance correction and use the prepared illustrative mirrored isolated target one line larger than the poorer eye’s best-corrected acuity. Ask for sustained diplopia and recovery to single, hold zero BU, move about 1–2Δ/s, return to zero, then physically roll to BD and repeat."
    :horizontalNear?"Fit appropriate near correction and support the prepared patient-facing isolated target one line larger than the poorer eye’s best-corrected near acuity at 38–42 cm. Explain blur, diplopia, and recovery reporting, then move about 1–2Δ/s through BI before BO."
    :"Use appropriate correction and an isolated target one line larger than the poorer eye’s best acuity. Explain blur, diplopia, and recovery reporting before changing demand.";
  const checklist=npc?["Appropriate near correction","Spectacle-plane origin","38–42 cm stable start","Three break/recovery trials","Subjective or objective detection","Independent decimal entry"]
    :horizontalDistance?["Appropriate distance correction","Mirrored isolated target","Patient-facing aperture before OD","BI before BO","Smooth increase and recovery","Six blank independent fields"]
    :verticalDistance?["Appropriate distance correction","Prepared mirrored isolated target","Patient-facing aperture before OD","Physical BU then BD roll","Smooth increase and recovery","Four blank independent fields"]
    :horizontalNear?["Appropriate near correction","Prepared target on 40 cm stand","Patient-facing aperture before OD","Physical BI then BO roll","Smooth blur, break and recovery","Six blank independent fields"]
    :["Appropriate correction","Fixation maintained","Increase demand gradually","Separate blur and break","Reverse to recovery","Record base + values"];
  return <><div className="practice-lesson-head"><div><p className="eyebrow">VERGENCE · {x[0]}</p><h1>{x[1]}</h1><p>{x[2]}</p></div><span className="lesson-equipment"><Eye size={18}/>{npc?"RAF-style rule":rotary?"Continuous rotary prism":"Vergence assessment"}</span></div>
    <div className="lesson-columns"><div><TeachingBlock title="Procedure"><p>{x[2]} {procedure}</p></TeachingBlock><TeachingBlock title={npc?"Method-dependent teaching":rotary?"Notation":"Reference findings"}><p>{x[3]}</p></TeachingBlock></div><aside className="practice-checklist"><p className="eyebrow">RECORD</p>{checklist.map(v=><span key={v}><Check size={14}/>{v}</span>)}</aside></div>
    <div className="practice-action-panel immersive"><div><p className="eyebrow">FIRST-PERSON ATTEMPT</p><h2>{npc?"Measure with the RAF-style rule":rotary?"Measure with the rotary prism":"Measure the vergence response"}</h2><p>Choose guidance or independent testing, then select controls and voice for this vergence attempt.</p></div><div className="practice-action-buttons"><PracticeLaunchButton onDesktop={()=>setClinicMode("desktop")} onVR={() => setClinicMode("xr")} /></div></div>
    {clinicMode&&<PracticeBatchVRStage key={clinicMode} kind={mode} inputMode={clinicMode} onClose={()=>setClinicMode(null)} onDesktop={clinicMode==="xr"?()=>setClinicMode("desktop"):undefined} onComplete={onComplete}/>}</>;
}

function AccommodationModule({mode,onComplete}:{mode:AccommodationMode;onComplete:()=>void}){const[clinicMode,setClinicMode]=useState<ClinicInputMode|null>(null);const d={"push-up":["5.1","Amplitude of accommodation · push-up","Move the near card closer until first sustained blur; measure NPA from the spectacle plane and convert with 100/cm."],"minus-lens":["5.2","Amplitude · minus lens to blur","At 40 cm add −0.25 D monocularly until sustained blur; amplitude is minus added plus 2.50 D."],relative:["5.3","Negative and positive relative accommodation","At 40 cm add +0.25 D binocularly to NRA blur, return to baseline, then −0.25 D to PRA blur."],"accommodative-facility":["5.4","Accommodative facility","At 40 cm flip ±2.00 D after each clear report; one plus/minus pair is one cycle."]}[mode];return <><div className="practice-lesson-head"><div><p className="eyebrow">ACCOMMODATION · {d[0]}</p><h1>{d[1]}</h1><p>{d[2]}</p></div></div><div className="lesson-columns"><div><TeachingBlock title="Procedure"><p>{d[2]} Test OD, OS, and binocularly where specified, using correction and a line one larger than best near acuity.</p></TeachingBlock><TeachingBlock title="Reference"><p>Hofstetter: minimum 15−0.25(age), average 18.5−0.30(age), maximum 25−0.40(age). Monocular amplitudes should be within 1 D. Adult facility references: 11 cpm monocular and 10 cpm binocular.</p></TeachingBlock></div></div><div className="practice-action-panel immersive"><div><p className="eyebrow">FIRST-PERSON ATTEMPT</p><h2>Perform the accommodation test</h2><p>Choose guidance or independent testing, then select controls and voice for this accommodation attempt.</p></div><div className="practice-action-buttons"><PracticeLaunchButton onDesktop={()=>setClinicMode("desktop")} onVR={() => setClinicMode("xr")} /></div></div>{clinicMode&&<PracticeBatchVRStage key={clinicMode} kind={mode} inputMode={clinicMode} onClose={()=>setClinicMode(null)} onDesktop={clinicMode==="xr"?()=>setClinicMode("desktop"):undefined} onComplete={onComplete}/>}</>}
function KrimskyModule({ onComplete }: { onComplete: () => void }) {
  const [clinicMode, setClinicMode] = useState<ClinicInputMode | null>(null);
  return <><div className="practice-lesson-head"><div><p className="eyebrow">BINOCULAR VISION · 1.4</p><h1>Krimsky test</h1><p>Extend the Hirschberg observation by matching corneal reflex positions with a neutralising prism.</p></div></div><TeachingBlock title="Procedure">{steps(["Ask the patient to fixate the penlight at approximately 50 cm and compare the corneal reflexes.", "View with one examiner eye to reduce parallax.", "For Krimsky, place the prism before the deviating eye. In this trainer, OS deviates and OD fixates.", "Choose base in for an exodeviation or base out for an esodeviation. Increase prism until the reflexes match in relative position.", "Record prism power, base, eye, working distance and method.", "For modified Krimsky, place the prism before the fixating eye. This variant is useful when the deviating eye provides an unreliable reflex or has very poor acuity."])}</TeachingBlock><p>The trainer uses the supplied source’s naming convention. Clinical terminology and the illustrative optical model require clinician review.</p><div className="practice-action-panel immersive"><div><p className="eyebrow">FIRST-PERSON ATTEMPT</p><h2>Neutralise the corneal reflex displacement</h2><p>Choose guidance or independent testing, then select controls and voice for this Krimsky attempt.</p></div><div className="practice-action-buttons"><PracticeLaunchButton onDesktop={() => setClinicMode("desktop")} onVR={() => setClinicMode("xr")} /></div></div>{clinicMode && <PracticeBatchVRStage key={clinicMode} kind="krimsky" inputMode={clinicMode} onClose={() => setClinicMode(null)} onDesktop={clinicMode === "xr" ? () => setClinicMode("desktop") : undefined} onComplete={onComplete} />}</>;
}

export function PracticeMode({ onExit }: { onExit: () => void }) {
  const [selected, setSelected] = useState<SkillId>("motility");
  const [completed, setCompleted] = useState<SkillId[]>([]);
  const [attemptSettings, setAttemptSettings] = useState<PracticeAttemptSettings | null>(null);
  const voiceSessionId = useRef(crypto.randomUUID());
  const voiceContext = useMemo(() => ({
    mode: "practice" as const,
    sessionId: voiceSessionId.current,
    lessonId: selected,
    allowedActions: PRACTICE_VOICE_ACTIONS[selected as PracticeLessonId].map(action => action.id),
  }), [selected]);
  const handleVoiceCommand = useCallback((command: VoiceCommand) => {
    if (command.kind === "social") return socialVoiceReply(command.socialId);
    if (command.kind === "patient-reply") return patientVoiceReply(command.replyId);
    if (command.kind !== "practice-action" || command.lessonId !== selected)
      return { accepted: false, spokenText: "That voice action is not available in this lesson.", errorCode: "LESSON_MISMATCH" };
    return invokePracticeVoiceAction(selected as PracticeLessonId, command.actionId);
  }, [selected]);
  const voice = useVoiceSession(voiceContext, handleVoiceCommand);
  const lastVoiceChoice = useRef<PracticeVoicePreference | null>(null);
  useEffect(() => {
    const choice = attemptSettings?.voice ?? null;
    if (!choice || choice === lastVoiceChoice.current) return;
    lastVoiceChoice.current = choice;
    if (choice === "enabled") void voice.enable();
    else voice.mute();
  }, [attemptSettings, voice.enable, voice.mute]);
  useEffect(() => {
    setAttemptSettings(null);
    lastVoiceChoice.current = null;
  }, [selected]);
  const updateAttemptSettings = useCallback((next: PracticeAttemptSettings) => {
    lastVoiceChoice.current = null;
    setAttemptSettings(next);
  }, []);
  const attemptContext = useMemo(() => ({ settings: attemptSettings, setSettings: updateAttemptSettings }), [attemptSettings, updateAttemptSettings]);
  const voiceControls = useMemo(() => ({ ...voice, visible: attemptSettings?.voice === "enabled" }), [attemptSettings?.voice, voice]);
  const complete = (id: SkillId) => setCompleted(items => items.includes(id) ? items : [...items, id]);
  const skill = skills.find(item => item.id === selected)!;
  const selectedIndex = skills.findIndex(item => item.id === selected);
  const nextSkill = [...skills.slice(selectedIndex + 1), ...skills.slice(0, selectedIndex)].find(item => item.available && !completed.includes(item.id));
  const allComplete = completed.length === skills.filter(item => item.available).length;
  const completionTitle = attemptSettings?.kind === "test"
    ? "Test attempt complete"
    : allComplete ? "Guided Practice session complete" : "Guided module complete";
  const completionCopy = attemptSettings?.kind === "test"
    ? "This independent test attempt is complete. You can repeat it or choose another skill."
    : allComplete
      ? "All available modules have been practised in this session. Choose any skill from the library to repeat it."
      : "This module is marked practised for the current session. You can repeat it at any time.";
  return (
    <PracticeAttemptProvider value={attemptContext}>
    <PracticeVoiceControlProvider controls={voiceControls}>
    <VoiceStatusContext.Provider value={voice.status}>
    <main className={`practice-shell ${attemptSettings?.kind === "test" ? "practice-test-attempt" : ""}`}>
      <header className="practice-header"><button className="practice-wordmark" onClick={onExit}><span>opto<span className="wordmark-dot">.</span></span><small>Practice</small></button><div className="practice-progress"><GraduationCap size={18} /><span>Binocular vision</span><progress aria-label="Practice modules completed" value={completed.length} max={skills.filter(item => item.available).length} /><b>{completed.length}/{skills.filter(item => item.available).length} modules practised</b></div><button className="secondary" onClick={onExit}><ArrowLeft size={16} /> Modes</button></header>
      <div className="practice-layout">
        <aside className="practice-nav"><p className="eyebrow">PRACTICE LIBRARY</p><h2>Assessment of binocular vision</h2><p className="small muted">Choose a test to learn its purpose, sequence, observations, and recording.</p><nav>{skills.map((item, index) => <Fragment key={item.id}>{(index === 0 || practiceSection(skills[index - 1].index) !== practiceSection(item.index)) && <p className="practice-nav-section">{practiceSection(item.index)}</p>}<button disabled={!item.available} className={selected === item.id ? "selected" : ""} onClick={() => setSelected(item.id)}><span className="practice-index">{item.index}</span><span><b>{item.name}</b><small>{item.equipment} · {item.duration}</small></span>{completed.includes(item.id) ? <CheckCircle2 className="completed-icon" size={17} /> : item.available ? <ChevronRight size={16} /> : <LockKeyhole size={15} />}</button></Fragment>)}</nav><div className="practice-scope"><b>Training scope</b><p>Guided educational simulations. They support supervised learning and do not certify clinical technique.</p></div></aside>
        <article className="practice-content" key={selected}>
          {skill.available && selected === "motility" && <MotilityModule onComplete={() => complete("motility")} />}
          {skill.available && selected === "bruckner" && <BrucknerModule onComplete={() => complete("bruckner")} />}
          {skill.available && selected === "hirschberg" && <HirschbergModule onComplete={() => complete("hirschberg")} />}
          {skill.available && selected === "krimsky" && <KrimskyModule onComplete={() => complete("krimsky")} />}
          {skill.available && selected === "cover-uncover" && <CoverUncoverModule onComplete={() => complete("cover-uncover")} />}
          {skill.available && selected === "alternate-cover" && <AlternateCoverModule onComplete={() => complete("alternate-cover")} />}
          {skill.available && selected === "worth" && <SensoryModule mode="worth" onComplete={() => complete("worth")} />}
          {skill.available && selected === "stereopsis" && <SensoryModule mode="stereopsis" onComplete={() => complete("stereopsis")} />}
          {skill.available && selected === "four-prism" && <SensoryModule mode="four-prism" onComplete={() => complete("four-prism")} />}
          {skill.available && selected === "maddox" && <PhoriaModule mode="maddox" onComplete={() => complete("maddox")} />}
          {skill.available && selected === "thorington" && <PhoriaModule mode="thorington" onComplete={() => complete("thorington")} />}
          {skill.available && selected === "npc" && <VergenceModule mode="npc" onComplete={() => complete("npc")} />}
          {skill.available && selected === "horizontal-distance" && <VergenceModule mode="horizontal-distance" onComplete={() => complete("horizontal-distance")} />}
          {skill.available && selected === "vertical-distance" && <VergenceModule mode="vertical-distance" onComplete={() => complete("vertical-distance")} />}
          {skill.available && selected === "horizontal-near" && <VergenceModule mode="horizontal-near" onComplete={() => complete("horizontal-near")} />}
          {skill.available && selected === "facility" && <VergenceModule mode="facility" onComplete={() => complete("facility")} />}
          {skill.available && selected === "push-up" && <AccommodationModule mode="push-up" onComplete={() => complete("push-up")} />}
          {skill.available && selected === "minus-lens" && <AccommodationModule mode="minus-lens" onComplete={() => complete("minus-lens")} />}
          {skill.available && selected === "relative" && <AccommodationModule mode="relative" onComplete={() => complete("relative")} />}
          {skill.available && selected === "accommodative-facility" && <AccommodationModule mode="accommodative-facility" onComplete={() => complete("accommodative-facility")} />}
          {completed.includes(selected) && <section className="practice-module-complete" aria-live="polite"><CheckCircle2 size={22} /><div><b>{completionTitle}</b><p>{completionCopy}</p></div>{nextSkill && <button className="primary" onClick={() => setSelected(nextSkill.id)}>Next uncompleted · {nextSkill.name}<ChevronRight size={16} /></button>}</section>}
        </article>
      </div>
    </main>
    </VoiceStatusContext.Provider>
    </PracticeVoiceControlProvider>
    </PracticeAttemptProvider>
  );
}
