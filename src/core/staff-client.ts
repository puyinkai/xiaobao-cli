/** Employee REST facade. Business payloads and errors retain the original staff CLI contract. */
import { xbApiFetch, type ApiResult } from './api-client';
import type { ResolvedConfig } from './config';

export type StaffTool = { name: string; description?: string; inputSchema?: unknown };
export const STAFF_TOOLS_PATH = '/ai-open/staff/tools';

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function unwrap(response: ApiResult): unknown {
  const result = response.data;
  if (!response.ok) {
    throw Object.assign(new Error(`员工接口请求失败（HTTP ${response.status}）`), {
      code: 'API_ERROR', status: response.status, details: result,
    });
  }
  if (!object(result) || String(result.code) !== '0') {
    throw Object.assign(new Error(object(result) ? String(result.msg ?? '员工接口请求失败') : '员工接口响应格式错误'), {
      code: 'API_ERROR', details: result,
    });
  }
  // ai-open's whitelist returns a successful Result carrying a guidance string.
  if (typeof result.data === 'string') {
    throw Object.assign(new Error(result.data), { code: 'ACCESS_DENIED', details: result });
  }
  return result.data;
}

export async function fetchStaffTools(config: ResolvedConfig, headers: Record<string, string>): Promise<StaffTool[]> {
  const data = unwrap(await xbApiFetch(config, 'GET', STAFF_TOOLS_PATH, { headers, timeoutMs: 90_000 }));
  if (!object(data) || !Array.isArray(data.tools) || data.tools.some((tool) =>
    !object(tool) || typeof tool.name !== 'string' || !tool.name.startsWith('staff-'))) {
    throw Object.assign(new Error('员工工具目录响应格式错误'), { code: 'INVALID_API_RESPONSE', details: data });
  }
  return data.tools as StaffTool[];
}

export async function callStaffTool(
  config: ResolvedConfig,
  headers: Record<string, string>,
  tool: string,
  variables: Record<string, unknown>,
  timeRange?: { start?: string; end?: string },
): Promise<unknown> {
  const data = unwrap(await xbApiFetch(config, 'POST', `${STAFF_TOOLS_PATH}/${encodeURIComponent(tool)}/call`, {
    headers, body: { variables, ...(timeRange?.start || timeRange?.end ? { timeRange } : {}) }, timeoutMs: 90_000,
  }));
  if (!object(data) || typeof data.isError !== 'boolean' || !('payload' in data)) {
    throw Object.assign(new Error('员工工具响应格式错误'), { code: 'INVALID_API_RESPONSE', details: data });
  }
  if (data.isError) {
    const error = data.payload;
    throw Object.assign(new Error(object(error) ? String(error.message ?? error.msg ?? '员工工具调用失败') : '员工工具调用失败'), {
      code: 'STAFF_TOOL_ERROR', details: error,
    });
  }
  return data.payload;
}
