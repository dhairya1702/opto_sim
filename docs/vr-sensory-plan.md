# Next batch: sensory Practice in the shared VR clinic

Status: implemented on `vr-improvements` over baseline `47aa8ad`, with focused pure and mounted simulated-controller checks. Worth four dot, stereopsis and 4Δ base-out now use the shared clinic. Physical Quest 3S validation and clinician review remain pending. Servers remain off until requested. No deployment, new Test case, challenge-mode work, or hand tracking is included.

## Outcome and boundaries

The learner stays in the existing consultation clinic, identifies equipment in a clearly arranged kit, picks it up with either controller, fits viewing equipment to the patient, moves targets, requests fictional patient responses, and records their own findings. Practice supplies teaching and feedback over this foundation. Consultation retains free exploration and its existing authored case.

Reuse `ConsultationInterior`, `useXRClinicRuntime`, `XRClinicRuntimeView`, `PracticeVRClinic`, `PracticeLessonUI`, canonical instrument models, controller input, placement, panels, teleportation and exit. Add equipment definitions and lesson adapters, never a second room or controller loop. Existing desktop trainers and WebGL-failure paths remain available. Local Practice completion must never dispatch a Test examination or change Test evidence/scoring.

All clinical content and optical approximations remain draft. The learner examines a fictional patient's scripted responses, not their own stereo vision through the Quest. No eye tracking, calibrated stereoscopic stimulus, validated colour cancellation, clinical measurement, or device validation is claimed.

## Existing sources to preserve

| Module | Authoritative implementation/content | Existing behavior |
| --- | --- | --- |
| Worth | `interaction/worth.ts`, `interaction/sensory.ts`, `practice/WorthPracticeStage.tsx` | Red OD/green OS, correction, separate filter checks, illuminated target, patient report, dot count and interpretation, near 40 cm plus distance 600 cm records. Eight scenarios; only `central-os` changes with distance. |
| Stereopsis | `interaction/stereoPractice.ts`, `practice/StereopsisPracticeStage.tsx` | Polarised circle booklet, near correction, 38–42 cm readiness; 800, 400, 200, 100, 60, 40 arcsec sequence; one patient report and confirmed circle per page; stop after two consecutive incorrect responses; independent last-correct threshold entry. |
| 4Δ BO | `interaction/fourPrism.ts`, `interaction/sensory.ts`, `practice/FourPrismPracticeStage.tsx` | Best distance correction and isolated-letter fixation; exactly 4Δ BO; OD first, then OS; 2400 ms observation per placement; normal or OS-suppression scenario; explicit interpretation. |

Preserve authored reports, target indexes, thresholds, gaze directions, observation timing and interpretation mappings. Do not invent new thresholds, diagnoses, stopping rules, patient acuities or additional cases. The Worth `central-os` transition at 200 cm is a fictional authored behavior, not a suppression cutoff. Do not disclose scenario names or answer keys in pre-observation UI.

## Shared equipment and placement work

1. Extend the canonical registry/model path with a Worth target, red–green glasses, polarised glasses and circle booklet. Reuse the trial frame for correction and the prism bar for 4Δ BO. Each has a measured metre-scale grip, working point, facing vector, supported rest, footprint and readable label. Keep original consultation homes unchanged.
2. Add an optional lesson equipment selection to the shared runtime/view; the default remains the existing consultation kit. Additional sensory equipment appears only in lessons that need it. Apply selection consistently to initialization, pickup candidates, models, sockets, reset and ray routing. Extend typed tool IDs without casting a new tool into an examination ID. New tools never acquire Test selection metadata.
3. Place sensory equipment on one modest procedural side tray/cabinet in the same room, clear of current tools and approach rings. Document actual homes after checking geometry. Test home reservations, rotated footprints, nearest-handle highlighting and fallbacks; no stacked instruments or hidden grips. Record original geometry in the asset manifest.
4. Add patient fitting sockets and a visible near-booklet stand through the existing placement extension. Fitting occurs when the learner releases a valid frame near the patient's face, with position/orientation checks, then the frame visibly seats. Wrong equipment, backwards facing or remote release must not count as fitted. Socket pose/scale must align lens centres with the canonical OD/OS eye coordinates, not the older desktop scene.
5. Correction and viewing filters need separate compatible layers. A trial frame can coexist with either red–green or polarised glasses without overlapping lenses/handles. Red stays over OD (examiner-left), green over OS. Fitted glasses can be gripped and removed; transfers remain atomic. Placement is assisted, not collision physics.
6. Add a read-only working-pose accessor for supported resting/fitted tools, alongside the existing held-pose accessor. A docked card must supply its actual working-point transform; do not assume a home position or borrow Practice legacy coordinates. Controller tracking gates held samples; a placed target does not depend on the releasing hand remaining tracked.
7. Keep existing penlight/scope trigger behavior. A Worth target needs explicit persistent on/off power so it can remain illuminated on its distance dock. Make that an equipment capability with existing momentary tools as the default; releasing a grip or pressing A/X must not accidentally toggle it. Reset/exit extinguish it. Show on/off state on the target and in its controls.

