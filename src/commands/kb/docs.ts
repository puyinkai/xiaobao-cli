/**
 * `xiaobao-cli kb docs` — list knowledge-base documents via
 * POST /ai-open/kb/docs/query. Scoped to the active project. Use `--title`
 * to filter by title keyword.
 */

import { defineCommand } from 'citty';
import { xbApiFetch } from '../../core/api-client';
import { resolveConfig } from '../../core/config';
import { requireActiveProject } from '../../core/project-store';
import { tenantProjectHeaders } from '../../output/headers';
import { writeError, writeResult } from '../../output/format';

export default defineCommand({
  meta: { name: 'docs', description: '知识库文档列表（按当前激活项目隔离）' },
  args: {
    title: { type: 'string', description: '标题关键字过滤（可选）' },
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
      const result = await xbApiFetch(config, 'POST', '/ai-open/kb/docs/query', {
        headers: tenantProjectHeaders(active),
        body: { title: args.title },
      });
      writeResult(result, args.format);
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
