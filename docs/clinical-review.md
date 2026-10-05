# Clinical review packet — requires clinician review

Case `adult_distance_blur_01`, case version `0.1-draft`, rubric version `0.1-draft`.

This is a fictional demonstration of clinical reasoning and examination selection. It is not clinically validated, a full clinical protocol, or certification of manual technique. No clinical approval has been recorded. The 8–12 minute encounter is a product target, not an examination standard.

## Inspectable sources of truth

- `web/cases/adultDistanceBlur.ts`: all authored history, findings, equipment/procedure mappings, valid configurations, workflow dependencies, rubric criteria, answer key and draft omission flags.
- `web/domain/types.ts`: typed case/session schema, discrete refraction fields and event types.
- `web/domain/engine.ts`: disclosure, result gating, transitions and deterministic assessment.
- `web/patient/scripted.ts`: supported question matching and uncertainty responses.
- Debrief → Export review: attempt, questions, disclosure status, acquired result IDs, submitted evidence, individual criteria and cited event IDs.

Opening complaint appears at the start but does not award a whole history domain automatically. Suggested questions reveal one authored domain. Free text can reveal more than one matched domain; partial sub-domain credit is not implemented. Unknown detail is not filled with extra negative history. Please review this disclosure granularity for the teaching audience.

## Fixed case facts

Arun is a fictional 24-year-old adult. Gradual distance blur has developed over six months, without sudden deterioration. Both eyes are affected; reading near is comfortable. Lecture slides and distant signs are difficult. No prior glasses/contact lenses. No pain, redness, diplopia or marked light sensitivity. No recent trauma, sudden vision loss, new flashes/floaters or curtain-like visual loss. No known diabetes, ocular surgery, regular medication or medication allergy reported. Mother wears distance glasses. Willing to undergo explained, simulated non-invasive examinations. Additional history is unknown unless separately authored and reviewed.

## Findings and scope

| Procedure | Authored result | Configuration / limitation |
| --- | --- | --- |
| Distance acuity | OD/right 6/18; OS/left 6/18 | Each eye independently, unaided, simulated 6 m |
| Pinhole acuity | OD 6/6; OS 6/6 | Each eye independently; baseline of same eye first |
| Near acuity | N6 each eye | Unaided at 40 cm; N notation is near-print size |
| General pupils | Equal and reactive | OU; no RAPD claim from this selection |
| RAPD procedure | No RAPD in authored assessment | Separate procedure choice, OU |
| Near pupil response | Convergence and equal constriction; fixation maintained | Qualitative 40 cm to 20 cm sequence; no break-point measurement |
| Cover test | No refixation movement on cover–uncover or alternating cover | Distance and near separately; no quantified phoria authored |
| Motility | Full; no reported diplopia during procedure | OU; no full binocular-workup claim |
| Objective refraction | Gross OD +0.25 D and OS 0.00 D at 67 cm; net OD −1.25 D sphere and OS −1.50 D sphere | Manual with/neutral/against bracketing; cylinder explicitly 0.00 D, axis not applicable; −1.50 D working-distance correction |
| Subjective endpoint | Same sphere values; corrected OD and OS 6/6 | Separate eyes; objective same-eye result first in draft |
| Anterior segment | Authored lids/lashes, conjunctiva, cornea, chamber, iris, lens within normal limits | Each eye; does not imply normal posterior segment |
| Fundus | Authored disc, macula, visible posterior pole within normal limits | Each eye; limited undilated direct view; peripheral retina not fully assessed |

Pinhole improvement supports a refractive contribution. It does not establish myopia, determine a prescription, or exclude eye disease. The decorative wall chart is not calibrated, and the trainee is never asked to read its small letters.

The slit lamp stays at its table. The direct ophthalmoscope is stored on the trolley and launches a simulated patient examination. Equipment selection alone earns nothing. Supported XR tool use can reveal the existing authored visual responses; explicit completed recording remains necessary for evidence and scoring. Physical positioning or instrument handling is not a validated competency assessment.

## Free-roam consultation XR — draft interaction review

Hirschberg Practice now reuses the consultation room and physical controller runtime, with its own existing authored scenarios and local completion state. This does not reuse Arun's normal case as every Practice finding. The four existing interpretations and approximate landmarks are unchanged. The display maps the earlier illustrative reflex offsets to the canonical patient's 8 mm geometric pupil radius (pupil-edge), 9 mm midpoint, and 10 mm iris radius (limbus); these are scene dimensions, not claims about human anatomy or calibrated measurements. Review is needed to assess whether the reflex and landmark differences remain legible and educationally appropriate at headset resolution. Existing 46–54 cm and 8° input tolerances are unchanged. No new disease physiology, clinical facts, rubric changes, or approval are introduced. Direct interpretation entry, invalidation, immediate feedback, and separation from Test evidence are interaction changes only. Review status remains draft.