## Physical distance and the room constraint

The current room is approximately 4.1 × 5.1 m; the patient's eyes are at `[0, 1.5, -0.573]`. It cannot support a straight 6 m target path. Do not silently replace the authored 6 m condition with the existing nearby wall chart.

Use one shared, lesson-enabled mirrored distance station inside the room. The Worth target has a near position and a distance dock close to the patient, facing a mirror on the opposite wall. Solve the dock/mirror positions to give a 6 m virtual optical path. Compute path length using the reflected target position and patient eye midpoint, plus a valid ray intersection inside the mirror bounds; a plain sum of arbitrary distances is insufficient. Keep the target out of the patient's direct line of sight and the examiner's view. Check the dock, mirror, furnishings and teleport reach together before adding either sensory adapter.

The distance dock represents the existing 600 cm condition. Use a lightweight illustrative mirror display with the computed virtual target location/size, rather than a general room reflection pass. Label it as a simulated mirrored 6 m path; the mirror is an educational spatial adapter, not calibrated optics. Its representation must have no pickup handle or ownership of its own: there is still one physical Worth target. Releasing the target outside the correct dock never grants distance credit. Mirror alignment and path computation belong in pure interaction code and focused tests.

For near work, movement of the real target/booklet working point relative to the patient changes the displayed distance and apparent size immediately. Provide a hands-free stand at the nominal 40 cm condition. Stereopsis retains its existing 38–42 cm range. Worth uses a small documented placement tolerance around its taught 40 cm point; treat this as handling tolerance, never a new clinical cutoff. Store both the nominal condition and actual sampled distance in local observations. Intermediate Worth positions may show the existing authored report, but completion still requires the two original endpoint conditions.

No near/distance picker substitutes for movement. Picking up, positioning and docking the instrument determines the condition. Teleportation reaches stations; tracked movement supplies final hand placement. No real 6 m room walk, smooth locomotion or automatic camera movement is required. The same distance station may present the existing illustrative isolated letter for 4Δ fixation; do not assign an invented acuity to it.

## Worth four dot adapter

1. Add `xrWorthPractice.ts` for patient-relative target distance/facing, fitted equipment readiness, filter-check order, report capture, endpoint records and explicit submission. Reuse `worthAtDistance`, `worthDots`, `worthReports`, `interpretWorth` and `worthCases`.
2. Learner fits correction and red–green glasses, picks up the Worth target and turns it on. Verify the red and green filters separately using a direct filter-check control beside the instrument/fitted equipment. Explain the cancellation with an illustrative isolated-filter view; require explicit confirmation for each, then return to binocular viewing. No renderer claims to measure real headset colour cancellation.
3. Holding the target near the patient or placing it at the mirrored distance station visibly changes target position/size and measured condition. Ask count, colours and positions through the tool-side control or A/X panel only when setup is valid. Show the authored patient report and clearly labeled reported-view diagram; do not make the physical four-dot target reveal the scenario by changing its dots.
4. Capture an immutable observation of the actual condition, equipment revision and elicited report. Allow the learner to put the target down and independently choose dot count and interpretation. No answer defaults/autofill. Capture is evidence for entry, not completion.
5. Explicit correct submission saves that endpoint once; both near and distance records complete the attempt once. Moving the target after a report requires a fresh report for the new condition. Changing glasses, correction, filter verification or scenario invalidates incompatible captures. Completed endpoint records survive the intended near-to-distance transition, but changing the setup/scenario starts a new comparison.
6. New patient pattern cycles the existing eight scenarios, visibly changes reports only after valid questioning, and clears both records. Reset recalls tools and clears checks, pending response, entries and completion guard. Cancel entry records nothing and discards only the unrecorded capture.

## Stereopsis adapter

