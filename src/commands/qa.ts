/**
 * `xiaobao-cli qa <prompt>` — 旺小宝业务数据问数.
 *
 * Natural-language Q&A over the active project's data — customers / visits /
 * 挖需率 / 销冠 / 录音覆盖率 / KPIs. Wraps POST /ai-open/langchain/quick-qa/query.
 *
 * Backend note: ai-open now routes this endpoint to wang-ai-mcp's sql-agent
 * (natural-language → SQL), replacing the legacy fast-responder. The request
 * shape ({ prompt, thread_id }) and response are unchanged — transparent here.
 *
 * Multi-turn: pass back the `thread_id` from previous response via --thread-id
 * for follow-ups. Timeout 30 min (backend can run long multi-step data lookups).
 */

import { defineCommand } from 'citty';
import { xbApiFetch } from '../core/api-client';
import { resolveConfig } from '../core/config';
import { requireActiveProject } from '../core/project-store';
import { tenantProjectHeaders } from '../output/headers';
import { writeError, writeResult } from '../output/format';

export default defineCommand({
  meta: {
    name: 'qa',
    description: '业务数据问数（自然语言）— 客户 / 来访 / 挖需率 / 销冠 / 录音覆盖率 等',
  },
  args: {
    prompt: {
      type: 'positional',
      required: true,
      description: '用户问题文本',
    },
    'thread-id': {
      type: 'string',
      description: '多轮 thread id；不传走 stateless run',
    },
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
      const body: Record<string, unknown> = { prompt: String(args.prompt) };
      if (args['thread-id']) body.thread_id = args['thread-id'];
      const result = await xbApiFetch(config, 'POST', '/ai-open/langchain/quick-qa/query', {
        headers: tenantProjectHeaders(active),
        body,
        timeoutMs: 1_800_000, // 30 min — backend can run long multi-step data lookups
      });
      writeResult(result, args.format);
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
