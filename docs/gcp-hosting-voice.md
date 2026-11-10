# GCP hosting and hybrid voice runbook

Status: implementation draft. Clinical content is unchanged and remains unapproved. The reviewed canonical audio cache has been generated locally; physical Quest testing, end-to-end Google-service validation, and any later production cutover remain release gates.

## Architecture

One Node 22 Cloud Run service serves the Vite build and a same-origin voice WebSocket:

| Route | Purpose |
| --- | --- |
| `/`, `/assets/*` | Vite application and immutable hashed assets |
| `/healthz` | unauthenticated deployment health |
| `/api/voice/access` | open microphone-session bootstrap; issues a signed, secure, HTTP-only, same-site cookie |
| `/api/voice/live` | authenticated, origin-checked WebSocket for ephemeral audio and route messages |

Browser audio is mono 16-bit PCM from an `AudioWorklet`. The server streams it only to Speech-to-Text V2. Final STT text first uses the deterministic router, which returns an enum-only command to the browser. Unfamiliar or ambiguous finalized text opens a turn-scoped, text-only Vertex Gemini classification request, so a single utterance cannot execute once through each provider. At voice enable time, the browser loads only the canonical-audio index. After a command is accepted, it verifies the response text hash and server voice, then streams the matching MP3 from a versioned same-origin URL; the browser HTTP cache handles repeats without a catalogue-wide download or retained Blob copy. Compound history replies use runtime canonical speech because one asset cannot establish the identity of combined text. The browser acknowledges successful indexed playback so the server does not synthesize a duplicate. If a reviewed asset is unavailable or playback fails, server-side TTS remains the fallback. The classifier returns JSON containing one permitted intent and relevant history IDs, or clarification/unsupported. A strict server decoder rejects unknown IDs, unrelated fields, empty/duplicate/unauthored history IDs and malformed responses. It never generates patient speech. A turn without a validated classification within 8000 ms (including provider startup) uses the existing uncertainty response; provider errors return a canonical clarification immediately. `VERTEX_ROUTER_MODEL` selects the text model, defaulting to `gemini-3.1-flash-lite`. `VOICE_SEMANTIC_RESPONSE_LIMIT_MS` configures this deadline. New speech/context/closure invalidates the old request and late TTS. A client arbiter gives canonical audio precedence, drops late frames, and supports barge-in.

The reducer, authored case, physical encounter state, and existing Practice controls remain authoritative. A voice history turn carries validated fact IDs, original transcript, voice provenance, and an utterance ID. Replayed IDs are ignored. A Practice action invokes the mounted procedure’s registered gated action; a disabled/missing control produces a setup response and reveals no finding. Test patient instructions and environmental actions use separate enum-only function calls. Desktop examinations route patient instructions to their accessible controls; immersive consultation routes them to a scene handler that can acknowledge, request missing physical context, or activate only an implemented patient behavior. Immersive `dim-room` and `restore-room` actions change only the room's non-instrument lights, use visual state feedback rather than Arun's patient voice, and preserve the A/X control as a fallback. Held tools, patient-relative placement, and current room state remain client-side authorities and are never inferred by the model. Voice never writes observations, submits answers, completes a module, invents physiology, or changes scores.

## Privacy and failure boundaries

- The simulator and voice bootstrap are public. Voice still requires an explicit learner click and browser microphone permission.
- The browser receives a short-lived signed session cookie; the signing secret remains in Secret Manager. The cookie limits WebSocket admission but is not user authentication.
- WebSocket origin, context enums, fact/action IDs, JSON/audio sizes, per-IP concurrency, global concurrency, session duration, and audio inactivity are validated.
- Logs contain route class, timing, duration, coarse IP family, error codes, and content-free unmatched/fallback events only. They do not contain audio, utterance text, canonical replies, or transcripts.
- Audio, transcripts, and conversation state are not persisted server-side. Runtime TTS has only a bounded in-memory cache.
- STT failure reports an actionable error and requires re-enabling voice or typed controls; Gemini failure leaves deterministic routing and the uncertainty fallback; TTS failure leaves the visual transcript/typed UI. Microphone denial never blocks typed use.
- Voice controls exist only inside an active desktop or immersive attempt. The mode selector, Practice library, lesson overview, VR preflight, and Test briefing do not expose microphone access. VR preflight records the preference but acquires nothing until the immersive session attaches. Leaving a Practice attempt, native headset exit, rendering failure, lesson change, completing Test, exiting a mode, or manually muting closes the WebSocket, audio graph, and microphone tracks.

## Local voice testing

`npm run dev` starts only the Vite client. The client uses same-origin `/api/voice/access` and `/api/voice/live` URLs, and `vite.config.ts` does not proxy them to Cloud Run. Voice controls are always included, but they require the same-origin Node voice backend to connect.

Run the production-style Node server locally instead:

```sh
# One-time local Google Cloud authentication
gcloud auth application-default login
gcloud auth application-default set-quota-project opto-simulator-dhairya

npm run build

# This process serves both the built client and its same-origin voice routes
VOICE_COOKIE_SECRET='local-development-only-change-me' \
GOOGLE_CLOUD_PROJECT='opto-simulator-dhairya' \
PUBLIC_ORIGIN='http://127.0.0.1:8080' \
npm start
```

Open `http://127.0.0.1:8080`, choose voice in the Practice attempt setup, then enter an active desktop or immersive clinic and allow microphone access. Keep the browser URL identical to `PUBLIC_ORIGIN`; using `localhost` when the configured origin is `127.0.0.1` causes the origin-checked WebSocket upgrade to fail. Loopback HTTP is suitable for local microphone development, and the server omits the cookie's `Secure` attribute when the request is not HTTPS.

Local microphone audio follows browser → local Node server → Google Cloud APIs. It does not use the deployed Cloud Run service. Speech-to-Text and the Gemini text classifier use Application Default Credentials and the configured project, so local tests can consume project quota and incur charges. Fixed canonical replies play from `public/audio/voice` without a per-response TTS request; runtime Text-to-Speech is used only when a required cached asset is unavailable or a response is dynamic. Use a development-only cookie secret and never copy the production signing secret out of Secret Manager.

## Foundation and deployment

Run `scripts/setup-gcp.sh` while authenticated as `dhairya.lalwani2001@gmail.com`. It prefers project `opto-simulator-dhairya`, falls back to `opto-simulator-dhairya-514231`, links `My Billing Account`, enables Cloud Run/Build, Artifact Registry, Vertex AI, Speech-to-Text, Text-to-Speech, Secret Manager and Billing Budgets, creates the repository/signing secret/IAM grants, and creates the project-filtered $25 monthly budget at 50%, 90%, and 100% thresholds.

Deploy the application and voice backend together:

```sh
./scripts/deploy-gcp.sh
```

The service is public, in `us-central1`, scales to zero, has at most two instances, and uses a 60-minute Cloud Run request timeout. Voice enforces a 30-minute application session and five-minute audio inactivity limit. Before a live demonstration, temporarily keep one instance warm:

```sh
gcloud run services update opto-platform --region=us-central1 --min=1
# return to scale-to-zero after the demonstration
gcloud run services update opto-platform --region=us-central1 --min=0
```

To refresh canonical speech after reviewed manifest text changes, authenticate to the target project, run the resumable quota-aware generator, and review `public/audio/voice/index.json` before any later deployment:

```sh
node server/scripts/generate-voice-assets.mjs
```

The generator reuses only an indexed file whose voice and text hash still match, checkpoints the index after every clip, and retries quota exhaustion with a delay. The manifest keys include case/lesson version so changed text cannot reuse stale audio. `Charon` is requested for Google-generated canonical audio; intent classification produces no audio. If Google changes voice/model availability, generation must fail visibly or use a reviewed replacement; do not silently change the patient voice.

## Rollout and acceptance

1. Deploy and verify `/healthz`, all typed workflows, station/WebGL fallback, and Quest immersive entry on the `run.app` HTTPS URL.
2. Enable Test voice. Verify paraphrases, compound questions, prohibited prompts, instructions, deterministic latency, Gemini fallback, barge-in, reconnection without answer replay, and typed fallback.
3. Validate all 20 Practice allowlists and technique/report gates, including at least one physical-device lesson from each family.
4. Complete physical Quest acceptance with both hands occupied, scope mode, XR exit/re-entry, tracking loss, network interruption, and no premature report/answer leakage.
5. Record content-free latency metadata. Target cached deterministic reply start within one second after utterance completion and free conversation within two seconds on normal demonstration Wi-Fi.
6. Only then document the Cloud Run URL as production. Retain the ChatGPT Sites URL as rollback until acceptance is signed off.

There is no custom domain, authentication/signup, database, analytics, RAG, stored recording, or persistent transcript in this release.

## Synthetic routing evaluation

Run `node server/scripts/evaluate-voice-routing.mjs` for offline checks of local matches and semantic deferrals. This checks that the fast path does not confidently select the wrong intent; it does not measure the LLM. The corpus contains only synthetic learner utterances, with independent expected intents covering all 20 Practice lessons and Test.

Opt in to model requests with `node server/scripts/evaluate-voice-routing.mjs --live --project=PROJECT`. This uses ADC and Google model quota but neither starts a microphone nor deploys or changes the hosted app. `--limit=2` is useful for an access/compatibility check; `--cases=5,6,7` reruns numbered failures; `--model=MODEL` tests an alternative classifier. `--list-models --project=PROJECT` lists published Flash names, which does not itself establish that every listed model is callable. The evaluator reports actual correct/incorrect selections and semantic latency; do not equate unit/schema validation with measured model accuracy.

Corrections, contradictions, hypothetical or quoted commands and instrument-light requests that could be mistaken for room lighting are deliberately deferred. Transcripts are sent only to the existing configured Google project; no new provider, persistence or learner-data logging is added. Physical readiness remains a browser-side procedure decision, not an LLM eligibility judgement.