1. Add `xrStereoPractice.ts` and a booklet controller over the existing sequence functions. Fit near correction and polarised glasses for this circle-booklet lesson; do not substitute the Worth filters simply because both are viewing glasses.
2. Pick up the booklet, face its pages toward the patient and move it into the existing 38–42 cm range, or release it onto the visible near stand. Page turns change actual page geometry/text. Render three ray-selectable circles and the current level label; target identity/last-correct threshold are not shown before the response.
3. Present/ask through a direct booklet control; only one response can be pending. Preserve the existing 1000 ms scripted delay. Bind callbacks to attempt/page generation so interruption, reset or exit cannot append a stale reply.
4. The patient names left/middle/right. The learner points at that circle in the booklet or uses matching accessible panel buttons. Confirm the patient's named circle even when the fictional patient is wrong; distinguish the patient's error from an incorrectly entered response. A confirmed response is required before the next page.
5. Stop after the existing two consecutive patient errors; preserve coarse-to-fine order. Capture the completed run, put the booklet down if desired, and independently select the last-correct threshold. Do not preselect 100 arcsec. Only explicit correct submission completes the lesson.
6. Hand tremor inside the valid zone does not restart a run. Leaving the valid range, reversing the booklet or losing required fitted equipment invalidates the unfinished run, consistent with desktop distance-reset behavior. A/X recording and tool release after completed-run capture must remain usable. Cancel entry clears the completed capture and requires a new run; reset clears all pages/replies and recalls tools.
7. Any raised-circle illustration is labeled as the fictional patient's reported percept. It does not present or calibrate the learner's real stereoscopic threshold through Quest lenses.

## 4Δ base-out adapter

1. Add `xrFourPrismPractice.ts` using canonical patient-relative prism placement, existing `prismObservationMs`, `fourPrismGaze` and `fourPrismResponse`. Do not reuse desktop `prismEyeAt` screen coordinates as world coordinates. Reuse existing XR prism position/tilt checks and the gold-ringed working cell.
2. Fit correction; explicitly establish the existing isolated-letter distance fixation. Pick up the prism bar, choose BO and exactly 4Δ through its controls, then position its working cell before OD. Settings begin unselected/zero; naming the lesson does not make correct technique automatic.
3. Preserve OD-first ordering. Start the 2400 ms observation only with valid power/base, placement, fixation and examiner view. Animate the actual patient eye groups using the existing version/refixation timeline. Convert illustrative desktop offsets to patient-scale gaze through shared eye-motion helpers; do not invent a new prism physiology model.
4. Moving out of alignment before the dwell finishes resets that placement's unfinished observation. After OD is observed, withdraw the prism clear of both eyes before OS; keep the completed OD observation while moving across. No double counting from small jitter or repeated frames. OS-first, wrong power/base, backwards prism or obscured observer view earns no observation.
5. When both placements have completed, capture the ordered comparison. Release the prism and independently record normal response or suppression response through the direct observation panel. Correct explicit submission completes once. Putting the prism down or opening A/X after completed capture does not erase it.
6. Power/base, correction, fixation or scenario changes clear the comparison; generic interruptions clear unfinished dwell. Cancellation clears the unrecorded comparison. New finding alternates the existing normal/OS-suppression scenarios without labeling the hidden answer. Reset/exit restore eye motion and clear pending sequence/input.

## Recording, interruption and panel design

- Keep tool-side actions direct: target power/check/ask for Worth, present/page response for the booklet, base/power for the prism. A/X exposes the same actions, help, reset and Exit VR. Do not insert examination-choice navigation when a learner picks up a tool.
- Extend `PracticeLessonUI` only where necessary for per-page response controls and two-endpoint history. Split report, response-entry and final-record panels rather than packing all actions onto a fixed-height panel. Compute panel bounds from content; controls must not overlap or disappear behind the instrument, patient or each other. Preserve ray priority and fitted text.
- Completed capture snapshots are read-only and contain attempt/generation, setup revision, condition and observations. An editor validates that snapshot rather than requiring two held tools throughout form entry. Submitted values stay distinct from authored expected values. Recording buttons remain blank/disabled until the required sequence and learner entries exist.
- Before capture: invalid geometry, lost held-tool tracking, hidden session, transfer/menu interruption or parameter changes cancel pending dwell/report and clear incomplete entry. After capture: ordinary movement/release/panel use preserves evidence for recording; explicit clinical setup changes, reset, new finding, cancel or exit clear it as specified above. No fresh trigger/grip action is synthesized on recovery.
- Duplicate question/page/record actions are guarded synchronously. Completion is idempotent within an attempt. Cancelling records nothing. Late timer/controller input after exit is ignored. Unmount restores patient eyes, lighting, placements and listener/timer state.
- Keep the labeled HTML mirror and existing desktop trainer as keyboard alternatives. Preview shows equipment/layout only and cannot obtain observations or grant completion. Keep session memory-only; do not add storage or network calls.

## Implementation order and checkpoints

