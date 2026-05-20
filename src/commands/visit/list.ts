/**
 * `xiaobao-cli visit list` — page customer visits via POST /ai-open/visits/page.
 *
 * Mirrors openclaw-xiaobao xiaobao_list_visits. Each visit already carries an
 * `audios` array (audioId / fileId / startTime / duration / signed fileUrl),
 * so no need to call `audio list` separately for a visit's recordings.
 */

import { defineCommand } from 'citty';
import { xbApiFetch } from '../../core/api-client';
import { resolveConfig } from '../../core/config';
import { requireActiveProject } from '../../core/project-store';
import { toLocalDateTime } from '../../core/util';
import { tenantProjectHeaders } from '../../output/headers';
import { writeError, writeResult } from '../../output/format';

export default defineCommand({
  meta: { name: 'list', description: '客户来访分页查询（每条已含 audios 录音列表）' },
  args: {
    'customer-id': {
      type: 'string',
      description: '客户 ID（wang_id）精确过滤，优于 customer-name',
    },
    'customer-name': {
      type: 'string',
      description: '客户姓名 LIKE 模糊（触发后端 JOIN，慢于 customer-id）',
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
      const result = await xbApiFetch(config, 'POST', '/ai-open/visits/page', {
        headers: tenantProjectHeaders(active),
        body: {
          customerId: args['customer-id'],
          customerName: args['customer-name'],
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
