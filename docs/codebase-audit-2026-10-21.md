# Opto code audit — 21 October 2026

This is a code-based audit, not clinical approval or a headset performance benchmark. No application behaviour was changed. The existing `main.py` modification was left untouched. E2E was excluded at the user's request; its initial attempted launch was blocked by the sandbox before browser tests ran.

Reviewed areas: session reducer/scoring, case findings, shared desktop/XR runtime, consultation and Practice session lifecycle, recording UI, representative accommodation/NPC/vergence procedures, shared graphics, voice client/server, and build/test configuration. This is a broad architectural and targeted implementation review, not a claim that every lesson branch has been exhaustively verified.

## Assessment

The separation of pure procedure logic, shared physical runtime, and lesson adapters is a useful foundation. Immutable captures, explicit recording, eye-specific results, tracking checks, and desktop alternatives are worth preserving. The most urgent work is lifecycle correctness and action idempotency, followed by rendering cost reduction and restoration of reliable regression coverage. Expanding the lesson library before that work would multiply the current maintenance burden.

Priority: P1 = address before wider product rollout; P2 = next foundation work; P3 = targeted improvement. “Confirmed” means directly supported by code, not necessarily reproduced on hardware. Performance findings identify concrete work the code performs; their contribution to actual headset lag remains to be measured.

## Confirmed correctness and lifecycle findings

### 1. P1 — Re-establishing fixation can strand an accommodative-facility run

Sources: `web/interaction/accommodativeFacilityProcedure.ts:65`, `:73`, `:105`; `web/practice/xr/AccommodationPracticeController.tsx:116`.

`establishFacilityFixation` accepts a running attempt and changes its phase to `ready`, retaining `startMs` and `presentedMs`. Sampling then stops advancing the timer because the phase is no longer `running`; starting again is rejected because `startMs !== null`. The menu's Establish fixation action remains enabled during the run, and voice fixation resolves to lesson actions too.

Trigger: start a valid 60-second run, then establish fixation again. The run cannot finish until explicitly restarted. Repeated instruction should be idempotent while running, or intentionally restart all relevant timer state. Apply phase guards in the pure transition as well as the UI.

### 2. P1 — Test VR startup can outlive the encounter

Sources: `web/app/App.tsx:162`, `:213`, `:356`; compare `web/practice/xr/PracticeVRClinic.tsx:79`.

Test awaits `requestSession` and `setSession` without checking whether the encounter was unmounted or cancelled while awaiting. Cleanup can only end a session already stored in the ref. Leaving while the request is pending allows its later resolution to store a new session and attach it to a stale renderer. An end event during `setSession` can also be followed by an unconditional `setXrActive(true)`.

Reuse the mounted/closing/session-identity contract already implemented for Practice. Check after every await, end late sessions, and only activate the matching live session.

### 3. P1 — Voice startup has cancellation and resource-cleanup races

Sources: `web/voice/useVoiceSession.ts:132`, `:164`, `:176`; `web/voice/VoiceControl.tsx:8`.

During asynchronous access/microphone/worklet setup, mute or unmount can run before resources are assigned to refs. Startup then continues, assigns the resources, resets `manuallyMuted` to false, and connects. If worklet loading fails after microphone acquisition, the catch block does not stop the locally acquired stream or close the local AudioContext. Retrying can accumulate resources.

Use a startup generation/cancellation token, a single in-flight startup, and cleanup of partially acquired local resources in failure/cancellation paths. Mute must invalidate pending startup and reconnect timers.

### 4. P1 — New voice sessions retain old playback generation numbers

Sources: `web/voice/useVoiceSession.ts:28`, `:95`, `:164`; `web/voice/outputArbiter.ts:12`; `server/voice/session.mjs:11`.

The client arbiter persists for the hook's lifetime; `stop()` does not reset its generation. Every new server `VoiceSession` resets its turn to zero. After mute/re-enable or reconnect, replies with smaller turn numbers are rejected by `startTurn` until the new session catches up. For example, after turn 10, early replies from a fresh connection can be silent.

Scope output generations to a connection/session epoch and ignore messages from old sockets. Resetting the counter alone is insufficient if late old-connection messages are still accepted.

### 5. P1 — One spoken instruction can execute twice

Sources: `server/voice/session.mjs:37`, `:47`, `:57`; `server/voice/google.mjs:58`.

