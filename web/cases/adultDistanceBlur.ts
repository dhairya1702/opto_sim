import type {
  ClinicalCase,
  ExamDefinition,
  Finding,
  HistoryFact,
  Criterion,
} from "../domain/types";
const fact = (
  id: string,
  domain: string,
  question: string,
  answer: string,
  patterns: string[],
  weight: number,
): HistoryFact => ({ id, domain, question, answer, patterns, weight });
const historyFacts = [
  fact(
    "onset",
    "Onset / course",
    "When did the blur start? Has it changed suddenly?",
    "It started gradually about six months ago. It hasn't suddenly got worse.",
    ["how long", "when", "start", "onset", "gradual", "months", "sudden deterioration"],
    3,
  ),
  fact(
    "visual-pattern",
    "Distance / near",
    "Is the blur worse far away or up close?",
    "Faraway things are blurry. Reading up close seems okay.",
    ["near", "close", "distance", "far", "reading"],
    3,
  ),
  fact(
    "laterality",
    "Laterality",
    "Does it affect one eye or both eyes?",
    "It seems to be in both eyes.",
    ["both", "one eye", "which eye", "left eye", "right eye"],
    2,
  ),
  fact(
    "impact",
    "Daily impact",
    "How is this affecting your day?",
    "I have trouble seeing lecture slides and distant signs.",
    ["affect", "impact", "lecture", "signs", "daily", "trouble"],
    2,
  ),
  fact(
    "correction",
    "Previous correction",
    "Have you worn glasses or contact lenses before?",
    "No, I've never worn glasses or contact lenses.",
    ["glasses", "spectacles", "contact", "correction"],
    2,
  ),
  fact(
    "symptoms",
    "Associated symptoms",
    "Any pain, redness, double vision or light sensitivity?",
    "No pain, redness, double vision or strong sensitivity to light.",
    ["pain", "red", "double", "diplopia", "photophobia", "light sensitivity"],
    3,
  ),
  fact(
    "safety",
    "Safety history",
    "Any injury, sudden vision loss, new flashes, floaters or a curtain over your vision?",
    "No recent injury or sudden loss of vision. I haven't noticed new flashes, floaters or a curtain over my sight.",
    ["injur", "trauma", "sudden vision", "sudden loss", "flashes", "floaters", "curtain"],
    4,
  ),
  fact(
    "general",
    "Medical / medication history",
    "Any diabetes, eye surgery, regular medicines or medication allergies?",
    "I don't have known diabetes, and I've never had eye surgery. I don't take regular medicines and haven't had a medication allergy.",
    [
      "diabetes",
      "medical",
      "health history",
      "surgery",
      "medicin",
      "medication",
      "allerg",
      "drugs",
    ],
    3,
  ),
  fact(
    "family",
    "Family history",
    "Does anyone in your family wear glasses?",
    "My mother wears glasses to see things far away.",
    ["family", "mother", "parent"],
    2,
  ),
  fact(
    "consent",
    "Consent",
    "May I explain and perform these simulated non-invasive examinations?",
    "Yes, that's okay. Please explain what you'll be checking.",
    ["consent", "permission", "may i", "can i examine", "is it okay", "happy to", "willing"],
    1,
  ),
];
const f = (
  value: string,
  method: string,
  units = "Observation",
  correction = "Not applicable",
  distance?: string,
): Finding => ({ value, method, units, correction, distance });
const eyes = (finding: Finding) => ({ "OD:default": finding, "OS:default": finding });
const exams: ExamDefinition[] = [
  {
    id: "distance",
    name: "Distance visual acuity",
    equipmentIds: ["acuity", "trolley"],
    equipment: "Distance chart + plain occluder",
    eyes: ["OD", "OS"],
    modes: [{ id: "default", label: "Unaided · simulated 6 m" }],
    scope:
      "Each eye is tested independently. This display is decorative; authored results are simulated at 6 m. You are not reading the chart yourself.",
    rationale: "Establishes a monocular unaided baseline for distance vision.",
    findings: eyes(
      f("6/18", "Metric Snellen, chart + occluder", "Metric Snellen", "Unaided", "6 m (simulated)"),
    ),
    weight: 4,
  },
  {
    id: "pinhole",
    name: "Pinhole acuity",
    equipmentIds: ["acuity", "trolley"],
    equipment: "Pinhole paddle + distance chart",
    eyes: ["OD", "OS"],
    modes: [{ id: "default", label: "Pinhole · simulated 6 m" }],
    prerequisite: { examId: "distance", sameEye: true },
    scope:
      "Requires baseline acuity for the selected eye in this draft workflow. Improvement supports a refractive contribution; it does not determine lens power or exclude disease.",
    rationale:
      "Compares baseline vision with pinhole improvement to explore a refractive contribution.",
    findings: eyes(
      f("6/6", "Metric Snellen with pinhole", "Metric Snellen", "Pinhole", "6 m (simulated)"),
    ),
    weight: 3,
  },
  {
    id: "near",
    name: "Near acuity",
    equipmentIds: ["acuity", "trolley"],
    equipment: "Near chart + occluder",
    eyes: ["OD", "OS"],
    modes: [{ id: "default", label: "Unaided · 40 cm" }],
    scope:
      "N6 denotes the authored near-print notation at 40 cm. It is separate from metric distance Snellen acuity.",
    rationale: "Checks the reported difference between distance and near function.",
    findings: eyes(
      f(
        "N6",
        "Near-print chart with occlusion",
        "N notation (near-print size)",
        "Unaided",
        "40 cm",
      ),
    ),
    weight: 2,
  },
  {
    id: "pupils",
    name: "Pupil assessment",
    equipmentIds: ["trolley", "patient"],
    equipment: "Pen torch + near fixation target",
    eyes: ["OU"],
    modes: [
      { id: "general", label: "Size, equality and light response" },
      { id: "rapd", label: "Relative afferent pupillary defect assessment" },
      { id: "near_response", label: "Near response · convergence and constriction" },
    ],
    scope:
      "General light responses, RAPD assessment and the near response are separate procedures. The near response is qualitative and does not measure a convergence break point.",
    rationale:
      "Assesses pupil responses; the RAPD procedure adds afferent-response information and the near procedure observes convergence with constriction.",
    findings: {
      "OU:general": f(
        "OD 4 mm, OS 4 mm in dim illumination; pupils equal; direct responses brisk OU; consensual responses present OU.",
        "Simulated pupil size/equality/light response",
      ),
      "OU:rapd": f(
        "No relative afferent pupillary defect in this authored assessment.",
        "Simulated swinging-light RAPD assessment",
      ),
      "OU:near_response": f(
        "Convergence and equal pupillary constriction observed to a near target; fixation maintained.",
        "Simulated near pupil response",
        "Observation",
        "Unaided",
        "40 cm to 20 cm",
      ),
    },
    weight: 2,
  },
  {
    id: "cover",
    name: "Cover test",
    equipmentIds: ["trolley", "patient"],
    equipment: "Occluder + fixation target",
    eyes: ["OU"],
    modes: [
      { id: "distance", label: "Distance · 6 m (simulated)" },
      { id: "near", label: "Near · 40 cm" },
    ],
    scope: "No phoria measurement is authored. A cover test is not a full binocular-vision workup.",
    rationale: "Assesses manifest alignment separately at distance and near.",
    findings: {
      "OU:distance": f(
        "No refixation movement observed during cover–uncover or alternating cover testing at distance.",
        "Simulated cover test",
        "Observation",
        "Unaided",
        "6 m (simulated)",
      ),
      "OU:near": f(
        "No refixation movement observed during cover–uncover or alternating cover testing at near.",
        "Simulated cover test",
        "Observation",
        "Unaided",
        "40 cm",
      ),
    },
    weight: 2,
  },
  {
    id: "motility",
    name: "Ocular motility",
    equipmentIds: ["trolley", "patient"],
    equipment: "Fixation target",
    eyes: ["OU"],
    modes: [{ id: "default", label: "Movement assessment" }],
    scope: "Move the fixation target manually through the guided positions, observe both eyes, and ask about double vision. Simplified normal-movement model; not a validated technique assessment.",
    rationale: "Checks movement range and whether diplopia is reported during the assessment.",
    findings: {
      "OU:default": f(
        "Full movements; no diplopia reported during the simulated assessment.",
        "Simulated ocular movement assessment",
      ),
    },
    weight: 2,
  },
  {
    id: "objective",
    name: "Objective refraction",
    equipmentIds: ["trolley"],
    equipment: "Retinoscope kit",
    eyes: ["OD", "OS"],
    modes: [{ id: "default", label: "Final objective estimate" }],
    scope:
      "Working-distance correction is already applied. This is an objective estimate, not a completed spectacle prescription.",
    rationale:
      "Provides an objective estimate of refractive error before the draft subjective refinement.",
    findings: {
      "OD:default": {
        ...f(
          "Gross neutralisation +0.25 D at 67 cm; working-distance correction −1.50 D; sphere −1.25 D · cylinder 0.00 D · axis not applicable.",
          "Manual simulated retinoscopy; working distance accounted for",
          "Dioptres (D)",
          "Objective estimate",
        ),
        refraction: [
          {
            eye: "OD",
            sphere: -1.25,
            cylinder: 0,
            axis: null,
            units: "D",
            workingDistanceAccounted: true,
          },
        ],
      },
      "OS:default": {
        ...f(
          "Gross neutralisation 0.00 D at 67 cm; working-distance correction −1.50 D; sphere −1.50 D · cylinder 0.00 D · axis not applicable.",
          "Manual simulated retinoscopy; working distance accounted for",
          "Dioptres (D)",
          "Objective estimate",
        ),
        refraction: [
          {
            eye: "OS",
            sphere: -1.5,
            cylinder: 0,
            axis: null,
            units: "D",
            workingDistanceAccounted: true,
          },
        ],
      },
    },
    weight: 4,
  },
  {
    id: "subjective",
    name: "Subjective refraction",
    equipmentIds: ["refraction"],
    equipment: "Trial frame + lens set",
    eyes: ["OD", "OS"],
    modes: [{ id: "default", label: "Simplified refinement endpoint" }],
    prerequisite: { examId: "objective", sameEye: true },
    scope:
      "The objective estimate for this eye precedes refinement in the configurable draft workflow. No lens-click count or manual-technique score is used.",
    rationale: "Refines the objective estimate and confirms the authored corrected acuity.",
    findings: {
      "OD:default": {
        ...f(
          "Sphere −1.25 D · cylinder 0.00 D · axis not applicable. Corrected acuity 6/6.",
          "Simulated subjective refinement",
          "Dioptres (D); metric Snellen",
          "Corrected",
          "6 m (simulated)",
        ),
        refraction: [
          {
            eye: "OD",
            sphere: -1.25,
            cylinder: 0,
            axis: null,
            units: "D",
            workingDistanceAccounted: true,
          },
        ],
      },
      "OS:default": {
        ...f(
          "Sphere −1.50 D · cylinder 0.00 D · axis not applicable. Corrected acuity 6/6.",
          "Simulated subjective refinement",
          "Dioptres (D); metric Snellen",
          "Corrected",
          "6 m (simulated)",
        ),
        refraction: [
          {
            eye: "OS",
            sphere: -1.5,
            cylinder: 0,
            axis: null,
            units: "D",
            workingDistanceAccounted: true,
          },
        ],
      },
    },
    weight: 5,
  },
  {
    id: "anterior",
    name: "Anterior-segment assessment",
    equipmentIds: ["slit"],
    equipment: "Table-mounted slit lamp",
    eyes: ["OD", "OS"],
    modes: [{ id: "default", label: "Authored anterior-segment assessment" }],
    scope:
      "A fixed examination station. These findings do not establish normal fundus or peripheral retina.",
    rationale: "Adds anterior ocular-health observations to the refractive assessment.",
    findings: eyes(
      f(
        "Lids/lashes, conjunctiva, cornea, anterior chamber, iris and lens: authored findings within normal limits.",
        "Simulated slit-lamp anterior assessment",
      ),
    ),
    weight: 3,
  },
  {
    id: "fundus",
    name: "Fundus assessment",
    equipmentIds: ["fundus"],
    equipment: "Direct ophthalmoscope",
    eyes: ["OD", "OS"],
    modes: [{ id: "default", label: "Simulated undilated view" }],
    scope:
      "Limited undilated posterior-pole view. It does not prove that the peripheral retina has been fully assessed.",
    rationale:
      "Adds observations of the disc, macula and visible posterior pole, within the stated view limitations.",
    findings: eyes(
      f(
        "Disc, macula and visible posterior pole: authored findings within normal limits. Peripheral retina not fully assessed.",
        "Simulated undilated direct ophthalmoscopy",
      ),
    ),
    weight: 3,
  },
];
const criteria: Criterion[] = [
  ...historyFacts.map((h) => ({
    id: `history:${h.id}`,
    dimension: "History" as const,
    weight: h.weight,
    label: h.domain,
    rule: `Unique disclosure of fact ${h.id}`,
    alternatives: ["Authored suggested question", "Supported free-text paraphrase"],
    feedback: `Ask about ${h.domain.toLowerCase()}.`,
  })),
  ...exams.map((e) => ({
    id: `exam:${e.id}`,
    dimension: "Examination selection" as const,
    weight: e.weight,
    label: e.name,
    rule: "All authored eye/configuration combinations completed. Partial combinations receive proportional credit.",
    alternatives: ["Any order except explicit configured prerequisites"],
    feedback: e.rationale,
  })),
  {
    id: "interpretation:diagnosis",
    dimension: "Interpretation",
    weight: 10,
    label: "Working diagnosis",
    rule: "Select bilateral myopia/refractive error.",
    alternatives: ["Refractive error consistent with acquired findings"],
    feedback:
      "Pinhole improvement supports a refractive contribution. Refraction helps establish its type and endpoint.",
  },
  {
    id: "interpretation:baseline",
    dimension: "Interpretation",
    weight: 4,
    label: "Baseline evidence",
    rule: "Select acquired OD and OS baseline acuity.",
    alternatives: [],
    feedback: "Cite the independently obtained unaided acuity of both eyes.",
  },
  {
    id: "interpretation:pinhole",
    dimension: "Interpretation",
    weight: 4,
    label: "Pinhole evidence",
    rule: "Select acquired OD and OS pinhole results.",
    alternatives: [],
    feedback: "Use pinhole improvement as supporting evidence, with its limitations.",
  },
  {
    id: "interpretation:refraction",
    dimension: "Interpretation",
    weight: 7,
    label: "Refraction evidence",
    rule: "Select acquired OD and OS subjective endpoints.",
    alternatives: [],
    feedback: "Cite both completed refraction endpoints and corrected acuities.",
  },
  {
    id: "management:correction",
    dimension: "Management / communication",
    weight: 8,
    label: "Optical correction",
    rule: "Choose completed-refraction optical correction; proportional evidence credit by eye.",
    alternatives: [],
    feedback:
      "Base optical correction on completed refraction, rather than pinhole or an objective estimate alone.",
  },
  {
    id: "management:followup",
    dimension: "Management / communication",
    weight: 6,
    label: "Ocular-health review and follow-up",
    rule: "Choose health review/follow-up with acquired anterior and fundus findings in both eyes.",
    alternatives: ["Institution-approved review after appropriate ocular-health assessment"],
    feedback:
      "Integrate ocular-health findings and limitations. Exact recall and referral pathways require local review.",
  },
  {
    id: "management:explain",
    dimension: "Management / communication",
    weight: 6,
    label: "Explanation and safety advice",
    rule: "Choose explanation and advice to seek prompt care for sudden changes; each earns three points.",
    alternatives: [],
    feedback:
      "Explain the findings and the proposed next steps in patient language, including advice about sudden changes.",
  },
];
export const clinicalCase: ClinicalCase = {
  id: "adult_distance_blur_01",
  version: "0.1-draft",
  reviewStatus: "draft",
  briefing:
    "A 24-year-old adult attends for difficulty seeing distant objects. Take a history, select examinations, and explain your assessment and next steps.",
  patient: {
    name: "Arun",
    age: 24,
    openingLine:
      "Things across the room have looked blurry for a few months. Reading up close seems okay.",
  },
  historyFacts,
  exams,
  rubric: {
    version: "0.1-draft",
    criteria,
    criticalOmissions: [
      {
        id: "safety-history",
        label: "Safety history was not elicited.",
        kind: "history",
        requiredIds: ["safety"],
      },
      {
        id: "ocular-health",
        label:
          "Ocular-health assessment is incomplete. The authored fundus view is limited, even when obtained.",
        kind: "exam",
        requiredIds: ["anterior", "fundus"],
      },
    ],
  },
  answerKey: {
    diagnosis: "myopia",
    interpretation:
      "Bilateral myopia / refractive error consistent with the gathered findings. Pinhole improvement supports a refractive contribution; it neither determines a prescription nor excludes disease.",
    management:
      "Optical correction based on completed refraction, explanation of findings, and an appropriate follow-up plan after ocular-health assessment. Exact wording and recall interval require the clinical partner’s approval.",
  },
};
