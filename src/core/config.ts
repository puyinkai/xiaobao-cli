/**
 * CLI configuration resolution — flat, host-agnostic version of
 * openclaw-xiaobao/src/core/config.ts.
 *
 * Sources (precedence high → low):
 *   1. CLI flags `--api-base`, `--auth-base` (passed in via the `overrides` arg)
 *   2. Env vars `XIAOBAO_API_BASE`, `XIAOBAO_AUTH_BASE`, `XIAOBAO_SCOPES`
 *   3. ~/.xiaobao/config.json { authBase?, apiBase?, scopes? } if present
 *   4. Hardcoded defaults (same phoenix endpoints + client_id as plugin)
 *
 * client_id / client_secret are hardcoded — they're app-level secrets owned
 * by the publisher (xiaobao-cli), not per-user. Identical to the plugin's
 * `open-ai-gateway` RegisteredClient seeded by phoenix DevClientBootstrap.
 */

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const DEFAULT_AUTH_BASE = 'https://admin.wangxiaobao.com';
const DEFAULT_API_BASE = 'https://open-ai.wangxiaobao.com';
const DEFAULT_SCOPES = 'openid profile read write';

const DEFAULT_CLIENT_ID = 'open-ai-gateway';
const DEFAULT_CLIENT_SECRET = 'open-ai-gateway-secret';

const USER_CONFIG_FILE = join(homedir(), '.xiaobao', 'config.json');

export interface ResolvedConfig {
  clientId: string;
  clientSecret: string;
  authBase: string;
  apiBase: string;
  scopes: string;
}

export interface ConfigOverrides {
  authBase?: string;
  apiBase?: string;
  scopes?: string;
}

interface UserConfigShape {
  authBase?: string;
  apiBase?: string;
  scopes?: string;
}

function loadUserConfig(): UserConfigShape {
  try {
    return JSON.parse(readFileSync(USER_CONFIG_FILE, 'utf8')) as UserConfigShape;
  } catch {
    return {};
  }
}

export function resolveConfig(overrides: ConfigOverrides = {}): ResolvedConfig {
  const user = loadUserConfig();
  return {
    clientId: DEFAULT_CLIENT_ID,
    clientSecret: DEFAULT_CLIENT_SECRET,
    authBase:
      overrides.authBase ||
      process.env.XIAOBAO_AUTH_BASE ||
      user.authBase ||
      DEFAULT_AUTH_BASE,
    apiBase:
      overrides.apiBase ||
      process.env.XIAOBAO_API_BASE ||
      user.apiBase ||
      DEFAULT_API_BASE,
    scopes:
      overrides.scopes ||
      process.env.XIAOBAO_SCOPES ||
      user.scopes ||
      DEFAULT_SCOPES,
  };
}

export function basicAuth(clientId: string, clientSecret: string): string {
  return Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}
