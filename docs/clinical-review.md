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

The slit lamp stays at its table. The direct ophthalmoscope is stored on the trolley and launches a simulated patient examination. Equipment selection alone reveals nothing and earns nothing. Physical positioning or instrument handling is not assessed.

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
