import { useEffect, useRef } from "react";
import type { Session, ClinicalCase } from "../domain/types";
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
                history: c.historyFacts
                  .filter((f) => s.revealedFactIds.includes(f.id))
                  .map((f) => ({ id: f.id, domain: f.domain, answer: f.answer })),
                findings: s.results,
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
