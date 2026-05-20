/**
 * Format a result payload to stdout in one of three flavours:
 *
 *   json   (default)   pretty JSON, agent-friendly and human-OK
 *   toon              TOON (Token-Oriented Object Notation) — ~30-50% fewer
 *                     tokens on uniform array-of-objects (LLM context optimization)
 *   table             not implemented in 0.1.0 — falls back to pretty JSON
 *                     (a v0.1.x target; pure cosmetic, doesn't affect agent flow)
 *
 * Errors / logs MUST NOT go through here — use stderr (console.error) so
 * agents parsing stdout don't break.
 */

import { encode as toonEncode } from '@toon-format/toon';

export type OutputFormat = 'json' | 'toon' | 'table';

export function writeResult(data: unknown, format: string | undefined = 'json'): void {
  const fmt = normalize(format);
  const text =
    fmt === 'toon' ? toonEncode(data) :
    /* json | table (table TODO) */ JSON.stringify(data, null, 2);
  process.stdout.write(text + '\n');
}

/** Print an error structurally to stdout (still parseable) and a hint to stderr. */
export function writeError(error: unknown, format: string | undefined = 'json'): void {
  const payload = serializeError(error);
  const fmt = normalize(format);
  const text =
    fmt === 'toon' ? toonEncode(payload) :
    JSON.stringify(payload, null, 2);
  process.stdout.write(text + '\n');
  const hint = (payload as { message?: string }).message;
  if (hint) process.stderr.write(`error: ${hint}\n`);
}

function normalize(f: string | undefined): OutputFormat {
  if (f === 'toon') return 'toon';
  if (f === 'table') return 'table';
  return 'json';
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { error: error.name, message: error.message };
  }
  if (error && typeof error === 'object') {
    const obj = error as Record<string, unknown>;
    const errorKey =
      (obj.code as string | undefined) ?? (obj.error as string | undefined) ?? 'UNKNOWN';
    const message =
      (obj.message as string | undefined) ??
      (obj.status != null ? `HTTP ${obj.status}` : null) ??
      String(errorKey);
    return {
      error: errorKey,
      message,
      ...(obj.status != null ? { status: obj.status } : {}),
      ...(obj.body != null ? { details: obj.body } : {}),
    };
  }
  return { error: 'UNKNOWN', message: String(error) };
}
