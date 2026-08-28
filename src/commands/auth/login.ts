/**
 * `xiaobao-cli auth login` — OAuth 2.0 Device Authorization Grant.
 *
 * Three modes:
 *
 *   1. Default (blocking)  — cache hit / refresh / else initiate the device
 *      flow and synchronously poll until success/denial/expiry. Best for a
 *      human running it directly in a terminal.
 *
 *   2. `--no-wait` (non-blocking, agent-friendly split-flow step 1) — cache
 *      hit / refresh as usual; otherwise initiate the device flow, persist
 *      the device_code locally (~/.xiaobao/pending-auth.json, mode 0600) and
 *      return immediately with the verification URL — WITHOUT polling and
 *      WITHOUT exposing the credential-grade device_code on stdout. The agent
 *      forwards the URL to the user, ends its turn, then runs step 2.
 *
 *   3. `--resume` (split-flow step 2) — read the locally-saved device_code
 *      and exchange it for a token; no argument needed. `--device-code <code>`
 *      remains as an explicit escape hatch and takes precedence when given.
 */

import { defineCommand } from 'citty';
import { resolveConfig } from '../../core/config';
import {
  initiateDeviceAuthorization,
  pollForToken,
  refreshToken as refreshTokenCall,
} from '../../core/device-flow';
import {
  clearPendingAuth,
  clearToken,
  isAccessTokenValid,
  NoPendingAuthError,
  readPendingAuth,
  readToken,
  writePendingAuth,
  writeToken,
} from '../../core/token-store';
import { writeError, writeResult } from '../../output/format';

export default defineCommand({
  meta: {
    name: 'login',
    description: '走 OAuth device flow 登录（--no-wait 非阻塞发起 / --resume 完成）',
  },
  args: {
    force: { type: 'boolean', description: '强制清除缓存并重新发起设备授权流程' },
    wait: {
      type: 'boolean',
      default: true,
      description:
        '默认阻塞轮询直到授权完成。`--no-wait` 则发起 device flow 后立即返回 ' +
        'verification_uri 不轮询（device_code 安全存本地，不进 stdout）；用户授权后 ' +
        '再用 `auth login --resume` 完成换 token。',
    },
    resume: {
      type: 'boolean',
      description:
        'split-flow 第二步：用上次 `--no-wait` 本地保存的 device_code 换 token，' +
        '用户在浏览器授权后跑，无需手动传 device_code。',
    },
    'device-code': {
      type: 'string',
      description:
        '（高级 escape hatch）显式传入 device_code 换 token；一般用 `--resume` 即可，' +
        'CLI 会自动读取本地保存的 device_code。',
    },
    'api-base': { type: 'string', description: '覆盖 API base URL' },
    'auth-base': { type: 'string', description: '覆盖 auth base URL' },
    format: { type: 'string', default: 'toon' },
  },
  async run({ args }) {
    const config = resolveConfig({
      apiBase: args['api-base'],
      authBase: args['auth-base'],
    });
    const fmt = args.format;

    try {
      // ---- Mode 3: split-flow step 2 — exchange a device_code for a token ----
      // `--resume` reads the device_code saved locally by step 1; an explicit
      // `--device-code <code>` overrides it (escape hatch). Poll with a short
      // interval — the user has already authorized, so the first poll usually
      // succeeds.
      if (args.resume || args['device-code']) {
        let deviceCode: string;
        let remainingSeconds = 300;
        if (args['device-code']) {
          deviceCode = String(args['device-code']);
        } else {
          const pending = await readPendingAuth();
          if (!pending) throw new NoPendingAuthError();
          if (pending.expires_at <= Date.now()) {
            await clearPendingAuth();
            throw new NoPendingAuthError('设备授权已过期，device_code 失效');
          }
          deviceCode = pending.device_code;
          remainingSeconds = Math.max(
            1,
            Math.ceil((pending.expires_at - Date.now()) / 1000),
          );
        }
        const tok = await pollForToken(config, deviceCode, 2, remainingSeconds);
        const saved = await writeToken(tok);
        await clearPendingAuth();
        writeResult(
          {
            source: 'device-flow',
            expires_at: saved.expires_at,
            scope: saved.scope,
            message: '登录成功，可以正常使用别的命令了',
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

      // ---- Mode 2: --no-wait — persist device_code, return immediately ----
      // citty treats `--no-wait` as negation of the `wait` boolean (default
      // true), so non-blocking mode is `args.wait === false`. The device_code
      // is credential-grade: it's saved to ~/.xiaobao/pending-auth.json (0600)
      // instead of being returned on stdout, so it never enters the agent's
      // context. `auth login --resume` reads it back for step 2.
      if (!args.wait) {
        await writePendingAuth({
          device_code: init.device_code,
          user_code: init.user_code,
          verification_uri: verificationUri,
          interval,
          expires_at: Date.now() + init.expires_in * 1000,
        });
        writeResult(
          {
            awaiting_authorization: true,
            verification_uri: verificationUri,
            verification_link: `[点击完成旺小宝登录授权](${verificationUri})`,
            user_code: init.user_code,
            expires_in: init.expires_in,
            interval,
            message:
              '把 verification_link（markdown 可点击链接）原样发给用户点击授权，' +
              '授权完成后跑 `xiaobao-cli auth login --resume` 完成登录。' +
              'device_code 已安全保存在本地，无需手动传。',
          },
          fmt,
        );
        return;
      }

      // ---- Mode 1: default — block and poll until done ----
      // Persist the pending device_code too: hosts like WorkBuddy may kill this
      // process right after reading the URL, then poll `auth status`, which
      // finishes the exchange from this file.
      await writePendingAuth({
        device_code: init.device_code,
        user_code: init.user_code,
        verification_uri: verificationUri,
        interval,
        expires_at: Date.now() + init.expires_in * 1000,
      });
      process.stderr.write(
        '\n请在浏览器中打开以下链接完成登录并授权访问你的旺小宝账号:\n' +
          `\n  🔗 ${verificationUri}\n` +
          `\n  设备验证码: ${init.user_code}\n` +
          `  有效期约 ${expiresMinutes} 分钟\n\n` +
          '等待你在浏览器中确认 ...\n',
      );

      const tok = await pollForToken(config, init.device_code, interval, init.expires_in);
      const saved = await writeToken(tok);
      await clearPendingAuth();
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
