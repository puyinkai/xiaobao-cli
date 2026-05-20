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
 * Only deletes the primary file. Legacy openclaw path is left intact so a
 * `xiaobao-cli auth logout` doesn't silently nuke the plugin's token.
 */
export async function clearToken(): Promise<void> {
  try {
    await unlink(PRIMARY_TOKEN_FILE);
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
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
