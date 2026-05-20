/**
 * `xiaobao-cli api <METHOD> <path>` — generic authenticated wangxiaobao API call.
 *
 * Bearer token auto-injected, 401 → refresh + retry once. Use for endpoints
 * not yet wrapped as a dedicated command, or for one-off API exploration.
 */

import { defineCommand } from 'citty';
import { xbApiFetch, type HttpMethod } from '../core/api-client';
import { resolveConfig } from '../core/config';
import { writeError, writeResult } from '../output/format';

const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']);

/** Parse `k1=v1&k2=v2` or `k=v,k=v` into a Record. */
function parseKV(input: string | undefined): Record<string, string> | undefined {
  if (!input) return undefined;
  const out: Record<string, string> = {};
  const pairs = input.includes('&') ? input.split('&') : input.split(',');
  for (const pair of pairs) {
    const trimmed = pair.trim();
    if (!trimmed) continue;
    const idx = trimmed.indexOf('=');
    if (idx < 0) continue;
    out[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export default defineCommand({
  meta: {
    name: 'api',
    description:
      'generic authenticated API call — 自动注入 Bearer + 401 自动 refresh（探索/调试用）',
  },
  args: {
    method: {
      type: 'positional',
      required: true,
      description: 'GET / POST / PUT / PATCH / DELETE',
    },
    path: {
      type: 'positional',
      required: true,
      description: 'API 相对路径，如 `/saas/v2/estate/tenant-and-estate/by-user-id`',
    },
    query: {
      type: 'string',
      description: '查询串，`k1=v1&k2=v2` 或 `k=v,k=v`',
    },
    body: {
      type: 'string',
      description: 'JSON body（POST/PUT/PATCH 用，传 JSON 字符串）',
    },
    headers: {
      type: 'string',
      description:
        '自定义 headers，`K1=V1&K2=V2` 或 `K=V,K=V`（如 X-Tenant-Id=...&X-Project-Id=...）',
    },
    'api-base': { type: 'string' },
    'auth-base': { type: 'string' },
    format: { type: 'string', default: 'json' },
  },
  async run({ args }) {
    try {
      const method = String(args.method).toUpperCase();
      if (!METHODS.has(method)) {
        writeError(
          { code: 'BAD_METHOD', message: `unknown method: ${args.method}` },
          args.format,
        );
        process.exit(2);
      }
      const config = resolveConfig({
        apiBase: args['api-base'],
        authBase: args['auth-base'],
      });
      let body: unknown;
      if (args.body) {
        try {
          body = JSON.parse(args.body);
        } catch {
          body = args.body; // pass through as raw string
        }
      }
      const result = await xbApiFetch(config, method as HttpMethod, String(args.path), {
        query: parseKV(args.query),
        body,
        headers: parseKV(args.headers),
      });
      writeResult(result, args.format);
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
