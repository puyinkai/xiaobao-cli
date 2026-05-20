/**
 * `xiaobao-cli auth logout` — clear local token + best-effort revoke remote
 * refresh_token. Only touches the primary path (~/.xiaobao/token.json) —
 * legacy ~/.openclaw/state/wangxiaobao/token.json is left intact so this
 * doesn't silently nuke the plugin's session.
 */

import { defineCommand } from 'citty';
import { resolveConfig } from '../../core/config';
import { revokeRefreshToken } from '../../core/device-flow';
import { clearToken, readToken } from '../../core/token-store';
import { writeError, writeResult } from '../../output/format';

export default defineCommand({
  meta: { name: 'logout', description: '清除本地 token + 尽力 revoke 服务端 refresh_token' },
  args: {
    'auth-base': { type: 'string', description: '覆盖 auth base URL' },
    format: { type: 'string', default: 'json' },
  },
  async run({ args }) {
    try {
      const config = resolveConfig({ authBase: args['auth-base'] });
      const cached = await readToken();
      let revoked = false;
      if (cached?.refresh_token) {
        revoked = await revokeRefreshToken(config, cached.refresh_token);
      }
      await clearToken();
      writeResult(
        {
          message: 'Logged out',
          remote_revoked: revoked,
          note:
            'Only ~/.xiaobao/token.json was cleared. Legacy ' +
            '~/.openclaw/state/wangxiaobao/token.json (if present) was left intact.',
        },
        args.format,
      );
    } catch (err) {
      // Best-effort clear even on error
      try {
        await clearToken();
      } catch {
        /* ignore */
      }
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
