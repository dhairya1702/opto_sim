# Shared VR clinic architecture and rollout

## Product decision

Consultation and Practice use one clinic interior and physical interaction runtime. Clinical behavior is supplied by separate case/lesson adapters, preserving the existing desktop procedures and the separation of Practice progress from Test evidence and scoring. See [the initial Hirschberg migration](shared-vr-practice-migration.md), [the four-lesson batch plan](vr-practice-batch-plan.md), [the Krimsky plan](vr-krimsky-plan.md), and [the sensory batch](vr-sensory-plan.md).

## Current implementation

- `ConsultationInterior` is the canonical room/patient/furniture scene.
- `useXRClinicRuntime` owns controller input, two independent hands, nearest-handle pickup, transfer, supported placement/socket return, trigger power, pose updates, tracking/visibility interruption, ray selection, teleportation, and instrument reset.
- The existing canonical consultation tool registry/model remains shared, with one scene instance per instrument. Registry IDs are historical examination IDs; adapters map the penlight (`pupils`), target (`motility`), retinoscope (`objective`), and other tools to their lesson needs. Clinical rules do not belong in this registry.
- `XRClinicRuntimeView` supplies the same kit/controller/pad visuals. `XRClinicPanels` supplies tool-side controls and explicit headset-following editors with ray priority.
- `XRConsultationController` remains the authored-case adapter. Free exploration produces no evidence; explicit completed recording returns to App's prerequisite/reducer/event boundary.
- `PracticeVRClinic` owns a reusable lesson session/dialog lifecycle and renders the same interior. It requests only `immersive-vr` and `local-floor` tracking; session entry always follows a learner action.
- `HirschbergPracticeController` supplies the first migrated Practice lesson. Existing four scenarios drive the patient's reflexes rather than consultation findings. Existing distance/aim/view math gates observation/entry; direct interpretation/landmark buttons and explicit submission provide local feedback/completion. Help is optional.
- `PracticeBatchVRStage` and `PracticeLessonUI` provide Bruckner, motility, cover–uncover and alternating cover adapters, sharing the same session/controls/mirror. `xrPracticeBatch` holds pure geometry and interruption rules. Bruckner/cover scenario content is shared with desktop; Test scoring remains separate.
- `xrViewer` samples the actual headset cameras for a stable centred scope window. `XRScopeView` replaces the automatic assisted eyepiece: B/Y on the held ophthalmoscope controller explicitly opens/closes it, independently of trigger illumination. `XRScopeObservation` renders the lesson’s two red reflexes or the aimed eye’s case-authored schematic; no headset-to-peephole gate remains. Setup, inspection, recording and completion remain adapter responsibilities. Scope mode closes on menus/recording, ownership changes, tracking/visibility loss, reset and exit; device validation is pending.
- The canonical kit includes a prism bar; optional tool-specific placement sockets let Practice mount the near card at about 40 cm. Cover observation remains paused in panel mode, while completed entry can use tracked held instruments in panel mode.
- `KrimskyPracticeController` reuses the shared penlight/prism and existing Krimsky method/residual logic. Explicit comparison capture permits two-hand recording after putting tools down; independent numeric fields extend the shared lesson panel/mirror. Monocular viewing is acknowledged, not detected.
- Desktop Practice teaching and all 20 modules remain available. All 20 modules now have shared-clinic XR adapters; see [full-library completion](vr-library-completion.md). Layout preview permits desktop inspection but does not emulate tracked hands or grant completion.

The earlier separate Hirschberg VR experiment, its kit models, controller preview, and seated/standing setup controls remain in `HirschbergLegacyVRStage.tsx` and related files for reference. They are outside the active import path and do not create a second bundled controller runtime.

## Controller contract

| Input | Shared behavior |
| --- | --- |
| Squeeze grip once near a handle | Pick up a canonical instrument with either hand; relax grip to keep carrying |
| Other hand grips a carried handle | Transfer ownership atomically |
| Squeeze grip again while carrying | Place at the green destination guide; amber indicates fallback return to rest |
| Release grip | Rearm the next squeeze without dropping the tool or interrupting trigger input |
| Trigger in tool mode | Illuminate supported lights/scopes while held |
| B/Y on the ophthalmoscope controller | Toggle a read-only enlarged scope view; illumination and spatial setup remain required |
| Empty controller ray + trigger | Select a visible panel control or floor destination |
| A/X | Toggle that controller's panel mode and request case/lesson controls |
| Controller translation/rotation | Supply working-point position and aim; illuminating tools use aim orientation at grip position |
| Headset pose | Supply examiner viewpoint and headset editor placement |
| Reset | Recall instruments without synthesizing fresh button presses |

