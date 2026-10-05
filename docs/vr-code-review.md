# Shared-clinic VR code review — 2026-10-05

Baseline: `d327a70` (`vr-improvements`). All 20 Practice modules have implemented XR routes. This review covers their controllers and pure procedure adapters, shared ownership/input/session handling, room and instrument transforms, recording, desktop preview isolation, and documentation. It is a software review, with mounted Three.js geometry and simulated XR events; it is not a GPU screenshot review or physical Quest acceptance.

## Confirmed issues and corrections

| Priority | Trigger and impact | Correction and regression evidence |
| --- | --- | --- |
| P1 | Session ends while the parent's `active` prop is still true. A later render/frame could restore tracking and accept input. | Latch the ended session independently of the prop; block frame sampling, pickup, power and teleport until a different session starts. Mounted test sends end, rerenders with active still true, then attempts those actions. |
| P1 | A completed Krimsky comparison and saved record callback remain available while the session becomes hidden or ends. The callback could award completion without a valid current frame. | Record requires current frame validity and excludes preview. Captured comparison is frozen at runtime. Regression invokes the saved callback during visibility loss and after end, before the parent exits. |
| P2 | Worth/Maddox mirror image and distance letter are placed behind the opaque mirror front. Rotating the Worth face also puts its dots behind its own backing. | Move both displays in front of the mirror and layer reflected dots on the viewing side. Ray intersections against mounted scene geometry verify the visible dot/letter is the first surface from the patient side. |
| P2 | Stereo patient page is rotated 180°, while examiner controls use the same unrotated X positions. Left/right controls refer to different physical circles. | Mirror examiner-side X placement and retain patient-relative names. Mounted test compares world positions of each named patient circle and its response control. |
| P2 | Unsupported release after picking up a near card/Thorington card can silently restore a lesson socket and its readiness. Only sensory-prefixed sockets were excluded from fallback. | All tagged lesson sockets return to the equipment home on unsupported release. Ordinary supported-surface fallback remains. Tests cover both library and Practice near sockets. |
| P2 | Maddox light off/on or teleport/visibility interruption occurs between sampled frames. The begun 20Δ trial could remain active. | Invalidate unfinished trial synchronously at interruption and on light/axis/fixation changes; retain captures and permit menu adjustments. Mounted regression tests between-frame light switching, visibility and a real floor-pad trigger route. |
| P2 | Teleport offsets the reference origin without accounting for the headset's physical horizontal displacement. The viewer misses the requested pad. | Use viewer pose in the original floor reference to calculate each offset, preserving height. Initial arrival waits for a valid viewer pose. Tests cover repeated destinations, physical displacement and loss of viewer tracking. |
| P2 | Grip remains tracked while the target-ray pose is unavailable. Three.js retains the old ray transform, allowing stale aim to satisfy technique. | Require both controller poses; hide tools, interrupt technique and stop trigger lighting on partial tracking loss. Mounted regression retains grip tracking while dropping only the ray, then requires a fresh trigger edge after recovery. |
| P2 | Library near stand intersects the numbered card and leaves the reading card unsupported at its fitted position. | Select support height for the reading-card lower edge or Thorington handle base. No socket/working-distance change. |
| P3 | Older motor adapters accept active+preview together even though preview should never route tracked input. | Explicitly exclude preview in their runtime and rendered active controls. Existing preview-isolation regressions accompany shared runtime checks. |
| P3 | Cover, Krimsky and 4Δ base-out select prism settings without displaying them on the canonical bar. | Pass selected power/base to the shared instrument label; the gold-ringed cell remains an illustrative selected cell. |
| P3 | README introduction lists only nine XR modules, and completion documentation incorrectly says work is uncommitted. | Synchronize current full-library availability and committed baseline. |

## Suspected issues ruled out

- The occluder head already aligns with the declared 0.121 m working point: its outer rotation also rotates the inner translation. A mounted actual-mesh regression verifies this. Its geometry was preserved.
- Thorington's first vertical tick begins outside the 6 mm aperture. Rays through the centre and eight interior samples from both faces encounter no card geometry. No aperture rewrite was needed.
- The native Three.js XR camera uses its pose directly when the scene camera has no parent; the desktop camera's initial height is not added to headset height.
- Patient OD/OS remains OD at negative world X and OS at positive world X. Stereo circle labels remain patient-relative; examiner controls share those physical locations.

No case findings, authored response numbers, clinical interpretation, rubric, Test evidence, or scoring were changed. Clinical status remains draft.

## Verification and remaining acceptance

Regression tests use the actual mounted room/models/controllers with a simulated device, renderer and canvas. They exercise all new library walkthroughs and shared consultation/Practice behavior, including ordered endpoints, release-to-record, fitting changes, interruption, cancellation and duplicate completion. The review checks passed: 159 focused tests across 20 files (including rerunning the 10 mounted-controller files after the final tracking fix), production build, and `git diff --check`. The user excluded the full unit suite and Playwright.

Physical Quest 3S testing remains necessary for controller grip/aim axes, reach and fitting comfort, stereo page orientation/readability, mirror target visibility, near motion, headset entry/re-entry, guardian/tracking interruption, released-tool recording, frame rate and sustained comfort. GPU materials, shadows and actual headset text cannot be accepted from ray tests alone. Chunk-size warnings persist (Three.js approximately 704 kB, app entry approximately 529 kB); headset performance remains unmeasured. Small numbered targets, head-following panels and illustrative selected-cell prism optics remain device/reviewer checks.

The original checkout is on `vr-improvements`. Earlier original-checkout edits remain in stash `34f6d056a41f8f444642884ed4970ba207bfdc4b`, with Git history/stash preserved in `/private/tmp/opto-vr-safety-20261005.bundle`. Review fixes do not apply, drop or overwrite that stash. Servers and tunnels remain off; nothing is deployed.
