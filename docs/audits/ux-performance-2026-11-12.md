# UX, performance and reliability audit — 12 November 2026

Second implementation follow-up: findings 5, 8, 9 and 10 are addressed locally: unchanged desktop highlights no longer commit state updates, patient loading has concurrency/deadlines/cleanup, static text responses support negotiated compression, and the encounter clock is isolated. Production header inspection confirmed the old deployment serves the 1,396,745-byte patient JSON without Content-Encoding. These changes have not been deployed; frame-time gains have not been measured on Quest.


Implementation follow-up: loading recovery, versioned patient assets, real asset/API 404s, duplicate desktop targeting removal, and hidden/terminal voice cleanup have now been implemented locally. These address findings 1–4, 6 and 7. The audit below records the original findings; remaining optimization candidates are unchanged. No deployment or E2E run was performed.


Scope: current working tree, including the pending Practice action-visibility and wall typography changes. Inspected active Practice/consultation entry, desktop and XR rendering/input, patient assets, voice lifecycle, and serving/deployment code. This is a broad source audit with a local HTTP probe, not a claim that every defect has been found. No application fixes, deployment changes, browser E2E tests or physical-headset measurements were performed for this audit.

Priority: P1 = fix first because it can break a flow or create substantial repeated work; P2 = worthwhile reliability/performance improvement; P3 = profile or make a product/cost decision first. Performance impacts below are not measured frame-time improvements.

## Confirmed defects and avoidable work

### 1. P1 — Mutable patient files receive one-year immutable caching

`server/index.mjs:20` treats every URL containing `/assets/` as content-hashed. `web/scene/DetailedPatient.tsx:11` loads fixed filenames under `/assets/patient-prototype/`.

Local HTTP reproduction: `/assets/patient-prototype/patient.json` returned `Cache-Control: public, max-age=31536000, immutable`. Updating that model or its textures at the same URLs can leave existing users on old assets for a year, potentially mixed with new application code.

Fix: content-hash/version the patient assets, or apply immutable caching only to hashed Vite output and require revalidation for fixed filenames. Verify a changed asset can be fetched after deployment without asking users to clear their cache.

### 2. P1 — Missing assets and APIs return successful HTML

`server/index.mjs:21` sends index.html for every unmatched request. Local reproduction: both `/assets/missing-audit-chunk.js` and `/api/missing-audit-route` returned HTTP 200 with `text/html`.

A stale page requesting a removed JavaScript chunk encounters a MIME/import error; API clients can receive HTML instead of a useful error. Fix: real 404s for missing assets/API routes, and limit the SPA fallback to intended HTML navigations. Verify JS, JSON and navigation failures separately.

### 3. P1 — Lazy-loading failures have no app-level recovery UI

`web/app/EntryApp.tsx:4` and `web/practice/PracticeMode.tsx:58` use lazy imports and Suspense without an enclosing error boundary. The scene boundaries are inside the modules being loaded, so they cannot catch those module-download failures.

Network interruption or an old tab after deployment can remove the usable app UI instead of offering recovery. Fix: boundaries around product and lesson loading, with a clear return/reload path. React.lazy caches rejected imports, so simply rerendering the same lazy component is not a reliable retry. Warn before a reload that discards a memory-only attempt.

### 4. P1 — Desktop navigation raycasts the whole scene twice per frame

`web/interaction/Controller.tsx:187` calls both targeting functions with `scene.children`; `web/interaction/targeting.ts:9` and `:26` each call recursive `intersectObjects`. The distance limit is applied after intersecting, rather than setting `ray.far` first.

This also runs in the Practice desktop clinic, where `PracticeVRClinic.tsx:122` supplies a no-op target callback and the shared runtime separately handles instrument rays. Detailed patient geometry increases the work further.

Fix: skip legacy station targeting in clinic-controls mode, derive station and exam from one hit list in consultation, set the ray distance before intersection, and maintain bounded candidate roots while preserving occlusion. Existing held-object filtering differs between the two helpers; unify that behavior deliberately. Verify occlusion, held tools and station selection with unit/mounted tests.

### 5. P2 — Idle desktop highlighting forces ~10 React updates/second

