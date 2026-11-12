# Detailed patient eye parity audit — 2026-11-11

**Historical audit result before shared-eye replacement: NOT identical. Do not treat the development patient as a visually equivalent replacement yet.** The findings below describe the removed spherical-eye implementation. No E2E or physical-headset tests were run.

## Evidence and scope

Reviewed all 20 entries in `PracticeMode.tsx`, their active shared-clinic controller routing in `PracticeBatchVRStage.tsx` / `HirschbergVRStage.tsx`, the consultation controller, canonical eye anchors, reflex surfaces, current patient mesh and detailed visual adapter. Standalone manual exam views and expanded scope panels do not use the replacement model.

- Baseline selection: 120 tests passed across consultation, Practice batch, library, 4Δ and detailed-adapter tests.
- Forced detailed selection: **164/166 passed**, nine mounted-clinic suites. Reproduce with `npx vitest run --config eye-audit.config.ts`. This separately preloads the actual detailed asset and selects it for each test; only texture loading/GPU/device are mocked by the existing harness.
- Two failures are in NPC and push-up assertions that locate the old ellipsoidal sclera by exact geometry/scales. They fail before measuring containment on the new mesh. They do not establish a wrong clinical endpoint, and they must not be bypassed as evidence of equivalent visibility.
- Existing loop tests mostly inspect controller nodes, recordings, gates and reports. Their passing does NOT establish per-frame rendered geometry parity or every authored scenario's pixel appearance.
- The new single-frame consultation audit recorded previous X `+0.004945054945054945`, new command X `-0.004945054945054945`, but rendered iris-centre X `+0.004945054945054946`. The detailed adapter was still displaying the preceding frame. This is an observed timing mismatch, not a hypothetical risk.

## Confirmed differences

1. **Movement representation.** Current shared-clinic XR eyes translate flat iris/pupil discs. Detailed eyes rotate complete spheres. The mapping preserves iris-axis X/Y displacement in its supported range, but changes surface depth, viewing-angle foreshortening and lid coverage. At X=12 mm on a 25 mm sphere, the front axis recedes by about 3.07 mm and the iris plane tilts about 28.7 degrees; the old disc does neither. No amount of identical controller inputs removes this difference.
2. **Depth alignment.** Old iris world Z is -0.571 m and old pupil Z is -0.570 m (`Models.tsx`). The detailed sphere's neutral front is -0.573 m, then recedes during gaze. Canonical instrument anchors alone did not reproduce the old rendered surface depths.
3. **One-frame adapter delay.** The detailed model reads control objects in its own default-priority `useFrame`, separately from the controller that writes them. The mounted consultation test reproduces a previous-frame result on a direction reversal. This audit does not claim every adapter's subscription ordering was individually measured; the shared architecture makes ordering a parity obligation for every mover.
4. **Pupil appearance.** Old pupil is an unlit flat disc scaled by the controller; new pupil is a threshold in a lit, specular material on a rotating sphere. Nominal radius and constriction input match, but visible shape, contrast, highlights, depth and oblique apparent size do not. New adapter only consumes scale.x; old mesh transforms include x/y scaling (currently consultation sets them equally).
5. **Sclera/lid envelope.** Old sclera uses radii (.025,.011,.013); new sclera is a .025 sphere exposed by a sculpted lid. Their visible envelopes and occlusion at extremes are not identical, including behind prisms/occluders.
6. **Blink.** Both reuse the 0.18-second closure function and 2.6–6.4-second random interval distribution. Old blinking overlays skin ellipsoids; new blinking morphs the face. Coverage differs. Random draws are independently scheduled; same function does not mean identical timestamps across separate runs.
7. **Reflex relationships.** Hirschberg, Krimsky, Bruckner and retinoscopy retain their old world-space overlays and source findings. The underlying eye is now curved, deeper and differently clipped. Identical overlay coordinates do not prove identical pupil-edge/limbus relationships, occlusion or appearance. Expanded scope illustrations themselves remain unchanged.
8. **Non-XR Test room.** The old `Patient xr={false}` renders small dark eye orbs, while the selected new patient still renders its detailed iris/pupil shader. Static appearance differs there too. Standalone manual examinations keep their original separate eye components.

## Every Practice module

“Shared inputs” means the same authored procedure drives the same OD/OS control values, not that the rendered eyes are equivalent. All rows inherit the blink/envelope differences above.

