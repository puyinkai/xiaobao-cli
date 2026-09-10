/**
 * Shared args/body builder for `xiaobao-cli beautx *` — the four beautx (医美)
 * queries share one request shape (visitIds/wangIds/beautxCustomerIds/时间窗/分页).
 */

import { defineCommand } from 'citty';
import { xbApiFetch } from '../../core/api-client';
import { resolveConfig } from '../../core/config';
import { requireActiveProject } from '../../core/project-store';
import { csvToArray, toLocalDateTime } from '../../core/util';
import { tenantProjectHeaders } from '../../output/headers';
import { writeError, writeResult } from '../../output/format';

export function defineBeautxCommand(def: {
  name: string;
  description: string;
  path: string;
  /** latestOnly / dimensionName 仅部分端点生效 */
  supportsLatestOnly?: boolean;
  supportsDimension?: boolean;
}) {
  return defineCommand({
    meta: { name: def.name, description: def.description },
    args: {
      'visit-ids': { type: 'string', description: 'CSV: 来访 ID 过滤' },
      'customer-ids': { type: 'string', description: 'CSV: 客户 wang_id 过滤' },
      'beautx-customer-ids': { type: 'string', description: 'CSV: 医美业务客户 ID 过滤' },
      ...(def.supportsLatestOnly
        ? { 'latest-only': { type: 'boolean' as const, description: '每客户只取最新一条' } }
        : {}),
      ...(def.supportsDimension
        ? { dimension: { type: 'string' as const, description: '画像标签维度名过滤' } }
        : {}),
      from: { type: 'string', description: '开始时间（含）' },
      to: { type: 'string', description: '结束时间（不含）' },
      page: { type: 'string', default: '1' },
      size: { type: 'string', default: '10' },
      'api-base': { type: 'string' },
      'auth-base': { type: 'string' },
      format: { type: 'string', default: 'toon' },
    },
    async run({ args }) {
      try {
        const config = resolveConfig({
          apiBase: args['api-base'] as string | undefined,
          authBase: args['auth-base'] as string | undefined,
        });
        const active = await requireActiveProject();
        const result = await xbApiFetch(config, 'POST', def.path, {
          headers: tenantProjectHeaders(active),
          body: {
            visitIds: csvToArray(args['visit-ids'] as string | undefined),
            customerIds: csvToArray(args['customer-ids'] as string | undefined),
            beautxCustomerIds: csvToArray(args['beautx-customer-ids'] as string | undefined)?.map(Number),
            latestOnly: def.supportsLatestOnly ? (args['latest-only'] as boolean | undefined) : undefined,
            dimensionName: def.supportsDimension ? (args.dimension as string | undefined) : undefined,
            fromDate: toLocalDateTime(args.from as string | undefined),
            toDate: toLocalDateTime(args.to as string | undefined),
            page: Number(args.page),
            size: Number(args.size),
          },
        });
        writeResult(result, args.format as string);
      } catch (err) {
        writeError(err, args.format as string);
        process.exit(1);
      }
    },
  });
}
