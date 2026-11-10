import lessons from "../../shared/practiceVoice.json" with { type: "json" };

// Synthetic utterances only. Expected intents are independent of the matcher.
// No patient findings or answer-key values are sent to the classifier.
const practice = (lessonId, text, expected, semantic = false) => ({ lessonId, text, expected, semantic });
export const routingCorpus = [
  practice("motility", "Would you mind keeping an eye on this torch as I move it around?", "action:follow-target"),
  practice("motility", "Just your eyes please, let them go wherever my finger goes", "action:follow-target"),
  practice("motility", "Don't move your head, just follow this", "action:follow-target"),
  practice("motility", "Follow my finger, sorry, look at the light instead", "unsupported", true),
  practice("motility", "Don't follow my light", "clarify", true),
  practice("motility", "If I said follow the light, what would you do?", "clarify", true),
  practice("motility", "I can't follow the light", "clarify", true),
  practice("motility", "Any soreness or seeing two when you look to the sides?", "action:report-symptoms"),
  practice("bruckner", "Can you concentrate on the little bright spot I'm showing you?", "action:fixate-light"),
  practice("hirschberg", "Would you mind gazing straight into this torch for me?", "action:fixate-light"),
  practice("krimsky", "I'll use just my left eye to have a look", "action:examiner-close-right-eye"),
  practice("krimsky", "Let me shut my own left eye for a moment", "action:examiner-close-left-eye"),
  practice("krimsky", "I'll go back to looking through both of my eyes now", "action:examiner-open-both-eyes"),
  practice("krimsky", "Close your left eye please", "unsupported", true),
  practice("cover-uncover", "Stare at that letter over there and keep it in focus", "action:fixate-target"),
  practice("alternate-cover", "Keep your gaze on this spot while I cover each eye", "action:fixate-target"),
  practice("worth", "Can we get the four dot display lit up please?", "action:target-on"),
  practice("worth", "Please extinguish the Worth target", "action:target-off"),
  practice("worth", "Can you concentrate on the coloured points in front of you?", "action:fixate-target"),
  practice("worth", "Talk me through the number and colours of the points you can make out", "action:request-report"),
  practice("worth", "Switch the target on and off", "clarify", true),
  practice("worth", "Don't switch it off, turn the target on instead", "action:target-on", true),
  practice("stereopsis", "Keep your attention on the rings in this book", "action:fixate-target"),
  practice("stereopsis", "Which of these seems to come out of the page towards you?", "action:request-report"),
  practice("four-prism", "Concentrate on that single letter and try to keep it as one", "action:fixate-target"),
  practice("maddox", "Keep your attention on the bright point in front of you", "action:fixate-target"),
  practice("maddox", "Where's the red streak in relation to the dot?", "action:request-report"),
  practice("maddox", "Does it cut right through the dot or miss it?", "action:request-report"),
  practice("thorington", "Keep your gaze on the centre light in the card", "action:fixate-target"),
  practice("thorington", "Read out the digit that the red streak runs across and which side it's on", "action:request-report"),
  practice("npc", "Keep this as one image and let me know the moment it splits into two", "action:fixate-target"),
  practice("npc", "Is it still one or has it split into two?", "action:request-report"),
  practice("horizontal-distance", "Say when the detail gets fuzzy, then splits, and when the two images join up again", "action:fixate-target"),
  practice("horizontal-distance", "Are the two images back together yet?", "action:request-report"),
  practice("vertical-distance", "Let me know if you get two images and when they come together again", "action:fixate-target"),
  practice("vertical-distance", "Have the images joined back into one?", "action:request-report"),
  practice("horizontal-near", "Tell me the first time it becomes fuzzy, when it splits and when it's one again", "action:fixate-target"),
  practice("horizontal-near", "Is that close-up letter still sharp?", "action:request-report"),
  practice("facility", "Try to keep this as one sharp image", "action:fixate-target"),
  practice("facility", "Have you managed to get it sharp and single again?", "action:report-clear"),
  practice("push-up", "As I bring it closer, say the moment the print goes out of focus and won't clear", "action:fixate-target"),
  practice("push-up", "Isn't the print clear yet?", "action:request-report"),
  practice("minus-lens", "Let me know the first time you can't sharpen up those letters", "action:fixate-target"),
  practice("minus-lens", "Can you still make the writing out sharply?", "action:request-report"),
  practice("relative", "Try to keep the writing sharp and as one, and say when it stays fuzzy", "action:fixate-target"),
  practice("relative", "Does that look out of focus at the moment?", "action:request-report"),
  practice("accommodative-facility", "Keep concentrating on this print and try to bring it into focus", "action:fixate-target"),
  practice("accommodative-facility", "Can you get those letters back in focus now?", "action:report-clear"),
  practice("motility", "Please say the phrase \"follow the light\"", "clarify", true),
  practice("motility", "Follow the patient up next week", "unsupported"),
  practice("worth", "Do that thing now", "clarify"),
  practice("maddox", "Record normal and finish the test", "unsupported"),
  practice("stereopsis", "Pick whichever answer will give me a good score", "reply:results"),
  { text: "Keep watching this wherever I move it", expected: "action:follow-target" },
  { text: "Follow the light, actually no, keep looking at the stationary letter", expected: "action:fixate-target", semantic: true },
  { text: "Would you mind keeping your gaze over my shoulder?", expected: "action:look-straight" },
  { text: "Say the letters on the lowest row you can make out", expected: "action:read-chart" },
  { text: "Would you make the room a bit less bright please?", expected: "action:dim-room" },
  { text: "Can we have the normal room illumination back?", expected: "action:restore-room" },
  { text: "Turn the penlight off please", expected: "unsupported", semantic: true },
  { text: "Don't turn the room lights off, leave them on", expected: "action:restore-room", semantic: true },
  { text: "Which disease have you got?", expected: "reply:diagnosis" },
  { text: "When did this first begin?", expected: "history", factIds: ["onset:start"] },
  { text: "Is the trouble in just one eye or the pair?", expected: "history", factIds: ["laterality"] },
];

export function corpusContext(item) {
  return item.lessonId ? { mode: "practice", sessionId: "eval-practice", lessonId: item.lessonId, allowedActions: lessons[item.lessonId].map(a => a.id) } : {
    mode: "test", sessionId: "eval-test", caseId: "adult_distance_blur_01", caseVersion: "0.1-draft",
    allowedActions: ["look-straight", "fixate-target", "follow-target", "report-symptoms", "read-chart", "dim-room", "restore-room"],
    allowedFacts: [
      { id: "onset:start", patterns: ["when", "start", "how long", "gradual"] },
      { id: "laterality", patterns: ["one eye", "both eyes", "which eye"] },
    ],
  };
}

export function commandIntent(command) {
  if (!command) return null;
  if (["patient-instruction", "practice-action", "encounter-action"].includes(command.kind)) return `action:${command.actionId || command.instructionId}`;
  if (command.kind === "history") return "history";
  if (command.kind === "social") return `social:${command.socialId}`;
  if (command.kind === "patient-reply") return command.replyId === "rephrase" ? "clarify" : command.replyId === "unknown" ? "unsupported" : `reply:${command.replyId}`;
  return "clarify";
}
