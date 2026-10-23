import { defineCommand } from 'citty';
import { resolveConfig } from '../../core/config';
import { requireActiveProject } from '../../core/project-store';
import { tenantProjectHeaders } from '../../output/headers';
import { writeError, writeResult } from '../../output/format';
import { fetchStaffTools, callStaffTool } from '../../core/staff-client';

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
    'time-start': { type: 'string', description: '统一统计起始时间（北京时间）' },
    'time-end': { type: 'string', description: '统一统计结束时间（北京时间）' },
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
      const headers = tenantProjectHeaders(active);

      // Pre-check against the live tool list so a tool that is not open here
      // fails fast as STAFF_TOOL_NOT_FOUND instead of a downstream error.
      const tools = await fetchStaffTools(config, headers);
      if (!args.tool.startsWith('staff-') || !tools.some((tool) => tool.name === args.tool)) {
        throw Object.assign(new Error(`员工工具未在当前服务开放：${args.tool}`), {
          code: 'STAFF_TOOL_NOT_FOUND',
        });
      }

      const payload = await callStaffTool(config, headers, args.tool, variables, {
        start: args['time-start'], end: args['time-end'],
      });
      writeResult(payload, args.format);
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
