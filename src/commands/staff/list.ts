import { defineCommand } from 'citty';
import { getCurrentToken, xbApiFetch } from '../../core/api-client';
import { resolveConfig } from '../../core/config';
import { requireActiveProject } from '../../core/project-store';
import { decodeJwtPayload } from '../../core/token-store';
import { mcpProjectHeaders } from '../../output/headers';
import { writeError, writeResult } from '../../output/format';

const STAFF_TOOLS_PATH = '/mcp/wangai-cli';

type JsonRpcResponse = {
  result?: {
    tools?: Array<{ name: string; description?: string; inputSchema?: unknown }>;
    nextCursor?: string;
  };
  error?: { code?: number; message?: string; data?: unknown };
};

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
      const response = await xbApiFetch(config, 'POST', STAFF_TOOLS_PATH, {
        headers: mcpProjectHeaders(active, userId),
        body: {
          jsonrpc: '2.0',
          id: 'xiaobao-cli-staff-list',
          method: 'tools/list',
          params: {},
        },
        timeoutMs: 60_000,
      });
      if (!response.ok) {
        writeError({ code: 'API_ERROR', status: response.status, body: response.data }, args.format);
        process.exit(1);
      }

      const payload = response.data as JsonRpcResponse;
      if (payload.error) {
        throw Object.assign(new Error(payload.error.message ?? '员工工具列表获取失败'), {
          code: `JSONRPC_${payload.error.code ?? 'ERROR'}`,
          details: payload.error.data,
        });
      }
      const result = payload.result ?? {};
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
