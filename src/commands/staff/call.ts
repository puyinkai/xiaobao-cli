import { defineCommand } from 'citty';
import { McpClient, parseToolPayload, toolResultError } from '../../core/mcp-client';
import { resolveConfig } from '../../core/config';
import { writeError, writeResult } from '../../output/format';

function parseVariables(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw Object.assign(new Error('--variables 必须是合法 JSON object'), { code: 'INVALID_VARIABLES' });
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw Object.assign(new Error('--variables 必须是 JSON object'), { code: 'INVALID_VARIABLES' });
  }
  return parsed as Record<string, unknown>;
}

export default defineCommand({
  meta: { name: 'call', description: '调用一个员工工具' },
  args: {
    tool: { type: 'positional', required: true, description: '工具名，如 staff-receptions' },
    variables: { type: 'string', description: '工具业务变量 JSON object' },
    'api-base': { type: 'string' },
    'auth-base': { type: 'string' },
    format: { type: 'string', default: 'json' },
  },
  async run({ args }) {
    try {
      const variables = parseVariables(args.variables);
      const config = resolveConfig({
        apiBase: args['api-base'],
        authBase: args['auth-base'],
      });
      const client = new McpClient(config);
      await client.initialize();
      const listed = await client.listTools();
      if (!args.tool.startsWith('staff-') || !listed.tools?.some((tool) => tool.name === args.tool)) {
        throw Object.assign(new Error(`员工工具未在当前服务开放：${args.tool}`), {
          code: 'MCP_TOOL_NOT_FOUND',
        });
      }
      const result = await client.callTool(args.tool, variables);
      const error = toolResultError(result);
      if (error) throw error;
      writeResult(parseToolPayload(result), args.format);
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
