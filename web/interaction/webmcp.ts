import { useEffect, useRef } from "react";
import type { Session, ClinicalCase } from "../domain/types";
import { disclosedHistory } from "../patient/history";
type Registry = {
  registerTool: (
    tool: {
      name: string;
      title: string;
      description: string;
      inputSchema: object;
      annotations: { readOnlyHint: boolean };
      execute: (input: unknown) => unknown;
    },
    options: { signal: AbortSignal },
  ) => void | Promise<void>;
};
export function useNotebookTool(session: Session, c: ClinicalCase) {
  const current = useRef(session);
  current.current = session;
  useEffect(() => {
    const registry = (document as Document & { modelContext?: Registry }).modelContext;
    if (!registry?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        registry.registerTool(
          {
            name: "read_acquired_notebook",
            title: "Read acquired consultation findings",
            description:
              "Read only the history and examination findings already obtained in this attempt. Does not disclose hidden case information or perform an examination.",
            inputSchema: { type: "object", properties: {}, additionalProperties: false },
            annotations: { readOnlyHint: true },
            execute(input) {
              if (!input || typeof input !== "object" || Object.keys(input).length)
                throw new Error("Expected an empty object");
              const s = current.current;
              return {
                phase: s.phase,
                history: disclosedHistory(c, s.revealedFactIds)
                  .map(({ fact, answer, answered, total }) => ({ id: fact.id, domain: fact.domain, answer, answeredDetails: answered, totalDetails: total })),
                findings: s.results.map((result) => {
                  const {
                    expectedValue: _expectedValue,
                    observationAccurate: _observationAccurate,
                    ...finding
                  } = result;
                  if (result.observationSource !== "trainee") return finding;
                  const { refraction: _authoredRefraction, ...recordedFinding } = finding;
                  return recordedFinding;
                }),
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {
      /* Optional API; encounter remains independent. */
    }
    return () => lifecycle.abort();
  }, [c]);
}
