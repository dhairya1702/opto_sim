import { describe, expect, it } from "vitest";
import lessons from "../../shared/practiceVoice.json" with { type: "json" };
import { routeDeterministic } from "./router.mjs";
import { semanticRequest } from "./semantic.mjs";

// Deliberately independent of catalog examples: exercise every action with its
// full lesson allowlist, so a wrong competing action cannot hide behind a stub.
const cases = {
  motility: {
    "follow-target": ["Could you track my torch with just your eyes?", "Follow my finger without moving your head"],
    "report-symptoms": ["Are you seeing double at all?", "Did that cause you any discomfort?"],
  },
  bruckner: { "fixate-light": ["Please focus directly on this torch", "Watch my penlight for me"] },
  hirschberg: { "fixate-light": ["Keep your eyes on my light please", "Can you look straight at this penlight?"] },
  krimsky: {
    "fixate-light": ["Focus on this torch for me", "Watch the penlight please"],
    "examiner-close-right-eye": ["I'll shut my own right eye now", "I'm viewing with only my left eye"],
    "examiner-close-left-eye": ["I'm shutting my left eye", "Let me look using only my right eye"],
    "examiner-open-both-eyes": ["I'm reopening both my eyes", "Restore the binocular examiner view please"],
  },
  "cover-uncover": { "fixate-target": ["Watch that distant letter for me", "Keep your eyes on this near spot"] },
  "alternate-cover": { "fixate-target": ["Focus on this distant letter please", "Keep watching the near target"] },
  worth: {
    "target-on": ["Switch on the Worth four dot display", "Could you turn the dot target on please?"],
    "target-off": ["Switch off the Worth four dot display", "Please turn that dot target off"],
    "fixate-target": ["Focus on those coloured lights", "Keep watching these dots please"],
    "request-report": ["Can you describe the colours and positions of those dots?", "Where do the lights appear to be?"],
  },
  stereopsis: {
    "fixate-target": ["Focus on the circles in this book", "Keep watching these circles"],
    "request-report": ["Does any of them pop out toward you?", "Can you tell me which one looks closer?"],
  },
  "four-prism": { "fixate-target": ["Keep that letter single for me", "Focus on this isolated letter please"] },
  maddox: {
    "fixate-target": ["Keep your eyes on this point light", "Watch my torch please"],
    "request-report": ["Is the red line above or below the light?", "Are the streak and light lined up now?"],
  },
  thorington: {
    "fixate-target": ["Focus on this card for me", "Keep watching the central light"],
    "request-report": ["Can you tell me which number the red streak crosses?", "Which side of the centre is that line on?"],
  },
  npc: {
    "fixate-target": ["Let me know as soon as you start seeing two", "Keep this target clear and single for me"],
    "request-report": ["Are you seeing two now?", "Does the target still look single?"],
  },
  "horizontal-distance": {
    "fixate-target": ["Let me know when it gets fuzzy, splits in two and comes back together", "Please report first sustained blur, diplopia and recovery to single"],
    "request-report": ["Are you seeing double right now?", "Have the letters gone blurry?"],
  },
  "vertical-distance": {
    "fixate-target": ["Let me know when you see double and when it is single again", "Please report sustained diplopia and recovery to single"],
    "request-report": ["Does it look double at the moment?", "Can you see a single target now?"],
  },
  "horizontal-near": {
    "fixate-target": ["Say when the near target blurs, doubles, then becomes single again", "Please report first sustained blur, diplopia and recovery to single"],
    "request-report": ["Are the near letters still clear?", "Has the target become double now?"],
  },
  facility: {
    "fixate-target": ["Keep this target clear and single please", "Focus on this letter for me"],
    "report-clear": ["Do the letters look clear again?", "Has it become single and clear yet?"],
  },
  "push-up": {
    "fixate-target": ["Let me know when those letters go fuzzy and stay that way", "Please report the first blur that remains blurred"],
    "request-report": ["Have the letters become blurry?", "Are you able to see the line clearly?"],
  },
  "minus-lens": {
    "fixate-target": ["Say when the print starts looking blurry and stays blurry", "Please report the first blur that remains blurred"],
    "request-report": ["Does the print look fuzzy now?", "Are those letters still clear?"],
  },
  relative: {
    "fixate-target": ["Keep the letters clear and single and let me know when they blur", "Please report the first blur that remains blurred"],
    "request-report": ["Are you still seeing the letters clearly?", "Has the line gone fuzzy?"],
  },
  "accommodative-facility": {
    "fixate-target": ["Keep these letters clear for me", "Focus on the print on this card"],
    "report-clear": ["Do those letters look clear again?", "Can you make the print clear yet?"],
  },
};

