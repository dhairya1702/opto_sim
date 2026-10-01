# Opto — optometry practice and clinical test simulator

A React + TypeScript + Vite simulator with two modes. **Practice** teaches individual binocular-vision procedures, then opens a first-person hands-and-instrument attempt. **Test** provides a scripted patient encounter, acquired-findings notebook, diagnosis/management submission, and deterministic educational debrief. No API key, backend, or account is required.

The existing `main.py` and Python environment in `src/` are preserved. Web source lives in `web/` to avoid mixing it with that environment.

## Run

Requires a current Node.js release supported by Vite (Node 22.12+ recommended).

```sh
npm ci
npm run dev
```

Open the Local URL printed by Vite (normally http://127.0.0.1:5173).

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

`npm run preview` serves the production build. The app is fully scripted with no network requests needed once its static assets load. It is not an installable/offline-cached PWA. A local static server is needed; opening `index.html` from the filesystem is not supported.

## Controls and workflow

- Choose **Practice** for guided skills or **Test** for the full patient encounter. Practice progress does not affect Test scoring.
- In Practice, read the procedure and enter the full-screen clinical view. Drag to aim the held instrument, use the wheel or slider to change working distance, and complete the patient, illumination, off-hand, and viewing-position setup before a finding becomes visible. All hands-on examination stages use the full viewport on desktop and mobile.
- Practice groups modules by motor alignment, sensory status, latent deviation, vergence, and accommodation. Completion is tracked for the current in-memory session; the next-module action skips skills already practised and the final completion reports that the guided session is complete.
- Krimsky Practice includes standard (prism before deviating OS) and modified (before fixating OD) attempts. Inspect baseline reflexes, place the prism on the patient view, rotate its base, adjust power by drag, keyboard or slider until the reflexes match, then record the neutralising power.
- Enter consultation explicitly requests mouse capture. WASD/arrows move; mouse looks; E or a click interacts with the target within 2 m. Escape releases capture.
- Every panel releases capture and suspends movement. Return to room is an explicit request to resume; closing with X/Escape never captures automatically.
- Station mode uses drag-to-look, click interaction and a keyboard-accessible list. Narrow screens or pointer-lock failure use station mode. WebGL failure retains the full encounter through the same station list.
- Interview Arun; choose examination → eye/configuration → Perform examination. Findings appear in the notebook only after performance. OD = right eye, OS = left eye, OU = both eyes.
- Instruments on the trolley can also be targeted and picked up directly in the room. The near-vision card is the white card marked **NEAR VISION / 40 cm** on the trolley's top shelf.
- Complete encounter opens diagnosis, evidence, management and explanation submission. Submission freezes the attempt; debrief includes criterion/event evidence, missed areas and exportable JSON for review. New attempt clears everything.

## Architecture

- `web/domain`: pure TypeScript schema, reducer, exam gating, result keys and deterministic assessment.
- `web/cases`: authoritative fictional case, configurable prerequisites and versioned rubric.
- `web/patient`: scripted provider interface, matching, clarification and uncertainty.
- `web/scene`: original procedural room, patient and instrument geometry.
- `web/interaction`: semantic input adapter, raycasting, collisions and station destinations.
- `web/ui`: native keyboard-trapped dialogs, interview, findings, submission and debrief.
- `web/tests`: unit and browser tests.
- `docs/clinical-review.md`: clinical packet, draft choices and unresolved review checklist.
- `docs/asset-manifest.md`: visual provenance and licenses.

## Scope and limitations

Case and rubric: `adult_distance_blur_01` / `0.1-draft`, requires clinician review. Fictional numbers are authored data, not validated patient data. No pass mark or clinical certification. This teaches reasoning/examination selection and includes manual motility, acuity, pupil, cover-test and retinoscopy interactions; it does not validate instrument technique or teach vision therapy.

History matching is deterministic and domain-based. Unsupported details stay unknown. Free-text reasoning and patient explanation are unscored, preserved for human review. Suggested questions are learning aids. Repeated facts/results cannot increase scores.

Minimal draft prerequisites: baseline of the same eye before pinhole; objective estimate of the same eye before subjective refinement. All other tests can be done in any order. The limited undilated fundus view cannot establish normal peripheral retina. Exact follow-up and referral policy await local clinical approval.

No AI-generated dialogue, speech recognition, VR/headset support, physics-based instrument handling, institutional systems or secure exam delivery. Manual acuity responses can optionally be read aloud with the browser's local speech-synthesis voice. Static case/rubric/answer-key data are inspectable in the client. Session data live only in memory; reload clears them. Optional JSON export is initiated by the reviewer.

Visuals use original stylized procedural geometry; no third-party GLB models have been added. Performance has not been benchmarked on representative trainee hardware. DPR is capped at 1.5; there is one modest shadow map and no post-processing.

Nothing has been published or deployed. Deployment remains subject to the user's repository/hosting instructions.

## Binocular-vision Practice

The 20-module Practice set covers motor alignment, sensory status, latent deviation, vergence, and accommodation. It includes extraocular motilities; Bruckner, Hirschberg, Krimsky, cover–uncover, and alternating cover; Worth four dot, stereopsis, and the 4Δ base-out test; Maddox rod and Modified Thorington; near point of convergence, horizontal distance, vertical distance, horizontal near, and near vergence facility; plus push-up and minus-lens amplitude, NRA/PRA, and accommodative facility. Tools and findings remain illustrative educational drafts rather than calibrated optical simulations, and the clinical content has not been approved for certification. Maddox practice supports horizontal/vertical measurement at 6 m and 40 cm with prism neutralisation. Modified Thorington uses a numbered near card at 40 cm with direct magnitude/direction recording.

## Manual ocular motility

In Practice, choose **Extraocular motilities → Start guided attempt**. In Test, choose **Instrument trolley → Ocular motility → Pick up instrument & examine → Examine Arun**. Ask Arun to follow the target with his head still, switch on the visible penlight, then drag it in the enlarged eye view. Arrow keys provide fine positioning; Page Up / Page Down or the distance slider change the simulated working distance (30–40 cm). Follow the H-pattern guides and pause at primary position plus the eight cardinal directions. Guides can be hidden. Ask about double vision, pain, and discomfort, then select your observation before recording. Cancel discards unsaved progress.

The eyes track a shared target pose with separate per-eye gaze angles, convergence, eased pursuit, iris foreshortening, and coordinated blinking. The scene shows the examiner's instrument hand and free-hand cue, but it is still a desktop control proxy rather than a spatially calibrated VR instrument. Target coordinates and observation coverage live independently of input handling in `web/interaction/motility.ts`, so a future XR adapter can supply the same patient-relative pose. XR controllers, headset support, abnormal motility cases, and validated technique grading are not implemented. Learner observations are local reflection only; the Test notebook still stores the case's authored result.

Distance, pinhole, and near acuity also use manual examination views. The learner asks Arun to read, drags the solid occluder over the fellow eye or aligns the pinhole with the tested eye, and holds the tool steadily before the authored response can be recorded. Near acuity additionally requires the card to be set to 40 cm. These interactions practice sequencing and positioning; they do not generate acuity from optical simulation or validate clinical technique.

The manual acuity view includes a large reference chart beside the patient: labeled 6/60–6/5 rows for distance and N10/N8/N6/N5 reading samples for near. It moves below the patient view on narrow screens. Arun reads the lines in sequence, hesitates at the scripted limit, and can speak through the browser's local text-to-speech voice. The learner selects the smallest line read correctly from a notation dropdown. That entry is preserved in the notebook and compared with the fictional endpoint only in the debrief; the chart does not reveal the answer in advance.

## Manual pupil examination

Choose **Instrument trolley → Pupil assessment → Pick up instrument & examine → Examine Arun**. The general procedure requires a distant-fixation instruction, room dimming, manual placement of the lit pen torch over each pupil, and moving the beam away between eyes. Both pupils show a linked direct/consensual response. A visible millimetre gauge supports size estimation; the learner then records OD/OS size, equality, direct responses and consensual responses with structured controls. The swinging-light procedure requires the complete OD → OS → OD → OS sequence before the learner records their RAPD interpretation. The torch must be switched off before either finding can be saved.

The near-response procedure uses the fixation target from the pupil kit. The learner establishes centred distance fixation, moves the target to 40 cm and then 20 cm, watches convergence and equal pupillary constriction, and returns it beyond 60 cm to observe recovery. Convergence, constriction, fixation maintenance and the final interpretation are entered separately. Off-centre targets and skipped distance stages do not advance the procedure.

The pupil radius responds continuously to authored ambient and light-stimulus values, with eased movement in the eye shader. Tool targeting and response logic live in `web/interaction/pupils.ts`, independently of mouse handling, so XR controllers can later supply the same patient-relative pose. The current fictional case models equal normal responses and does not reproduce disease physiology, retinal adaptation, accommodation, absolute calibration, or validated clinical technique. Learner selections are stored unchanged and compared with the hidden authored finding during debrief.

## Manual cover test

Choose **Instrument trolley → Cover test → Pick up instrument & examine → Examine Arun**. Ask Arun to fixate at distance or near, then drag the solid occluder through the guided cover–uncover sequence for each eye and the OD → OS → OD → OS alternating sequence. Each position needs a steady hold, and the occluder must be fully removed at the specified uncover steps. Near testing requires the fixation target at 40 cm. The eyes maintain the authored normal alignment in this case, while the learner watches for refixation and records OD, OS, alternating-cover, and overall interpretations with structured controls.

Occluder targeting and ordered dwell logic live in `web/interaction/cover.ts`, separately from mouse input, so an XR adapter can supply the same patient-relative tool pose. The current case provides a qualitative normal response; it does not quantify a deviation, simulate prism neutralisation, or replace supervised cover-test training.

## Manual retinoscopy

Choose **Instrument trolley → Objective refraction → Pick up instrument & examine → Examine Arun**. Ask Arun to fixate in the distance, set a 67 cm working distance, switch on and align the retinoscope with the selected pupil, then sweep the streak left and right. Use the trial-lens controls to bracket with motion, neutral and against motion. Neutralisation must be confirmed with the streak at both 90° and 180°. Return to the neutralising lens, switch off the instrument, record gross neutralisation, apply the −1.50 D working-distance correction, and enter sphere, cylinder and axis.

The fictional spherical reflex changes direction, speed, brightness and width according to lens power and working distance. Tool alignment and optical-response calculations live in `web/interaction/retinoscopy.ts` independently of mouse input. The model teaches the procedure and arithmetic for this case; it does not simulate complex refractive media, accommodation, scissoring, irregular astigmatism, cycloplegia, or validated real-world technique.
