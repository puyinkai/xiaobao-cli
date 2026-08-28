/**
 * `xiaobao-cli auth status` — host-friendly auth check (WorkBuddy cli.json
 * `status` command; also handy for scripts).
 *
 * Contract (WorkBuddy Connector spec §12.4): exit 0 + "Logged in as ..." on
 * stdout when authenticated, non-zero otherwise; must return within seconds
 * and be safe to poll every 3s.
 *
 * If a device authorization is pending (`auth login` was started and the host
 * killed it after reading the URL), one token-endpoint attempt finishes the
 * exchange here — this is what lets WorkBuddy's "kill auth, poll status"
 * flow complete without the auth process staying alive.
 */

import { defineCommand } from 'citty';
import { resolveConfig } from '../../core/config';
import { exchangeDeviceCode, refreshToken } from '../../core/device-flow';
import {
  clearPendingAuth,
  clearToken,
  decodeJwtPayload,
  isAccessTokenValid,
  readPendingAuth,
  readToken,
  writeToken,
  type StoredToken,
} from '../../core/token-store';

function loggedIn(token: StoredToken): never {
  const c = decodeJwtPayload(token.id_token) ?? {};
  const who = c.name ?? c.preferred_username ?? c.sub ?? 'unknown';
  process.stdout.write(`Logged in as ${String(who)}\n`);
  process.exit(0);
}

function notLoggedIn(reason: string): never {
  process.stdout.write(`Not authenticated: ${reason}\n`);
  process.exit(1);
}

export default defineCommand({
  meta: { name: 'status', description: '认证状态检测（exit 0 = 已登录；可完成待授权的 device flow）' },
  args: {
    'auth-base': { type: 'string', description: '覆盖 auth base URL' },
  },
  async run({ args }) {
    const config = resolveConfig({ authBase: args['auth-base'] });

    const cached = await readToken();
    if (isAccessTokenValid(cached)) loggedIn(cached!);
    if (cached?.refresh_token) {
      try {
        loggedIn(await writeToken(await refreshToken(config, cached.refresh_token)));
      } catch {
        await clearToken();
      }
    }

    const pending = await readPendingAuth();
    if (!pending) notLoggedIn('run `xiaobao-cli auth login`');
    if (pending.expires_at <= Date.now()) {
      await clearPendingAuth();
      notLoggedIn('device authorization expired, run `xiaobao-cli auth login` again');
    }
    try {
      const result = await exchangeDeviceCode(config, pending.device_code);
      if (result === 'pending' || result === 'slow_down') notLoggedIn('awaiting authorization in browser');
      const saved = await writeToken(result);
      await clearPendingAuth();
      loggedIn(saved);
    } catch (err) {
      // access_denied / expired_token / anything terminal — drop the dead device_code.
      await clearPendingAuth();
      const code = (err as { code?: string })?.code ?? 'error';
      notLoggedIn(`device authorization failed (${code}), run \`xiaobao-cli auth login\` again`);
    }
  },
});
