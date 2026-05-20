/**
 * HTTP client for wangxiaobao open API endpoints.
 *
 * Port of openclaw-xiaobao/src/core/api-client.ts. Difference: no
 * workspaceDir param (CLI has a single global token, not per-agent
 * isolation).
 *
 * Adds `Authorization: Bearer <accessToken>` automatically and retries once
 * with a refreshed token on HTTP 401.
 */

import { refreshToken } from './device-flow';
import { isAccessTokenValid, readToken, writeToken, type StoredToken } from './token-store';
import type { ResolvedConfig } from './config';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface ApiCallOptions {
  query?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
  /** Per-call timeout, defaults to 30s. */
  timeoutMs?: number;
}

export interface ApiResult {
  status: number;
  ok: boolean;
  data: unknown;
}

export class NotAuthenticatedError extends Error {
  code = 'NOT_AUTHENTICATED' as const;
  hint = '运行 `xiaobao-cli auth login` 完成 OAuth device flow 登录。';
  constructor() {
    super('当前未登录或 token 已过期');
    this.name = 'NotAuthenticatedError';
  }
}

async function ensureAccessToken(config: ResolvedConfig): Promise<string> {
  const cached = await readToken();
  if (isAccessTokenValid(cached)) return cached!.access_token;
  if (cached?.refresh_token) {
    const data = await refreshToken(config, cached.refresh_token);
    const saved = await writeToken(data);
    return saved.access_token;
  }
  throw new NotAuthenticatedError();
}

function buildUrl(apiBase: string, path: string, query?: Record<string, string>): string {
  const url = new URL(path, apiBase);
  if (query) {
    for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  }
  return url.toString();
}

async function doFetch(
  url: string,
  method: HttpMethod,
  token: string,
  opts: ApiCallOptions,
): Promise<{ resp: Response; parsed: unknown }> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
    ...(opts.headers ?? {}),
  };
  let body: string | undefined;
  if (opts.body != null && method !== 'GET' && method !== 'DELETE') {
    if (typeof opts.body === 'string') {
      body = opts.body;
    } else {
      body = JSON.stringify(opts.body);
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';
    }
  }
  const resp = await fetch(url, {
    method,
    headers,
    body,
    signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
  });
  const ct = resp.headers.get('content-type') || '';
  const parsed: unknown = ct.includes('application/json') ? await resp.json() : await resp.text();
  return { resp, parsed };
}

/**
 * Make an authenticated request to the wangxiaobao API. Refreshes on 401 once.
 */
export async function xbApiFetch(
  config: ResolvedConfig,
  method: HttpMethod,
  path: string,
  opts: ApiCallOptions = {},
): Promise<ApiResult> {
  const url = buildUrl(config.apiBase, path, opts.query);
  let token = await ensureAccessToken(config);
  let { resp, parsed } = await doFetch(url, method, token, opts);

  if (resp.status === 401) {
    const cached = await readToken();
    if (cached?.refresh_token) {
      const refreshed = await refreshToken(config, cached.refresh_token);
      const saved = await writeToken(refreshed);
      token = saved.access_token;
      ({ resp, parsed } = await doFetch(url, method, token, opts));
    }
  }

  return { status: resp.status, ok: resp.ok, data: parsed };
}

export async function getCurrentToken(): Promise<StoredToken | null> {
  return readToken();
}