The existing fictional Arun case now permits physical exploration without a selected examination. A lit penlight aimed at either eye shows the case's existing bilateral direct/consensual constriction. A held illuminated fixation target drives the existing normal movement illustration after a following instruction; the occluder physically obscures an eye without inventing an abnormal refixation finding. Room lighting and patient instructions are separate controls. These visuals are illustrative, not calibrated physiology; the wider visible-light tolerance (3–120 cm and 12°) is an engineering aid, while optional guided recording retains its prior 20–80 cm working zone and observation sequence.

Pickup reveals no answer-key labels and awards no examination credit. Free-roam tool use does not silently record results, satisfy evidence requirements, or alter scoring. The learner requests history, notebook, and their own assessment explicitly. Guided technique panels are retained internally and disabled in production XR. A compact observation-entry drawer is requested through Record finding beside a held tool or Record observation in the menu; it retains the general pupil, cover, target, and scope completion/structured-observation requirements and emits the same finding/event actions as desktop. Learner-entered values stay distinct from the authored expected value. Unfinished observation, cancel, and exit record nothing. The review status stays draft. Clinician review must assess whether the free observation workflow and visual approximations adequately support the authored case; in-headset capture for the remaining examinations is still outstanding.

XR retinoscopy uses the unchanged case-authored spherical refraction and shared desktop reflex calculations. The optical emitter's physical distance and aim determine the visible illustrative streak; learner-controlled lens power changes its motion, width, and brightness. Recording carries over straight-ahead fixation, the existing 67 cm setup, with/against bracketing, neutrality at 90° and 180°, returning to the neutralising lens, light-off completion, and gross/correction/net/cylinder/axis entries. A ±2 cm working-zone tolerance and two uninterrupted crossings between ±4 mm patient-plane offsets are engineering gates, not clinical standards or competency criteria. Lens/streak/tracking interruptions clear incomplete sweeps; compatible completed observations remain until save, explicit cancel, patient-instruction change, or exit. Reviewer decisions remain open for the sweep representation, lens-control placement, and suitability of these gates in a headset.

XR direct ophthalmoscopy places the existing schematic posterior-pole illustration inside the instrument's rear aperture. The front optic must aim within 2.5 cm of a pupil centre at 3–25 cm, and the headset eye must be behind the aperture at 1–14 cm, within 3.5 cm laterally, looking through it within 25°. A continuous 1.2-second view permits entry for the inspected eye after releasing the trigger. These tolerances and dwell are interaction aids; they do not simulate magnification, refractive focus, the optical field, eye accommodation, a clinical examination duration, or disease physiology. Only the unchanged authored disc, macula, and visible-pole scope is illustrated; the peripheral retina remains unassessed. Clinician and physical-device review must assess the aperture usability and whether the view supports the requested structured observations. No new case facts, scoring weights, reference values, or clinical approval are introduced.

## Rubric review

| Dimension | Weight | Draft scoring |
| --- | ---: | --- |
| History | 25 | Unique disclosed domains: onset 3, distance/near 3, laterality 2, impact 2, correction 2, symptoms 3, safety 4, general history 3, family 2, consent 1 |
| Examination selection | 30 | Distance 4, pinhole 3, near 2, pupils 2, cover 2, motility 2, objective 4, subjective 5, anterior 3, fundus 3 |
| Interpretation | 25 | Diagnosis 10, selected acquired baseline evidence 4, pinhole evidence 4, subjective endpoint evidence 7 |
| Management / communication | 20 | Optical correction supported by refraction 8; health review and follow-up supported by anterior/fundus results 6; structured explanation and safety choices 3 each |

Per-examination points are proportional to completed authored eye/configuration combinations. No score is awarded merely for opening a station. No extra score for repeats. The only dependencies are same-eye baseline → pinhole and objective → subjective; these are case configuration, not universal clinical rules. Alternative independent procedure order is supported.

Free-text clinical reasoning, management reasoning and patient explanation are unscored and preserved for human review. Structured communication choices assess intent, not the quality of the written explanation. Optional further assessment/referral is recorded without a penalty or additional points. Supporting evidence must be acquired. An otherwise correct diagnosis can receive 10 points while missing assessments remain prominent.

Safety-history and incomplete anterior/fundus assessment are provisional prominent omission flags requested for this draft. They do not impose score caps. The clinical partner must decide whether these flags, scope and weights are appropriate. The undilated view never proves an adequate peripheral-retinal assessment. No pass threshold is implemented.

## Decisions awaiting the clinical partner