| Module | Existing eye behaviour | Audit conclusion |
| --- | --- | --- |
| Extraocular motilities | Per-eye scenario yaw/pitch converted to X/Y offsets; pursuit restrictions/nystagmus remain scenario-owned | Shared inputs; spherical rendering differs; frame ordering must be corrected |
| Bruckner | Authored unequal/equal reflex overlays, scope observations | Overlay logic unchanged; underlying pupil/reflex relationship not equivalent |
| Hirschberg | Authored displaced reflex landmarks, clipped against canonical envelope | Coordinates unchanged; new pupil/limbus/sclera alignment not certified |
| Krimsky (standard/modified) | Prism residual moves the reflex, not a newly invented ocular rotation | Neutralisation logic unchanged; appearance/landmark depth differs |
| Cover–uncover | Independent deviation, fusion/drift and refixation with existing easing | Shared inputs; rotation/occlusion and potential frame delay differ |
| Alternating cover + prisms | Independent latent deviation, transit and prism residual | Same procedure math; no exact visual parity |
| Worth four dot | Authored patient report and fitted filters; no dedicated gaze writer | Reports unchanged; eye appearance/blink/filter fit not equivalent |
| Stereopsis | Authored booklet responses and fitted glasses; no dedicated gaze writer | Responses unchanged; baseline eye appearance differs |
| 4Δ base-out | Eye-specific conjugate/vergence sequence from `clinicFourPrismGaze` | Shared sequence values; actual rendered motion/occlusion differs |
| Maddox rod | Patient percept/prism reports and target setup; no canonical gaze writer | Percepts unchanged; no new ocular motion should be inferred |
| Modified Thorington | Card/rod percept and captured report; no canonical gaze writer | Reports unchanged; baseline visual differences remain |
| NPC | Inward convergence and OS outward break/drift, with existing easing | Shared targets; old containment assertion fails against changed geometry |
| Horizontal distance vergence | Independent BI/BO demand, break/recovery with easing | Shared inputs; sphere depth/foreshortening differs |
| Vertical distance vergence | Independent vertical demand/break/recovery, X/Y settling | Shared inputs; sphere/lid presentation differs |
| Horizontal near vergence | Near convergence plus BI/BO demand and break/recovery | Shared inputs; sphere/occlusion differs |
| Near vergence facility | Timed BI/BO switching through `facilityVergenceGaze` | Shared input timing; separate rendering callback requires ordering verification |
| Push-up amplitude | OU convergence when instructed; monocular occlusion and endpoint logic | Shared targets; old containment assertion fails against changed geometry |
| Minus-lens amplitude | Monocular blur reports, lens/capture logic; no canonical gaze writer | Reports unchanged; baseline pupil/lid appearance differs |
| NRA/PRA | Binocular lens/blur sequence; no canonical gaze writer | Reports unchanged; baseline pupil/lid appearance differs |
| Accommodative facility | Monocular/binocular flipper reports and timing; no canonical gaze writer | Reports unchanged; baseline pupil/lid appearance differs |

## Test encounter

- In-room fixation/following: same instructions, readiness/tracking gates and X/Y targets. Single-frame reversal mismatch reproduced.
- In-room pupils/near response: same light/target controls and pupil scaling commands; shader/geometry differences remain.
- In-room retinoscopy/Bruckner/ophthalmoscopy: existing authored findings, aiming math and scope panels remain. New eye depth/lid overlap requires comparison with unchanged overlays.
- Manual distance/pinhole/near acuity, pupils/near response, cover, motility, retinoscopy and anterior/posterior illustrations: separate existing examination components; not replaced by the appearance switch. Their existing behaviour is unchanged by the adapter.
- Notebook, recordings, prerequisites, diagnosis/management and scoring remain in the same deterministic domain logic. They are not proof of visual eye equivalence.

## Required direction for literal behavioural equivalence

Keep the detailed face/body, but render the current patient's canonical sclera/iris/pupil motion primitives and exact depths inside it, with the same per-eye controller transforms and material response. Fit the lids around that canonical envelope instead of converting translation to globe rotation. Preserve synchronous updates (or an explicitly ordered shared visual adapter). Recheck blink coverage and every reflex/occluder/prism overlap. Add rendered-geometry parity assertions for all moving adapters and both eyes, including transients and resets, not only command-value assertions. Headset visual/performance acceptance remains pending.

## Shared-eye replacement

Both patients now render `PatientEyes`: identical ellipsoidal sclera, flat iris and pupil meshes, depths, direct controller transforms and blink geometry/timing. The detailed face retains its cosmetic body, mouth and eyebrows; its skin shader clears the canonical oval openings. Its separate spherical eyes, pupil shader, blink morph and per-frame proxy copying were removed. A strict direction-reversal regression checks the rendered iris against the current controller position in the same frame, including unchanged depth, pupil constriction and tracking/exit resets. Physical Quest and rendered visual acceptance remain pending; mounted tests do not establish pixel-level face/skin fit.

Verification after replacement: **1,083/1,083** full unit tests and **166/166** forced-detailed mounted clinic tests passed (including both previously failing NPC/push-up sclera checks). Production build passed with the existing large Three.js chunk warning; `git diff --check` passed. No E2E runs or deployment.
