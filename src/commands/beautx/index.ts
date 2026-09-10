import { defineCommand } from 'citty';

export default defineCommand({
  meta: {
    name: 'beautx',
    description: '医美：变美计划(plan) / 成交分析(deal-analysis) / 画像标签(portrait-tags) / 接诊评价(visit-evaluate)',
  },
  subCommands: {
    plan: () => import('./plan').then((m) => m.default),
    'deal-analysis': () => import('./deal-analysis').then((m) => m.default),
    'portrait-tags': () => import('./portrait-tags').then((m) => m.default),
    'visit-evaluate': () => import('./visit-evaluate').then((m) => m.default),
  },
});
