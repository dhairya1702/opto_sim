# Binocular-vision Practice modules — clinical draft

This packet records the clinical material supplied by the product owner after consultation with an optometrist. The supplied reference was **Assessment of Binocular Vision**, DOI `10.5772/intechopen.1002991`. The implementation has not independently established that this source represents local policy, current consensus, or sufficient instruction for unsupervised clinical practice.

## Product boundary

Each skill offers Guided Practice and a module-level Test. They use the same authored finding bank, patient behaviour, procedure requirements, and answer validation; Guided Practice alone adds next-step coaching and gaze guides. The broader consultation Test remains distinct: there the learner selects examinations and diagnoses a fictional patient. Practice completion is not a score, pass mark, or certification of technique.

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

The interaction requires primary position plus eight cardinal positions, visible penlight power, and a symptom question. Guided Practice and the module-level Test share five authored examples: full smooth movement OU; restricted OD abduction in right gaze; restricted OS abduction in left gaze; restricted OD elevation in upgaze; and horizontal jerk-like nystagmus in right gaze. Each abnormal example has a direction-specific fictional symptom report and requires the matching eye/direction/observed-deficit record. The first-person scene shows the instrument hand and a non-contact free-hand cue. Movement restrictions and oscillation are deliberately visible educational approximations, not diagnoses, calibrated physiology, or a spatially calibrated technique assessment. These new examples and their symptom wording require clinician review.

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

The trainer currently includes centred, horizontal, and vertical examples. In the full-screen first-person attempt the right hand holds and aims the penlight while the other hand stays clear because no patient contact is needed. Switching on the light immediately shows the beam and a basic reflex; working near 50 cm, centring the beam, instructing fixation, and centring the examiner view improve its clarity and enable observation. Reflex positions use visibly separated pupil-edge, midway-to-limbus, and limbus landmarks, with an answer-neutral transition and OD/OS labels when a new example loads. These remain illustrative screening approximations and point toward prism neutralisation when measurement is required.

## Interaction model

Practice retains desktop pointer, wheel, keyboard, and native controls. Hirschberg additionally has an experimental Quest/WebXR controller vertical slice: either controller grips the penlight, the trigger operates illumination, physical pose supplies distance and aim, headset pose supplies examiner alignment, and the other controller ray operates an in-world panel. The same pure technique logic gates desktop and spatial inputs. Light and distance changes produce an immediate visual consequence; correct setup improves the view, while inspection and recording remain gated. Small working ranges and XR angle tolerances are illustrative interaction aids, not calibrated clinical thresholds. The current geometry and optics do not claim calibrated tracking, photometry, patient-contact technique, or certification of manual competence. Physical Quest validation and clinician review remain required.

Hirschberg's active VR attempt now uses the consultation interior and `useXRClinicRuntime`, rather than its earlier standalone controller/world implementation. The current four authored findings and lesson rules remain unchanged. `clinicHirschbergReflex` converts their existing displacement direction/landmark to the canonical pupil/iris scale; OD remains the patient's right eye. Fixation, trigger illumination, 46–54 cm distance, and the existing 8° aim/view gates remain required for explicit recording. Learner choices are blank, direct controller buttons; feedback follows submission. Invalid technique clears unfinished entry, successful feedback persists until retry/reset/new finding, and local Practice progress never produces Test evidence. Help is optional; new finding stays inside the same immersive session. The desktop trainer remains unchanged, the new preview inspects clinic layout only, and the older controller preview/height controls remain in the retained legacy source. Remaining modules migrate through lesson adapters over this runtime; their current desktop attempts and teaching remain available.

### 3.6 Cover–uncover test

- Purpose: distinguish manifest deviation (tropia), latent deviation (phoria), and no observed deviation by the timing of refixation.
- Cover phase: cover the fixating eye and watch the eye that remains uncovered. Movement to take fixation indicates tropia.
- Uncover phase: remove the cover and observe immediately. Movement on uncovering reveals a phoria that had been controlled by fusion.
- No movement on covering or uncovering supports orthophoria.
- If the uncovered eye takes fixation and returns to its deviated position when the habitual fixating eye is uncovered, the tropia is unilateral in the deviating eye. Retained fixation with the fellow eye assuming the deviation indicates an alternating tropia.
- Repeat using a near target at 40 cm.

