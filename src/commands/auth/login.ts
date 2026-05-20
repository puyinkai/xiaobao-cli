/**
 * `xiaobao-cli auth login` — OAuth 2.0 Device Authorization Grant.
 *
 * Behaviour:
 *   1. Cache hit (valid access_token, no --force) → return immediately.
 *   2. Refresh path (cached refresh_token, no --force) → refresh & store.
 *   3. Device flow → print verification URL + user_code to stderr (humans see
 *      it in the terminal), and synchronously poll until success/denial/expiry.
 *      Polls foreground so the CLI exits with a final structured result on
 *      stdout (agents waiting on stdout JSON get a definitive answer).
 */

import { defineCommand } from 'citty';
import { resolveConfig } from '../../core/config';
import {
  initiateDeviceAuthorization,
  pollForToken,
  refreshToken as refreshTokenCall,
} from '../../core/device-flow';
import { clearToken, isAccessTokenValid, readToken, writeToken } from '../../core/token-store';
import { writeError, writeResult } from '../../output/format';

export default defineCommand({
  meta: { name: 'login', description: '走 OAuth device flow 登录' },
  args: {
    force: { type: 'boolean', description: '强制清除缓存并重新发起设备授权流程' },
    'api-base': { type: 'string', description: '覆盖 API base URL' },
    'auth-base': { type: 'string', description: '覆盖 auth base URL' },
    format: { type: 'string', default: 'json' },
  },
  async run({ args }) {
    const config = resolveConfig({
      apiBase: args['api-base'],
      authBase: args['auth-base'],
    });
    const fmt = args.format;

    try {
      if (!args.force) {
        const cached = await readToken();
        if (isAccessTokenValid(cached)) {
          writeResult(
            { source: 'cache', expires_at: cached!.expires_at, scope: cached!.scope },
            fmt,
          );
          return;
        }
        if (cached?.refresh_token) {
          try {
            const refreshed = await refreshTokenCall(config, cached.refresh_token);
            const saved = await writeToken(refreshed);
            writeResult(
              { source: 'refresh', expires_at: saved.expires_at, scope: saved.scope },
              fmt,
            );
            return;
          } catch {
            await clearToken();
          }
        }
      } else {
        await clearToken();
      }

      const init = await initiateDeviceAuthorization(config);
      const verificationUri = init.verification_uri_complete || init.verification_uri;
      const expiresMinutes = Math.max(1, Math.round(init.expires_in / 60));
      const interval = init.interval ?? 5;

      // Human-friendly prompt on stderr (stdout reserved for the final JSON).
      process.stderr.write(
        '\n请在浏览器中打开以下链接完成登录并授权访问你的旺小宝账号:\n' +
          `\n  🔗 ${verificationUri}\n` +
          `\n  设备验证码: ${init.user_code}\n` +
          `  有效期约 ${expiresMinutes} 分钟\n\n` +
          '等待你在浏览器中确认 ...\n',
      );

      const tok = await pollForToken(config, init.device_code, interval, init.expires_in);
      const saved = await writeToken(tok);
      writeResult(
        {
          source: 'device-flow',
          expires_at: saved.expires_at,
          scope: saved.scope,
          message: '登录成功，token 已缓存到 ~/.xiaobao/token.json',
        },
        fmt,
      );
    } catch (err) {
      writeError(err, fmt);
      process.exit(1);
    }
  },
});
