/**
 * `xiaobao-cli visit summary` — page visit reception-summaries via
 * POST /ai-open/visits/summary.
 *
 * Returns customer × visit × template-summary nesting, paged by visit_id.
 * `--template` selects a specific reception-summary template (exact match on
 * the template name, not a free-text question). When `--visit-id` is omitted,
 * `--from`/`--to` are required and the window must be ≤ 7 days (enforced
 * downstream by wang-ai-mcp).
 */

import { defineCommand } from 'citty';
import { xbApiFetch } from '../../core/api-client';
import { resolveConfig } from '../../core/config';
import { requireActiveProject } from '../../core/project-store';
import { toLocalDateTime } from '../../core/util';
import { tenantProjectHeaders } from '../../output/headers';
import { writeError, writeResult } from '../../output/format';

export default defineCommand({
  meta: {
    name: 'summary',
    description: '来访接待总结分页查询（客户×来访×模板总结，按 visit_id 分页）',
  },
  args: {
    'customer-id': {
      type: 'string',
      description: '客户 ID（wang_id）精确过滤',
    },
    'visit-id': {
      type: 'string',
      description: '来访 ID 精确过滤；传了它 from/to 可省略',
    },
    from: { type: 'string', description: '来访时间下限（含）；visit-id 为空时必填' },
    to: { type: 'string', description: '来访时间上限（不含）；visit-id 为空时必填' },
    template: {
      type: 'string',
      description: '指定查询某个接待总结模板的结果（精确匹配模板名，非自由问句）',
    },
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
      const result = await xbApiFetch(config, 'POST', '/ai-open/visits/summary', {
        headers: tenantProjectHeaders(active),
        body: {
          wangId: args['customer-id'],
          visitId: args['visit-id'],
          fromDate: toLocalDateTime(args.from),
          toDate: toLocalDateTime(args.to),
          template: args.template,
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