`web/interaction/useXRClinicRuntime.ts:499` calls `setHighlighted(aimed ? [aimed] : [])` every 0.1 seconds, creating a fresh array even for an unchanged target or no target. The XR branch already compares before updating at line 507.

Fix: use an equality-preserving updater for desktop too. Verify stable aim produces no highlight-state commits while target changes still update promptly. This is especially relevant because the runtime lives inside lesson components and their mirrors.

### 6. P1 — Hiding a tab does not release the voice microphone

`web/voice/useVoiceSession.ts:297` only handles `pagehide`. Ordinary tab switches normally produce `visibilitychange`, not `pagehide`. Unlike `usePatientReportSpeech.ts:20`, the live voice hook does not observe it. Capture/socket processing can therefore continue while the learner is away; this also contradicts the documented hidden-page behavior.

Fix: release on document-hidden and the appropriate XR session visibility transition, cancel pending startup, and require explicit re-enable on return. Verify a late permission response cannot restart capture after hiding.

### 7. P2 — Terminal voice disconnection leaves microphone resources open

At `web/voice/useVoiceSession.ts:206` and `:209`, normal server closure or exhausting retries only sets an error state. Worklet capture is disabled, but MediaStream tracks and AudioContext remain open. Full release exists at `:216` and is not called on those terminal paths.

Users can see an error while the browser still indicates microphone access, with unnecessary resource retention. Fix: release microphone/worklet/context on terminal failures while preserving the useful failure message; allow the next explicit Enable action to reacquire them. Keep temporary reconnect handling separate.

### 8. P2 — Patient loading is sequential and can remain pending indefinitely

`web/scene/DetailedPatient.tsx:18` fetches model JSON, then awaits every texture individually in the loop at `:26`. There is no request deadline. `web/ui/PatientAppearanceSelector.tsx:18` waits for all of it, and `PracticeMode.tsx:138` disables Start while loading. Users can select the current patient to recover, but there is no explicit timeout/retry state for a stalled request.

Fix: bounded parallel texture loading with complete failure cleanup, a deadline and clear fallback/retry controls. Preserve the existing stale-request guard and cached preloading. Aborting one UI request must not accidentally invalidate another consumer of a shared preload.

### 9. P2 — Server does not compress text responses

`server/index.mjs:20` serves files without compression middleware or precompressed-file negotiation. The local probe requested `gzip, br`; patient JSON returned 1,396,745 bytes with no Content-Encoding.

Fix: Brotli/gzip for JS, CSS and JSON, preferably precompressed static output; retain correct MIME types, Vary and caching. PNG/MP3 do not need redundant compression. This confirms origin behavior only: check the actual production response before attributing network time to it, because an upstream proxy may compress.

### 10. P2 — Encounter timer rerenders the entire TestEncounter every second

`web/app/App.tsx:350` updates root `tick` unconditionally, including briefing/debrief. `Room` and `ConsultationInterior` are ordinary components, with callback/element creation in the parent render.

Fix: isolate the elapsed-time display into its own component and only run its timer during an active encounter; stabilize expensive scene boundaries where profiling demonstrates benefit. Verify the displayed time and frozen final duration remain correct.

## Optimization and compatibility candidates requiring measurement

### 11. P2 — Detailed patient texture memory and startup work

Measured source files: the patient directory is about 9.8 MiB on disk, including JSON and three 2048×2048 PNG textures plus a 512×512 texture. Conventional RGBA8 GPU storage with mipmaps is approximately **65.3 MiB for those four textures alone**, excluding geometry, render targets and decoded CPU image memory; this is an estimate, not a GPU measurement. The model has 15,546 vertices and 27,326 triangles.

`DetailedPatient.tsx:70` additionally transforms positions and recomputes normals/morph normals on each mount. Profile on Quest, then compare reduced texture sizes, KTX2/Basis GPU-compressed textures and preprocessed geometry. WebP/AVIF reduces download bytes but ordinarily does not reduce decoded GPU texture memory. Preserve eye openings and clinical landmarks when optimizing.

### 12. P2 — AudioContext can start suspended without recovery

