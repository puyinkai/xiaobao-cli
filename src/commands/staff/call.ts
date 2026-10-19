import { defineCommand } from 'citty';
import { getCurrentToken, xbApiFetch } from '../../core/api-client';
import { resolveConfig } from '../../core/config';
import { requireActiveProject } from '../../core/project-store';
import { decodeJwtPayload } from '../../core/token-store';
import { mcpProjectHeaders } from '../../output/headers';
import { writeError, writeResult } from '../../output/format';

const STAFF_TOOLS_PATH = '/mcp/wangai-cli';

type Tool = { name: string; description?: string; inputSchema?: unknown };
type JsonRpcResponse<T> = {
  result?: T;
  error?: { code?: number; message?: string; data?: unknown };
};
type ToolsListResult = { tools?: Tool[] };
type ToolResult = { content?: Array<{ type?: string; text?: string; data?: unknown }>; isError?: boolean };

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

function throwRpcError(payload: JsonRpcResponse<unknown>, fallback: string): void {
  if (!payload.error) return;
  throw Object.assign(new Error(payload.error.message ?? fallback), {
    code: `JSONRPC_${payload.error.code ?? 'ERROR'}`,
    details: payload.error.data,
  });
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

      const listResponse = await xbApiFetch(config, 'POST', STAFF_TOOLS_PATH, {
        headers,
        body: {
          jsonrpc: '2.0',
          id: 'xiaobao-cli-staff-tools-list',
          method: 'tools/list',
          params: {},
        },
        timeoutMs: 60_000,
      });
      if (!listResponse.ok) {
        throw Object.assign(new Error(`员工工具列表请求失败（HTTP ${listResponse.status}）`), {
          code: 'API_ERROR',
          status: listResponse.status,
          details: listResponse.data,
        });
      }
      const listPayload = listResponse.data as JsonRpcResponse<ToolsListResult>;
      throwRpcError(listPayload, '员工工具列表获取失败');
      if (!args.tool.startsWith('staff-') || !listPayload.result?.tools?.some((tool) => tool.name === args.tool)) {
        throw Object.assign(new Error(`员工工具未在当前服务开放：${args.tool}`), {
          code: 'STAFF_TOOL_NOT_FOUND',
        });
      }

      const response = await xbApiFetch(config, 'POST', STAFF_TOOLS_PATH, {
        headers,
        body: {
          jsonrpc: '2.0',
          id: 'xiaobao-cli-staff-call',
          method: 'tools/call',
          params: {
            name: args.tool,
            arguments: { variables },
          },
        },
        timeoutMs: 60_000,
      });
      if (!response.ok) {
        throw Object.assign(new Error(`员工工具调用失败（HTTP ${response.status}）`), {
          code: 'API_ERROR',
          status: response.status,
          details: response.data,
        });
      }
      const payload = response.data as JsonRpcResponse<ToolResult>;
      throwRpcError(payload, '员工工具调用失败');
      const result = payload.result;
      if (!result) {
        throw Object.assign(new Error('员工工具响应缺少 result'), { code: 'INVALID_API_RESPONSE' });
      }
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