The full-screen trainer provides orthophoria, unilateral left esotropia, and exophoria patterns. The dominant hand controls the occluder. At near, the non-dominant hand holds the fixation target; its visible depth and size follow the distance control, and an incorrect target distance prevents sequence progress.

### 3.7 Alternating cover test

- Alternate directly from one eye to the other after a few seconds, repeating several times without exposing both eyes between shifts, to disrupt fusion.
- Direction mapping supplied: eye movement in → exo; out → eso; up → hypo; down → hyper.
- Neutralising prisms supplied: exo → base in; eso → base out; hypo → base up; hyper → base down.
- Place the prism bar before either eye and increase prism power gradually until no movement is seen on alternating cover.
- The neutralising prism is recorded as the magnitude of the phoria or tropia. Repeat for near.

The trainer varies horizontal and vertical deviations. The dominant hand alternates the occluder while the non-dominant hand holds the prism bar. A prism trial must be followed by a repeated alternating-cover sequence; movement disappears only when both base direction and prism power reach the authored endpoint.

In both the XR clinic and the desktop trainer, both cover tests now show sustained eye positions scaled by the deviation size. The left esotropia is visibly turned in before covering, refixation holds while the cover stays on, and a phoric eye drifts behind the cover and recovers on uncovering. In alternating cover, partial prism visibly reduces the movement. Draft magnitudes are 20Δ left esotropia and 10Δ exophoria. See the cover-test deviation update in `clinical-review.md`; review is pending.

