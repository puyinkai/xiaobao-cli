import { defineBeautxCommand } from './shared';

export default defineBeautxCommand({
  name: 'portrait-tags',
  description: '医美来访画像标签分页（维度 → 命中标签值；--dimension 过滤维度名）',
  path: '/ai-open/beautx/portrait-tags',
  supportsDimension: true,
});
