/**
 * `xiaobao-cli kb doc-content <doc-id>` — paged knowledge-base document body
 * via POST /ai-open/kb/docs/content/query. Page through long documents with
 * `--offset`/`--limit`; use the `hasMore` flag in the response to keep going.
 */

import { defineCommand } from 'citty';
import { xbApiFetch } from '../../core/api-client';
import { resolveConfig } from '../../core/config';
import { requireActiveProject } from '../../core/project-store';
import { tenantProjectHeaders } from '../../output/headers';
import { writeError, writeResult } from '../../output/format';

export default defineCommand({
  meta: { name: 'doc-content', description: '知识库文档正文分页（offset/limit 翻页，hasMore 续翻）' },
  args: {
    'doc-id': { type: 'positional', required: true, description: '文档 ID' },
    offset: { type: 'string', description: '内容偏移，默认 0' },
    limit: { type: 'string', description: '内容长度，默认 1000，最大 2000' },
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
      const result = await xbApiFetch(config, 'POST', '/ai-open/kb/docs/content/query', {
        headers: tenantProjectHeaders(active),
        body: {
          docId: Number(args['doc-id']),
          offset: args.offset != null ? Number(args.offset) : undefined,
          limit: args.limit != null ? Number(args.limit) : undefined,
        },
      });
      writeResult(result, args.format);
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
