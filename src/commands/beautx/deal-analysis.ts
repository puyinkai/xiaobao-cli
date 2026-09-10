import { defineBeautxCommand } from './shared';

export default defineBeautxCommand({
  name: 'deal-analysis',
  description: '医美成交分析分页（成交状态/未成交点/分析原因与结果）',
  path: '/ai-open/beautx/deal-analyses',
  supportsLatestOnly: true,
});