1. **Equipment foundation:** optional lesson kit, original models/homes, power capability, patient fitting sockets, placed working poses, near stand and mirrored distance station. Focused ownership, placement and geometry checks; verify consultation defaults and six existing Practice adapters still mount unchanged.
2. **Worth vertical slice:** pure readiness/report/record logic, patient report illustration, two endpoint captures, adapter routing and lesson entry. Finish the complete pickup → fitting → checks → near/distance → independent recording path before starting stereopsis.
3. **Stereopsis vertical slice:** physical booklet/pages, response timer/confirmation, run capture and threshold recording. Reuse the equipment foundation and panel controls from Worth.
4. **4Δ vertical slice:** ordered physical placement and actual eye motion, bilateral capture and interpretation. Reuse the current prism, correction fitting and distance station.
5. **Documentation and handoff:** update README learner flow, interaction controls, asset provenance, Practice source/review decisions, clinical review assumptions, architecture and AGENTS map/count. Nine of 20 modules will then be migrated; the remaining 11 stay on the roadmap. Keep phoria, vergence and accommodation outside this batch.

At each checkpoint run nearest affected unit/mounted tests first. At the final checkpoint run one focused selection covering the new adapters and shared consultation/Practice runtime, then `npm run build` and `git diff --check`. No Playwright or full suite for this work, per the user's request. Commit/push/deploy remain separate actions requiring a user request.

## Required focused coverage and acceptance

| Area | Required checks |
| --- | --- |
| Foundation | Both-hand pickup/transfer, visible handle alignment, nonoverlapping homes, incompatible sockets, glasses fitting/removal, OD/OS filter mapping, placed pose vs held pose, persistent target power vs existing momentary lights, inactive tools absent from Test, mirrored intersection/path and endpoint identity. |
| Worth | All eight authored scenarios, both filter checks, report blocked before valid setup, near/distance records, intermediate distance earns no endpoint credit, target power/facing changes, capture release-to-record, wrong/blank entries, scenario change, cancel/repeat/reset/exit. |
| Stereo | Actual 38/42 cm boundaries and facing, one pending response, named-circle confirmation, no premature page advance, six authored responses, two-error stop and last-correct entry, interrupted timers, jitter vs out-of-range movement, release-to-record and cancellation. |
| 4Δ | OD-first order, exact 4Δ BO, wrong eye/pose/tilt/settings, complete vs interrupted 2400 ms dwell, withdrawal before OS, normal and suppression gaze timelines, bilateral capture, released-tool recording and setup invalidation. |
| Integration | No Test events/results/completion effects, single award per attempt, reset/exit recovery, late input ignored, desktop launch still works, fallback/preview cannot complete, dynamic panel bounds and ray selection. |

Implementation is ready for handoff when each lesson has an end-to-end mounted two-controller walkthrough using the real shared runtime, the focused checks/build pass, documentation matches behavior, and no existing consultation interaction has been replaced.

Physical Quest 3S validation remains a separate necessary check: seated/standing reach, comfortable fitting and near distances, readable dots/circles/text, both hands and transfers, hands-free recording, distance station visibility, tracking/guardian interruptions, exit recovery and sustained frame timing. Software tests cannot establish those results. Qualified clinician review must assess the mirrored-station representation, fitting approximations, response diagrams and procedure fidelity before release; status remains draft.

## Implementation handoff

Implemented files: `xrSensoryEquipment.ts`, `xrWorthPractice.ts`, `xrStereoPractice.ts`, `xrFourPrismPractice.ts`, the three matching Practice controller adapters, and `SensoryClinicEquipment.tsx`. The existing runtime supports optional equipment, tagged fitted/placed sockets, persistent power, read-only supported working poses and explicit interruption reasons. Existing desktop routes remain available. Nine of 20 modules now have shared-clinic XR entries; phoria, vergence and accommodation remain outside this batch. No Test case/source/rubric, deployment, server, storage or network changes were made.

Focused acceptance includes reflected-image/intersection/endpoint geometry, default consultation isolation, fitted layering/removal and persistent power; all authored Worth scenarios and near/distance capture/entry; stereo page token/confirmation/stop/threshold logic; ordered prism dwell/withdrawal/timelines; mounted real-runtime controller flows, released-tool recording, cancellation/reset/exit and no Test effects. Build retains the existing large Three.js chunk warning. No Playwright or full unit suite is included, per the requested verification scope. Device and clinical acceptance are still pending and cannot be inferred from software checks.

Final verification: 118 focused tests passed across 17 files, including new sensory pure/mounted checks, shared equipment and panel geometry, existing Practice adapters and consultation regressions. `npm run build` and `git diff --check` passed; Vite retains its existing Three.js chunk-size warning. No full suite or Playwright was run. Changes remain uncommitted; no push or deployment was requested.


Subsequent batch: the remaining 11 phoria, vergence and accommodation modules are now implemented, completing all 20 shared-clinic XR entries. See [full-library completion](vr-library-completion.md) for the current overall status and outstanding physical/clinical acceptance. The nine-module counts above describe this sensory batch's checkpoint.
