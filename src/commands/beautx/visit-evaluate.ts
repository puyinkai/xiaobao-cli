import { defineBeautxCommand } from './shared';

export default defineBeautxCommand({
  name: 'visit-evaluate',
  description: '医美接诊评价分页（总分/总评 + 5 项能力分与建议）',
  path: '/ai-open/beautx/visit-evaluates',
});
