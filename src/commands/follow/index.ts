import { defineCommand } from 'citty';

export default defineCommand({
  meta: {
    name: 'follow',
    description: '旺跟进：明细分页(list) / 电话微信指标汇总(summary)（聚合统计卡片用 quantum follow）',
  },
  subCommands: {
    list: () => import('./list').then((m) => m.default),
    summary: () => import('./summary').then((m) => m.default),
  },
});
