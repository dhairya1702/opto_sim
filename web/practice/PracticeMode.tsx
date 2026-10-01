import { Fragment, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Eye,
  Flashlight,
  Glasses,
  GraduationCap,
  Hand,
  LockKeyhole,
  Maximize2,
  RotateCcw,
  Ruler,
} from "lucide-react";
import { MotilityExamination } from "../scene/MotilityExamination";
import { ClinicalPracticeStage } from "./ClinicalPracticeStage";
import { CoverPracticeStage } from "./CoverPracticeStage";
import { SensoryPracticeStage, type SensoryMode } from "./SensoryPracticeStage";
import { PhoriaPracticeStage, type PhoriaMode } from "./PhoriaPracticeStage";
import { VergencePracticeStage, type VergenceMode } from "./VergencePracticeStage";
import { AccommodationPracticeStage, type AccommodationMode } from "./AccommodationPracticeStage";
import { KrimskyPracticeStage } from "./KrimskyPracticeStage";

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
  { id: "motility", index: "3.1", name: "Extraocular motilities", equipment: "Penlight", duration: "6–8 min", available: true },
  { id: "bruckner", index: "3.2", name: "Bruckner test", equipment: "Direct ophthalmoscope", duration: "4–6 min", available: true },
  { id: "hirschberg", index: "3.3", name: "Hirschberg test", equipment: "Penlight", duration: "5–7 min", available: true },
  { id: "krimsky", index: "3.4", name: "Krimsky test", equipment: "Penlight + prism bar", duration: "6–8 min", available: true },
  { id: "cover-uncover", index: "3.6", name: "Cover–uncover test", equipment: "Occluder + targets", duration: "7–9 min", available: true },
  { id: "alternate-cover", index: "3.7", name: "Alternating cover test", equipment: "Occluder + prism bar", duration: "8–10 min", available: true },
  { id: "worth", index: "4.1", name: "Worth four dot", equipment: "Red–green glasses + target", duration: "6–8 min", available: true },
  { id: "stereopsis", index: "4.2", name: "Stereopsis", equipment: "Stereo booklet + glasses", duration: "6–8 min", available: true },
  { id: "four-prism", index: "4.3", name: "4Δ base-out test", equipment: "4Δ prism", duration: "6–8 min", available: true },
  { id: "maddox", index: "5.1", name: "Maddox rod method", equipment: "Maddox rod + prism", duration: "8–10 min", available: true },
  { id: "thorington", index: "5.2", name: "Modified Thorington", equipment: "Thorington card + Maddox rod", duration: "6–8 min", available: true },
  { id: "npc", index: "6.1", name: "Near point of convergence", equipment: "Near target + ruler", duration: "6–8 min", available: true },
  { id: "horizontal-distance", index: "6.2", name: "Horizontal vergence · distance", equipment: "Prism bar", duration: "8–10 min", available: true },
  { id: "vertical-distance", index: "6.3", name: "Vertical vergence · distance", equipment: "Prism bar", duration: "6–8 min", available: true },
  { id: "horizontal-near", index: "6.4", name: "Horizontal vergence · near", equipment: "Near card + prism", duration: "8–10 min", available: true },
  { id: "facility", index: "6.5", name: "Vergence facility · near", equipment: "12Δ BO / 3Δ BI flipper", duration: "2 min", available: true },
  {id:"push-up",index:"7.1",name:"Amplitude · push-up",equipment:"Near card + ruler",duration:"6–8 min",available:true},{id:"minus-lens",index:"7.2",name:"Amplitude · minus lens",equipment:"Near card + lenses",duration:"7–9 min",available:true},{id:"relative",index:"7.3",name:"NRA / PRA",equipment:"Near card + trial lenses",duration:"8–10 min",available:true},{id:"accommodative-facility",index:"7.4",name:"Accommodative facility",equipment:"±2.00 D flipper",duration:"2 min",available:true},
];

const practiceSection = (index: string) => ({ "3": "Motor alignment", "4": "Sensory status", "5": "Latent deviation", "6": "Vergence", "7": "Accommodation" })[index[0]] ?? "Clinical skills";

const steps = (items: string[]) => (
  <ol className="practice-steps">
    {items.map((item, index) => <li key={item}><b>{index + 1}</b><span>{item}</span></li>)}
  </ol>
);

function TeachingBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="teaching-block"><h3>{title}</h3>{children}</section>;
}

function MotilityModule({ onComplete }: { onComplete: () => void }) {
  const [running, setRunning] = useState(false);
  const [complete, setComplete] = useState(false);
  return (
    <>
      <div className="practice-lesson-head">
        <div><p className="eyebrow">BINOCULAR VISION · 3.1</p><h1>Extraocular motilities</h1><p>Assess conjugate eye movements through primary position and the eight cardinal directions of gaze.</p></div>
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
        <div><p className="eyebrow">GUIDED ATTEMPT</p><h2>Complete all nine gaze positions</h2><p>The trainer marks primary position plus all eight cardinal directions. Hold each point rather than sweeping past it.</p></div>
        <button className="primary" onClick={() => setRunning(true)}>{complete ? "Practice again" : "Start guided attempt"} <ChevronRight size={17} /></button>
      </div>
      {complete && <div className="practice-success"><CheckCircle2 size={22} /><div><b>Technique sequence complete</b><p>You covered primary position and all eight cardinal directions, asked about diplopia, and recorded an observation.</p></div></div>}
      {running && <MotilityExamination onCancel={() => setRunning(false)} onComplete={() => { setRunning(false); setComplete(true); onComplete(); }} />}
    </>
  );
}

type BrucknerScenario = "equal" | "od" | "os";
const brucknerScenarios: Record<BrucknerScenario, { label: string; answer: string }> = {
  equal: { label: "Equal reflexes", answer: "Reflexes appear equally bright; binocular fixation is supported by this screening observation." },
  od: { label: "OD brighter", answer: "The reflex from OD appears brighter. Record OD as the brighter reflex and investigate possible causes." },
  os: { label: "OS brighter", answer: "The reflex from OS appears brighter. Record OS as the brighter reflex and investigate possible causes." },
};