- [ ] Identify audience: first-year, final-year, interns or another group.
- [ ] Confirm adult refraction as the first module versus binocular vision.
- [ ] Confirm local Indian equipment, notation and examination conventions.
- [ ] Review mutual plausibility of all authored numerical and observational findings.
- [ ] Approve history-domain granularity, question wording and uncertainty handling.
- [ ] Define expected versus optional examinations and acceptable alternative workflows.
- [ ] Review draft same-eye prerequisites; revise case configuration where appropriate.
- [ ] Decide what constitutes adequate ocular-health assessment and whether an undilated view is sufficient for this teaching objective.
- [ ] Approve patient explanation, safety advice, referral pathway and follow-up wording. No recall interval is invented in this version.
- [ ] Review rubric weights, acceptable interpretation alternatives and proportional eye/configuration credit.
- [ ] Decide which omissions need prominent feedback and whether any caps are justified.
- [ ] Review the distinction between structured communication intention and unscored free-text quality.
- [ ] Confirm simplified interactions assess the intended skill without implying manual competence.
- [ ] Review instrument geometry, station layout and patient depiction with intended trainees.
- [ ] Observe pilot completion time; the target has not been empirically established.
- [ ] Record clinician name, institution, review date, corrections, approved version and sign-off before changing review status.

## Reference context supplied in the product specification

These establish broad examination categories, not endorsement of the case, rubric or numbers. No UK/US legal requirements are imported into Indian practice. URLs below were supplied with an access date of 30 September 2026; this implementation did not independently re-audit clinical guidance.

- AOA comprehensive eye exams: https://www.aoa.org/healthy-eyes/caring-for-your-eyes/eye-exams
- College of Optometrists routine examination: https://www.college-optometrists.org/clinical-guidance/guidance/knowledge,-skills-and-performance/the-routine-eye-examination
- Community Eye Health, detecting myopia: https://pmc.ncbi.nlm.nih.gov/articles/PMC6688402/
- Community Eye Health, refractive-error case finding: https://archive.cehjournal.org/article/case-finding-in-the-clinic-refractive-errors/
- EyeWiki slit lamp: https://eyewiki.aao.org/Slit_Lamp_Examination
- EyeWiki retinoscopy: https://eyewiki.aao.org/Retinoscopy

## Krimsky Practice — draft review pending

Practice is separate from the adult-distance-blur Test case and rubric. The current Krimsky implementation follows the supplied notes documented in `docs/binocular-vision-practice.md`: standard prism placement before deviating OS, modified placement before fixating OD, approximately 50 cm fixation light and monocular examiner viewing. Existing fictional examples use 20Δ BI for left exotropia and 15Δ BO for left esotropia. These values are illustrative authored endpoints, not clinical thresholds. Relative reflex displacement uses a simplified linear model with wrong-base divergence and overcorrection; it is not calibrated optical physiology.

Review decisions remain unresolved: verify standard/modified nomenclature, base versus apex terminology, example values, technique sequence and the modified method's reflex representation. Both reflexes remain visible; unreliable reflexes and scarred corneas are not simulated. No clinician approval or certification claim is supplied. Source notes are not approval. Test case facts and scoring are unchanged.


## Additional shared-clinic Practice adapters — draft

Bruckner, motility, cover–uncover and alternating cover with prism neutralisation reuse existing Practice content. Bruckner's three brightness findings, motility's existing coordinated/no-symptom example, the three cover patterns and four alternate-cover neutralising endpoints are unchanged. Bruckner and cover content now live in shared interaction/content modules used by desktop and XR; Test case facts and rubric are unchanged. Motility retains the existing policy of accepting a recorded full/limited/uncertain observation after nine gaze dwells and the symptom question, with a recheck notice for non-full entries.

Engineering assumptions needing clinician/device review: Bruckner's broad/narrow beam half-angles are 0.16/0.04 radians, midpoint aim uses a 5 cm illustrative allowance and the existing 90–110 cm working range; rear viewing reuses the existing 1–14 cm/3.5 cm lateral/25° aperture check. Motility reuses the forgiving 28–45 cm XR range around taught 30–40 cm. Cover placement allows 2.5 cm horizontal/3 cm vertical offset, 1.8–12 cm in front of an eye, and 40° tilt; prism placement uses 2.2 cm/2.5 cm offsets and 1.8–15 cm forward. These are interaction tolerances, not validated clinical handling. Alternate-cover transit permits 0.35 s before resetting dissociation. Authored refixation pulses use 4 mm horizontal/3 mm vertical scene displacement and are illustrative. The selected gold-ringed prism cell uses base/power settings; it does not model calibrated refraction through every cell or physiological under/overcorrection. Near targets use the existing 38–42 cm gate and 12 cm assisted stand snap; the mount sits 7.5 cm below eye height so the card does not hide the eyes. Distance fixation is illustrative in this room, not a measured 6 m lane. Recording an attempt does not require both distance and near; reset/repeat provides independent attempts, as in desktop.

