# Shared-clinic VR Practice library — implementation complete, validation pending

All 20 existing Practice modules now offer Quest / WebXR through the canonical consultation clinic. This completes the implementation scope for the current library; it does not establish physical-device or clinical acceptance. No servers, tunnels, deployment, persistence, additional Test case or Test scoring changes are included. Desktop trainers and WebGL fallback remain available.

## Remaining 11 adapters

| Family | Modules | Authored behavior retained |
| --- | --- | --- |
| Phoria | Maddox rod; Modified Thorington | Correction plus OD rod; groove orientation; distance/near horizontal/vertical prism neutralisation; near numbered-card magnitude and direction |
| Vergence | NPC; horizontal distance; vertical distance; horizontal near; near facility | Ordered subjective/objective breaks then recoveries; BI→BO / BU→BD blur/break/recovery; 12Δ BO / 3Δ BI full pairs over 60 seconds |
| Accommodation | Push-up; minus lens; NRA/PRA; accommodative facility | OD/OS/OU push-up; OD then OS minus-lens blur; binocular NRA→clear baseline→PRA; OD/OS/OU ±2 D full pairs over 60 seconds |

`PhoriaPracticeController`, `VergencePracticeController` and `AccommodationPracticeController` are adapters over `useXRClinicRuntime`. They add no controller loop, room, network service or Test reducer path. `PracticeBatchVRStage` routes the modules; each teaching page retains its desktop launch beside Quest / WebXR.

Existing desktop numerical findings and eye-motion formulas were moved without changing values into `vergencePractice.ts`, `accommodationPractice.ts` and `thorington.ts`. Existing Maddox, minus-lens, relative-accommodation and accommodative-facility functions remain the clinical behavior sources. `xrPhoriaPractice.ts`, `xrVergencePractice.ts` and `xrAccommodationPractice.ts` hold pure ordered/capture/entry logic.

## Equipment and actual geometry

`xrLibraryEquipment.ts` declares selected kits, patient fitting, near sockets, physical readiness, occlusion and setup signatures. Correction is fitted to the existing spectacle plane. Maddox fits before OD on a separate filter layer; the cover fits over the opposite eye for monocular accommodation and must be removed for OU. New tools have distinct homes on an original lens/rod/flipper tray. Explicit library-only placement surfaces leave Test's existing kit and surfaces unchanged. Visible approach pads and fitting cues assist pickup/release.

Maddox uses the existing illuminated target in single-point mode. Its tagged distance dock establishes the existing illustrative mirrored 600 cm path; near uses the 38–42 cm handling range. Thorington requires a patient-facing near card and a lit penlight ray through its physical centre aperture. A near stand frees a hand. The numbered card and reported streak/light relation are illustrations of a fictional patient's report, not calibrated optics or a learner vision test.

NPC and push-up require actual target movement beginning around 40 cm, measured from the illustrative spectacle plane. Their endpoint capture permits at most 0.5 cm of handling overshoot in the direction of the authored report: inward at break/blur, outward at recovery. Actual measured samples are retained and independently entered; push-up amplitude uses 100 / captured centimetres. This is an engineering handling allowance, not a clinical threshold. Near lens/prism exercises require the actual near-card working point at 38–42 cm and a patient-facing optic before the relevant eye or both eyes. These tolerances need clinician/device review.

Prism settings and trial-lens/flipper powers are visible on the canonical instrument. Vergence eye motion reuses the desktop illustrative gaze formulas, scaled into the clinic patient's eye groups; it is not a validated physiological model. Correction and occlusion/rod fitting use tagged socket identities and revisions, so removal/refitting invalidates unrecorded evidence even if the final pose looks identical.

## Observation, timing and recording

Maddox must introduce sufficient 20Δ prism at valid geometry before reducing to the authored coincidence. Thorington explicitly asks for the number/side. Prism vergence begins at zero and captures blur where applicable, then break, then recovery before recording each base. NPC captures the four endpoints in order. Minus-lens quarter-dioptre changes settle for the existing fictional 1200 ms response; NRA/PRA also uses that pacing with explicit clear-baseline confirmation. Invalid tracking/geometry resets an unfinished run and its current demand.

Both facility runs last 60 seconds and count only complete pairs. They preserve the existing fictional clear-response delays: vergence BO 850 ms / BI 650 ms, accommodation plus 1500 ms / minus 1800 ms. Trigger or explicit button flips only after a valid clear report. Losing tracking, hidden session, transfer, teleport interruption or invalid geometry resets unfinished timing; elapsed time while interrupted earns no credit.

Completed observations are immutable captures separate from learner entries. Ordinary tool movement/release and opening recording preserves captures so instruments can be put down. Fitting/settings changes, restart, cancellation and exit invalidate them as appropriate. All required eyes/bases/trials must be independently recorded before one local completion award; blank, wrong or duplicate submissions do not add credit. Already recorded observations remain available in the lesson's acquired-history mirror. Practice never writes Test evidence.

Numeric headset entries support signed decimal increments plus ±1/±5 shortcuts. Multi-field numeric records show one field per page with previous/next navigation; entries remain blank until explicitly entered and persist across pages. The labeled HTML mirror provides keyboard alternatives. Layout preview cannot acquire observations or award completion.

## Software and physical acceptance

Focused pure and mounted tests cover every new module's controller walkthrough, endpoint ordering, physical fitting/target/optic alignment, captured samples, signed decimal ray entry, cancellation/refitting, hidden/tracking interruptions, release-to-record, duplicate/late input, preview isolation and no Test effects. Shared consultation and existing Practice regressions, the build and whitespace check accompany the handoff. The user's verification scope excludes the full unit suite and Playwright.

Next: open the app in Quest Browser over HTTPS and check all 20 modules on the physical Quest 3S. Verify seated/standing reach, fitting/occlusion comfort, small numbered targets, mirror visibility, decimal pages, two-hand pickup/transfer, near movement, released-tool recording, controller tracking/guardian interruptions, exit/re-entry and sustained frame timing. Software checks cannot verify these device properties. Qualified clinician review must assess source wording, sequence, optics, response illustrations and handling tolerances before release; status remains draft.


Baseline software verification: **148 focused tests across 19 files passed**, including every new module and shared consultation/Practice regressions. `npm run build` and `git diff --check` passed. Vite reports chunk-size warnings for the existing Three.js chunk (~704 kB) and the expanded application entry (~528 kB); physical Quest frame timing remains unmeasured. No full unit suite or Playwright was run. The completed library was committed as `d327a70` and pushed to `origin/vr-improvements` at the user’s request. The original checkout is on that branch; earlier edits are preserved in a separate stash and Git bundle. See `vr-code-review.md` for subsequent software corrections. Servers/tunnels remain off; nothing is deployed.

Review verification: **159 focused regressions across 20 files passed**, with the affected mounted-controller tests rerun after the final tracking correction. Production build and whitespace check passed. See `vr-code-review.md`; physical-device acceptance remains pending.
