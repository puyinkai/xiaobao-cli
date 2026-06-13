/**
 * `xiaobao-cli kb doc <doc-id>` — knowledge-base document detail via
 * POST /ai-open/kb/docs/get. Fetched by docId. For the full body text use
 * `kb doc-content` (paged).
 */

import { defineCommand } from 'citty';
import { xbApiFetch } from '../../core/api-client';
import { resolveConfig } from '../../core/config';
import { requireActiveProject } from '../../core/project-store';
import { tenantProjectHeaders } from '../../output/headers';
import { writeError, writeResult } from '../../output/format';

export default defineCommand({
  meta: { name: 'doc', description: '知识库文档详情（按 docId 直取）' },
  args: {
    'doc-id': { type: 'positional', required: true, description: '文档 ID' },
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
      const result = await xbApiFetch(config, 'POST', '/ai-open/kb/docs/get', {
        headers: tenantProjectHeaders(active),
        body: { docId: Number(args['doc-id']) },
      });
      writeResult(result, args.format);
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
