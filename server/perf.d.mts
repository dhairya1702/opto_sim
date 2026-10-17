import type { IncomingMessage, ServerResponse } from "node:http";

export function perfLogEnabled(env?: Record<string, string | undefined>): boolean;
export function isPrivateAddress(address: unknown): boolean;
export function sanitizePerfReport(body: unknown): Record<string, unknown> | null;
export function formatPerfReport(report: Record<string, unknown>, options?: { color?: boolean }): string;
export function createPerfHandler(options?: {
  enabled?: boolean;
  log?: (line: string) => void;
  color?: boolean;
  now?: () => number;
  maxPerSecond?: number;
}): (request: IncomingMessage, response: ServerResponse) => Promise<void>;
