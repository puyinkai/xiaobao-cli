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

import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
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
  hint = '运行 `xiaobao-cli auth login --no-wait` 发起登录，授权后运行 `xiaobao-cli auth login --resume` 完成。';
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


interface RawResponse {
  status: number;
  contentType: string;
  text: string;
}

/**
 * Single HTTP(S) request on Node's native http/https modules with
 * `agent: false` — no connection pool, a fresh TCP connection per request,
 * closed when the response ends (same behavior as curl). This avoids the
 * intermittent "fetch failed" caused by undici's keep-alive pool reusing a
 * connection the server has already half-closed.
 */
function requestOnce(
  url: string,
  method: HttpMethod,
  headers: Record<string, string>,
  body: string | undefined,
  timeoutMs: number,
): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const fn = u.protocol === 'http:' ? httpRequest : httpsRequest;
    const req = fn(u, { method, headers, agent: false }, (res) => {
      const chunks: Buffer[] = [];
      res.on('data', (c: Buffer) => chunks.push(c));
      res.on('end', () =>
        resolve({
          status: res.statusCode ?? 0,
          contentType: String(res.headers['content-type'] ?? ''),
          text: Buffer.concat(chunks).toString('utf8'),
        }),
      );
      res.on('error', reject);
    });
    req.setTimeout(timeoutMs, () => {
      const e = new Error(`request timeout after ${timeoutMs}ms: ${method} ${url}`) as Error & { code: string };
      e.code = 'XB_TIMEOUT';
      req.destroy(e);
    });
    req.on('error', reject);
    if (body != null) req.write(body);
    req.end();
  });
}

/**
 * Retry transient network errors (ECONNRESET / EPIPE / connection refused…)
 * with backoff 200ms → 400ms → 800ms, max 3 retries. Timeouts and HTTP error
 * responses are NOT retried.
 */
async function requestWithRetry(
  url: string,
  method: HttpMethod,
  headers: Record<string, string>,
  body: string | undefined,
  timeoutMs: number,
): Promise<RawResponse> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 200 * 2 ** (attempt - 1)));
    try {
      return await requestOnce(url, method, headers, body, timeoutMs);
    } catch (err) {
      lastErr = err;
      if ((err as { code?: string }).code === 'XB_TIMEOUT') throw err;
    }
  }
  throw lastErr;
}

async function doFetch(
  url: string,
  method: HttpMethod,
  token: string,
  opts: ApiCallOptions,
): Promise<{ status: number; ok: boolean; parsed: unknown }> {
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
  const raw = await requestWithRetry(url, method, headers, body, opts.timeoutMs ?? 30_000);
  const parsed: unknown = raw.contentType.includes('application/json') && raw.text
    ? JSON.parse(raw.text)
    : raw.text;
  return { status: raw.status, ok: raw.status >= 200 && raw.status < 300, parsed };
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
  let result = await doFetch(url, method, token, opts);

  if (result.status === 401) {
    const cached = await readToken();
    if (cached?.refresh_token) {
      const refreshed = await refreshToken(config, cached.refresh_token);
      const saved = await writeToken(refreshed);
      token = saved.access_token;
      result = await doFetch(url, method, token, opts);
    }
  }

  return { status: result.status, ok: result.ok, data: result.parsed };
}

export async function getCurrentToken(): Promise<StoredToken | null> {
  return readToken();
}
