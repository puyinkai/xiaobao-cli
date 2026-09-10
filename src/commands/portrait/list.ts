/**
 * `xiaobao-cli portrait list` — 画像字段清单（中文名 + 分档枚举）。
 *
 * 返回本项目可用的画像字段（fieldNames + fields[].values 分档），
 * 供 `portrait get <field>` 使用。调 POST /ai-open/portraits/fields。
 */

import { defineCommand } from 'citty';
import { xbApiFetch } from '../../core/api-client';
import { resolveConfig } from '../../core/config';
import { requireActiveProject } from '../../core/project-store';
import { tenantProjectHeaders } from '../../output/headers';
import { writeError, writeResult } from '../../output/format';

export default defineCommand({
  meta: { name: 'list', description: '画像字段清单（中文名，供 portrait get 使用）' },
  args: {
    'api-base': { type: 'string' },
    'auth-base': { type: 'string' },
    format: { type: 'string', default: 'toon' },
  },
  async run({ args }) {
    try {
      const config = resolveConfig({ apiBase: args['api-base'], authBase: args['auth-base'] });
      const active = await requireActiveProject();
      const result = await xbApiFetch(config, 'POST', '/ai-open/portraits/fields', {
        headers: tenantProjectHeaders(active),
        body: {},
      });
      writeResult(result, args.format);
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
