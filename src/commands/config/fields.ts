/**
 * `xiaobao-cli config fields` — 客户字段配置分页。
 *
 * 返回本项目客户字段（名称/格式/说明/分类/AI 映射名），供解读
 * customer list 里 dynamic_tags 各标签的含义。调 POST /ai-open/customers/fields。
 */

import { defineCommand } from 'citty';
import { xbApiFetch } from '../../core/api-client';
import { resolveConfig } from '../../core/config';
import { requireActiveProject } from '../../core/project-store';
import { tenantProjectHeaders } from '../../output/headers';
import { writeError, writeResult } from '../../output/format';

export default defineCommand({
  meta: { name: 'fields', description: '客户字段配置分页（解读 dynamic_tags 标签含义）' },
  args: {
    page: { type: 'string', default: '1' },
    size: { type: 'string', default: '50' },
    'api-base': { type: 'string' },
    'auth-base': { type: 'string' },
    format: { type: 'string', default: 'toon' },
  },
  async run({ args }) {
    try {
      const config = resolveConfig({ apiBase: args['api-base'], authBase: args['auth-base'] });
      const active = await requireActiveProject();
      const result = await xbApiFetch(config, 'POST', '/ai-open/customers/fields', {
        headers: tenantProjectHeaders(active),
        body: { page: Number(args.page), size: Number(args.size) },
      });
      writeResult(result, args.format);
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
