/**
 * `xiaobao-cli admin sales-report` — 旺小宝公司经营数据（出库 / 回款）。
 *
 * super-admin 能力：按项目组（type 1，默认）或战区（type 2）返回指定日期区间的
 * 出库金额（outStockAmount）与回款/入库金额（receiveAmount）。数据来自内网金蝶
 * 报表，经 ai-open `POST /super-admin/sales-report` 代理；访问由独立白名单控制
 * （空名单 = 全拒），不在名单会收到引导文案。
 *
 * 公司级数据：不要求激活项目（有激活项目则顺带传 tenant headers）。
 */

import { defineCommand } from 'citty';
import { xbApiFetch } from '../../core/api-client';
import { resolveConfig } from '../../core/config';
import { loadActiveProject } from '../../core/project-store';
import { tenantProjectHeaders } from '../../output/headers';
import { writeError, writeResult } from '../../output/format';

export default defineCommand({
  meta: {
    name: 'sales-report',
    description: '公司经营数据：出库/回款金额，按 项目组(project) 或 战区(zone) 分组（独立白名单）',
  },
  args: {
    from: { type: 'string', required: true, description: '开始日期 yyyy-MM-dd（闭区间）' },
    to: { type: 'string', required: true, description: '结束日期 yyyy-MM-dd（闭区间）' },
    by: {
      type: 'string',
      default: 'project',
      description: '分组维度：project=项目组(type 1，默认) / zone=战区(type 2)',
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
      const by = String(args.by);
      if (by !== 'project' && by !== 'zone') {
        throw new Error(`--by 仅支持 project 或 zone，收到: ${by}`);
      }
      // Company-level report — active project not required; pass headers if present.
      const active = await loadActiveProject();
      const result = await xbApiFetch(config, 'POST', '/ai-open/super-admin/sales-report', {
        headers: active ? tenantProjectHeaders(active) : undefined,
        body: {
          startDate: args.from,
          endDate: args.to,
          type: by === 'zone' ? 2 : 1,
        },
      });
      writeResult(result, args.format);
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
