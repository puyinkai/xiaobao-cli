import { xbApiFetch, type ApiResult } from './api-client';
import type { ResolvedConfig } from './config';
import { requireActiveProject } from './project-store';
import { tenantProjectHeaders } from '../output/headers';

const MCP_PATH = '/mcp/wangai-cli';
const MCP_PROTOCOL_VERSION = '2025-06-18';

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
}

interface JsonRpcResponse<T> {
  jsonrpc?: string;
  id?: string | number;
  result?: T;
  error?: { code?: number; message?: string; data?: unknown };
}

export interface ToolsListResult {
  tools?: McpTool[];
  nextCursor?: string;
}

export interface McpContentBlock {
  type?: string;
  text?: string;
  data?: unknown;
}

export interface McpToolResult {
  content?: McpContentBlock[];
  isError?: boolean;
}

export class McpClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
    public readonly status?: number,
  ) {
    super(message);
    this.name = 'McpClientError';
  }
}

export class McpClient {
  private nextId = 1;

  constructor(private readonly config: ResolvedConfig) {}

  async initialize(): Promise<void> {
    await this.request('initialize', {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: {},
      clientInfo: { name: 'xiaobao-cli', version: '0.1.10' },
    });
    await this.notify('notifications/initialized');
  }

  async listTools(): Promise<ToolsListResult> {
    return this.request<ToolsListResult>('tools/list', {});
  }

  async callTool(name: string, variables: Record<string, unknown>): Promise<McpToolResult> {
    return this.request<McpToolResult>('tools/call', {
      name,
      arguments: { variables },
    });
  }

  private async notify(method: string): Promise<void> {
    const active = await requireActiveProject();
    const response = await xbApiFetch(this.config, 'POST', MCP_PATH, {
      headers: {
        ...tenantProjectHeaders(active),
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: { jsonrpc: '2.0', method },
      timeoutMs: 30_000,
    });
    if (!response.ok && response.status !== 202) {
      throw this.httpError(response);
    }
  }

  private async request<T>(method: string, params: unknown): Promise<T> {
    const active = await requireActiveProject();
    const response = await xbApiFetch(this.config, 'POST', MCP_PATH, {
      headers: {
        ...tenantProjectHeaders(active),
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: {
        jsonrpc: '2.0',
        id: `xiaobao-cli-${this.nextId++}`,
        method,
        params,
      },
      timeoutMs: 60_000,
    });
    if (!response.ok) throw this.httpError(response);

    const payload = response.data as JsonRpcResponse<T> | null;
    if (!payload || typeof payload !== 'object') {
      throw new McpClientError('INVALID_MCP_RESPONSE', 'MCP 服务返回了无效响应', payload, response.status);
    }
    if (payload.error) {
      throw new McpClientError(
        `JSONRPC_${payload.error.code ?? 'ERROR'}`,
        payload.error.message ?? 'MCP 请求失败',
        payload.error.data,
        response.status,
      );
    }
    if (!('result' in payload)) {
      throw new McpClientError('INVALID_MCP_RESPONSE', 'MCP 响应缺少 result', payload, response.status);
    }
    return payload.result as T;
  }

  private httpError(response: ApiResult): McpClientError {
    const data = response.data as { message?: string; error?: string } | string | null;
    const message = typeof data === 'object' && data?.message
      ? data.message
      : `MCP 网关请求失败（HTTP ${response.status}）`;
    const code = typeof data === 'object' && data?.error ? data.error : `HTTP_${response.status}`;
    return new McpClientError(code, message, data, response.status);
  }
}

export function parseToolPayload(result: McpToolResult): unknown {
  const text = result.content?.find((block) => block.type === 'text' && typeof block.text === 'string')?.text;
  if (text == null) {
    return result.content ?? result;
  }
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export function toolResultError(result: McpToolResult): McpClientError | null {
  if (!result.isError) return null;
  const payload = parseToolPayload(result);
  if (payload && typeof payload === 'object') {
    const p = payload as { code?: string; message?: string; msg?: string };
    return new McpClientError(p.code ?? 'MCP_TOOL_ERROR', p.message ?? p.msg ?? 'MCP 工具调用失败', payload);
  }
  return new McpClientError('MCP_TOOL_ERROR', String(payload));
}