Pickup is within 12 cm of the handle; socket return is within 10 cm. These are interaction tolerances. A mode switch, transfer, or tracking interruption cancels pending trigger input; the learner must release/repress. Correct input behavior is shared across modes, while the case or lesson owns the instructions, patient response, recording requirements, and feedback.

## Hirschberg interaction

1. Open Practice → Hirschberg → Quest / WebXR → Enter VR.
2. Identify and grip the penlight on the consultation trolley.
3. Select Look at the light on the rear-wall board or through A/X lesson controls.
4. Hold the tool trigger, move it to about 50 cm, aim at the eyes, and centre the examiner view.
5. Choose an interpretation and landmark on the rear-wall board, then select Submit / Check with either controller. Completed inspection survives looking away or putting the penlight down.
6. Review feedback. New patient finding resets the procedure and changes the visible reflexes without ending VR; Hirschberg/Bruckner retain tool ownership/pose and actual trigger/light state while requiring a fresh fixation/setup and inspection. Reset recalls equipment; Exit VR closes the lesson. Saved Practice progress stays in the library session.

The illustrative working zone remains 46–54 cm, with existing 8° aim/view tolerances. Immediate reflex clarity changes with setup; broader illumination can reveal a reflex without enabling recording. Invalid technique clears unfinished entry. Successful feedback stays on the wall; a readable headset HUD appears for five seconds after submission. Wrong tools, cancelled/incomplete attempts, layout preview, and exit award no completion. Correct submission is idempotent for each attempt and never dispatches a Test finding.

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

Worth four dot, stereopsis and 4Δ base-out are implemented over the shared runtime; see [the sensory implementation plan](vr-sensory-plan.md). All 20 Practice modules now have shared-clinic XR adapters. The final 11 phoria, vergence and accommodation modules are documented in [full-library completion](vr-library-completion.md); desktop trainers remain available. Physical Quest 3S and clinician review remain pending.

1. Sensory/phoria: extend shared equipment with filters, booklets, Maddox/Thorington targets; preserve existing patient-report and recording content.
2. Vergence/accommodation: connect physical target distance, prism/lens/flipper actions, timing, and existing response/recording rules.
3. Hand tracking remains a later input alternative once controller ergonomics are established.

Each module adds equipment and a lesson adapter, never another room/controller implementation. Clinical content and tolerances remain educational drafts pending qualified review; tracked consumer-device coordinates and illustrative optics do not certify clinical competence.

## Sensory architecture

`xrSensoryEquipment` owns the lesson kit, tagged patient fitting sockets, near target/stand poses and reflected 6 m distance path. Optional runtime equipment filters pickup, rendering, handle feedback and ray routing; default consultation remains the original kit. The state registry includes sensory IDs without casting them into Test examination IDs. `supportedWorkingPose` reads the actual model's working-point transform for held or supported tools; held samples require tracking, placed targets do not depend on the releasing hand. Worth power is an explicit persistent equipment capability; original lights remain momentary. Interruption reasons distinguish panel entry, transfer, visibility, tracking, reset and exit.

`xrWorthPractice`, `xrStereoPractice` and `xrFourPrismPractice` hold pure readiness, sequence, immutable capture and submission logic. Their React adapters provide only lesson-local reporting/completion, response timers and visualization. Stereo callbacks bind attempt/page/generation/revision and cannot append stale responses. Headset menu and recording bounds derive from content rows. Existing canonical eyes are moved via the shared eye-motion hook and restored on cleanup. Software checks use real mounted runtime/controllers with a simulated device; they cannot validate Quest optics, reach, comfort or clinical fidelity.


## Full-library completion

`xrLibraryEquipment` extends optional kits with rods, cards, trial lenses and flippers, separate fitting/occlusion layers, explicit library-only surfaces and actual working-pose gates. Three family controllers adapt all remaining 11 modules over the same runtime; pure sequence/capture logic remains in `web/interaction/`. Authored endpoints and gaze formulas are shared with desktop. Signed decimal records use paged headset fields and preserve released-tool captures. Facility timing and lens settling reset on invalid spatial/tracking setup. No Test events or new clinical approval are introduced. See [implementation and physical acceptance](vr-library-completion.md).
