# Opto — optometry practice and clinical test simulator

A React + TypeScript + Vite simulator with two modes. **Practice** teaches individual binocular-vision procedures, then opens a first-person hands-and-instrument attempt. Hirschberg, Bruckner, motility, Krimsky and both cover lessons also have experimental Meta Quest/WebXR controller attempts in the shared clinic. **Test** provides a scripted patient encounter, acquired-findings notebook, diagnosis/management submission, and deterministic educational debrief; its existing consultation room now also has an experimental immersive-VR navigation and instrument-handling foundation. No API key, backend, or account is required.

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
- In Practice, read the procedure and enter the full-screen clinical view. Drag to aim the held instrument, use the wheel or slider to change working distance, and complete the patient, illumination, off-hand, and viewing-position setup before recording. Hirschberg, Bruckner, motility, Krimsky and both cover lessons additionally offer **Quest / WebXR**. For Hirschberg, grip the virtual penlight with either controller, hold the trigger for illumination, use physical pose for distance and aim, and record through an in-world panel.
- Practice groups modules by motor alignment, sensory status, latent deviation, vergence, and accommodation. Completion is tracked for the current in-memory session; the next-module action skips skills already practised and the final completion reports that the guided session is complete.
- Krimsky Practice includes standard (prism before deviating OS) and modified (before fixating OD) attempts. Inspect baseline reflexes, place the prism on the patient view, rotate its base, adjust power by drag, keyboard or slider until the reflexes match, then record the neutralising power.
- Enter consultation explicitly requests mouse capture. WASD/arrows move; mouse looks; E or a click interacts with the target within 2 m. Escape releases capture.
- In the Test consultation, choose **Enter VR** on a supported headset. Without a headset, the same control becomes **Preview VR**, exposing the in-world guidance and headset destination layout while retaining WASD, mouse, E, and click controls. Tracked grip pickup remains headset-only.
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

No AI-generated dialogue, speech recognition, full-library VR conversion, controller physics, hand tracking, institutional systems or secure exam delivery. The six shared-clinic Practice adapters and Test consultation-room foundation support tracked Quest controllers but have not yet been validated on physical hardware or as calibrated technique. Test interview, examination configuration, examination close-ups, notebook, and submission are still 2D interfaces; opening one ends the immersive session and preserves the existing deterministic workflow. Manual acuity responses can optionally be read aloud with the browser's local speech-synthesis voice. Static case/rubric/answer-key data are inspectable in the client. Session data live only in memory; reload clears them. Optional JSON export is initiated by the reviewer.

Visuals use original stylized procedural geometry; no third-party GLB models have been added. Performance has not been benchmarked on representative trainee hardware. DPR is capped at 1.5; there is one modest shadow map and no post-processing.

The stable desktop build is published at `https://opto-clinical-simulator.dhairya911.chatgpt.site`. Branch changes are not live until explicitly committed, pushed, and deployed.

## Experimental Quest / WebXR

For the Test consultation, first start the encounter and close the briefing. **Preview VR** on a computer retains the existing desktop controls; it does not simulate tracked hands or establish headset comfort. In a supported headset browser, choose **Enter VR**. Physical walking and the existing floor-ring teleport controls remain available.

Consultation instrument handling uses independent hands:

- Hold grip near a labeled instrument handle to pick it up. Either hand can hold a tool; an occupied hand cannot replace its instrument.
- Pickup is by hand proximity, not by pointing the ray. An empty controller shows the nearest tool and its handle distance; within pickup range it says **GRIP · [tool]** and the tool receives a green highlight. If a grip press is out of range, move closer, release, and press grip again. The VR trolley/refraction floor destinations are positioned closer to their equipment than the desktop camera destinations.
- Hold the penlight or motility target trigger to illuminate it. Its visible emitter supplies the beam and the existing procedure's working point.
- Press **A/X** on a controller to toggle panel mode while retaining its tool. Trigger then selects panel controls; tool actions are disabled until you return to tool mode and press trigger again.
- Grip an instrument with the empty receiving hand to transfer it. Release the old hand afterward; this does not drop the transferred instrument.
- Release near its labeled home socket to return it, or just above a clear part of the trolley/refraction desk to place it. Unsupported or obstructed placement returns it to its last resting location. Home sockets remain reserved.
- Explore Arun's existing case freely. Picking up a tool opens no examination selector, technique checklist, recording form, or gaze markers. The penlight's light response works immediately when its lit tip is aimed at an eye.
- Press **A/X** to request the patient menu. It offers **Look straight ahead**, **Look at this target**, **Follow this target**, and room lighting. After asking Arun to follow, hold the motility target's trigger and move it to see his eyes follow. Instructions apply independently of tool selection.
- **Record finding** is beside each held penlight, occluder, motility target, retinoscope, or ophthalmoscope. Point the other controller at it and press its trigger; no menu navigation is needed. The blank observation form appears in front of your headset and follows your view. Enter your observations and select **Save to notebook**. The A/X menu's **Record observation** remains an alternative. Incomplete observations cannot be saved, and cancel discards that procedure's unsaved observations.
- **Penlight:** first give straight-ahead fixation, dim the room, and inspect each eye steadily in the illustrative 20–80 cm zone with a brief light-off/away interval between eyes. Release the trigger before recording size/equality/direct/consensual observations. Cover and target observations retain their required observable sequences and structured fields; no step overlays appear during free exploration.
- **Retinoscope:** hold its trigger and aim the front optic at a pupil. The visible streak responds to controller movement, lens power, and actual tool-to-eye distance. Controls beside the tool adjust the trial lens in 0.25 D steps and switch the streak between 90° and 180°. For recording, ask Arun to look straight ahead, work around 67 cm, sweep left/right/left to observe with and against motion and neutrality in both streak orientations, return to the neutralising lens, and release the trigger. Record your gross neutralisation, working-distance correction, sphere, cylinder, and axis for the examined eye.
- **Ophthalmoscope:** hold its trigger, aim the front optic at one pupil, bring it close to the patient, and look through the rear aperture with the headset. The existing schematic posterior-pole view appears inside that aperture when aligned and moves with your aim. Inspect steadily, release the trigger, and use **Record finding** to enter disc, macula, posterior-pole, and view limitations for that eye. The undilated view does not assess the peripheral retina.
- **Exit VR** is in the patient-menu corner and is also available while recording. It returns to the browser view, preserving saved encounter data and discarding unfinished XR technique.
- **History**, **Notebook**, and **My assessment** open the existing case interfaces only when selected. These interfaces currently leave immersive VR; close them and re-enter VR to continue exploring the same session.