Alternating cover now links the two eyes. The covered eye moves together with the refixation (Hering's law); vertical deviations move the eyes in opposite directions; and the eye looking through the prism turns toward its apex. Neutralisation is reached when neither eye moves, with the prism before either eye. The vertical cases are draft right hypo 8Δ and right hyper 10Δ, recorded as OD's movement plus an R/L deviation label. Desktop now restarts after binocular exposure, no longer fills in the deviation, and requires choosing which eye the prism is before. See the alternating-cover update in `clinical-review.md`.

### 4.1 Worth four dot

The trainer applies red before OD and green before OS, requires a colour-cancellation check, presents the target at selectable distances, and varies fusion, monocular suppression, crossed/uncrossed diplopia, and vertical diplopia responses. Drag, wheel, arrow, slider and endpoint controls move and scale the target immediately. The learner records number, colour relationship, relative position, and test distance.

### 4.2 Stereopsis

The trainer requires near correction, polarised viewing glasses, and a stereo booklet within an illustrative 38–42 cm range around the taught 40 cm position. Drag, wheel, arrow and slider input visibly move and scale the desktop booklet. Guided Practice follows nine event-driven steps: fit correction, fit the glasses, handle and position the booklet, establish current-page fixation, ask for the report, transcribe the named circle, classify it against the examiner-only rear-face key, turn one page, and independently record the threshold. The six authored patient replies remain correct through 100 arcsec and incorrect at 60 and 40 arcsec. Two consecutive classified errors stop the run. Confirmed immutable page records survive brief tracking or geometry interruption; only the unfinished page and fixation are cancelled. No timer or audio playback advances clinical state. Independent Test uses the same transitions without the coach or corrective hints.

### 4.3 Four prism diopter base-out

The trainer requires best distance correction, fixation on an isolated letter one line above the poorer eye's best acuity, and a 4Δ base-out prism. The prism is held before each eye in turn. Normal responses include outward version followed by inward refixation for both placements; the suppression scenario distinguishes absent refixation with prism before the better eye from no movement with prism before the suppressing eye.

The interaction now uses a dedicated fixed 4Δ handled prism rather than a 5Δ cell on the shared prism bar. Guided Practice has nine steps: fit correction; establish single isolated-letter fixation; pick up the prism; orient its physical base temporally for OD; observe OD for an uninterrupted 2400 ms; withdraw clear of both eyes; reverse the temporal orientation and observe OS; record separate OD/OS movement patterns; then interpret. Test uses the same engine and concealed seeded case deck without coach text, instructional highlights, expected observations, or scenario position. Voice may establish fixation (“look at/keep looking at the isolated letter” or “keep the letter single”) through the same gate as the button. Learner-entered bilateral observations, not authored response prose, form the visible record.

Unfinished dwell is cancelled by invalid placement, orientation, view, panel, release, tracking, or visibility. A completed OD capture is retained. Tracking recovery requires fresh fixation; a correction refit or explicit fixation clear restarts the complete comparison. Desktop credit advances only from valid rendered frames and is unavailable when WebGL observation fails. These behaviors are educational handling approximations pending clinician and physical-device review.

### 5.1 Maddox rod method

The trainer measures lateral or vertical phoria at 6 m and 40 cm. A Maddox rod is physically fitted before OD with horizontal grooves for a vertical streak in lateral testing or vertical grooves for a horizontal streak in vertical testing; changing axis requires removal, 90° roll and refitting rather than a menu choice. Distance uses the switched single-point target through the illustrative mirror path. Near uses a held, triggered penlight at 38–42 cm while the other hand holds the prism bar. The learner explicitly asks for the streak/light relationship, centres the 20Δ cell first, then slides through the shared `2, 4, 6, 8, 10, 12, 15, 20Δ` cells with the required tracked base arrow. A stable cell produces Arun's fictional report after 250 ms. The prism-hand trigger captures coincidence; blank power and BI/BO/BU/BD fields are graded independently from the immutable capture. The four draft findings remain 6Δ BI and 4Δ BU at both distance and near.

### 5.2 Modified Thorington

Desktop and XR now share one immutable procedure engine and the two retained fictional patterns: horizontal 6 right / vertical 4 above, interpreted as esophoria / left hyperphoria; and horizontal 8 left / vertical 3 below, interpreted as exophoria / right hyperphoria. Usual near correction and a physically fitted OD Maddox rod are required. Horizontal grooves precede vertical grooves; between axes the rod must be removed, rolled 90°, and refitted into the other same-centre socket rather than changed through a logical control.

One fixed combined cross card uses a uniform draft scale from −10 through +10 at 4 mm/Δ for the taught 40 cm geometry. It may be held or supported, but must remain 38–42 cm from Arun, upright within 30°, with the explicitly numbered surface facing him within 30°. The held, trigger-powered penlight stays on the examiner side, points toward Arun, remains within the draft 30 cm tip-to-card limit, and must intersect the card plane inside—not on—the actual 10 mm-radius central aperture. After an explicit fixation and number/side request, 250 ms of uninterrupted valid geometry automatically freezes the number, side, signed coordinate, actual distance, case, and axis. Ordinary release and panel entry preserve that capture; correction or rod reconfiguration clears an unrecorded one.

The learner puts the card and light down and independently enters magnitude, the raw right/left/above/below/through report, and clinical interpretation. None is preselected. The enlarged fictional patient-report illustration is separate from the physical card and is not a calibrated visual test. Voice waits no more than 400 ms for the engine-owned dwell, never creates evidence, and repeats a current capture without rerunning the procedure. Guided Practice exposes a ten-step state-derived coach and fitting highlights; independent Test keeps identical gates while hiding answer-bearing coaching, case identity, and interpretation help. The geometry, tolerances, dwell and readability remain draft assumptions pending clinician and Quest review.

### 6.1–6.5 Vergence tests

Practice includes NPC break/recovery, horizontal fusional vergence at distance and near, vertical distance vergence, and near vergence facility. NPC starts at 40 cm and records subjective and objective break followed by subjective and objective recovery from the spectacle plane. Horizontal modules separate blur, break, and recovery for BI and BO; vertical testing records break/recovery only. BI precedes BO, and BU precedes BD. Facility alternates 12Δ BO and 3Δ BI for 60 seconds and counts a cycle only after both sides are cleared.

### 7.1–7.4 Accommodation tests

Push-up amplitude records the first sustained blur distance and calculates amplitude as `100 / distance in cm`; OD, OS, and OU must each be tested. Minus-lens amplitude adds minus lenses in 0.25 D steps at 40 cm and records the absolute minus power plus 2.50 D for OD and OS. NRA/PRA is binocular: plus is added to sustained blur, the test returns to baseline, then minus is added to sustained blur. Accommodative facility uses a ±2.00 D flipper for separate 60-second OD, OS, and OU runs; clearing both sides constitutes one cycle.

## Krimsky module

### 3.4 Krimsky test

The active guided module is implemented as a draft extension of Hirschberg. Switching on the penlight immediately shows its glow, beam, and basic reflexes. Distance visibly moves and scales the held light and changes reflex clarity. Establish fixation, work within the illustrative 46–54 cm range around 50 cm, and select the left or right examiner-eye view by voice or the accessible buttons. The desktop camera shifts to that examiner eye; XR samples the corresponding headset eye pose and presents a monoscopic observation field to both displays. With the prism clear, an uninterrupted 0.8-second steady view captures baseline automatically. Choose prism eye and base, and increase power until relative reflex positions match. Record the neutralising power; the feedback retains base, eye, distance and method. Standard placement is before deviating OS; modified placement is before fixating OD, following the supplied notes' naming convention. Switching method, examiner eye, light or distance clears the baseline and prism attempt; changing prism eye or base clears power and the observation.

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

## Shared-clinic VR batch

Bruckner, motility, cover–uncover, and alternating cover now join Hirschberg in the same consultation clinic/runtime. Existing scenarios, interpretation labels, dwell math, and neutralising endpoints are reused; Krimsky subsequently joins these adapters, and phoria, vergence and accommodation now complete the 20-module XR library while preserving desktop attempts. Optional help/guide controls and blank explicit recording live inside the headset. Near-card motion selects near fixation, with an assisted 40 cm stand socket for two-hand prism/occluder use. The prism uses one selected working cell with illustrative base/power settings. Distance fixation is represented within the room, not a calibrated 6 m lane. Engineering cover placement/tilt, transit, aperture and eye-motion tolerances need review. Clinical review status remains draft; no new case facts, diagnoses or scoring rules are added. See `vr-practice-batch-plan.md`.

In XR, the ophthalmoscope has a shared physical small/large aperture wheel below its rear peephole, available in Practice and consultation. A nearby free controller points and presses/releases trigger to adjust it. Bruckner requires the large setting plus actual distance, aim, illumination, fixation and rear-view alignment; no wall button substitutes for the setup. Changing aperture clears pending inspection and entries. The desktop trainer retains its existing aperture controls.


## Shared-clinic Krimsky

Standard/modified Krimsky now launch through the same clinic shell and runtime. The existing two findings, BI/BO interpretation, 46–54 cm teaching zone, method/eye rule and relative residual model are reused. Live prism placement supplies the prism eye; physical penlight and selected headset-eye pose supply distance/aim/view. Examiner voice commands choose left-eye, right-eye, or binocular viewing, and precise accessible controls provide the same actions. A headset-following monoscopic observation field makes the selected view visible without blanking either display. Baseline captures after an uninterrupted 0.8-second ready dwell with the prism clear. The prism-hand thumbstick moves through the bar's authored 0/5/10/15/20/25/30/40Δ cells; the selected gold cell, sampled working point, readout, and haptic feedback stay aligned, with panel cell buttons as fallback. The prism-hand trigger explicitly captures a completed matching comparison, after which tools can be put down for independent blank numeric entry. Method/base/power/finding changes clear capture; cancelling or exiting records nothing. No Practice action writes Test evidence. The modified visual remains illustrative with both reflexes visible; clinician and Quest review remain pending. See `vr-krimsky-plan.md`.

## Shared-clinic sensory adapters — draft

Worth, stereopsis and 4Δ base-out retain `worth.ts`, `sensory.ts`, `stereoPractice.ts` and `fourPrism.ts` as authored content sources. Eight Worth scenarios, red OD/green OS mapping, central-OS's fictional distance behavior, six circle-booklet levels/replies, the two-error stopping rule, last-correct recording, 2400 ms prism observations and normal/OS-suppression responses are unchanged. No Test case facts, diagnosis, management or scoring change is introduced.

XR adds handling assumptions: fitted correction and filters use separate orientation-checked assisted layers; Worth's near endpoint uses ±2 cm around 40 cm as handling tolerance; stereo retains 38–42 cm. The room cannot hold a straight 6 m lane, so an illustrative bounded mirror reflection establishes Worth's existing 600 cm endpoint, with the physical target behind the patient's direct sightline. Actual sample and nominal endpoint are retained distinctly. The mirror is not calibrated optics. The same station displays an illustrative isolated letter for 4Δ fixation without assigning an acuity. Stereo models only the fictional patient's reported circle. The equal patient-side circles, rear examiner key, and enlarged reported view do not deliver calibrated stereoscopic disparity; headset and desktop stereo acuity are not measured.

Stereopsis Guided XR derives its nine-step coach from fitting, booklet handling/geometry, page-bound fixation, synchronous authored reply capture, accurate transcription, explicit learner classification, page turning and independent threshold entry. The upper-corner booklet control reuses the shared free-hand proximity and haptic policy; its board fallback calls the same one-page transition. Repeating a question replays the immutable current reply. Historical records, target keys, classification and threshold are never patient speech. Correction/filter revision restarts the comparison; ordinary invalid geometry or tracking retains confirmed pages and clears only the unfinished page. These behaviors and physical reach remain educational drafts pending clinician and Quest review.

Worth Guided VR now derives a 14-step coach entirely from live fitting, target handling/orientation/endpoint, persistent power, isolated-filter confirmations, endpoint-specific fixation, immutable report capture, and saved near/distance records. It advances only on those events, never on a dwell timer. Near is coached first, but a valid out-of-order distance record remains saved and the coach returns to the missing endpoint. Correction/filter revision restarts the comparison under the existing reset policy; movement, reversed orientation, loss of illumination, or tracking clears current fixation without rewriting an already captured report. Intermediate target positions cannot produce recordable captures.

The Worth target's modeled side switch is a reachable free-hand instrument control and shares one explicit on/off transition with the accessible board and the bounded voice commands. Power persists through release, transfer, panel use, and movement between endpoints, and clears on reset or VR exit. After endpoint-specific fixation, asking for number, colours, and relative positions produces the current fictional natural-language reply and enlarged illustrative report card; historical records remain separate and are not spoken as the current reply. Voice-disabled attempts retain equivalent board controls. The first correct endpoint produces non-awarding progress feedback; only two correct independent endpoint records complete Practice. Module-level Test preserves the same engine and gates while hiding the coach and instructional highlights. These interactions, speech, target optics, tolerances, and findings remain educational drafts pending qualified clinical and physical-device review.

Reviewer decisions remain unresolved for near/fitting tolerances, the mirrored-station representation, filter-cancellation diagrams, readable reported views, examiner viewing geometry, prism working-cell tolerance/scale and exaggerated eye-motion amplitude. Device testing must cover comfortable fitting/reach, physical near distances, both hands/transfers, panel ray selection, hands-free recording, tracking/guardian interruption, cleanup and frame timing. Review status remains draft. All 20 modules now share the XR clinic and keep existing desktop trainers.


## Shared-clinic phoria, vergence and accommodation — draft

The remaining 11 modules now offer Quest / WebXR. Existing Maddox trials, both Thorington finding sets, NPC and prism endpoints, accommodation powers/calculations, sequences and fictional response timings are preserved. Desktop and XR share extracted procedure engines and the existing `vergencePractice.ts` and `accommodationPractice.ts` findings/gaze formulas. New handling assumptions include fitted OD rod and opposite-eye cover sockets, physical near-card and optic alignment, 0.5 cm directional target overshoot allowances, actual spectacle-plane sample captures, and an illustrative mirrored distance station. Timing interruptions reset unfinished attempts; signed decimal findings are independently entered after completed capture. No pass marks, consultation Test evidence, or Test rubric changes were added. Qualified review of geometry, sequence/wording, gaze scaling, optical illustrations and readable stimuli remains pending. See `vr-library-completion.md`; status is draft.

XR Bruckner viewing update: keep the supplied approximately-1-metre, large-spot, patient-fixation and simultaneous red-reflex comparison sequence. The trigger illuminates the manually aimed ophthalmoscope; B/Y on its controller opens a readable enlarged view of both pupils, replacing headset-to-peephole alignment. Opening the view does not award completion, and the learner still independently records relative brightness. Desktop interactions remain available. This is an engineering adaptation pending clinician and Quest review.
