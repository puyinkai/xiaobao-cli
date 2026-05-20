/**
 * Shared utilities for CLI commands.
 *
 * Mirrors the helpers scattered across openclaw-xiaobao tool files
 * (toLocalDateTime / mergeUserIds), consolidated here so commands stay slim.
 */

/**
 * Normalize an LLM/human-provided datetime string to the format pierre's
 * Jackson deserializer expects (`yyyy-MM-dd HH:mm:ss`):
 *
 *   `2026-05-09T12:34:56`        → `2026-05-09 12:34:56`
 *   `2026-05-09T12:34:56.789`    → `2026-05-09 12:34:56`
 *   `2026-05-09T12:34:56+08:00`  → `2026-05-09 12:34:56`
 *   `2026-05-09 12:34:56`        → unchanged
 */
export function toLocalDateTime(input: string | undefined): string | undefined {
  if (!input) return input;
  return input
    .replace('T', ' ')
    .replace(/\.\d+/, '')
    .replace(/[+-]\d{2}:?\d{2}$/, '')
    .replace(/Z$/, '')
    .trim();
}

/**
 * Merge a single id + a list of ids, de-dup. Returns undefined when empty so
 * the upstream API treats it as "no filter" (not "filter to nothing").
 */
export function mergeUserIds(
  single: string | undefined,
  list: ReadonlyArray<string> | undefined,
): string[] | undefined {
  const merged: string[] = [];
  const seen = new Set<string>();
  const push = (v: string) => {
    if (!v) return;
    if (!seen.has(v)) {
      seen.add(v);
      merged.push(v);
    }
  };
  if (single) push(single);
  if (list) for (const v of list) push(v);
  return merged.length > 0 ? merged : undefined;
}

/** Split `"a,b,c"` → `["a", "b", "c"]`, trimmed, empties dropped. */
export function csvToArray(input: string | undefined): string[] | undefined {
  if (!input) return undefined;
  const arr = input
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  return arr.length > 0 ? arr : undefined;
}
