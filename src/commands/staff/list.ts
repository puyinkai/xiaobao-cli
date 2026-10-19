import { defineCommand } from 'citty';
import { getCurrentToken } from '../../core/api-client';
import { resolveConfig } from '../../core/config';
import { requireActiveProject } from '../../core/project-store';
import { decodeJwtPayload } from '../../core/token-store';
import { mcpProjectHeaders } from '../../output/headers';
import { writeError, writeResult } from '../../output/format';
import { fetchMcpTools } from '../../core/mcp-client';

export default defineCommand({
  meta: { name: 'list', description: '查看当前开放的员工工具' },
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
      const token = await getCurrentToken();
      const userId = typeof decodeJwtPayload(token?.access_token)?.sub === 'string'
        ? String(decodeJwtPayload(token?.access_token)?.sub)
        : undefined;
      // fetchMcpTools follows `nextCursor`, so the list is the union of all pages.
      const tools = await fetchMcpTools(config, mcpProjectHeaders(active, userId));
      writeResult(
        { tools: tools.filter((tool) => tool.name.startsWith('staff-')) },
        args.format,
      );
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
