/**
 * `xiaobao-cli auth whoami` — print currently logged-in 旺小宝 user.
 *
 * Pure local op: reads cached id_token (primary then legacy fallback) and
 * decodes the JWT payload. No HTTP call.
 */

import { defineCommand } from 'citty';
import { decodeJwtPayload, readToken } from '../../core/token-store';
import { writeError, writeResult } from '../../output/format';

export default defineCommand({
  meta: { name: 'whoami', description: '查看当前登录的旺小宝用户（解析缓存 id_token）' },
  args: {
    format: { type: 'string', default: 'json' },
  },
  async run({ args }) {
    try {
      const token = await readToken();
      if (!token) {
        writeResult(
          {
            logged_in: false,
            message:
              'No token cached. Run `xiaobao-cli auth login --no-wait` then ' +
              '`xiaobao-cli auth login --resume` to log in.',
          },
          args.format,
        );
        return;
      }
      const claims = decodeJwtPayload(token.id_token);
      const user = claims
        ? {
            sub: claims.sub,
            name: claims.name,
            phone_number: claims.phone_number,
            email: claims.email,
            preferred_username: claims.preferred_username,
          }
        : null;
      writeResult(
        {
          logged_in: true,
          user,
          token_expires_at: token.expires_at,
          token_expires_in_seconds: Math.max(0, Math.floor((token.expires_at - Date.now()) / 1000)),
          scope: token.scope,
        },
        args.format,
      );
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
