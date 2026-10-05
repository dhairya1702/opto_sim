# Shared VR clinic architecture and rollout

## Product decision

Consultation and Practice use one clinic interior and physical interaction runtime. Clinical behavior is supplied by separate case/lesson adapters, preserving the existing desktop procedures and the separation of Practice progress from Test evidence and scoring. See [the initial Hirschberg migration](shared-vr-practice-migration.md) and [the four-lesson batch plan](vr-practice-batch-plan.md), and [the Krimsky plan](vr-krimsky-plan.md).

## Current implementation

- `ConsultationInterior` is the canonical room/patient/furniture scene.
- `useXRClinicRuntime` owns controller input, two independent hands, nearest-handle pickup, transfer, supported placement/socket return, trigger power, pose updates, tracking/visibility interruption, ray selection, teleportation, and instrument reset.
- The existing canonical consultation tool registry/model remains shared, with one scene instance per instrument. Registry IDs are historical examination IDs; adapters map the penlight (`pupils`), target (`motility`), retinoscope (`objective`), and other tools to their lesson needs. Clinical rules do not belong in this registry.
- `XRClinicRuntimeView` supplies the same kit/controller/pad visuals. `XRClinicPanels` supplies tool-side controls and explicit headset-following editors with ray priority.
- `XRConsultationController` remains the authored-case adapter. Free exploration produces no evidence; explicit completed recording returns to App's prerequisite/reducer/event boundary.
- `PracticeVRClinic` owns a reusable lesson session/dialog lifecycle and renders the same interior. It requests only `immersive-vr` and `local-floor` tracking; session entry always follows a learner action.
- `HirschbergPracticeController` supplies the first migrated Practice lesson. Existing four scenarios drive the patient's reflexes rather than consultation findings. Existing distance/aim/view math gates observation/entry; direct interpretation/landmark buttons and explicit submission provide local feedback/completion. Help is optional.
- `PracticeBatchVRStage` and `PracticeLessonUI` provide Bruckner, motility, cover–uncover and alternating cover adapters, sharing the same session/controls/mirror. `xrPracticeBatch` holds pure geometry and interruption rules. Bruckner/cover scenario content is shared with desktop; Test scoring remains separate.
- The canonical kit includes a prism bar; optional tool-specific placement sockets let Practice mount the near card at about 40 cm. Cover observation remains paused in panel mode, while completed entry can use tracked held instruments in panel mode.
- `KrimskyPracticeController` reuses the shared penlight/prism and existing Krimsky method/residual logic. Explicit comparison capture permits two-hand recording after putting tools down; independent numeric fields extend the shared lesson panel/mirror. Monocular viewing is acknowledged, not detected.
- Desktop Practice teaching and all 20 modules remain available. The remaining 14 modules have not yet migrated into this shared VR clinic. Layout preview permits desktop inspection but does not emulate tracked hands or grant completion.

The earlier separate Hirschberg VR experiment, its kit models, controller preview, and seated/standing setup controls remain in `HirschbergLegacyVRStage.tsx` and related files for reference. They are outside the active import path and do not create a second bundled controller runtime.

## Controller contract

| Input | Shared behavior |
| --- | --- |
| Side grip near a handle | Pick up and hold a canonical instrument with either hand |
| Other hand grips a carried handle | Transfer ownership atomically |
| Release grip | Place on a clear supported surface/socket; otherwise return to last valid rest |
| Trigger in tool mode | Illuminate supported lights/scopes while held |
| Empty controller ray + trigger | Select a visible panel control or floor destination |
| A/X | Toggle that controller's panel mode and request case/lesson controls |
| Controller translation/rotation | Supply working-point position and aim; illuminating tools use aim orientation at grip position |
| Headset pose | Supply examiner viewpoint and headset editor placement |
| Reset | Recall instruments without synthesizing fresh button presses |

Pickup is within 12 cm of the handle; socket return is within 10 cm. These are interaction tolerances. A mode switch, transfer, or tracking interruption cancels pending trigger input; the learner must release/repress. Correct input behavior is shared across modes, while the case or lesson owns the instructions, patient response, recording requirements, and feedback.

## Hirschberg interaction

1. Open Practice → Hirschberg → Quest / WebXR → Enter VR.
2. Identify and grip the penlight on the consultation trolley.
3. Select Look at the light beside the held tool or through A/X lesson controls.
4. Hold the tool trigger, move it to about 50 cm, aim at the eyes, and centre the examiner view.
5. Select Record finding with the other controller. Choose an interpretation and landmark; submit explicitly.
6. Review feedback. New patient finding resets the procedure and changes the visible reflexes without ending VR. Reset recalls equipment; Exit VR closes the lesson. Saved Practice progress stays in the library session.

The illustrative working zone remains 46–54 cm, with existing 8° aim/view tolerances. Immediate reflex clarity changes with setup; broader illumination can reveal a reflex without enabling recording. Invalid technique clears unfinished entry. Successful feedback persists until retry/reset/new finding. Wrong tools, cancelled/incomplete attempts, layout preview, and exit award no completion. Correct submission is idempotent for each attempt and never dispatches a Test finding.

## Rendering and comfort

- Keep physical tool/controller/visual updates in refs per frame. Readouts update at a limited cadence.
- Reuse original procedural geometry; no new assets, heavy models, post-processing, or external services are needed for this migration.
- Keep existing DPR limits and WebGL failure paths. Desktop clinical attempts remain the keyboard/pointer alternative.
- Teleportation crosses the room; final hand/head positioning uses tracked movement. No smooth locomotion, automatic pointer lock, or forced camera animation is introduced.
- Explicitly requested editors follow the headset. Editors and tool-side controls render above room geometry and receive ray priority. Tool controls follow the hand with a lateral offset to keep equipment visible.
- Cleanup removes input/session listeners and illumination. Late controller input after exit cannot perform an action.
- No hand/body tracking, room mesh, camera, microphone, passthrough, multiplayer, or backend service is requested.

## Validation

Focused mounted tests use the real R3F geometry/runtime/adapters and simulated controller/session/frame inputs. They cover shared consultation regressions and Hirschberg pickup/orientation, wrong tools, physical distance, scenario reflex changes, explicit feedback/recording, duplicate completion, no Test evidence, invalidation, cancel, and late input. Additional mounted checks cover broad-spot/aperture Bruckner, nine motility dwells/symptoms, authored cover timing, the near-card stand, all four prism endpoints, actual prism alignment and interruptions, and recording with both hands occupied. Krimsky checks cover both methods/endpoints, signed reflex changes, baseline order, capture/release/independent numeric entry, invalidation/cancel/exit and no Test evidence. Pure tests cover technique, landmarks, placement and alternating-cover transit. Build and whitespace checks accompany the change. User instructions exclude Playwright and the full suite for this work.

Physical Quest 3S checks remain necessary before claiming device validation: reach/height comfort, both-hand use, readable text and small corneal landmarks, live new-finding changes, reset/exit recovery, guardian interruptions, and sustained headset frame timing. The user confirmed earlier consultation penlight handling/response; that does not validate the new Practice lesson.

## Remaining adapters

1. Sensory/phoria: extend shared equipment with filters, booklets, Maddox/Thorington targets; preserve existing patient-report and recording content.
2. Vergence/accommodation: connect physical target distance, prism/lens/flipper actions, timing, and existing response/recording rules.
3. Hand tracking remains a later input alternative once controller ergonomics are established.

Each module adds equipment and a lesson adapter, never another room/controller implementation. Clinical content and tolerances remain educational drafts pending qualified review; tracked consumer-device coordinates and illustrative optics do not certify clinical competence.
