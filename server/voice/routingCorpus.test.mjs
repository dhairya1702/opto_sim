import { expect, it } from "vitest";
import { routingCorpus, corpusContext, commandIntent } from "./routingCorpus.mjs";
import { routeDeterministic } from "./router.mjs";
import { semanticRequest } from "./semantic.mjs";

it("includes open-ended/adversarial utterances for every Practice lesson and Test mode", () => {
  expect(new Set(routingCorpus.filter(c => c.lessonId).map(c => c.lessonId)).size).toBe(20);
  expect(routingCorpus.some(c => !c.lessonId)).toBe(true);
});
it.each(routingCorpus)("routes confidently or defers: $lessonId / $text", item => {
  const context = corpusContext(item);
  const command = routeDeterministic(item.text, context, "u");
  if (item.semantic) expect(command).toBeNull();
  if (command) {
    expect(commandIntent(command)).toBe(item.expected);
    if (item.factIds) expect(command.factIds).toEqual(item.factIds);
  }
  // Even deferred utterances can only map to an action actually offered in context.
  expect(semanticRequest(context).routes.has(item.expected)).toBe(true);
});