Physical exploration records no findings automatically and does not award examination credit. On-request in-headset recording and the existing desktop manual examinations both use the same case finding/event path and deterministic debrief. Learner observations remain distinct from expected case values. Experimental pupil, cover, and motility technique panels remain in the controller behind an internal `guided` option for future work; the production consultation leaves that option disabled. Ownership, transfer, supported placement, illumination, and interruption handling continue independently. Pupil response, physical occlusion, instructed target following, retinoscopy reflexes, and the schematic fundus view are supported in-room; holding the other registered instruments does not implement their full examinations. Illuminating tools use controller aim with grip position; scopes retain upright handles with forward-facing optics. The user has confirmed penlight pickup and response on Quest 3S; the new scope handling and recording layout still require device checking. These are draft interaction approximations, not validated optics or manual competency assessments.

Choose **Practice → Hirschberg test → Quest / WebXR → Enter VR** in Meta Quest Browser. Hirschberg now uses the same clinic interior, canonical instruments, controllers, grip/transfer/placement behavior, ray controls, and tracking recovery as consultation. Find the penlight on the trolley and hold either controller's side grip to carry it. Use the other controller to select **Look at the light** beside the tool, then hold the penlight's trigger, move it to about 50 cm, and centre your view. The distance readout follows the actual instrument working point. Existing Practice scenarios drive the patient's corneal reflexes; they are independent of Arun's consultation findings.

Select **Record finding** beside the penlight. A headset-following form offers individual interpretation and landmark buttons; nothing is preselected. Explicit submission gives feedback and marks local Practice progress only when correct. **New patient finding** changes the visible reflexes and clears technique/entries without leaving VR. Distance, aim, view, illumination, tracking, transfer, and parameter interruptions invalidate unfinished observations. **Help** is optional; gripping a tool never opens a checklist. A/X opens lesson controls with fixation, help, recording, reset, and Exit VR. Reset returns all instruments to their sockets; release placement uses the same supported-surface rules as consultation. Wrong instruments cannot satisfy Hirschberg.

**Preview clinic layout** permits desktop inspection and station navigation in this same room; it does not emulate tracked hands or award completion. **Desktop clinical view** keeps the existing mouse/keyboard trainers. Bruckner, motility, Krimsky, cover–uncover, and alternating cover also offer **Quest / WebXR**; the remaining 14 modules retain their desktop attempts and teaching. The earlier VR experiment remains in `HirschbergLegacyVRStage.tsx` for reference, outside the active/bundled path. HTTPS is required for immersive WebXR outside local development. See [the migration plan](docs/shared-vr-practice-migration.md) and [the VR architecture](docs/vr-practice-plan.md). Quest ergonomics and visual readability still need physical-device checking.

The next four lessons reuse that same clinic:

- **Bruckner:** grip the ophthalmoscope, ask fixation, select its large spot, and hold the trigger. Move its working end to about 1 m and bring your viewing eye close behind its rear aperture. Compare both reflexes and record equal, OD brighter, or OS brighter. The existing three Practice findings drive both pupil reflexes and the aperture view.
- **Motility:** grip the penlight, instruct following with the head still, and hold its trigger. Move through primary position and the eight gaze points at 30–40 cm, dwelling at each. **Show gaze guide** offers optional spatial markers. Ask about symptoms, then record your observation. This preserves the desktop trainer's policy of accepting an explicit observation after the sequence, with a recheck notice for a restricted/uncertain entry.
- **Cover–uncover:** grip the cover occluder, instruct fixation, cover OD, uncover, cover OS, and uncover while watching the appropriate visible eye. Physical cover/uncover starts the illustrative refixation motion immediately. Record the movement timing; new findings cycle through the existing patterns.
- **Alternating cover:** alternate OD/OS/OD/OS, observe the refixation direction, then grip the prism bar from the refraction desk. Its gold-ringed middle cell is the selected working cell; base/power are illustrative settings rather than a calibrated optical bar. Use **Prism settings**, choose base/power, hold that cell before either pupil, and **Repeat with prism** until no movement is seen. Use A/X on the occluder hand to operate settings/recording with both tools held; press A/X again to resume tool mode for the repeat. Submit movement and deviation explicitly, with neutralising power/base retained in feedback.

For either cover lesson, moving the near card from its home selects near setup automatically. Hold it centred at about 40 cm, or release it onto the labeled stand to free your second hand for the prism. Returning the card to its original home selects distance setup. Setup changes clear the earlier sequence; near and distance are independent attempts. The distance target represents distance fixation within the room and is not a calibrated 6 m lane. Brief hand transit is allowed during alternating cover; exposing both eyes for more than the illustrative 0.35 s allowance restarts dissociation. **Help**, reset, direct finding recording, new findings where available, and **Exit VR** are inside the headset. See [the batch plan](docs/vr-practice-batch-plan.md). These adapters remain drafts pending physical-device and clinical review.

Krimsky also uses the same clinic: **Practice → Krimsky → Quest / WebXR**. Pick the penlight, hold its trigger, instruct fixation, use one examiner eye and acknowledge **Confirm monocular view** (the headset cannot verify eye closure). At about 50 cm, keep the prism clear and select **Inspect baseline**. Pick the prism bar from the refraction desk. In **Prism / method settings**, standard requires its gold-ringed cell before deviating OS; modified requires it before fixating OD. Select BI/BO and adjust power with ±1Δ/±5Δ controls. Relative corneal reflexes respond to placement and power, including undercorrection, wrong-base divergence and overcorrection. This is the existing illustrative model, not calibrated prism optics.

Use A/X on the prism hand to select settings while keeping the penlight trigger held; press A/X again to return to tool mode. When the reflexes match, press the **prism-hand trigger** to capture that completed comparison. Capture earns no completion. You can then release illumination, put the tools down, and select **Record finding** beside a tool or in the A/X menu. Enter the power you read using blank ±1/±5/clear controls (or the browser mirror's labeled number input), then submit. Recording retains method, base, actual prism eye and illustrative working distance from the comparison. Before capture, invalid view/light/distance clears unfinished baseline/entry; changing method/base/power clears captured comparison. Cancel records nothing and requires a fresh comparison. **New patient finding** cycles the existing examples, retaining the selected method and clearing tools/technique/entries. Reset and Exit VR remain available. See [the Krimsky plan](docs/vr-krimsky-plan.md); device and clinical review remain pending.

## Binocular-vision Practice

The 20-module Practice set covers motor alignment, sensory status, latent deviation, vergence, and accommodation. It includes extraocular motilities; Bruckner, Hirschberg, Krimsky, cover–uncover, and alternating cover; Worth four dot, stereopsis, and the 4Δ base-out test; Maddox rod and Modified Thorington; near point of convergence, horizontal distance, vertical distance, horizontal near, and near vergence facility; plus push-up and minus-lens amplitude, NRA/PRA, and accommodative facility. Tools and findings remain illustrative educational drafts rather than calibrated optical simulations, and the clinical content has not been approved for certification. Maddox practice supports horizontal/vertical measurement at 6 m and 40 cm with prism neutralisation. Modified Thorington uses a numbered near card at 40 cm with direct magnitude/direction recording.

## Manual ocular motility

In Practice, choose **Extraocular motilities → Start guided attempt**. In Test, choose **Instrument trolley → Ocular motility → Pick up instrument & examine → Examine Arun**. Ask Arun to follow the target with his head still, switch on the visible penlight, then drag it in the enlarged eye view. Arrow keys provide fine positioning; Page Up / Page Down or the distance slider change the simulated working distance (30–40 cm). Follow the H-pattern guides and pause at primary position plus the eight cardinal directions. Guides can be hidden. Ask about double vision, pain, and discomfort, then select your observation before recording. Cancel discards unsaved progress.

The eyes track a shared target pose with separate per-eye gaze angles, convergence, eased pursuit, iris foreshortening, and coordinated blinking. The scene shows the examiner's instrument hand and free-hand cue, but it is still a desktop control proxy rather than a spatially calibrated VR instrument. Target coordinates and observation coverage live independently of input handling in `web/interaction/motility.ts`, so a future XR adapter can supply the same patient-relative pose. The shared clinic now provides an experimental controller adapter for this Practice procedure; abnormal motility cases and validated technique grading remain unimplemented. Learner observations are local reflection only; the Test notebook still stores the case's authored result.

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
