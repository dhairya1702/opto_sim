// Match bounded concepts, rather than requiring an exact sentence. Uncertain
// wording is left to the turn-scoped semantic router, never guessed by edit distance.
export const normalize = value => value.toLowerCase().replace(/[’']/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
const target = "(?:lights?|penlight|torch|finger|target|dots?|letters?|circles?|booklet|line|card|chart|spot)\\b";
const gap = "(?: [a-z]+){0,5} ";
const patterns = {
  "follow-target": [new RegExp(`\\b(?:follow|track)${gap}${target}`), /\b(?:move your eyes (?:along )?with|follow it|follow this|track it)\b/],
  "fixate-target": [new RegExp(`\\b(?:look|looking|focus|fixate|stare|watch|watching)${gap}${target}`), /\bkeep (?:your )?eyes on\b/],
  "fixate-light": [new RegExp(`\\b(?:look|looking|focus|fixate|stare|watch|watching)${gap}(?:light|penlight|torch)\\b`)],
  "look-straight": [/\b(?:look|gaze|focus) (?:straight |right )?(?:ahead|forward)\b/, /\b(?:look|looking|gaze|focus)\b.*\b(?:distance|far away|over my shoulder)\b/],
  "report-symptoms": [/\b(?:any|notice|experiencing|feel|feeling|having|report|tell me)\b.*\b(?:symptoms?|pain|discomfort|double|diplopia|hurts?)\b/, /\b(?:does it hurt|are you seeing double)\b/],
  "read-chart": [new RegExp(`\\b(?:read|name|identify)${gap}(?:chart|letters?|line|card)\\b`)],
  "request-report": [/\b(?:what (?:can|do) you see|tell me what you (?:can )?see|describe what you see|report now)\b/],
  "report-clear": [/\b(?:is|are|can|does|do|has|have)\b.*\b(?:clear(?:ly)?|single)\b/],
  "target-on": [/\b(?:turn|switch|put) on\b.*\b(?:target|worth|dots?)\b/, /\b(?:turn|switch|put)\b.*\b(?:target|worth|dots?)\b.*\bon\b/, /\b(?:activate|illuminate|light up)\b.*\b(?:target|worth|dots?)\b/],
  "target-off": [/\b(?:turn|switch|put) off\b.*\b(?:target|worth|dots?)\b/, /\b(?:turn|switch|put)\b.*\b(?:target|worth|dots?)\b.*\boff\b/, /\b(?:deactivate|extinguish)\b.*\b(?:target|worth|dots?)\b/],
  "examiner-close-right-eye": [/\b(?:close|shut|closing|shutting) my (?:own )?right eye\b/, /\b(?:use|using|view|viewing|look|looking)\b.*\b(?:only my|my) (?:own )?left eye(?: only)?\b/],
  "examiner-close-left-eye": [/\b(?:close|shut|closing|shutting) my (?:own )?left eye\b/, /\b(?:use|using|view|viewing|look|looking)\b.*\b(?:only my|my) (?:own )?right eye(?: only)?\b/],
  "examiner-open-both-eyes": [/\b(?:open|opening|reopen|reopening) (?:both (?:of )?my|my two|my) eyes\b/, /\b(?:restore|return to|use)\b.*\bbinocular (?:examiner )?view\b/],
  "dim-room": [/\b(?:dim|darken)\b.*\b(?:room|lights?|lighting)\b/, /\b(?:reduce|lower)\b.*\b(?:room|ambient)\b.*\b(?:light|lighting|illumination)\b/],
  "restore-room": [/\b(?:brighten|restore)\b.*\b(?:room|lights?|lighting)\b/, /\b(?:increase|raise)\b.*\b(?:room|ambient)\b.*\b(?:light|lighting|illumination)\b/],
};

const endpointLessons = new Set(["npc", "horizontal-distance", "vertical-distance", "horizontal-near", "push-up", "minus-lens", "relative"]);
const futureReport = /\b(?:tell me|let me know|say|notify me|report)\b.*\b(?:when|if|as soon as)\b.*\b(?:blur\w*|fuzz\w*|doubl\w*|single|diplopia|clear|two)\b|\breport (?:the )?(?:first|sustained|blur|double|diplopia)\b/;
const currentClarity = /\b(?:is|are|has|have|does|do|can)\b.*\b(?:clear(?:ly)?|blurr\w*|fuzzy|double|single|two|diplopia)\b/;
const reportPatterns = {
  worth: [/\b(?:how many|what|which|where|describe|tell me)\b.*\b(?:dots?|lights?|colou?rs?|positions?)\b/],
  stereopsis: [/\b(?:which|what|does|is|are|tell me)\b.*\b(?:circles?|raised|closer|stands? out|pops? out)\b/],
  maddox: [/\b(?:where|which|what|does|is|are|tell me)\b.*\b(?:line|streak)\b/],
  thorington: [/\b(?:where|which|what|does|is|are|tell me)\b.*\b(?:number|side|streak|line)\b/],
};

export function uncertainInstruction(q) {
  // A head-still instruction may naturally accompany a positive eye instruction.
  const withoutHeadInstruction = q.replace(/\b(?:dont|do not) move your head\b/g, "");
  return /\b(?:dont|do not|not|never|stop|instead|rather than|cant|cannot|couldnt|unable|what happens if|if i ask)\b/.test(withoutHeadInstruction);
}

export function nonExecutableSpeech(transcript) {
  const q = normalize(transcript);
  if (/[“”"]/.test(transcript) || /\b(?:if i said|if i asked|what would|what happens if|for example|suppose|imagine)\b/.test(q)) return true;
  if (/^(?:i|he|she|the patient) (?:cant|cannot|couldnt|am unable|is unable) (?:follow|track|look|focus|see|read)\b/.test(q)) return true;
  return /^(?:please )?(?:dont|do not|never|stop) (?:follow|track|look|fixate|switch|turn)\b/.test(q)
    && !/\b(?:but|instead|actually|rather|leave|keep)\b/.test(q) && !/[,;]/.test(transcript);
}

export function needsSemanticRouting(transcript, q, context) {
  if (uncertainInstruction(q)) return true;
  if (/[“”"]/.test(transcript) || /\b(?:actually|instead|rather|correction|i mean|i meant|sorry|suppose|imagine|for example|i said|i told|if i said|if i asked|if you were|what if|should|would it|what would|how do i|how can i|why|explain)\b/.test(q)) return true;
  if (/\b(?:on)\b/.test(q) && /\boff\b/.test(q)) return true;
  if (/\b(?:close|shut|use|using|view|viewing)\b/.test(q) && /\bright\b/.test(q) && /\bleft\b/.test(q)) return true;
  // The Test encounter currently exposes room power only. "Target lights off"
  // must not silently become a room-light action through the "lights off" alias.
  if (context.mode === "test" && /\b(?:target|penlight|torch|instrument|scope)\b/.test(q) && /\b(?:on|off|dim|brighten|switch|activate|deactivate)\b/.test(q)) return true;
  return false;
}

const movingFixationRequest = q => /\b(?:watch|watching|eyes on|look at)\b.*\b(?:as|while|wherever)\b.*\b(?:move|moving|moves|go|goes)\b/.test(q);
const trackingRequest = q => /\b(?:follow|track)\b/.test(q) || movingFixationRequest(q);

export function matchesIntent(actionId, q, phrases = [], lessonId) {
  if (uncertainInstruction(q)) return false;
  if (actionId === "follow-target" && movingFixationRequest(q)) return true;
  if (actionId.startsWith("fixate-") && trackingRequest(q)) return false;
  if (actionId === "fixate-light" && /\bkeep (?:your )?eyes on\b.*\b(?:light|penlight|torch)\b/.test(q)) return true;
  if (lessonId && actionId === "fixate-target") {
    if (endpointLessons.has(lessonId) && futureReport.test(q)) return true;
    if (/\bkeep\b.*\b(?:target|letters?|line|it|this)\b.*\b(?:clear(?:ly)?|single)\b/.test(q)) return true;
  }
  if (actionId === "request-report") {
    if (futureReport.test(q)) return false;
    if ((reportPatterns[lessonId] || [currentClarity]).some(pattern => pattern.test(q))) return true;
  }
  if (actionId === "report-clear" && futureReport.test(q)) return false;
  // Equivalent determiners and polite insertions should not change intent.
  // Examiner-eye ownership must remain explicit; "your eye" is the patient's.
  const canonical = value => (actionId.startsWith("examiner-") ? value : value.replace(/\b(?:my|this|that|these|those|a|an)\b/g, "the")).replace(/\bplease\b/g, "").replace(/\s+/g, " ").trim();
  const text = ` ${canonical(q)} `;
  return phrases.some(phrase => text.includes(` ${canonical(phrase)} `)) || (patterns[actionId] || []).some(pattern => pattern.test(q));
}

