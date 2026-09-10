/**
 * `xiaobao-cli follow summary` — 旺跟进汇总（电话/微信指标）。
 *
 * 同 follow list 的筛选条件，返回电话呼入/呼出次数与接通率、通话时长、
 * 微信通话与消息数等指标（不分页）。调 POST /ai-open/follows/summary。
 */

import { defineCommand } from 'citty';
import { xbApiFetch } from '../../core/api-client';
import { resolveConfig } from '../../core/config';
import { requireActiveProject } from '../../core/project-store';
import { csvToArray, toLocalDateTime } from '../../core/util';
import { tenantProjectHeaders } from '../../output/headers';
import { writeError, writeResult } from '../../output/format';

export default defineCommand({
  meta: { name: 'summary', description: '旺跟进汇总：电话呼入/呼出/接通率/时长、微信通话与消息数' },
  args: {
    'user-ids': { type: 'string', description: 'CSV: 跟进人 userId 过滤；不传按当前授权范围' },
    'customer-ids': { type: 'string', description: 'CSV: 客户 wang_id 过滤' },
    from: { type: 'string', description: '开始时间（含）' },
    to: { type: 'string', description: '结束时间（不含）' },
    'api-base': { type: 'string' },
    'auth-base': { type: 'string' },
    format: { type: 'string', default: 'toon' },
  },
  async run({ args }) {
    try {
      const config = resolveConfig({ apiBase: args['api-base'], authBase: args['auth-base'] });
      const active = await requireActiveProject();
      const result = await xbApiFetch(config, 'POST', '/ai-open/follows/summary', {
        headers: tenantProjectHeaders(active),
        body: {
          userIds: csvToArray(args['user-ids'])?.map(Number),
          customerIds: csvToArray(args['customer-ids'])?.map(Number),
          fromDate: toLocalDateTime(args.from),
          toDate: toLocalDateTime(args.to),
        },
      });
      writeResult(result, args.format);
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