STT deterministic routing generates one UUID. A semantic function call for the same speech generates another. `seenUtterances` therefore cannot deduplicate the two paths. Suppressing Gemini audio does not suppress function calls: `handle` invokes functions before checking `suppressed`.

This matters for state-changing Practice actions such as advancing a page or flipping a tool. Use one utterance/turn identity across both engines and allow only one accepted action resolution per utterance, with a deliberate policy for compound commands.

### 6. P1 — Late TTS is labelled as the current turn

Source: `server/voice/session.mjs:84`.

`canonical` awaits synthesis, then sends the result with the mutable `this.turn`. If the learner speaks again during synthesis, the old reply is tagged with the new turn and can interrupt or replace its response. This defeats the client arbiter's stale-turn protection.

Store the originating turn with each routed utterance, capture it before awaiting, and discard obsolete results. Treat command-result messages as consumable once; currently the same accepted utterance can request synthesis repeatedly because it remains in `seenUtterances`.

### 7. P2 — Semantic voice context stays tied to the initially opened lesson

Sources: `server/voice/google.mjs:35`, `:47`; `server/voice/session.mjs:29`, `:47`.

The Gemini connection builds function declarations and captures `context` once. Later context messages replace `VoiceSession.context`, but neither the declarations nor the callback's captured context change. Practice can keep a voice session while changing lesson. Deterministic routing then uses the new lesson while semantic routing uses the old lesson ID/actions, causing rejected or stale commands.

Validate every semantic action against current context and either rebuild the semantic session on lesson changes or use stable tool declarations with current-context validation. In-flight responses also need a context revision.

### 8. P2 — Voice backend startup can create resources after closure

Sources: `server/voice/session.mjs:32`, `:101`; `server/voice/google.mjs:10`, `:35`.

Bridge startup imports SDKs and opens connections asynchronously. Closing a session while these awaits are pending closes only resources already assigned; later startup can create an STT stream or Gemini session after `VoiceSession.closed` is set. Neither bridge start routine checks a closing generation before retaining the connection.

Make start/close an explicit lifecycle: mark the bridge closed synchronously, check after awaits, and immediately close late-created resources. Suppress callbacks after closure.

## Graphics and performance findings

### 9. P1 performance investigation — Full-scene raycasts run in the frame loop

Source: `web/interaction/useXRClinicRuntime.ts:475`, `:500`, `:530`.

Each `rayHit` traverses the visible scene for priority panels and otherwise recursively intersects the entire scene, then filters results. Visibility and `xrIgnoreRay` filtering happens after mesh intersection work. XR does this for visible controller rays; desktop also queries once for aim and again in the pointer loop. Detailed patient/equipment geometry participates unless it explicitly overrides raycasting.

Introduce registered interaction targets and simple hit proxies, a dedicated raycast layer, bounded ray distance, reusable result arrays, and reuse a hand's hit within a frame. Preserve intentional modal priority and occlusion semantics. This is a strong CPU optimization candidate; measure before and after on device.

### 10. P2 — Static decoration participates in dynamic shadow rendering

Sources: `web/scene/Models.tsx:15`, `:43`, `:225`; `web/scene/Room.tsx:131`; `web/practice/xr/PracticeVRClinic.tsx:115`.

Generic boxes/cylinders cast and receive shadows, including walls, blinds, trays and small decorative details. Both clinic canvases enable shadows and the room uses a live shadow-casting directional light. Standard materials also evaluate the room's additional lighting. There is no explicit low-cost XR quality tier.

Separate clinical visuals from decorative cost. Bake or simplify static room shading, make shadow casting opt-in, restrict dynamic casters to useful moving objects, and offer a low tier without dynamic shadows. Do not globally freeze shadows while moving objects still depend on them.

### 11. P2 — XR labels use large independent canvas textures

Sources: `web/scene/Models.tsx:122`; `web/scene/XRClinicPanels.tsx:8`.

Every fitted XR label allocates a 1536-pixel-wide texture with a minimum height of 160. That minimum is about 0.94 MiB of raw RGBA storage per label, before driver/CPU copies. Labels are not shared across identical controls. Changing text recreates and uploads a texture; some status text updates at 10 Hz. Disposal is implemented, but allocation/upload churn remains.

