# Voice routing audit

Status: software audit and fixes; live STT, cloud semantic quality and physical Quest acceptance remain pending. These changes interpret existing commands and retain existing procedure gates, findings, recording rules and draft clinical status.

The first motility patch did not establish coverage of the entire library. A second audit inspected all 20 mounted shared-clinic lesson adapters, their `voiceIds`, published patient replies, instruction guidance, the shared phrase catalog, deterministic router, semantic tool declarations and Test instruction/room/history routes. The desktop and XR versions of these lessons use the same registered action boundary.

## Findings and changes

- All 39 declared Practice actions now have explicit, lesson-specific meanings in `shared/practiceVoice.json`. Semantic routing receives those meanings plus examples, not bare identifiers. Examples are illustrative, never required scripts.
- Copied dot/colour report examples were removed from stereopsis, Maddox, Thorington, vergence and accommodation lessons where they did not describe the procedure. Report matching now uses the active lesson's report subjects.
- Following, sustained fixation, current reports, future endpoint instructions, Worth target power and Krimsky examiner-eye changes accept natural variations. A future instruction such as “tell me when it blurs” remains distinct from “is it blurred now?”
- Report questions containing look/light words take precedence over incidental fixation matches. A combined follow-and-report instruction starts following; the existing symptom gate still controls the later symptom response.
- Krimsky own-eye controls retain examiner ownership. Patient-eye instructions do not select an examiner view.
- Standalone greetings still route locally; a greeting attached to an unfamiliar request no longer consumes that request before semantic interpretation.
- Test history semantic routing now includes each permitted fact's authored topic cues. Test instruction and room-light paraphrases are covered independently. No clinical responses are added by the router.

## Coverage by lesson

Each row has independent paraphrases for **every declared action**, tested with the lesson's complete allowlist. Separate checks cover removing each action from that allowlist.

| Lesson | Actions | Example now covered |
| --- | --- | --- |
| Motility | Follow; symptoms | “Could you track my torch with just your eyes?” |
| Bruckner | Light fixation | “Watch my penlight for me.” |
| Hirschberg | Light fixation | “Keep your eyes on my light please.” |
| Krimsky | Light fixation; both monocular examiner views; binocular view | “I'll shut my own right eye now.” |
| Cover–uncover | Target fixation | “Watch that distant letter for me.” |
| Alternating cover | Target fixation | “Keep watching the near target.” |
| Worth four dot | Target on/off; fixation; report | “Switch on the Worth four dot display.” |
| Stereopsis | Fixation; raised-circle report | “Does any of them pop out toward you?” |
| 4Δ base-out | Isolated-letter fixation | “Keep that letter single for me.” |
| Maddox rod | Fixation/report instruction; current report | “Are the streak and light lined up now?” |
| Modified Thorington | Fixation/report instruction; current report | “Which side of the centre is that line on?” |
| NPC | Clear/single instruction; current report | “Let me know as soon as you start seeing two.” |
| Horizontal distance vergence | Endpoint instruction; current report | “Please report first sustained blur, diplopia and recovery to single.” |
| Vertical distance vergence | Endpoint instruction; current report | “Please report sustained diplopia and recovery to single.” |
| Horizontal near vergence | Endpoint instruction; current report | “Say when the near target blurs, doubles, then becomes single again.” |
| Near vergence facility | Fixation; clarity report | “Do the letters look clear again?” |
| Push-up amplitude | Sustained-blur instruction; current report | “Please report the first blur that remains blurred.” |
| Minus-lens amplitude | Sustained-blur instruction; current report | “Say when the print starts looking blurry and stays blurry.” |
| NRA/PRA | Clear/single/blur instruction; current report | “Keep the letters clear and single and let me know when they blur.” |
| Accommodative facility | Fixation; clarity report | “Can you make the print clear yet?” |

`server/voice/paraphrases.test.mjs` verifies this coverage stays complete when the catalog changes. `server/voice/canonical.test.mjs` checks every catalog phrase, while `web/tests/practiceVoiceRegistry.test.ts` checks all lesson action gates, patient-only reports and report requests that must never flip equipment or record findings. Provider bridge tests inspect the semantic schema and intent descriptions; no live provider calls are needed for these software checks.

This is bounded intent recognition plus the existing turn-scoped semantic fallback, not a guarantee that arbitrary speech is understood. Microphone transcription accuracy, provider latency and the quality of unfamiliar semantic paraphrases require live testing. Unavailable or incomplete physical setup continues to return a technique-gate response even when the sentence is correctly recognised. Unsupported equipment actions and clinical facts remain unsupported.

## Structured semantic routing

The later routing hardening replaces Gemini Live audio fallback with `server/voice/semantic.mjs`, a cancellable text-only classifier using `VERTEX_ROUTER_MODEL` (default `gemini-3.1-flash-lite`). Clear local requests stay fast; unfamiliar phrasing, corrections and ambiguous matches use semantic interpretation. Output is a single allowlisted intent plus relevant history IDs. The strict decoder rejects invented identifiers, extra fields, duplicate or unknown facts and malformed output; clarification/unsupported use existing canonical replies. All patient speech and clinical state changes remain app-owned.

`server/voice/routingCorpus.mjs` adds 64 independent synthetic stress examples covering all 20 lessons and Test, including lay descriptions, negative percept questions, future instructions, corrections, reported/hypothetical speech, eye ownership and lighting distinctions. Offline evaluation checks that local matches are correct and other requests defer. Live opt-in evaluation measures the classifier itself, so mocked provider tests are not reported as semantic accuracy. See the runbook for commands and quota implications.

### Live synthetic check (2026-11-10)

Google project `opto-simulator-dhairya`, text model `gemini-3.1-flash-lite`, eight-second deadline. The initial complete 64-case hybrid evaluation selected 53 expected intents, with four intent/clarification-category errors and seven timeouts. These exposed correction handling, examiner/patient ownership and quoted-command mistakes. Explicitly incompatible actions are now excluded from the per-utterance schema; standalone negation, hypothetical/quoted commands and inability statements use canonical clarification without a model call. Credential/HTTP clients are reused without retaining conversation state.

After those changes, the 11 failed/timed-out examples passed a targeted live recheck (11/11). Classifier-path median was 740 ms and p95 1790 ms; this subset includes immediate non-executable clarifications. These are development-corpus results, not an independent accuracy estimate or a guarantee for arbitrary speech. A fresh complete clean run was not claimed. Microphone/STT, physical Quest and deployed-service-account validation remain pending. No deployment was performed.
