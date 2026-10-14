import { defineCommand } from 'citty';
import { McpClient } from '../../core/mcp-client';
import { resolveConfig } from '../../core/config';
import { writeError, writeResult } from '../../output/format';

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
      const client = new McpClient(config);
      await client.initialize();
      const result = await client.listTools();
      writeResult(
        { ...result, tools: result.tools?.filter((tool) => tool.name.startsWith('staff-')) },
        args.format,
      );
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
