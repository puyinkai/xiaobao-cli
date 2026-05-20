/**
 * `xiaobao-cli consultant list` — list consultants the current user is
 * authorised to view in the active project.
 *
 * Mirrors openclaw-xiaobao xiaobao_list_consultants: GET /ai-open/consultants
 * with tenant/project headers from active-project store.
 */

import { defineCommand } from 'citty';
import { xbApiFetch } from '../../core/api-client';
import { resolveConfig } from '../../core/config';
import { requireActiveProject } from '../../core/project-store';
import { tenantProjectHeaders } from '../../output/headers';
import { writeError, writeResult } from '../../output/format';

export default defineCommand({
  meta: { name: 'list', description: '查询有权限的置业顾问列表（按当前激活项目）' },
  args: {
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
      const result = await xbApiFetch(config, 'GET', '/ai-open/consultants', {
        headers: tenantProjectHeaders(active),
      });
      writeResult(result, args.format);
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
