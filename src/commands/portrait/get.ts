/**
 * `xiaobao-cli portrait get <field>` — 单个画像字段的饼图分布。
 *
 * 回答"全项目客户的<意向级别/预算/…>分布比例"类问题（count + items[].name/count/rate）。
 * field 用 `portrait list` 返回的中文字段名。调 POST /ai-open/portraits/get。
 */

import { defineCommand } from 'citty';
import { xbApiFetch } from '../../core/api-client';
import { resolveConfig } from '../../core/config';
import { requireActiveProject } from '../../core/project-store';
import { csvToArray, toLocalDateTime } from '../../core/util';
import { tenantProjectHeaders } from '../../output/headers';
import { writeError, writeResult } from '../../output/format';

export default defineCommand({
  meta: { name: 'get', description: '画像饼图数据（按单个字段中文名查询分布）' },
  args: {
    field: { type: 'positional', required: true, description: '画像字段中文名（portrait list 的 fieldName）' },
    from: { type: 'string', description: '开始时间（含）' },
    to: { type: 'string', description: '结束时间（不含）' },
    'user-ids': { type: 'string', description: 'CSV: 数据范围 userIds；不传按当前授权范围' },
    'api-base': { type: 'string' },
    'auth-base': { type: 'string' },
    format: { type: 'string', default: 'toon' },
  },
  async run({ args }) {
    try {
      const config = resolveConfig({ apiBase: args['api-base'], authBase: args['auth-base'] });
      const active = await requireActiveProject();
      const result = await xbApiFetch(config, 'POST', '/ai-open/portraits/get', {
        headers: tenantProjectHeaders(active),
        body: {
          field: String(args.field),
          fromDate: toLocalDateTime(args.from),
          toDate: toLocalDateTime(args.to),
          userIds: csvToArray(args['user-ids'])?.map(Number),
        },
      });
      writeResult(result, args.format);
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
