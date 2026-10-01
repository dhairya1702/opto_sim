# Binocular-vision Practice modules — clinical draft

This packet records the clinical material supplied by the product owner after consultation with an optometrist. The supplied reference was **Assessment of Binocular Vision**, DOI `10.5772/intechopen.1002991`. The implementation has not independently established that this source represents local policy, current consensus, or sufficient instruction for unsupervised clinical practice.

## Product boundary

Practice mode teaches one procedure at a time with visible guidance and immediate feedback. It is distinct from Test mode, where the learner selects examinations and diagnoses a fictional patient without procedural coaching. Practice completion is not a score, pass mark, or certification of technique.

## Implemented first slice

### 3.1 Extraocular motilities

- Purpose: assess conjugate movement of both eyes.
- Equipment and distance: penlight at 30–40 cm.
- Patient instruction: follow the light with the eyes without moving the head; report diplopia, pain, or discomfort in any direction.
- Path: primary position followed by the eight cardinal directions, represented by an H pattern with a central vertical path.
- Observe: corneal reflex, smoothness, accuracy, extent, jerky or nystagmoid movement, and reported symptoms.
- Normal recording taught in Practice: `FROM` (full range of ocular movements), with smooth/accurate movement and absent reported symptoms stated explicitly.
- Abnormal recording: name the eye, direction of gaze, observed movement deficit, and symptoms.
- Escalation: diplopia must be localized to gaze direction and followed by diplopia charting.

The interaction requires primary position plus eight cardinal positions, visible penlight power, and a symptom question. The first-person scene shows the instrument hand and a non-contact free-hand cue. It remains an illustrative enlarged-eye view, not a spatially calibrated technique assessment.

### 3.2 Bruckner test

- Intended use in the supplied material: screening in infants and preverbal children.
- Equipment: direct ophthalmoscope with large illumination spot.
- Setup: approximately 1 metre, with a spot large enough to illuminate both pupils simultaneously and the patient looking at the light.
- Observe: relative brightness of both red reflexes through the peephole.
- Record: equal or unequal; if unequal, identify the brighter eye.
- Interpretation taught conservatively: equal brightness supports binocular fixation in this screening observation. Unequal brightness is not a diagnosis and may have several explanations, including strabismus, anisometropia, anisocoria, or media opacity.

The trainer varies equal, OD-brighter, and OS-brighter examples. In the full-screen first-person attempt the right hand holds and aims the direct ophthalmoscope; the left hand selects the large aperture and is then removed from view. The large-spot footprint visibly covers both pupils, while enlarged high-contrast centres and halos make the illustrative red-reflex comparison legible. The learner must instruct fixation, switch on the light, work near 1 metre, centre the beam, and directly move the examiner view into peephole alignment with a drag or keyboard control before either reflex is revealed.

### 3.3 Hirschberg test

- Purpose: identify a manifest deviation from the relative positions of the corneal light reflexes and estimate its size approximately.
- Equipment and distance: penlight at approximately 50 cm; patient looks directly at it.
- Direction rules supplied:
  - nasal reflex in the deviating eye → exotropia;
  - temporal reflex → esotropia;
  - reflex above pupil centre → hypotropia relative to the fixating eye;
  - reflex below pupil centre → hypertropia relative to the fixating eye.
- Approximate landmarks supplied: pupil edge ≈ 15°, midway between pupil edge and limbus ≈ 30°, limbus ≈ 45°.
- The supplied text also states that 1 mm of displacement corresponds to 22 prism units. This relationship is not currently used by the trainer and requires clinician clarification of units and intended teaching precision.

The trainer currently includes centred, horizontal, and vertical examples. In the full-screen first-person attempt the right hand holds and aims the penlight while the other hand stays clear because no patient contact is needed. The learner must instruct fixation, switch on the light, work near 50 cm, centre the beam, and centre their viewing position before the corneal reflexes are revealed. Landmark estimates remain screening approximations and point toward prism neutralisation when measurement is required.

## Interaction model

These Practice scenes are designed from a future-VR interaction model even though the current input is desktop pointer, wheel, keyboard, and native controls. Each hand has a defined role rather than being animated decor: the dominant hand owns the instrument pose; the non-dominant hand performs an actual adjustment when required or remains visibly clear. Technique state is invalidated when light, distance, aim, or viewing alignment is lost. The current geometry and optics are illustrative and do not claim calibrated hand tracking, photometry, or patient-contact technique.

### 3.6 Cover–uncover test

- Purpose: distinguish manifest deviation (tropia), latent deviation (phoria), and no observed deviation by the timing of refixation.
- Cover phase: cover the fixating eye and watch the eye that remains uncovered. Movement to take fixation indicates tropia.
- Uncover phase: remove the cover and observe immediately. Movement on uncovering reveals a phoria that had been controlled by fusion.
- No movement on covering or uncovering supports orthophoria.
- If the uncovered eye takes fixation and returns to its deviated position when the habitual fixating eye is uncovered, the tropia is unilateral in the deviating eye. Retained fixation with the fellow eye assuming the deviation indicates an alternating tropia.
- Repeat using a near target at 40 cm.

The full-screen trainer provides orthophoria, unilateral left esotropia, and exophoria patterns. The dominant hand controls the occluder. At near, the non-dominant hand holds the fixation target and incorrect target distance prevents sequence progress.

