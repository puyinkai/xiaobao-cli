/**
 * `xiaobao-cli project list` — fetch the user's tenant + project roster.
 *
 * Mirrors openclaw-xiaobao/src/tools/list-projects.ts:
 *   - Calls GET /saas/v2/estate/tenant-and-estate/by-user-id
 *   - Flattens tenant.estateList into a single array
 *   - Optional `--keyword` does case-insensitive contains on tenantName/projectName
 *   - Skips estates with `enable === false`
 */

import { defineCommand } from 'citty';
import { xbApiFetch } from '../../core/api-client';
import { resolveConfig } from '../../core/config';
import { writeError, writeResult } from '../../output/format';

interface RawEstate {
  estateId?: string | number;
  estateName?: string;
  enable?: boolean;
}
interface RawTenant {
  tenantId?: string | number;
  tenantName?: string;
  estateList?: RawEstate[];
}
interface ApiEnvelope {
  code?: string | number;
  msg?: string;
  data?: RawTenant[];
}

export default defineCommand({
  meta: { name: 'list', description: '列出有权限的租户与项目（扁平表）' },
  args: {
    keyword: {
      type: 'string',
      description: '租户名/项目名包含模糊过滤（大小写不敏感），不传返回全部',
    },
    'api-base': { type: 'string' },
    'auth-base': { type: 'string' },
    format: { type: 'string', default: 'toon' },
  },
  async run({ args }) {
    try {
      const config = resolveConfig({
        apiBase: args['api-base'],
        authBase: args['auth-base'],
      });
      const result = await xbApiFetch(config, 'GET', '/saas/v2/estate/tenant-and-estate/by-user-id');
      if (!result.ok) {
        writeError(
          { code: 'API_ERROR', status: result.status, body: result.data },
          args.format,
        );
        process.exit(1);
      }
      const envelope = result.data as ApiEnvelope;
      const tenants = Array.isArray(envelope.data) ? envelope.data : [];
      const flat: Array<{
        tenantId: string;
        tenantName: string;
        projectId: string;
        projectName: string;
      }> = [];
      for (const t of tenants) {
        const tid = String(t.tenantId ?? '');
        const tname = t.tenantName ?? '';
        const estates = t.estateList ?? [];
        for (const e of estates) {
          if (e.enable === false) continue;
          flat.push({
            tenantId: tid,
            tenantName: tname,
            projectId: String(e.estateId ?? ''),
            projectName: e.estateName ?? '',
          });
        }
      }
      const kw = args.keyword?.trim().toLowerCase();
      const projects = kw
        ? flat.filter(
            (p) =>
              p.projectName.toLowerCase().includes(kw) ||
              p.tenantName.toLowerCase().includes(kw),
          )
        : flat;
      writeResult({ projects, count: projects.length }, args.format);
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
