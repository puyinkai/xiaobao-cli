/**
 * Format a result payload to stdout in one of three flavours:
 *
 *   toon   (default)   TOON (Token-Oriented Object Notation) — ~30-50% fewer
 *                     tokens on uniform array-of-objects (LLM context optimization)
 *   json              pretty JSON, agent-friendly and human-OK
 *   table             not implemented in 0.1.0 — falls back to pretty JSON
 *                     (a v0.1.x target; pure cosmetic, doesn't affect agent flow)
 *
 * Errors / logs MUST NOT go through here — use stderr (console.error) so
 * agents parsing stdout don't break.
 */

import { encode as toonEncode } from '@toon-format/toon';

export type OutputFormat = 'json' | 'toon' | 'table';

export function writeResult(data: unknown, format: string | undefined = 'toon'): void {
  const fmt = normalize(format);
  const text =
    fmt === 'toon' ? toonEncode(data) :
    /* json | table (table TODO) */ JSON.stringify(data, null, 2);
  process.stdout.write(text + '\n');
}

/** Print an error structurally to stdout (still parseable) and human hint to stderr. */
export function writeError(error: unknown, format: string | undefined = 'toon'): void {
  const payload = serializeError(error);
  const fmt = normalize(format);
  const text =
    fmt === 'toon' ? toonEncode(payload) :
    JSON.stringify(payload, null, 2);
  process.stdout.write(text + '\n');
  // stderr: structured for humans — error code + message + actionable hint.
  const err = payload as { error?: string; message?: string; hint?: string };
  const errCode = err.error;
  const msg = err.message;
  if (msg) {
    process.stderr.write(`error: ${errCode ? `[${errCode}] ` : ''}${msg}\n`);
  }
  if (err.hint) {
    process.stderr.write(`hint:  ${err.hint}\n`);
  }
}

function normalize(f: string | undefined): OutputFormat {
  if (f === 'json') return 'json';
  if (f === 'table') return 'table';
  // default: unset / 'toon' / unrecognized → toon
  return 'toon';
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    // Prefer the custom `code` (set by NotAuthenticatedError / NoActiveProjectError)
    // over the generic `Error` constructor name — gives agents & humans a
    // semantic error key like "NOT_AUTHENTICATED" instead of "Error".
    // `hint` (if present) is exposed as a separate field so agents can read
    // it without parsing the message.
    const codeAttr = (error as Error & { code?: string }).code;
    const hint = (error as Error & { hint?: string }).hint;
    return {
      error: codeAttr ?? (error.name !== 'Error' ? error.name : 'Error'),
      message: error.message,
      ...(hint ? { hint } : {}),
    };
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
