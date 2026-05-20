/**
 * `xiaobao-cli api <METHOD> <path>` — generic authenticated wangxiaobao API call.
 *
 * Bearer token auto-injected, 401 → refresh + retry once. Use for endpoints
 * not yet wrapped as a dedicated command, or for one-off API exploration.
 */

import { defineCommand } from 'citty';
import { xbApiFetch, type HttpMethod } from '../core/api-client';
import { resolveConfig } from '../core/config';
import { loadActiveProject } from '../core/project-store';
import { tenantProjectHeaders } from '../output/headers';
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
        '自定义 headers，`K1=V1&K2=V2` 或 `K=V,K=V`。与默认注入的 tenant/project headers 合并（同名 key 用户传入优先）',
    },
    'no-default-headers': {
      type: 'boolean',
      description:
        '不要默认注入 X-Tenant-Id / X-Project-Id headers（默认会按当前激活项目自动注入，调 /ai-open/* 开箱即用）',
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
      // Auto-inject tenant/project headers from active-project unless caller
      // opts out. Plugin `xiaobao_api` doesn't do this (host-managed plugin
      // tool, no global state assumption); CLI does because the user already
      // ran `project use` to set context, and most /ai-open/* endpoints
      // require these headers (returning 500 if missing, which is unfriendly).
      // User-supplied --headers override (same key in user input wins).
      let mergedHeaders: Record<string, string> | undefined;
      const userHeaders = parseKV(args.headers);
      if (!args['no-default-headers']) {
        const active = await loadActiveProject();
        if (active) {
          mergedHeaders = { ...tenantProjectHeaders(active), ...(userHeaders ?? {}) };
        }
      }
      mergedHeaders = mergedHeaders ?? userHeaders;

      const result = await xbApiFetch(config, method as HttpMethod, String(args.path), {
        query: parseKV(args.query),
        body,
        headers: mergedHeaders,
      });
      writeResult(result, args.format);
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
