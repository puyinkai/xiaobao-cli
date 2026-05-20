/**
 * `xiaobao-cli focus list` — page customer 关注点 (focus) tags via
 * POST /ai-open/customer-focus/page. Mirrors openclaw-xiaobao tool.
 *
 * Focus = 客户主动表达的关心（学区/户型/价格优惠/配套等）。每条 tag 已带
 * customer / userInfo / audio + value_str + text_fragment。
 */

import { defineCommand } from 'citty';
import { xbApiFetch } from '../../core/api-client';
import { resolveConfig } from '../../core/config';
import { requireActiveProject } from '../../core/project-store';
import { csvToArray, toLocalDateTime } from '../../core/util';
import { tenantProjectHeaders } from '../../output/headers';
import { writeError, writeResult } from '../../output/format';

export default defineCommand({
  meta: { name: 'list', description: '客户关注点标签分页查询（visit_time DESC）' },
  args: {
    'visit-ids': { type: 'string', description: 'CSV: 来访 ID 列表 IN 过滤' },
    'customer-ids': { type: 'string', description: 'CSV: 客户 ID（wang_id）列表 IN 过滤' },
    'audio-ids': { type: 'string', description: 'CSV: 录音 ID 列表 IN 过滤' },
    category: {
      type: 'string',
      description: '一级分类 LIKE 模糊（如"户型"/"价格"/"环境"）',
    },
    classification: {
      type: 'string',
      description: '二级分类 LIKE 模糊（如"户型因素"/"位置因素"）',
    },
    from: { type: 'string', description: '来访时间下限（含）' },
    to: { type: 'string', description: '来访时间上限（不含）' },
    page: { type: 'string', default: '1' },
    size: { type: 'string', default: '10' },
    'api-base': { type: 'string' },
    'auth-base': { type: 'string' },
    format: { type: 'string', default: 'json' },
  },
  async run({ args }) {
    try {
      const config = resolveConfig({
        apiBase: args['api-base'],
        authBase: args['auth-base'],
      });
      const active = await requireActiveProject();
      const result = await xbApiFetch(config, 'POST', '/ai-open/customer-focus/page', {
        headers: tenantProjectHeaders(active),
        body: {
          visitIds: csvToArray(args['visit-ids']),
          customerIds: csvToArray(args['customer-ids']),
          audioIds: csvToArray(args['audio-ids']),
          category: args.category,
          classification: args.classification,
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
