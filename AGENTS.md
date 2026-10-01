# AGENTS.md

## Purpose

This repository contains **Opto**, a browser-based optometry learning simulator with two product modes. **Practice** teaches individual clinical skills with guidance and immediate feedback. **Test** provides a fictional first-person patient encounter with examination selection, findings, diagnosis, management, and deterministic debrief scoring.

The current product is an educational draft. It is not clinically validated, does not certify manual competence, and must not be presented as a substitute for supervised clinical training. Clinical claims, workflows, scoring, and authored findings require qualified clinician review before release.

These instructions apply to the entire repository.

## Current scope

- Mode-selection entry screen separating guided Practice from case-based Test.
- A 20-module binocular-vision Practice library across motor alignment, sensory status, latent deviation, vergence, and accommodation. It includes extraocular motilities; Bruckner, Hirschberg, Krimsky, cover–uncover, and alternating cover; Worth four dot, stereopsis, and 4Δ base-out; Maddox rod and Modified Thorington; near point of convergence, horizontal distance, vertical distance, horizontal near, and near vergence facility; and push-up amplitude, minus-lens amplitude, NRA/PRA, and accommodative facility. All interactions and findings remain educational drafts pending clinical review.
- One case: `adult_distance_blur_01`, version `0.1-draft`.
- One fictional patient: Arun, age 24, with gradual bilateral distance blur.
- Scripted, deterministic history responses; no network or AI service.
- Examination selection, prerequisites, result recording, evidence selection, assessment, management choices, and debrief.
- Manual interactions for distance/pinhole/near acuity, pupils, near pupil response, cover testing, motility, and retinoscopy.
- Illustrative anterior-segment and posterior-pole views.
- Desktop first-person controls plus click-based station mode and a WebGL-failure fallback.
- Session state is memory-only and is cleared by reload or restart.

Out of scope at present: authentication, backend persistence, institutional records, secure examination delivery, multiplayer/supervisor mode, speech recognition, generative patient dialogue, VR/XR, validated optical or disease physiology, and clinical certification.

## Technology

- React 19 and React DOM
- TypeScript 5.9 in strict project-build mode
- Vite 7
- Three.js, React Three Fiber, and Drei
- Vitest for domain/interaction unit tests
- Playwright for browser end-to-end tests
- Lucide React icons

No backend is required. `main.py` is a small pre-existing Python entry point and is not part of the web application runtime.

## Repository map

| Path | Responsibility |
| --- | --- |
| `web/main.tsx` | React application entry point |
| `web/app/App.tsx` | Top-level session/UI orchestration, panels, room state, held instruments, and examination completion |
| `web/ui/ModeSelection.tsx` | Product entry point for choosing Practice or Test |
| `web/practice/PracticeMode.tsx` | Binocular-vision practice library, teaching content, guided trainers, and local completion state |
| `web/practice/ClinicalPracticeStage.tsx` | Full-screen first-person Bruckner/Hirschberg patient, two-hand instrument scene, technique HUD, and observation slot |
| `web/practice/CoverPracticeStage.tsx` | Full-screen cover–uncover and alternating-cover practice, two-hand tools, simulated refixation, and prism neutralisation |
| `web/practice/KrimskyPracticeStage.tsx` | Full-screen standard and modified Krimsky setup, direct prism handling, illustrative reflex neutralisation, and recording |
| `web/practice/SensoryPracticeStage.tsx` | Routes sensory Practice modes to the dedicated Worth, stereopsis, and 4Δ base-out stages |
| `web/practice/WorthPracticeStage.tsx` | Full-screen Worth four-dot setup, target presentation, patient report, and interpretation |
| `web/practice/StereopsisPracticeStage.tsx` | Full-screen stereo-booklet sequence, patient responses, and threshold recording |
| `web/practice/FourPrismPracticeStage.tsx` | Full-screen 4Δ base-out setup, prism placement before both eyes, response comparison, and recording |
| `web/practice/PhoriaPracticeStage.tsx` | Routes latent-deviation Practice modes to the dedicated Maddox rod and Modified Thorington stages |
| `web/practice/MaddoxPracticeStage.tsx` | Full-screen distance and near Maddox rod setup, patient percept, prism neutralisation, and recording |
| `web/practice/ThoringtonPracticeStage.tsx` | Full-screen Modified Thorington setup, patient percept, and magnitude/direction recording |
| `web/practice/VergencePracticeStage.tsx` | Routes NPC and fusional-vergence modules and implements their shared full-screen practice flow |
| `web/practice/AccommodationPracticeStage.tsx` | Routes push-up, minus-lens, NRA/PRA, and accommodative-facility Practice modules |
| `web/practice/MinusLensPracticeStage.tsx` | Full-screen monocular minus-lens amplitude interaction and recording |
| `web/practice/RelativeAccommodationStage.tsx` | Full-screen binocular NRA/PRA lens sequence and recording |
| `web/practice/AccommodativeFacilityStage.tsx` | Full-screen timed monocular and binocular accommodative-facility runs |
| `web/cases/adultDistanceBlur.ts` | Authoritative case facts, exam definitions, findings, rubric, omission rules, and answer key |
| `web/domain/types.ts` | Case, session, action, finding, scoring, and event types |
| `web/domain/engine.ts` | Pure session reducer, prerequisite gating, result keys, and deterministic assessment |
| `web/patient/scripted.ts` | Deterministic question matching and scripted patient replies |
| `web/interaction/` | Input/controller code plus pure procedure logic for acuity, cover, motility, pupils, retinoscopy, navigation, and optional WebMCP exposure |
| `web/scene/Room.tsx` | Three.js consulting room and first-person interaction surface |
| `web/scene/Models.tsx` | Procedural room/patient/equipment geometry |
| `web/scene/EyeSurface.tsx` | Procedural illustrative eye rendering |
| `web/scene/PosteriorPole.tsx` | Explicitly schematic posterior-pole view |
| `web/scene/ExaminationView.tsx` | Routes a selected procedure to its examination UI |
| `web/scene/Manual*Examination.tsx` | Manual procedure state machines and observation forms |
| `web/scene/MotilityExamination.tsx` | Manual H-pattern motility interaction |
| `web/ui/` | Interview, examination selection, notebook, submission, debrief, dialogs, and shared styles |
| `web/tests/*.test.ts` | Fast unit tests for pure domain and interaction behavior |
| `web/tests/e2e/*.spec.ts` | Full browser workflows and manual-procedure checks |
| `docs/clinical-review.md` | Reviewable clinical source of truth, limitations, rubric summary, and approval checklist |
| `docs/binocular-vision-practice.md` | Supplied clinical source notes, implemented Practice modules, and unresolved review decisions |
| `docs/interaction-update.md` | Interaction history and current control behavior |
| `docs/asset-manifest.md` | Visual-asset provenance and licensing |
| `README.md` | Setup, user workflow, architecture, and feature-level behavior |

