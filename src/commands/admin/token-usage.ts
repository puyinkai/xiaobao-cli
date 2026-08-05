/**
 * `xiaobao-cli admin token-usage` — 旺小宝 LLM token 用量汇总。
 *
 * super-admin 能力：返回指定日期区间（闭区间）的输入 / 输出 / 总量 tokens，可按
 * 模型、供应商、API Key、接入点、标签、状态过滤。数据来自内网 AI Portal，经
 * ai-open `POST /super-admin/token-usage` 代理；访问由独立白名单控制（空名单 =
 * 全拒），不在名单会收到引导文案。
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
    name: 'token-usage',
    description: 'LLM token 用量：输入/输出/总量，可按模型/供应商/Key 过滤（独立白名单）',
  },
  args: {
    from: { type: 'string', required: true, description: '开始日期 yyyy-MM-dd（闭区间）' },
    to: { type: 'string', required: true, description: '结束日期 yyyy-MM-dd（闭区间）' },
    model: { type: 'string', description: '模型过滤，如 gpt-4.1-mini' },
    provider: { type: 'string', description: '供应商过滤，如 openai' },
    upstream: { type: 'string', description: '上游过滤' },
    'api-key': { type: 'string', description: 'API Key 过滤' },
    endpoint: { type: 'string', description: '接入点过滤' },
    'tag-key': { type: 'string', description: '标签 key' },
    'tag-value': { type: 'string', description: '标签 value' },
    status: { type: 'string', description: '状态过滤，如 error（只看失败请求）' },
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
      // Company-level report — active project not required; pass headers if present.
      const active = await loadActiveProject();
      const result = await xbApiFetch(config, 'POST', '/ai-open/super-admin/token-usage', {
        headers: active ? tenantProjectHeaders(active) : undefined,
        body: {
          startDate: args.from,
          endDate: args.to,
          model: args.model,
          provider: args.provider,
          upstream: args.upstream,
          apiKey: args['api-key'],
          endpoint: args.endpoint,
          tagKey: args['tag-key'],
          tagValue: args['tag-value'],
          status: args.status,
        },
      });
      writeResult(result, args.format);
    } catch (err) {
      writeError(err, args.format);
      process.exit(1);
    }
  },
});
