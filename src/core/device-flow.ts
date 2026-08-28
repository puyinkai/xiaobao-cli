/**
 * OAuth 2.0 Device Authorization Grant (RFC 8628) client.
 *
 * Copied verbatim from openclaw-xiaobao/src/core/device-flow.ts — this module
 * is host-agnostic (no OpenClaw imports), so it ports as-is.
 */

import { basicAuth, type ResolvedConfig } from './config';
import type { TokenResponse } from './token-store';

const POLL_HARD_DEADLINE_MS = 10 * 60 * 1000; // never poll longer than 10 min total

export interface DeviceAuthorizationResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete?: string;
  expires_in: number;
  interval?: number;
}

interface ErrorBody {
  error?: string;
  error_description?: string;
  [key: string]: unknown;
}

function authHeaders(config: ResolvedConfig): Record<string, string> {
  return {
    Authorization: `Basic ${basicAuth(config.clientId, config.clientSecret)}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    Accept: 'application/json',
  };
}

async function postForm<T>(url: string, headers: Record<string, string>, body: URLSearchParams): Promise<T> {
  const resp = await fetch(url, { method: 'POST', headers, body: body.toString() });
  const ct = resp.headers.get('content-type') || '';
  const parsed: unknown = ct.includes('application/json') ? await resp.json() : await resp.text();
  if (!resp.ok) {
    throw { code: 'HTTP_ERROR', status: resp.status, body: parsed, url };
  }
  return parsed as T;
}

/** RFC 8628 §3.1 */
export async function initiateDeviceAuthorization(config: ResolvedConfig): Promise<DeviceAuthorizationResponse> {
  const data = await postForm<DeviceAuthorizationResponse>(
    `${config.authBase}/oauth2/device_authorization`,
    authHeaders(config),
    new URLSearchParams({ scope: config.scopes }),
  );
  for (const f of ['device_code', 'user_code', 'verification_uri', 'expires_in']) {
    if (data[f as keyof DeviceAuthorizationResponse] == null) {
      throw {
        code: 'DEVICE_AUTH_BAD_RESPONSE',
        message: `Missing field '${f}' in device_authorization response`,
        body: data,
      };
    }
  }
  return data;
}

/**
 * RFC 8628 §3.4 — ONE token-endpoint attempt. `'pending'` / `'slow_down'`
 * mean "not yet"; anything else terminal is thrown. Shared by the blocking
 * poll loop and by `auth status` (which must return within seconds).
 */
export async function exchangeDeviceCode(
  config: ResolvedConfig,
  deviceCode: string,
): Promise<TokenResponse | 'pending' | 'slow_down'> {
  const url = `${config.authBase}/oauth2/token`;
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    device_code: deviceCode,
  });
  const resp = await fetch(url, { method: 'POST', headers: authHeaders(config), body: body.toString() });
  const parsed = (await resp.json()) as TokenResponse | ErrorBody;
  if (resp.ok) return parsed as TokenResponse;

  const err = (parsed as ErrorBody).error;
  if (err === 'authorization_pending') return 'pending';
  if (err === 'slow_down') return 'slow_down';
  if (err === 'access_denied') {
    throw { code: 'ACCESS_DENIED', message: 'User declined authorization', body: parsed };
  }
  if (err === 'expired_token') {
    throw { code: 'EXPIRED_TOKEN', message: 'Device code expired before user approved', body: parsed };
  }
  throw { code: 'TOKEN_POLL_FAILED', status: resp.status, body: parsed };
}

/** RFC 8628 §3.4 — poll the token endpoint until success / denial / expiry. */
export async function pollForToken(
  config: ResolvedConfig,
  deviceCode: string,
  intervalSeconds: number,
  expiresInSeconds: number,
): Promise<TokenResponse> {
  const serverDeadline = Date.now() + expiresInSeconds * 1000;
  const hardDeadline = Date.now() + POLL_HARD_DEADLINE_MS;
  let pollIntervalMs = Math.max(1, intervalSeconds) * 1000;

  while (Date.now() < Math.min(serverDeadline, hardDeadline)) {
    await sleep(pollIntervalMs);
    const result = await exchangeDeviceCode(config, deviceCode);
    if (result === 'pending') continue;
    if (result === 'slow_down') {
      pollIntervalMs += 5_000;
      continue;
    }
    return result;
  }
  throw {
    code: 'TIMEOUT',
    message: 'Device authorization expired before completion',
    expires_in: expiresInSeconds,
  };
}

/** RFC 6749 §6 */
export async function refreshToken(config: ResolvedConfig, refresh: string): Promise<TokenResponse> {
  const data = await postForm<TokenResponse>(
    `${config.authBase}/oauth2/token`,
    authHeaders(config),
    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refresh }),
  );
  if (!data.refresh_token) data.refresh_token = refresh;
  return data;
}

/** RFC 7009 — best-effort refresh-token revocation. */
export async function revokeRefreshToken(config: ResolvedConfig, refresh: string): Promise<boolean> {
  try {
    const resp = await fetch(`${config.authBase}/oauth2/revoke`, {
      method: 'POST',
      headers: authHeaders(config),
      body: new URLSearchParams({ token: refresh, token_type_hint: 'refresh_token' }).toString(),
    });
    return resp.ok;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
