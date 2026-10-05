# Shared clinic migration: Hirschberg first

## Scope and acceptance

Practice uses the consultation clinic and its physical interaction loop. The initial change migrated Hirschberg. Subsequent batches migrate Bruckner, motility, both cover lessons, Krimsky and the three sensory lessons; see [its plan](vr-practice-batch-plan.md). All modules retain their existing teaching and desktop attempts. No Practice action imports the Test reducer, modifies Arun's case, or awards Test evidence. All clinical content remains draft.

The learner must be able to choose Hirschberg from the existing library, enter the same clinic, identify and grip the penlight with either controller, illuminate it, ask for fixation, move to the taught distance, inspect scenario-specific corneal reflexes, enter an interpretation directly from the held-tool control, receive feedback, change finding without leaving VR, reset, and exit. Wrong tools cannot satisfy Hirschberg. Lost tracking, invalid technique, cancelled recording, and scenario changes cannot preserve an unfinished observation or create completion.

## Implementation sequence

1. Extract the existing physical controller loop into `useXRClinicRuntime`. Keep controller ownership/input, tool pose updates, transfer, placement, trigger routing, tracking/session interruption, ray priority, and teleportation in this shared layer. Retain the canonical instrument registry and geometry rather than introduce a second kit. Extract headset observation panels and runtime rendering. Consultation remains a case adapter over these primitives; its regression walkthrough must continue to pass.
2. Add a Hirschberg lesson adapter. Reuse `xrHirschbergTechnique`, existing scenario positions, landmark interpretations, and local completion callbacks. Add only patient-scale visual conversion and observation lifecycle state. Live poses come from the shared runtime's working point and headset camera. Feedback is withheld until explicit submission; required instruction/illumination/distance/aim/view conditions gate observation and recording.
3. Replace the active Hirschberg VR entry with the canonical consultation interior plus this adapter. Provide optional help, fixation, tool-side recording, blank interpretation choices, feedback, new finding, reset, and Exit VR through shared panels. Keep a labeled HTML mirror, the existing desktop clinical attempt, and a clinic-layout preview. Preserve the old VR experiment in a legacy source file for later reference; it is not the active immersive path.
4. Verify mounted two-controller interactions, scenario changes, trigger/distance/tracking invalidation, cancel, duplicate completion, and exit. Re-run affected consultation/geometry/math tests, build TypeScript/Vite, and check whitespace. No Playwright or full suite is requested. Keep servers off and do not commit/push/deploy.

## State and rendering contracts

- Runtime owns physical equipment and input; adapters own clinical behavior and learning state. The shared runtime never receives expected answers or case-scoring actions.
- Device poses and visual parameters update refs each frame. React readouts update at a limited cadence; no continuous frame-rate React rendering is added.
- Hirschberg scenarios remain authored in Practice. Practice uses its current scenario rather than consultation case values. Coordinates are converted to the existing patient's pupil/iris scale, preserving OD/OS and direction.
- Observation capture is explicit and conditional on live technique. Pending entries and inspection clear on invalidation; a successfully submitted attempt keeps its feedback until retry/new finding. Completion is idempotent for each scenario attempt and local to Practice.
- Reset recalls instruments through the same placement system. Changing findings clears procedure state while retaining the shared clinic/session. Exit removes controller actions and illumination; system session end and dialog cancellation do the same.
- Desktop Practice stays usable without WebXR; the clinic-layout preview does not simulate hand tracking or grant completion.

## Remaining module migration

After Hirschberg, lesson adapters for Bruckner, motility, and cover testing have been added. Their authored Practice scenarios must drive patient visuals rather than copy Arun's normal case. Extend the canonical registry with prism bars, filters, booklets, targets, and flippers only as their modules migrate; reuse the existing original models and procedure math. Krimsky and the three sensory lessons now use distinct lesson adapters; phoria/vergence/accommodation now complete the 20-module migration, without another controller runtime or room. See [full-library completion](vr-library-completion.md). Device ergonomics and clinical review remain separate validation steps.
