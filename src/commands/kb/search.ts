/**
 * `xiaobao-cli kb search <query>` — semantic knowledge-base retrieval via
 * POST /ai-open/kb/search. Returns ranked chunks (not full documents),
 * scoped to the active project.
 */

import { defineCommand } from 'citty';
import { xbApiFetch } from '../../core/api-client';
import { resolveConfig } from '../../core/config';
import { requireActiveProject } from '../../core/project-store';
import { csvToArray } from '../../core/util';
import { tenantProjectHeaders } from '../../output/headers';
import { writeError, writeResult } from '../../output/format';

export default defineCommand({
  meta: { name: 'search', description: '知识库语义检索（返回 chunk，按当前激活项目隔离）' },
  args: {
    query: { type: 'positional', required: true, description: '检索 query' },
    k: { type: 'string', description: '返回 chunk 数量，默认 5，最大 20' },
    'chunk-types': { type: 'string', description: 'CSV: chunk 类型过滤' },
    'doc-ids': { type: 'string', description: 'CSV: 文档 ID 过滤' },
    'enable-rerank': { type: 'boolean', description: '是否启用 rerank' },
    'rerank-threshold': { type: 'string', description: 'rerank 阈值（小数）' },
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
      const result = await xbApiFetch(config, 'POST', '/ai-open/kb/search', {
        headers: tenantProjectHeaders(active),
        body: {
          query: String(args.query),
          k: args.k != null ? Number(args.k) : undefined,
          chunkTypes: csvToArray(args['chunk-types']),
          docIds: csvToArray(args['doc-ids']),
          enableRerank: args['enable-rerank'] ? true : undefined,
          rerankThreshold:
            args['rerank-threshold'] != null ? Number(args['rerank-threshold']) : undefined,
        },
      });
      writeResult(result, args.format);
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