Use physically appropriate resolution tiers, cached static labels or an atlas/SDF text system, and separate changing numeric values from static sentences. The current no-mipmap choice trades blur for potential minification shimmer; evaluate both text sharpness and aliasing on a headset.

### 12. P2 — Both product modes and the lesson graph load eagerly

Sources: `web/app/App.tsx:23`, `:32`; `web/practice/PracticeMode.tsx:23`; `vite.config.ts:28`.

Static imports pull in Test, Practice and their scene/lesson code before mode selection. Vendor chunk separation is not route/lesson lazy loading. The observed production build emitted roughly 736 kB application JS, 704 kB Three.js and 430 kB scene/vendor JS before compression; their combined gzip size is about 523 kB.

Lazy-load Test and Practice at the mode boundary, then lesson families/adapters. Keep the entry screen independent of Three.js. Preload only likely next modules. This improves startup/download/parse work; it does not by itself improve steady-state frame time.

### 13. P2 — Fixed rendering settings are not a headset performance budget

Sources: `web/practice/xr/PracticeVRClinic.tsx:96`, `:115`; `web/app/App.tsx:182`; `web/perf/PerfFrameProbe.tsx:17`.

Both XR entry paths use fixed foveation `.6`. Canvas DPR caps describe desktop rendering and are not an explicit XR framebuffer-resolution policy. The current probe measures JavaScript/render submission elapsed time, not completed GPU execution. A low reported render time can coexist with GPU-bound headset frames.

Add named quality tiers and set XR framebuffer scale before starting the session. Record frame intervals, missed-budget percentiles, draw calls, triangles and texture counts alongside CPU timings; use supported GPU/device profiling for GPU cost. Target 13.9 ms at 72 Hz or 11.1 ms at 90 Hz with headroom. These are frame budgets, not claims about current achieved FPS.

### 14. P3 — Avoidable React and allocation work remains in steady-state loops

Sources: `web/interaction/useXRClinicRuntime.ts:488`; `web/interaction/rotaryPrismProcedure.ts:43`; `web/scene/XRPracticeFindingsBoard.tsx:32`.

Desktop highlight state receives a fresh array every 100 ms even when unchanged, unlike XR's equality-checked branch. Rotary motion sampling copies/freezes a trace of up to 240 samples at sampling frequency. The static findings board forces recursive matrix updates every frame.

Use the existing XR equality approach for desktop highlighting; profile whether motion traces need all samples before replacing with bounded internal buffers/compact sufficient state; update static board matrices on layout changes. Preserve immutable final clinical captures and deterministic procedure outputs.

## Clinical assessment and product-contract concerns

### 15. P2 — Observation correctness is text equality, and management credit ignores it

Sources: `web/domain/engine.ts:132`, `:251`; `web/cases/adultDistanceBlur.ts:481`.

The reducer considers an observation correct only when the entire formatted string equals the authored string. This couples punctuation/formatting to clinical correctness. Management correction and follow-up credit use acquired subjective/fundus results without the accuracy filter used for interpretation. Consequently, inaccurate recorded findings can still support management credit. Repeating a completed result never replaces the initial observation.

The current rubric deliberately rewards examination selection separately, so this is a clinical/product decision requiring review, not permission to change weights automatically. Introduce typed observations with explicit numeric/category comparison and separate performed/interpreted/management-supported states. Decide whether and how corrected observations supersede earlier ones while preserving event provenance. Reconcile the case and clinical-review packet before changing scoring.

### 16. P2 — Voice service accepts client-defined authority and unverified TTS content

Sources: `server/index.mjs:42`, `:48`; `server/voice/validation.mjs:5`, `:14`; `server/voice/session.mjs:84`; `server/voice/google.mjs:89`.

The access endpoint issues a voice cookie without an entitlement check. Allowed facts/actions come from syntactically validated client context. Accepted command results provide speech text and cache keys; runtime synthesis caches by key rather than verifying the key's text. Repeated accepted results are not consumed once. Per-IP capacity also trusts the leftmost forwarded IP header without an explicit trusted-proxy policy.

For a public deployment, these are cost/abuse and spoken-content integrity weaknesses. A client can obtain access, create a routable utterance, and return arbitrary accepted speech under a chosen runtime cache key. Static assets may protect particular pre-generated keys, but do not fix the general trust boundary. Define public access/rate limits, derive clinical capabilities on the server, bind speech/cache keys to canonical content, consume results once, and establish trusted proxy handling. This does not require introducing learner accounts if public access is intended.