All these interactions remain **draft**. Qualified review and physical Quest 3S assessment of visibility, timing, orientation and teaching fidelity remain outstanding. No new clinical approval, disease physiology, scoring or management rules are introduced.


## Shared-clinic Krimsky adapter — draft review pending

The new XR adapter reuses `krimskyCases`, method/eye mapping, readiness, and signed residual functions from the existing desktop trainer. Standard is prism before deviating OS; modified is before fixating OD. The unchanged 20Δ BI/15Δ BO examples and visible relative-reflex model are not new clinical thresholds or disease claims. The shared patient shows OS displacement relative to OD in both methods, consistent with the desktop schematic; modified does not simulate a scarred cornea. Review status remains **draft**; Test facts, expected case values and rubric are unchanged.

Additional engineering assumptions: the existing 46–54 cm penlight teaching zone and shared 8° aim/head-view gates are used; the prism uses the existing 2.2 cm horizontal/2.5 cm vertical, 1.8–15 cm forward and 40° tilt placement tolerance. Baseline inspection requires the prism working point to be at least 20 cm clear of both eyes. The source linear displacement is scaled by 0.1 into the canonical eye geometry and capped at ±9 mm; this is a legibility aid, not physiological calibration. BI/BO and 0–40Δ integer controls reuse the desktop range. Monocular examiner viewing is an explicit acknowledgement, since no eye tracking/closure detection is requested.

Baseline inspection and reflex comparison remain explicit learner actions. A matching, fully aligned prism-hand trigger comparison captures method/eye/base/power and actual illustrative distance. It does not award completion or auto-fill the power entry. A completed capture survives later physical movement/light release to make two-hand recording practical; configuration changes invalidate it. Cancel clears capture and records nothing, and explicit correct independent entry awards Practice progress once. Clinician review must assess this observation/recording separation and the baseline/reflex visibility; physical Quest 3S checks of reach, tilt, text and controller routing remain outstanding. No clinical certification is implied.

## Shared-clinic sensory adapters — draft review pending

Worth four dot, circle-booklet stereopsis and 4Δ base-out now reuse the current Practice-authored reports, levels, response order, timings and interpretation mappings in the canonical clinic. They do not change Arun's Test facts, rubric, omissions, management or expected values. No new clinical cutoff, pass mark or approval is added.

Engineering assumptions needing review: assisted trial-frame/filter sockets with canonical OD/OS alignment and separate layers; a ±2 cm Worth near-placement handling tolerance around 40 cm; existing 38–42 cm stereo distance; a bounded reflected-image 6 m path in the small room; explicitly illustrative isolated-letter fixation without an acuity; filter-cancellation and reported-percept diagrams; patient-scale conversion of existing exaggerated prism movements; frontal observer/working-cell pose checks and physical withdrawal before OS. Worth's authored central-OS change at 200 cm remains a fictional scenario behavior, not a suppression cutoff. The booklet reports the fictional patient's vision, not a calibrated Quest stereo stimulus.

Local immutable captures retain setup revision and observations separately from learner entries. Near/distance Worth observations and the bilateral prism comparison require explicit independent entry. Stereo requires named-circle confirmation before advancing and independent last-correct threshold entry. Software tests establish logic/geometry and mounted simulated-controller flows only. Physical Quest 3S validation and qualified clinician review of procedure fidelity, readable stimuli, mirrored representation, patient fitting and response diagrams remain necessary before release. Status remains **draft**.


## Full-library XR completion — draft review pending

Phoria, vergence and accommodation complete the shared-clinic migration of the existing 20 Practice modules. Numerical findings, interpretation mappings and authored desktop gaze formulas are reused without changing case facts or Test scoring. Shared constants were extracted for NPC, vergence, push-up and Thorington; existing minus-lens, relative-accommodation and facility logic remains authoritative. No new clinical approval, treatment rule, pass mark or normative timing is introduced.

Engineering assumptions require review: separate correction/OD-rod/opposite-eye-occluder fitting layers; 38–42 cm near handling; mirror representation of the existing 6 m Maddox/distance fixation; actual target movement from the spectacle plane; at most 0.5 cm directional overshoot around existing blur/break/recovery endpoints; patient-facing near optics; existing 1200 ms fictional response settling for sequential lens changes; illustrative reported streak/number/diplopia and patient-scale gaze offsets. These are interface assumptions, not calibrated clinical measurements. Captured actual distances and independent calculated amplitudes remain distinct from authored endpoints. Full pairs and 60-second timing are recorded separately for each required eye condition; tracking/visibility/setup interruptions earn no unfinished credit.

Clinician review must assess source fidelity and these approximations; physical Quest 3S checks must establish ergonomics, stimulus/panel readability, reach, tracking recovery and frame timing. See `vr-library-completion.md`. Clinical status remains **draft** and all physical acceptance remains pending.
