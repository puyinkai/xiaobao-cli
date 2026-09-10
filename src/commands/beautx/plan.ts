import { defineBeautxCommand } from './shared';

export default defineBeautxCommand({
  name: 'plan',
  description: '医美变美计划分页（报告分组 sections + 面诊医生/复诊时间等）',
  path: '/ai-open/beautx/plans',
  supportsLatestOnly: true,
});