const contextFor = lessonId => ({ mode: "practice", lessonId, allowedActions: lessons[lessonId].map(a => a.id) });

describe("whole-library natural voice coverage", () => {
  it("covers every declared action in all 20 lessons with independently written paraphrases", () => {
    expect(Object.keys(cases).sort()).toEqual(Object.keys(lessons).sort());
    expect(Object.keys(cases)).toHaveLength(20);
    for (const [lessonId, actions] of Object.entries(lessons)) {
      expect(Object.keys(cases[lessonId]).sort(), lessonId).toEqual(actions.map(a => a.id).sort());
      for (const action of actions) {
        expect(action.description.length, `${lessonId}:${action.id}`).toBeGreaterThan(30);
        expect(semanticRequest(contextFor(lessonId)).systemInstruction).toContain(action.description);
      }
    }
  });
  for (const [lessonId, actions] of Object.entries(cases)) {
    for (const [actionId, phrases] of Object.entries(actions)) {
      it.each(phrases)(`${lessonId} / ${actionId}: %s`, transcript => {
        expect(routeDeterministic(transcript, contextFor(lessonId), "u"))
          .toMatchObject({ kind: "practice-action", lessonId, actionId });
      });
      it(`${lessonId} / ${actionId} respects removal from the allowlist`, () => {
        const context = contextFor(lessonId);
        context.allowedActions = context.allowedActions.filter(id => id !== actionId);
        for (const transcript of phrases) {
          expect(routeDeterministic(transcript, context, "u")?.actionId).not.toBe(actionId);
        }
      });
    }
  }
  it.each(["push-up", "minus-lens", "relative", "npc", "horizontal-distance", "vertical-distance", "horizontal-near"])("keeps instructions distinct from current reports in %s", lessonId => {
    expect(routeDeterministic("Let me know when the target becomes double or blurry", contextFor(lessonId), "u")?.actionId).toBe("fixate-target");
    expect(routeDeterministic("Is the target blurry or double now?", contextFor(lessonId), "u")?.actionId).toBe("request-report");
  });
  it("starts following for a combined follow-and-report instruction", () => {
    expect(routeDeterministic("Follow my light and tell me if you notice double vision", contextFor("motility"), "u")?.actionId).toBe("follow-target");
  });
  it("does not confuse look/light words inside a report question with fixation", () => {
    expect(routeDeterministic("Where does the red line look relative to the light?", contextFor("maddox"), "u")?.actionId).toBe("request-report");
  });
  it.each(Object.keys(lessons))("lets unfamiliar requests with a greeting reach semantic routing in %s", lessonId => {
    expect(routeDeterministic("Hi Arun, could you concentrate on the thing I am holding?", contextFor(lessonId), "u")).toBeNull();
  });
  it.each(["maddox", "thorington", "npc", "horizontal-distance", "vertical-distance", "horizontal-near", "push-up", "minus-lens", "relative", "stereopsis"])("does not interpret copied colour questions as reports in %s", lessonId => {
    expect(routeDeterministic("What colours are the dots?", contextFor(lessonId), "u")?.kind).not.toBe("practice-action");
  });
  it.each(["Close your right eye", "Close Arun's left eye", "Use the patient's right eye"])("keeps Krimsky examiner controls separate from patient instructions: %s", transcript => {
    expect(routeDeterministic(transcript, contextFor("krimsky"), "u")?.kind).not.toBe("practice-action");
  });
});

const testContext = { mode: "test", allowedFacts: [], allowedActions: ["look-straight", "follow-target", "fixate-target", "report-symptoms", "read-chart", "dim-room", "restore-room"] };
it.each([
  ["look-straight", "Gaze forward for me please"],
  ["follow-target", "Could you track my torch with your eyes?"],
  ["fixate-target", "Please focus directly on this spot"],
  ["report-symptoms", "Are you experiencing any discomfort?"],
  ["read-chart", "Can you name those letters on the near card?"],
  ["dim-room", "Could you lower the ambient lighting?"],
  ["restore-room", "Please restore normal room lighting"],
])("Test supports natural %s requests", (id, transcript) => {
  const command = routeDeterministic(transcript, testContext, "u");
  expect(command?.instructionId || command?.actionId).toBe(id);
});
