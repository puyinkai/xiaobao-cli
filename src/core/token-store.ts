/**
 * Persistent token store, file-backed.
 *
 * CLI-specific layout vs the plugin (which stored under workspaceDir):
 *
 *   PRIMARY  ~/.xiaobao/token.json           (writes always here, mode 0600)
 *   FALLBACK ~/.openclaw/state/wangxiaobao/token.json (read-only legacy path)
 *
 * The fallback lets openclaw-xiaobao plugin users adopt the CLI without
 * re-running OAuth: first CLI invocation reads the existing plugin token,
 * any subsequent write (login / refresh / logout) lands in ~/.xiaobao/ and
 * the legacy path is left untouched.
 */

import { chmod, mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const PRIMARY_DIR = join(homedir(), '.xiaobao');
const PRIMARY_TOKEN_FILE = join(PRIMARY_DIR, 'token.json');
const LEGACY_TOKEN_FILE = join(homedir(), '.openclaw', 'state', 'wangxiaobao', 'token.json');
const PENDING_AUTH_FILE = join(PRIMARY_DIR, 'pending-auth.json');

/** Refresh proactively when access_token expires within this window. */
export const EXPIRY_BUFFER_MS = 60_000;

export interface StoredToken {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  token_type: string;
  scope?: string;
  expires_at: number;
  obtained_at: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  id_token?: string;
  token_type?: string;
  scope?: string;
  expires_in?: number;
}

/**
 * Read order: primary → legacy fallback. Returns null if both missing.
 */
export async function readToken(): Promise<StoredToken | null> {
  for (const f of [PRIMARY_TOKEN_FILE, LEGACY_TOKEN_FILE]) {
    if (!existsSync(f)) continue;
    try {
      const raw = await readFile(f, 'utf-8');
      return JSON.parse(raw) as StoredToken;
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw e;
    }
  }
  return null;
}

export async function writeToken(resp: TokenResponse): Promise<StoredToken> {
  const now = Date.now();
  const expiresIn = resp.expires_in ?? 7200;
  const tokenInfo: StoredToken = {
    access_token: resp.access_token,
    refresh_token: resp.refresh_token,
    id_token: resp.id_token,
    token_type: resp.token_type || 'Bearer',
    scope: resp.scope,
    expires_at: now + expiresIn * 1000,
    obtained_at: now,
  };
  await mkdir(PRIMARY_DIR, { recursive: true, mode: 0o700 });
  await writeFile(PRIMARY_TOKEN_FILE, JSON.stringify(tokenInfo, null, 2), { mode: 0o600 });
  try {
    await chmod(PRIMARY_TOKEN_FILE, 0o600);
  } catch {
    /* ignore */
  }
  return tokenInfo;
}

/**
 * Clears both the primary file AND the legacy openclaw fallback path. After
 * `xiaobao-cli auth logout` the user expects to be fully logged out across all
 * known token locations — leaving the legacy file behind would cause
 * `auth whoami` to read it back via fallback and report `logged_in: true`,
 * confusing users ("logout 没用"). The refresh_token is best-effort revoked
 * server-side before this call, so the legacy file is already a dead token.
 */
export async function clearToken(): Promise<void> {
  for (const f of [PRIMARY_TOKEN_FILE, LEGACY_TOKEN_FILE]) {
    try {
      await unlink(f);
    } catch (e: unknown) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
  }
}

export function isAccessTokenValid(token: StoredToken | null): boolean {
  return Boolean(token?.access_token && token.expires_at > Date.now() + EXPIRY_BUFFER_MS);
}

export function decodeJwtPayload(jwt: string | undefined): Record<string, unknown> | null {
  if (!jwt) return null;
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8')) as Record<string, unknown>;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pending device-authorization — backs the `auth login --no-wait` split-flow.
//
// `--no-wait` initiates the device flow then persists the device_code HERE
// (mode 0600) instead of returning it on stdout: the device_code is
// credential-grade and must never enter the agent's context. `auth login
// --resume` reads it back to exchange for a token. The file is short-lived —
// cleared on a successful login, on logout, and once the device_code expires.
// No legacy openclaw fallback: this is a CLI-only concept.
// ---------------------------------------------------------------------------

export interface PendingAuth {
  device_code: string;
  user_code: string;
  verification_uri: string;
  interval: number;
  /** epoch ms — the device_code is dead after this instant. */
  expires_at: number;
}

export async function writePendingAuth(p: PendingAuth): Promise<void> {
  await mkdir(PRIMARY_DIR, { recursive: true, mode: 0o700 });
  await writeFile(PENDING_AUTH_FILE, JSON.stringify(p, null, 2), { mode: 0o600 });
  try {
    await chmod(PENDING_AUTH_FILE, 0o600);
  } catch {
    /* ignore */
  }
}

export async function readPendingAuth(): Promise<PendingAuth | null> {
  if (!existsSync(PENDING_AUTH_FILE)) return null;
  try {
    return JSON.parse(await readFile(PENDING_AUTH_FILE, 'utf-8')) as PendingAuth;
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw e;
  }
}

export async function clearPendingAuth(): Promise<void> {
  try {
    await unlink(PENDING_AUTH_FILE);
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
  }
}

/** Thrown by `auth login --resume` when there is no usable pending device_code. */
export class NoPendingAuthError extends Error {
  code = 'NO_PENDING_AUTH' as const;
  hint =
    '先跑 `xiaobao-cli auth login --no-wait` 发起设备授权，在浏览器完成授权后再跑 ' +
    '`xiaobao-cli auth login --resume`。';
  constructor(message = '没有待完成的设备授权（从未发起，或 device_code 已过期）') {
    super(message);
    this.name = 'NoPendingAuthError';
  }
}