### 17. P2 — Regression coverage and contributor documentation disagree with current behaviour

Sources: `web/tests/xrKrimskyPractice.test.ts:18`, `web/interaction/xrKrimskyPractice.ts:69`; `web/tests/xrWorthLoop.test.ts:47`; `web/practice/xr/PracticeLessonUI.tsx:154`; supplied `AGENTS.md` current scope.

The already-run unit suite ended at **558 passing / 62 failing tests across 78 files** (11 failing files). This is not evidence of 62 product bugs. For example, Krimsky tests omit the now-required base answer; several harnesses search for `SUBMIT / CHECK` while the UI uses `SUBMIT`; coach assertions expect removed step counters. These early assertion failures prevent later workflow checks from executing.

Restore tests against deliberate current contracts, using stable semantic action IDs instead of presentation strings where appropriate. Preserve independent assertions for clinical geometry and recording gates. No checked-in `.github` CI workflow was found; this does not rule out external CI. Establish a required unit/build gate wherever CI runs.

The supplied contributor scope also says no network/AI/backend/speech recognition, while current code has Google STT/TTS, Gemini routing and an Express/WebSocket backend. Update architecture, operational requirements and data-flow documentation to match the actual product and its approved scope.

## Additional targeted follow-up

- Numeric domain boundaries: `submitAccommodativeFacility` coerces an empty string to zero. Current shared forms guard blank fields, but the pure function does not. Reject blank/non-finite inputs at every recording boundary, including voice/direct callers.
- Procedure phase invariants: audit repeated setup actions beyond facility. NRA/PRA's initial instruction/initial-clear transitions accept later phases and should have an explicit allowed-transition policy. Avoid relying on a hidden button as the only guard.
- NPC start dwell: `sampleNPC` preserves `startStableSinceMs` on a setup issue in the `start` phase. Some XR interruption paths reset it externally, but the pure procedure should itself invalidate dwell on invalid geometry. Exercise equivalent desktop and XR sequences.
- Voice preloading fetches the entire audio index concurrently and creates object URLs. Bound concurrency, preload lesson-relevant assets, and guard late completions after unmount. Client asset selection currently ignores `textHash`, so regenerated text can diverge from cached speech.
- Long voice sessions need explicit STT stream lifetime/recovery handling. Current error reporting can leave a degraded bridge without restarting it. Check actual provider limits against deployment configuration.
- Static/nonessential scenes continue rendering while Practice preflight is open. Consider demand rendering outside active interaction, with explicit invalidation for essential changes.
- Real-device visual acceptance remains necessary for pupil/reflex visibility, occluder placement, handheld readability, stereo per-eye view, near clipping, controller loss, comfortable panel reach, and 15–30 minute thermal behaviour. Source inspection cannot establish these.

## Recommended implementation order

1. Fix facility phase guards, Test XR cancellation, and voice startup/reconnect/turn ownership. Add focused transition/lifecycle regressions.
2. Restore the unit regression baseline without weakening clinical assertions. Separate test API changes from genuine implementation failures.
3. Restrict raycasts to registered targets; remove unnecessary decorative shadows; benchmark production scenes with voice off/on and panels closed/open.
4. Reduce label texture cost and avoidable renders, then introduce measured XR quality tiers. Keep clinically important eyes/reflexes readable at every tier.
5. Lazy-load modes/lesson families and bound voice asset preloading.
6. Resolve structured observation/scoring decisions with a clinician, strengthen backend authority/cost controls, and synchronize documentation.

Acceptance should cover cold load, idle clinic, both tools held, active procedure, recording panel, new case, tracking interruption, exiting/re-entering VR, switching lessons with voice enabled, and repeated setup commands. Record device/browser/build versions and p50/p95/p99 frame intervals. No hardware performance claim or clinical validation is made by this audit.

## Verification completed

- Production TypeScript/Vite build passed, with large-chunk warnings.
- Unit suite completed before the user's direction to concentrate on code: 558 passed, 62 failed. A focused Krimsky rerun confirmed the missing-base test/API mismatch.
- No E2E results are used in this audit.
- No dependencies, application code, clinical values or scoring weights were changed.
- `git diff --check` reports pre-existing trailing whitespace in the user's modified `main.py` at lines 55 and 109; it was left untouched.