`web/voice/useVoiceSession.ts:248` creates AudioContext after network and permission awaits, then installs its worklet without checking state or calling resume. Browsers that suspend it under autoplay rules can show a connected/listening state while no PCM is produced.

This is a browser-dependent compatibility risk, not reproduced in this audit. Add explicit state handling and a user-gesture resume path, with actionable status. Test on target Quest and desktop browsers without starting capture automatically.

### 13. P3 — XR placement previews allocate state copies every frame

`useXRClinicRuntime.ts:189` calls the full `releaseConsultationTool` reducer to compute a preview; the frame loop invokes it for held-tool markers. `xrConsultationTools.ts:246` constructs a full tool-state copy even though preview rendering only needs the destination and whether it is a return.

Extract a pure destination resolver shared by preview and actual placement, leaving state mutation/copying for the deliberate release action. Reuse scratch storage only where ownership is clear. Measure garbage-collection/frame-time improvement; do not throttle physical procedure sampling.

### 14. P3 — Unchanged instrument and wall subtrees receive forced matrix updates

`useXRClinicRuntime.ts:410` rewrites resting instrument transforms and then calls `object.updateMatrixWorld(true)` for each instrument every frame. `XRPracticeFindingsBoard.tsx:42` forces a recursive world-matrix update each frame for a stationary wall panel.

Candidate fix: update resting transforms on placement revision changes and wall matrices when layout changes, retaining ordered updates for moving tools and panels before ray/technique sampling. Validate stale-ray and pose regressions before accepting any saving. The actual gain depends on subtree size.

### 15. P3 — Changing readout text creates new canvas textures

`web/scene/Models.tsx:145` keys textures by the complete text/color/layout and creates a new canvas/CanvasTexture when a readout changes. Cleanup disposes the old entry when its last reference leaves. `XRWorkingDistanceLabel.tsx:36` is one active changing-text consumer. Wall typography also raises small label resolution to panel tier in `XRClinicPanels.tsx:13`.

This is not an unbounded steady-state cache leak established by this audit. It is a possible source of texture uploads/allocation bursts while values change. Measure existing `sign texture`/`sign texels` counters; consider an owned reusable canvas texture for changing numbers or a glyph atlas, while preserving the requested readability and static-label sharing.

### 16. P3 — Production scale-to-zero trades cost for first-visit latency

`cloudbuild.yaml` and `scripts/deploy-gcp.sh` configure minimum instances 0 and maximum 2. After inactivity, a first visit may pay instance startup; shared classroom voice load can also meet per-instance session limits (`server/config.mjs:16`) and the two-instance cap.

Measure cold/warm response time and concurrent voice use before changing limits. A warm minimum instance has an ongoing cost; increasing caps needs a budget/concurrency decision, not an automatic code cleanup.

## Suggested order

1. Fix cache classification, real asset/API 404s and lazy-load recovery together.
2. Remove duplicate desktop raycasts and unchanged highlight updates.
3. Fix hidden/terminal voice cleanup and suspended-audio recovery.
4. Improve patient loading and static text compression.
5. Profile Quest frame times, draw calls, texture allocations and memory before changing previews, matrix updates or texture architecture.

## Validation and boundaries

- Local HTTP probe verified caching, missing-route behavior and lack of origin compression without using cloud credentials/providers.
- Asset dimensions/counts came directly from PNG headers and patient JSON.
- Existing previous-turn results: 1,125 unit/mounted tests passed, subsequent focused checks passed and build passed. Those results are a baseline, not proof that these newly identified issues are covered.
- No E2E run, no production mutation, no application changes for this audit. Existing uncommitted work was preserved.
- Memory-only session loss on reload is an explicit product constraint, not counted as a defect. Recovery UI should still explain it.
- Legacy `XRClinicTools.tsx` contains transmission materials, but it is documented as an inactive experiment; these were not reported as an active VR performance bug. Active XR raycasting already has an indexed registry and a per-frame cache, which should be preserved.
- Browser/headset accessibility, visual overlap, frame-time percentiles, cold-start timing and real classroom concurrency still need direct measurement. Code inspection cannot establish those results.