## Application flow

The root application first asks the learner to choose a mode. Practice and Test are separate learning contexts; Practice progress must never affect Test scoring.

### Practice

1. The learner opens the binocular-vision library and selects an available skill.
2. The module explains purpose, equipment, setup, ordered procedure, observations, recording, and escalation.
3. The learner enters a first-person clinical attempt, controls the instrument hand, uses the off hand when the procedure calls for it, and completes fixation, illumination, distance, aim, and examiner-view alignment.
4. The simulated finding is withheld until the required technique gates are satisfied.
5. Immediate feedback explains the observation. Completion is local practice progress, not certification.

### Test

1. `newSession` creates a briefing-phase session.
2. Starting the consultation dispatches a `start` action and enters the encounter.
3. Interview questions dispatch `askQuestion`; the scripted provider returns matched facts, clarification, or an unsupported response.
4. A learner selects an examination and configuration (`eye` plus `mode`).
5. `examBlock` checks case-authored prerequisites, such as same-eye distance acuity before pinhole and objective refraction before subjective refinement.
6. Manual views collect the procedure sequence and, where supported, a structured learner observation.
7. `performExam` records either the authored finding or the learner observation with the authored value retained as `expectedValue`.
8. The notebook exposes only acquired history and findings.
9. Submission freezes the attempt, filters evidence to acquired IDs, and changes the phase to debrief.
10. `assess` computes deterministic rubric scores and critical-omission feedback from the event log.

The event log is part of the evidence model. Do not update results, transcript, or scoring state without also considering event provenance and replay/audit behavior.

## Source-of-truth rules

- Clinical content belongs in `web/cases/adultDistanceBlur.ts`, not in scene components.
- Practice teaching content and its review decisions are documented in `docs/binocular-vision-practice.md`. Keep interaction constants in `web/interaction/` and avoid copying interpretation rules across components.
- Shared clinical/session shapes belong in `web/domain/types.ts`.
- Reducer and scoring behavior belongs in `web/domain/engine.ts` and should remain deterministic and side-effect free.
- Procedure math and ordered-step logic should live in `web/interaction/` where it can be unit tested independently of React and pointer input.
- Scene components may visualize a finding but must not silently invent or expand the clinical claim.
- The authored case value remains the reference value. Learner-entered observations must be retained distinctly and assessed explicitly.
- Never imply that an undilated posterior-pole view establishes a normal peripheral retina.
- Do not add a pass mark, referral interval, treatment rule, or clinical approval without an identified clinical source and reviewer decision.

## State and React conventions

