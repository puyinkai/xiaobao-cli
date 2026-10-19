import { defineCommand } from 'citty';
import { getCurrentToken } from '../../core/api-client';
import { resolveConfig } from '../../core/config';
import { requireActiveProject } from '../../core/project-store';
import { decodeJwtPayload } from '../../core/token-store';
import { mcpProjectHeaders } from '../../output/headers';
import { writeError, writeResult } from '../../output/format';
import { fetchMcpTools, mcpRpc, type ToolResult } from '../../core/mcp-client';

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

function parseToolPayload(result: ToolResult): unknown {
  const text = result.content?.find((block) => block.type === 'text' && typeof block.text === 'string')?.text;
  if (text == null) return result.content ?? result;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export default defineCommand({
  meta: { name: 'call', description: '调用一个员工工具' },
  args: {
    tool: { type: 'positional', required: true, description: '工具名，如 staff-receptions' },
    variables: { type: 'string', description: '工具业务变量 JSON object' },
    'time-start': { type: 'string', description: 'MCP 统一统计起始时间（传给 X-MCP-Time-Range）' },
    'time-end': { type: 'string', description: 'MCP 统一统计结束时间（传给 X-MCP-Time-Range）' },
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
      const active = await requireActiveProject();
      const token = await getCurrentToken();
      const userId = typeof decodeJwtPayload(token?.access_token)?.sub === 'string'
        ? String(decodeJwtPayload(token?.access_token)?.sub)
        : undefined;
      const headers = mcpProjectHeaders(active, userId, {
        start: args['time-start'],
        end: args['time-end'],
      });

      // Pre-check against the live tool list so a tool that is not open here
      // fails fast as STAFF_TOOL_NOT_FOUND instead of a downstream error.
      const tools = await fetchMcpTools(config, headers);
      if (!args.tool.startsWith('staff-') || !tools.some((tool) => tool.name === args.tool)) {
        throw Object.assign(new Error(`员工工具未在当前服务开放：${args.tool}`), {
          code: 'STAFF_TOOL_NOT_FOUND',
        });
      }

      const result = await mcpRpc<ToolResult>(
        config,
        headers,
        {
          jsonrpc: '2.0',
          id: 'xiaobao-cli-staff-call',
          method: 'tools/call',
          params: {
            name: args.tool,
            arguments: { variables },
          },
        },
        60_000,
      );

      if (result.isError) {
        const toolError = parseToolPayload(result);
        const message =
          toolError && typeof toolError === 'object' && 'message' in toolError
            ? String((toolError as { message?: unknown }).message ?? '员工工具调用失败')
            : '员工工具调用失败';
        throw Object.assign(new Error(message), { code: 'STAFF_TOOL_ERROR', details: toolError });
      }
      writeResult(parseToolPayload(result), args.format);
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
