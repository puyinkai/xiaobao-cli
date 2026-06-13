/**
 * `xiaobao-cli customer list` — page customer profiles via
 * POST /ai-open/customers/page.
 *
 * Mirrors openclaw-xiaobao xiaobao_list_customers. Filters: consultant id/name,
 * customer name/phone (LIKE), portrait keyword (LIKE on dynamic_tags JSON),
 * last-visit time range. Sorted by last_visit_time DESC.
 */

import { defineCommand } from 'citty';
import { xbApiFetch } from '../../core/api-client';
import { resolveConfig } from '../../core/config';
import { requireActiveProject } from '../../core/project-store';
import { toLocalDateTime } from '../../core/util';
import { tenantProjectHeaders } from '../../output/headers';
import { writeError, writeResult } from '../../output/format';

export default defineCommand({
  meta: { name: 'list', description: '客户画像分页查询（按顾问 / 客户名 / 画像 / 时间）' },
  args: {
    'user-id': { type: 'string', description: '置业顾问 user-id 精确过滤' },
    'user-name': { type: 'string', description: '置业顾问姓名 LIKE 模糊' },
    'customer-name': { type: 'string', description: '客户姓名 LIKE 模糊' },
    'customer-phone': { type: 'string', description: '客户手机号 LIKE 模糊（可能脱敏）' },
    portrait: {
      type: 'string',
      description: '画像关键词，在 dynamic_tags JSON 文本上 LIKE 模糊（如"高意向"/"价格"）',
    },
    from: { type: 'string', description: '最后来访时间下限（含）' },
    to: { type: 'string', description: '最后来访时间上限（不含）' },
    page: { type: 'string', default: '1' },
    size: { type: 'string', default: '10' },
    'api-base': { type: 'string' },
    'auth-base': { type: 'string' },
    format: { type: 'string', default: 'toon' },
  },
  async run({ args }) {
    try {
      const config = resolveConfig({
        apiBase: args['api-base'],
        authBase: args['auth-base'],
      });
      const active = await requireActiveProject();
      const result = await xbApiFetch(config, 'POST', '/ai-open/customers/page', {
        headers: tenantProjectHeaders(active),
        body: {
          userId: args['user-id'],
          userName: args['user-name'],
          customerName: args['customer-name'],
          customerPhone: args['customer-phone'],
          portrait: args.portrait,
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