function BrucknerModule({ onComplete }: { onComplete: () => void }) {
  const [running, setRunning] = useState(false);
  const [scenario, setScenario] = useState<BrucknerScenario>("equal");
  const [answer, setAnswer] = useState("");
  const [checked, setChecked] = useState(false);
  const correct = answer === scenario;
  const next = () => {
    const order: BrucknerScenario[] = ["equal", "od", "os"];
    setScenario(order[(order.indexOf(scenario) + 1) % order.length]);
    setAnswer(""); setChecked(false);
  };
  return (
    <>
      <div className="practice-lesson-head"><div><p className="eyebrow">BINOCULAR VISION · 3.2</p><h1>Bruckner test</h1><p>Compare both red reflexes simultaneously as a screening observation, especially in infants and preverbal children.</p></div><span className="lesson-equipment"><Eye size={18} /> Direct ophthalmoscope · large spot</span></div>
      <div className="lesson-columns">
        <div>
          <TeachingBlock title="Set up the test">{steps(["Ask the patient to look directly at the ophthalmoscope light.", "Use the large illumination spot from approximately 1 metre so both pupils are illuminated together.", "View both red reflexes simultaneously through the peephole.", "Compare brightness and record equal or unequal; if unequal, identify the brighter eye."])}</TeachingBlock>
          <TeachingBlock title="Interpret carefully"><p>Equal brightness supports binocular fixation in this screening observation. An unequal reflex is not a diagnosis by itself; possible explanations include strabismus, anisometropia, anisocoria, or media opacity and require further assessment.</p></TeachingBlock>
        </div>
        <aside className="practice-checklist"><p className="eyebrow">TECHNIQUE POINTS</p>{["Large illumination spot", "Approximately 1 metre", "Patient fixates the light", "Both pupils viewed together", "Name the brighter eye"].map(item => <span key={item}><Check size={14} /> {item}</span>)}</aside>
      </div>
      <div className="practice-action-panel immersive"><div><p className="eyebrow">FIRST-PERSON PRACTICE</p><h2>Pick up the ophthalmoscope</h2><p>Aim the instrument yourself, set the large spot with your other hand, establish fixation, find the working distance, and look through the peephole. The red reflexes appear only when the technique is aligned.</p></div><button className="primary" onClick={() => { setAnswer(""); setChecked(false); setRunning(true); }}>Enter clinical view <Maximize2 size={17} /></button></div>
      {running && <ClinicalPracticeStage mode="bruckner" scenario={{ id: scenario, od: [50, 50], os: [50, 50], brighter: scenario === "equal" ? undefined : scenario }} onClose={() => setRunning(false)} onObserved={() => setChecked(false)}>
        {ready => <><label>What do you observe?<select disabled={!ready || (checked && correct)} value={answer} onChange={e => { setAnswer(e.target.value); setChecked(false); }}><option value="">Inspect both pupils</option>{Object.entries(brucknerScenarios).map(([id, item]) => <option key={id} value={id}>{item.label}</option>)}</select></label><button className="primary full" disabled={!ready || !answer || (checked && correct)} onClick={() => { if (checked && correct) return; setChecked(true); if (answer === scenario) onComplete(); }}>Record observation</button>{checked && <div className={correct ? "trainer-feedback correct" : "trainer-feedback incorrect"}><b>{correct ? "Correct" : "Look again"}</b><p>{correct ? brucknerScenarios[scenario].answer : "Keep both pupils in the beam and compare the red reflex brightness."}</p>{correct && <button className="secondary" onClick={next}>New patient finding <RotateCcw size={15} /></button>}</div>}</>}
      </ClinicalPracticeStage>}
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
  const [running, setRunning] = useState(false);
  const [direction, setDirection] = useState("");
  const [amount, setAmount] = useState("");
  const [checked, setChecked] = useState(false);
  const scenario = hirschbergScenarios[index];
  const correct = direction === scenario.direction && amount === scenario.amount;
  const next = () => { setIndex((index + 1) % hirschbergScenarios.length); setDirection(""); setAmount(""); setChecked(false); };
  return (
    <>
      <div className="practice-lesson-head"><div><p className="eyebrow">BINOCULAR VISION · 3.3</p><h1>Hirschberg test</h1><p>Inspect the relative location of the corneal light reflexes to identify and approximately quantify a manifest deviation at near.</p></div><span className="lesson-equipment"><CircleDot size={18} /> Penlight · about 50 cm</span></div>
      <div className="lesson-columns">
        <div>
          <TeachingBlock title="Procedure">{steps(["Position the penlight at approximately 50 cm and ask the patient to look directly at it.", "Observe the corneal reflex in both eyes from a centred viewing position.", "Compare each reflex with the pupil centre.", "If displaced, record the deviating eye, reflex direction, inferred deviation, and approximate landmark size."])}</TeachingBlock>
          <TeachingBlock title="Direction rule"><div className="direction-grid"><span><b>Nasal reflex</b>Exotropia</span><span><b>Temporal reflex</b>Esotropia</span><span><b>Reflex above centre</b>Hypotropia</span><span><b>Reflex below centre</b>Hypertropia</span></div></TeachingBlock>
        </div>
        <aside className="practice-checklist"><p className="eyebrow">LANDMARK ESTIMATES</p><span><Ruler size={14} /> Pupil edge · ~15°</span><span><Ruler size={14} /> Midway to limbus · ~30°</span><span><Ruler size={14} /> At limbus · ~45°</span><div className="record-example"><b>Quantification note</b><p>These are approximate screening landmarks. Prism neutralisation is used when measurement is required.</p></div></aside>
      </div>
      <div className="practice-action-panel immersive"><div><p className="eyebrow">FIRST-PERSON PRACTICE</p><h2>Perform the Hirschberg test</h2><p>Hold and aim the penlight, instruct fixation, move to about 50 cm, and centre your own viewing position. Your free hand stays clear because patient contact is not required.</p></div><button className="primary" onClick={() => { setDirection(""); setAmount(""); setChecked(false); setRunning(true); }}>Enter clinical view <Maximize2 size={17} /></button></div>
      {running && <ClinicalPracticeStage mode="hirschberg" scenario={scenario} findingPosition={{ current: index + 1, total: hirschbergScenarios.length }} onClose={() => setRunning(false)} onObserved={() => setChecked(false)}>
        {ready => <><label>Interpretation<select disabled={!ready || (checked && correct)} value={direction} onChange={e => { setDirection(e.target.value); setChecked(false); }}><option value="">Inspect the reflexes</option><option value="none">No manifest deviation observed</option><option value="exotropia">Exotropia</option><option value="esotropia">Esotropia</option><option value="hypertropia">Hypertropia</option><option value="hypotropia">Hypotropia</option></select></label><label>Approximate landmark<select disabled={!ready || (checked && correct)} value={amount} onChange={e => { setAmount(e.target.value); setChecked(false); }}><option value="">Choose after inspecting</option><option value="0">Centred · 0°</option><option value="15">Pupil edge · ~15°</option><option value="30">Midway to limbus · ~30°</option><option value="45">Limbus · ~45°</option></select></label><button className="primary full" disabled={!ready || !direction || !amount || (checked && correct)} onClick={() => { if (checked && correct) return; setChecked(true); if (correct) onComplete(); }}>Record interpretation</button>{checked && <div className={correct ? "trainer-feedback correct" : "trainer-feedback incorrect"}><b>{correct ? "Correct" : "Recheck the reflex position"}</b><p>{correct ? scenario.feedback : "Compare each corneal reflex with the pupil centre, then apply the direction rule and landmark estimate."}</p>{correct && <button className="secondary" onClick={next}>New patient finding <RotateCcw size={15} /></button>}</div>}</>}
      </ClinicalPracticeStage>}
    </>
  );
}

function CoverUncoverModule({ onComplete }: { onComplete: () => void }) {
  const [running, setRunning] = useState(false);
  return <>
    <div className="practice-lesson-head"><div><p className="eyebrow">BINOCULAR VISION · 3.6</p><h1>Cover–uncover test</h1><p>Differentiate tropia, phoria, and orthophoria by observing exactly when an eye takes up fixation.</p></div><span className="lesson-equipment"><Hand size={18} /> Occluder · distance and near</span></div>
    <div className="lesson-columns"><div>
      <TeachingBlock title="What the movement means"><p>Watch the eye that remains visible while its fellow eye is covered. Movement of that uncovered eye to take fixation indicates a tropia. Then watch immediately as the cover is removed: movement on uncovering reveals a phoria that had been controlled by fusion. No movement on covering or uncovering supports orthophoria.</p></TeachingBlock>
      <TeachingBlock title="Procedure">{steps(["Use the patient’s best refractive correction and establish fixation on an isolated distance target.", "Cover the fixating eye for a few seconds and watch the uncovered eye for movement.", "Remove the occluder and immediately watch the eye that has just been uncovered.", "Repeat the same cover and uncover observations with the fellow eye.", "Classify the timing of movement as tropia, phoria, or no observed deviation.", "Repeat the full procedure using an accommodative near target at 40 cm."])}</TeachingBlock>
      <TeachingBlock title="Unilateral versus alternating tropia"><p>If the uncovered eye takes fixation but returns to its deviated position when the habitual fixating eye is uncovered, the tropia is unilateral in that deviating eye. If the newly fixating eye retains fixation and the fellow eye assumes the deviated position, the tropia is alternating.</p></TeachingBlock>
    </div><aside className="practice-checklist"><p className="eyebrow">WATCH THE TIMING</p>{["Patient maintains fixation", "Observe the eye not covered", "Observe immediately on uncovering", "Cover each eye separately", "Repeat at near · 40 cm", "Keep the occluder clear between trials"].map(item => <span key={item}><Check size={14} /> {item}</span>)}<div className="record-example"><b>Core distinction</b><p>Movement on cover → tropia. Movement on uncover → phoria. No movement → orthophoria.</p></div></aside></div>
    <div className="practice-action-panel immersive"><div><p className="eyebrow">FIRST-PERSON PRACTICE</p><h2>Control the occluder and watch the eyes</h2><p>Perform the sequence at distance or near. The right hand moves the occluder; at near, the left hand holds the fixation target at 40 cm. The simulated eye movement is brief, so watch the correct eye at the correct moment.</p></div><button className="primary" onClick={() => setRunning(true)}>Enter clinical view <Maximize2 size={17} /></button></div>
    {running && <CoverPracticeStage kind="cover-uncover" onClose={() => setRunning(false)} onComplete={onComplete} />}
  </>;
}

function AlternateCoverModule({ onComplete }: { onComplete: () => void }) {
  const [running, setRunning] = useState(false);
  return <>
    <div className="practice-lesson-head"><div><p className="eyebrow">BINOCULAR VISION · 3.7</p><h1>Alternating cover test</h1><p>Break fusion, determine the direction of deviation, and measure its magnitude by prism neutralisation.</p></div><span className="lesson-equipment"><Hand size={18} /> Occluder + prism bar</span></div>
    <div className="lesson-columns"><div>
      <TeachingBlock title="Procedure">{steps(["Use the same fixation setup as the cover test and ask the patient to maintain fixation.", "Cover one eye, then shift the occluder directly to the fellow eye after a few seconds.", "Continue alternating several times without leaving both eyes uncovered, so fusion remains disrupted.", "Observe the direction of refixation movement and infer the direction of deviation.", "Place a prism bar before either eye with the appropriate base direction.", "Increase prism power gradually and repeat alternating cover until no refixation movement is seen.", "Record the neutralising prism as the magnitude of deviation and repeat for near."])}</TeachingBlock>
      <TeachingBlock title="Movement, deviation, and prism"><div className="direction-grid"><span><b>Eye moves in</b>Exo · base-in prism</span><span><b>Eye moves out</b>Eso · base-out prism</span><span><b>Eye moves up</b>Hypo · base-up prism</span><span><b>Eye moves down</b>Hyper · base-down prism</span></div></TeachingBlock>
    </div><aside className="practice-checklist"><p className="eyebrow">TECHNIQUE POINTS</p>{["Never expose both eyes between shifts", "Alternate several times", "Name movement direction first", "Prism can be placed before either eye", "Increase power gradually", "Endpoint is no movement", "Repeat with a near target"].map(item => <span key={item}><Check size={14} /> {item}</span>)}</aside></div>
    <div className="practice-action-panel immersive"><div><p className="eyebrow">FIRST-PERSON PRACTICE</p><h2>Alternate, add prism, and neutralise</h2><p>The right hand shifts the occluder without restoring fusion. The left hand holds the prism bar. Identify the movement, choose the prism base, increase power, then repeat until movement disappears.</p></div><button className="primary" onClick={() => setRunning(true)}>Enter clinical view <Maximize2 size={17} /></button></div>
    {running && <CoverPracticeStage kind="alternate-cover" onClose={() => setRunning(false)} onComplete={onComplete} />}
  </>;
}

function SensoryModule({ mode, onComplete }: { mode: SensoryMode; onComplete: () => void }) {
  const [running, setRunning] = useState(false);
  const data = mode === "worth" ? {
    index: "4.1", title: "Worth four dot test", intro: "Assess fusion, suppression, and diplopia at different viewing distances.", equipment: "Red OD · green OS · four-dot target",
    procedure: ["Place red–green glasses over habitual correction: red before OD and green before OS.", "Check that the filters correctly cancel the target colours.", "Present the diamond target at different distances and maintain fixation.", "Ask how many dots are seen, their colours, and their relative positions.", "Interpret fusion, suppression, or diplopia from the full response and record the test distance."],
    note: "Four dots indicate flat fusion. Two red dots indicate OS suppression; three green indicate OD suppression. Five dots indicate diplopia: red right of green is eso/uncrossed, red left is exo/crossed, red above is left hyper, and red below is right hyper.",
  } : mode === "stereopsis" ? {
    index: "4.2", title: "Stereopsis", intro: "Measure the finest binocular depth discrimination the patient can identify.", equipment: "Stereo booklet · near correction · 40 cm",
    procedure: ["Place Polaroid or red–green glasses over the near correction.", "Hold the stereo booklet at 40 cm.", "Begin with the largest disparity and ask which circle floats above the booklet plane.", "Continue to progressively finer target sets.", "Stop after two consecutive incorrect responses.", "Record seconds of arc for the last correct response before those two errors."],
    note: "Stereopsis is the final grade of binocular vision after simultaneous perception and fusion. Smaller seconds-of-arc values represent finer stereoscopic discrimination.",
  } : {
    index: "4.3", title: "Four prism diopter base-out test", intro: "Look for a small central suppression scotoma by observing version and refixation responses.", equipment: "4Δ base-out prism · distance target",
    procedure: ["Use best distance correction and isolate a letter one acuity line above the poorer eye’s best acuity.", "Ask the patient to keep the letter single.", "Place a 4Δ base-out prism before the better eye and watch the fellow eye.", "Keep the prism in place long enough to observe whether inward refixation follows the outward movement.", "Shift the prism to the fellow eye and again watch carefully.", "Record the response from both prism placements."],
    note: "Normal: the fellow eye moves outward and then inward to refixate with prism before either eye. Suppression: prism before the better eye produces outward movement without inward refixation; prism before the suppressing eye produces no movement.",
  };
  return <><div className="practice-lesson-head"><div><p className="eyebrow">SENSORY STATUS · {data.index}</p><h1>{data.title}</h1><p>{data.intro}</p></div><span className="lesson-equipment"><Eye size={18}/>{data.equipment}</span></div><div className="lesson-columns"><div><TeachingBlock title="Procedure">{steps(data.procedure)}</TeachingBlock><TeachingBlock title="Interpretation"><p>{data.note}</p></TeachingBlock></div><aside className="practice-checklist"><p className="eyebrow">SENSORY SEQUENCE</p>{["Best/habitual correction", "Correct viewing equipment", "Fixation maintained", "Response elicited precisely", "Finding recorded with test conditions"].map(item=><span key={item}><Check size={14}/>{item}</span>)}</aside></div><div className="practice-action-panel immersive"><div><p className="eyebrow">FIRST-PERSON PRACTICE</p><h2>Perform the sensory assessment</h2><p>Handle the viewing equipment, establish the correct distance and fixation, elicit the patient’s response, and record the finding from the simulated observation.</p></div><button className="primary" onClick={()=>setRunning(true)}>Enter clinical view <Maximize2 size={17}/></button></div>{running&&<SensoryPracticeStage mode={mode} onClose={()=>setRunning(false)} onComplete={onComplete}/>}</>;
}

function PhoriaModule({ mode, onComplete }: { mode: PhoriaMode; onComplete: () => void }) {
  const [running,setRunning]=useState(false); const maddox=mode==="maddox";
  return <><div className="practice-lesson-head"><div><p className="eyebrow">LATENT DEVIATION · {maddox?"5.1":"5.2"}</p><h1>{maddox?"Maddox rod method":"Modified Thorington method"}</h1><p>{maddox?"Measure horizontal and vertical phoria at distance and near by prism neutralisation.":"Measure horizontal and vertical near phoria directly from a numbered card at 40 cm."}</p></div><span className="lesson-equipment"><Glasses size={18}/>{maddox?"Maddox rod + prism":"Maddox rod + Thorington card"}</span></div><div className="lesson-columns"><div><TeachingBlock title="Procedure">{steps(maddox?["Place habitual correction and a Maddox rod before OD.","For lateral phoria use horizontal grooves to create a vertical streak; for vertical phoria use vertical grooves to create a horizontal streak.","At 6 m, switch on the spot light and introduce sufficient base-in prism laterally or base-up prism vertically.","Reduce prism until the patient reports that the streak bisects the spot.","Record prism amount and base direction, then repeat with a penlight at 40 cm."]:["Place usual near correction and a Maddox rod before OD.","Use horizontal grooves for lateral measurement or vertical grooves for vertical measurement.","Hold the Thorington card at 40 cm with the penlight through its centre.","Ask which numbered line the streak passes through and its position relative to the light.","Record magnitude and direction; repeat with the vertically oriented card for vertical phoria."])}</TeachingBlock><TeachingBlock title="Interpretation"><p>{maddox?"The neutralising prism value and base orientation are the phoria measurement. Begin with sufficient base-in for lateral testing or base-up for vertical testing, then reduce to coincidence.":"Horizontal: streak right of light indicates esophoria; left indicates exophoria. Vertical: through the light is orthophoria; above indicates left hyperphoria and below indicates right hyperphoria. Each numbered interval at 40 cm represents one prism dioptre."}</p></TeachingBlock></div><aside className="practice-checklist"><p className="eyebrow">TECHNIQUE POINTS</p>{["Correction worn","Maddox rod before OD","Grooves match measurement axis",maddox?"6 m and 40 cm":"Card exactly 40 cm",maddox?"Reduce prism to coincidence":"Read number and direction","Record prism dioptres + direction"].map(i=><span key={i}><Check size={14}/>{i}</span>)}</aside></div><div className="practice-action-panel immersive"><div><p className="eyebrow">FIRST-PERSON PRACTICE</p><h2>{maddox?"Neutralise the streak and spot":"Measure directly from the card"}</h2><p>Set the correction, rod orientation, target distance, and light. The patient percept changes with your optical setup, and recording stays locked until the technique is valid.</p></div><button className="primary" onClick={()=>setRunning(true)}>Enter clinical view <Maximize2 size={17}/></button></div>{running&&<PhoriaPracticeStage mode={mode} onClose={()=>setRunning(false)} onComplete={onComplete}/>}</>;
}

function VergenceModule({mode,onComplete}:{mode:VergenceMode;onComplete:()=>void}){const[running,setRunning]=useState(false);const d:{[K in VergenceMode]:[string,string,string,string]}={npc:["6.1","Near point of convergence","Move the accommodative target from 40 cm toward break, then outward to recovery.","Break >5 cm is described as abnormal; recovery should be within 7 cm."],"horizontal-distance":["6.2","Horizontal fusional vergences at distance","Test BI before BO; record blur where applicable, break, and recovery.","Distance BI X/7/4 · BO 9/19/12"],"vertical-distance":["6.3","Vertical fusional vergences at distance","Test base up and base down; record break and recovery without blur.","Break 3–4Δ · recovery 1.5–2Δ"],"horizontal-near":["6.4","Horizontal fusional vergences at near","At near, measure BI and BO blur, break, and recovery.","Near BI 13/21/13 · BO 17/21/11"],facility:["6.5","Fusional vergence facility at near","Flip 12Δ BO and 3Δ BI after each clear-and-single response.","Reference: 15 full cycles per minute"]};const x=d[mode];return <><div className="practice-lesson-head"><div><p className="eyebrow">VERGENCE · {x[0]}</p><h1>{x[1]}</h1><p>{x[2]}</p></div><span className="lesson-equipment"><Eye size={18}/>Vergence assessment</span></div><div className="lesson-columns"><div><TeachingBlock title="Procedure"><p>{x[2]} Use appropriate correction and an isolated target one line larger than the poorer eye’s best acuity. Explain blur, diplopia, and recovery reporting before changing demand.</p></TeachingBlock><TeachingBlock title="Reference findings"><p>{x[3]}</p></TeachingBlock></div><aside className="practice-checklist"><p className="eyebrow">RECORD</p>{["Appropriate correction","Fixation maintained","Increase demand gradually","Separate blur and break","Reverse to recovery","Record base + values"].map(v=><span key={v}><Check size={14}/>{v}</span>)}</aside></div><div className="practice-action-panel immersive"><div><p className="eyebrow">FIRST-PERSON PRACTICE</p><h2>Measure the vergence response</h2><p>Control target or prism demand, mark the patient endpoint, then reverse direction to recovery.</p></div><button className="primary" onClick={()=>setRunning(true)}>Enter clinical view <Maximize2 size={17}/></button></div>{running&&<VergencePracticeStage mode={mode} onClose={()=>setRunning(false)} onComplete={onComplete}/>}</>}

function AccommodationModule({mode,onComplete}:{mode:AccommodationMode;onComplete:()=>void}){const[r,setR]=useState(false);const d={"push-up":["7.1","Amplitude of accommodation · push-up","Move the near card closer until first sustained blur; measure NPA from the spectacle plane and convert with 100/cm."],"minus-lens":["7.2","Amplitude · minus lens to blur","At 40 cm add −0.25 D monocularly until sustained blur; amplitude is minus added plus 2.50 D."],relative:["7.3","Negative and positive relative accommodation","At 40 cm add +0.25 D binocularly to NRA blur, return to baseline, then −0.25 D to PRA blur."],"accommodative-facility":["7.4","Accommodative facility","At 40 cm flip ±2.00 D after each clear report; one plus/minus pair is one cycle."]}[mode];return <><div className="practice-lesson-head"><div><p className="eyebrow">ACCOMMODATION · {d[0]}</p><h1>{d[1]}</h1><p>{d[2]}</p></div></div><div className="lesson-columns"><div><TeachingBlock title="Procedure"><p>{d[2]} Test OD, OS, and binocularly where specified, using correction and a line one larger than best near acuity.</p></TeachingBlock><TeachingBlock title="Reference"><p>Hofstetter: minimum 15−0.25(age), average 18.5−0.30(age), maximum 25−0.40(age). Monocular amplitudes should be within 1 D. Adult facility references: 11 cpm monocular and 10 cpm binocular.</p></TeachingBlock></div></div><div className="practice-action-panel immersive"><div><h2>Perform the accommodation test</h2><p>Control target distance or lenses in the full-screen clinical view.</p></div><button className="primary"onClick={()=>setR(true)}>Enter clinical view</button></div>{r&&<AccommodationPracticeStage mode={mode}onClose={()=>setR(false)}onComplete={onComplete}/>}</>}
function KrimskyModule({ onComplete }: { onComplete: () => void }) {
  const [running, setRunning] = useState(false);
  return <><div className="practice-lesson-head"><div><p className="eyebrow">BINOCULAR VISION · 3.4</p><h1>Krimsky test</h1><p>Extend the Hirschberg observation by matching corneal reflex positions with a neutralising prism.</p></div></div><TeachingBlock title="Procedure">{steps(["Ask the patient to fixate the penlight at approximately 50 cm and compare the corneal reflexes.", "View with one examiner eye to reduce parallax.", "For Krimsky, place the prism before the deviating eye. In this trainer, OS deviates and OD fixates.", "Choose base in for an exodeviation or base out for an esodeviation. Increase prism until the reflexes match in relative position.", "Record prism power, base, eye, working distance and method.", "For modified Krimsky, place the prism before the fixating eye. This variant is useful when the deviating eye provides an unreliable reflex or has very poor acuity."])}</TeachingBlock><p>The trainer uses the supplied source’s naming convention. Clinical terminology and the illustrative optical model require clinician review.</p><div className="practice-action-panel immersive"><div><h2>Neutralise the corneal reflex displacement</h2><p>Hold the light steady and adjust the prism while comparing both reflexes.</p></div><button className="primary" onClick={() => setRunning(true)}>Enter clinical view</button></div>{running && <KrimskyPracticeStage onClose={() => setRunning(false)} onComplete={onComplete} />}</>;
}

export function PracticeMode({ onExit }: { onExit: () => void }) {
  const [selected, setSelected] = useState<SkillId>("motility");
  const [completed, setCompleted] = useState<SkillId[]>([]);
  const complete = (id: SkillId) => setCompleted(items => items.includes(id) ? items : [...items, id]);
  const skill = skills.find(item => item.id === selected)!;
  const selectedIndex = skills.findIndex(item => item.id === selected);
  const nextSkill = [...skills.slice(selectedIndex + 1), ...skills.slice(0, selectedIndex)].find(item => item.available && !completed.includes(item.id));
  const allComplete = completed.length === skills.filter(item => item.available).length;
  return (
    <main className="practice-shell">
      <header className="practice-header"><button className="practice-wordmark" onClick={onExit}><span>opto<span className="wordmark-dot">.</span></span><small>Practice</small></button><div><GraduationCap size={18} /><span>Binocular vision</span><progress aria-label="Practice modules completed" value={completed.length} max={skills.filter(item => item.available).length} /><b>{completed.length}/{skills.filter(item => item.available).length} modules practised</b></div><button className="secondary" onClick={onExit}><ArrowLeft size={16} /> Modes</button></header>
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
          {completed.includes(selected) && <section className="practice-module-complete" aria-live="polite"><CheckCircle2 size={22} /><div><b>{allComplete ? "Guided Practice session complete" : "Guided module complete"}</b><p>{allComplete ? "All available modules have been practised in this session. Choose any skill from the library to repeat it." : "This module is marked practised for the current session. You can repeat it at any time."}</p></div>{nextSkill && <button className="primary" onClick={() => setSelected(nextSkill.id)}>Next uncompleted · {nextSkill.name}<ChevronRight size={16} /></button>}</section>}
        </article>
      </div>
    </main>
  );
}
