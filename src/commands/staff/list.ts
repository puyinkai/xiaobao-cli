import { defineCommand } from 'citty';
import { resolveConfig } from '../../core/config';
import { requireActiveProject } from '../../core/project-store';
import { tenantProjectHeaders } from '../../output/headers';
import { writeError, writeResult } from '../../output/format';
import { fetchStaffTools } from '../../core/staff-client';

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
      const tools = await fetchStaffTools(config, tenantProjectHeaders(active));
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