- Keep render state and mutable timer/input state synchronized deliberately. Long-running intervals should read current values from refs rather than stale closures.
- Reset dwell/procedure progress when a learner changes a parameter that invalidates prior progress (distance, illumination, beam state, lens, axis, fixation, or tool position as applicable).
- Clear pointer capture/drag state on pointer up, pointer cancel, lost capture, dialog close, and examination transitions.
- Never request pointer lock automatically after Escape/cancel. Pointer lock must follow an explicit learner action.
- Preserve station-mode and WebGL-failure paths whenever changing room navigation.
- Guard duplicate UI actions. Reducer request IDs are the final idempotency boundary.
- Prefer case-derived labels and configurations over duplicated literals.
- Avoid non-null assertions unless the value is guaranteed by a nearby invariant; handle case-data mistakes visibly when feasible.

## Examination implementation rules

- A procedure must not be recordable until its required observable sequence and structured observation are complete.
- Cancelling an examination records nothing.
- A repeated completed examination logs a repeat event but must not create duplicate credit.
- Technique state should reset when the learner invalidates it; changing controls must not preserve dwell credit accidentally.
- Manual technique interactions are educational approximations. UI copy must not claim calibrated distances, validated instrument handling, or physiologically complete optics.
- OD means right eye, OS means left eye, and OU means both eyes. Keep these mappings consistent in labels, rendering, storage, and tests.
- Accessibility alternatives are required for drag interactions: keyboard controls, labeled form elements, and usable dialog focus behavior.
- Reduced-motion preferences must be respected for nonessential animation.

## Styling and UI conventions

- Shared styling lives in `web/ui/styles.css`; avoid inline styles except for genuinely dynamic values.
- Use semantic buttons, labels, headings, dialogs, live regions, and native controls before custom equivalents.
- Maintain keyboard usability at narrow widths and without pointer lock.
- Do not expose hidden answer-key data before debrief through labels, default selections, debug output, or client-visible hints beyond the unavoidable inspectability described in the draft limitations.
- Keep failure messages actionable and distinguish unavailable rendering from incomplete clinical steps.

## Testing and verification

Install and run:

```sh
npm ci
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

During focused work, run the nearest unit test first, then the full unit suite and build. Run affected Playwright specs for interaction changes; run the full end-to-end suite before handing off broad workflow changes.

Required checks for most changes:

```sh
npm test
npm run build
git diff --check
```

Add or update tests when changing:

- question matching or disclosed history;
- prerequisites, result keys, reducer behavior, evidence filtering, scoring, or omission flags;
- procedure geometry/math or step ordering;
- recording/cancel/repeat behavior;
- pointer, keyboard, distance, illumination, or dwell-reset behavior;
- the accessible station fallback or full encounter path.

Do not “fix” a failing clinical assertion by changing the expected value until the case source and `docs/clinical-review.md` have been reconciled.

## Clinical review discipline

Any change to case facts, numerical findings, interpretation, expected examination sequence, management, safety advice, rubric weights, or omissions is a clinical-content change. For such changes:

1. Update the case source.
2. Update affected unit and end-to-end tests.
3. Update `docs/clinical-review.md`.
4. Keep the review status `draft` unless an authorized clinician has supplied documented approval.
5. Record assumptions and unresolved decisions rather than inventing local policy.

The current reference context is listed in `docs/clinical-review.md`; those references do not constitute approval of this implementation.

## Assets and licensing

Visuals are currently original procedural geometry/code-generated assets. Check `docs/asset-manifest.md` before adding an asset. Record source, creator, license, modifications, and intended use for every third-party asset. Do not add an asset with unclear redistribution or commercial-use rights.

## Performance notes

- Three.js is intentionally separated into build chunks, but the production build currently reports a chunk above Vite's 500 kB warning threshold.
- Preserve lazy-loading/code-splitting opportunities when adding large scenes or assets.
- Avoid per-frame React state updates where refs or shader uniforms are sufficient.
- Dispose of Three.js resources and remove global listeners/timers during cleanup.
- Keep representative low-power trainee hardware and device-pixel-ratio limits in mind.

## Change safety

- The working tree may contain user edits. Inspect `git status` and relevant diffs before editing; never discard unrelated work.
- Make focused changes and do not reformat unrelated files.
- Do not commit generated `dist/`, Playwright reports, test results, or dependency directories.
- Do not add network calls, analytics, storage, accounts, or external services without explicit product authorization and a privacy/security review.
- Never include real patient data. All cases must remain fictional or properly de-identified under an approved process.

## Documentation synchronization

Update documentation in the same change when behavior changes:

- `README.md` for setup and learner-facing workflow;
- `docs/interaction-update.md` for interaction/control changes;
- `docs/clinical-review.md` for clinical content and review decisions;
- `docs/asset-manifest.md` for asset provenance;
- this file when architecture, conventions, verification, or contributor guidance changes.

When documentation and implementation disagree, verify the implementation and clinical source of truth, then correct both deliberately. Do not assume either is automatically authoritative for clinical correctness.