### 3.7 Alternating cover test

- Alternate directly from one eye to the other after a few seconds, repeating several times without exposing both eyes between shifts, to disrupt fusion.
- Direction mapping supplied: eye movement in → exo; out → eso; up → hypo; down → hyper.
- Neutralising prisms supplied: exo → base in; eso → base out; hypo → base up; hyper → base down.
- Place the prism bar before either eye and increase prism power gradually until no movement is seen on alternating cover.
- The neutralising prism is recorded as the magnitude of the phoria or tropia. Repeat for near.

The trainer varies horizontal and vertical deviations. The dominant hand alternates the occluder while the non-dominant hand holds the prism bar. A prism trial must be followed by a repeated alternating-cover sequence; movement disappears only when both base direction and prism power reach the authored endpoint.

### 4.1 Worth four dot

The trainer applies red before OD and green before OS, requires a colour-cancellation check, presents the target at selectable distances, and varies fusion, monocular suppression, crossed/uncrossed diplopia, and vertical diplopia responses. The learner records number, colour relationship, relative position, and test distance.

### 4.2 Stereopsis

The trainer requires near correction, Polaroid or red–green viewing glasses, and a stereo booklet at 40 cm. The simulated patient progresses from coarse to fine disparity until two consecutive incorrect responses; the learner records the last correct threshold in seconds of arc.

### 4.3 Four prism diopter base-out

The trainer requires best distance correction, fixation on an isolated letter one line above the poorer eye's best acuity, and a 4Δ base-out prism. The prism is held before each eye in turn. Normal responses include outward version followed by inward refixation for both placements; the suppression scenario distinguishes absent refixation with prism before the better eye from no movement with prism before the suppressing eye.

### 5.1 Maddox rod method

The trainer measures lateral or vertical phoria at 6 m and 40 cm. A Maddox rod is placed before OD with horizontal grooves for a vertical streak in lateral testing or vertical grooves for a horizontal streak in vertical testing. The learner introduces base-in or base-up prism and reduces power until the patient reports that the streak bisects the light, then records prism amount and base.

### 5.2 Modified Thorington

The trainer requires usual near correction, a Maddox rod before OD, and the appropriate horizontal or vertical card at 40 cm with a penlight through its centre. The patient reports the numbered line crossed by the streak. The learner records magnitude in prism dioptres and direction: right/left for eso/exo and above/below for left/right hyperphoria.

### 6.1–6.5 Vergence tests

Practice includes NPC break/recovery, horizontal fusional vergence at distance and near, vertical distance vergence, and near vergence facility. NPC starts at 40 cm and records subjective and objective break followed by subjective and objective recovery from the spectacle plane. Horizontal modules separate blur, break, and recovery for BI and BO; vertical testing records break/recovery only. BI precedes BO, and BU precedes BD. Facility alternates 12Δ BO and 3Δ BI for 60 seconds and counts a cycle only after both sides are cleared.

### 7.1–7.4 Accommodation tests

Push-up amplitude records the first sustained blur distance and calculates amplitude as `100 / distance in cm`; OD, OS, and OU must each be tested. Minus-lens amplitude adds minus lenses in 0.25 D steps at 40 cm and records the absolute minus power plus 2.50 D for OD and OS. NRA/PRA is binocular: plus is added to sustained blur, the test returns to baseline, then minus is added to sustained blur. Accommodative facility uses a ±2.00 D flipper for separate 60-second OD, OS, and OU runs; clearing both sides constitutes one cycle.

## Krimsky module

### 3.4 Krimsky test

The active guided module is implemented as a draft extension of Hirschberg. Establish fixation, light, the illustrative 50 cm distance and monocular examiner view, then inspect baseline reflexes. Choose prism eye and base, and increase power with dragging, arrow keys or the slider until relative reflex positions match. Record the neutralising power; the feedback retains base, eye, distance and method. Standard placement is before deviating OS; modified placement is before fixating OD, following the supplied notes' naming convention. Switching method, light or distance clears the baseline and prism attempt; changing eye or base clears power and the observation.

The existing authored examples are left exotropia (20Δ BI) and left esotropia (15Δ BO). Wrong-base adjustment increases asymmetry; excess power reverses it. These are illustrative training values, not sourced diagnostic thresholds or calibrated optics. The modified example retains visible reflexes and does not model corneal scarring. Clinician review remains required for naming conventions, base/apex terminology, numerical examples and the simplified reflex model; no approval is recorded.

## Clinical decisions still required

- Confirm the intended learner level and whether procedural wording should be adapted for students, interns, or qualified clinicians.
- Confirm terminology: `FROM`, “extraocular motilities,” prism-dioptre notation, and local recording conventions.
- Review whether pain/discomfort screening belongs at every gaze point or as a continuous instruction.
- Confirm safe ophthalmoscope illumination language for infants and young children.
- Clarify whether unequal Bruckner reflex brightness should be described as a non-fixating eye or only as a finding requiring further assessment.
- Confirm Hirschberg landmark estimates and the supplied millimetre-to-prism relationship before adding numerical conversion.
- Approve abnormal scenarios and visual exaggeration before they are used for assessment.
- Confirm local recording format and acceptable dwell timing for alternate cover and prism neutralisation.
