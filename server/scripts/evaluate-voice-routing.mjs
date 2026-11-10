import { GeminiIntentBridge } from "../voice/semantic.mjs";
import { routeDeterministic } from "../voice/router.mjs";
import { routingCorpus, corpusContext, commandIntent } from "../voice/routingCorpus.mjs";

// Explicit opt-in only: uses synthetic corpus text and existing Vertex credentials.
// No microphone, app session, deployment, findings or stored learner data.
const live = process.argv.includes("--live");
const argument = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.split("=").slice(1).join("=");
const projectId = argument("project") || process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT;
const config = { projectId, location: process.env.VERTEX_LOCATION || "global", routerModel: argument("model") || process.env.VERTEX_ROUTER_MODEL || "gemini-3.1-flash-lite" };
if (live && !projectId) throw new Error("Live evaluation requires --project=PROJECT or GOOGLE_CLOUD_PROJECT.");
async function main() {
if (process.argv.includes("--list-models")) {
  if (!projectId) throw new Error("Model discovery requires --project=PROJECT.");
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ vertexai: true, project: projectId, location: config.location });
  const pager = await ai.models.list({ config: { queryBase: true, pageSize: 100 } });
  for await (const model of pager) if (/gemini.*flash/i.test(model.name || "")) console.log(model.name);
  return;
}
const limit = Math.min(routingCorpus.length, Number(argument("limit") || routingCorpus.length));
const requestedCases = new Set((argument("cases") || "").split(",").filter(Boolean).map(Number));
const selectedCases = routingCorpus.map((item, index) => ({ item, index })).filter(({ index }) => !requestedCases.size || requestedCases.has(index + 1)).slice(0, limit);
let local = 0, deferred = 0, correct = 0, wrong = 0;
const latencies = [];
for (const { index, item } of selectedCases) {
  const context = corpusContext(item);
  const deterministic = routeDeterministic(item.text, context, `eval-${index}`);
  let intent = commandIntent(deterministic), factIds = deterministic?.factIds;
  if (deterministic) local++;
  else {
    deferred++;
    if (!live) continue;
    let bridge;
    const startedAt = performance.now();
    try {
      const call = await new Promise((resolve, reject) => {
        const timer = setTimeout(() => { bridge.close(); reject(new Error("Semantic classification exceeded 8000 ms")); }, 8000);
        bridge = new GeminiIntentBridge(config, {
          onFunction: call => { clearTimeout(timer); resolve(call); },
          onError: error => { clearTimeout(timer); reject(error); },
        });
        bridge.start(context).then(() => bridge.sendText(item.text)).catch(error => { clearTimeout(timer); reject(error); });
      });
      latencies.push(performance.now() - startedAt);
      const key = call.args?.actionId || call.args?.instructionId;
      intent = key ? `action:${key}` : call.name === "route_history" ? "history"
        : call.name === "social_reply" ? `social:${call.args.socialId}`
          : call.args.replyId === "rephrase" ? "clarify" : call.args.replyId === "unknown" ? "unsupported" : `reply:${call.args.replyId}`;
      factIds = call.args?.factIds;
    } catch (error) {
      latencies.push(performance.now() - startedAt);
      intent = `error:${error.code || error.status || error.name}`;
      console.log(JSON.stringify({ case: index + 1, providerError: error.code || error.status || error.name }));
    } finally { bridge?.close(); }
  }
  const passed = intent === item.expected && (!item.factIds || JSON.stringify([...factIds || []].sort()) === JSON.stringify([...item.factIds].sort()));
  if (passed) correct++;
  else {
    wrong++;
    console.log(JSON.stringify({ case: index + 1, lesson: item.lessonId || "test", expected: item.expected, actual: intent, expectedFactIds: item.factIds, actualFactIds: factIds }));
  }
}
latencies.sort((a, b) => a - b);
console.log(JSON.stringify({ mode: live ? "live-hybrid" : "local-only", cases: selectedCases.length, local, deferred, evaluated: correct + wrong, correct, wrong,
  semanticP50Ms: latencies.length ? Math.round(latencies[Math.floor(latencies.length * .5)]) : null,
  semanticP95Ms: latencies.length ? Math.round(latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * .95))]) : null }));
if (wrong) process.exitCode = 1;

}
main().catch(error => { console.error(JSON.stringify({ error: error.code || error.status || error.name, detail: String(error.message).slice(0, 1000), message: "Live intent evaluation could not finish; check network, ADC credentials and model access." })); process.exitCode = 1; });
