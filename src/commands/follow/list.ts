/**
 * `xiaobao-cli follow list` — 旺跟进明细分页。
 *
 * 每条 = 一次跟进动作（电话/短信/微信/企微…，含通话时长、消息条数）。
 * 聚合统计卡片（summary/rank/team/time）走 `quantum follow`；
 * 电话/微信指标汇总走 `follow summary`。调 POST /ai-open/follows/page。
 */

import { defineCommand } from 'citty';
import { xbApiFetch } from '../../core/api-client';
import { resolveConfig } from '../../core/config';
import { requireActiveProject } from '../../core/project-store';
import { csvToArray, toLocalDateTime } from '../../core/util';
import { tenantProjectHeaders } from '../../output/headers';
import { writeError, writeResult } from '../../output/format';

export default defineCommand({
  meta: { name: 'list', description: '旺跟进明细分页（谁/何时/以什么方式跟进了哪个客户）' },
  args: {
    'user-ids': { type: 'string', description: 'CSV: 跟进人 userId 过滤；不传按当前授权范围' },
    'customer-ids': { type: 'string', description: 'CSV: 客户 wang_id 过滤' },
    from: { type: 'string', description: '开始时间（含）' },
    to: { type: 'string', description: '结束时间（不含）' },
    page: { type: 'string', default: '1' },
    size: { type: 'string', default: '10' },
    'api-base': { type: 'string' },
    'auth-base': { type: 'string' },
    format: { type: 'string', default: 'toon' },
  },
  async run({ args }) {
    try {
      const config = resolveConfig({ apiBase: args['api-base'], authBase: args['auth-base'] });
      const active = await requireActiveProject();
      const result = await xbApiFetch(config, 'POST', '/ai-open/follows/page', {
        headers: tenantProjectHeaders(active),
        body: {
          userIds: csvToArray(args['user-ids'])?.map(Number),
          customerIds: csvToArray(args['customer-ids'])?.map(Number),
          fromDate: toLocalDateTime(args.from),
          toDate: toLocalDateTime(args.to),
          page: Number(args.page),
          size: Number(args.size),
        },
      });
      writeResult(result, args.format);
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
