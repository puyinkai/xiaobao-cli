/**
 * `xiaobao-cli audio analyze` — 录音批量分析（LLM）。
 *
 * 对指定客户/顾问范围的录音做 LLM 分析（共性抗性、话术问题等开放问题）。
 * 与 `audio list/text`（元数据/逐字稿查询）不同，这是耗时的生成式分析。
 * 调 POST /ai-open/audio/analyze。
 */

import { defineCommand } from 'citty';
import { xbApiFetch } from '../../core/api-client';
import { resolveConfig } from '../../core/config';
import { requireActiveProject } from '../../core/project-store';
import { csvToArray } from '../../core/util';
import { tenantProjectHeaders } from '../../output/headers';
import { writeError, writeResult } from '../../output/format';

export default defineCommand({
  meta: { name: 'analyze', description: '录音批量分析（LLM，耗时较长；元数据查询用 audio list）' },
  args: {
    query: { type: 'positional', required: true, description: '分析问题/指令' },
    type: { type: 'string', description: '分析类型：general_analysis（默认）| timeline_analysis' },
    'customer-id': { type: 'string', description: '单个客户 wang_id' },
    'customer-ids': { type: 'string', description: 'CSV: 客户 wang_id 列表' },
    'advisor-ids': { type: 'string', description: 'CSV: 顾问 userId 列表' },
    'api-base': { type: 'string' },
    'auth-base': { type: 'string' },
    format: { type: 'string', default: 'toon' },
  },
  async run({ args }) {
    try {
      const config = resolveConfig({ apiBase: args['api-base'], authBase: args['auth-base'] });
      const active = await requireActiveProject();
      const result = await xbApiFetch(config, 'POST', '/ai-open/audio/analyze', {
        headers: tenantProjectHeaders(active),
        body: {
          query: String(args.query),
          analysisType: args.type,
          customerId: args['customer-id'],
          customerIds: csvToArray(args['customer-ids']),
          advisorIds: csvToArray(args['advisor-ids']),
        },
      });
      writeResult(result, args.format);
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
