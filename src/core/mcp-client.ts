/**
 * MCP JSON-RPC client for the WangClaw data-plane surface
 * (`POST /mcp/{serviceCode}` → BFF).
 *
 * Lives in `core` because the surface is not staff-specific — every tool on
 * `/mcp/wangai-cli` travels the same envelope. Consumer today: the `staff`
 * commands.
 *
 * `tools/list` is cursor-paginated by the MCP contract: the server may answer
 * with one page plus a `nextCursor`. Callers must follow the cursor — otherwise
 * a tool that lands on a later page is silently missing from `staff list`, and
 * `staff call` rejects a perfectly valid tool with STAFF_TOOL_NOT_FOUND.
 */

import { xbApiFetch } from './api-client';
import type { ResolvedConfig } from './config';

/** Gateway registry key: serviceCode `wangai-cli`. Must match BFF `mcp.bff.service-code`. */
export const MCP_SERVICE_PATH = '/mcp/wangai-cli';

/** Stop following `nextCursor` after this many pages (guards a stuck server). */
const MAX_TOOL_LIST_PAGES = 20;

export type McpTool = {
  name: string;
  description?: string;
  inputSchema?: unknown;
};

export type JsonRpcResponse<T> = {
  result?: T;
  error?: { code?: number; message?: string; data?: unknown };
};

export type ToolsListResult = {
  tools?: McpTool[];
  nextCursor?: string;
};

/** `tools/call` result: the tool's own payload plus its error flag. */
export type ToolResult = {
  content?: Array<{ type?: string; text?: string; data?: unknown }>;
  isError?: boolean;
};

/**
 * POST a JSON-RPC request and unwrap `result`, turning HTTP and JSON-RPC
 * failures into throwable errors (rendered by `writeError`).
 */
export async function mcpRpc<T>(
  config: ResolvedConfig,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<T> {
  const response = await xbApiFetch(config, 'POST', MCP_SERVICE_PATH, {
    headers,
    body,
    timeoutMs,
  });
  const payload = (response.data ?? {}) as JsonRpcResponse<T>;

  if (!response.ok) {
    throw Object.assign(new Error(`MCP 请求失败（HTTP ${response.status}）`), {
      code: 'API_ERROR',
      status: response.status,
      details: payload,
    });
  }
  if (payload.error) {
    throw Object.assign(new Error(payload.error.message ?? 'MCP 请求失败'), {
      code: `JSONRPC_${payload.error.code ?? 'ERROR'}`,
      details: payload.error.data,
    });
  }
  if (payload.result === undefined) {
    throw Object.assign(new Error('MCP 响应缺少 result'), { code: 'INVALID_API_RESPONSE' });
  }
  return payload.result;
}

/** Fetch every page of `tools/list`, following `nextCursor` until exhausted. */
export async function fetchMcpTools(
  config: ResolvedConfig,
  headers: Record<string, string>,
): Promise<McpTool[]> {
  const tools: McpTool[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;

  for (let page = 0; page < MAX_TOOL_LIST_PAGES; page += 1) {
    const result = await mcpRpc<ToolsListResult>(
      config,
      headers,
      {
        jsonrpc: '2.0',
        id: `xiaobao-cli-mcp-tools-${page}`,
        method: 'tools/list',
        params: cursor ? { cursor } : {},
      },
      60_000,
    );
    tools.push(...(result.tools ?? []));

    const next = result.nextCursor;
    if (!next || seenCursors.has(next)) break;
    seenCursors.add(next);
    cursor = next;
  }

  return tools;
}
