/**
 * `xiaobao-cli resistance list` — page customer 抗性点 (resistance) tags via
 * POST /ai-open/customer-resistance/page. Mirrors openclaw-xiaobao tool;
 * schema identical to focus, differs only in the underlying MV table.
 *
 * Resistance = 客户疑虑 / 反对 / 不满（价格高 / 户型差 / 地段差 等）。
 */

import { defineCommand } from 'citty';
import { xbApiFetch } from '../../core/api-client';
import { resolveConfig } from '../../core/config';
import { requireActiveProject } from '../../core/project-store';
import { csvToArray, toLocalDateTime } from '../../core/util';
import { tenantProjectHeaders } from '../../output/headers';
import { writeError, writeResult } from '../../output/format';

export default defineCommand({
  meta: { name: 'list', description: '客户抗性点标签分页查询（visit_time DESC）' },
  args: {
    'visit-ids': { type: 'string', description: 'CSV: 来访 ID 列表 IN 过滤' },
    'customer-ids': { type: 'string', description: 'CSV: 客户 ID（wang_id）列表 IN 过滤' },
    'audio-ids': { type: 'string', description: 'CSV: 录音 ID 列表 IN 过滤' },
    category: {
      type: 'string',
      description: '一级分类 LIKE 模糊（如"价格"/"户型"/"环境"）',
    },
    classification: {
      type: 'string',
      description: '二级分类 LIKE 模糊（如"价格因素"/"位置因素"）',
    },
    from: { type: 'string', description: '来访时间下限（含）' },
    to: { type: 'string', description: '来访时间上限（不含）' },
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
      const result = await xbApiFetch(config, 'POST', '/ai-open/customer-resistance/page', {
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
