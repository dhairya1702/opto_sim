# Practice VR batch: Bruckner, motility, and cover testing

## Scope

Extend the existing shared consultation clinic with four Practice adapters: Bruckner, extraocular motility, cover–uncover, and alternating cover with prism neutralisation. Keep the completed Hirschberg adapter, all desktop trainers, and consultation free exploration. This batch does not convert the remaining library, add cases, change Test scoring, or claim device/clinical validation.

## Implementation

1. Share existing Bruckner and cover scenario content with desktop. Reuse optic technique checks, motility coverage/gaze math, and cover dwell/neutralisation functions. Add pure patient-relative XR conversions and interruption rules with focused tests.
2. Extend the canonical equipment registry with one prism bar, using the same ownership, placement, input, and instrument rendering. Add optional tool-specific placement sockets to the shared runtime so Practice can mount the near card without using a third hand. Consultation uses its existing placement destinations.
3. Reuse the Practice clinic shell and add a shared lesson panel/mirror for direct recording, blank choices, optional help, reset, next finding, and exit. Each adapter owns its procedure state and local completion only.
4. Bruckner: ophthalmoscope trigger, physical small/large aperture wheel shared with consultation, simultaneous authored reflexes, approximately 1 m, instructed fixation, headset behind the rear aperture, explicit brightness entry. A nearby free controller selects the wheel; there is no wall-board aperture/setup-completion button. Physical distance, aim, beam coverage and rear-aperture alignment gate inspection. Captured inspection survives looking away and releasing/placing equipment for answer entry; configuration changes clear inspection and pending answers.
5. Motility: penlight tracking at the existing forgiving XR distance tolerance, fixation/head instruction, primary plus eight gaze dwell points, existing coordinated eye visualization, symptom question, and explicit observation. Lost tracking/illumination interrupts unfinished dwell. Preserve the existing desktop policy that a completed observation can be recorded with a recheck notice.
6. Cover: physical single-eye occlusion and uncover positions, existing ordered sequences/scenarios, immediate refixation visuals. Distance fixation is illustrative in this room, not a calibrated 6 m lane. Picking up the near card selects near setup; returning it to its home restores distance. Near readiness requires about 40 cm; the stand assists placement. Changes to fixation setup clear the observation sequence.
7. Alternating cover: initial movement observation, blank movement/deviation entries, base/power controls beside the held prism and on the floating panel. Physically place the selected prism before either eye, repeat the sequence, and require the existing exact neutralising endpoint before recording. Losing prism alignment clears unfinished trial credit; changing base/power clears neutralisation. Short transit between eyes is tolerated; sustained binocular uncovering resets the alternate sequence.
8. Add real mounted two-controller walkthroughs and pure geometry tests. Run only affected unit tests, TypeScript/Vite build, and whitespace checks. No Playwright, full suite, servers, commits, push, or deployment.

## Review and device follow-up

All findings and interactions remain educational drafts. Spatial alignment, transit allowances, eye-motion amplitudes, stand snapping, and aperture framing are engineering approximations. No new diagnostic content or case facts are authored. Quest 3S reach, text readability, grip orientation, and visual comfort still need hands-on checking.
