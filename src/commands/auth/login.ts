/**
 * `xiaobao-cli auth login` — OAuth 2.0 Device Authorization Grant.
 *
 * Three modes:
 *
 *   1. Default (blocking)      — cache hit / refresh / else initiate device
 *      flow and synchronously poll until success/denial/expiry. Best for a
 *      human running it directly in a terminal.
 *
 *   2. `--no-wait` (non-blocking, agent-friendly split-flow) — cache hit /
 *      refresh as usual; otherwise initiate device flow and **return
 *      immediately** with the verification URL + `device_code`, WITHOUT
 *      polling. The agent forwards the URL to the user, ends its turn, and
 *      after the user authorizes runs step 3.
 *
 *   3. `--device-code <code>` — exchange an already-issued device_code for a
 *      token. Polls briefly (the user has already authorized, so the first
 *      poll usually succeeds). This is the second half of the split-flow.
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
  meta: { name: 'login', description: '走 OAuth device flow 登录（支持 --no-wait 非阻塞）' },
  args: {
    force: { type: 'boolean', description: '强制清除缓存并重新发起设备授权流程' },
    wait: {
      type: 'boolean',
      default: true,
      description:
        '默认阻塞轮询直到授权完成。`--no-wait` 则发起 device flow 后立即返回 ' +
        'verification_uri + device_code 不轮询；用户授权后再用 ' +
        '`auth login --device-code <device_code>` 完成换 token。',
    },
    'device-code': {
      type: 'string',
      description:
        'split-flow 第二步：用 --no-wait 拿到的 device_code 换 token（用户已在浏览器授权后跑）',
    },
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
      // ---- Mode 3: exchange an already-issued device_code for a token ----
      if (args['device-code']) {
        // User has (presumably) authorized; poll briefly with a short interval.
        // First poll typically succeeds. If still pending, surfaces a clear error.
        const tok = await pollForToken(config, String(args['device-code']), 2, 300);
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
        return;
      }

      // ---- cache / refresh shortcut (modes 1 & 2 both honour it) ----
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

      // ---- initiate device authorization ----
      const init = await initiateDeviceAuthorization(config);
      const verificationUri = init.verification_uri_complete || init.verification_uri;
      const expiresMinutes = Math.max(1, Math.round(init.expires_in / 60));
      const interval = init.interval ?? 5;

      // ---- Mode 2: --no-wait — return immediately, no polling ----
      // citty treats `--no-wait` as negation of the `wait` boolean (default
      // true), so non-blocking mode is `args.wait === false`.
      if (!args.wait) {
        writeResult(
          {
            awaiting_authorization: true,
            verification_uri: verificationUri,
            user_code: init.user_code,
            device_code: init.device_code,
            expires_in: init.expires_in,
            interval,
            message:
              '请在浏览器打开 verification_uri 完成授权，然后跑 ' +
              `\`xiaobao-cli auth login --device-code ${init.device_code}\` 完成登录。`,
          },
          fmt,
        );
        return;
      }

      // ---- Mode 1: default — block and poll until done ----
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
